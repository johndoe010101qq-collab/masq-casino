// Independent fixture arithmetic: 10AR base, 500AR price.
// Eight hoods pay 2.39*10AR; one x3 token gives 71.70AR.
// Net -428.30AR, closing wallet 571.70AR. Cap999AR leaves net499AR.
import assert from 'node:assert/strict';
import {
  BONANZA_SYMBOLS as symbols, BONANZA_DEMO_RULES as rules,
  playBonanzaRound, simulateBonanzaRound
} from '../src/bonanza.js';
import {
  HallSession, validateAmount, validateBonusPurchase
} from '../src/hall-session.js';

const fixture = flat => Array.from({length: 6},
  (_, column) => flat.slice(column * 5, column * 5 + 5));
const regular = (count, skip = 0) => Array.from({length: count},
  (_, index) => symbols[skip + index % (symbols.length - skip)]);
function offset(entries, target) {
  let value = 0;
  for (const [item, weight] of entries) {
    if (item === target) return value;
    value += weight;
  }
  throw new Error('Fixture entry missing');
}
function cyclingRNG() {
  let index = 0;
  return maximum => {
    const value = offset(rules.freeWeights, symbols[index++ % symbols.length]);
    assert.ok(value < maximum);
    return value;
  };
}
function initialRNG(descriptions) {
  const queue = [];
  for (const description of descriptions) {
    const kind = typeof description === 'string' ? description : description.kind;
    queue.push(offset(rules.freeWeights, kind));
    if (kind === 'bomb') queue.push(offset(rules.bombWeights, description.value));
  }
  const fallback = cyclingRNG();
  return maximum => queue.length ? queue.shift() : fallback(maximum);
}

{
  const result = playBonanzaRound({
    mode: 'buy', stakeCents: 1000, randomInt: cyclingRNG()
  });
  assert.equal(result.mode, 'buy');
  assert.equal(result.bonusBought, true);
  assert.equal(result.preview, false);
  assert.equal(result.chargeCents, 50000);
  assert.equal(result.spins.length, 10);
  assert.equal(result.freeSpinsAwarded, 10);
  assert.equal(result.freeSpinsPlayed, 10);
  assert.equal(result.unplayedFreeSpins, 0);
  assert.ok(result.spins.every(spin => spin.freeSpin && spin.chargeCents === 0));
  assert.deepEqual(result.ledger, {
    chargeCents: 50000, creditCents: 0, deltaCents: -50000
  });
}
{
  const result = simulateBonanzaRound(1000, {
    mode: 'buy', randomInt: cyclingRNG()
  });
  assert.equal(result.mode, 'buy');
  assert.equal(result.preview, false);
  assert.equal(result.bonusBought, true);
  assert.equal(result.bonusTriggered, true);
  assert.equal(result.spins.length, 10);
  assert.ok(result.spins.every(spin => spin.isFreeSpin));
  assert.equal(result.winCapCents, 99900);
}
{
  const result = playBonanzaRound({
    mode: 'buy', stakeCents: 1000,
    initialGrid: fixture([...Array(3).fill('scatter'), ...regular(27)]),
    randomInt: cyclingRNG()
  });
  assert.equal(result.spins.length, 15);
  assert.equal(result.freeSpinsAwarded, 15);
  assert.equal(result.freeSpinsPlayed, 15);
  assert.equal(result.spins[0].freeSpinsAwarded, 5);
  assert.equal(result.chargeCents, 50000);
  assert.equal(result.ledger.chargeCents, 50000);
}
{
  const result = playBonanzaRound({
    mode: 'buy', stakeCents: 1000,
    initialGrid: fixture([
      ...Array(8).fill('hood'), {kind:'bomb', value:3}, ...regular(21, 1)
    ]),
    randomInt: cyclingRNG()
  });
  assert.equal(result.spins[0].multiplier.applied, 3);
  assert.equal(result.spins[0].multiplier.cellIds.length, 1);
  assert.equal(result.payoutCents, 7170);
  assert.equal(result.ledger.deltaCents, -42830);
}
{
  const result = playBonanzaRound({
    mode: 'buy', stakeCents: 1000,
    initialGrid: fixture([
      ...Array(12).fill('hood'),
      ...Array.from({length:18}, () => ({kind:'bomb', value:25}))
    ]),
    randomInt: cyclingRNG()
  });
  assert.equal(result.capCents, 99900);
  assert.equal(result.payoutCents, 99900);
  assert.equal(result.capReached, true);
  assert.equal(result.spins.length, 10);
  assert.equal(result.unplayedFreeSpins, 0);
  assert.equal(result.ledger.deltaCents, 49900);
}
{
  const session = new HallSession(undefined, cyclingRNG());
  const round = session.begin('slots', 'bonanza', 10, {mode:'buy'});
  assert.equal(round.stake, 10);
  assert.equal(round.stakeCents, 1000);
  assert.equal(round.chargeCents, 50000);
  assert.equal(round.cost, 500);
  assert.equal(round.bonusBought, true);
  assert.equal(round.preview, false);
  assert.equal(round.enginePayoutCents, 0);
  assert.equal(round.bonusPurchaseFloorPaymentCents, 5000);
  assert.equal(round.payoutCents, 5000);
  assert.equal(round.net, -450);
  assert.equal(round.netCents, -45000);
  assert.equal(round.won, false);
  assert.equal(session.getSnapshot().balance, 500);
  assert.equal(session.getSnapshot().busy, true);
  assert.equal(session.begin('slots', 'bonanza', 10, {mode:'buy'}), null);
  assert.equal(session.complete(round.id + 1), false);
  assert.equal(session.complete(round.id), true);
  assert.equal(session.getSnapshot().balance, 550);
  assert.equal(session.getSnapshot().history.length, 1);
  assert.equal(session.getSnapshot().history[0].cost, 500);
  assert.equal(session.getSnapshot().history[0].bonusBought, true);
  const completed = session.getSnapshot();
  assert.equal(session.complete(round.id), false);
  assert.equal(session.getSnapshot(), completed);
}
{
  const session = new HallSession(undefined, initialRNG([
    ...Array(8).fill('hood'), {kind:'bomb', value:3}, ...regular(21, 1)
  ]));
  const round = session.begin('slots', 'bonanza', 10, {mode:'buy'});
  assert.equal(round.payout, 71.7);
  assert.equal(round.cost, 500);
  assert.equal(round.net, -428.3);
  assert.equal(round.won, false);
  assert.equal(session.complete(round.id), true);
  assert.equal(session.getSnapshot().balance, 571.7);
  assert.equal(session.getSnapshot().history[0].net, -428.3);
  assert.equal(session.complete(round.id), false);
  assert.equal(session.getSnapshot().balance, 571.7);
}
{
  const session = new HallSession(undefined, initialRNG([
    ...Array(12).fill('hood'),
    ...Array.from({length:18}, () => ({kind:'bomb', value:25}))
  ]));
  const round = session.begin('slots', 'bonanza', 10, {mode:'buy'});
  assert.equal(round.payout, 999);
  assert.equal(round.cost, 500);
  assert.equal(round.net, 499);
  assert.equal(round.won, true);
  assert.equal(round.winCapCents, 99900);
  assert.equal(session.complete(round.id), true);
  assert.equal(session.getSnapshot().balance, 1499);
}
{
  let draws = 0;
  const session = new HallSession(undefined, maximum => {
    draws++; return maximum - 1;
  }, {initialBalanceCents:9900});
  const opening = session.getSnapshot();
  assert.throws(() => session.begin('slots', 'bonanza', 20, {mode:'buy'}),
    RangeError);
  assert.equal(draws, 0);
  assert.equal(session.getSnapshot(), opening);
  assert.equal(session.pending, null);
  assert.equal(session.id, 0);
  assert.throws(() => session.begin('slots', 'bonanza', 10,
    {mode:'buy', preview:true}), RangeError);
  assert.throws(() => session.begin('coinflip', 'heads', 10,
    {mode:'buy'}), RangeError);
  assert.throws(() => session.begin('dice', 1, 10,
    {mode:'preview'}), RangeError);
  assert.throws(() => session.begin('slots', 'bonanza', 10,
    {mode:'unknown'}), RangeError);
  assert.throws(() => session.begin('slots', 'bonanza', 110, {mode:'buy'}), RangeError);
  assert.throws(() => session.begin('slots', 'bonanza', 110, {mode:'preview'}), RangeError);
  assert.throws(() => session.begin('coinflip', 'heads', 255), RangeError);
  assert.equal(draws, 0);
  assert.equal(session.getSnapshot(), opening);
}
{
  const session = new HallSession(undefined, cyclingRNG(), {initialBalanceCents:0});
  const opening = session.getSnapshot();
  const round = session.begin('slots', 'bonanza', 100, {preview:true});
  assert.equal(round.preview, true);
  assert.equal(round.bonusBought, false);
  assert.equal(round.cost, 0);
  assert.equal(round.chargeCents, 0);
  assert.equal(round.net, 0);
  assert.equal(round.won, false);
  assert.equal(session.getSnapshot().balance, 0);
  assert.equal(session.complete(round.id), true);
  assert.equal(session.getSnapshot().balance, 0);
  assert.equal(session.getSnapshot().history, opening.history);
  const second = session.begin('slots', 'bonanza', 10, {mode:'preview'});
  assert.equal(second.preview, true);
  assert.equal(session.complete(second.id), true);
}
{
  const session = new HallSession(undefined, maximum => 0);
  const opening = session.getSnapshot();
  assert.throws(() => session.begin('slots', 'bonanza', 10, {mode:'buy'}),
    error => error.code === 'TUMBLE_LIMIT');
  assert.equal(session.getSnapshot(), opening);
  assert.equal(session.pending, null);
  assert.equal(session.id, 0);
}
{
  const session = new HallSession(undefined, maximum => maximum);
  const opening = session.getSnapshot();
  assert.throws(() => session.begin('slots', 'bonanza', 10, {mode:'buy'}),
    RangeError);
  assert.equal(session.getSnapshot(), opening);
  assert.equal(session.pending, null);
}
{
  const session = new HallSession({
    rules() {return {sampleSize:2};},
    settle() {return {payout:20, label:'MASK'};}
  }, () => 0);
  const round = session.begin('coinflip', 'heads', 10);
  assert.equal(round.mode, 'paid');
  assert.equal(round.cost, 10);
  assert.equal(round.chargeCents, 1000);
  assert.equal(round.net, 10);
  assert.equal(round.won, true);
  assert.equal(session.getSnapshot().balance, 990);
  assert.equal(session.complete(round.id), true);
  assert.equal(session.getSnapshot().balance, 1010);
}
assert.equal(validateBonusPurchase(10, 1000), '');
assert.ok(validateBonusPurchase(100, 999));
assert.equal(validateBonusPurchase(15, 10000), '');
assert.ok(validateBonusPurchase(105, 10000));
assert.equal(validateAmount(20, 1000), '');
assert.equal(validateAmount(100, 1000), '');
assert.ok(validateAmount(255, 1000));
assert.throws(() => playBonanzaRound({
  mode:'buy', stakeCents:1000, maxSpins:1, randomInt:cyclingRNG()
}), error => error.code === 'SPIN_LIMIT');
assert.throws(() => simulateBonanzaRound(1000, {
  mode:'buy', preview:true, randomInt:cyclingRNG()
}), TypeError);
assert.throws(() => playBonanzaRound({
  mode:'buy', preview:true, stakeCents:1000, randomInt:cyclingRNG()
}), TypeError);

{
  let draws = 0;
  const randomInt = () => {draws++; return 0;};
  assert.throws(() => simulateBonanzaRound(1000, {
    mode:'buy', winCapMultiplier:101, randomInt
  }), RangeError);
  assert.throws(() => playBonanzaRound({
    mode:'buy', stakeCents:1000, capCents:100001, randomInt
  }), RangeError);
  assert.equal(draws, 0);
}
console.log('Paid bonus ledger, preview, retrigger, multiplier, cap and transactional checks passed');
