// Decoration follows the existing public presentation clock. It never sees the
// funded hand, hidden card, RNG, wallet, or an outcome before public settlement.
const clamp = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const ease = value => 1 - (1 - clamp(value)) ** 3;

export function blackjackCardFlight(origin, target, progress, { reducedMotion = false } = {}) {
  const remaining = reducedMotion ? 0 : 1 - ease(progress);
  const coordinate = (point, key) => Number.isFinite(point?.[key]) ? point[key] : 0;
  return Object.freeze({
    x: (coordinate(origin, 'x') - coordinate(target, 'x')) * remaining,
    y: (coordinate(origin, 'y') - coordinate(target, 'y')) * remaining,
    rotation: -14 * remaining
  });
}

export function getBlackjackDealerPose(display = {}, { reducedMotion = false } = {}) {
  display = display ?? {};
  const motion = display.motion;
  const progress = clamp(motion?.progress);
  let phase = display.status === 'player' ? 'watch' : 'idle';
  if (motion?.kind === 'deal') phase = motion.side === 'dealer' ? 'deal-dealer' : 'deal-player';
  else if (motion?.kind === 'flip') phase = 'reveal';
  else if (motion?.kind === 'result' || display.status === 'resolving') phase = 'resolving';
  // Only the terminal projection can drive an outcome gesture. No private hand
  // or early deal/flip state is enough to infer a winning/losing reaction.
  if (display.status === 'resolved' && display.view?.revealed === true) {
    const outcome = display.view.result?.outcome;
    if (outcome === 'win' || outcome === 'blackjack') phase = 'win';
    else if (outcome === 'push') phase = 'push';
    else if (outcome === 'lose') phase = 'lose';
  }
  const pose = { phase, progress: reducedMotion ? 0 : progress,
    bodyLift: 0, bodyTurn: 0, headTurn: 0,
    leftArmTurn: 0, rightArmTurn: 0, leftArmX: 0, leftArmY: 0,
    rightArmX: 0, rightArmY: 0, reacting: ['win', 'push', 'lose'].includes(phase) && !reducedMotion };
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
    pose.headTurn = -3; pose.bodyLift = -.6;
    pose.leftArmTurn = 15; pose.rightArmTurn = -15;
    pose.leftArmY = -1.3; pose.rightArmY = -1.3;
  } else if (phase === 'push') {
    pose.headTurn = 1.5; pose.leftArmTurn = 5; pose.rightArmTurn = -5;
  } else if (phase === 'lose') {
    pose.headTurn = 4; pose.bodyLift = .5;
    pose.leftArmTurn = -4; pose.rightArmTurn = 4;
  }
  return Object.freeze(pose);
}
