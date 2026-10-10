import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import GameMath,{ROULETTE_NUMBERS,rouletteColor,PLINKO_PATH_WEIGHTS} from '../src/game-math.js';
import {HallSession} from '../src/hall-session.js';
import {createBlackjackHand,blackjackPublicView,hitBlackjack,finishBlackjack} from '../src/blackjack.js';
import {liabilityTerms,maximumSafeStake} from '../src/liability-terms.js';
import {createDemoReserve} from '../src/demo-reserve.js';
import {DEFAULT_DEMO_SETTINGS,validateDemoSettings} from '../src/demo-settings.js';
import {CLASSIC_PROFILE_GAMES,DEFAULT_CLASSIC_PROFILES,CLASSIC_EXACT_PROFILE_VALUES,BLACKJACK_PROFILE_VALUES,
 classicRules,settleClassic,classicProfileSnapshot,validateClassicProfiles} from '../src/classic-rtp-profiles.js';
let checks=0;const sections=[];
const eq=(a,b,m)=>{checks++;assert.deepEqual(a,b,m);},ok=(x,m)=>{checks++;assert.ok(x,m);},raises=fn=>{checks++;assert.throws(fn);};
const section=(name,fn)=>{fn();sections.push({name,passed:true});console.log(JSON.stringify({name,passed:true}));};
const clone=value=>JSON.parse(JSON.stringify(value));
function rng(seed,trace=[]){let state=seed>>>0;return n=>{trace.push(n);const limit=Math.floor(4294967296/n)*n;let x;do{state=(Math.imul(state,1664525)+1013904223)>>>0;x=state;}while(x>=limit);return x%n;};}
const choices={coinflip:['heads','tails'],dice:[1,2,3,4,5,6],roulette:['red','black','green',...Array.from({length:37},(_,i)=>i)],plinko:['standard','normal'],upgrader:[1.5,2,4,8]};
const financial=q=>({stakeCents:q.stakeCents,chargeCents:q.chargeCents,maxPayoutCents:q.maxPayoutCents,maxHouseLossCents:q.maxHouseLossCents});

section('strict detached global maps and complete public rules',()=>{
 const profile=clone(DEFAULT_CLASSIC_PROFILES),validated=validateClassicProfiles(profile);profile.coinflip=95;eq(validated.coinflip,70);ok(Object.isFrozen(validated));
 for(const invalid of [null,[],{}, {...DEFAULT_CLASSIC_PROFILES,player:'a'}, {...DEFAULT_CLASSIC_PROFILES,coinflip:'70'}, {...DEFAULT_CLASSIC_PROFILES,coinflip:NaN}, {...DEFAULT_CLASSIC_PROFILES,blackjack:96}])raises(()=>validateClassicProfiles(invalid));
 eq(BLACKJACK_PROFILE_VALUES,Array.from({length:46},(_,index)=>50+index));
 for(const game of CLASSIC_PROFILE_GAMES)for(const value of [49,96,50.5,94.5,Infinity,NaN,'51',null])raises(()=>classicProfileSnapshot(game,value));
 for(const game of CLASSIC_PROFILE_GAMES)for(const value of game==='blackjack'?BLACKJACK_PROFILE_VALUES:CLASSIC_EXACT_PROFILE_VALUES){
  const p=classicProfileSnapshot(game,value);ok(Object.isFrozen(p));eq(p.id,'rtp'+value);eq(typeof p.rule,'string');ok(p.rule.length>20);eq(p.global,true);eq(p.committedBeforeRng,true);
  if(game==='blackjack'){eq(p.kind,'approximate');eq(p.decks,6);ok(p.measurements.handsPerStrategy>=100000);ok(p.measurements.basic_hit_stand.return95CI_Percent.length===2);}
 }
 eq(classicProfileSnapshot('upgrader',70,{choice:1.5}).actualReturnPercent,69.99);
});
section('native70 pure ticket outcomes and RNG parity',()=>{
 for(const[game,values]of Object.entries(choices))for(const choice of values){
  const config=GameMath.rules(game,choice);eq(classicRules(game,choice,70),config);
  const random=rng(831+values.indexOf(choice)),tickets=[0,config.sampleSize-1,...Array.from({length:20},()=>random(config.sampleSize))];
  if(config.chance)tickets.push(config.chance-1,config.chance);
  for(const ticket of tickets)eq(settleClassic(game,choice,5,1000,ticket,70),GameMath.settle(game,choice,5,1000,ticket));
 }
 for(const[game,choice]of [['coinflip','heads'],['dice',3],['roulette','red'],['roulette',7],['plinko','standard'],['upgrader',1.5]]){
  const a=[],b=[],random=rng(9191,a),next=new HallSession(GameMath,rng(9191,b));
  const one=GameMath.settle(game,choice,5,1000,random(GameMath.rules(game,choice).sampleSize)),two=next.begin(game,choice,5);eq(a,b);eq(two.outcome,one.outcome);eq(two.payoutCents,one.payoutCents);eq(two.expectedGrossReturn,one.expectedGrossReturn);
 }
 for(let seed=1;seed<=100;seed++){
  const a=[],b=[],next=new HallSession(GameMath,rng(seed,b)),publicHandle=hand=>({...blackjackPublicView(hand),phase:hand.phase});
  let one=createBlackjackHand({randomInt:rng(seed,a)}),current=next.beginBlackjack(5),two=current.hand;eq(publicHandle(one),two);
  while(one.phase==='player'&&blackjackPublicView(one).playerTotal<16){one=hitBlackjack(one);two=next.advanceBlackjack(current.id,'hit',two);eq(publicHandle(one),two);}
  one=finishBlackjack(one);two=next.advanceBlackjack(current.id,'finish',two);eq(publicHandle(one),two);eq(a,b);
  eq(blackjackPublicView(one,{revealed:true,settled:true}),next.blackjackView(current.id,two,{revealed:true,settled:true}));
 }
});
section('every exact map conserves tickets, actual outcomes, payout and return',()=>{
 for(const value of CLASSIC_EXACT_PROFILE_VALUES)for(const[game,values]of Object.entries(choices))for(const choice of values){
  const config=classicRules(game,choice,value),intervals=[];
  if(game==='plinko'){
   const weights=config.distribution.pathWeights;let start=0;
   weights.forEach((weight,path)=>{intervals.push({start,end:start+weight-1,count:weight,path});start+=weight;});eq(start,config.sampleSize);ok(weights.every(n=>Number.isSafeInteger(n)&&n>0));
   weights.forEach((weight,path)=>eq(weight,weights[255-path]));
  }else if(game==='roulette'){
   const colorChoice=choice==='red'||choice==='black',selected=colorChoice?ROULETTE_NUMBERS.filter(n=>rouletteColor(n)===choice):[choice==='green'?0:choice];
   const others=ROULETTE_NUMBERS.filter(n=>!selected.includes(n));let start=0;
   const selectedWeight=value===70?(colorChoice?133:252):config.selectedTicketsPerPocket;
   const otherWeight=value===70?(colorChoice?234:353):config.otherTicketsPerPocket;
   for(const number of selected){intervals.push({start,end:start+selectedWeight-1,count:selectedWeight,number});start+=selectedWeight;}
   for(const number of others){intervals.push({start,end:start+otherWeight-1,count:otherWeight,number});start+=otherWeight;}eq(start,config.sampleSize);
  }else if(game==='dice'){
   intervals.push({start:0,end:config.chance-1,count:config.chance,number:choice});let start=config.chance;
   const weight=value===70?53:config.losingTicketsPerOtherFace;
   for(const number of [1,2,3,4,5,6].filter(n=>n!==choice)){intervals.push({start,end:start+weight-1,count:weight,number});start+=weight;}eq(start,config.sampleSize);
  }else{
   intervals.push({start:0,end:config.chance-1,count:config.chance},{start:config.chance,end:config.sampleSize-1,count:config.sampleSize-config.chance});
  }
  let payoutSum=0n,countSum=0;
  for(const interval of intervals){
   const low=settleClassic(game,choice,5,1000,interval.start,value),high=settleClassic(game,choice,5,1000,interval.end,value);eq(low.outcome,high.outcome);countSum+=interval.count;
   if(game==='roulette')eq(low.number,interval.number);if(game==='dice')eq(low.value,interval.number);
   if(game==='plinko'){eq(low.pathIndex,interval.path);eq(low.steps.length,8);eq(low.bin,low.steps.filter(s=>s===1).length);eq(low.path.at(-1),low.bin*2-8);}
   payoutSum+=BigInt(interval.count)*BigInt(low.payoutCents);
   for(const stake of [5,10,100,250]){
    const result=settleClassic(game,choice,stake,999,interval.start,value),quote=liabilityTerms({game,choice,stake,rtpProfile:value});
    ok(Number.isSafeInteger(result.payoutCents));ok(result.payoutCents<=quote.maxPayoutCents);eq(result.netCents,result.payoutCents-result.stakeCents);
   }
  }
  eq(countSum,config.sampleSize);eq(Number(payoutSum)/(config.sampleSize*500),config.expectedGrossReturn);
  if(!(value===70&&game==='upgrader'&&choice===1.5))eq(payoutSum*100n,BigInt(value)*BigInt(config.sampleSize)*500n);
  raises(()=>settleClassic(game,choice,5,1000,-1,value));raises(()=>settleClassic(game,choice,5,1000,config.sampleSize,value));
 }
});
section('profiles keep all stake-grid costs and maximum liability; identity pins before RNG',()=>{
 for(const game of CLASSIC_PROFILE_GAMES)for(const choice of game==='blackjack'?[undefined]:choices[game])for(let stake=5;stake<=250;stake+=5){
  const base=liabilityTerms({game,choice,stake});
  for(const value of game==='blackjack'?BLACKJACK_PROFILE_VALUES:CLASSIC_EXACT_PROFILE_VALUES){const quote=liabilityTerms({game,choice,stake,rtpProfile:value});eq(financial(quote),financial(base));eq(quote.rtpProfile,'rtp'+value);ok(Object.isFrozen(quote.profileRules));}
 }
 const book=createDemoReserve({capitalCents:1000000}),input={game:'roulette',choice:'red',stake:5,rtpProfile:90,roundId:'round-pinned'};
 const first=book.reserve(input);eq(first.record.terms.rtpProfile,'rtp90');eq(book.reserve(input).admittedNow,false);raises(()=>book.reserve({...input,rtpProfile:95}));eq(book.settle('round-pinned',1000),true);eq(book.settle('round-pinned',1000),false);
 for(const game of CLASSIC_PROFILE_GAMES){let draws=0;const session=new HallSession(GameMath,()=>{draws++;return 0;},{houseCapitalCents:0});raises(()=>game==='blackjack'?session.beginBlackjack(5):session.begin(game,choices[game][0],5));eq(draws,0);eq(session.balanceCents,100000);}
});
section('atomic settings validate all parts, reject stale and active updates, increment once',()=>{
 const session=new HallSession(GameMath,rng(223)),before=session.getSnapshot(),config=clone(DEFAULT_DEMO_SETTINGS);let events=0;session.subscribe(()=>events++);
 config.rtpProfiles={slots:55,maskhouse:60,lecipher:55};config.classicRtpProfiles={coinflip:90,dice:95,plinko:80,roulette:75,upgrader:85,blackjack:95};
 config.stakeLimits.coinflip={min:10,max:100,step:5};config.presentation={speed:2,sfxVolume:40,musicVolume:20};
 const malformed=clone(config);malformed.presentation.sfxVolume=101;raises(()=>session.setDemoSettings(malformed,{expectedRevision:1}));eq(session.getSnapshot(),before);eq(events,0);
 raises(()=>session.setDemoSettings(config,{expectedRevision:0}));eq(session.getSnapshot(),before);
 eq(session.setDemoSettings(config,{expectedRevision:1}),true);eq(events,1);eq(session.getSnapshot().profileRevision,2);eq(session.getSnapshot().classicRtpProfiles,config.classicRtpProfiles);eq(session.getSnapshot().presentation,config.presentation);
 config.classicRtpProfiles.coinflip=50;config.stakeLimits.coinflip.max=50;eq(session.getSnapshot().classicRtpProfiles.coinflip,90);eq(session.getSnapshot().stakeLimits.coinflip.max,100);
 const same=clone(session.getSnapshot());const settings={rtpProfiles:same.rtpProfiles,classicRtpProfiles:same.classicRtpProfiles,stakeLimits:same.stakeLimits,presentation:same.presentation};eq(session.setDemoSettings(settings,{expectedRevision:2}),false);eq(events,1);
 raises(()=>session.begin('coinflip','heads',5));const round=session.begin('coinflip','heads',10);eq(round.rtpProfile.id,'rtp90');eq(round.profileRevision,2);eq(round.settingsRevision,2);eq(round.stakeLimits,{min:10,max:100,step:5});eq(round.presentation,{speed:2,sfxVolume:40,musicVolume:20});
 raises(()=>session.setDemoSettings(settings));raises(()=>session.setClassicRtpProfiles(DEFAULT_CLASSIC_PROFILES));raises(()=>session.setRtpProfiles(DEFAULT_DEMO_SETTINGS.rtpProfiles));eq(session.getSnapshot().profileRevision,2);
 eq(session.complete(round.id),true);eq(session.getSnapshot().history[0].rtpProfile,round.rtpProfile);eq(session.setClassicRtpProfiles(DEFAULT_CLASSIC_PROFILES),true);eq(session.getSnapshot().profileRevision,3);eq(round.rtpProfile.id,'rtp90');
 for(const invalid of [null,{...settings,playerProfiles:{}},{...settings,stakeLimits:{...settings.stakeLimits,slots:{min:5,max:105,step:5}}},{...settings,stakeLimits:{...settings.stakeLimits,dice:{min:10,max:5,step:5}}},{...settings,presentation:{...settings.presentation,speed:4}}])raises(()=>validateDemoSettings(invalid));
});
section('RNG callbacks cannot change accepted settings and Blackjack preserves opaque handles',()=>{
 const config=clone(DEFAULT_DEMO_SETTINGS);config.classicRtpProfiles.coinflip=95;config.classicRtpProfiles.blackjack=95;
 let session,calls=0;session=new HallSession(GameMath,n=>{calls++;raises(()=>session.setDemoSettings(config,{expectedRevision:1}));return n-1;});
 const round=session.begin('coinflip','heads',5);eq(round.rtpProfile.id,'rtp70');eq(round.profileRevision,1);eq(calls,1);session.complete(round.id);
 session.setDemoSettings(config,{expectedRevision:1});const bj=session.beginBlackjack(5);eq(bj.rtpProfile.id,'rtp95');eq(bj.rtpProfile.dealerBoostTickets,classicProfileSnapshot('blackjack',95).dealerBoostTickets);eq(bj.rtpProfile.playerUnfavorableTickets,classicProfileSnapshot('blackjack',95).playerUnfavorableTickets);eq(bj.profileRevision,2);
 for(const key of ['shoe','cursor','randomInt','roundToken','playerUnfavorableTickets','dealerBoostTickets'])eq(key in bj.hand,false);
 const done=session.advanceBlackjack(bj.id,'finish',bj.hand);eq(session.completeBlackjack(bj.id,done),true);eq(session.getSnapshot().history[0].rtpProfile.id,'rtp95');
 const q=liabilityTerms({game:'coinflip',choice:'heads',stake:10,rtpProfile:95,stakeLimits:{min:10,max:100,step:5}});eq(q.stakeLimits,{min:10,max:100,step:5});eq(maximumSafeStake({game:'coinflip',choice:'heads',stakeLimits:q.stakeLimits},100000,100000),100);
});
const report={passed:true,checks,sections};writeFileSync(new URL('./classic-profile-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
