// Decorative only: every reaction follows the accepted, credited timeline.
// Raw/uncapped awards, prior-spin totals and the player's history are ignored.
const positiveCents = value => Number.isSafeInteger(value) && value > 0 ? value : 0;
const has = (value,key) => value != null && Object.hasOwn(value,key);
const credited = (value,key,fallback) => has(value,key) ? positiveCents(value[key]) : positiveCents(value?.[fallback]);
export const BONANZA_MASCOT_FRAMES = Object.freeze({idle:0,blink:1,watch:2,bonus:3,win:4});

export function bonanzaShownPayoutCents(visual = {}) {
  // Completed-spin total plus only the current cascade's credited symbol sum.
  // Multiplier/scatter additions arrive in the accepted spin summary later.
  const total=credited(visual,'creditedTotalPayoutCents','totalPayoutCents');
  const cascading=['win','remove','payout','payout-out','fall'].includes(visual?.phase);
  return total+(cascading?credited(visual,'creditedCurrentPayoutCents','currentPayoutCents'):0);
}

export function bonanzaMascotCreditedCents(visual = {}) {
  if (!visual || typeof visual !== 'object') return 0;
  if (visual.phase === 'settled') return credited(visual,'creditedTotalPayoutCents','totalPayoutCents');
  if (visual.phase === 'bonus-summary') return credited(visual,'creditedBonusPayoutCents','bonusPayoutCents');
  if (visual.phase === 'spin-summary') return credited(visual.spinSummary,'creditedPayoutCents','payoutCents');
  if (visual.phase === 'bonus-payment') return credited(visual,'creditedBonusPaymentCents','bonusPaymentCents');
  if (['win','payout','payout-out'].includes(visual.phase)) return credited(visual,'creditedCascadePayoutCents','cascadePayoutCents');
  return 0;
}

export function getBonanzaMascotPresentation(visual = {}, finishedVisual = null) {
  const phase = typeof visual?.phase === 'string' ? visual.phase : 'idle';
  const paidCents = bonanzaMascotCreditedCents(visual);
  const result = ['settled','spin-summary','bonus-summary'].includes(phase);
  const feature = ['scatter','bonus-intro'].includes(phase);
  const paying = ['win','payout','payout-out','bonus-payment'].includes(phase);
  let pose = feature ? 'bonus' : paidCents > 0 && (result || paying) ? 'win'
    : ['deal','fall','remove'].includes(phase) || paying ? 'watch' : 'idle';
  let transient = result && paidCents > 0;
  const reactionFinished = transient && finishedVisual === visual;
  if (reactionFinished) {pose='idle';transient=false;}
  const index = BONANZA_MASCOT_FRAMES[pose];
  return Object.freeze({phase,pose,frame:index,column:index%4,row:Math.floor(index/4),
    creditedPayoutCents:paidCents,transient,reactionFinished,
    reactionKey:`${phase}:${visual?.freeSpinIndex ?? 0}:${visual?.cascade ?? 0}:${paidCents}:${pose}`});
}
