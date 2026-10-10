import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {transformWithOxc} from 'vite';
import {DEMO_RTP_VALUES,isDemoRtp} from '../src/rtp-range.js';
import {ADMIN_GAMES,ADMIN_DEFAULTS,validateAdminDraft,settingsFromSnapshot} from '../src/demo-admin-controls.js';
import {HallSession} from '../src/hall-session.js';
import GameMath from '../src/game-math.js';
import {liabilityTerms} from '../src/liability-terms.js';
import {classicProfileSnapshot} from '../src/classic-rtp-profiles.js';
import {slotProfileSnapshot} from '../src/slot-rtp-profiles.js';
import {createAdminProfileDetails} from '../src/demo-admin-profile-details.js';
import {universalSlotProfileMeasurement} from '../src/universal-slot-profiles.js';
import {createBlackjackHand,blackjackScore,hitBlackjack,standBlackjack,finishBlackjack,evaluateBlackjack} from '../src/blackjack.js';
let checks=0;const eq=(a,b)=>{checks++;assert.deepEqual(a,b);},ok=x=>{checks++;assert.ok(x);},raises=f=>{checks++;assert.throws(f);};
const values=Array.from({length:46},(_,i)=>i+50),clone=x=>structuredClone(x);
eq(DEMO_RTP_VALUES,values);eq(ADMIN_GAMES.length,9);
for(const game of ADMIN_GAMES){
 eq(game.profiles,values);
 for(const value of values){
  const draft=clone(ADMIN_DEFAULTS),field=game.group==='slots'?'rtpProfiles':'classicRtpProfiles';draft[field][game.id]=value;
  const validated=validateAdminDraft(draft);eq(validated[field][game.id],value);ok(isDemoRtp(value));
 }
 for(const value of [49,96,50.5,94.5,NaN,Infinity,'',{},null]){
  const draft=clone(ADMIN_DEFAULTS),field=game.group==='slots'?'rtpProfiles':'classicRtpProfiles';draft[field][game.id]=value;raises(()=>validateAdminDraft(draft));
 }
}
for(const value of [49,96,50.5,'51',true,null])eq(isDemoRtp(value),false);
const panel=readFileSync(new URL('../src/DemoAdminPanel.jsx',import.meta.url),'utf8');
ok(!panel.includes('demo-admin-blackjack-presets'));ok(panel.includes('min={50} max={95} step={1}'));
await transformWithOxc(panel,'DemoAdminPanel.jsx',{jsx:{runtime:'classic'}});
ok(panel.includes('calibrationSamples')&&panel.includes('отдельного прогона нет'));
const detailsFor=createAdminProfileDetails({slotProfileSnapshot,classicProfileSnapshot});
const offers={slots:[{game:'slots',mode:'paid'},{game:'slots',mode:'buy'}],
 maskhouse:[{game:'maskhouse',mode:'paid'},{game:'maskhouse',mode:'buy',bonusTier:'sticky'}],
 lecipher:[{game:'lecipher',mode:'paid'},{game:'lecipher',mode:'buy',bonusTier:'luck'},{game:'lecipher',mode:'buy',bonusTier:'gold'},
  {game:'lecipher',mode:'paid',featureMode:'hunt'},{game:'lecipher',mode:'paid',featureMode:'rainbow'}]};
for(const game of ADMIN_GAMES)for(const value of values){
 const details=detailsFor(game.id,value);eq(details.targetReturnPercent,value);ok(typeof details.rule==='string'&&details.rule.length>20);
 if(game.group==='classic'){
  eq(details.kind,game.id==='blackjack'?'approximate':'exact');
  if(game.id==='blackjack')eq(details.measurements.basic_hit_stand.hands,100000);
 }else if(![50,55,60].includes(value)){
  eq(details.kind,'approximate');eq(details.offers.length,offers[game.id].length);
  for(const offer of offers[game.id]){
   const spec=slotProfileSnapshot(game.id,value,offer),measurement=universalSlotProfileMeasurement(spec,offer),row=details.offers.find(item=>item.id===spec.offer);
   ok(measurement&&row);eq(row.meanPercent,measurement.meanPercent);eq(row.ciPercent,measurement.ciPercent);eq(row.samples,measurement.samples);
   eq(row.evidenceKind,measurement.evidenceKind);
   if(row.evidenceKind==='weighted-native-calibration'){eq(row.samples,null);eq(row.calibrationSamples,measurement.calibrationSamples);ok(row.note.includes('отдельный прогон профиля отсутствует'));}
  }
 }
}
const session=new HallSession(GameMath,n=>n-1,{initialBalanceCents:1000000,houseCapitalCents:1000000});
for(const value of values){
 const before=session.getSnapshot(),draft=settingsFromSnapshot(before);draft.rtpProfiles={slots:value,maskhouse:value,lecipher:value};
 draft.classicRtpProfiles=Object.fromEntries(ADMIN_GAMES.filter(g=>g.group==='classic').map(g=>[g.id,value]));
 const changed=session.setDemoSettings(validateAdminDraft(draft),{expectedRevision:before.profileRevision});
 eq(session.getSnapshot().profileRevision,before.profileRevision+Number(changed));eq(session.getSnapshot().rtpProfiles,draft.rtpProfiles);eq(session.getSnapshot().classicRtpProfiles,draft.classicRtpProfiles);
 const accepted=session.begin('coinflip','heads',5);eq(accepted.rtpProfile.targetReturnPercent,value);eq(accepted.profileRevision,session.getSnapshot().profileRevision);
 raises(()=>session.setDemoSettings(draft,{expectedRevision:accepted.profileRevision}));eq(session.complete(accepted.id),true);eq(session.complete(accepted.id),false);
 const bj=session.beginBlackjack(5),spec=classicProfileSnapshot('blackjack',value);eq(bj.rtpProfile.dealerBoostTickets,spec.dealerBoostTickets);eq(bj.rtpProfile.playerUnfavorableTickets,spec.playerUnfavorableTickets);eq(bj.rtpProfile.targetReturnPercent,value);ok(Object.isFrozen(bj.rtpProfile));
 raises(()=>session.setDemoSettings(draft));const resolved=session.advanceBlackjack(bj.id,'finish',bj.hand);eq(session.completeBlackjack(bj.id,resolved),true);
 const q=liabilityTerms({game:'blackjack',stake:250,rtpProfile:value});eq(q.maxPayoutCents,62500);eq(q.chargeCents,25000);
}
for(const value of [49,96,50.5]){
 let rngCalls=0;const guarded=new HallSession(GameMath,()=>{rngCalls++;return 0;}),before=guarded.getSnapshot(),draft=settingsFromSnapshot(before);draft.classicRtpProfiles.blackjack=value;
 raises(()=>guarded.setDemoSettings(draft));eq(guarded.getSnapshot(),before);eq(rngCalls,0);
}
for(const value of values)for(let seed=1;seed<=100;seed++){
 let state=(seed*7919+value)>>>0;const randomInt=n=>{const limit=Math.floor(4294967296/n)*n;let word;do{state=(Math.imul(state,1664525)+1013904223)>>>0;word=state;}while(word>=limit);return word%n;};
 const spec=classicProfileSnapshot('blackjack',value);let hand=createBlackjackHand({randomInt,dealerBoostTickets:spec.dealerBoostTickets,playerUnfavorableTickets:spec.playerUnfavorableTickets});
 while(hand.phase==='player')hand=blackjackScore(hand.player).total<17?hitBlackjack(hand):standBlackjack(hand);
 hand=finishBlackjack(hand);eq(new Set(hand.shoe.map(c=>c.id)).size,312);eq(new Set([...hand.player,...hand.dealer].map(c=>c.id)).size,hand.cursor);ok([0,1,2,2.5].includes(evaluateBlackjack(hand).payoutMultiplier));
}
const result={passed:true,checks,games:9,profilesPerGame:46,min:50,max:95,step:1,blackjackPhysicalHands:4600,
 coverage:'All414 catalogue/form/evidence values; integer bounds; atomic accepted future profiles; stale/busy rejection; unchanged Blackjack cap and payouts; unique finite six-deck cards; RTP control JSX; source-specific slot evidence and honest shared-calibration labels.'};
writeFileSync(new URL('./demo-rtp-range-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
