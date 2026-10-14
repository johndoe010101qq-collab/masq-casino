// DEMO ONLY. This local book is forgeable and resets with the browser/session.
// Record the worst possible NET house loss before drawing RNG. Finalize the
// charge/payout together when the visual round completes. A synchronous engine
// failure can release its hold only before any playable round/result is issued.
// Do not use this cancellation lifecycle as a real-payment server policy.
import { liabilityTerms, maximumSafeStake } from './liability-terms.js';
export const DEMO_HOUSE_BANK_CENTS = 10000 * 100;
const cents = (value, name) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be nonnegative safe integer cents.`);
  return value;
};
const signedCents = (value, name) => {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${name} must be safe integer cents.`);
  return value;
};
const roundId = value => {
  if (typeof value === 'string' && value.trim() || Number.isSafeInteger(value) && value > 0) return value;
  throw new TypeError('A unique round ID is required.');
};
const sameTerms = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function createDemoReserve({ capitalCents = DEMO_HOUSE_BANK_CENTS } = {}) {
  cents(capitalCents, 'Capital');
  let bankCents = capitalCents, reservedCents = 0, pendingCharges = 0n;
  const active = new Map(), completed = new Map();
  // A negative bank records actual house debt. Negative availability includes
  // the outstanding worst-case liabilities; neither figure is clipped to zero.
  const snapshot = () => Object.freeze({ bankCents, reservedCents,
    availableCents: bankCents - reservedCents, activeCount: active.size });
  function reserve(input, { allowUnfundedPlinko = false } = {}) {
    const id = roundId(input?.roundId);
    const terms = Object.freeze({ roundId: id, ...liabilityTerms(input) });
    if (typeof allowUnfundedPlinko !== 'boolean' || allowUnfundedPlinko && terms.game !== 'plinko')
      throw new RangeError('Only a trusted Plinko launch may record an unfunded liability.');
    const previous = active.get(id) || completed.get(id);
    if (previous) {
      if (!sameTerms(previous.terms, terms) || previous.unfundedPlinko !== allowUnfundedPlinko) throw new Error('Idempotency conflict: different round selection.');
      return Object.freeze({ admittedNow: false, record: previous });
    }
    if (!allowUnfundedPlinko && bankCents - reservedCents < terms.maxHouseLossCents) return null;
    const nextReserved = cents(Number(BigInt(reservedCents) + BigInt(terms.maxHouseLossCents)), 'Reserved');
    signedCents(Number(BigInt(bankCents) - BigInt(nextReserved)), 'Available');
    const nextCharges = pendingCharges + BigInt(terms.chargeCents);
    // Even a zero payout must fit the bank's integer storage. This uses only
    // public prices, before RNG, and introduces no nominal flight/capital cap.
    signedCents(Number(BigInt(bankCents) + nextCharges), 'Bank headroom');
    const record = Object.freeze({ terms, phase: 'held', unfundedPlinko: allowUnfundedPlinko });
    reservedCents = nextReserved; pendingCharges = nextCharges; active.set(id, record);
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
    const nextBank = signedCents(Number(BigInt(bankCents) + BigInt(terms.chargeCents) - BigInt(payoutCents)), 'Bank');
    const nextReserved = cents(Number(BigInt(reservedCents) - BigInt(terms.maxHouseLossCents)), 'Reserved');
    signedCents(Number(BigInt(nextBank) - BigInt(nextReserved)), 'Available');
    // Funding is checked only on admission. Once accepted, an immutable capped
    // obligation remains payable even when earlier Plinko payouts used its backing.
    bankCents = nextBank; reservedCents = nextReserved; pendingCharges -= BigInt(terms.chargeCents); active.delete(id);
    completed.set(id, Object.freeze({ terms, phase: 'settled', payoutCents, unfundedPlinko: round.unfundedPlinko }));
    return true;
  }
  function cancel(id) {
    roundId(id);
    if (completed.has(id)) return false;
    const round = active.get(id);
    if (!round) return false;
    const nextReserved = cents(Number(BigInt(reservedCents) - BigInt(round.terms.maxHouseLossCents)), 'Reserved');
    reservedCents = nextReserved; pendingCharges -= BigInt(round.terms.chargeCents);
    active.delete(id); completed.set(id, Object.freeze({ terms: round.terms, phase: 'cancelled', unfundedPlinko: round.unfundedPlinko }));
    return true;
  }
  function reset() {
    if (active.size) return false;
    bankCents = capitalCents; reservedCents = 0; pendingCharges = 0n; completed.clear(); return true;
  }
  return Object.freeze({ snapshot, reserve, settle, cancel, reset,
    maximumSafeStake: (selection, walletCents) => maximumSafeStake(selection, Math.max(0, snapshot().availableCents), walletCents) });
}
