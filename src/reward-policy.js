// Browser-side form validation. The server independently validates the policy
// and accepts no player-supplied profit, recipients or payout instructions.
export function cleanRewardPolicy(value) {
  const keys=['returnPercent','minimumBankCents','minStakeMultiple','maxStakeMultiple','maxWinners'];
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||
    keys.some(key=>!Object.hasOwn(value,key)||!Number.isSafeInteger(value[key]))||
    value.returnPercent<0||value.returnPercent>100||value.minimumBankCents<1||
    value.minStakeMultiple<1||value.minStakeMultiple>100||value.maxStakeMultiple<value.minStakeMultiple||
    value.maxStakeMultiple>100||value.maxWinners<1||value.maxWinners>100)
    throw new RangeError('Проверьте долю, порог банка, множители и число получателей.');
  return Object.fromEntries(keys.map(key=>[key,value[key]]));
}
