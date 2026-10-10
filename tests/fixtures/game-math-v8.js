import { STANDARD_STAKE_LIMITS, permittedStake } from '../../src/stake-limits.js';
// Indictus Originals: transparent, deterministic DEMO rules.
// settle() never draws random values or changes a balance.
// The caller supplies an unbiased integer ticket after validating rules().
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export const ROULETTE_NUMBERS = freeze([
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8,
  23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12,
  35, 3, 26
]);
export const ROULETTE_RED_NUMBERS = freeze([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
]);
const redNumbers = new Set(ROULETTE_RED_NUMBERS);

// Eight independent left/right steps: each of the 256 paths is equiprobable.
// Binomial counts are [1,8,28,56,70,56,28,8,1]. These publicly displayed
// cent-exact payouts produce expected gross return 17920 / 25600 = .70.
export const PLINKO_MULTIPLIERS = freeze([6.86, 2.8, 1.1, .44, .14, .44, 1.1, 2.8, 6.86]);
const plinkoRatePercent = freeze([686, 280, 110, 44, 14, 44, 110, 280, 686]);

// Coordinates of numbered die faces before rotation. Opposite faces add to 7.
export const DIE_FACE_NORMALS = freeze({
  1: [0, 1, 0], 6: [0, -1, 0], 2: [0, 0, 1],
  5: [0, 0, -1], 3: [1, 0, 0], 4: [-1, 0, 0]
});
export const DIE_TOP_ROTATIONS = freeze({
  1: [0, 0, 0], 2: [-Math.PI / 2, 0, 0], 3: [0, 0, Math.PI / 2],
  4: [0, 0, -Math.PI / 2], 5: [Math.PI / 2, 0, 0], 6: [Math.PI, 0, 0]
});
export const GAME_DEMO_RULES = freeze({
  version: 'indictus-local-2026-10-08-v8',
  minimumStake: STANDARD_STAKE_LIMITS.min,
  maximumStake: STANDARD_STAKE_LIMITS.max,
  stakeStep: STANDARD_STAKE_LIMITS.step,
  currency: 'АР',
  initialDemoBalance: 1000,
  coinflip: { sampleSize: 2, grossMultiplier: 1.4, expectedGrossReturn: .7 },
  dice: { sampleSize: 6, grossMultiplier: 4.2, expectedGrossReturn: .7 },
  roulette: {
    sampleSize: 37, colorGrossMultiplier: 1.44, numberGrossMultiplier: 25.9,
    colorExpectedGrossReturn: 18 * 1.44 / 37,
    numberExpectedGrossReturn: .7
  },
  plinko: { sampleSize: 256, multipliers: PLINKO_MULTIPLIERS, expectedGrossReturn: .7 },
  upgrader: { sampleSize: 10000, targetGrossReturn: .7, multipliers: [1.5, 2, 4, 8] },
  notice: 'Демо-фишки. Собственные открытые правила; результаты не зависят от баланса или истории.'
});

export class GameMathError extends RangeError {
  constructor(code, message) {
    super(message);
    this.name = 'GameMathError';
    this.code = code;
  }
}
function fail(code, message) { throw new GameMathError(code, message); }

export function rouletteColor(number) {
  if (!Number.isInteger(number) || number < 0 || number > 36) {
    fail('NUMBER', 'Номер рулетки должен быть от 0 до 36.');
  }
  return number === 0 ? 'green' : redNumbers.has(number) ? 'red' : 'black';
}

function validStake(stake) {
  if (!permittedStake(stake)) {
    fail('STAKE', 'Ставка — от 5 до 250 АР с шагом 5.');
  }
  return stake * 100;
}
function validTicket(ticket, sampleSize) {
  if (!Number.isSafeInteger(ticket) || ticket < 0 || ticket >= sampleSize) {
    fail('TICKET', 'Некорректный билет результата.');
  }
}
function grossCents(stakeCents, ratePercent) {
  // All permitted stakes are integer multiples of 500 cents. Exact integer
  // rates therefore yield exact whole-cent amounts; no repeated float rounding.
  return Number(BigInt(stakeCents) * BigInt(ratePercent) / 100n);
}

export function rules(game, choice) {
  switch (game) {
    case 'coinflip': {
      if (choice !== 'heads' && choice !== 'tails') {
        fail('CHOICE', 'Выберите маску или знак I.');
      }
      return freeze({
        game, choice, sampleSize: 2, chance: 1, chanceFraction: .5,
        grossMultiplier: 1.4, expectedGrossReturn: .7
      });
    }
    case 'dice': {
      if (!Number.isInteger(choice) || choice < 1 || choice > 6) {
        fail('CHOICE', 'Выберите грань от 1 до 6.');
      }
      return freeze({
        game, choice, sampleSize: 6, chance: 1, chanceFraction: 1 / 6,
        grossMultiplier: 4.2, expectedGrossReturn: .7
      });
    }
    case 'roulette': {
      const numberChoice = Number.isInteger(choice) && choice >= 0 && choice <= 36;
      if (!numberChoice && !['red', 'black', 'green'].includes(choice)) {
        fail('CHOICE', 'Выберите цвет или номер от 0 до 36.');
      }
      const colorChoice = choice === 'red' || choice === 'black';
      const chance = colorChoice ? 18 : 1;
      const grossMultiplier = colorChoice ? 1.44 : 25.9;
      return freeze({
        game, choice, sampleSize: 37, chance, chanceFraction: chance / 37,
        grossMultiplier, expectedGrossReturn: chance * grossMultiplier / 37
      });
    }
    case 'plinko': {
      if (choice !== 'standard' && choice !== 'normal') {
        fail('CHOICE', 'Доступен стандартный режим Plinko.');
      }
      return freeze({
        game, choice, sampleSize: 256, rows: 8, multipliers: PLINKO_MULTIPLIERS,
        expectedGrossReturn: .7
      });
    }
    case 'upgrader': {
      if (!GAME_DEMO_RULES.upgrader.multipliers.includes(choice)) {
        fail('CHOICE', 'Выберите множитель 1.5, 2, 4 или 8.');
      }
      const chance = Math.floor(GAME_DEMO_RULES.upgrader.targetGrossReturn / choice * 10000);
      return freeze({
        game, choice, sampleSize: 10000, chance,
        chanceFraction: chance / 10000, chancePercent: chance / 100,
        grossMultiplier: choice, expectedGrossReturn: chance * choice / 10000
      });
    }
    default:
      fail('GAME', 'Неизвестная игра.');
  }
}

export function settle(game, choice, stake, openingBalance, ticket) {
  const config = rules(game, choice);
  const stakeCents = validStake(stake);
  validTicket(ticket, config.sampleSize);
  // openingBalance is retained only for the HallSession calling convention.
  // It never changes the distribution, ticket, payout, or outcome.
  void openingBalance;
  let outcome;
  let payoutCents = 0;
  switch (game) {
    case 'coinflip': {
      const face = ticket === 0 ? 'heads' : 'tails';
      const won = face === choice;
      payoutCents = won ? grossCents(stakeCents, 140) : 0;
      outcome = {
        face, won, label: face === 'heads' ? 'Маска' : 'Знак I',
        multiplier: won ? 1.4 : 0
      };
      break;
    }
    case 'dice': {
      const value = ticket + 1;
      const won = value === choice;
      payoutCents = won ? grossCents(stakeCents, 420) : 0;
      outcome = {
        value, dieValue: value, dieRotation: DIE_TOP_ROTATIONS[value], won,
        label: 'Грань ' + value, multiplier: won ? 4.2 : 0
      };
      break;
    }
    case 'roulette': {
      const pocketIndex = ticket;
      const number = ROULETTE_NUMBERS[pocketIndex];
      const color = rouletteColor(number);
      const won = typeof choice === 'number' ? number === choice : color === choice;
      payoutCents = won ? grossCents(stakeCents,
        Math.round(config.grossMultiplier * 100)) : 0;
      outcome = {
        number, pocketIndex, color, won,
        label: number + ' · ' + ({red: 'красное', black: 'чёрное', green: 'зелёное'}[color]),
        multiplier: won ? config.grossMultiplier : 0
      };
      break;
    }
    case 'plinko': {
      const steps = Array.from({length: 8}, (_, row) => (ticket >> (7 - row)) & 1 ? 1 : -1);
      const path = [0];
      let bin = 0;
      for (const step of steps) {
        if (step === 1) bin++;
        path.push(path[path.length - 1] + step);
      }
      const multiplier = PLINKO_MULTIPLIERS[bin];
      payoutCents = grossCents(stakeCents, plinkoRatePercent[bin]);
      outcome = {
        steps, path, offsets: path, bin, multiplier,
        won: payoutCents > stakeCents, label: 'Ячейка ' + (bin + 1) + ' · ×' + multiplier
      };
      break;
    }
    case 'upgrader': {
      const won = ticket < config.chance;
      payoutCents = won ? grossCents(stakeCents, Math.round(choice * 100)) : 0;
      outcome = {
        won, chance: config.chance, chanceFraction: config.chanceFraction,
        chancePercent: config.chancePercent, targetMultiplier: choice,
        multiplier: won ? choice : 0,
        label: won ? 'Улучшение ×' + choice : 'Улучшение не выпало'
      };
      break;
    }
  }
  return freeze({
    ...outcome, game, choice, ticket, sampleSize: config.sampleSize, stake, stakeCents,
    payoutCents, payout: payoutCents / 100, netCents: payoutCents - stakeCents,
    net: (payoutCents - stakeCents) / 100, expectedGrossReturn: config.expectedGrossReturn,
    outcome
  });
}

export const GameMath = freeze({rules, settle});
export default GameMath;
