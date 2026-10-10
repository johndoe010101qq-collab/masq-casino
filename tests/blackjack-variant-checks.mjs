import assert from 'node:assert/strict';
import { createBlackjackHand, blackjackScore, blackjackPublicView, hitBlackjack,
  standBlackjack, revealBlackjack, dealerStepBlackjack, evaluateBlackjack, finishBlackjack,
  dealerDrawProbabilities, blackjackResearchAudit, CANDIDATE_RULES } from '../src/blackjack.js';
function seededRandomInt(seed) {
  let splitState = seed >>> 0;
  const split = () => {
    splitState = (splitState + 0x9e3779b9) >>> 0;
    let z = splitState;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return (z ^ (z >>> 15)) >>> 0;
  };
  let a = split(), b = split(), c = split(), d = split();
  const rotl = (value, bits) => ((value << bits) | (value >>> (32 - bits))) >>> 0;
  return n => {
    if (!Number.isSafeInteger(n) || n <= 0 || n > 0x100000000) throw new RangeError('Invalid integer bound.');
    const limit = Math.floor(0x100000000 / n) * n;
    let word;
    do {
      word = Math.imul(rotl(Math.imul(b, 5), 7), 9) >>> 0;
      const temp = b << 9;
      c ^= a; d ^= b; b ^= c; a ^= d; c ^= temp; d = rotl(d, 11);
    } while (word >= limit);
    return word % n;
  };
}
const BASIC_DESCRIPTION = 'Standard six-deck S17 hit/stand basic strategy with no splits/doubles/surrender/insurance; hard 12 stands vs4–6, hard13–16 vs2–6, hard17+ stand, soft18 stands vs2–8, soft19+ stand.';
function basicHit(view) {
  const s = blackjackScore(view.player), up = view.dealer[0].rank === 1 ? 11 : Math.min(10, view.dealer[0].rank);
  if (s.soft) return s.total <= 17 || (s.total === 18 && up >= 9);
  if (s.total <= 11) return true;
  if (s.total === 12) return up < 4 || up > 6;
  if (s.total <= 16) return up > 6;
  return false;
}
const hit17 = view => blackjackScore(view.player).total < 17;

const ranks = Array.from({ length: 10 }, (_, i) => ({ value: i + 1, probability: (i === 9 ? 4 : 1) / 13 }));
function addCard(total, soft, value) {
  let next = total + (value === 1 ? 11 : value), aces = Number(soft) + Number(value === 1);
  while (next > 21 && aces > 0) { next -= 10; aces--; }
  return { total: next, soft: aces > 0 };
}
// An additional visible-card policy adapted to this openly biased variant.
// Infinite-deck approximation optimizes hit/stand decisions for the disclosed
// ticket probability. It never inspects the hidden card or future shoe. Its
// return is measured using the actual finite six-deck candidate engine below.
function adaptedPolicy(boostProbability, playerProbability = 0) {
  const dealerMemo = new Map();
  const dealer = (total, soft) => {
    const key = total + ':' + Number(soft);
    if (dealerMemo.has(key)) return dealerMemo.get(key);
    const out = Array(6).fill(0); // 17,18,19,20,21,bust
    if (total >= 17) { out[total > 21 ? 5 : total - 17] = 1; return out; }
    const states = ranks.map(rank => ({ ...rank, next: addCard(total, soft, rank.value) }));
    const best = Math.max(...states.filter(entry => entry.next.total <= 21).map(entry => entry.next.total));
    const favored = states.filter(entry => entry.next.total === best);
    const favoredWeight = favored.reduce((sum, entry) => sum + entry.probability, 0);
    for (const entry of states) {
      const weight = (1 - boostProbability) * entry.probability
        + (entry.next.total === best ? boostProbability * entry.probability / favoredWeight : 0);
      const next = dealer(entry.next.total, entry.next.soft);
      for (let i = 0; i < out.length; i++) out[i] += weight * next[i];
    }
    dealerMemo.set(key, out); return out;
  };
  const byUp = new Map(), decisions = [];
  for (let up = 1; up <= 10; up++) {
    const distribution = Array(6).fill(0);
    const hole = ranks.filter(rank => !(up === 1 && rank.value === 10) && !(up === 10 && rank.value === 1));
    const denominator = hole.reduce((sum, rank) => sum + rank.probability, 0);
    const upState = { total: up === 1 ? 11 : up, soft: up === 1 };
    for (const rank of hole) {
      const state = addCard(upState.total, upState.soft, rank.value), next = dealer(state.total, state.soft);
      for (let i = 0; i < distribution.length; i++) distribution[i] += rank.probability / denominator * next[i];
    }
    const memo = new Map(), hitMemo = new Map();
    const stand = total => total > 21 ? 0 : distribution.reduce((sum, value, i) => sum + value * (i === 5 || i + 17 < total ? 2 : i + 17 === total ? 1 : 0), 0);
    const ev = (total, soft) => {
      if (total >= 21) return stand(total);
      const key = total + ':' + Number(soft);
      if (memo.has(key)) return memo.get(key);
      const stay = stand(total);
      const states = ranks.map(rank => ({ ...rank, next: addCard(total, soft, rank.value) }));
      const bust = states.filter(entry => entry.next.total > 21);
      const minimum = Math.min(...states.map(entry => entry.next.total));
      const unfavorable = bust.length ? bust : states.filter(entry => entry.next.total === minimum);
      const weightTotal = unfavorable.reduce((sum, entry) => sum + entry.probability, 0);
      const favored = new Set(unfavorable);
      const hit = states.reduce((sum, entry) => sum
        + ((1 - playerProbability) * entry.probability + (favored.has(entry) ? playerProbability * entry.probability / weightTotal : 0))
        * ev(entry.next.total, entry.next.soft), 0);
      memo.set(key, Math.max(stay, hit)); hitMemo.set(key, hit > stay + 1e-12); return Math.max(stay, hit);
    };
    // Evaluate all reachable hand states before exposing a table.
    for (let total = 4; total <= 20; total++) { ev(total, false); if (total >= 12) ev(total, true); }
    byUp.set(up, { memo, hitMemo, distribution });
    for (const soft of [false, true]) for (let total = soft ? 12 : 4; total <= 20; total++) decisions.push({ upcard: up === 1 ? 'A' : up, total, soft, hit: hitMemo.get(total + ':' + Number(soft)) ?? false });
  }
  return {
    description: 'Visible-card hit/stand policy adapted to the disclosed dealer boost; decisions maximize expected payout in an infinite-deck approximation. Actual return measured using finite six-deck simulation. No hidden-card or future-card peeking.',
    decisions,
    hit(view) {
      const s = blackjackScore(view.player), up = Math.min(10, view.dealer[0].rank);
      return byUp.get(up).hitMemo.get(s.total + ':' + Number(s.soft)) ?? false;
    }
  };
}
let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const close = (actual, expected) => { assert(Math.abs(actual - expected) < 1e-12); checks++; };
const fixture = (ranks, options = {}) => createBlackjackHand({ shoe: ranks.map(rank => ({ rank, suit: 'spades' })), playerUnfavorableTickets: 0, ...options });
const queue = values => n => { const value = values.shift(); assert(Number.isInteger(value) && value >= 0 && value < n); return value; };
const dealerTurn = options => revealBlackjack(standBlackjack(fixture([10, 10, 10, 2, 9, 9, 5, 10, 13], options)));
check(CANDIDATE_RULES.ticketCount, 10000);
for (const value of [-1, 10001, .5, NaN]) { assert.throws(() => fixture([10, 9, 8, 8], { dealerBoostTickets: value })); checks++; }
assert.throws(() => createBlackjackHand({ shoe: [1, 2, 3, 4].map(rank => ({ rank, suit: 'spades', id: 'same' })) })); checks++;
const turns = dealerTurn({ dealerBoostTickets: 4000, randomInt: queue([3999, 1]), audit: true });
const probabilities = dealerDrawProbabilities(turns);
check(probabilities.remainingCards, 5); check(probabilities.preferredCards, 2); check(probabilities.bestResultingTotal, 21);
close(probabilities.boostProbability, .4); close(probabilities.perPreferredCard, .32); close(probabilities.perOtherCard, .12);
close(probabilities.ranks.reduce((sum, entry) => sum + entry.probability, 0), 1);
close(probabilities.ranks.find(entry => entry.rank === 9).probability, .64);
const boosted = dealerStepBlackjack(turns);
check(boosted.dealer.map(card => card.rank), [10, 2, 9]); check(evaluateBlackjack(boosted).outcome, 'lose');
check(dealerStepBlackjack(turns), boosted); // No new ticket / card draw.
check(blackjackResearchAudit(boosted).length, 1);
check(blackjackResearchAudit(boosted)[0].ticket, 3999);
check(blackjackResearchAudit(boosted)[0].boost, true);
const ordinary = dealerStepBlackjack(dealerTurn({ dealerBoostTickets: 4000, randomInt: queue([4000, 2]), audit: true }));
check(ordinary.dealer.map(card => card.rank), [10, 2, 5]); check(evaluateBlackjack(ordinary).payoutMultiplier, 2);
check(blackjackResearchAudit(ordinary)[0].boost, false);
const bust = dealerStepBlackjack(dealerTurn({ dealerBoostTickets: 4000, randomInt: queue([9999, 3]) }));
check(blackjackScore(bust.dealer).bust, true); check(evaluateBlackjack(bust).payoutMultiplier, 2);

// Exact ticket boundary exhaustion: same known five remaining physical cards.
let boostedTickets = 0;
for (let ticket = 0; ticket < 10000; ticket++) {
  const hand = dealerTurn({ dealerBoostTickets: 4000, randomInt: queue([ticket, 0]), audit: true });
  const next = dealerStepBlackjack(hand);
  const audit = blackjackResearchAudit(next)[0];
  check(audit.boost, ticket < 4000); boostedTickets += Number(audit.boost);
  check(next.shoe.length, hand.shoe.length);
  check(new Set(next.shoe.map(card => card.id)).size, next.shoe.length);
}
check(boostedTickets, 4000);

const hiddenA = fixture([10, 7, 6, 8, 5], { randomInt: queue([0, 0]) });
const hiddenB = fixture([10, 7, 6, 13, 5], { randomInt: queue([0, 0]) });
check(blackjackPublicView(hiddenA), blackjackPublicView(hiddenB));
check(blackjackPublicView(hiddenA).dealer[1], { hidden: true });
assert.throws(() => dealerDrawProbabilities(hiddenA)); checks++;
assert.throws(() => blackjackResearchAudit(hiddenA)); checks++;
assert.throws(() => evaluateBlackjack(hiddenA)); checks++;
assert.throws(() => dealerStepBlackjack(hiddenA)); checks++;
const paidInput = fixture([10, 10, 10, 2, 9, 9, 5, 10, 13], { dealerBoostTickets: 4000, randomInt: queue([0, 0]), audit: true });
const finalized = finishBlackjack(paidInput);
check(finishBlackjack(paidInput), finalized); // Unmount/duplicate finish is stable.
check(blackjackResearchAudit(finalized).length, 1);
check(paidInput.dealer.length, 2); check(paidInput.cursor, 4);
check(new Set([...finalized.player, ...finalized.dealer].map(card => card.id)).size, finalized.cursor);
for (const [ranks, multiplier] of [[[1, 9, 10, 8], 2.5], [[10, 9, 8, 8], 2], [[10, 9, 7, 8], 1], [[10, 10, 6, 8], 0]]) {
  const result = evaluateBlackjack(finishBlackjack(fixture(ranks)));
  check(result.payoutMultiplier, multiplier);
  for (const stake of [5, 50, 100, 250]) check(Number.isSafeInteger(stake * 100 * multiplier), true);
}

// No account data exists in the selection rule, and ignored extra properties
// cannot influence identical seed/card decisions.
for (let seed = 1; seed <= 100; seed++) {
  const options = { dealerBoostTickets: 4000 };
  const low = createBlackjackHand({ ...options, randomInt: seededRandomInt(seed), balance: 0, history: [], playerId: 'low', stake: 5 });
  const high = createBlackjackHand({ ...options, randomInt: seededRandomInt(seed), balance: 1000000, history: ['win'], playerId: 'high', stake: 250 });
  check(evaluateBlackjack(finishBlackjack(low)), evaluateBlackjack(finishBlackjack(high)));
}
for (const [name, policy] of Object.entries({ basic: basicHit, adapted: adaptedPolicy(CANDIDATE_RULES.dealerBoostTickets / 10000, CANDIDATE_RULES.playerUnfavorableTickets / 10000).hit })) {
  const randomInt = seededRandomInt(0x20261008);
  for (let i = 0; i < 10000; i++) {
    let hand = createBlackjackHand({ randomInt, audit: i < 10 });
    while (hand.phase === 'player') {
      const view = blackjackPublicView(hand);
      check(view.dealer[1], { hidden: true }); check(view.result, null);
      hand = policy(view) ? hitBlackjack(hand) : standBlackjack(hand);
    }
    hand = finishBlackjack(hand);
    const result = evaluateBlackjack(hand), dealer = blackjackScore(hand.dealer), player = blackjackScore(hand.player);
    check([0, 1, 2, 2.5].includes(result.payoutMultiplier), true);
    check(hand.cursor, hand.player.length + hand.dealer.length);
    check(new Set(hand.shoe.map(card => card.id)).size, 312);
    check(new Set([...hand.player, ...hand.dealer].map(card => card.id)).size, hand.cursor);
    if (!player.bust && !player.natural && !dealer.natural) check(dealer.total >= 17, true);
  }
}
console.log(`Dealer-selection research variant: ${checks} checks passed.`);
