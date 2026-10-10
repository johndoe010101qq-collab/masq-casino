import assert from 'node:assert/strict';
import { demoMath } from '../src/demo-math.js';
import { HallSession } from '../src/hall-session.js';

// Independent game contracts: counts and aggregate payouts catch outcome
// omissions even when an individual result appears internally consistent.
const contracts = {
  coinflip: { sampleSize: 2, choices: ['mask', 'number'] },
  dice: { sampleSize: 6, choices: [1, 2, 3, 4, 5, 6] },
  plinko: { sampleSize: 256, choices: ['normal'] },
  roulette: { sampleSize: 37, choices: ['red', 'black', 'zero'] },
  upgrader: { sampleSize: 10000, choices: [1.5, 2, 4, 8] },
};
let outcomesChecked = 0;

function play(game, choice, ticket, expectedPayout, stake = 100) {
  let draws = 0;
  const session = new HallSession(demoMath, maximum => {
    assert.equal(maximum, contracts[game].sampleSize);
    draws++;
    return ticket;
  });
  const round = session.begin(game, choice, stake);
  const debited = session.getSnapshot();
  assert.equal(draws, 1, 'Each round draws exactly one outcome');
  assert.equal(debited.balance, 1000 - stake, 'Only the stake is debited before completion');
  assert.equal(debited.busy, true);
  assert.equal(debited.history.length, 0);
  assert.equal(debited.result, null);
  assert.equal(round.ticket, ticket);
  assert.equal(round.payout, expectedPayout);
  assert.equal(round.payoutCents, expectedPayout * 100);
  assert.ok(Number.isSafeInteger(round.payoutCents) && round.payoutCents >= 0);
  assert.ok(Number.isSafeInteger(round.payout), 'Allowed stakes yield whole demo chips');
  assert.equal(round.net, expectedPayout - stake);
  assert.equal(round.won, expectedPayout > stake);

  assert.equal(session.complete(round.id), true);
  const completed = session.getSnapshot();
  assert.equal(completed.balance, 1000 - stake + expectedPayout, 'Completion credits the payout once');
  assert.ok(Number.isSafeInteger(completed.balance * 100) && completed.balance >= 0);
  assert.equal(completed.busy, false);
  assert.equal(completed.history.length, 1);
  assert.equal(completed.history[0], completed.result);
  assert.equal(completed.result.id, round.id);
  assert.equal(session.pending, null);
  assert.equal(session.complete(round.id), false, 'Duplicate completion cannot credit again');
  assert.equal(session.getSnapshot(), completed);
  assert.equal(draws, 1, 'Settlement does not draw another outcome');
  outcomesChecked++;
  return round;
}

for (const choice of contracts.coinflip.choices) {
  let wins = 0, gross = 0;
  for (const ticket of [0, 1]) {
    const side = ['mask', 'number'][ticket];
    const expectedPayout = choice === side ? 200 : 0;
    const round = play('coinflip', choice, ticket, expectedPayout);
    assert.equal(round.result, ticket);
    assert.equal(round.label, ticket === 0 ? 'Маска' : 'Число');
    wins += Number(round.payout > 0);
    gross += round.payout;
  }
  assert.equal(wins, 1);
  assert.equal(gross, 200);
}

for (const choice of contracts.dice.choices) {
  const faces = new Set();
  let wins = 0, gross = 0;
  for (let ticket = 0; ticket < 6; ticket++) {
    const round = play('dice', choice, ticket, choice === ticket + 1 ? 600 : 0);
    assert.equal(round.face, ticket + 1);
    faces.add(round.face);
    wins += Number(round.payout > 0);
    gross += round.payout;
  }
  assert.deepEqual([...faces], [1, 2, 3, 4, 5, 6]);
  assert.equal(wins, 1);
  assert.equal(gross, 600);
}

{
  const bucketPays = [1300, 300, 130, 70, 40, 70, 130, 300, 1300];
  const buckets = Array(9).fill(0);
  const paths = new Set();
  const rounds = [];
  let gross = 0;
  for (let ticket = 0; ticket < 256; ticket++) {
    // Independently count right turns in the ticket's binary representation.
    // At 100 D, the published bucket amounts equal the percentage table.
    const expectedBucket = ticket.toString(2).replaceAll('0', '').length;
    const round = play('plinko', 'normal', ticket, bucketPays[expectedBucket]);
    assert.equal(round.bucket, expectedBucket);
    assert.equal(round.path.length, 8);
    assert.ok(round.path.every(bit => bit === 0 || bit === 1));
    assert.equal(round.path.filter(bit => bit === 1).length, round.bucket);
    assert.equal(round.path.reduce((value, bit, index) => value + bit * 2 ** index, 0), ticket);
    paths.add(round.path.join(''));
    buckets[round.bucket]++;
    gross += round.payout;
    rounds.push(round);
  }
  assert.equal(paths.size, 256, 'Every eight-step route occurs exactly once');
  assert.deepEqual(buckets, [1, 8, 28, 56, 70, 56, 28, 8, 1]);
  assert.equal(gross, 25320);
  for (let ticket = 0; ticket < 256; ticket++) {
    assert.equal(rounds[ticket].bucket + rounds[255 - ticket].bucket, 8);
    assert.equal(rounds[ticket].payout, rounds[255 - ticket].payout, 'Mirrored routes pay equally');
  }
}

// Standard European red pockets, written independently of the implementation.
const redPockets = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
for (const choice of contracts.roulette.choices) {
  const colors = { red: 0, black: 0, zero: 0 };
  let wins = 0, gross = 0;
  for (let ticket = 0; ticket < 37; ticket++) {
    const color = ticket === 0 ? 'zero' : redPockets.has(ticket) ? 'red' : 'black';
    const expectedPayout = color === choice ? choice === 'zero' ? 3600 : 200 : 0;
    const round = play('roulette', choice, ticket, expectedPayout);
    assert.equal(round.number, ticket);
    assert.equal(round.color, color);
    colors[round.color]++;
    wins += Number(round.payout > 0);
    gross += round.payout;
    if (ticket === 0) assert.equal(round.payout, choice === 'zero' ? 3600 : 0, 'Zero loses both color bets');
  }
  assert.deepEqual(colors, { red: 18, black: 18, zero: 1 });
  assert.equal(wins, choice === 'zero' ? 1 : 18);
  assert.equal(gross, 3600);
}

for (const [choice, winningTickets] of [[1.5, 6400], [2, 4800], [4, 2400], [8, 1200]]) {
  let wins = 0, gross = 0;
  for (let ticket = 0; ticket < 10000; ticket++) {
    const expectedPayout = ticket < winningTickets ? 100 * choice : 0;
    const round = play('upgrader', choice, ticket, expectedPayout);
    assert.ok(Math.abs(round.chance - winningTickets / 10000) < 1e-12);
    assert.equal(round.percentile, ticket / 10000);
    wins += Number(round.payout > 0);
    gross += round.payout;
  }
  assert.equal(wins, winningTickets);
  assert.equal(gross, 960000, 'Each upgrade option has the declared 96% aggregate payout');
}

// Stake endpoints exercise payout scaling, including the ×1.5 and ×0.4 amounts.
for (const stake of [10, 500]) {
  play('coinflip', 'mask', 0, stake * 2, stake);
  play('coinflip', 'mask', 1, 0, stake);
  play('dice', 6, 5, stake * 6, stake);
  play('plinko', 'normal', 0, stake * 13, stake);
  play('plinko', 'normal', 15, stake * 0.4, stake);
  play('roulette', 'zero', 0, stake * 36, stake);
  play('upgrader', 1.5, 6399, stake * 1.5, stake);
  play('upgrader', 1.5, 6400, 0, stake);
  play('upgrader', 8, 1199, stake * 8, stake);
  play('upgrader', 8, 1200, 0, stake);
}

{
  let draws = 0;
  const session = new HallSession(demoMath, () => { draws++; return 0; });
  const changes = [];
  const unsubscribe = session.subscribe(() => changes.push(session.getSnapshot()));
  const round = session.begin('coinflip', 'mask', 100);
  const debited = session.getSnapshot();
  assert.equal(session.begin('dice', 6, 500), null, 'Busy session refuses a second debit');
  assert.equal(session.reset(), false, 'Busy session cannot reset away a pending credit');
  assert.equal(session.complete(round.id + 1), false, 'Wrong ID cannot settle a pending round');
  assert.equal(session.getSnapshot(), debited);
  assert.equal(session.pending, round);
  assert.equal(draws, 1);
  assert.equal(changes.length, 1);
  assert.equal(session.complete(round.id), true);
  assert.equal(changes.length, 2, 'One debit notification and one credit notification');
  assert.equal(session.getSnapshot().balance, 1100);
  assert.equal(session.complete(round.id), false);
  assert.equal(changes.length, 2);
  assert.equal(session.reset(), true);
  assert.deepEqual(session.getSnapshot(), { balance: 1000, busy: false, history: [], result: null });
  const next = session.begin('dice', 1, 100);
  assert.ok(next.id > round.id, 'Reset preserves unique round IDs');
  assert.equal(session.complete(round.id), false, 'A stale pre-reset ID cannot settle the next round');
  assert.equal(session.complete(next.id), true);
  unsubscribe();
  const notificationCount = changes.length;
  session.reset();
  assert.equal(changes.length, notificationCount, 'Unsubscribe removes the listener');
}

function rejectsWithoutMutation(game, choice, stake, randomInt, options) {
  const session = new HallSession(demoMath, randomInt);
  const before = session.getSnapshot();
  assert.throws(() => session.begin(game, choice, stake, options), RangeError);
  assert.equal(session.getSnapshot(), before, 'Rejected input leaves the session unchanged');
  assert.equal(session.pending, null);
  assert.equal(session.id, 0, 'Rejected input does not consume a round ID');
}

for (const game of Object.keys(contracts)) {
  const { sampleSize, choices } = contracts[game];
  for (const ticket of [-1, sampleSize, 0.5, NaN, Infinity]) {
    rejectsWithoutMutation(game, choices[0], 100, () => ticket);
  }
  rejectsWithoutMutation(game, 'unavailable-choice', 100, () => { assert.fail('Invalid choice drew an outcome'); });
  rejectsWithoutMutation(game, choices[0], 100, () => 0, { preview: true });
}
rejectsWithoutMutation('dice', '1', 100, () => { assert.fail('String dice choice accepted'); });
rejectsWithoutMutation('upgrader', '2', 100, () => { assert.fail('String upgrade choice accepted'); });
rejectsWithoutMutation('unknown-game', 'mask', 100, () => { assert.fail('Unknown game drew an outcome'); });
for (const stake of [-10, 0, 9, 11, 50.5, 501, 510, NaN, Infinity]) {
  rejectsWithoutMutation('coinflip', 'mask', stake, () => { assert.fail('Invalid stake drew an outcome'); });
}

for (const failureAt of ['draw', 'settle']) {
  const failure = new Error('Deterministic dependency failure');
  const math = failureAt === 'settle'
    ? { rules: demoMath.rules, settle: () => { throw failure; } }
    : demoMath;
  const session = new HallSession(math, () => {
    if (failureAt === 'draw') throw failure;
    return 0;
  });
  const before = session.getSnapshot();
  assert.throws(() => session.begin('coinflip', 'mask', 100), error => error === failure);
  assert.equal(session.getSnapshot(), before, 'Dependency failure is transactional');
  assert.equal(session.pending, null);
  assert.equal(session.id, 0);
}

{
  let draws = 0;
  const session = new HallSession(demoMath, () => { draws++; return 1; });
  for (const [stake, closingBalance] of [[500, 500], [490, 10], [10, 0]]) {
    const round = session.begin('coinflip', 'mask', stake);
    assert.ok(session.getSnapshot().balance >= 0);
    session.complete(round.id);
    assert.equal(session.getSnapshot().balance, closingBalance);
  }
  const depleted = session.getSnapshot();
  assert.throws(() => session.begin('coinflip', 'mask', 10), /Недостаточно/);
  assert.equal(session.getSnapshot(), depleted);
  assert.equal(draws, 3, 'An unfunded round draws no outcome');
  assert.equal(session.reset(), true);
  assert.equal(session.getSnapshot().balance, 1000);
}

{
  let ticket = 0;
  const session = new HallSession(demoMath, () => ticket++ % 2);
  for (let index = 0; index < 26; index++) {
    const round = session.begin('coinflip', 'mask', 10);
    session.complete(round.id);
  }
  assert.equal(session.getSnapshot().balance, 1000);
  assert.deepEqual(session.getSnapshot().history.map(round => round.id),
    Array.from({ length: 20 }, (_, index) => 26 - index));
}

console.log(`Hall checks passed: ${outcomesChecked} deterministic outcomes, exact accounting, input/busy/reset guards and history.`);
