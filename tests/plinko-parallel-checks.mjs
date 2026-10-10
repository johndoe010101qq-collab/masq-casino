import assert from 'node:assert/strict';
import { HallSession } from '../src/hall-session.js';
import GameMath from '../src/game-math.js';
import { PlinkoFlightController } from '../src/plinko-controller.js';
import { createBlackjackHand, finishBlackjack } from '../src/blackjack.js';

const sessionFor = (balance = 1000) => {
  let ticket = 0;
  return new HallSession(GameMath, maximum => (ticket++ * 73) % maximum, {initialBalanceCents:Math.round(balance*100),houseCapitalCents:100000000});
};
function scheduler() {
  let next = 0, peak = 0;
  const frames = new Map();
  return {
    requestFrame: callback => { frames.set(++next, callback); peak = Math.max(peak, frames.size); return next; },
    cancelFrame: id => frames.delete(id),
    flush: now => { const entry = frames.entries().next().value; if (!entry) return;
      frames.delete(entry[0]); entry[1](now); },
    get size() { return frames.size; }, get peak() { return peak; },
  };
}

// One synchronous debit per accepted launch; rapid clicks never use a stale UI
// balance, and the 101st ball cannot consume RNG or create another transaction.
{
  const session = sessionFor(100000);
  const rounds = Array.from({ length: 100 }, (_, i) => session.begin('plinko', 'standard', (i % 10 + 1) * 10));
  assert.equal(session.active.size, 100);
  assert.equal(session.getSnapshot().activeCount, 100);
  assert.equal(session.pending, rounds[0]);
  assert.equal(session.getSnapshot().balance, 94500);
  assert.equal(session.getSnapshot().history.length, 0);
  assert.equal(session.getSnapshot().result, null);
  const before = session.getSnapshot();
  assert.throws(() => session.begin('plinko', 'standard', 10), /100 шаров/);
  assert.equal(session.getSnapshot(), before);
  assert.equal(session.id, 100);
  assert.equal(session.begin('coinflip', 'heads', 10), null);
  assert.equal(session.begin('slots', 'bonanza', 10), null);
  assert.equal(session.beginBlackjack(10), null);
  assert.equal(session.reset(), false);

  // A permutation of completion order preserves every debit and every credit.
  let expected = 9450000;
  for (let i = 0; i < 100; i++) {
    const round = rounds[(i * 37) % 100];
    expected += round.payoutCents;
    assert.equal(session.complete(round.id), true);
    assert.equal(Math.round(session.getSnapshot().balance * 100), expected);
    const closed = session.getSnapshot();
    assert.equal(session.complete(round.id), false);
    assert.equal(session.getSnapshot(), closed);
  }
  assert.equal(session.getSnapshot().busy, false);
  assert.equal(session.getSnapshot().pendingGame, null);
  assert.equal(session.pending, null);
  assert.equal(session.getSnapshot().history.length, 20);
}
{
  const session = sessionFor(25);
  session.begin('plinko', 'standard', 10);
  const second = session.begin('plinko', 'standard', 10);
  assert.equal(session.getSnapshot().balance, 5);
  const before = session.getSnapshot();
  assert.throws(() => session.begin('plinko', 'standard', 10), /Недостаточно/);
  assert.equal(session.getSnapshot(), before);
  assert.equal(session.id, 2);
  assert.equal(session.complete(second.id), true);
  assert.equal(session.getSnapshot().balance, 5 + second.payout);
  const coin = session.begin('coinflip', 'heads', 10);
  assert.equal(coin, null); // A remaining ball still owns the shared wallet.
  assert.equal(session.completeAll('plinko'), 1);
  assert.equal(session.completeAll('plinko'), 0);
  assert.ok(session.begin('coinflip', 'heads', 10));
}
{
  const session = sessionFor();
  const coin = session.begin('coinflip', 'heads', 10);
  assert.equal(session.begin('plinko', 'standard', 10), null);
  assert.equal(session.beginBlackjack(10), null);
  assert.equal(session.complete(coin.id), true);
  const hand = session.beginBlackjack(10);
  assert.equal(session.begin('plinko', 'standard', 10), null);
  assert.equal(session.complete(hand.id), false); // Cannot bypass the hand engine.
  const initial = createBlackjackHand({ randomInt: maximum => maximum - 1 });
  assert.throws(() => session.completeBlackjack(hand.id, initial));
  assert.throws(() => session.completeBlackjack(hand.id, finishBlackjack(initial)));
  const resolved = session.advanceBlackjack(hand.id, 'finish', hand.hand);
  assert.equal(session.completeBlackjack(hand.id, resolved), true);
  assert.equal(session.completeBlackjack(hand.id, resolved), false);
  assert.equal(session.getSnapshot().busy, false);
}

// The projection contains trajectory coordinates, never result/bin/payout.
// A single RAF owns 100 balls and all landing effects.
{
  const session = sessionFor(); const frames = scheduler(); const results = [];
  const controller = new PlinkoFlightController(session, { ...frames, onLand: result => results.push(result) });
  controller.attach();
  for (let i = 0; i < 100; i++) assert.ok(controller.launch(10));
  assert.equal(frames.size, 1);
  assert.equal(frames.peak, 1);
  assert.throws(() => controller.launch(10), /100 шаров/);
  for (const ball of controller.getPresentation()) {
    assert.deepEqual(Object.keys(ball).sort(), ['id', 'path', 'progress', 'stake']);
    assert.equal(ball.progress, 0);
  }
  assert.equal(controller.getEffects().length, 0);
  frames.flush(0); frames.flush(1800);
  assert.equal(results.length, 0);
  assert.equal(session.getSnapshot().history.length, 0);
  assert.equal(session.getSnapshot().balance, 0);
  frames.flush(3800);
  assert.equal(results.length, 100);
  assert.equal(controller.activeCount, 0);
  assert.equal(session.active.size, 0);
  assert.equal(frames.peak, 1);
  assert.equal(session.balanceCents, results.reduce((sum, result) => sum + result.payoutCents, 0));
  controller.detach(); assert.equal(frames.size, 0);
}
{
  const session = sessionFor(); const frames = scheduler(); const results = [];
  const controller = new PlinkoFlightController(session, { ...frames, onLand: result => results.push(result) });
  controller.attach(); controller.launch(10);
  frames.flush(0); frames.flush(1000);
  const p = controller.getPresentation()[0].progress;
  controller.setVisible(false);
  assert.equal(frames.size, 0);
  controller.advance(90000);
  assert.equal(controller.getPresentation()[0].progress, p);
  controller.setVisible(true); frames.flush(90000);
  assert.equal(controller.getPresentation()[0].progress, p);
  controller.launch(20);
  frames.flush(92800);
  assert.equal(results.length, 1);
  assert.equal(controller.getPresentation().length, 1);
  assert.equal(controller.getPresentation()[0].stake, 20);
  assert.equal(session.getSnapshot().history.length, 1);
  assert.equal(session.getSnapshot().balance, 970 + results[0].payout);
  frames.flush(93800);
  assert.equal(results.length, 2);
  assert.equal(session.getSnapshot().history.length, 2);
  controller.detach();
}
{
  const session = sessionFor(); const frames = scheduler(); let callbacks = 0;
  const controller = new PlinkoFlightController(session, { ...frames, onLand: () => callbacks++ });
  controller.attach();
  for (let i = 0; i < 20; i++) controller.launch(10);
  const expected = 80000 + [...session.active.values()].reduce((sum, round) => sum + round.payoutCents, 0);
  controller.detach();
  assert.equal(session.balanceCents, expected);
  assert.equal(session.active.size, 0);
  assert.equal(session.getSnapshot().history.length, 20);
  assert.equal(callbacks, 0);
  assert.equal(frames.size, 0);
  controller.detach(); assert.equal(session.balanceCents, expected);
  // StrictMode setup-cleanup-setup can reuse the controller without a debit.
  controller.attach(); assert.ok(controller.launch(10)); controller.detach();
  assert.equal(session.active.size, 0);
}
{
  const session = sessionFor(); const frames = scheduler(); let renders = 0;
  const controller = new PlinkoFlightController(session, frames);
  // Canvas has registered its renderer in its separate Fiber root. The room's
  // StrictMode replay does not necessarily replay that Canvas effect.
  controller.setRenderer(() => renders++);
  controller.attach(); controller.detach(); controller.attach();
  const before = renders;
  controller.launch(10); frames.flush(0); frames.flush(1000);
  assert.ok(renders >= before + 2, 'Parent effect replay retains the separate Canvas renderer');
  assert.equal(controller.getPresentation()[0].progress, 1000 / 3800);
  controller.detach();
  controller.setRenderer(null); // Actual Canvas cleanup owns renderer removal.
  controller.attach(); controller.launch(10); const closed = renders;
  frames.flush(2000); assert.equal(renders, closed);
  controller.detach();
}
console.log('Plinko: 100 parallel launches, atomic cents ledger, mixed-game locks, hidden outcome, shared RAF, hidden tab and cleanup checks passed');
