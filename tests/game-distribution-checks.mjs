import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import GameMath, { GAME_DEMO_RULES, SELECTED_BET_VARIANT, ROULETTE_NUMBERS,
  ROULETTE_RED_NUMBERS, DIE_TOP_ROTATIONS, PLINKO_MULTIPLIERS, rouletteColor,
  GameMathError, PLINKO_DISTRIBUTION, PLINKO_PATH_WEIGHTS, PLINKO_PATH_TICKET_STARTS } from '../src/game-math.js';
import OldMath, { DIE_TOP_ROTATIONS as OldDiceRotation } from './fixtures/game-math-v8.js';
import V9Math,{SELECTED_BET_VARIANT as V9Variant} from './fixtures/game-math-v9.js';
import { liabilityTerms, maximumSafeStake } from '../src/liability-terms.js';
import { createDemoReserve } from '../src/demo-reserve.js';
let checks = 0, outcomes = 0;
const eq = (a, b) => { assert.deepEqual(a, b); checks++; };
const ok = value => { assert(value); checks++; };
const raises = (fn, code) => { assert.throws(fn, e => e instanceof GameMathError && e.code === code); checks++; };
eq(GAME_DEMO_RULES.version, 'indictus-local-2026-10-09-v10');
ok(Object.isFrozen(SELECTED_BET_VARIANT)); eq(PLINKO_MULTIPLIERS,[29,4,1.5,.3,.2,.3,1.5,4,29]);eq(SELECTED_BET_VARIANT,V9Variant); eq(DIE_TOP_ROTATIONS, OldDiceRotation);
eq(ROULETTE_NUMBERS.length, 37); eq(new Set(ROULETTE_NUMBERS).size, 37); eq(ROULETTE_RED_NUMBERS.length, 18);
const changed = [
  ...['heads', 'tails'].map(choice => ({ game: 'coinflip', choice })),
  ...[1, 2, 3, 4, 5, 6].map(choice => ({ game: 'dice', choice })),
  ...['red', 'black', 'green', ...Array.from({ length: 37 }, (_, i) => i)].map(choice => ({ game: 'roulette', choice }))
];
const exactRows = [];
for (const selection of changed) {
  const rules = GameMath.rules(selection.game, selection.choice);
  let sum = 0n, wins = 0, maximum = 0;
  const physicalCounts = new Map();
  for (let ticket = 0; ticket < rules.sampleSize; ticket++) {
    const round = GameMath.settle(selection.game, selection.choice, 250, 0, ticket);
    outcomes++;
    let physical, visualWin;
    if (selection.game === 'coinflip') {
      physical = round.face; ok(['heads', 'tails'].includes(physical)); visualWin = physical === selection.choice;
    } else if (selection.game === 'dice') {
      physical = round.value; ok(Number.isInteger(physical) && physical >= 1 && physical <= 6);
      eq(round.dieValue, physical); eq(round.dieRotation, DIE_TOP_ROTATIONS[physical]); visualWin = physical === selection.choice;
    } else {
      physical = round.number; ok(Number.isInteger(physical) && physical >= 0 && physical <= 36);
      eq(ROULETTE_NUMBERS[round.pocketIndex], physical); eq(round.color, rouletteColor(physical));
      visualWin = typeof selection.choice === 'number' ? physical === selection.choice : round.color === selection.choice;
    }
    eq(round.won, visualWin); eq(round.payoutCents, visualWin ? 25000 * rules.grossMultiplier : 0);
    ok(Object.isFrozen(round) && Object.isFrozen(round.outcome));
    physicalCounts.set(physical, (physicalCounts.get(physical) ?? 0) + 1);
    wins += Number(round.won); sum += BigInt(round.payoutCents); maximum = Math.max(maximum, round.payoutCents);
  }
  eq(wins, rules.chance);
  // Exact rational proof, independent of floating-point expectedGrossReturn.
  eq(sum * 10n, 25000n * BigInt(rules.sampleSize) * 7n);
  eq(liabilityTerms({ ...selection, stake: 250 }).maxPayoutCents, maximum);
  if (selection.game === 'coinflip') {
    eq(physicalCounts.get(selection.choice), 7); eq(physicalCounts.get(selection.choice === 'heads' ? 'tails' : 'heads'), 13);
  } else if (selection.game === 'dice') {
    for (let face = 1; face <= 6; face++) eq(physicalCounts.get(face), face === selection.choice ? 35 : 53);
  } else {
    const colors = ['red', 'black'].includes(selection.choice);
    for (let number = 0; number < 37; number++) {
      const selected = colors ? rouletteColor(number) === selection.choice : number === (selection.choice === 'green' ? 0 : selection.choice);
      eq(physicalCounts.get(number), colors ? (selected ? 133 : 234) : (selected ? 252 : 353));
    }
  }
  for (const stake of [5, 250]) for (const ticket of [0, rules.chance - 1, rules.chance, rules.sampleSize - 1]) {
    const a = GameMath.settle(selection.game, selection.choice, stake, 0, ticket);
    const b = GameMath.settle(selection.game, selection.choice, stake, 1000000000, ticket);
    eq(a, b); ok(Number.isSafeInteger(a.payoutCents)); eq(a.netCents, a.payoutCents - stake * 100);
  }
  for (const bad of [-1, rules.sampleSize, rules.sampleSize + 1, .5, NaN, Infinity, '0', null, undefined])
    raises(() => GameMath.settle(selection.game, selection.choice, 5, 0, bad), 'TICKET');
  for (const bad of [0, 4, 6, 255, NaN, Infinity, '5', null, undefined])
    raises(() => GameMath.settle(selection.game, selection.choice, bad, 0, 0), 'STAKE');
  exactRows.push({ ...selection, sampleSize: rules.sampleSize, winningTickets: wins,
    chanceFraction: rules.chanceFraction, totalMultiplier: rules.grossMultiplier,
    grossReturnNumerator: Number(sum), grossReturnDenominator: 25000 * rules.sampleSize,
    exactGrossReturn: .7, maximumPayoutAt250AR: maximum / 100,
    physicalOutcomeTickets: Object.fromEntries(physicalCounts) });
}

// Full preservation of unchanged ticket maps, outcomes, paths, payouts and odds.
for (const [game, choice] of [...[1.5, 2, 4, 8].map(choice => ['upgrader', choice])]) {
  const rules = GameMath.rules(game, choice); eq(rules, OldMath.rules(game, choice));
  for (let ticket = 0; ticket < rules.sampleSize; ticket++) eq(GameMath.settle(game, choice, 250, 0, ticket), OldMath.settle(game, choice, 250, 0, ticket));
}
// All 52 non-Plinko v9 options preserve their complete deterministic contracts.
for(const selection of [...changed,...[1.5,2,4,8].map(choice=>({game:'upgrader',choice}))]) {
 const current=GameMath.rules(selection.game,selection.choice),previous=V9Math.rules(selection.game,selection.choice);eq(current,previous);
 for(let ticket=0;ticket<current.sampleSize;ticket++)eq(GameMath.settle(selection.game,selection.choice,250,0,ticket),V9Math.settle(selection.game,selection.choice,250,0,ticket));
}
// Independently enumerate every weighted RNG ticket and reconstruct all eight
// path bits. Cumulative ranges assign physical paths; mirrored ticket ranges
// always give the opposite real path with the same payout, with no fake bins.
eq(PLINKO_DISTRIBUTION.sampleSize,141680);eq(PLINKO_PATH_WEIGHTS.length,256);eq(PLINKO_PATH_TICKET_STARTS.length,257);
eq(PLINKO_PATH_TICKET_STARTS[0],0);eq(PLINKO_PATH_TICKET_STARTS[256],141680);
const pathCounts=Array(256).fill(0),binCounts=Array(9).fill(0),rates=[2900,400,150,30,20,30,150,400,2900];
let weightedSum=0n,uniformSum=0,expectedPath=0,rangeEnd=350;
for(let path=0;path<256;path++) {
 const rights=path.toString(2).replaceAll('0','').length,weight=rights===4?1094:350;
 eq(PLINKO_PATH_WEIGHTS[path],weight);eq(PLINKO_PATH_TICKET_STARTS[path+1]-PLINKO_PATH_TICKET_STARTS[path],weight);uniformSum+=rates[rights];
}
eq(uniformSum,25360);eq(uniformSum/25600,317/320);
for(let ticket=0;ticket<141680;ticket++) {
 while(ticket>=rangeEnd){expectedPath++;rangeEnd+=PLINKO_PATH_WEIGHTS[expectedPath];}
 const round=GameMath.settle('plinko','standard',250,0,ticket),rights=expectedPath.toString(2).replaceAll('0','').length;
 eq(round.pathIndex,expectedPath);eq(round.ticket,ticket);eq(round.bin,rights);eq(round.multiplier,PLINKO_MULTIPLIERS[rights]);eq(round.payoutCents,25000*rates[rights]/100);
 eq(round.steps,Array.from({length:8},(_,row)=>expectedPath>>(7-row)&1?1:-1));
 let position=0;eq(round.path[0],0);for(let row=0;row<8;row++){position+=round.steps[row];eq(round.path[row+1],position);}
 eq(round.path[8],2*rights-8);eq(round.won,rates[rights]>100);ok(Object.isFrozen(round)&&Object.isFrozen(round.path)&&Object.isFrozen(round.steps));
 const mirror=GameMath.settle('plinko','standard',250,0,141679-ticket);eq(mirror.pathIndex,255-expectedPath);eq(mirror.bin,8-rights);eq(mirror.payoutCents,round.payoutCents);
 if(ticket===PLINKO_PATH_TICKET_STARTS[expectedPath])eq(mirror.path,round.path.map(value=>value===0?0:-value));
 pathCounts[expectedPath]++;binCounts[rights]++;weightedSum+=BigInt(round.payoutCents);
}
eq(pathCounts,PLINKO_PATH_WEIGHTS);eq(binCounts,[350,2800,9800,19600,76580,19600,9800,2800,350]);eq(binCounts,PLINKO_DISTRIBUTION.binTicketCounts);
eq(weightedSum*10n,25000n*141680n*7n);eq(binCounts[0]/141680,5/2024);eq(binCounts[8],binCounts[0]);
for(const choice of ['standard','normal'])for(const stake of [5,250])for(const ticket of [0,349,350,141679]) {
 eq(GameMath.settle('plinko',choice,stake,0,ticket),GameMath.settle('plinko',choice,stake,Number.MAX_SAFE_INTEGER,ticket));
}
eq(liabilityTerms({game:'plinko',choice:'standard',stake:250}).maxPayoutCents,725000);eq(liabilityTerms({game:'plinko',choice:'standard',stake:250}).maxHouseLossCents,700000);
const plinkoBook=createDemoReserve();ok(plinkoBook.reserve({roundId:'plinko-1',game:'plinko',choice:'standard',stake:250}));
eq(plinkoBook.reserve({roundId:'plinko-2',game:'plinko',choice:'standard',stake:250}),null);eq(plinkoBook.maximumSafeStake({game:'plinko',choice:'standard'}),105);
plinkoBook.settle('plinko-1',725000);eq(plinkoBook.snapshot().bankCents,300000);eq(plinkoBook.maximumSafeStake({game:'plinko',choice:'standard'}),105);
for (const [game, choice] of [['coinflip', 'mask'], ['dice', 0], ['dice', 7], ['roulette', 37], ['roulette', '17'], ['roulette', 'blue']]) raises(() => GameMath.rules(game, choice), 'CHOICE');
raises(() => GameMath.rules('slots', null), 'GAME');

const expectedRisks = [['coinflip', 'heads', 50000, 25000], ['dice', 1, 150000, 125000], ['roulette', 'red', 50000, 25000], ['roulette', 0, 900000, 875000]];
for (const [game, choice, payout, liability] of expectedRisks) {
  const terms = liabilityTerms({ game, choice, stake: 250 }); eq(terms.maxPayoutCents, payout); eq(terms.maxHouseLossCents, liability);
  const book = createDemoReserve(); let admitted = 0;
  for (let i = 0; i < 100; i++) if (book.reserve({ roundId: i + 1, game, choice, stake: 250 })) admitted++;
  eq(admitted, Math.floor(1000000 / liability));
  for (let i = admitted; i > 0; i--) book.settle(i, payout);
  eq(book.snapshot().bankCents, 1000000 - admitted * liability);
}
const rouletteReserve = createDemoReserve();
ok(rouletteReserve.reserve({ roundId: 1, game: 'roulette', choice: 0, stake: 250 })); rouletteReserve.settle(1, 900000);
eq(rouletteReserve.snapshot().bankCents, 125000); eq(rouletteReserve.maximumSafeStake({ game: 'roulette', choice: 0 }), 35);
ok(rouletteReserve.reserve({ roundId: 2, game: 'roulette', choice: 0, stake: 35 })); rouletteReserve.settle(2, 126000);
eq(rouletteReserve.snapshot().bankCents, 2500); eq(maximumSafeStake({ game: 'roulette', choice: 0 }, 2500), 0);

console.log(JSON.stringify({passed:true,checks,outcomes,exactRows:exactRows.length,version:GAME_DEMO_RULES.version}));
