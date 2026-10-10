// Presentation only. These poses consume accepted visual data; they never draw
// a ticket, change a result, or consult the player's balance/history.
export const LEXOF_MASCOT_POSES = Object.freeze({
  idle: Object.freeze({ name: 'idle', frame: 0 }),
  watch: Object.freeze({ name: 'watch', frame: 2 }),
  win: Object.freeze({ name: 'win', frame: 3 }),
  rainbow: Object.freeze({ name: 'rainbow', frame: 4 }),
  loss: Object.freeze({ name: 'loss', frame: 5 })
});

const has = (value, key) => value != null && Object.hasOwn(value, key);
const cents = value => Number.isSafeInteger(value) && value > 0 ? value : 0;
function amount(value, creditedKey, currentKey) {
  // An explicitly credited zero takes precedence over a nominal positive value.
  if (has(value, creditedKey)) return cents(value[creditedKey]);
  return cents(value?.[currentKey]);
}

export function lexofMascotCreditedCents(visual = {}) {
  visual = visual && typeof visual === 'object' ? visual : {};
  if (visual.phase === 'settled' || visual.phase === 'bonus-summary') {
    return amount(visual, 'creditedTotalPayoutCents', 'totalPayoutCents');
  }
  if (visual.phase === 'summary' || visual.phase === 'spin-summary') {
    return amount(visual, 'creditedSpinPayoutCents', 'spinPayoutCents');
  }
  if (has(visual, 'creditedPayoutCents')) return cents(visual.creditedPayoutCents);
  if (visual.phase === 'collect') {
    return amount(visual, 'creditedFeaturePayoutCents', 'featurePayoutCents');
  }
  if (visual.phase === 'bonus-payment') {
    return amount(visual, 'creditedBonusPaymentCents', 'bonusPaymentCents');
  }
  if (visual.phase === 'payline') {
    return amount(visual.activeLine, 'creditedPayoutCents', 'payoutCents');
  }
  if (visual.phase === 'win' || visual.phase === 'pay') {
    // In the live Mask timeline, wins[].payoutCents is the credited amount.
    // rawPayoutCents, coinPreviewPayouts and shown cumulative amounts are ignored.
    return (Array.isArray(visual.wins) ? visual.wins : []).reduce(
      (sum, win) => sum + amount(win, 'creditedPayoutCents', 'payoutCents'), 0
    );
  }
  return 0;
}

const featurePhases = new Set([
  'decode', 'reveal', 'reveal-coins', 'boost', 'collector', 'rainbow',
  'scatter', 'bonus', 'bonus-selection', 'bonus-intro', 'profile-gift'
]);
const resultPhases = new Set(['summary', 'spin-summary', 'settled', 'bonus-summary']);
const paymentPhases = new Set(['win', 'pay', 'payline', 'collect', 'bonus-payment']);
const attentivePhases = new Set(['reel', 'deal', 'remove', 'cascade']);

export function getLexofMascotPresentation(visual = {}, game = null, finishedVisual = null) {
  const phase = typeof visual?.phase === 'string' ? visual.phase : 'idle';
  const paidCents = lexofMascotCreditedCents(visual ?? {});
  let pose = LEXOF_MASCOT_POSES.idle;
  let transient = false;
  if (game === 'lecipher') {
    if (resultPhases.has(phase)) {
      pose = paidCents > 0 ? LEXOF_MASCOT_POSES.win : LEXOF_MASCOT_POSES.loss;
      transient = true;
    } else if (featurePhases.has(phase)) pose = LEXOF_MASCOT_POSES.rainbow;
    else if (paymentPhases.has(phase)) pose = paidCents > 0 ? LEXOF_MASCOT_POSES.win : LEXOF_MASCOT_POSES.watch;
    else if (attentivePhases.has(phase)) pose = LEXOF_MASCOT_POSES.watch;
  }
  // Only completion of this exact visual snapshot returns an outcome to idle.
  // A late animation event from the preceding spin cannot expire a new one.
  const reactionFinished = transient && finishedVisual === visual;
  if (reactionFinished) { pose = LEXOF_MASCOT_POSES.idle; transient = false; }
  const serial = Number.isSafeInteger(visual?.serial) ? visual.serial : 'terminal';
  return Object.freeze({
    visible: game === 'lecipher', phase, pose: pose.name, frame: pose.frame,
    creditedPayoutCents: paidCents, transient, reactionFinished,
    reactionKey: `${phase}:${serial}:${pose.name}:${paidCents}`
  });
}
