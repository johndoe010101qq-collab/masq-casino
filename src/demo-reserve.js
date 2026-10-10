// DEMO ONLY. This local book is forgeable and resets with the browser/session.
// Hold the worst possible NET house loss before drawing RNG. Finalize the
// charge/payout together when the visual round completes. A synchronous engine
// failure can release its hold only before any playable round/result is issued.
// Do not use this cancellation lifecycle as a real-payment server policy.
import { liabilityTerms, maximumSafeStake } from './liability-terms.js';
export const DEMO_HOUSE_BANK_CENTS = 10000 * 100;
const cents = (value, name) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be nonnegative safe integer cents.`);
  return value;
};
const roundId = value => {
  if (typeof value === 'string' && value.trim() || Number.isSafeInteger(value) && value > 0) return value;
  throw new TypeError('A unique round ID is required.');
};
const sameTerms = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function createDemoReserve({ capitalCents = DEMO_HOUSE_BANK_CENTS } = {}) {
  cents(capitalCents, 'Capital');
  let bankCents = capitalCents, reservedCents = 0;
  const active = new Map(), completed = new Map();
  const snapshot = () => Object.freeze({ bankCents, reservedCents,
    availableCents: bankCents - reservedCents, activeCount: active.size });
  function reserve(input) {
    const id = roundId(input?.roundId);
    const terms = Object.freeze({ roundId: id, ...liabilityTerms(input) });
    const previous = active.get(id) || completed.get(id);
    if (previous) {
      if (!sameTerms(previous.terms, terms)) throw new Error('Idempotency conflict: different round selection.');
      return Object.freeze({ admittedNow: false, record: previous });
    }
    if (bankCents - reservedCents < terms.maxHouseLossCents) return null;
    const nextReserved = cents(reservedCents + terms.maxHouseLossCents, 'Reserved');
    const record = Object.freeze({ terms, phase: 'held' });
    reservedCents = nextReserved; active.set(id, record);
    return Object.freeze({ admittedNow: true, record });
  }
  function settle(id, payoutCents) {
    roundId(id); cents(payoutCents, 'Payout');
    const previous = completed.get(id);
    if (previous) {
      if (previous.phase !== 'settled' || previous.payoutCents !== payoutCents) throw new Error('Idempotency conflict: different settlement.');
      return false;
    }
    const round = active.get(id);
    if (!round) throw new RangeError('Unknown round ID.');
    const terms = round.terms;
    if (payoutCents > terms.maxPayoutCents) throw new RangeError('Payout exceeds the disclosed whole-round maximum.');
    const nextBank = cents(bankCents + terms.chargeCents - payoutCents, 'Bank');
    const nextReserved = cents(reservedCents - terms.maxHouseLossCents, 'Reserved');
    if (nextBank < nextReserved) throw new Error('Demo reserve invariant failed.');
    bankCents = nextBank; reservedCents = nextReserved; active.delete(id);
    completed.set(id, Object.freeze({ terms, phase: 'settled', payoutCents }));
    return true;
  }
  function cancel(id) {
    roundId(id);
    if (completed.has(id)) return false;
    const round = active.get(id);
    if (!round) return false;
    reservedCents = cents(reservedCents - round.terms.maxHouseLossCents, 'Reserved');
    active.delete(id); completed.set(id, Object.freeze({ terms: round.terms, phase: 'cancelled' }));
    return true;
  }
  function reset() {
    if (active.size) return false;
    bankCents = capitalCents; reservedCents = 0; completed.clear(); return true;
  }
  return Object.freeze({ snapshot, reserve, settle, cancel, reset,
    maximumSafeStake: (selection, walletCents) => maximumSafeStake(selection, snapshot().availableCents, walletCents) });
}
