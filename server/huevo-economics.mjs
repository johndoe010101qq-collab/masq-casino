import {HUEVO_RTP} from '../src/runtime-rtp-range.js';
// Our ledger stores hundredths of a platform coin. huEVO API amounts are
// whole coins: the adapter multiplies by 100 exactly before applying this fee.
export const HUEVO_ECONOMICS = Object.freeze({
  version: 'masq-huevo-v2-92', targetRtpBps: HUEVO_RTP*100, depositFeeBps: 500,
  personalizedOutcomes: false, bankrollOutcomeAdjustment: false,
});

export function quoteHuevoDeposit(grossUnits) {
  if (!Number.isSafeInteger(grossUnits) || grossUnits < 1)
    throw new RangeError('Deposit must be a positive safe integer in minor units.');
  const gross = BigInt(grossUnits);
  // Round the CREDIT down, never issue more credits than have been received.
  // UI must show this exact quote, including the rounding, before confirmation.
  const credit = gross * 9500n / 10000n;
  if (credit === 0n) throw new RangeError('Deposit is too small to credit.');
  return Object.freeze({grossUnits, feeUnits: Number(gross-credit),
    creditUnits: Number(credit), feeBps: 500,
    rounding: 'credit-down-to-platform-minor-unit'});
}

export function validateHuevoEconomics(policy) {
  if (!policy || policy.targetRtpBps !== HUEVO_RTP*100 || policy.depositFeeBps !== 500
      || policy.personalizedOutcomes !== false || policy.bankrollOutcomeAdjustment !== false)
    throw new RangeError('huEVO uses a fixed public policy: RTP target 92%, deposit fee 5%.');
  return HUEVO_ECONOMICS;
}
