// Decoration follows the existing public presentation clock. It never sees the
// funded hand, hidden card, RNG, wallet, or an outcome before public settlement.
const clamp = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const ease = value => 1 - (1 - clamp(value)) ** 3;

const reactionDurations = Object.freeze({ win:2000, blackjack:2000, lose:2200, push:1400 });
const publicTotal = value => Number.isInteger(value) && value >= 0 && value <= 99 ? value : 0;
function settledQuip(result) {
  // Totals exist in the final public comparison, never in a hidden hand. No
  // random draw is consumed for decorative speech or body language.
  const player = publicTotal(result.playerTotal), dealer = publicTotal(result.dealerTotal);
  let lines;
  if (result.outcome === 'lose') lines = player > 21
    ? ['Перебор. Бывает.','Ха. Перебрал.','Этот раунд мой.']
    : ['Ха. Не в этот раз.','Сегодня мой раунд.','Попался. Этот раунд мой.'];
  else if (result.outcome === 'blackjack') lines = ['Вот это раздача.','Двадцать один. Красиво.','Красиво сыграно.'];
  else if (result.outcome === 'win') lines = ['Красиво сыграно.','Вот это раздача.','Ладно, это было неожиданно.'];
  else lines = ['Ровный счёт.','Ничья.'];
  return lines[(player * 7 + dealer * 3) % lines.length];
}

export function blackjackCardFlight(origin, target, progress, { reducedMotion = false } = {}) {
  const remaining = reducedMotion ? 0 : 1 - ease(progress);
  const coordinate = (point, key) => Number.isFinite(point?.[key]) ? point[key] : 0;
  return Object.freeze({
    x: (coordinate(origin, 'x') - coordinate(target, 'x')) * remaining,
    y: (coordinate(origin, 'y') - coordinate(target, 'y')) * remaining,
    rotation: -14 * remaining
  });
}

export function getBlackjackDealerPose(display = {}, {
  reducedMotion = false, reactionElapsedMs = 0, reactionComplete = false
} = {}) {
  display = display ?? {};
  const motion = display.motion;
  const progress = clamp(motion?.progress);
  let phase = display.status === 'player' ? 'watch' : 'idle';
  if (motion?.kind === 'deal') phase = motion.side === 'dealer' ? 'deal-dealer' : 'deal-player';
  else if (motion?.kind === 'flip') phase = 'reveal';
  else if (motion?.kind === 'result' || display.status === 'resolving') phase = 'resolving';
  // Only the terminal projection can drive an outcome gesture. No private hand
  // or early deal/flip state is enough to infer a winning/losing reaction.
  let result = null, reactionDurationMs = 0, reactionProgress = 0, gesture = null, quip = null;
  if (display.status === 'resolved' && display.view?.revealed === true) {
    result = display.view.result;
    const outcome = result?.outcome;
    if (Object.hasOwn(reactionDurations, outcome)) {
      reactionDurationMs = reactionDurations[outcome];
      const elapsed = Number.isFinite(reactionElapsedMs) ? Math.max(0, reactionElapsedMs) : 0;
      reactionProgress = reactionComplete ? 1 : clamp(elapsed / reactionDurationMs);
      if (reactionProgress >= 1) phase = 'watch';
      else {
        phase = outcome === 'blackjack' ? 'win' : outcome;
        gesture = phase === 'lose' ? 'chuckle' : phase === 'win' ? 'approve' : 'neutral';
        quip = settledQuip(result);
      }
    }
  }
  const pose = { phase, progress: reducedMotion ? 0 : progress,
    bodyLift: 0, bodyTurn: 0, headTurn: 0,
    leftArmTurn: 0, rightArmTurn: 0, leftArmX: 0, leftArmY: 0,
    rightArmX: 0, rightArmY: 0, reacting: gesture !== null && !reducedMotion,
    gesture, quip, reactionDurationMs, reactionProgress };
  if (reducedMotion) return Object.freeze(pose);
  const reach = Math.sin(progress * Math.PI);
  if (phase === 'deal-player' || phase === 'deal-dealer') {
    const push = Math.sin(clamp((progress - .12) / .88) * Math.PI);
    pose.bodyLift = -.9 * reach;
    pose.bodyTurn = (phase === 'deal-player' ? -1.3 : 1.3) * reach;
    pose.headTurn = (phase === 'deal-player' ? -5 : 5) * reach;
    pose.leftArmTurn = 13 * reach;
    pose.leftArmY = -1.1 * reach;
    pose.rightArmTurn = -21 * push;
    pose.rightArmX = 2.8 * push;
    pose.rightArmY = 2.3 * push;
  } else if (phase === 'reveal') {
    pose.headTurn = 5 * reach;
    pose.bodyLift = -.5 * reach;
    pose.leftArmTurn = 19 * reach;
    pose.leftArmX = -1.6 * reach;
    pose.leftArmY = 1.8 * reach;
    pose.rightArmTurn = -5 * reach;
  } else if (phase === 'win') {
    const surprise = Math.sin(clamp(reactionProgress / .42) * Math.PI);
    const nod = Math.sin(clamp((reactionProgress - .32) / .68) * Math.PI);
    pose.headTurn = -4 * surprise + 2 * nod;
    pose.bodyLift = -.55 * surprise + .15 * nod;
    pose.leftArmTurn = 6 * surprise + 10 * nod;
    pose.rightArmTurn = -6 * surprise - 10 * nod;
    pose.leftArmY = -.6 * surprise; pose.rightArmY = -.6 * surprise;
  } else if (phase === 'push') {
    const shrug = Math.sin(reactionProgress * Math.PI);
    pose.headTurn = 1.5 * shrug;
    pose.leftArmTurn = 4 * shrug; pose.rightArmTurn = -4 * shrug;
  } else if (phase === 'lose') {
    const envelope = Math.sin(reactionProgress * Math.PI);
    const chuckle = Math.sin(reactionProgress * Math.PI * 4) * envelope;
    pose.headTurn = 2.5 * envelope + 1.8 * chuckle;
    pose.bodyLift = -.65 * Math.abs(chuckle);
    pose.bodyTurn = .6 * chuckle;
    pose.leftArmTurn = -4 * envelope; pose.rightArmTurn = 4 * envelope;
  }
  return Object.freeze(pose);
}
