import { STANDARD_STAKE_LIMITS } from './stake-limits.js';
// Disclosed six-deck variant with fixed player/dealer selection tickets.
// Neither money nor presentation clocks live here.
export const BLACKJACK_RULES = Object.freeze({ decks: 6, dealerStandsSoft17: true,
  variant: 'dual-selection-v10', dealerTicketCount: 10000, dealerBoostTickets: 3200,
  playerTicketCount: 10000, playerUnfavorableTickets: 1500,
  minimumStake: STANDARD_STAKE_LIMITS.min, maximumStake: STANDARD_STAKE_LIMITS.max, stakeStep: STANDARD_STAKE_LIMITS.step });
export const BLACKJACK_SUITS = Object.freeze(['clubs', 'diamonds', 'hearts', 'spades']);

export function createBlackjackShoe(randomInt) {
  if (typeof randomInt !== 'function') throw new TypeError('Нужен randomInt для перемешивания.');
  const shoe = [];
  for (let deck = 0; deck < 6; deck++) for (const suit of BLACKJACK_SUITS) for (let rank = 1; rank <= 13; rank++) {
    shoe.push(Object.freeze({ id: `${deck}-${suit}-${rank}`, deck, suit, rank }));
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    if (!Number.isInteger(j) || j < 0 || j > i) throw new RangeError('randomInt вышел за пределы колоды.');
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return Object.freeze(shoe);
}

export function blackjackScore(cards) {
  if (!Array.isArray(cards) || cards.some(card => !validCard(card))) throw new TypeError('Некорректная рука.');
  let total = 0, aces = 0;
  for (const card of cards) { total += card.rank === 1 ? 11 : Math.min(10, card.rank); if (card.rank === 1) aces++; }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return Object.freeze({ total, soft: aces > 0, bust: total > 21, natural: cards.length === 2 && total === 21 });
}

export function compareBlackjackHands(player, dealer) {
  const p = blackjackScore(player), d = blackjackScore(dealer);
  let outcome;
  if (p.bust) outcome = 'lose';
  else if (p.natural && d.natural) outcome = 'push';
  else if (p.natural) outcome = 'blackjack';
  else if (d.natural) outcome = 'lose';
  else if (d.bust || p.total > d.total) outcome = 'win';
  else if (p.total === d.total) outcome = 'push';
  else outcome = 'lose';
  return Object.freeze({ outcome, payoutMultiplier: { blackjack: 2.5, win: 2, push: 1, lose: 0 }[outcome],
    title: { blackjack: 'Blackjack · 3:2', win: 'Победа', push: 'Ничья · ставка возвращена', lose: p.bust ? 'Перебор' : 'Победа дилера' }[outcome],
    playerTotal: p.total, dealerTotal: d.total, playerNatural: p.natural, dealerNatural: d.natural });
}

export const CANDIDATE_RULES = Object.freeze({
  decks: 6, dealerStandsSoft17: true, ticketCount: 10000,
  dealerBoostTickets: 3200, playerUnfavorableTickets: 1500, payouts: Object.freeze({ blackjack: 2.5, win: 2, push: 1, lose: 0 }),
  rule: 'Шесть колод, равномерная начальная раздача. На каждом доборе игрока 1 500 из 10 000 билетов выбирают равномерно среди оставшихся физических карт, вызывающих перебор. Если перебора быть не может, выбирается равномерно одна из карт с минимальной новой суммой. Остальные 8 500 билетов выбирают любую оставшуюся физическую карту равномерно. На каждом доборе дилера 3 200 из 10 000 билетов выбирают равномерно среди оставшихся карт с максимальной новой суммой до 21; остальные 6 800 выбирают любую оставшуюся физическую карту равномерно. Если у дилера нет безопасной карты, вся оставшаяся колода равномерна. При мягкой 17 дилер стоит. Обычная победа ×2, Blackjack ×2,5, ничья ×1. Карты не дублируются и не возвращаются после добора; фиксированные доли не зависят от ставки, баланса, игрока или истории.'
});
const owned = new WeakSet(), engines = new WeakMap(), cachedDealerSteps = new WeakMap(),
  cachedHitSteps = new WeakMap(), cachedStandSteps = new WeakMap(), cachedRevealSteps = new WeakMap();
const validCard = card => card && Number.isInteger(card.rank) && card.rank >= 1 && card.rank <= 13 && BLACKJACK_SUITS.includes(card.suit);
function freezeHand(hand, engine) {
  const next = Object.freeze({ ...hand, shoe: Object.freeze(hand.shoe), player: Object.freeze(hand.player), dealer: Object.freeze(hand.dealer) });
  owned.add(next); engines.set(next, engine); return next;
}
function assertHand(hand, phase) {
  if (!owned.has(hand) || (phase && hand.phase !== phase)) throw new Error('Этот ход сейчас недоступен.');
}
function randomIntChecked(engine, size) {
  if (typeof engine.randomInt !== 'function') throw new TypeError('Нужен randomInt для добора карты.');
  const ticket = engine.randomInt(size);
  if (!Number.isInteger(ticket) || ticket < 0 || ticket >= size) throw new RangeError('randomInt вышел за допустимые пределы.');
  return ticket;
}
export function createBlackjackHand({ randomInt, shoe, dealerBoostTickets = CANDIDATE_RULES.dealerBoostTickets,
  playerUnfavorableTickets = CANDIDATE_RULES.playerUnfavorableTickets, audit = false } = {}) {
  if (!Number.isInteger(dealerBoostTickets) || dealerBoostTickets < 0 || dealerBoostTickets > CANDIDATE_RULES.ticketCount) throw new RangeError('Некорректная фиксированная доля билетов.');
  if (!Number.isInteger(playerUnfavorableTickets) || playerUnfavorableTickets < 0 || playerUnfavorableTickets > CANDIDATE_RULES.ticketCount) throw new RangeError('Некорректная фиксированная доля билетов игрока.');
  const cards = shoe ? shoe.map((card, index) => {
    if (!validCard(card)) throw new TypeError('Некорректная карта в колоде.');
    return Object.freeze({ ...card, id: card.id ?? `fixture-${index}` });
  }) : [...createBlackjackShoe(randomInt)];
  if (cards.length < 4 || new Set(cards.map(card => card.id)).size !== cards.length) throw new RangeError('Для раздачи нужны не менее четырёх разных физических карт.');
  const player = [cards[0], cards[2]], dealer = [cards[1], cards[3]];
  const phase = blackjackScore(player).natural || blackjackScore(dealer).natural ? 'reveal' : 'player';
  return freezeHand({ shoe: cards, cursor: 4, player, dealer, revealed: false, phase, dealerBoostTickets, playerUnfavorableTickets },
    { randomInt, audit: Boolean(audit), log: Object.freeze([]), roundToken: Object.freeze({}) });
}
function unfavorableCards(hand) {
  const scoresByRank = Array.from({ length: 14 }, (_, rank) => rank
    ? blackjackScore([...hand.player, { rank, suit: 'spades' }]) : null);
  const bustIndexes = [], minimumIndexes = [];
  let minimumTotal = Infinity;
  for (let index = hand.cursor; index < hand.shoe.length; index++) {
    const score = scoresByRank[hand.shoe[index].rank];
    if (score.bust) bustIndexes.push(index);
    else if (score.total <= minimumTotal) {
      if (score.total < minimumTotal) { minimumTotal = score.total; minimumIndexes.length = 0; }
      minimumIndexes.push(index);
    }
  }
  return { indexes: bustIndexes.length ? bustIndexes : minimumIndexes,
    bustPreferred: bustIndexes.length > 0, minimumTotal: bustIndexes.length ? null : minimumTotal, scoresByRank };
}
function playerDrawProbabilities(hand, favored) {
  const n = hand.shoe.length - hand.cursor, k = favored.indexes.length;
  const selected = new Set(favored.indexes), p = k ? hand.playerUnfavorableTickets / CANDIDATE_RULES.ticketCount : 0;
  const ranks = Array.from({ length: 13 }, (_, i) => ({ rank: i + 1, count: 0,
    preferredCount: 0, probability: 0, resultingTotal: favored.scoresByRank[i + 1].total,
    bust: favored.scoresByRank[i + 1].bust }));
  for (let index = hand.cursor; index < hand.shoe.length; index++) {
    const entry = ranks[hand.shoe[index].rank - 1], preferred = selected.has(index);
    entry.count++; entry.preferredCount += Number(preferred);
    entry.probability += (1 - p) / n + (preferred ? p / k : 0);
  }
  return Object.freeze({ remainingCards: n, preferredCards: k,
    bustPreferred: favored.bustPreferred, minimumResultingTotal: favored.minimumTotal,
    unfavorableProbability: p, perPreferredCard: (1 - p) / n + (k ? p / k : 0),
    perOtherCard: (1 - p) / n, ranks: Object.freeze(ranks.map(Object.freeze)) });
}
export function hitBlackjack(hand) {
  assertHand(hand, 'player');
  if (cachedHitSteps.has(hand)) return cachedHitSteps.get(hand);
  const engine = engines.get(hand), remaining = hand.shoe.length - hand.cursor;
  if (!remaining) throw new RangeError('Карты закончились.');
  let selectedIndex = hand.cursor, ticket = null, unfavorable = false, favored = null;
  if (hand.playerUnfavorableTickets > 0) {
    ticket = randomIntChecked(engine, CANDIDATE_RULES.ticketCount);
    unfavorable = ticket < hand.playerUnfavorableTickets;
    if (unfavorable || engine.audit) favored = unfavorableCards(hand);
    selectedIndex = unfavorable && favored.indexes.length
      ? favored.indexes[randomIntChecked(engine, favored.indexes.length)]
      : hand.cursor + randomIntChecked(engine, remaining);
  }
  const shoe = [...hand.shoe];
  [shoe[hand.cursor], shoe[selectedIndex]] = [shoe[selectedIndex], shoe[hand.cursor]];
  const card = shoe[hand.cursor], player = [...hand.player, card];
  if (engine.audit && !favored) favored = unfavorableCards(hand);
  const entry = engine.audit ? Object.freeze({ actor: 'player', step: engine.log.length + 1,
    playerBefore: hand.player.map(card => card.rank), ticket, unfavorable, selectedIndex,
    selectedCard: card, exactProbabilities: playerDrawProbabilities(hand, favored) }) : null;
  const nextEngine = entry ? { ...engine, log: Object.freeze([...engine.log, entry]) } : engine;
  const next = freezeHand({ ...hand, shoe, cursor: hand.cursor + 1, player,
    phase: blackjackScore(player).total >= 21 ? 'reveal' : 'player' }, nextEngine);
  cachedHitSteps.set(hand, next); return next;
}
export function standBlackjack(hand) {
  assertHand(hand, 'player');
  if (cachedStandSteps.has(hand)) return cachedStandSteps.get(hand);
  const next = freezeHand({ ...hand, phase: 'reveal' }, engines.get(hand));
  cachedStandSteps.set(hand, next); return next;
}
export function revealBlackjack(hand) {
  assertHand(hand, 'reveal');
  if (cachedRevealSteps.has(hand)) return cachedRevealSteps.get(hand);
  const p = blackjackScore(hand.player), d = blackjackScore(hand.dealer);
  const next = freezeHand({ ...hand, revealed: true, phase: p.bust || p.natural || d.natural || d.total >= 17 ? 'resolved' : 'dealer' }, engines.get(hand));
  cachedRevealSteps.set(hand, next); return next;
}

function preferredCards(hand) {
  let best = -1, indexes = [];
  const totalsByRank = Array.from({ length: 14 }, (_, rank) => rank ? blackjackScore([...hand.dealer, { rank, suit: 'spades' }]).total : Infinity);
  for (let index = hand.cursor; index < hand.shoe.length; index++) {
    const total = totalsByRank[hand.shoe[index].rank];
    if (total <= 21 && total >= best) {
      if (total > best) { best = total; indexes = []; }
      indexes.push(index);
    }
  }
  return { best, indexes, totalsByRank };
}

// Exact conditional probabilities, exposed only after the hole-card reveal.
// Remaining cards are counted without replacement. For N cards and K preferred
// cards, every card receives (1-p)/N plus p/K iff it belongs to that subset.
export function dealerDrawProbabilities(hand) {
  assertHand(hand, 'dealer');
  if (!hand.revealed) throw new Error('Сначала раскройте карту дилера.');
  const { best, indexes, totalsByRank } = preferredCards(hand);
  const preferred = new Set(indexes), n = hand.shoe.length - hand.cursor;
  if (!n) throw new RangeError('Карты закончились.');
  const p = indexes.length ? hand.dealerBoostTickets / CANDIDATE_RULES.ticketCount : 0;
  const ranks = Array.from({ length: 13 }, (_, i) => ({ rank: i + 1, count: 0, preferredCount: 0, probability: 0, resultingTotal: totalsByRank[i + 1] }));
  for (let index = hand.cursor; index < hand.shoe.length; index++) {
    const entry = ranks[hand.shoe[index].rank - 1];
    const favored = preferred.has(index);
    entry.count++; entry.preferredCount += Number(favored);
    entry.probability += (1 - p) / n + (favored ? p / indexes.length : 0);
  }
  return Object.freeze({ remainingCards: n, preferredCards: indexes.length, bestResultingTotal: best,
    boostProbability: p, perPreferredCard: (1 - p) / n + (indexes.length ? p / indexes.length : 0),
    perOtherCard: (1 - p) / n, ranks: Object.freeze(ranks.map(Object.freeze)) });
}

export function dealerStepBlackjack(hand) {
  assertHand(hand, 'dealer');
  if (!hand.revealed) throw new Error('Сначала раскройте карту дилера.');
  if (cachedDealerSteps.has(hand)) return cachedDealerSteps.get(hand);
  const engine = engines.get(hand), remaining = hand.shoe.length - hand.cursor;
  if (!remaining) throw new RangeError('Карты закончились.');
  let selectedIndex = hand.cursor, ticket = null, boost = false, preferred = { indexes: [], best: null };
  if (hand.dealerBoostTickets > 0) {
    ticket = randomIntChecked(engine, CANDIDATE_RULES.ticketCount);
    boost = ticket < hand.dealerBoostTickets;
    if (boost) preferred = preferredCards(hand);
    selectedIndex = boost && preferred.indexes.length
      ? preferred.indexes[randomIntChecked(engine, preferred.indexes.length)]
      : hand.cursor + randomIntChecked(engine, remaining);
  }
  const shoe = [...hand.shoe];
  [shoe[hand.cursor], shoe[selectedIndex]] = [shoe[selectedIndex], shoe[hand.cursor]];
  const card = shoe[hand.cursor];
  const entry = engine.audit ? Object.freeze({ actor: 'dealer', step: engine.log.length + 1,
    dealerBefore: hand.dealer.map(card => card.rank), ticket, boost, selectedIndex,
    selectedCard: card, exactProbabilities: dealerDrawProbabilities(hand) }) : null;
  const nextEngine = entry ? { ...engine, log: Object.freeze([...engine.log, entry]) } : engine;
  const dealer = [...hand.dealer, card];
  const next = freezeHand({ ...hand, shoe, cursor: hand.cursor + 1, dealer,
    phase: blackjackScore(dealer).total >= 17 ? 'resolved' : 'dealer' }, nextEngine);
  cachedDealerSteps.set(hand, next);
  return next;
}
// Closed lineage binds every immutable transition to its original funded hand.
// Copied cards, a separate fixture, and another authentic hand cannot substitute.
export function isBlackjackContinuation(initial, next) {
  return owned.has(initial) && owned.has(next)
    && engines.get(initial).roundToken === engines.get(next).roundToken;
}
export function evaluateBlackjack(hand) {
  assertHand(hand, 'resolved');
  if (!hand.revealed) throw new Error('Сначала раскройте карту дилера.');
  return compareBlackjackHands(hand.player, hand.dealer);
}
export function finishBlackjack(hand) {
  assertHand(hand); let next = hand;
  if (next.phase === 'player') next = standBlackjack(next);
  if (next.phase === 'reveal') next = revealBlackjack(next);
  while (next.phase === 'dealer') next = dealerStepBlackjack(next);
  evaluateBlackjack(next); return next;
}
export function blackjackPublicView(hand, { playerShown = hand?.player.length ?? 0,
  dealerShown = hand?.dealer.length ?? 0, revealed = hand?.revealed ?? false, settled = false } = {}) {
  if (!hand) return Object.freeze({ player: [], dealer: [], playerTotal: null, dealerTotal: null, revealed: false, result: null });
  assertHand(hand);
  const player = hand.player.slice(0, playerShown), shown = hand.dealer.slice(0, dealerShown);
  const dealer = shown.map((card, index) => index === 1 && !revealed ? Object.freeze({ hidden: true }) : card);
  const visibleDealer = shown.filter((_, index) => index !== 1 || revealed);
  return Object.freeze({ player: Object.freeze(player), dealer: Object.freeze(dealer),
    playerTotal: player.length ? blackjackScore(player).total : null,
    dealerTotal: visibleDealer.length ? blackjackScore(visibleDealer).total : null,
    revealed, result: settled ? evaluateBlackjack(hand) : null });
}
export function blackjackResearchAudit(hand) {
  assertHand(hand, 'resolved');
  if (!hand.revealed) throw new Error('Запись доборов доступна только после завершения руки.');
  return Object.freeze([...engines.get(hand).log]);
}
