import {applyBonusPurchaseFloor} from './bonus-purchase-floor.js';
import {HUEVO_RTP} from './runtime-rtp-range.js';
import {
  BONANZA_DEMO_RULES, createCryptoRandomInt
} from './bonanza.js';
import { createBlackjackHand, evaluateBlackjack, isBlackjackContinuation, hitBlackjack, standBlackjack, revealBlackjack, dealerStepBlackjack, finishBlackjack, blackjackPublicView } from './blackjack.js';
import { createDemoReserve } from './demo-reserve.js';
import { stakeLimits, permittedStake } from './stake-limits.js';
import { MASK_SLOT_RULES, LEXOF_FEATURE_RULES } from './mask-slots.js';
import {playUniversalSlotRound} from './universal-slot-admission.js';
import { DEFAULT_SLOT_PROFILES, SLOT_PROFILE_GAMES, validateSlotProfiles, slotProfileSnapshot } from './slot-rtp-profiles.js';
import { CLASSIC_PROFILE_GAMES, DEFAULT_CLASSIC_PROFILES, classicProfileSnapshot, classicRules, settleClassic, blackjackProfileOptions } from './classic-rtp-profiles.js';
import { DEFAULT_DEMO_STAKE_LIMITS, DEFAULT_DEMO_PRESENTATION, validateDemoSettings } from './demo-settings.js';

export function validateAmount(value, balance, game, configuredLimits) {
  if (!Number.isFinite(value) || !Number.isInteger(value)) return 'Введите целую ставку.';
  const limits = configuredLimits ?? stakeLimits(game);
  if (!permittedStake(value, limits)) return `Ставка — от ${limits.min} до ${limits.max} АР с шагом ${limits.step}.`;
  if (value > balance) return 'Недостаточно демо-фишек.';
  return '';
}

export function bonusPurchaseConfig(game='slots', bonusTier) {
  if (game==='slots') return bonusTier===undefined?{multiplier:BONANZA_DEMO_RULES.bonusBuyMultiplier}:null;
  const config=MASK_SLOT_RULES[game];
  if (!config) return null;
  const offers=config.bonusBuys || [{id:game==='maskhouse'?'sticky':'luck',multiplier:config.bonusBuyMultiplier}];
  return bonusTier===undefined?offers[0]:offers.find(offer=>offer.id===bonusTier);
}

export function validateBonusPurchase(stake, balance, game='slots', bonusTier, configuredLimits) {
  const error = validateAmount(stake, Infinity, game, configuredLimits);
  if (error) return error;
  const multiplier = bonusPurchaseConfig(game,bonusTier)?.multiplier;
  if(!multiplier)return 'В этой игре нет покупки бонуса.';
  const cost = stake * multiplier;
  if (cost > balance) return 'Для покупки бонуса нужно ' + cost + ' АР (' + multiplier + '× ставки).';
  return '';
}

export function featureSpinConfig(game, featureMode) {
  return game === 'lecipher' && Object.hasOwn(LEXOF_FEATURE_RULES, featureMode)
    ? LEXOF_FEATURE_RULES[featureMode] : null;
}
export function validateFeatureSpin(stake, balance, game, featureMode, configuredLimits) {
  const error = validateAmount(stake, Infinity, game, configuredLimits);
  if (error) return error;
  const feature = featureSpinConfig(game, featureMode);
  if (!feature) return 'Этот режим спина недоступен.';
  const cost = stake * feature.multiplier;
  if (!Number.isSafeInteger(cost) || cost > balance)
    return `Для запуска нужно ${cost} АР (${feature.multiplier}× ставки).`;
  return '';
}

const cents = (value) => {
  const result = Math.round(value * 100);
  if (!Number.isFinite(value) || !Number.isSafeInteger(result) || result < 0) {
    throw new RangeError('Некорректная выплата.');
  }
  return result;
};

// In-memory DEMO ledger. These invariants prevent accidental/double settlement;
// a browser is not an authoritative boundary for redeemable funds.
export class HallSession {
  #math; #randomInt; #id = 0; #reservationId = 0; #computing = false;
  #active = new Map(); #holds = new WeakMap(); #hands = new WeakMap(); #listeners = new Set();
  #balanceCents; #snapshot; #reserve; #initialBalanceCents; #rtpProfiles; #profileRevision = 1;
  #classicRtpProfiles; #stakeLimits; #presentation; #pendingPayoutCaps = 0n; #fixedRtp;
  constructor(math = globalThis.IndictusDemoMath, randomInt,
    { initialBalanceCents = 100000, houseCapitalCents = 1000000, rtpProfiles = DEFAULT_SLOT_PROFILES,
      classicRtpProfiles = DEFAULT_CLASSIC_PROFILES, stakeLimits: configuredLimits = DEFAULT_DEMO_STAKE_LIMITS,
      presentation = DEFAULT_DEMO_PRESENTATION, fixedRtp = null } = {}) {
    if (!Number.isSafeInteger(initialBalanceCents) || initialBalanceCents < 0) {
      throw new RangeError('Некорректный демо-баланс.');
    }
    this.#math = math;
    const settings=validateDemoSettings({rtpProfiles,classicRtpProfiles,stakeLimits:configuredLimits,presentation});
    if(fixedRtp!==null&&(fixedRtp!==HUEVO_RTP||[...Object.values(settings.rtpProfiles),...Object.values(settings.classicRtpProfiles)].some(v=>v!==fixedRtp)))
      throw new RangeError('huEVO использует единый неизменный профиль '+HUEVO_RTP+'%.');
    this.#fixedRtp=fixedRtp;
    this.#rtpProfiles=settings.rtpProfiles; this.#classicRtpProfiles=settings.classicRtpProfiles;
    this.#stakeLimits=settings.stakeLimits; this.#presentation=settings.presentation;
    this.#randomInt = randomInt || createCryptoRandomInt();
    this.#initialBalanceCents = this.#balanceCents = initialBalanceCents;
    this.#reserve = createDemoReserve({ capitalCents: houseCapitalCents });
    this.#snapshot = Object.freeze({ balance: initialBalanceCents / 100,
      busy: false, activeCount: 0, pendingGame: null, history: Object.freeze([]), result: null,
      rtpProfiles: this.#rtpProfiles, classicRtpProfiles:this.#classicRtpProfiles,
      stakeLimits:this.#stakeLimits,presentation:this.#presentation,profileRevision: this.#profileRevision });
  }
  get id() { return this.#id; }
  get active() { return new Map(this.#active); }
  get balanceCents() { return this.#balanceCents; }
  get pending() { return this.#active.values().next().value || null; }
  getReserveSnapshot = () => this.#reserve.snapshot();
  subscribe = listener => {
    if (typeof listener !== 'function') throw new TypeError('Нужен обработчик состояния.');
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };
  getSnapshot = () => this.#snapshot;
  setRtpProfiles(value) {
    return this.setDemoSettings({...this.#settings(),rtpProfiles:validateSlotProfiles(value)});
  }
  setClassicRtpProfiles(value) {
    return this.setDemoSettings({...this.#settings(),classicRtpProfiles:value});
  }
  #settings() {
    return {rtpProfiles:this.#rtpProfiles,classicRtpProfiles:this.#classicRtpProfiles,stakeLimits:this.#stakeLimits,presentation:this.#presentation};
  }
  setDemoSettings(value,{expectedRevision}={}) {
    const next=validateDemoSettings(value);
    if(this.#fixedRtp!==null&&[...Object.values(next.rtpProfiles),...Object.values(next.classicRtpProfiles)].some(v=>v!==this.#fixedRtp))
      throw new RangeError('Профиль huEVO зафиксирован на '+this.#fixedRtp+'%.');
    if(expectedRevision!==undefined&&(!Number.isSafeInteger(expectedRevision)||expectedRevision!==this.#profileRevision))
      throw new RangeError('Настройки уже изменились. Откройте актуальную панель и повторите.');
    if(this.#computing||this.#active.size)throw new RangeError('Завершите принятый раунд перед сменой настроек.');
    if(JSON.stringify(next)===JSON.stringify(this.#settings()))return false;
    if(!Number.isSafeInteger(this.#profileRevision+1))throw new RangeError('Начните новый демо-сеанс.');
    this.#rtpProfiles=next.rtpProfiles;this.#classicRtpProfiles=next.classicRtpProfiles;
    this.#stakeLimits=next.stakeLimits;this.#presentation=next.presentation;
    this.#profileRevision++;
    this.#publish({...next,profileRevision:this.#profileRevision});
    return true;
  }
  #publish(patch) {
    // Wallet cents never round-trip through display floats or caller patches.
    this.#snapshot = Object.freeze({ ...this.#snapshot, ...patch,
      balance: this.#balanceCents / 100 });
    for (const listener of this.#listeners) {
      try { listener(); } catch (error) { console.error('Indictus state observer', error); }
    }
  }
  canBegin(game) {
    if (this.#computing) return false;
    if (!this.#active.size) return true;
    return game === 'plinko' && this.pending.game === 'plinko';
  }
  #activityPatch() {
    return { busy: this.#active.size > 0, activeCount: this.#active.size,
      pendingGame: this.pending?.game || null };
  }
  #selection(game, choice, mode, bonusTier, featureMode) {
    const slot = ['slots', 'maskhouse', 'lecipher'].includes(game);
    if (slot && choice != null && ![game, 'bonanza'].includes(choice)) {
      throw new RangeError('Неизвестный выбор слота.');
    }
    return { game, choice: slot ? undefined : choice, mode,
      bonusTier: mode === 'buy' ? bonusTier : undefined,
      ...(featureMode == null ? {} : { featureMode }) };
  }
  #admit(selection) {
    const reserveId = ++this.#reservationId;
    if (!Number.isSafeInteger(reserveId) || !Number.isSafeInteger(this.#id + 1)) {
      throw new RangeError('Начните новый демо-сеанс.');
    }
    const admitted = this.#reserve.reserve({ ...selection, roundId: reserveId }, {allowUnfundedPlinko:selection.game === 'plinko'});
    if (!admitted) {
      throw new RangeError('Ставка временно недоступна.');
    }
    return admitted.record;
  }
  begin(game, choice, stake, { preview = false, mode, bonusTier, featureMode } = {}) {
    if (!this.canBegin(game)) return null;
    const roundMode = mode ?? (preview ? 'preview' : 'paid');
    if (!['paid', 'buy', 'preview'].includes(roundMode)) throw new RangeError('Неизвестный режим раунда.');
    if (preview && roundMode !== 'preview') throw new RangeError('Просмотр нельзя совместить с платным раундом.');
    const displayOnly = roundMode === 'preview', bonusBought = roundMode === 'buy';
    const featured = featureMode != null;
    if (featured && (roundMode !== 'paid' || bonusTier != null || !featureSpinConfig(game, featureMode)))
      throw new RangeError('Этот режим спина недоступен.');
    if (displayOnly && game !== 'slots' || bonusBought && !['slots', 'maskhouse', 'lecipher'].includes(game)) {
      throw new RangeError('Этот режим бонуса недоступен.');
    }
    const error = bonusBought
      ? validateBonusPurchase(stake, this.#snapshot.balance, game, bonusTier, this.#stakeLimits[game])
      : featured ? validateFeatureSpin(stake, this.#snapshot.balance, game, featureMode, this.#stakeLimits[game])
      : validateAmount(stake, displayOnly ? Infinity : this.#snapshot.balance, game, this.#stakeLimits[game]);
    if (error) throw new RangeError(error);
    const openingCents = this.#balanceCents, stakeCents = cents(stake);
    const chargeCents = displayOnly ? 0 : stakeCents * (bonusBought ? bonusPurchaseConfig(game, bonusTier).multiplier : featured ? featureSpinConfig(game, featureMode).multiplier : 1);
    if (!Number.isSafeInteger(chargeCents) || chargeCents > openingCents) throw new RangeError('Недостаточно демо-фишек.');
    const selection = this.#selection(game, choice, roundMode, bonusTier, featureMode);
    const isSlot=SLOT_PROFILE_GAMES.includes(game),isClassic=CLASSIC_PROFILE_GAMES.includes(game);
    const profileValue = isSlot ? this.#rtpProfiles[game] : isClassic ? this.#classicRtpProfiles[game] : null;
    const acceptedProfile = profileValue === null ? null : isSlot ? slotProfileSnapshot(game,profileValue,selection) : classicProfileSnapshot(game,profileValue,selection);
    const acceptedRevision=this.#profileRevision,acceptedLimits=this.#stakeLimits[game],acceptedPresentation=this.#presentation;
    // Every liability is recorded before RNG. Plinko accepts unfunded exposure
    // without reducing, retrying or filtering its outcome; other games stay funded.
    const hold = displayOnly ? null : this.#admit({ ...selection, stake, stakeLimits:acceptedLimits, ...(acceptedProfile ? {rtpProfile:profileValue} : {}) });
    let data, payoutCents, round;
    this.#computing = true;
    try {
      // Numeric headroom is an outcome-independent admission condition: every
      // accepted pending round could reach its public maximum, not its drawn payout.
      if (hold && BigInt(openingCents) - BigInt(chargeCents) + this.#pendingPayoutCaps + BigInt(hold.terms.maxPayoutCents) > BigInt(Number.MAX_SAFE_INTEGER))
        throw new RangeError('Недоступен демо-счёт: недостаточно точного числового диапазона.');
      if (game === 'slots') {
        data = playUniversalSlotRound({game,stakeCents,randomInt:this.#randomInt,mode:roundMode,rtpProfile:profileValue});
        payoutCents = data.payoutCents;
      } else if (game === 'maskhouse' || game === 'lecipher') {
        data = playUniversalSlotRound({game,stakeCents,mode:roundMode,bonusTier,featureMode,randomInt:this.#randomInt,rtpProfile:profileValue});
        payoutCents = data.payoutCents;
        if (data.chargeCents !== chargeCents) throw new RangeError('Некорректная стоимость слота.');
      } else {
        if (!this.#math || typeof this.#math.settle !== 'function') throw new Error('Модуль игр не загружен.');
        const config = classicRules(game, choice, profileValue, this.#math);
        data = settleClassic(game, choice, stake, Math.floor(openingCents / 100), this.#randomInt(config.sampleSize), profileValue, this.#math);
        payoutCents = cents(data.payout);
      }
      if (isSlot && bonusBought) {
        data=applyBonusPurchaseFloor(data,{game,mode:roundMode,chargeCents,profileRules:acceptedProfile});
        payoutCents=data.payoutCents;
      }
      if (!Number.isSafeInteger(payoutCents) || payoutCents < 0
        || hold && payoutCents > hold.terms.maxPayoutCents) throw new RangeError('Некорректная выплата раунда.');
      const closingCents = displayOnly ? openingCents : openingCents - chargeCents + payoutCents;
      if (!Number.isSafeInteger(closingCents) || closingCents < 0) throw new RangeError('Недоступен демо-счёт.');
      const netCents = displayOnly ? 0 : payoutCents - chargeCents;
      round = Object.freeze({ ...data, id: this.#id + 1, game, choice, stake, stakeCents, openingCents,
        mode: roundMode, preview: displayOnly, bonusBought, ...(featured ? { featureMode } : {}), chargeCents, cost: chargeCents / 100,
        payoutCents, payout: payoutCents / 100, netCents, net: netCents / 100, won: !displayOnly && netCents > 0,
        settingsRevision:acceptedRevision,stakeLimits:acceptedLimits,presentation:acceptedPresentation,
        ...(acceptedProfile ? {rtpProfile:acceptedProfile,profileRevision:acceptedRevision,
          ...(isSlot?{profileExtraFreeSpins:data.profileExtraFreeSpins ?? data.profile?.extraFreeSpins ?? 0}:{})} : {}) });
    } catch (error) {
      // Local synchronous failures issue no playable round and debit no wallet.
      // A real server must persist/resume started RNG, not copy this demo rollback.
      if (hold) this.#reserve.cancel(hold.terms.roundId);
      throw error;
    } finally { this.#computing = false; }
    this.#id = round.id;
    this.#active.set(round.id, round);
    if (hold) { this.#holds.set(round, hold); this.#pendingPayoutCaps += BigInt(hold.terms.maxPayoutCents); }
    this.#balanceCents -= chargeCents;
    this.#publish({ ...this.#activityPatch(), result: null });
    return round;
  }
  complete(id) {
    const round = this.#active.get(id);
    if (!round || round.game === 'blackjack') return false;
    return this.#settle(round);
  }
  // Compatibility does not grant callers the right to substitute a payout.
  completeStored(round) {
    if (!round || this.#active.get(round.id) !== round || round.game === 'blackjack') return false;
    return this.#settle(round);
  }
  #settle(stored, resolved = stored) {
    if (this.#active.get(stored.id) !== stored) return false;
    const payoutCents = stored.preview ? 0 : resolved.payoutCents;
    if (!Number.isSafeInteger(payoutCents) || payoutCents < 0) throw new RangeError('Некорректная выплата.');
    const closingCents = this.#balanceCents + payoutCents;
    if (!Number.isSafeInteger(closingCents) || closingCents < 0) throw new RangeError('Недоступен демо-счёт.');
    const completed = Object.freeze({ ...resolved, balance: closingCents / 100, timestamp: Date.now() });
    const hold = this.#holds.get(stored);
    if (hold) this.#reserve.settle(hold.terms.roundId, payoutCents);
    this.#balanceCents = closingCents;
    this.#active.delete(stored.id);
    if (hold) this.#pendingPayoutCaps -= BigInt(hold.terms.maxPayoutCents);
    this.#holds.delete(stored); this.#hands.delete(stored);
    this.#publish({ ...this.#activityPatch(), result: completed,
      history: stored.preview ? this.#snapshot.history
        : Object.freeze([completed, ...this.#snapshot.history].slice(0, 20)) });
    return true;
  }
  completeAll(game) {
    let completed = 0;
    for (const round of [...this.#active.values()]) {
      if ((!game || round.game === game) && this.complete(round.id)) completed++;
    }
    return completed;
  }
  beginBlackjack(stake) {
    if (!this.canBegin('blackjack')) return null;
    const error = validateAmount(stake, this.#snapshot.balance, 'blackjack', this.#stakeLimits.blackjack);
    if (error) throw new RangeError(error);
    const profileValue=this.#classicRtpProfiles.blackjack,acceptedProfile=classicProfileSnapshot('blackjack',profileValue),options=blackjackProfileOptions(profileValue);
    const acceptedRevision=this.#profileRevision,acceptedLimits=this.#stakeLimits.blackjack,acceptedPresentation=this.#presentation;
    const stakeCents = cents(stake), hold = this.#admit({ game: 'blackjack', stake,rtpProfile:profileValue,stakeLimits:acceptedLimits });
    let hand, handle, round;
    this.#computing = true;
    try {
      // Even the largest legitimate credit must fit the wallet before debit.
      if (BigInt(this.#balanceCents) - BigInt(stakeCents) + this.#pendingPayoutCaps + BigInt(hold.terms.maxPayoutCents) > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new RangeError('Недоступен демо-счёт.');
      }
      hand = createBlackjackHand({ randomInt: this.#randomInt,...options });
      handle = this.#handHandle(hand);
      round = Object.freeze({ id: this.#id + 1, game: 'blackjack', hand: handle,
        mode: 'paid', preview: false, stake, stakeCents, chargeCents: stakeCents,
        cost: stake, openingCents: this.#balanceCents,rtpProfile:acceptedProfile,profileRevision:acceptedRevision,
        settingsRevision:acceptedRevision,stakeLimits:acceptedLimits,presentation:acceptedPresentation });
    } catch (error) { this.#reserve.cancel(hold.terms.roundId); throw error; }
    finally { this.#computing = false; }
    this.#id = round.id;
    this.#active.set(round.id, round); this.#holds.set(round, hold); this.#pendingPayoutCaps += BigInt(hold.terms.maxPayoutCents); this.#hands.set(round, Object.freeze({ initial: hand, current: hand, handle }));
    this.#balanceCents -= stakeCents;
    this.#publish({ ...this.#activityPatch(), result: null });
    return round;
  }
  #handHandle(hand) {
    // No remaining shoe, RNG, cursor, private lineage, or hidden hole card.
    return Object.freeze({ ...blackjackPublicView(hand), phase: hand.phase });
  }
  blackjackView(id, handle, options = {}) {
    const round = this.#active.get(id), state = round && this.#hands.get(round);
    if (!state || state.handle !== handle) throw new RangeError('Недоступная раздача.');
    const hand = state.current;
    return blackjackPublicView(hand, { ...options,
      revealed: hand.phase !== 'player' && Boolean(options.revealed),
      settled: hand.phase === 'resolved' && Boolean(options.settled) });
  }
  advanceBlackjack(id, action, expectedHand) {
    if (typeof action !== 'string') throw new RangeError('Неизвестный ход Blackjack.');
    const round = this.#active.get(id);
    if (!round || round.game !== 'blackjack') return null;
    const state = this.#hands.get(round);
    if (expectedHand !== state.handle) throw new RangeError('Этот ход уже выполнен или относится к другой раздаче.');
    const actions = { hit: hitBlackjack, stand: standBlackjack, reveal: revealBlackjack,
      dealer: dealerStepBlackjack, finish: finishBlackjack };
    if (!Object.hasOwn(actions, action)) throw new RangeError('Неизвестный ход Blackjack.');
    const next = actions[action](state.current), handle = this.#handHandle(next);
    this.#hands.set(round, Object.freeze({ initial: state.initial, current: next, handle }));
    return handle;
  }
  completeBlackjack(id, hand) {
    const round = this.#active.get(id);
    if (!round || round.game !== 'blackjack') return false;
    const state = this.#hands.get(round);
    if (hand !== state.handle || !isBlackjackContinuation(state.initial, state.current)) {
      throw new RangeError('Эта рука не относится к оплаченной раздаче.');
    }
    const outcome = evaluateBlackjack(state.current), payoutCents = round.stakeCents * outcome.payoutMultiplier;
    if (!Number.isSafeInteger(payoutCents) || payoutCents < 0) throw new RangeError('Некорректная выплата Blackjack.');
    const netCents = payoutCents - round.chargeCents;
    return this.#settle(round, Object.freeze({ ...round, ...outcome,
      label: outcome.title, payoutCents, payout: payoutCents / 100,
      netCents, net: netCents / 100, won: netCents > 0 }));
  }
  reset() {
    if (this.#active.size || this.#computing || !this.#reserve.reset()) return false;
    this.#balanceCents = this.#initialBalanceCents;
    this.#publish({ ...this.#activityPatch(), history: Object.freeze([]), result: null });
    return true;
  }
}
