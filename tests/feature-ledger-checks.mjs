import assert from 'node:assert/strict';
import {HallSession,validateFeatureSpin} from '../src/hall-session.js';
import {liabilityTerms,maximumSafeStake} from '../src/liability-terms.js';
import {createDemoReserve} from '../src/demo-reserve.js';

let randomCalls=0, word=0x12345678;
const randomInt=maximum=>{randomCalls++;word=(Math.imul(word,1664525)+1013904223)>>>0;return word%maximum;};
let settled=0;
for(const featureMode of ['hunt','rainbow']) {
  const multiplier=featureMode==='hunt'?3:10;
  for(const stake of [5,50,250]) {
    const session=new HallSession(null,randomInt,{initialBalanceCents:100000000,houseCapitalCents:100000000});
    const openingWallet=session.balanceCents,openingBank=session.getReserveSnapshot().bankCents;
    const r=session.begin('lecipher',null,stake,{featureMode});
    assert.equal(r.chargeCents,stake*100*multiplier);
    assert.equal(r.featureMode,featureMode);
    assert(Object.isFrozen(r));
    const calls=randomCalls;
    assert.equal(session.begin('lecipher',null,stake,{featureMode}),null);
    assert.equal(randomCalls,calls,'Concurrent launch must not draw RNG.');
    assert.equal(session.balanceCents,openingWallet-r.chargeCents);
    assert.equal(session.complete(r.id),true);
    assert.equal(session.complete(r.id),false);
    assert.equal(session.completeStored({...r,payoutCents:r.payoutCents+1}),false);
    assert.equal(session.balanceCents,openingWallet-r.chargeCents+r.payoutCents);
    assert.equal(session.getReserveSnapshot().bankCents,openingBank+r.chargeCents-r.payoutCents);
    assert.equal(session.balanceCents+session.getReserveSnapshot().bankCents,openingWallet+openingBank);
    assert.equal(session.getReserveSnapshot().reservedCents,0);
    const q=liabilityTerms({game:'lecipher',stake,featureMode});
    assert.equal(q.chargeCents,r.chargeCents);
    assert.equal(q.featureMode,featureMode);
    assert.equal(q.maxPayoutCents,stake*100*40-100);
    assert.equal(q.maxHouseLossCents,q.maxPayoutCents-q.chargeCents);
    if(featureMode==='rainbow')assert.equal(r.spins[0].initial.flat().filter(c=>c.activation).length,1);
    settled++;
  }
}
let preRngRejects=0;
for(const input of [
  {game:'lecipher',mode:'buy',featureMode:'hunt'},
  {game:'maskhouse',featureMode:'rainbow'},
  {game:'slots',featureMode:'hunt'},
  {game:'coinflip',featureMode:'rainbow'},
  {game:'lecipher',featureMode:'unknown'},
  {game:'lecipher',featureMode:'__proto__'},
  {game:'lecipher',featureMode:'rainbow',bonusTier:'gold'}
]) {
  const session=new HallSession(null,randomInt,{initialBalanceCents:10000000,houseCapitalCents:10000000});
  const calls=randomCalls,balance=session.balanceCents;
  assert.throws(()=>session.begin(input.game,null,5,input));
  assert.equal(randomCalls,calls);
  assert.equal(session.balanceCents,balance);
  assert.equal(session.getReserveSnapshot().activeCount,0);
  preRngRejects++;
}
for(const featureMode of ['hunt','rainbow']) {
  const poor=new HallSession(null,randomInt,{initialBalanceCents:500,houseCapitalCents:1000000});
  const calls=randomCalls;
  assert.throws(()=>poor.begin('lecipher',null,5,{featureMode}));
  assert.equal(randomCalls,calls);
  const noReserve=new HallSession(null,randomInt,{initialBalanceCents:1000000,houseCapitalCents:0});
  assert.throws(()=>noReserve.begin('lecipher',null,5,{featureMode}));
  assert.equal(randomCalls,calls);
  preRngRejects+=2;
}
assert(validateFeatureSpin(5,14,'lecipher','hunt'));
assert.equal(validateFeatureSpin(5,15,'lecipher','hunt'),'');
assert(validateFeatureSpin(5,49,'lecipher','rainbow'));
assert.equal(validateFeatureSpin(5,50,'lecipher','rainbow'),'');
assert.equal(maximumSafeStake({game:'lecipher',featureMode:'rainbow'},749900,250000),250);
const terms=liabilityTerms({game:'lecipher',stake:5});
assert(!Object.hasOwn(terms,'featureMode'),'Existing liability object shape is preserved.');
const book=createDemoReserve({capitalCents:1000000});
book.reserve({roundId:'same-id',game:'lecipher',stake:5,featureMode:'hunt'});
assert.throws(()=>book.reserve({roundId:'same-id',game:'lecipher',stake:5,featureMode:'rainbow'}),/Idempotency/);
const result={status:'passed',settledFeatureCases:settled,preRngRejects,duplicateSettlementProtected:true,modeIdentityProtected:true,unchangedCap:true,chargeQuotedBeforeRng:true};
console.log(JSON.stringify(result));
