import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {applyBonusPurchaseFloor,bonusPurchaseFloorSnapshot,bonusPurchaseMinimumCents,BONUS_PURCHASE_FLOOR_REVISION} from '../src/bonus-purchase-floor.js';
import {BONANZA_SYMBOLS,BONANZA_DEMO_RULES,simulateBonanzaRound} from '../src/bonanza.js';
import {simulateProfiledBonanzaRound} from '../src/profiled-bonanza.js';
import {playProfiledMaskSlot} from '../src/profiled-mask-slots.js';
import {slotProfileSnapshot} from '../src/slot-rtp-profiles.js';
import {HallSession} from '../src/hall-session.js';
import {liabilityTerms} from '../src/liability-terms.js';
import GameMath from '../src/game-math.js';
import {buildBonanzaTimeline,createBonusPurchaseController} from '../src/BonanzaPresentation.js';
import {maskSlotSteps} from '../src/mask-slot-presentation.js';
let checks=0;const sections=[],failures=[];
const eq=(a,b,m)=>{checks++;assert.deepEqual(a,b,m);},ok=(v,m)=>{checks++;assert.ok(v,m);},raises=(fn,m)=>{checks++;assert.throws(fn,m);};
function section(name,run){try{run();sections.push({name,passed:true});}catch(error){failures.push({name,message:error.message,stack:error.stack});}}
const grid=flat=>Array.from({length:6},(_,column)=>flat.slice(column*5,column*5+5));
const regular=(count,skip=0)=>Array.from({length:count},(_,index)=>BONANZA_SYMBOLS[skip+index%(BONANZA_SYMBOLS.length-skip)]);
function cycle(){let index=0;return max=>{const kind=BONANZA_SYMBOLS[index++%BONANZA_SYMBOLS.length];let value=0;for(const [item,weight] of BONANZA_DEMO_RULES.freeWeights){if(item===kind)break;value+=weight;}assert.ok(value<max);return value;};}
function random(seed,trace=[]){let s=seed>>>0;return max=>{trace.push(max);const cut=Math.floor(4294967296/max)*max;let x;do{s=(s+0x6D2B79F5)>>>0;x=s;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);x=(x^(x>>>14))>>>0;}while(x>=cut);return x%max;};}
const offers=[{game:'slots',mode:'buy'},{game:'maskhouse',mode:'buy',bonusTier:'sticky'},{game:'lecipher',mode:'buy',bonusTier:'luck'},{game:'lecipher',mode:'buy',bonusTier:'gold'}];
const rawRound=(offer,value,seed,trace=[])=>offer.game==='slots'?simulateProfiledBonanzaRound(5000,{...offer,rtpProfile:value,randomInt:random(seed,trace)}):playProfiledMaskSlot({...offer,stakeCents:5000,rtpProfile:value,randomInt:random(seed,trace)});
function reconcile(raw,final){
 eq(final.payoutCents,Math.max(raw.payoutCents,bonusPurchaseMinimumCents(raw.chargeCents)));
 eq(final.enginePayoutCents,raw.payoutCents);eq(final.bonusPurchaseFloorPaymentCents,final.payoutCents-raw.payoutCents);
 eq(final.spins.reduce((sum,spin)=>sum+spin.payoutCents,0),final.payoutCents);eq(final.ledger.creditCents,final.payoutCents);eq(final.ledger.chargeCents,raw.chargeCents);
 if(Object.hasOwn(raw.ledger,'deltaCents'))eq(final.ledger.deltaCents,final.payoutCents-raw.chargeCents);
 eq(final.bonusPaymentCents,(raw.bonusPaymentCents??0)+final.bonusPurchaseFloorPaymentCents);
 eq(final.freeSpinsAwarded,raw.freeSpinsAwarded);eq(final.freeSpinsPlayed,raw.freeSpinsPlayed);eq(final.unplayedFreeSpins,raw.unplayedFreeSpins);
 eq(final.winCapCents??final.capCents,raw.winCapCents??raw.capCents);ok(final.payoutCents<=(final.winCapCents??final.capCents));
 ok(Object.isFrozen(final));ok(Object.isFrozen(final.spins));eq(applyBonusPurchaseFloor(final,{game:raw.game??'slots',mode:'buy'}),final);
 for(let index=0;index<raw.spins.length;index++){
  const before=raw.spins[index],after=final.spins[index];eq(after.initial,before.initial);eq(after.terminal,before.terminal);eq(after.awardedSpins,before.awardedSpins);
  before.frames.forEach((frame,i)=>eq(after.frames[i],frame));
  if(index!==raw.spins.length-1||!final.bonusPurchaseFloorPaymentCents)eq(after,before);
 }
 if(final.bonusPurchaseFloorPaymentCents){const frame=final.spins.at(-1).frames.at(-1);
  eq(frame.phase,'bonus-payment');eq(frame.before,frame.after);eq(frame.wins[0].cells,[]);eq(frame.removed,[]);eq(frame.refill,[]);
  eq(frame.payoutCents,final.bonusPurchaseFloorPaymentCents);eq(frame.creditedPayoutCents,frame.payoutCents);eq(frame.wins[0].creditedPayoutCents,frame.payoutCents);
 }
}
section('minimum uses full purchase price and safe whole cents; pinned descriptor distinguishes buys',()=>{
 eq(bonusPurchaseMinimumCents(50000),5000,'500 AR price gives 50 AR minimum, independent of base stake');
 eq(bonusPurchaseMinimumCents(1),1);eq(bonusPurchaseMinimumCents(11),2);eq(bonusPurchaseMinimumCents(Number.MAX_SAFE_INTEGER),900719925474100);
 eq(bonusPurchaseMinimumCents(50000,'paid'),0);eq(bonusPurchaseMinimumCents(50000,'preview'),0);
 for(const value of [-1,NaN,Infinity,0.5,Number.MAX_SAFE_INTEGER+1])raises(()=>bonusPurchaseMinimumCents(value));
 for(const mode of ['paid','buy','preview']){const rule=bonusPurchaseFloorSnapshot(mode);eq(rule.applies,mode==='buy');eq(rule.minimumReturnBasisPoints,mode==='buy'?1000:0);eq(rule.additionalRng,false);ok(Object.isFrozen(rule));eq(rule.revision,BONUS_PURCHASE_FLOOR_REVISION);}
 raises(()=>bonusPurchaseFloorSnapshot('gift'));
});
section('actual Bonanza zero, partial, above minimum, retrigger and cap fixtures reconcile',()=>{
 const fixtures=[{expected:0,initial:undefined},{expected:2390,initial:grid([...Array(8).fill('hood'),...regular(22,1)])},
  {expected:7170,initial:grid([...Array(8).fill('hood'),{kind:'bomb',value:3},...regular(21,1)])},
  {expected:0,awards:15,initial:grid([...Array(3).fill('scatter'),...regular(27)])},
  {expected:99900,initial:grid([...Array(12).fill('hood'),...Array.from({length:18},()=>({kind:'bomb',value:25}))])}];
 for(const fixture of fixtures){const raw=simulateBonanzaRound(1000,{mode:'buy',initialGrid:fixture.initial,randomInt:cycle()});eq(raw.payoutCents,fixture.expected);
  const final=applyBonusPurchaseFloor(raw,{game:'slots',mode:'buy'});reconcile(raw,final);eq(final.bonusMinimumCents,5000);
  eq(final.freeSpinsAwarded,fixture.awards??10);eq(final.freeSpinsPlayed,final.freeSpinsAwarded);eq(final.unplayedFreeSpins,0);
  if(!final.bonusPurchaseFloorPaymentCents)eq(final.spins,raw.spins);
  const timeline=buildBonanzaTimeline(final),payments=timeline.steps.filter(step=>step.visual.phase==='bonus-payment');eq(payments.length,final.bonusPurchaseFloorPaymentCents?1:0);
  eq(timeline.terminal.totalPayoutCents,final.payoutCents);eq(timeline.terminal.bonusPayoutCents,final.payoutCents);
  eq(timeline.steps.filter(step=>step.visual.phase==='spin-summary').reduce((sum,step)=>sum+step.visual.spinSummary.payoutCents,0),raw.payoutCents);
  if(payments.length){const visual=payments[0].visual;eq(visual.bonusPaymentCents,final.bonusPurchaseFloorPaymentCents);eq(visual.totalPayoutCents,final.payoutCents);eq(visual.bonusPurchaseCostCents,50000);eq(visual.bonusMinimumCents,5000);eq(visual.winningIds,[]);eq(visual.payoutGroups,[]);}
 }
});
section('paid natural bonuses and previews preserve original object and native rules',()=>{
 const natural=simulateBonanzaRound(1000,{mode:'paid',initialGrid:grid([...Array(4).fill('scatter'),...regular(26)]),randomInt:cycle()});ok(natural.bonusTriggered);
 eq(applyBonusPurchaseFloor(natural,{mode:'paid'}),natural);eq(natural.freeSpinsAwarded,10);eq(natural.bonusPurchaseFloorApplied,undefined);
 const preview=simulateBonanzaRound(1000,{mode:'preview',randomInt:cycle()});eq(applyBonusPurchaseFloor(preview,{mode:'preview'}),preview);eq(preview.chargeCents,0);
 for(const offer of offers.slice(1))for(let seed=1;seed<=80;seed++){const selection={...offer,mode:'paid'},raw=playProfiledMaskSlot({...selection,stakeCents:5000,rtpProfile:50,randomInt:random(seed)});
  eq(applyBonusPurchaseFloor(raw,{game:offer.game,mode:'paid'}),raw);if(raw.bonusTriggered)eq(raw.bonusMinimumCents,Math.floor(5000*(raw.bonusTier==='gold'?25:20)*0.05));
 }
});
section('all public source endpoints and tiers retain exact engine frames and RNG; existing5% is credited once',()=>{
 let floorCount=0,existingCount=0;
 for(const value of [50,55,60])for(const offer of offers)for(let trial=1;trial<=50;trial++){
  const trace=[],raw=rawRound(offer,value,0xBF100000+value*1000+trial,trace),count=trace.length,rule=slotProfileSnapshot(offer.game,value,offer);
  const final=applyBonusPurchaseFloor(raw,{...offer,profileRules:rule});eq(trace.length,count);reconcile(raw,final);
  if(final.bonusPurchaseFloorPaymentCents)floorCount++;if(raw.bonusPaymentCents){existingCount++;ok(final.bonusPaymentCents>=raw.bonusPaymentCents);}
  if(offer.game!=='slots'){const timeline=maskSlotSteps(final);eq(timeline.terminal.totalPayoutCents,final.payoutCents);}
 }
 ok(floorCount>0);ok(existingCount>0);
});
section('unsupported purchases, charge conflicts, unsafe cents, cap conflicts and malformed results reject',()=>{
 const raw=simulateBonanzaRound(1000,{mode:'buy',randomInt:cycle()});
 raises(()=>applyBonusPurchaseFloor(null));raises(()=>applyBonusPurchaseFloor(raw,{game:'coinflip',mode:'buy'}));raises(()=>applyBonusPurchaseFloor(raw,{mode:'buy',chargeCents:49999}));
 raises(()=>applyBonusPurchaseFloor({...raw,preview:true},{mode:'buy'}));raises(()=>applyBonusPurchaseFloor({...raw,winCapCents:4999},{mode:'buy'}));
 raises(()=>applyBonusPurchaseFloor({...raw,payoutCents:1},{mode:'buy'}));raises(()=>applyBonusPurchaseFloor({...raw,payoutCents:0.5},{mode:'buy'}));
 raises(()=>applyBonusPurchaseFloor(raw,{mode:'buy',profileRules:{bonusPurchaseFloor:bonusPurchaseFloorSnapshot('paid')}}));
 const final=applyBonusPurchaseFloor(raw,{mode:'buy'});raises(()=>applyBonusPurchaseFloor({...final,enginePayoutCents:1},{mode:'buy'}));
});
section('Hall pins minimum before RNG, reserves published cap, charges once and settles added payment once',()=>{
 for(const offer of offers){let session,calls=0;const trace=[],seed=0xBF202020+offers.indexOf(offer),engineRng=random(seed,trace),quote=liabilityTerms({...offer,stake:50,rtpProfile:50});
  session=new HallSession(GameMath,max=>{calls++;if(calls===1){eq(session.balanceCents,5000000);eq(session.getReserveSnapshot().reservedCents,quote.maxHouseLossCents);eq(quote.profileRules.bonusPurchaseFloor.minimumReturnBasisPoints,1000);ok(Object.isFrozen(quote.profileRules.bonusPurchaseFloor));}return engineRng(max);},{initialBalanceCents:5000000,houseCapitalCents:5000000});
  const round=session.begin(offer.game,offer.game,50,offer),pureTrace=[],raw=rawRound(offer,50,seed,pureTrace),final=applyBonusPurchaseFloor(raw,{...offer,profileRules:quote.profileRules});
  eq(round.payoutCents,final.payoutCents);eq(round.spins,final.spins);eq(trace,pureTrace);eq(round.rtpProfile.bonusPurchaseFloor,quote.profileRules.bonusPurchaseFloor);
  eq(session.balanceCents,5000000-round.chargeCents);eq(session.getReserveSnapshot().reservedCents,quote.maxHouseLossCents);
  const count=calls;eq(session.complete(round.id),true);eq(session.balanceCents,5000000-round.chargeCents+round.payoutCents);
  const settled=session.getSnapshot(),reserve=session.getReserveSnapshot();eq(session.complete(round.id),false);eq(session.completeStored({...round}),false);eq(session.getSnapshot(),settled);eq(session.getReserveSnapshot(),reserve);eq(calls,count);
 }
 const session=new HallSession(GameMath,cycle(),{initialBalanceCents:100000,houseCapitalCents:5000000}),controller=createBonusPurchaseController(session),intent=controller.open(10);
 eq(intent.costCents,50000);eq(controller.cancel(intent.id),true);eq(session.balanceCents,100000);const bought=controller.open(10),round=controller.confirm(bought.id);
 eq(round.payoutCents,5000);eq(round.bonusPurchaseFloorPaymentCents,5000);eq(round.chargeCents,50000);eq(controller.confirm(bought.id),null);eq(session.balanceCents,50000);eq(session.complete(round.id),true);eq(session.balanceCents,55000);eq(session.complete(round.id),false);
});
const sourceSHA256={};for(const name of ['bonus-purchase-floor.js','hall-session.js','slot-rtp-profiles.js','BonanzaPresentation.js','bonanza.js','bonanza-profile-engine.js','mask-slots.js'])sourceSHA256[name]=createHash('sha256').update(readFileSync(new URL('../src/'+name,import.meta.url))).digest('hex');
eq(sourceSHA256['bonanza.js'],'6868ec7dc51da9aba0a8c8a37f5ee9bb6b2267cab7e14940b62c5ea8270b0d96');eq(sourceSHA256['bonanza-profile-engine.js'],'94d49ce4315f7c788818f393c7aca9c855951f87ef2b2c5787c84b78fcaef4a4');eq(sourceSHA256['mask-slots.js'],'6e79d505a7a76fee47d47083cc5c2706d58e92332450ff541c1e9d659c8e4d0a');
const result={status:failures.length?'failed':'passed',version:BONUS_PURCHASE_FLOOR_REVISION,checks,sections,sourceSHA256,failures};
if(process.argv.includes('--report'))writeFileSync(new URL('./bonus-purchase-floor-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));if(failures.length)process.exitCode=1;
