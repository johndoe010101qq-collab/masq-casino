// Public fixed-weight DEMO clone of native SHA-256 6868ec7dc51da9aba0a8c8a37f5ee9bb6b2267cab7e14940b62c5ea8270b0d96.
// Only symbol/bomb selection reads the immutable probabilityWeights option.
import { BONANZA_STAKE_LIMITS } from './stake-limits.js';
// Bonanza-style mechanics with original Indictus DEMO math.
// Original demo math. Shared natural and purchased bonus tables target approximately 50% return.
// Monte Carlo estimates do not establish an exact theoretical RTP.
export const BONANZA_SYMBOLS = Object.freeze([
  'hood', 'suit', 'glove', 'laptop', 'usb', 'lock', 'key', 'radio', 'flag'
]);

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

const SHARED_FREE_PAYS = freeze({"hood":[239,317,423],"suit":[228,304,405],"glove":[218,290,386],"laptop":[207,276,368],"usb":[196,262,350],"lock":[185,248,331],"key":[175,235,313],"radio":[164,221,294],"flag":[153,207,276]});
const SHARED_FREE_SCATTER_PAYS = freeze([307,460,613]);

export const BONANZA_DEMO_RULES = freeze({
  version: 'indictus-demo-2026-10-09-v11',
  columns: 6, rows: 5, matchCount: 8,
  payTiers: [8, 10, 12],
  // Integer percent of the BASE stake: 8–9, 10–11, 12+ symbols.
  pays: {"hood":[474,1172,4715],"suit":[383,948,2832],"glove":[330,751,2357],"laptop":[276,658,1883],"usb":[238,566,1646],"lock":[185,474,1409],"key":[145,383,1172],"radio":[119,276,948],"flag":[93,238,712]},
  // One common free-spin table, independent of the way the bonus was entered.
  freePays: SHARED_FREE_PAYS,
  // Higher-paying symbols have lower, individually disclosed cell weights.
  baseWeights: [
    ['hood', 80], ['suit', 85], ['glove', 90], ['laptop', 95],
    ['usb', 100], ['lock', 105], ['key', 110], ['radio', 115],
    ['flag', 120], ['scatter', 20]
  ],
  // Bonus symbol distribution and paytable are disclosed separately.
  // The purchase price never multiplies the base stake used in the paytable.
  freeWeights: [["hood",45],["suit",49],["glove",53],["laptop",57],["usb",61],["lock",150],["key",156],["radio",162],["flag",168],["scatter",1],["bomb",3]],
  bombWeights: [[2,9000],[3,700],[4,80],[5,40],[6,20],[8,8],[10,3],[12,1],[15,1],[20,1],[25,1]],
  scatterPays: [948,1883,9430],
  freeScatterPays: SHARED_FREE_SCATTER_PAYS,
  // Compatibility aliases refer to the exact same frozen objects.
  boughtFreePays: SHARED_FREE_PAYS,
  boughtFreeScatterPays: SHARED_FREE_SCATTER_PAYS,
  boughtMathNotice: "Купленный бонус стоит ×50 базовой ставки. Естественный и купленный бонусы используют одинаковые открытые таблицы и веса. Частые небольшие совпадения составляют основу бонуса; редкие жетоны ×2–×25 суммируются в пределах вращения. Вся выплата раунда ограничена 100 базовыми ставками минус 1 АР. Все начисленные вращения, включая ретриггеры, доигрываются; после исчерпания лимита дополнительная денежная выплата равна нулю. Ориентир возврата около 50% оценивается симуляцией; точный RTP и прибыль не гарантируются. Результат не зависит от баланса, истории или игрока.",
  bonusBuyMultiplier: 50,
  initialFreeSpins: 10,
  retriggerFreeSpins: 5,
  winCapMultiplier: 100,
  winCapOffsetCents: 100,
  minimumUserStake: BONANZA_STAKE_LIMITS.min,
  maximumUserStake: BONANZA_STAKE_LIMITS.max,
  userStakeStep: BONANZA_STAKE_LIMITS.step,
  rtp: null,
  mathNotice: "Собственная демо-математика. Все символы имеют индивидуальные открытые веса и выплаты. Бонус чаще даёт небольшие совпадения, чем редкие крупные выплаты; жетоны ×2–×25 имеют отдельные открытые веса. Естественный и купленный бонусы используют одинаковые таблицы. Вся выплата раунда ограничена 100 базовыми ставками минус 1 АР. Все начисленные вращения, включая ретриггеры, доигрываются; после исчерпания лимита дополнительная денежная выплата равна нулю. Ориентир возврата около 50% оценивается симуляцией, не является точным теоретическим RTP или гарантией прибыли. Результат не зависит от баланса, истории или игрока."
});

const MAX_STAKE_CENTS = 100000000;
const MAX_GUARD = 1000;

export class BonanzaLimitError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BonanzaLimitError';
    this.code = code;
  }
}

function integer(value, name, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(name + ' must be an integer from ' + minimum + ' to ' + maximum);
  }
  return value;
}

function draw(context, maximum) {
  const value = context.randomInt(maximum);
  return integer(value, 'randomInt(' + maximum + ')', 0, maximum - 1);
}

function pick(context, entries) {
  const sum = entries.reduce((total, entry) => total + entry[1], 0);
  let value = draw(context, sum);
  for (const [item, weight] of entries) {
    if (value < weight) return item;
    value -= weight;
  }
  throw new Error('Invalid weights');
}

function cell(context, kind, bombValue) {
  if (!BONANZA_SYMBOLS.includes(kind) && kind !== 'scatter' && kind !== 'bomb') {
    throw new TypeError('Unknown symbol: ' + kind);
  }
  if (kind === 'bomb') integer(bombValue, 'bomb multiplier', 2, 100);
  const created = { id: 'b' + context.nextId++, kind };
  if (kind === 'bomb') created.value = bombValue;
  return Object.freeze(created);
}

function randomCell(context, freeSpin) {
  const kind = pick(context, freeSpin
    ? context.probabilityWeights.freeWeights : context.probabilityWeights.baseWeights);
  return cell(context, kind, kind === 'bomb'
    ? pick(context, context.probabilityWeights.bombWeights) : undefined);
}

function grid(context, freeSpin, initial) {
  if (initial !== undefined) {
    if (!Array.isArray(initial) || initial.length !== 6
      || initial.some(column => !Array.isArray(column) || column.length !== 5)) {
      throw new TypeError('initialGrid must contain 6 columns with 5 cells each');
    }
    return freeze(initial.map(column => column.map(description => {
      const kind = typeof description === 'string' ? description : description?.kind;
      if (!freeSpin && kind === 'bomb') {
        throw new TypeError('Multiplier bombs appear only in free spins');
      }
      return cell(context, kind, description?.value);
    })));
  }
  return freeze(Array.from({ length: 6 }, () =>
    Array.from({ length: 5 }, () => randomCell(context, freeSpin))));
}

function findWins(before, stakeCents, freeSpin) {
  const groups = new Map(BONANZA_SYMBOLS.map(kind => [kind, []]));
  before.forEach((column, columnIndex) => column.forEach((item, row) => {
    groups.get(item.kind)?.push({ id: item.id, column: columnIndex, row });
  }));
  const wins = [];
  for (const [kind, cells] of groups) {
    const count = cells.length;
    if (count < 8) continue;
    const tier = count >= 12 ? 2 : count >= 10 ? 1 : 0;
    const table = freeSpin
      ? BONANZA_DEMO_RULES.freePays
      : BONANZA_DEMO_RULES.pays;
    const ratePercent = table[kind][tier];
    wins.push({
      kind, count, ratePercent, cells,
      payoutCents: Number(BigInt(stakeCents) * BigInt(ratePercent) / 100n)
    });
  }
  return freeze(wins);
}

function scatterRate(count, freeSpin) {
  const pays = freeSpin
    ? BONANZA_DEMO_RULES.freeScatterPays
    : BONANZA_DEMO_RULES.scatterPays;
  return count >= 6 ? pays[2] : count === 5 ? pays[1] : count === 4 ? pays[0] : 0;
}

function spin(context, {
  stakeCents, freeSpin, initialGrid, maxTumbles, capCents
}) {
  let before = grid(context, freeSpin, initialGrid);
  const initial = before;
  const frames = [];
  const seenBombs = new Set();
  let bombSum = 0;
  let symbolTotal = 0;
  let tumbles = 0;

  for (;;) {
    const newBombs = [];
    if (freeSpin) {
      before.forEach((column, columnIndex) => column.forEach((item, row) => {
        if (item.kind !== 'bomb' || seenBombs.has(item.id)) return;
        seenBombs.add(item.id);
        bombSum += item.value;
        newBombs.push({ id: item.id, value: item.value, column: columnIndex, row });
      }));
    }
    const wins = findWins(before, stakeCents, freeSpin);
    if (wins.length && tumbles >= maxTumbles) {
      throw new BonanzaLimitError('TUMBLE_LIMIT',
        'The tumble limit was reached; this round must not be settled.');
    }
    const removedIds = new Set(wins.flatMap(win => win.cells.map(item => item.id)));
    const removed = [];
    const refill = [];
    const payoutCents = wins.reduce((sum, win) => sum + win.payoutCents, 0);
    symbolTotal += payoutCents;
    const afterRemoval = before.map((column, columnIndex) => column.map((item, row) => {
      if (!removedIds.has(item.id)) return item;
      removed.push({ id: item.id, kind: item.kind, column: columnIndex, row });
      return null;
    }));
    let after = before;
    if (wins.length) {
      after = freeze(afterRemoval.map((column, columnIndex) => {
        // Row 0 is the top. Survivors keep their relative order at the bottom.
        const survivors = column.filter(Boolean);
        const missing = 5 - survivors.length;
        const fresh = Array.from({ length: missing }, (_, row) => {
          const item = randomCell(context, freeSpin);
          refill.push({ column: columnIndex, row, cell: item });
          return item;
        });
        return fresh.concat(survivors);
      }));
      tumbles++;
    }
    frames.push(freeze({
      index: frames.length,
      terminal: wins.length === 0,
      before, wins, removed, afterRemoval, refill, after,
      // These frame amounts are symbol wins BEFORE the final bomb multiplier.
      payoutCents,
      cumulativeSymbolWinCents: symbolTotal,
      multiplier: {
        newBombs, seenIds: [...seenBombs], sum: bombSum,
        active: symbolTotal > 0 && bombSum > 0,
        factor: symbolTotal > 0 && bombSum > 0 ? bombSum : 1
      }
    }));
    if (!wins.length) break;
    before = after;
  }

  const terminal = before;
  const scatters = [];
  terminal.forEach((column, columnIndex) => column.forEach((item, row) => {
    if (item.kind === 'scatter') scatters.push({ id: item.id, column: columnIndex, row });
  }));
  const scatterRatePercent = scatterRate(scatters.length, freeSpin);
  const scatterWinCents = Number(BigInt(stakeCents) * BigInt(scatterRatePercent) / 100n);
  const appliedMultiplier = freeSpin && symbolTotal > 0 && bombSum > 0 ? bombSum : 1;
  // BigInt prevents overflow before the explicit demo cap is applied.
  const uncapped = BigInt(symbolTotal) * BigInt(appliedMultiplier) + BigInt(scatterWinCents);
  const cap = BigInt(capCents);
  const capped = uncapped > cap;
  const payoutCents = Number(capped ? cap : uncapped);
  const freeSpinsAwarded = freeSpin
    ? (scatters.length >= 3 ? BONANZA_DEMO_RULES.retriggerFreeSpins : 0)
    : (scatters.length >= 4 ? BONANZA_DEMO_RULES.initialFreeSpins : 0);

  // Separate nominal table amounts from actually credited money. Base cascade
  // credits are allocated first, then the genuine final multiplier uplift,
  // then scatter money. Every credited amount fits the remaining round budget.
  // Continuing spins after the budget is exhausted still use the same RNG,
  // cascades, multiplier and retrigger rules, but credit zero money.
  let remainingCredit = payoutCents;
  let creditedSymbolWinCents = 0;
  const creditedFrames = frames.map(frame => {
    const creditedWins = frame.wins.map(win => {
      const creditedPayoutCents = Math.min(remainingCredit, win.payoutCents);
      remainingCredit -= creditedPayoutCents;
      return { ...win, creditedPayoutCents };
    });
    const creditedPayoutCents = creditedWins.reduce((sum, win) => sum + win.creditedPayoutCents, 0);
    creditedSymbolWinCents += creditedPayoutCents;
    return { ...frame, wins: creditedWins, creditedPayoutCents,
      cumulativeCreditedSymbolWinCents: creditedSymbolWinCents };
  });
  const multiplierUplift = BigInt(symbolTotal) * BigInt(appliedMultiplier - 1);
  const creditedMultiplierWinCents = Number(multiplierUplift > BigInt(remainingCredit)
    ? BigInt(remainingCredit) : multiplierUplift);
  remainingCredit -= creditedMultiplierWinCents;
  const creditedScatterWinCents = Math.min(remainingCredit, scatterWinCents);
  remainingCredit -= creditedScatterWinCents;
  if (remainingCredit !== 0) throw new Error('Invalid Bonanza credit allocation');

  return freeze({
    freeSpin, chargeCents: freeSpin ? 0 : stakeCents,
    stakeCents, initial, terminal, frames: creditedFrames, tumbles,
    symbolWinCents: symbolTotal, creditedSymbolWinCents,
    creditedMultiplierWinCents, creditedScatterWinCents,
    scatter: { count: scatters.length, cells: scatters,
      ratePercent: scatterRatePercent, payoutCents: scatterWinCents,
      creditedPayoutCents: creditedScatterWinCents },
    multiplier: { sum: bombSum, applied: appliedMultiplier,
      active: freeSpin && symbolTotal > 0 && bombSum > 0,
      cellIds: [...seenBombs] },
    // Decimal string remains exact even for pathological deterministic RNGs.
    uncappedPayoutCents: uncapped.toString(),
    payoutCents, capped, capCents, freeSpinsAwarded,
    nextCellId: context.nextId
  });
}

function probabilityWeights(input) {
  const source = input ?? BONANZA_DEMO_RULES;
  const result = {};
  for (const [name, allowed] of [
    ['baseWeights', [...BONANZA_SYMBOLS, 'scatter']],
    ['freeWeights', [...BONANZA_SYMBOLS, 'scatter', 'bomb']],
    ['bombWeights', BONANZA_DEMO_RULES.bombWeights.map(([value]) => value)]
  ]) {
    const entries = source[name];
    if (!Array.isArray(entries) || entries.length !== allowed.length) throw new TypeError('Invalid ' + name);
    let sum = 0;
    result[name] = entries.map(([item, weight], index) => {
      if (item !== allowed[index]) throw new TypeError('Invalid ' + name + ' order');
      sum += integer(weight, name + ' weight', 1, 0x100000000);
      return [item, weight];
    });
    integer(sum, name + ' total', 1, 0x100000000);
  }
  return freeze(result);
}

function options(input) {
  const stakeCents = integer(input.stakeCents, 'stakeCents', 1, MAX_STAKE_CENTS);
  if (typeof input.randomInt !== 'function') {
    throw new TypeError('Supply unbiased randomInt(max); the engine does not call Math.random.');
  }
  const maxTumbles = integer(input.maxTumbles ?? 100, 'maxTumbles', 1, MAX_GUARD);
  const maxSpins = integer(input.maxSpins ?? 1000, 'maxSpins', 1, MAX_GUARD);
  const defaultCap = Math.max(0, stakeCents * BONANZA_DEMO_RULES.winCapMultiplier
    - BONANZA_DEMO_RULES.winCapOffsetCents);
  const capCents = integer(input.capCents ?? defaultCap, 'capCents', 0, defaultCap);
  const idStart = integer(input.idStart ?? 0, 'idStart', 0, Number.MAX_SAFE_INTEGER - 100000000);
  return { stakeCents, maxTumbles, maxSpins, capCents, idStart, probabilityWeights: probabilityWeights(input.probabilityWeights) };
}

// One spin, useful for inspecting animation frames. No balance is mutated.
// Initial descriptors are optional deterministic fixtures, not existing cell objects.
export function simulateBonanzaSpin(input) {
  const checked = options(input);
  const context = { randomInt: input.randomInt, nextId: checked.idStart, probabilityWeights: checked.probabilityWeights };
  return spin(context, {
    ...checked, freeSpin: Boolean(input.freeSpin), initialGrid: input.initialGrid
  });
}

// Paid round: one charged base spin, followed by awarded/retriggered free spins.
// Buy: ten initial free spins, charged once at the disclosed purchase multiplier.
// Preview: ten initial free spins and an explicitly zero ledger.
// Pure and transactional: if a guard throws, no partial ledger is returned.
export function playBonanzaRound(input) {
  const checked = options(input);
  const mode = input.mode ?? 'paid';
  if (!['paid', 'buy', 'preview'].includes(mode)) {
    throw new TypeError('mode must be paid, buy or preview');
  }
  if (input.preview && mode !== 'preview') {
    throw new TypeError('A preview cannot also be a paid or bought round.');
  }
  const preview = mode === 'preview';
  const bonusBought = mode === 'buy';
  const startsInBonus = preview || bonusBought;
  // Free-spin payout rules do not depend on paid, bought or preview entry.
  const chargeCents = preview ? 0 : checked.stakeCents
    * (bonusBought ? BONANZA_DEMO_RULES.bonusBuyMultiplier : 1);
  const context = { randomInt: input.randomInt, nextId: checked.idStart, probabilityWeights: checked.probabilityWeights };
  const spins = [];
  let pending = startsInBonus ? BONANZA_DEMO_RULES.initialFreeSpins : 0;
  let payoutCents = 0;
  let freeSpinsPlayed = 0;
  let freeSpinsAwarded = pending;
  let capReached = false;

  function next(freeSpin, initialGrid) {
    if (spins.length >= checked.maxSpins) {
      throw new BonanzaLimitError('SPIN_LIMIT',
        'The spin limit was reached; this round must not be settled.');
    }
    const settled = spin(context, {
      ...checked, capCents: checked.capCents - payoutCents, freeSpin, initialGrid
    });
    spins.push(freeze({ ...settled, index: spins.length }));
    payoutCents += settled.payoutCents;
    pending += settled.freeSpinsAwarded;
    freeSpinsAwarded += settled.freeSpinsAwarded;
    capReached = payoutCents >= checked.capCents;
  }

  if (!startsInBonus) next(false, input.initialGrid);
  let firstBonusSpin = startsInBonus;
  while (pending > 0) {
    pending--;
    next(true, firstBonusSpin ? input.initialGrid : undefined);
    firstBonusSpin = false;
    freeSpinsPlayed++;
  }

  return freeze({
    mode, preview, bonusBought, chargeCents,
    stakeCents: checked.stakeCents, spins,
    payoutCents,
    freeSpinsPlayed, freeSpinsAwarded,
    unplayedFreeSpins: pending,
    capCents: checked.capCents, capReached,
    stopReason: 'complete',
    nextCellId: context.nextId,
    ledger: preview
      ? { chargeCents: 0, creditCents: 0, deltaCents: 0 }
      : { chargeCents, creditCents: payoutCents,
          deltaCents: payoutCents - chargeCents },
    mathNotice: bonusBought ? BONANZA_DEMO_RULES.boughtMathNotice : BONANZA_DEMO_RULES.mathNotice
  });
}

// Browser entropy source, with rejection sampling (no modulo bias).
export function createCryptoRandomInt(cryptoSource = globalThis.crypto) {
  if (typeof cryptoSource?.getRandomValues !== 'function') {
    throw new Error('A Web Crypto getRandomValues implementation is required.');
  }
  const buffer = new Uint32Array(1);
  return maximum => {
    integer(maximum, 'maximum', 1, 0x100000000);
    const cutoff = Math.floor(0x100000000 / maximum) * maximum;
    let value;
    do {
      cryptoSource.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= cutoff);
    return value % maximum;
  };
}


// Site-facing API. A preview is display-only; the site must not settle it.
export function simulateBonanzaRound(stakeCents, {
  randomInt,
  preview = false,
  mode,
  maxTumbles = 100,
  maxSpins = 200,
  winCapMultiplier = BONANZA_DEMO_RULES.winCapMultiplier,
  initialGrid,
  idStart = 0,
  probabilityWeights
} = {}) {
  integer(winCapMultiplier, 'winCapMultiplier', 1, BONANZA_DEMO_RULES.winCapMultiplier);
  const roundMode = mode ?? (preview ? 'preview' : 'paid');
  if (preview && roundMode !== 'preview') {
    throw new TypeError('A preview cannot also be a paid or bought round.');
  }
  const result = playBonanzaRound({
    stakeCents, randomInt, mode: roundMode,
    maxTumbles, maxSpins, capCents: Math.max(0, stakeCents * winCapMultiplier
      - BONANZA_DEMO_RULES.winCapOffsetCents),
    initialGrid, idStart, probabilityWeights
  });
  return freeze({
    mode: result.mode,
    preview: result.preview,
    bonusBought: result.bonusBought,
    chargeCents: result.chargeCents,
    ledger: result.ledger,
    payoutCents: result.payoutCents,
    bonusTriggered: !result.preview && (result.bonusBought
      || result.spins[0].freeSpinsAwarded > 0),
    spins: result.spins.map(item => ({
      index: item.index,
      isFreeSpin: item.freeSpin,
      initial: item.initial,
      terminal: item.terminal,
      frames: item.frames,
      payoutCents: item.payoutCents,
      symbolWinCents: item.symbolWinCents,
      creditedSymbolWinCents: item.creditedSymbolWinCents,
      creditedMultiplierWinCents: item.creditedMultiplierWinCents,
      creditedScatterWinCents: item.creditedScatterWinCents,
      scatterWinCents: item.scatter.payoutCents,
      multiplier: item.multiplier.applied,
      multiplierDetails: item.multiplier,
      scatterCount: item.scatter.count,
      awardedSpins: item.freeSpinsAwarded,
      capped: item.capped,
      uncappedPayoutCents: item.uncappedPayoutCents
    })),
    capped: result.capReached,
    winCapCents: result.capCents,
    freeSpinsPlayed: result.freeSpinsPlayed,
    freeSpinsAwarded: result.freeSpinsAwarded,
    unplayedFreeSpins: result.unplayedFreeSpins,
    stopReason: result.stopReason,
    nextCellId: result.nextCellId,
    rtp: null,
    mathNotice: result.mathNotice
  });
}
