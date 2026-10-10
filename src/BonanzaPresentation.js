import { BONANZA_DEMO_RULES } from './bonanza.js';
import { layoutBonanzaPayouts } from './slotCellPresentation.js';

// Presentation only. All outcomes and ledger amounts arrive from HallSession.
export const BONANZA_PACE = Object.freeze({
  deal: 1475, win: 650, remove: 280, payout: 850, payoutOut: 180, fall: 750,
  terminal: 410, betweenFreeSpins: 1025, scatter: 740, bonusPayment:1900,
  bonusIntro: 1800, retrigger: 1400, bonusSummary: 2200
});

const last = xs => xs?.[xs.length - 1];
const safe = x => Number.isSafeInteger(x) && x >= 0 ? x : 0;

// Opening/cancelling never calls the money/RNG engine. The intent is consumed
// synchronously before confirmation, so repeated clicks cannot buy twice.
export function createBonusPurchaseController(session) {
  let intent = null, serial = 0;
  return Object.freeze({
    open(stake) {
      if (intent || session.getSnapshot().busy) return null;
      if (!Number.isInteger(stake) || stake < BONANZA_DEMO_RULES.minimumUserStake || stake > BONANZA_DEMO_RULES.maximumUserStake || stake % BONANZA_DEMO_RULES.userStakeStep) {
        throw new RangeError('Ставка — от 5 до 100 АР с шагом 5.');
      }
      intent = Object.freeze({id: ++serial, stake,
        cost: stake * BONANZA_DEMO_RULES.bonusBuyMultiplier,
        costCents: stake * BONANZA_DEMO_RULES.bonusBuyMultiplier * 100,
        freeSpins: BONANZA_DEMO_RULES.initialFreeSpins});
      return intent;
    },
    cancel(id) {
      if (!intent || intent.id !== id) return false;
      intent = null;
      return true;
    },
    confirm(id) {
      if (!intent || intent.id !== id) return null;
      const selected = intent;
      intent = null;
      if (session.getSnapshot().busy) throw new RangeError('Дождитесь завершения раунда.');
      // HallSession rechecks its current balance and debits exactly once.
      return session.begin('slots', 'bonanza', selected.stake, {mode: 'buy'});
    },
    get current() { return intent; }
  });
}

export function buildBonanzaTimeline(round,{speed=1}={}) {
  if(![1,1.5,2].includes(speed))throw new RangeError('Unsupported animation speed.');
  if (!Array.isArray(round?.spins) || !round.spins.length) {
    throw new TypeError('A complete precomputed Bonanza round is required.');
  }
  const steps = [];
  const initialAward = round.bonusBought || round.preview ? 10 : 0;
  let awardedSpins = initialAward;
  let freeSpinIndex = 0, bonusPayoutCents = 0, totalPayoutCents = 0;
  let terminal = null;

  const add = (visual, duration, cue, details = {}) => {
    steps.push(Object.freeze({visual: Object.freeze(visual), duration:duration/speed, cue, details: Object.freeze(details)}));
  };
  const initial = round.spins[0].frames?.[0]?.before;
  if (!initial) throw new TypeError('The round has no initial grid.');
  if (awardedSpins) add({
    grid: initial, phase: 'bonus-intro', isFreeSpin: true,
    freeSpinIndex: 0, awardedSpins, bonusPayoutCents: 0,
    currentPayoutCents: 0, totalPayoutCents: 0, cascadePayoutCents: 0, multiplier: 1,
    cascade: 0, winningIds: [], removedIds: [], incomingIds: [],
    payoutGroups: [], spinSummary: null, scatterIds: [],
    bonusAnnouncement: {added: initialAward, total: initialAward, bought: !!round.bonusBought, costCents: safe(round.chargeCents)}
  }, BONANZA_PACE.bonusIntro, 'bonus', {bought: !!round.bonusBought});

  for (const spin of round.spins) {
    if (spin.isFreeSpin) freeSpinIndex++;
    let cascade = 0, symbolPayoutCents = 0, cascadePayoutCents = 0;
    const common = () => ({
      isFreeSpin: !!spin.isFreeSpin, freeSpinIndex, awardedSpins,
      bonusPayoutCents, totalPayoutCents,
      // Cascades are base symbol amounts. Only the engine's final spin amount
      // is added to the completed-round/bonus totals after multiplier and cap.
      currentPayoutCents: symbolPayoutCents, cascadePayoutCents,
      multiplier: 1, cascade, winningIds: [], removedIds: [],
      incomingIds: [], scatterIds: [], bonusAnnouncement: null,
      payoutGroups: [], spinSummary: null
    });
    const frames = spin.frames || [];
    if (!frames.length) throw new TypeError('The spin has no animation frames.');
    add({...common(), grid: frames[0].before, phase: 'deal'},
      BONANZA_PACE.deal, 'deal', {freeSpin: !!spin.isFreeSpin});

    for (const frame of frames) {
      if (frame.phase==='bonus-payment' || !frame.wins?.length) continue;
      cascade++;
      symbolPayoutCents = safe(frame.cumulativeCreditedSymbolWinCents ?? frame.cumulativeSymbolWinCents);
      cascadePayoutCents = safe(frame.creditedPayoutCents ?? frame.payoutCents);
      const winningIds = frame.wins.flatMap(win => win.cells.map(cell => cell.id));
      const removedIds = (frame.removed || []).map(cell => cell.id);
      const multiplier = frame.multiplier?.factor || 1;
      add({...common(), grid: frame.before, phase: 'win', winningIds, multiplier},
        BONANZA_PACE.win, cascadePayoutCents>0?'cascade':null, {cascade, multiplier});
      add({...common(), grid: frame.before, phase: 'remove', winningIds, removedIds, multiplier},
        BONANZA_PACE.remove, 'remove', {cascade});
      const payoutGroups = layoutBonanzaPayouts(frame.wins.map(win=>({...win,payoutCents:win.creditedPayoutCents??win.payoutCents})).filter(win=>win.payoutCents>0));
      add({...common(), grid: frame.afterRemoval, phase: 'payout', removedIds, multiplier, payoutGroups},
        BONANZA_PACE.payout, 'payout-groups', {cascade});
      add({...common(), grid: frame.afterRemoval, phase: 'payout-out', removedIds, multiplier, payoutGroups},
        BONANZA_PACE.payoutOut, 'payout-out', {cascade});
      add({...common(), grid: frame.after, phase: 'fall', multiplier,
        incomingIds: (frame.refill || []).map(item => item.cell.id),
        refill: frame.refill || [], beforeGrid: frame.before},
        BONANZA_PACE.fall, 'fall', {cascade});
    }

    const lastFrame = last(frames);
    awardedSpins += safe(spin.awardedSpins);
    const purchasePayment=safe(spin.bonusPurchaseFloorPaymentCents);
    const engineSpinPayout=safe(spin.payoutCents)-purchasePayment;
    totalPayoutCents += engineSpinPayout;
    if (spin.isFreeSpin) bonusPayoutCents += engineSpinPayout;
    terminal = {
      ...common(), grid: lastFrame.after || lastFrame.before,
      phase: 'settled', currentPayoutCents: engineSpinPayout,
      totalPayoutCents, bonusPayoutCents,
      multiplier: spin.multiplier || 1,
      spinSummary: Object.freeze({symbolWinCents: safe(spin.creditedSymbolWinCents ?? spin.symbolWinCents),
        multiplierWinCents: safe(spin.creditedMultiplierWinCents),
        scatterWinCents: safe(spin.creditedScatterWinCents ?? spin.scatterWinCents), multiplier: spin.multiplier || 1,
        payoutCents: engineSpinPayout, capped: !!spin.capped,
        uncappedPayoutCents: spin.uncappedPayoutCents})
    };
    if (spin.awardedSpins) {
      const scatterIds = terminal.grid.flat().filter(cell => cell?.kind === 'scatter').map(cell => cell.id);
      add({...terminal, phase: 'scatter', scatterIds}, BONANZA_PACE.scatter, 'scatter');
      add({...terminal, phase: 'bonus-intro', scatterIds,
        bonusAnnouncement: {added: spin.awardedSpins, total: awardedSpins, bought: false}},
        spin.isFreeSpin ? BONANZA_PACE.retrigger : BONANZA_PACE.bonusIntro,
        'bonus', {retrigger: !!spin.isFreeSpin});
    }
    add({...terminal, phase: 'spin-summary'}, spin.isFreeSpin ? BONANZA_PACE.betweenFreeSpins : BONANZA_PACE.terminal, 'spin-end',
      {payoutCents: engineSpinPayout});
    if (purchasePayment) {
      totalPayoutCents+=purchasePayment;if(spin.isFreeSpin)bonusPayoutCents+=purchasePayment;
      terminal={...terminal,totalPayoutCents,bonusPayoutCents,currentPayoutCents:safe(spin.payoutCents)};
      add({...terminal,phase:'bonus-payment',bonusPaymentCents:purchasePayment,
        bonusMinimumCents:safe(round.bonusMinimumCents),bonusPurchaseCostCents:safe(round.chargeCents),
        winningIds:[],removedIds:[],incomingIds:[],payoutGroups:[],scatterIds:[],bonusAnnouncement:null},
        BONANZA_PACE.bonusPayment,'receipt',{bonusPaymentCents:purchasePayment});
    }
  }
  // Use the engine's capped final amount, never reconstruct a financial result.
  terminal = Object.freeze({
    ...terminal, phase: 'settled', totalPayoutCents: safe(round.payoutCents),
    bonusPayoutCents, winningIds: [], removedIds: [], incomingIds: [],
    scatterIds: [], bonusAnnouncement: null, payoutGroups: [], capped: !!round.capped
  });
  if (awardedSpins) add({...terminal, phase: 'bonus-summary'},
    BONANZA_PACE.bonusSummary, 'bonus-summary', {payoutCents: bonusPayoutCents});
  return Object.freeze({steps: Object.freeze(steps), terminal});
}

// Host owns settlement: onFinish should call session.complete(round.id) exactly once.
// No timers survive finish(), skip(), or dispose(). No outcome is generated here.
export function createBonanzaPlayback(round, {
  speed=1, onVisual, onCue = () => {}, onPause = () => {}, onFinish,
  clock = {now: () => performance.now(), set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id)},
  visibility = typeof document === 'undefined' ? null : document
}) {
  if (typeof onVisual !== 'function' || typeof onFinish !== 'function') {
    throw new TypeError('onVisual and onFinish callbacks are required.');
  }
  const {steps, terminal} = buildBonanzaTimeline(round,{speed});
  let closed = false, started = false, timer = null, wake = null, rejectWake = null;
  let remaining = 0, since = 0, disposed = false;
  const hidden = () => !!visibility?.hidden;
  const clearTimer = () => {
    if (timer !== null) clock.clear(timer);
    timer = null;
  };
  function arm() {
    if (closed || hidden() || !wake) return;
    since = clock.now();
    timer = clock.set(() => {
      timer = null; remaining = 0;
      const resolve = wake; wake = null; rejectWake = null; resolve(true);
    }, remaining);
  }
  function changed() {
    if (closed) return;
    try {
      onPause(hidden());
      if (closed || !wake) return;
      if (hidden()) {
        if (timer !== null) remaining = Math.max(0, remaining - (clock.now() - since));
        clearTimer();
      } else if (timer === null) arm();
    } catch (error) {
      const reject = rejectWake;
      wake = null; rejectWake = null;
      let failure = error;
      try { finish('presentation-error'); }
      catch (cleanupError) {
        if (cleanupError !== error) failure = new AggregateError([error, cleanupError], 'Playback and cleanup failed.');
      }
      if (reject) reject(failure);
      else throw failure;
    }
  }
  function wait(ms) {
    if (closed) return Promise.resolve(false);
    return new Promise((resolve, reject) => {
      remaining = ms; wake = resolve; rejectWake = reject; arm();
    });
  }
  function finish(reason = 'complete', showTerminal = true) {
    if (closed) return false;
    closed = true;
    clearTimer();
    visibility?.removeEventListener?.('visibilitychange', changed);
    const resolve = wake; wake = null; rejectWake = null; resolve?.(false);
    // Settlement must survive a rendering exception.
    try {
      if (!disposed) { onPause(false); if (showTerminal) onVisual(terminal); }
    }
    finally { onFinish(round, reason); }
    return true;
  }
  visibility?.addEventListener?.('visibilitychange', changed);

  return Object.freeze({
    async start({reducedMotion = false} = {}) {
      if (started || closed) return false;
      started = true;
      try {
        onPause(hidden());
        if (closed) return false;
        if (reducedMotion) return finish('reduced');
        for (const step of steps) {
          if (closed) return false;
          if (hidden() && !await wait(0)) return false;
          if (closed) return false;
          onVisual(step.visual);
          if (closed) return false;
          onCue(step.cue, step.details);
          if (closed) return false;
          if (!await wait(step.duration)) return false;
        }
        return finish();
      } catch (error) {
        if (!closed) finish('presentation-error');
        throw error;
      }
    },
    skip: () => finish('skip'),
    dispose: () => { disposed = true; return finish('unmount', false); },
    get closed() { return closed; }
  });
}
