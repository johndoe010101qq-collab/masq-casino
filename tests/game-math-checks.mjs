import assert from 'node:assert/strict';
import GameMath, {
  ROULETTE_NUMBERS, ROULETTE_RED_NUMBERS, PLINKO_MULTIPLIERS,
  DIE_FACE_NORMALS, DIE_TOP_ROTATIONS, GAME_DEMO_RULES, GameMathError,
  PLINKO_DISTRIBUTION, PLINKO_PATH_WEIGHTS, PLINKO_PATH_TICKET_STARTS,
  rouletteColor, rules, settle
} from '../src/game-math.js';

let checks = 0;
const equal = (actual, expected, message) => { checks++; assert.equal(actual, expected, message); };
const deep = (actual, expected, message) => { checks++; assert.deepEqual(actual, expected, message); };
const ok = (value, message) => { checks++; assert.ok(value, message); };
const throws = (run, code) => {
  checks++;
  assert.throws(run, error => error instanceof GameMathError && error.code === code);
};
const near = (actual, expected, tolerance = 1e-12) => {
  checks++; assert.ok(Math.abs(actual - expected) <= tolerance, actual + ' != ' + expected);
};
const configurations = [
  ['coinflip', 'heads'], ['coinflip', 'tails'], ['dice', 1], ['dice', 6],
  ['plinko', 'standard'], ['plinko', 'normal'],
  ['roulette', 'red'], ['roulette', 'black'], ['roulette', 'green'],
  ['roulette', 0], ['roulette', 17],
  ...[1.5, 2, 4, 8].map(multiplier => ['upgrader', multiplier])
];

equal(GameMath.rules, rules);
equal(GameMath.settle, settle);
equal(GAME_DEMO_RULES.minimumStake, 5);
equal(GAME_DEMO_RULES.maximumStake, 250);
equal(GAME_DEMO_RULES.stakeStep, 5);
equal(GAME_DEMO_RULES.currency, 'АР');
ok(Object.isFrozen(GAME_DEMO_RULES));
ok(Object.isFrozen(PLINKO_MULTIPLIERS));

for (const [game, choice] of configurations) {
  const config = rules(game, choice);
  ok(Object.isFrozen(config));
  for (const invalid of [0, 4, 6, 9, 11, 251, 255, NaN, Infinity, '5', 5.5, null, undefined]) {
    throws(() => settle(game, choice, invalid, 1000, 0), 'STAKE');
  }
  for (const ticket of [-1, config.sampleSize, config.sampleSize + 1, .5, NaN, Infinity, '0', null, undefined]) {
    throws(() => settle(game, choice, 10, 1000, ticket), 'TICKET');
  }
  for (let stake = 5; stake <= 250; stake += 5) {
    for (const ticket of [0, config.sampleSize - 1]) {
      const round = settle(game, choice, stake, 1000, ticket);
      equal(round.stakeCents, stake * 100);
      ok(Number.isSafeInteger(round.payoutCents));
      equal(Math.round(round.payout * 100), round.payoutCents);
      equal(round.netCents, round.payoutCents - round.stakeCents);
      ok(round.payoutCents >= 0 && round.payoutCents < stake * 100 * 100);
      ok(Object.isFrozen(round) && Object.isFrozen(round.outcome));
    }
  }
  for (const balance of [0, 10, 1000, 1000000, NaN, undefined]) {
    deep(settle(game, choice, 10, balance, 0), settle(game, choice, 10, 1000, 0),
      'Balance must not influence an outcome.');
  }
}
for (const [game, choice] of [
  ['coinflip', 'mask'], ['coinflip', 0], ['coinflip', undefined],
  ['dice', 0], ['dice', 7], ['dice', '1'], ['dice', 1.5],
  ['roulette', -1], ['roulette', 37], ['roulette', '17'], ['roulette', 'blue'],
  ['plinko', 'high'], ['plinko', null], ['upgrader', 1], ['upgrader', 3],
  ['upgrader', '2'], ['upgrader', Infinity]
]) {
  throws(() => rules(game, choice), 'CHOICE');
  throws(() => settle(game, choice, 10, 1000, 0), 'CHOICE');
}
for (const game of ['', 'slots', 'coin', null, undefined]) {
  throws(() => rules(game, 'heads'), 'GAME');
}

// Full selected-bet ticket enumeration lives in game-distribution-checks.mjs.
function rotateXYZ(vector, rotation) {
  let [x, y, z] = vector;
  const [rx, ry, rz] = rotation;
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  return [x, y, z];
}
for (let face = 1; face <= 6; face++) {
 const facingUp = rotateXYZ(DIE_FACE_NORMALS[face], DIE_TOP_ROTATIONS[face]);
 near(facingUp[0],0);near(facingUp[1],1);near(facingUp[2],0);
 deep(DIE_FACE_NORMALS[7-face].map((value,axis)=>value+DIE_FACE_NORMALS[face][axis]),[0,0,0]);
}
for (const number of [-1, 37, NaN, '0', null]) throws(() => rouletteColor(number), 'NUMBER');

const bins = Array(9).fill(0);
const distinctPaths = new Set();
let plinkoTotal = 0;
for (let pathIndex = 0; pathIndex < 256; pathIndex++) {
  const ticket=PLINKO_PATH_TICKET_STARTS[pathIndex];
  const round = settle('plinko', 'standard', 10, 1000, ticket);
  equal(round.steps.length, 8);
  equal(round.path.length, 9);
  equal(round.path[0], 0);
  ok(round.steps.every(step => step === -1 || step === 1));
  for (let row = 0; row < 8; row++) {
    equal(round.steps[row], ((pathIndex >> (7 - row)) & 1) ? 1 : -1);
    equal(round.path[row + 1] - round.path[row], round.steps[row]);
    ok(Math.abs(round.path[row + 1]) <= row + 1);
  }
  equal(round.bin, round.steps.filter(step => step === 1).length);
  equal(round.path[8], 2 * round.bin - 8);
  equal(round.multiplier, PLINKO_MULTIPLIERS[round.bin]);
  equal(round.payoutCents, 1000 * round.multiplier);
  equal(round.won, round.multiplier > 1);
  ok(Object.isFrozen(round.path) && Object.isFrozen(round.steps));
  const mirror = settle('plinko', 'standard', 10, 1000, PLINKO_PATH_TICKET_STARTS[255-pathIndex]);
  deep(mirror.path, round.path.map(offset => offset === 0 ? 0 : -offset));
  equal(mirror.bin, 8 - round.bin);
  equal(mirror.payoutCents, round.payoutCents);
  bins[round.bin]++;
  distinctPaths.add(round.steps.join(','));
  plinkoTotal += round.payoutCents*PLINKO_PATH_WEIGHTS[pathIndex];
}
deep(bins, [1, 8, 28, 56, 70, 56, 28, 8, 1]);
equal(distinctPaths.size, 256);
equal(plinkoTotal, 99176000);
near(plinkoTotal / (PLINKO_DISTRIBUTION.sampleSize*1000), .7);

const upgrades = [];
for (const multiplier of [1.5, 2, 4, 8]) {
  const config = rules('upgrader', multiplier);
  const expectedChance = {1.5: 4666, 2: 3500, 4: 1750, 8: 875}[multiplier];
  equal(config.chance, expectedChance);
  equal(config.chancePercent, expectedChance / 100);
  equal(config.chanceFraction, expectedChance / 10000);
  equal(settle('upgrader', multiplier, 10, 1000, config.chance - 1).won, true);
  equal(settle('upgrader', multiplier, 10, 1000, config.chance).won, false);
  let wins = 0;
  let total = 0;
  for (let ticket = 0; ticket < 10000; ticket++) {
    const round = settle('upgrader', multiplier, 10, 1000, ticket);
    equal(round.won, ticket < expectedChance);
    equal(round.chance, expectedChance);
    equal(round.targetMultiplier, multiplier);
    equal(round.payoutCents, ticket < expectedChance ? 1000 * multiplier : 0);
    wins += Number(round.won);
    total += round.payoutCents;
  }
  equal(wins, expectedChance);
  near(total / 10000000, multiplier === 1.5 ? .6999 : .7);
  upgrades.push({multiplier, chancePercent: config.chancePercent, expectedGrossReturn: total / 10000000});
}
console.log(JSON.stringify({
  status: 'Game math checks passed', checks,
  grossReturns: {
    coinflip: .7, dice: .7,
    rouletteRedBlack: .7, rouletteGreenOrNumber: .7,
    plinko: plinkoTotal / (PLINKO_DISTRIBUTION.sampleSize*1000), upgrader: upgrades
  },
  plinkoBins: bins
}, null, 2));
