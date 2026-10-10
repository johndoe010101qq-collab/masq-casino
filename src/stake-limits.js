export const STANDARD_STAKE_LIMITS = Object.freeze({ min:5, max:250, step:5 });
export const BONANZA_STAKE_LIMITS = Object.freeze({ min:5, max:100, step:5 });
export const stakeLimits = game => game === 'slots' || game === 'bonanza'
  ? BONANZA_STAKE_LIMITS : STANDARD_STAKE_LIMITS;
export function permittedStake(value, limits = STANDARD_STAKE_LIMITS) {
  return Number.isSafeInteger(value) && value >= limits.min
    && value <= limits.max && value % limits.step === 0;
}
export function adjustedStake(value, factor, balance = Infinity, limits = STANDARD_STAKE_LIMITS) {
  const highest = Math.min(limits.max, Math.floor(balance / limits.step) * limits.step);
  const scaled = Math.round(Number(value) * factor / limits.step) * limits.step;
  return Math.max(limits.min, Math.min(highest, Number.isFinite(scaled) ? scaled : limits.min));
}
