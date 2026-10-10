import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {playMaskSlot,MASK_SLOT_RULES as baseRules,LEXOF_FEATURE_RULES as baseFeatures} from '../src/mask-slots.js';
import {playProfiledMaskRound,MASK_SLOT_RULES as profileRules,LEXOF_FEATURE_RULES as profileFeatures} from '../src/profiled-mask-core.js';
import {playProfiledMaskSlot,getMaskProfileSnapshot,MASK_RTP_PROFILES} from '../src/profiled-mask-slots.js';
import {createDemoReserve} from '../src/demo-reserve.js';
import {liabilityTerms} from '../src/liability-terms.js';
let checks=0,rounds=0,baselineParity=0,zeroTicketParity=0,financialRounds=0;
const equal=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const ok=(x,message)=>{assert(x,message);checks++;};
const throws=(fn,pattern)=>{assert.throws(fn,pattern);checks++;};
const sha=body=>createHash('sha256').update(body).digest('hex');
const offers=[
 {game:'maskhouse',mode:'paid'}, {game:'maskhouse',mode:'buy',bonusTier:'sticky'},
 {game:'lecipher',mode:'paid'}, {game:'lecipher',mode:'buy',bonusTier:'luck'}, {game:'lecipher',mode:'buy',bonusTier:'gold'},
 {game:'lecipher',mode:'paid',featureMode:'hunt'}, {game:'lecipher',mode:'paid',featureMode:'rainbow'}];
function seeded(seed,trace=[]){let state=seed>>>0;return max=>{state=(Math.imul(state,1664525)+1013904223)>>>0;const value=Math.floor(state/4294967296*max);trace.push([max,value]);return value;};}
function normalized(round){const{profile,profileExtraFreeSpins,profileLotteryTriggered,baseSourceSHA256,...rest}=round;return {...rest,rulesVersion:baseRules.version};}
function validate(round){
 rounds++;ok(Number.isSafeInteger(round.payoutCents)&&round.payoutCents>=0&&round.payoutCents<=round.stakeCents*40-100);
 equal(round.ledger,{chargeCents:round.chargeCents,creditCents:round.payoutCents});
 equal(round.spins.reduce((sum,s)=>sum+s.payoutCents,0),round.payoutCents);
 equal(round.spins.reduce((sum,s)=>sum+s.chargeCents,0),round.chargeCents);
 equal(round.initialFreeSpins+round.spins.reduce((sum,s)=>sum+s.awardedSpins,0),round.freeSpinsAwarded);
 equal(round.freeSpinsAwarded-round.freeSpinsPlayed,round.unplayedFreeSpins);
 if(round.game==='maskhouse'&&!round.capReached)equal(round.unplayedFreeSpins,0);
 const extra=round.profileExtraFreeSpins??0;
 equal(round.spins.reduce((sum,s)=>sum+(s.profileExtraSpinsAwarded??0),0),extra);
 if(extra){equal(extra,4);equal(round.spins[0].awardedSpins,round.spins[0].naturalAwardedSpins+4);ok(round.freeSpinsAwarded>=4);}
 for(const spin of round.spins){equal(spin.frames.reduce((sum,f)=>sum+f.payoutCents,0),spin.payoutCents);ok(spin.chargeCents===0||spin.index===0);}
 ok(Object.isFrozen(round)&&Object.isFrozen(round.spins)&&Object.isFrozen(round.spins[0]));
}
equal(sha(readFileSync(new URL('../src/mask-slots.js',import.meta.url))),MASK_RTP_PROFILES.baseSourceSHA256);
equal(sha(readFileSync(new URL('../src/mask-slots.js',import.meta.url))),MASK_RTP_PROFILES.baseSourceSHA256);
equal(sha(readFileSync(new URL('../src/profiled-mask-core.js',import.meta.url))),MASK_RTP_PROFILES.derivedSourceSHA256);
const{version:baseVersion,...baseTables}=baseRules,{version:profileVersion,...profileTables}=profileRules;
equal(profileTables,baseTables,'All nominal multipliers, symbol weights, budgets, prices and guards unchanged');equal(profileFeatures,baseFeatures);

// Public50 consumes no lottery ticket and preserves every field and every RNG range/value.
for(const offer of offers)for(const stakeCents of[500,5000,25000])for(let seed=1;seed<=100;seed++){
 const trace1=[],trace2=[],input={...offer,stakeCents};
 const native=playMaskSlot({...input,randomInt:seeded(seed,trace1)});
 const profiled=playProfiledMaskSlot({...input,rtpProfile:seed%2?50:'rtp50',randomInt:seeded(seed,trace2)});
 equal(profiled,native);equal(trace2,trace1);validate(profiled);baselineParity++;
}
// The clone only adds a ticket and award hook: zero-ticket rounds equal core with aligned RNG.
for(const offer of offers)for(const stakeCents of[500,5000,25000])for(let seed=101;seed<=150;seed++){
 const input={...offer,stakeCents},trace1=[],trace2=[],rng1=seeded(seed,trace1),rng2=seeded(seed,trace2);
 rng1(1000000);const native=playMaskSlot({...input,randomInt:rng1});
 const snapshot=Object.freeze({...getMaskProfileSnapshot(55,offer),ticketWeight:0});
 const clone=playProfiledMaskRound({...input,randomInt:rng2},snapshot);
 equal(normalized(clone),native);equal(trace2,trace1);validate(clone);zeroTicketParity++;
}
// Verify public ticket boundaries, pre-symbol order, actual gifts and unchanged total charge.
for(const offer of offers)for(const target of[55,60])for(const grant of[false,true]){
 const profile=getMaskProfileSnapshot(target,offer),threshold=1000000-profile.ticketWeight,trace=[];
 let first=true;const tail=seeded(701+target,trace),randomInt=max=>{if(first){first=false;equal(max,1000000);const ticket=threshold-(grant?0:1);trace.unshift([max,ticket]);return ticket;}return tail(max);};
 const round=playProfiledMaskSlot({...offer,stakeCents:5000,rtpProfile:target,randomInt});
 validate(round);equal(round.profileLotteryTriggered,grant);equal(round.profileExtraFreeSpins,grant?4:0);equal(round.profile,profile);
 const terms=liabilityTerms({...offer,stake:50});equal(round.chargeCents,terms.chargeCents);equal(round.capCents,terms.maxPayoutCents);
 if(offer.game==='maskhouse'&&offer.mode==='buy')equal(trace.slice(1,10).map(([max])=>max),Array(9).fill(100));
}
// Reentrant caller mutation during first RNG callback cannot change the accepted profile/stake.
const mutable={game:'maskhouse',stakeCents:5000,rtpProfile:55};let mutationCalls=0;
const mutationTail=seeded(1008);mutable.randomInt=max=>{if(mutationCalls++===0){mutable.rtpProfile=60;mutable.stakeCents=25000;return 999999;}return mutationTail(max);};
const pinnedRound=playProfiledMaskSlot(mutable);equal(pinnedRound.profile.id,'rtp55');equal(pinnedRound.stakeCents,5000);validate(pinnedRound);
ok(Object.isFrozen(pinnedRound.profile)&&Object.isFrozen(pinnedRound.profile.measured));
throws(()=>{MASK_RTP_PROFILES.profiles.rtp55.offers['maskhouse:paid'].ticketWeight=1000000;},TypeError);
throws(()=>{pinnedRound.profile.targetReturnPercent=60;},TypeError);

// Unknown presets, external state/outcome overrides and invalid offers fail before RNG.
for(const bad of[{rtpProfile:54},{rtpProfile:'constructor'},{rtpProfile:'__proto__'},{game:'slots'},{mode:'buy',bonusTier:'missing'},
 {featureMode:'missing'},{pastLossCents:1000},{accountId:'attacker'},{balanceCents:10},{initialGrid:[]},{houseReserveCents:20000}]){
 let calls=0;throws(()=>playProfiledMaskSlot({game:'lecipher',stakeCents:5000,rtpProfile:55,...bad,randomInt:max=>{calls++;return 0;}}),/(profile|parameter|offer|slot)/i);equal(calls,0);
}
for(const bad of[0,1,501,25001,NaN,Number.MAX_SAFE_INTEGER]){
 let calls=0;throws(()=>playProfiledMaskSlot({game:'maskhouse',stakeCents:bad,rtpProfile:60,randomInt:max=>{calls++;return 0;}}));equal(calls,0);
}
let calls=0;
throws(()=>playProfiledMaskSlot({game:'maskhouse',stakeCents:5000,rtpProfile:60,maxSpins:1,randomInt:max=>calls++===0?999999:0}),/safety limit/i);
ok(calls>1,'Safety-limit fixture starts a real awarded bonus and rejects whole attempt');
throws(()=>playProfiledMaskSlot({game:'maskhouse',stakeCents:5000,rtpProfile:60,randomInt:max=>max}),/random|RNG|ticket/i);

// Hitting the ordinary budget does not truncate awarded House FS or create another money cap.
let ordinaryCalls=0;const body=playProfiledMaskSlot({game:'maskhouse',stakeCents:5000,rtpProfile:60,randomInt:max=>ordinaryCalls++===0?999999:0});
validate(body);equal(body.payoutCents,125000);equal(body.freeSpinsPlayed,4);equal(body.unplayedFreeSpins,0);equal(body.spins.length,5);equal(body.capReached,false);
// True declared legendary hard cap can stop further FS; all pending counts remain explicit.
let hardCalls=0;const hard=playProfiledMaskSlot({game:'maskhouse',stakeCents:5000,rtpProfile:60,randomInt:max=>hardCalls++===0?999999:(max===86001?86000:max===960?959:0)});
validate(hard);equal(hard.payoutCents,199900);equal(hard.legendary,true);equal(hard.freeSpinsPlayed,0);equal(hard.unplayedFreeSpins,4);

// Reserve the same whole-round maximum before any RNG; settle charge+all FS only once.
for(const offer of offers)for(const target of[50,55,60])for(const stake of[5,50,250]){
 const reserve=createDemoReserve({capitalCents:10000*100}),id=`${financialRounds+1}`,selection={...offer,stake,roundId:id};
 const terms=liabilityTerms(selection),admission=reserve.reserve(selection);ok(admission?.admittedNow);equal(reserve.reserve(selection).admittedNow,false);
 const rng=seeded(4001+financialRounds);let count=0;
 const round=playProfiledMaskSlot({...offer,stakeCents:stake*100,rtpProfile:target,randomInt:max=>{count++;equal(reserve.snapshot().reservedCents,terms.maxHouseLossCents);equal(reserve.snapshot().activeCount,1);return rng(max);}});
 validate(round);ok(count>0);equal(round.chargeCents,terms.chargeCents);equal(round.capCents,terms.maxPayoutCents);
 equal(reserve.settle(id,round.payoutCents),true);const after=reserve.snapshot();equal(after.bankCents,10000*100+round.chargeCents-round.payoutCents);equal(after.reservedCents,0);equal(after.activeCount,0);
 equal(reserve.settle(id,round.payoutCents),false);equal(reserve.snapshot(),after);throws(()=>reserve.settle(id,round.payoutCents+1),/conflict/i);financialRounds++;
}
const unfunded=createDemoReserve({capitalCents:100*100});let forbiddenDraws=0;
const admitted=unfunded.reserve({game:'maskhouse',stake:250,roundId:'unfunded'});
if(admitted)playProfiledMaskSlot({game:'maskhouse',stakeCents:25000,rtpProfile:60,randomInt:max=>{forbiddenDraws++;return 0;}});
equal(admitted,null);equal(forbiddenDraws,0);equal(unfunded.snapshot().reservedCents,0);
// Guard failures release an admitted hold without posting a charge or payout.
const rejected=createDemoReserve(),entry=rejected.reserve({game:'maskhouse',stake:50,roundId:'guard'});ok(entry?.admittedNow);let rejectedCalls=0;
throws(()=>playProfiledMaskSlot({game:'maskhouse',stakeCents:5000,rtpProfile:60,maxSpins:1,randomInt:max=>rejectedCalls++===0?999999:0}),/safety limit/i);
equal(rejected.cancel('guard'),true);equal(rejected.snapshot(),{bankCents:1000000,reservedCents:0,availableCents:1000000,activeCount:0});equal(rejected.cancel('guard'),false);

const result={passed:true,checks,rounds,baselineParityRounds:baselineParity,zeroLotteryTicketAlignedCoreParityRounds:zeroTicketParity,financialRounds,
 baseSourceSHA256:MASK_RTP_PROFILES.baseSourceSHA256,derivedSourceSHA256:MASK_RTP_PROFILES.derivedSourceSHA256,
 manifestSHA256:sha(readFileSync(new URL('../src/rtp-profiles.js',import.meta.url))),adapterSHA256:sha(readFileSync(new URL('../src/profiled-mask-slots.js',import.meta.url))),
 coverage:['All7offers, bothnewpresets, stakes5/50/250.','50 public result and every RNG ticket identical to frozen core.','Zero-lottery clone aligned-stream result and RNG parity.','Lottery boundaries and first-ticket order; real awards once; immutable profile/stake under reentrant mutation.','Unrecognized profile/account/history/outcome override fails before RNG.','Native prices/tables/limits/body budgets/shared cap unchanged.','House ordinary cap executes all awarded FS; true hardcap can stop with explicit pending counts.','Actual reserve before RNG; admitted round conserved money and settled once; insufficient funds consume zero RNG.','Whole-round safety failure has no monetary posting and releases its admission hold.']};
if(process.argv.includes('--report'))writeFileSync(new URL('./profile-api-regression.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
