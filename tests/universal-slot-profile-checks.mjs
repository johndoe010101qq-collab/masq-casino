import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import calibration from '../src/universal-slot-calibration.json' with {type:'json'};
import holdoutStatistics from '../src/universal-slot-statistics.json' with {type:'json'};
import {DEMO_RTP_VALUES} from '../src/rtp-range.js';
import {getUniversalSlotProfileSnapshot,universalSlotProfileMeasurement,UNIVERSAL_SLOT_TICKET_COUNT,UNIVERSAL_SLOT_MAX_CANDIDATES,SlotCandidateLimitError} from '../src/universal-slot-profiles.js';
import {playUniversalSlotRound} from '../src/universal-slot-admission.js';
import {simulateProfiledBonanzaRound} from '../src/profiled-bonanza.js';
import {playProfiledMaskSlot} from '../src/profiled-mask-slots.js';
import {slotProfileSnapshot,validateSlotProfiles} from '../src/slot-rtp-profiles.js';
import {applyBonusPurchaseFloor,bonusPurchaseMinimumCents} from '../src/bonus-purchase-floor.js';
import {liabilityTerms} from '../src/liability-terms.js';
import {HallSession} from '../src/hall-session.js';
import GameMath from '../src/game-math.js';
import {stakeLimits} from '../src/stake-limits.js';
import {buildBonanzaTimeline} from '../src/BonanzaPresentation.js';
import {maskSlotSteps} from '../src/mask-slot-presentation.js';
let checks=0;const sections=[],failures=[];
const eq=(a,b,m)=>{checks++;assert.deepEqual(a,b,m);},ok=(value,m)=>{checks++;assert.ok(value,m);},raises=(run,type)=>{checks++;assert.throws(run,type);};
const section=(name,run)=>{try{run();sections.push({name,passed:true});}catch(error){sections.push({name,passed:false});failures.push({name,message:error.message,stack:error.stack});}};
const offers=[{game:'slots',mode:'paid'},{game:'slots',mode:'buy'},
 {game:'maskhouse',mode:'paid'},{game:'maskhouse',mode:'buy',bonusTier:'sticky'},
 {game:'lecipher',mode:'paid'},{game:'lecipher',mode:'buy',bonusTier:'luck'},{game:'lecipher',mode:'buy',bonusTier:'gold'},
 {game:'lecipher',mode:'paid',featureMode:'hunt'},{game:'lecipher',mode:'paid',featureMode:'rainbow'}];
function rng(seed,trace){let state=seed>>>0;return max=>{if(trace)trace.push(max);const cut=Math.floor(4294967296/max)*max;let x;do{state=(state+0x6D2B79F5)>>>0;x=state;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);x=(x^(x>>>14))>>>0;}while(x>=cut);return x%max;};}
const all=value=>({slots:value,maskhouse:value,lecipher:value});
const native=(offer,stakeCents,profile,randomInt)=>offer.game==='slots'?simulateProfiledBonanzaRound(stakeCents,{mode:offer.mode,rtpProfile:profile,randomInt}):playProfiledMaskSlot({...offer,stakeCents,rtpProfile:profile,randomInt});
function reconcile(raw,final,quote){
 eq(raw.spins.reduce((sum,spin)=>sum+spin.payoutCents,0),raw.payoutCents);eq(raw.ledger.creditCents,raw.payoutCents);
 eq(final.spins.reduce((sum,spin)=>sum+spin.payoutCents,0),final.payoutCents);eq(final.ledger.creditCents,final.payoutCents);
 eq(final.chargeCents,quote.chargeCents);eq(final.ledger.chargeCents,quote.chargeCents);ok(final.payoutCents<=quote.maxPayoutCents);ok(Number.isSafeInteger(final.payoutCents));
 if(final.mode==='buy'){ok(final.payoutCents>=bonusPurchaseMinimumCents(quote.chargeCents));eq(applyBonusPurchaseFloor(final,{game:quote.game,mode:'buy'}),final);}
 else eq(final,raw);
 for(let index=0;index<raw.spins.length;index++){
  const before=raw.spins[index],after=final.spins[index];eq(after.initial,before.initial);eq(after.terminal,before.terminal);
  before.frames.forEach((frame,i)=>eq(after.frames[i],frame));eq(after.awardedSpins,before.awardedSpins);
 }
 if(quote.game==='slots'){const timeline=buildBonanzaTimeline(final);eq(timeline.terminal.totalPayoutCents,final.payoutCents);}
 else {const timeline=maskSlotSteps(final);ok(timeline.steps.length>0);}
}
section('calibration receipt and every sealed native source are exact',()=>{
 eq(calibration.status,'passed');const {sourceSHA256,...payload}=calibration;
 eq(createHash('sha256').update(JSON.stringify(payload)).digest('hex'),sourceSHA256);
 for(const [name,hash]of Object.entries(calibration.engineSourceSHA256))eq(createHash('sha256').update(readFileSync(new URL('../src/'+name,import.meta.url))).digest('hex'),hash,name);
 eq(Object.keys(calibration.offers).length,9);eq(calibration.totalAccepted,Object.values(calibration.offers).reduce((sum,row)=>sum+row.accepted,0));
 for(const row of Object.values(calibration.offers)){eq(row.profit.count+row.nonprofit.count,row.accepted);ok(row.profit.count>0);ok(row.nonprofit.count>0);
  eq(row.profit.probability+row.nonprofit.probability,1);eq(row.profit.payoutSumCents+row.nonprofit.payoutSumCents,row.payoutSumCents);}
});
section('all46 public targets and nine offers use pinned fixed acceptance parameters',()=>{
 eq(DEMO_RTP_VALUES.length,46);
 for(const value of DEMO_RTP_VALUES){eq(validateSlotProfiles(all(value)),all(value));
  for(const offer of offers){const snapshot=slotProfileSnapshot(offer.game,value,offer),quote=liabilityTerms({...offer,stake:50,rtpProfile:value});
   eq(snapshot.targetReturnPercent,value);eq(quote.rtpProfile,'rtp'+value);ok(Object.isFrozen(snapshot));ok(Object.isFrozen(snapshot.bonusPurchaseFloor));
   eq(quote.maxPayoutCents,liabilityTerms({...offer,stake:50,rtpProfile:50}).maxPayoutCents);eq(quote.chargeCents,liabilityTerms({...offer,stake:50,rtpProfile:50}).chargeCents);
   if([50,55,60].includes(value))continue;
   eq(snapshot.selectionMethod,'public-whole-candidate-weighting');eq(snapshot.baselineProfile,'rtp50');eq(snapshot.acceptance.maxCandidates,512);eq(snapshot.acceptance.ticketBeforeCandidate,true);
   for(const weight of [snapshot.acceptance.profitableTicketWeight,snapshot.acceptance.otherTicketWeight])ok(Number.isSafeInteger(weight)&&weight>=1&&weight<=UNIVERSAL_SLOT_TICKET_COUNT);
   ok(Math.abs(snapshot.calibrationPredictedReturn-value/100)<1e-7);
   const sample=universalSlotProfileMeasurement(snapshot,offer);ok(sample);ok(sample.evidenceKind==='independent-holdout'||sample.samples===null);
   if(sample.samples===null)eq(sample.calibrationSamples,calibration.offers[snapshot.offer].accepted);
   eq(universalSlotProfileMeasurement(snapshot,offer,500),null);
  }
 }
 for(const value of [49,96,50.5,'55',null,NaN,Infinity])raises(()=>validateSlotProfiles(all(value)));
 for(const input of [{...all(50),userId:'a'},{...all(50),balance:1},{slots:50,maskhouse:50}])raises(()=>validateSlotProfiles(input));
});
section('independent endpoint evidence matches sealed sampler, actual full charge and real counts',()=>{
 eq(holdoutStatistics.status,'passed');eq(holdoutStatistics.calibrationSourceSHA256,calibration.sourceSHA256);
 for(const [name,hash]of Object.entries(holdoutStatistics.engineSourceSHA256)){
  if(name==='universal-slot-statistics.json')continue; // Initial evidence context is not a sampling parameter.
  eq(createHash('sha256').update(readFileSync(new URL('../src/'+name,import.meta.url))).digest('hex'),hash,name);
 }
 eq(holdoutStatistics.rows.length,27);eq(holdoutStatistics.totalAccepted,990000);
 eq(holdoutStatistics.rows.reduce((sum,row)=>sum+row.accepted,0),holdoutStatistics.totalAccepted);
 for(const row of holdoutStatistics.rows){
  ok([50,70,95].includes(row.profile));eq(row.accepted,row.mode==='paid'?50000:20000);eq(row.rejectedRequests,0);
  ok(Math.abs(row.meanPercent-row.payoutSumCents/row.accepted/row.chargeCents*100)<1e-8);
  ok(row.ciPercent[0]<=row.meanPercent&&row.ciPercent[1]>=row.meanPercent);
  eq(row.profitFraction,row.profitCount/row.accepted);
  for(const tail of Object.values(row.tail))eq(tail.frequency,tail.count/row.accepted);
  if(row.mode==='buy')eq(row.zeroCount,0);
  if(row.profile===50)continue;
  const offer=offers.find(item=>slotProfileSnapshot(item.game,row.profile,item).offer===row.offer),snapshot=slotProfileSnapshot(offer.game,row.profile,offer),sample=universalSlotProfileMeasurement(snapshot,offer);
  eq(sample.meanPercent,row.meanPercent);eq(sample.ciPercent,row.ciPercent);eq(sample.samples,row.accepted);eq(sample.evidenceKind,'independent-holdout');
 }
});
section('legacy50/55/60 preserve exact native result and RNG trace on every offer',()=>{
 for(const profile of [50,55,60])for(const offer of offers){const a=[],b=[],seed=0x161A0000+profile+offers.indexOf(offer)*100;
  const one=playUniversalSlotRound({...offer,stakeCents:5000,rtpProfile:profile,randomInt:rng(seed,a)}),two=native(offer,5000,profile,rng(seed,b));eq(one,two);eq(a,b);
 }
});
section('one independent ticket precedes unchanged entire accepted native candidate',()=>{
 for(const offer of offers){const seed=0x161B0000+offers.indexOf(offer),trace=[];let first=true;
  const tail=rng(seed,trace),randomInt=max=>{if(first){first=false;eq(max,UNIVERSAL_SLOT_TICKET_COUNT);return 0;}return tail(max);};
  const selected=playUniversalSlotRound({...offer,stakeCents:5000,rtpProfile:95,randomInt}),expectedTrace=[],expected=native(offer,5000,50,rng(seed,expectedTrace));
  const {publicCandidateSelection,mathNotice,...before}=selected,{mathNotice:oldNotice,...baseline}=expected;eq(before,baseline);eq(trace,expectedTrace);eq(publicCandidateSelection.attempts,1);
  eq(selected.spins,expected.spins);eq(selected.ledger,expected.ledger);eq(publicCandidateSelection.classificationPayoutCents,offer.mode==='buy'?Math.max(expected.payoutCents,bonusPurchaseMinimumCents(expected.chargeCents)):expected.payoutCents);
 }
});
section('all profiles, offers and stake endpoints preserve cents, frames, floor and full liability',()=>{
 for(const profile of DEMO_RTP_VALUES)for(const offer of offers)for(const stakeCents of [stakeLimits(offer.game).min*100,5000,stakeLimits(offer.game).max*100]){
  const selected=playUniversalSlotRound({...offer,stakeCents,rtpProfile:profile,randomInt:rng(0x161C0000+profile*1024+offers.indexOf(offer)*50+stakeCents)}),quote=liabilityTerms({...offer,stake:stakeCents/100,rtpProfile:profile});
  const final=offer.mode==='buy'?applyBonusPurchaseFloor(selected,{game:offer.game,mode:'buy',profileRules:quote.profileRules}):selected;reconcile(selected,final,quote);
  if(selected.publicCandidateSelection){ok(selected.publicCandidateSelection.attempts<=512);eq(selected.publicCandidateSelection.profile,'rtp'+profile);eq(selected.publicCandidateSelection.rawCandidateUnchanged,true);}
 }
});
section('bad identity, history, outcome override or RNG input rejects without candidate fallback',()=>{
 const base={game:'slots',stakeCents:5000,rtpProfile:95,randomInt:rng(1)};
 for(const extra of [{userId:'a'},{balance:5000},{history:[]},{initialGrid:[]},{maxCandidates:1000},{payoutCents:1},{capCents:100},{probabilityWeights:{}}])raises(()=>playUniversalSlotRound({...base,...extra}));
 for(const value of [-1,UNIVERSAL_SLOT_TICKET_COUNT,NaN,0.5])raises(()=>playUniversalSlotRound({...base,randomInt:()=>value}));
 for(const offer of [{game:'slots',mode:'buy',bonusTier:'gold'},{game:'lecipher',mode:'buy',featureMode:'rainbow'},{game:'maskhouse',mode:'paid',featureMode:'hunt'}])raises(()=>playUniversalSlotRound({...base,...offer}));
 let calls=0;for(const game of ['slots','maskhouse','lecipher'])for(const stakeCents of [-1,0,1,499,501,NaN,Infinity,stakeLimits(game).max*100+500]){
  raises(()=>playUniversalSlotRound({...base,game,stakeCents,randomInt:()=>{calls++;throw Error('Invalid stake must precede RNG');}}));eq(calls,0);
 }
});
section('512 nonaccepted whole candidates abort and Hall cancels liability without debit',()=>{
 let seed=1;for(;seed<10000;seed++)if(native({game:'slots',mode:'paid'},5000,50,rng(seed)).payoutCents===0)break;ok(seed<10000);
 let tickets=0,tail;const reject=max=>{if(max===UNIVERSAL_SLOT_TICKET_COUNT){tickets++;tail=rng(seed);return max-1;}return tail(max);};
 raises(()=>playUniversalSlotRound({game:'slots',stakeCents:5000,rtpProfile:95,randomInt:reject}),SlotCandidateLimitError);eq(tickets,UNIVERSAL_SLOT_MAX_CANDIDATES);
 const session=new HallSession(GameMath,reject,{initialBalanceCents:5000000,houseCapitalCents:5000000,rtpProfiles:all(95)}),before=session.getSnapshot(),reserve=session.getReserveSnapshot();
 raises(()=>session.begin('slots','slots',50),SlotCandidateLimitError);eq(session.getSnapshot(),before);eq(session.getReserveSnapshot(),reserve);eq(session.balanceCents,5000000);eq(session.id,0);eq(session.active.size,0);
});
section('Hall pins settings before RNG, charges once, settles stored cents once and conserves funds',()=>{
 for(const offer of offers){let first=true,session;const random=rng(0x161D0000+offers.indexOf(offer));
  session=new HallSession(GameMath,max=>{if(first){first=false;eq(max,UNIVERSAL_SLOT_TICKET_COUNT);eq(session.balanceCents,5000000);eq(session.id,0);eq(session.getReserveSnapshot().activeCount,1);raises(()=>session.setRtpProfiles(all(70)));eq(session.begin('coinflip','heads',5),null);}return random(max);},{initialBalanceCents:5000000,houseCapitalCents:5000000,rtpProfiles:all(95)});
  const {game,...options}=offer,round=session.begin(game,game,50,options);eq(round.rtpProfile.targetReturnPercent,95);eq(session.balanceCents,5000000-round.chargeCents);eq(round.publicCandidateSelection.profile,'rtp95');
  eq(session.complete(round.id),true);eq(session.balanceCents,5000000-round.chargeCents+round.payoutCents);eq(session.balanceCents+session.getReserveSnapshot().bankCents,10000000);
  const done=session.getSnapshot(),reserve=session.getReserveSnapshot();eq(session.complete(round.id),false);eq(session.completeStored({...round}),false);eq(session.getSnapshot(),done);eq(session.getReserveSnapshot(),reserve);
  eq(session.setRtpProfiles(all(70)),true);eq(round.rtpProfile.targetReturnPercent,95);eq(round.profileRevision,1);
 }
});
section('display-only preview has no charge, weighted monetary claim, wallet credit or history',()=>{
 const session=new HallSession(GameMath,rng(0x161E0000),{rtpProfiles:all(95)}),opening=session.balanceCents,reserve=session.getReserveSnapshot();
 const round=session.begin('slots','slots',50,{mode:'preview'});eq(round.chargeCents,0);eq(round.rtpProfile.targetReturnPercent,95);eq(round.rtpProfile.acceptance,null);eq(round.publicCandidateSelection,undefined);
 eq(session.complete(round.id),true);eq(session.balanceCents,opening);eq(session.getReserveSnapshot(),reserve);eq(session.getSnapshot().history.length,0);
});
const result={status:failures.length?'failed':'passed',checks,sections,failures,profileCount:46,offerCount:9,calibrationSourceSHA256:calibration.sourceSHA256};
if(process.argv.includes('--report'))writeFileSync(new URL('universal-slot-profile-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));if(failures.length)process.exitCode=1;
