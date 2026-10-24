import assert from 'node:assert/strict';
import {HUEVO_ECONOMICS,quoteHuevoDeposit,validateHuevoEconomics} from '../server/huevo-economics.mjs';
assert.equal(validateHuevoEconomics(HUEVO_ECONOMICS),HUEVO_ECONOMICS);
assert.deepEqual(quoteHuevoDeposit(10000),{grossUnits:10000,feeUnits:500,creditUnits:9500,
  feeBps:500,rounding:'credit-down-to-platform-minor-unit'});
for(let gross=2;gross<100000;gross++){
  const q=quoteHuevoDeposit(gross);
  assert.equal(q.feeUnits+q.creditUnits,gross);
  assert.equal(q.creditUnits,Math.floor(gross*95/100));
  assert.ok(q.creditUnits>0&&q.feeUnits>0);
}
for(const gross of [0,1,-1,1.1,NaN,Infinity,'100',Number.MAX_SAFE_INTEGER+1])
  assert.throws(()=>quoteHuevoDeposit(gross));
assert.equal(quoteHuevoDeposit(Number.MAX_SAFE_INTEGER).creditUnits,
  Number(BigInt(Number.MAX_SAFE_INTEGER)*95n/100n));
assert.throws(()=>validateHuevoEconomics({...HUEVO_ECONOMICS,targetRtpBps:9500}));
assert.throws(()=>validateHuevoEconomics({...HUEVO_ECONOMICS,personalizedOutcomes:true}));
console.log('PASS huEVO deposit conservation, rounding, safe bounds and fixed policy.');
