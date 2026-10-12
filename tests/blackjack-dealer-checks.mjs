import assert from 'node:assert/strict';
import { createBlackjackHand } from '../src/blackjack.js';
import { BlackjackPresentation } from '../src/blackjack-presentation.js';
import { getBlackjackDealerPose, blackjackCardFlight } from '../src/blackjack-dealer-presentation.js';

// Exercise the dealer through real public presentation snapshots. Fixtures use
// sequential shoes so these checks never depend on RNG, wallet or browser time.
let checks = 0;
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const ok = (value, message) => { assert.ok(value, message); checks++; };
const near = (actual, expected, message) => ok(Math.abs(actual - expected) < 1e-9, message);
const checkFlight = (actual, expected) => {
  check(Object.keys(actual).sort(), ['rotation', 'x', 'y']);
  for (const key of ['x', 'y', 'rotation']) near(actual[key], expected[key]);
};
const phases = new Set(['idle', 'watch', 'deal-player', 'deal-dealer', 'reveal', 'resolving', 'win', 'push', 'lose']);
const transformKeys = ['progress', 'bodyLift', 'bodyTurn', 'headTurn', 'leftArmTurn', 'rightArmTurn',
  'leftArmX', 'leftArmY', 'rightArmX', 'rightArmY'];
const hand = ranks => createBlackjackHand({
  shoe: ranks.map((rank, index) => ({ rank, suit: index % 2 ? 'clubs' : 'hearts' })),
  dealerBoostTickets: 0, playerUnfavorableTickets: 0,
});
const runner = ranks => new BlackjackPresentation(hand(ranks));
function inspectPose(display, options) {
  const pose = getBlackjackDealerPose(display, options);
  ok(Object.isFrozen(pose), 'Dealer poses are immutable public output.');
  ok(phases.has(pose.phase), `Unexpected dealer phase: ${pose.phase}`);
  check(typeof pose.reacting, 'boolean');
  ok([null,'chuckle','approve','neutral'].includes(pose.gesture));
  ok(pose.quip === null || typeof pose.quip === 'string');
  ok(Number.isFinite(pose.reactionDurationMs) && pose.reactionDurationMs >= 0);
  ok(Number.isFinite(pose.reactionProgress) && pose.reactionProgress >= 0 && pose.reactionProgress <= 1);
  ok(transformKeys.every(key => Number.isFinite(pose[key])), 'All pose transforms are finite.');
  ok(pose.progress >= 0 && pose.progress <= 1, 'Pose progress is normalized.');
  return pose;
}
function completeCurrent(presentation) {
  const current = presentation.step;
  for (let i = 0; presentation.step === current && i < 100; i++) presentation.advance(80);
  ok(presentation.step !== current, 'A presentation step completes on its own explicit clock.');
}

check(inspectPose(undefined).phase, 'idle');
check(inspectPose(null).phase, 'idle');
check(inspectPose({ status: 'idle', motion: null }).reacting, false);

// A real hand covers initial alternating deal, a hit that leaves a choice, the
// hole-card flip, dealer draw, result pause and the final public settlement.
const updates = [];
const game = new BlackjackPresentation(hand([7, 6, 5, 7, 2, 4, 10]), {
  onUpdate: display => updates.push(display),
});
check(game.deal(), true);
check(inspectPose(game.snapshot()).phase, 'deal-player');
completeCurrent(game);
check(inspectPose(game.snapshot()).phase, 'deal-dealer');
completeCurrent(game);
check(inspectPose(game.snapshot()).phase, 'deal-player');
completeCurrent(game);
check(inspectPose(game.snapshot()).phase, 'deal-dealer');
completeCurrent(game);
check(inspectPose(game.snapshot()).phase, 'watch');
check(game.snapshot().view.dealer[1], { hidden: true });
check(game.hit(), true);
check(inspectPose(game.snapshot()).phase, 'deal-player');
completeCurrent(game);
check(game.snapshot().canAct, true);
check(inspectPose(game.snapshot()).phase, 'watch');
check(game.stand(), true);
check(inspectPose(game.snapshot()).phase, 'reveal');
game.advance(100); game.advance(100); game.advance(100);
check(game.snapshot().view.revealed, false);
check(inspectPose(game.snapshot()).reacting, false);
game.advance(100);
check(game.snapshot().view.revealed, true);
check(inspectPose(game.snapshot()).reacting, false);
completeCurrent(game);
check(game.snapshot().status, 'dealer');
check(inspectPose(game.snapshot()).phase, 'deal-dealer');
completeCurrent(game);
check(game.snapshot().status, 'resolving');
check(game.snapshot().view.result, null);
check(inspectPose(game.snapshot()).phase, 'resolving');
check(inspectPose(game.snapshot()).reacting, false);
completeCurrent(game);
check(game.snapshot().status, 'resolved');
check(game.snapshot().view.result.outcome, 'lose');
check(inspectPose(game.snapshot()).phase, 'lose');
check(inspectPose(game.snapshot()).reacting, true);

for (const display of updates) {
  const pose = inspectPose(display);
  check(pose.reacting, display.status === 'resolved' && display.view.revealed === true,
    'An engine terminal state or visible hole card alone cannot trigger a result reaction.');
  if (display.status !== 'resolved') ok(!['win', 'push', 'lose'].includes(pose.phase));
}

// Every public outcome maps to a final reaction, including natural Blackjack.
for (const [ranks, outcome, phase] of [
  [[10, 9, 8, 8], 'win', 'win'],
  [[10, 9, 7, 8], 'push', 'push'],
  [[10, 10, 6, 8], 'lose', 'lose'],
  [[1, 7, 10, 10], 'blackjack', 'win'],
]) {
  const round = runner(ranks);
  round.deal(); round.flushTransitions();
  if (round.snapshot().canAct) round.stand();
  round.flushTransitions();
  const display = round.snapshot();
  check(display.view.result.outcome, outcome);
  check(inspectPose(display).phase, phase);
  check(inspectPose(display).reacting, true);
}

// Changing the private hole card cannot alter a gesture before its reveal.
const hiddenA = runner([10, 7, 6, 8, 2]);
const hiddenB = runner([10, 7, 6, 13, 2]);
hiddenA.deal(); hiddenB.deal();
for (let i = 0; i < 40; i++) {
  check(hiddenA.snapshot().view.revealed, false);
  check(getBlackjackDealerPose(hiddenA.snapshot()), getBlackjackDealerPose(hiddenB.snapshot()),
    'The dealer pose does not distinguish different private hole cards.');
  hiddenA.advance(80); hiddenB.advance(80);
}
check(hiddenA.snapshot().status, 'player');
hiddenA.hit(); hiddenB.hit();
hiddenA.flushTransitions(); hiddenB.flushTransitions();
check(getBlackjackDealerPose(hiddenA.snapshot()), getBlackjackDealerPose(hiddenB.snapshot()));
hiddenA.stand(); hiddenB.stand();
for (let i = 0; i < 4; i++) {
  check(hiddenA.snapshot().view.revealed, false);
  check(getBlackjackDealerPose(hiddenA.snapshot()), getBlackjackDealerPose(hiddenB.snapshot()));
  hiddenA.advance(80); hiddenB.advance(80);
}

// Fail loudly if the helper reads a result before both public gates, or tries
// to derive body language from cards, totals, a private hand or the shoe.
function inaccessible(name) { return () => { throw new Error(`Private/early field read: ${name}`); }; }
for (const status of ['idle', 'dealing', 'hitting', 'player', 'revealing', 'dealer', 'resolving', 'resolved']) {
  for (const revealed of [false, true]) {
    if (status === 'resolved' && revealed) continue;
    const view = { revealed };
    for (const name of ['result', 'player', 'dealer', 'playerTotal', 'dealerTotal']) {
      Object.defineProperty(view, name, { get: inaccessible(`view.${name}`) });
    }
    const display = { status, view, motion: status === 'revealing' ? { kind: 'flip', progress: .6 } : null };
    for (const name of ['hand', 'shoe', 'outcome', 'balance', 'stake']) {
      Object.defineProperty(display, name, { get: inaccessible(name) });
    }
    const pose = inspectPose(display);
    check(pose.reacting, false);
    ok(!['win', 'push', 'lose'].includes(pose.phase));
  }
}
for (const outcome of [undefined, null, 'unrecognized']) {
  const pose = inspectPose({ status: 'resolved', motion: null, view: { revealed: true, result: { outcome } } });
  check(pose.reacting, false, 'Unrecognized public outcomes do not create an invented result reaction.');
}

// Progress is robust to interrupted or malformed transition data. No caller
// object is mutated; the same snapshot yields the same presentation pose.
for (const motion of [
  { kind: 'deal', side: 'player', index: 2 },
  { kind: 'deal', side: 'dealer', index: 2 },
  { kind: 'flip' },
  { kind: 'result' },
]) {
  const display = progress => Object.freeze({ status: motion.kind === 'result' ? 'resolving' : 'dealing',
    motion: Object.freeze({ ...motion, progress }), view: Object.freeze({ revealed: false, result: null }) });
  const begin = display(0), end = display(1), middle = display(.45);
  check(getBlackjackDealerPose(display(-2)), getBlackjackDealerPose(begin));
  check(getBlackjackDealerPose(display(3)), getBlackjackDealerPose(end));
  for (const progress of [NaN, Infinity, -Infinity, undefined]) {
    check(getBlackjackDealerPose(display(progress)), getBlackjackDealerPose(begin));
  }
  check(getBlackjackDealerPose(middle), getBlackjackDealerPose(middle));
  for (const sample of [begin, middle, end]) {
    inspectPose(sample);
    const reduced = inspectPose(sample, { reducedMotion: true });
    ok(transformKeys.every(key => reduced[key] === 0), 'Reduced motion removes every numeric pose transform.');
    check(reduced.reacting, false);
  }
}
for (const display of updates) {
  const reduced = inspectPose(display, { reducedMotion: true });
  ok(transformKeys.every(key => reduced[key] === 0));
  check(reduced.phase, getBlackjackDealerPose(display).phase, 'Reduced motion preserves the displayed state.');
}

// A genuine public outcome produces one bounded gesture/quip window. The same
// completed result cannot make it reappear; the component latches completion
// until a new deal resets its local presentation-only clock.
const terminalDisplays = [];
for (const [ranks,outcome,duration,gesture] of [
  [[10,9,8,8],'win',2000,'approve'],
  [[10,9,7,8],'push',1400,'neutral'],
  [[10,10,6,8],'lose',2200,'chuckle'],
  [[1,7,10,10],'blackjack',2000,'approve'],
]) {
  const round = runner(ranks); round.deal(); round.flushTransitions();
  if (round.snapshot().canAct) round.stand();
  round.flushTransitions();
  const display = round.snapshot(); terminalDisplays.push(display);
  check(display.view.result.outcome,outcome);
  const start = inspectPose(display,{reactionElapsedMs:0});
  check(start.gesture,gesture); check(start.reactionDurationMs,duration);
  check(start.reactionProgress,0); ok(start.quip.length > 0);
  for (const elapsed of [duration*.1,duration*.25,duration*.6,duration-1]) {
    const pose = inspectPose(display,{reactionElapsedMs:elapsed});
    check(pose.phase,start.phase); check(pose.gesture,gesture); check(pose.quip,start.quip);
    check(pose.reacting,true); near(pose.reactionProgress,elapsed/duration);
    ok(transformKeys.some(key => key !== 'progress' && Math.abs(pose[key]) > 1e-6),
      'The finite gesture articulates independent body/head/arm parts.');
    const reduced = inspectPose(display,{reactionElapsedMs:elapsed,reducedMotion:true});
    check(reduced.quip,start.quip); check(reduced.reacting,false);
    ok(transformKeys.every(key => reduced[key] === 0));
  }
  const ended = inspectPose(display,{reactionElapsedMs:duration});
  check(ended.phase,'watch'); check(ended.reacting,false);
  check(ended.gesture,null); check(ended.quip,null); check(ended.reactionProgress,1);
  ok(transformKeys.every(key => ended[key] === 0));
  for (const elapsed of [duration+1,100000,Number.MAX_SAFE_INTEGER]) {
    check(inspectPose(display,{reactionElapsedMs:elapsed}),ended,
      'An expired reaction stays complete on repeated settled renders.');
  }
  check(inspectPose(display,{reactionComplete:true,reactionElapsedMs:0}),ended);
  check(inspectPose(display,{reactionComplete:true,reducedMotion:true}),ended);
  // Pausing uses a frozen local elapsed value, so the pure pose cannot advance.
  check(inspectPose(display,{reactionElapsedMs:duration*.25}),
    inspectPose(display,{reactionElapsedMs:duration*.25}));
  for (const elapsed of [-1,NaN,Infinity,-Infinity,undefined,'1000']) {
    check(inspectPose(display,{reactionElapsedMs:elapsed}),start);
  }
  const next = runner([10,7,6,8,2]); next.deal();
  const newDeal = inspectPose(next.snapshot(),{reactionComplete:true,reactionElapsedMs:100000});
  check(newDeal.gesture,null); check(newDeal.quip,null); check(newDeal.reactionDurationMs,0);
  check(newDeal.reacting,false);
  check(inspectPose(display,{reactionElapsedMs:0}).quip,start.quip,
    'A subsequent public result can start a fresh finite window after the room resets its clock.');
}

// Quips cannot read hidden cards or wallet data, consume RNG, or instruct a
// player to chase losses. They are deterministic under the public final totals.
const walletFields = ['balance','stake','hand','shoe','randomInt','payout'];
for (const display of terminalDisplays) {
  const safe = {status:'resolved',view:{revealed:true,result:display.view.result}};
  for (const field of walletFields) Object.defineProperty(safe,field,{get:inaccessible(field)});
  for (const field of ['player','dealer','playerTotal','dealerTotal']) {
    Object.defineProperty(safe.view,field,{get:inaccessible(`view.${field}`)});
  }
  const oldRandom = Math.random;
  const oldNow = Date.now;
  let pose;
  try {
    Math.random = inaccessible('Math.random'); Date.now = inaccessible('Date.now');
    pose = inspectPose(safe,{reactionElapsedMs:500});
  } finally { Math.random = oldRandom; Date.now = oldNow; }
  check(pose.quip,inspectPose(safe).quip);
  ok(!/отыгр|подним.*ставк|ещ[её].*раздач|удво.*ставк/i.test(pose.quip));
}
const pausedDeal = runner([7,6,5,7,2,4,10]); pausedDeal.deal(); pausedDeal.advance(80);
const pausedDisplay = pausedDeal.snapshot(), pausedPose = inspectPose(pausedDisplay);
pausedDeal.advance(10000,{hidden:true});
check(pausedDeal.snapshot(),pausedDisplay);
check(inspectPose(pausedDeal.snapshot()),pausedPose,
  'The genuine presentation and the dealer both freeze when the page is hidden.');
for (const display of terminalDisplays) {
  const result = {outcome:display.view.result.outcome};
  Object.defineProperty(result,'playerTotal',{get:inaccessible('expired playerTotal')});
  Object.defineProperty(result,'dealerTotal',{get:inaccessible('expired dealerTotal')});
  const expired = inspectPose({status:'resolved',view:{revealed:true,result}},{reactionComplete:true});
  check(expired.quip,null); check(expired.gesture,null); check(expired.reacting,false);
}
for (let playerTotal=0;playerTotal<=21;playerTotal++) {
  for (const dealerTotal of [17,18,19,20,21]) {
    const pose = inspectPose({status:'resolved',view:{revealed:true,
      result:{outcome:'lose',playerTotal,dealerTotal}}});
    ok(!pose.quip.includes('Перебор'),'A sarcastic line must not invent a player bust.');
  }
}
const bust = runner([10,6,8,10,6]); bust.deal(); bust.flushTransitions();
check(bust.hit(),true); bust.flushTransitions();
check(bust.snapshot().view.result.playerTotal,24);
check(inspectPose(bust.snapshot()).quip,'Перебор. Бывает.');
for (const playerTotal of [NaN,Infinity,-Infinity,-1,100000,undefined,null]) {
  const pose = inspectPose({status:'resolved',view:{revealed:true,
    result:{outcome:'win',playerTotal,dealerTotal:Infinity}}});
  ok(typeof pose.quip === 'string' && pose.quip.length > 0);
}
for (const display of updates.filter(value => value.status !== 'resolved')) {
  const pose = inspectPose(display,{reactionElapsedMs:3000,reactionComplete:true});
  check(pose.gesture,null); check(pose.quip,null);
  check(pose.reactionDurationMs,0); check(pose.reactionProgress,0);
}

// A card starts at the measured dealer origin and lands exactly at its slot.
// Translating both DOM centers must not change the flight in slot coordinates.
for (const [origin, target] of [
  [{ x: 420, y: 155 }, { x: 520, y: 570 }],
  [{ x: 90, y: 120 }, { x: 30, y: 80 }],
  [{ x: 0, y: 0 }, { x: 0, y: 0 }],
]) {
  const before = structuredClone({ origin, target });
  const start = blackjackCardFlight(origin, target, 0);
  checkFlight(start, { x: origin.x - target.x, y: origin.y - target.y, rotation: -14 });
  checkFlight(blackjackCardFlight(origin, target, 1), { x: 0, y: 0, rotation: 0 });
  for (const progress of [0, .1, .4, .75, 1]) {
    const flight = blackjackCardFlight(origin, target, progress);
    ok(Object.values(flight).every(Number.isFinite), 'Flight coordinates are finite.');
    const shifted = blackjackCardFlight({ x: origin.x + 317, y: origin.y - 200 },
      { x: target.x + 317, y: target.y - 200 }, progress);
    near(shifted.x, flight.x); near(shifted.y, flight.y); near(shifted.rotation, flight.rotation);
    checkFlight(blackjackCardFlight(origin, target, progress, { reducedMotion: true }), { x: 0, y: 0, rotation: 0 });
  }
  check(blackjackCardFlight(origin, target, -1), start);
  checkFlight(blackjackCardFlight(origin, target, 2), { x: 0, y: 0, rotation: 0 });
  for (const progress of [NaN, Infinity, -Infinity, undefined]) {
    check(blackjackCardFlight(origin, target, progress), start);
  }
  check({ origin, target }, before, 'Card flight does not alter measured DOM centers.');
}
check(blackjackCardFlight(null, undefined, 0), { x: 0, y: 0, rotation: -14 });
check(blackjackCardFlight({ x: NaN, y: Infinity }, { x: undefined, y: -Infinity }, 0),
  { x: 0, y: 0, rotation: -14 });

console.log(`Blackjack dealer presentation: ${checks} deterministic checks passed.`);
