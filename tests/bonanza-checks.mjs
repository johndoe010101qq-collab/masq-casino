import assert from 'node:assert/strict';
import {
  BONANZA_SYMBOLS as symbols,
  BONANZA_DEMO_RULES as rules,
  simulateBonanzaSpin,
  simulateBonanzaRound,
  playBonanzaRound,
  createCryptoRandomInt,
} from '../src/bonanza.js';

function fixture(flat) {
  assert.equal(flat.length, 30);
  return Array.from({ length: 6 },
    (_, column) => flat.slice(column * 5, column * 5 + 5));
}
function regular(count, skip = 0) {
  return Array.from({ length: count },
    (_, index) => symbols[skip + index % (9 - skip)]);
}
function offset(entries, target) {
  let total = 0;
  for (const [item, weight] of entries) {
    if (item === target) return total;
    total += weight;
  }
  throw new Error('Missing fixture value');
}
function scriptedRandom(descriptions, freeSpin = false) {
  const queue = [];
  for (const description of descriptions) {
    const kind = typeof description === 'string' ? description : description.kind;
    queue.push(offset(freeSpin ? rules.freeWeights : rules.baseWeights, kind));
    if (kind === 'bomb') queue.push(offset(rules.bombWeights, description.value));
  }
  let index = 0;
  return maximum => {
    assert.ok(index < queue.length, 'Fixture RNG exhausted');
    const value = queue[index++];
    assert.ok(value >= 0 && value < maximum);
    return value;
  };
}
function cyclicRegularRandom(freeSpin = false) {
  let index = 0;
  return maximum => {
    const kind = symbols[index++ % symbols.length];
    const value = offset(freeSpin ? rules.freeWeights : rules.baseWeights, kind);
    assert.ok(value < maximum);
    return value;
  };
}

{
  const result = simulateBonanzaSpin({
    stakeCents: 10000,
    initialGrid: fixture([
      ...Array(8).fill('hood'), ...Array(8).fill('suit'), ...regular(14, 2),
    ]),
    randomInt: scriptedRandom(regular(16)),
  });
  assert.equal(result.frames.length, 2);
  assert.equal(result.frames[0].wins.length, 2);
  assert.equal(result.frames[0].removed.length, 16);
  // 10000 × (499 + 403) / 100: hood 8 and suit 8.
  assert.equal(result.payoutCents, 85700);
  for (let column = 0; column < 6; column++) {
    const survivors = result.frames[0].afterRemoval[column].filter(Boolean);
    const finalSurvivors = result.frames[0].after[column].slice(5 - survivors.length);
    assert.deepEqual(finalSurvivors.map(cell => cell.id), survivors.map(cell => cell.id));
  }
  assert.ok(Object.isFrozen(result.frames[0].refill[0].cell));
}

{
  const result = simulateBonanzaSpin({
    stakeCents: 1000,
    freeSpin: true,
    initialGrid: fixture([
      ...Array(16).fill('hood'), { kind: 'bomb', value: 3 }, ...regular(13, 1),
    ]),
    randomInt: scriptedRandom([
      ...Array(8).fill('hood'), { kind: 'bomb', value: 5 },
      ...regular(7, 1), ...regular(8, 1),
    ], true),
  });
  assert.equal(result.tumbles, 2);
  // 1000 × 9938 / 100 + 1000 × 997 / 100: hood 16 then hood 8.
  assert.equal(result.symbolWinCents, 6620);
  assert.equal(result.multiplier.sum, 8);
  assert.equal(result.multiplier.cellIds.length, 2);
  // (99380 + 9970) × (3 + 5) =874800, clipped by the100000-cent spin cap.
  assert.equal(result.payoutCents, 52960);
  assert.deepEqual(result.frames.map(frame => frame.multiplier.newBombs.length), [1, 1, 0]);
}

{
  const result = playBonanzaRound({
    stakeCents: 1000,
    initialGrid: fixture([...Array(4).fill('scatter'), ...regular(26)]),
    randomInt: cyclicRegularRandom(true),
  });
  assert.equal(result.spins.length, 11);
  assert.equal(result.freeSpinsPlayed, 10);
  assert.equal(result.spins[0].scatter.count, 4);
  assert.equal(result.spins[0].frames[0].removed.length, 0);
  assert.deepEqual(result.ledger, {
    // Four scatters: 1000 × 998 / 100 = 9980; cyclic free spins pay zero.
    chargeCents: 1000, creditCents: 9480, deltaCents: 8480,
  });
  assert.ok(result.spins.slice(1).every(spin => spin.chargeCents === 0));
}

{
  const initialGrid = fixture([...Array(3).fill('scatter'), ...regular(27)]);
  const base = simulateBonanzaSpin({
    stakeCents: 1000, initialGrid, randomInt: cyclicRegularRandom(),
  });
  const free = simulateBonanzaSpin({
    stakeCents: 1000, freeSpin: true, initialGrid, randomInt: cyclicRegularRandom(true),
  });
  assert.equal(base.freeSpinsAwarded, 0);
  assert.equal(free.freeSpinsAwarded, 5);
  assert.equal(free.scatter.payoutCents, 0);
}

{
  const result = simulateBonanzaSpin({
    stakeCents: 1000,
    freeSpin: true,
    initialGrid: fixture([{ kind: 'bomb', value: 25 }, ...regular(29)]),
    randomInt: cyclicRegularRandom(true),
  });
  assert.equal(result.payoutCents, 0);
  assert.equal(result.multiplier.sum, 25);
  assert.equal(result.multiplier.active, false);
  assert.equal(result.multiplier.applied, 1);
}

{
  const result = simulateBonanzaSpin({
    stakeCents: 1000,
    capCents: 500,
    initialGrid: fixture(Array(30).fill('hood')),
    randomInt: scriptedRandom(regular(30)),
  });
  // Hood 30: the 12+ tier, 1000 × 4962 / 100.
  assert.equal(result.uncappedPayoutCents, '47150');
  assert.equal(result.payoutCents, 500);
  assert.equal(result.capped, true);
}

assert.throws(() => simulateBonanzaSpin({
  stakeCents: 1000, maxTumbles: 1,
  initialGrid: fixture(Array(30).fill('hood')), randomInt: () => 0,
}), error => error.code === 'TUMBLE_LIMIT');

assert.throws(() => playBonanzaRound({
  stakeCents: 1000, mode: 'preview', maxSpins: 1, randomInt: cyclicRegularRandom(true),
}), error => error.code === 'SPIN_LIMIT');

{
  const result = simulateBonanzaRound(5000, {
    preview: true, randomInt: cyclicRegularRandom(true),
  });
  assert.equal(result.preview, true);
  assert.equal(result.bonusTriggered, false);
  assert.equal(result.spins.length, 10);
  assert.equal(result.payoutCents, 0);
  assert.ok(result.spins.every(spin => spin.isFreeSpin));
  const ids = result.spins.flatMap(spin => spin.initial.flat().map(cell => cell.id));
  assert.equal(new Set(ids).size, 300);
}

assert.throws(() => simulateBonanzaSpin({
  stakeCents: 1000, randomInt: maximum => maximum,
}), RangeError);

{
  const values = [0xffffffff, 7];
  const randomInt = createCryptoRandomInt({
    getRandomValues(buffer) { buffer[0] = values.shift(); },
  });
  assert.equal(randomInt(10), 7);
  assert.equal(values.length, 0);
}

// Maximum accepted stake: exact cents, multiplier sum, and cap.
{
  const result = simulateBonanzaSpin({
    stakeCents: 100000000,
    freeSpin: true,
    initialGrid: fixture([
      ...Array(12).fill('hood'),
      ...Array.from({ length: 18 }, () => ({ kind: 'bomb', value: 25 })),
    ]),
    randomInt: cyclicRegularRandom(true),
  });
  // Hood 12 in a free spin: 100000000 × 9938 / 100.
  assert.equal(result.symbolWinCents, 423000000);
  assert.equal(result.multiplier.sum, 450);
  // 423000000 × 18 multiplier tokens of 25 = 4472100000000.
  assert.equal(result.uncappedPayoutCents, '190350000000');
  assert.equal(result.payoutCents, 9999999900);
  assert.equal(result.capped, true);
  assert.ok(Number.isSafeInteger(result.payoutCents));
  assert.ok(Number.isSafeInteger(result.symbolWinCents));
}

// Site-facing fields retain grid, wins, removal, refill and final settlement.
{
  const result = simulateBonanzaRound(100000000, {
    preview: true,
    initialGrid: fixture([
      ...Array(12).fill('hood'),
      ...Array.from({ length: 18 }, () => ({ kind: 'bomb', value: 25 })),
    ]),
    randomInt: cyclicRegularRandom(true),
  });
  assert.equal(result.capped, true);
  assert.equal(result.payoutCents, 9999999900);
  assert.equal(result.spins.length, 10);
  assert.equal(result.unplayedFreeSpins, 0);
  const spin = result.spins[0];
  for (const key of ['isFreeSpin', 'index', 'frames', 'payoutCents',
    'multiplier', 'scatterCount', 'awardedSpins']) {
    assert.ok(Object.hasOwn(spin, key), 'Missing integration field: ' + key);
  }
  assert.equal(spin.multiplier, 450);
  assert.equal(spin.frames[0].before[0][0].kind, 'hood');
  assert.equal(spin.frames[0].wins[0].cells.length, 12);
  assert.equal(spin.frames[0].removed.length, 12);
  assert.equal(spin.frames[0].refill.length, 12);
  assert.equal(spin.frames[0].afterRemoval.flat().filter(cell => cell === null).length, 12);
}


assert.equal(rules.winCapMultiplier, 100);
assert.equal(rules.maximumUserStake, 100);
assert.equal(rules.bonusBuyMultiplier, 50);
assert.equal(rules.rtp, null);
console.log('Bonanza deterministic mechanics and integration checks passed');
