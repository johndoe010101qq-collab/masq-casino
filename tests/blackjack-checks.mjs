import assert from 'node:assert/strict';
import { createBlackjackShoe, createBlackjackHand, blackjackScore, blackjackPublicView,
  hitBlackjack, standBlackjack, revealBlackjack, dealerStepBlackjack, evaluateBlackjack, finishBlackjack, compareBlackjackHands } from '../src/blackjack.js';
import { BlackjackPresentation } from '../src/blackjack-presentation.js';
import { HallSession } from '../src/hall-session.js';
import GameMath from '../src/game-math.js';
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const card = (rank, suit = 'spades') => ({ rank, suit });
const hand = (ranks) => createBlackjackHand({ shoe: ranks.map(rank => card(rank)), dealerBoostTickets: 0, playerUnfavorableTickets: 0 });
const finish = ranks => evaluateBlackjack(finishBlackjack(hand(ranks)));
const shuffleCalls = [];
const shoe = createBlackjackShoe(n => { shuffleCalls.push(n); return n - 1; });
check(shoe.length, 312); check(shuffleCalls, Array.from({ length: 311 }, (_, i) => 312 - i));
check(new Set(shoe.map(c => c.id)).size, 312);
for (const suit of ['clubs', 'diamonds', 'hearts', 'spades']) for (let rank = 1; rank <= 13; rank++) {
  check(shoe.filter(c => c.rank === rank && c.suit === suit).length, 6);
}
check(Object.isFrozen(shoe) && shoe.every(Object.isFrozen), true);
assert.throws(() => createBlackjackShoe(n => n)); checks++;
assert.throws(() => createBlackjackShoe(() => -.1)); checks++;
check(blackjackScore([card(1), card(1), card(9)]), { total: 21, soft: true, bust: false, natural: false });
check(blackjackScore([card(1), card(1), card(10), card(10)]), { total: 22, soft: false, bust: true, natural: false });
check(blackjackScore([card(1), card(6)]), { total: 17, soft: true, bust: false, natural: false });
check(blackjackScore([card(1), card(13)]), { total: 21, soft: true, bust: false, natural: true });
const initial = hand([3, 4, 5, 6, 7]);
check(initial.player.map(c => c.rank), [3, 5]); check(initial.dealer.map(c => c.rank), [4, 6]);
check(initial.cursor, 4); check(initial.phase, 'player');
const hit = hitBlackjack(initial); check(initial.player.length, 2); check(hit.player.map(c => c.rank), [3, 5, 7]);
check(Object.isFrozen(hit) && Object.isFrozen(hit.player), true);
check(finish([1, 9, 10, 8]).outcome, 'blackjack'); check(finish([1, 9, 10, 8]).payoutMultiplier, 2.5);
check(finish([1, 1, 10, 10]).outcome, 'push'); check(finish([1, 1, 10, 10]).payoutMultiplier, 1);
check(finish([10, 9, 8, 8]).outcome, 'win'); check(finish([10, 9, 8, 8]).payoutMultiplier, 2);
check(finish([10, 9, 7, 8]).outcome, 'push'); check(finish([10, 10, 6, 8]).outcome, 'lose');
const soft17 = finishBlackjack(hand([10, 1, 8, 6, 10]));
check(soft17.dealer.map(c => c.rank), [1, 6]); check(soft17.cursor, 4); check(evaluateBlackjack(soft17).outcome, 'win');
const hit16 = finishBlackjack(hand([10, 10, 9, 6, 5]));
check(hit16.dealer.map(c => c.rank), [10, 6, 5]); check(evaluateBlackjack(hit16).outcome, 'lose');
check(finish([10, 10, 8, 6, 10]).outcome, 'win');
const drawn21 = hitBlackjack(hand([10, 9, 5, 8, 6]));
check(drawn21.phase, 'reveal'); check(blackjackScore(drawn21.player).total, 21);
check(evaluateBlackjack(finishBlackjack(drawn21)).outcome, 'win');
check(compareBlackjackHands([card(10), card(5), card(6)], [card(1), card(10)]).outcome, 'lose');
check(compareBlackjackHands([card(1), card(10)], [card(10), card(5), card(6)]).outcome, 'blackjack');
const bust = hitBlackjack(hand([10, 5, 9, 6, 8]));
check(bust.phase, 'reveal'); check(finishBlackjack(bust).dealer.length, 2);
check(evaluateBlackjack(finishBlackjack(bust)).payoutMultiplier, 0);
assert.throws(() => hitBlackjack(bust)); checks++;
assert.throws(() => evaluateBlackjack(initial)); checks++;
assert.throws(() => evaluateBlackjack({ ...finishBlackjack(initial) })); checks++;
assert.throws(() => dealerStepBlackjack(initial)); checks++;
assert.throws(() => hitBlackjack(hand([10, 1, 5, 10]))); checks++;
const hiddenA = blackjackPublicView(hand([10, 7, 6, 8]));
const hiddenB = blackjackPublicView(hand([10, 7, 6, 13]));
check(hiddenA, hiddenB); check(hiddenA.dealer[1], { hidden: true });
check(hiddenA.dealerTotal, 7); check(hiddenA.result, null);
const revealed = blackjackPublicView(finishBlackjack(hand([10, 7, 6, 10])), { settled: true });
check(revealed.dealerTotal, 17); check(revealed.dealer[1].rank, 10); check(revealed.result.outcome, 'lose');

let settlements = 0, resolvedHand = null;
const p = new BlackjackPresentation(hand([10, 9, 5, 8, 6]), {
  onResolved: value => { settlements++; resolvedHand = value; }
});
check(p.deal(), true); check(p.deal(), false); check(p.hit(), false);
const clockBefore = p.snapshot(); p.advance(10000, { hidden: true }); check(p.snapshot(), clockBefore);
p.flushTransitions(); check(p.snapshot().canAct, true); check(p.snapshot().view.dealer[1], { hidden: true });
check(p.hit(), true); check(p.hit(), false); check(p.stand(), false);
p.flushTransitions(); check(settlements, 1); check(evaluateBlackjack(resolvedHand).outcome, 'win');
check(p.finish(), false); p.flushTransitions(); check(settlements, 1);

let naturalUpdates = [];
const natural = new BlackjackPresentation(hand([1, 7, 10, 10]), { onUpdate: view => naturalUpdates.push(view) });
natural.deal();
while(natural.snapshot().status==='dealing') natural.advance(100);
check(natural.snapshot().status, 'revealing');
check(natural.snapshot().view.dealer[1], { hidden: true });
check(natural.snapshot().view.dealerTotal, 7);
check(naturalUpdates.filter(update => !update.view.revealed).every(update => update.view.result === null), true);
natural.advance(100); natural.advance(100); natural.advance(100); check(natural.snapshot().view.dealer[1], { hidden: true });
natural.advance(100); check(natural.snapshot().view.revealed, true);
natural.flushTransitions(); check(natural.snapshot().view.result.payoutMultiplier, 2.5);

// Removal during any paid transition follows the original shoe and settles once.
for (const during of ['deal', 'player', 'hit', 'flip', 'dealer']) {
  let count = 0;
  const runner = new BlackjackPresentation(hand([7, 6, 5, 7, 2, 3, 4, 5, 6, 10]), { onResolved: () => count++ });
  runner.deal();
  if (during !== 'deal') runner.flushTransitions();
  if (during === 'hit') runner.hit();
  if (['flip', 'dealer'].includes(during)) runner.stand();
  if (during === 'dealer') while(runner.snapshot().status==='revealing') runner.advance(100);
  check(runner.finish(), true); check(runner.finish(), false); check(count, 1);
  check(runner.snapshot().view.revealed, true); check(runner.snapshot().status, 'resolved');
}

// Sample valid six-deck hands with varied decisions, checking dealer policy,
// total returns and immutable transitions across long ace-heavy hands.
let seed = 1987;
const randomInt = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
for (let i = 0; i < 1000; i++) {
  let next = createBlackjackHand({ randomInt });
  while (next.phase === 'player' && blackjackScore(next.player).total < 17) next = hitBlackjack(next);
  next = finishBlackjack(next);
  const result = evaluateBlackjack(next), score = blackjackScore(next.dealer), player = blackjackScore(next.player);
  check([0, 1, 2, 2.5].includes(result.payoutMultiplier), true);
  if (!player.bust && !player.natural && !score.natural) check(score.total >= 17, true);
  check(next.cursor, next.player.length + next.dealer.length);
}
// Build legal six-deck shuffle tickets with a known four-card prefix.
// Monetary tests therefore use Hall-owned paid hands, rather than injecting
// unrelated engine fixtures or exposing a private shoe from the wallet API.
function paidDealRng(deals) {
  const tickets=[];
  for(const ranks of deals) {
    const original=[...createBlackjackShoe(n=>n-1)],remaining=original.slice(),prefix=[];
    for(const rank of ranks) {
      const index=remaining.findIndex(card=>card.rank===rank);
      assert.ok(index>=0); prefix.push(remaining.splice(index,1)[0]);
    }
    const target=[...prefix,...remaining],working=original.slice();
    for(let index=working.length-1;index>0;index--) {
      const selected=working.findIndex(card=>card.id===target[index].id);
      assert.ok(selected>=0&&selected<=index);
      tickets.push([index+1,selected]);
      [working[index],working[selected]]=[working[selected],working[index]];
    }
    assert.deepEqual(working,target);
  }
  return maximum=>{
    if(!tickets.length)return maximum-1;
    const [expected,ticket]=tickets.shift();assert.equal(maximum,expected);return ticket;
  };
}
// Verify the actual shared wallet contract, rather than a fake receipt callback.
const wallet = new HallSession(GameMath, paidDealRng([[1,9,10,8],[10,9,8,8],[10,9,7,8],[10,10,6,8]]));
for (const stake of [0, 4, 6, 255, NaN]) { assert.throws(() => wallet.beginBlackjack(stake)); checks++; }
const debit = wallet.beginBlackjack(50); check(wallet.getSnapshot().balance, 950);
check(wallet.beginBlackjack(50), null); check(wallet.begin('plinko', 'standard', 10), null);
check(wallet.reset(), false); check(wallet.complete(debit.id), false);
assert.throws(() => wallet.completeBlackjack(debit.id, initial)); checks++;
check(wallet.getSnapshot().balance, 950); check(wallet.getSnapshot().history.length, 0);
assert.throws(() => wallet.completeBlackjack(debit.id, finishBlackjack(hand([1,9,10,8])))); checks++;
assert.throws(() => wallet.completeBlackjack(debit.id, debit.hand)); checks++;
const naturalPaid = wallet.advanceBlackjack(debit.id, 'finish', debit.hand);
check(wallet.completeBlackjack(debit.id, naturalPaid), true);
check(wallet.getSnapshot().balance, 1075); check(wallet.getSnapshot().result.payout, 125);
check(wallet.getSnapshot().result.net, 75); check(wallet.getSnapshot().history.length, 1);
check(wallet.completeBlackjack(debit.id, naturalPaid), false);
check(wallet.getSnapshot().balance, 1075);
for (const [ranks, multiplier] of [[[10, 9, 8, 8], 2], [[10, 9, 7, 8], 1], [[10, 10, 6, 8], 0]]) {
  const before = wallet.getSnapshot().balance, record = wallet.beginBlackjack(100);
  check(record.hand.player.map(card=>card.rank),[ranks[0],ranks[2]]);
  assert.throws(()=>wallet.completeBlackjack(record.id,finishBlackjack(hand(ranks))));checks++;
  const resolved=wallet.advanceBlackjack(record.id,'finish',record.hand);
  check(wallet.completeBlackjack(record.id,resolved),true);
  check(wallet.getSnapshot().balance, before - 100 + 100 * multiplier);
}
console.log(`Blackjack: ${checks} checks passed (math, wallet, hidden card, transition locks, hidden clock, unmount, reduced motion).`);
