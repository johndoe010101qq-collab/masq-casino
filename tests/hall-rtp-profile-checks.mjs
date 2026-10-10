// Copy-ready to Site/tests. Outside execution imports current Site read-only.
// No production application source or balance is edited by this test.
import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const local=new URL('../src/hall-session.js',import.meta.url);
const site=existsSync(local)?new URL('../',import.meta.url):new URL('../indictus-site/',import.meta.url);
const {applyBonusPurchaseFloor}=await import(new URL('src/bonus-purchase-floor.js',site));
const {HallSession}=await import(new URL('src/hall-session.js',site));
const {liabilityTerms}=await import(new URL('src/liability-terms.js',site));
const {createDemoReserve}=await import(new URL('src/demo-reserve.js',site));
const {default:GameMath}=await import(new URL('src/game-math.js',site));
const {canOpenDemoAdmin}=await import(new URL('src/admin-access.js',site));
const {slotProfileSnapshot}=await import(new URL('src/slot-rtp-profiles.js',site));
const {simulateBonanzaRound}=await import(new URL('src/bonanza.js',site));
const {playMaskSlot}=await import(new URL('src/mask-slots.js',site));
const {simulateProfiledBonanzaRound}=await import(new URL('src/profiled-bonanza.js',site));
const {playProfiledMaskSlot}=await import(new URL('src/profiled-mask-slots.js',site));
let checks=0;const sections=[],failures=[];
const eq=(a,b,m)=>{checks++;assert.deepEqual(a,b,m);},ok=(v,m)=>{checks++;assert.ok(v,m);},raises=(fn,m)=>{checks++;assert.throws(fn,m);};
const section=(name,fn)=>{try{fn();sections.push({name,passed:true});console.log(JSON.stringify({name,passed:true}));}catch(error){failures.push({name,message:error.message,stack:error.stack});console.error(JSON.stringify({name,passed:false,message:error.message}));}};
const all=value=>({slots:value,maskhouse:value,lecipher:value});
function rng(seed,trace=[]){let s=seed>>>0;return max=>{trace.push(max);const cut=Math.floor(4294967296/max)*max;let x;
 do{s=(s+0x6D2B79F5)>>>0;x=s;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);x=(x^(x>>>14))>>>0;}while(x>=cut);return x%max;};}
function wallet(randomInt=rng(0x131A0011),rtpProfiles=all(50),overrides={}){return new HallSession(GameMath,randomInt,{initialBalanceCents:5000000,houseCapitalCents:5000000,rtpProfiles,...overrides});}
const offers=[
 {game:'slots',mode:'paid'}, {game:'slots',mode:'buy'},
 {game:'maskhouse',mode:'paid'}, {game:'maskhouse',mode:'buy',bonusTier:'sticky'},
 {game:'lecipher',mode:'paid'}, {game:'lecipher',mode:'buy',bonusTier:'luck'}, {game:'lecipher',mode:'buy',bonusTier:'gold'},
 {game:'lecipher',mode:'paid',featureMode:'hunt'}, {game:'lecipher',mode:'paid',featureMode:'rainbow'}
];
function options(selection){const {game,...rest}=selection;return rest;}
function bounds(q){return{stakeCents:q.stakeCents,chargeCents:q.chargeCents,maxPayoutCents:q.maxPayoutCents,maxHouseLossCents:q.maxHouseLossCents};}

section('default and detached global profile snapshots; revisions only change with values',()=>{
 const session=new HallSession(GameMath,rng(1));eq(session.getSnapshot().rtpProfiles,all(50));eq(session.getSnapshot().profileRevision,1);ok(Object.isFrozen(session.getSnapshot().rtpProfiles));
 const input=all(55),configured=wallet(rng(2),input),before=configured.getSnapshot();input.slots=60;eq(configured.getSnapshot().rtpProfiles,all(55));
 ok(!Object.isFrozen(input),'Caller config remains separately owned');ok(Object.isFrozen(before));ok(Object.isFrozen(before.rtpProfiles));
 let notifications=0;configured.subscribe(()=>notifications++);
 eq(configured.setRtpProfiles(all(55)),false);eq(configured.getSnapshot(),before);eq(notifications,0);
 const next={slots:60,maskhouse:55,lecipher:50};eq(configured.setRtpProfiles(next),true);eq(configured.getSnapshot().profileRevision,2);eq(configured.getSnapshot().rtpProfiles,next);eq(notifications,1);
 next.slots=50;eq(configured.getSnapshot().rtpProfiles.slots,60);eq(before.rtpProfiles,all(55));eq(before.profileRevision,1);
 raises(()=>{configured.getSnapshot().rtpProfiles.slots=50;},TypeError);eq(configured.getSnapshot().profileRevision,2);
 eq(configured.reset(),true);eq(configured.getSnapshot().rtpProfiles,{slots:60,maskhouse:55,lecipher:50});eq(configured.getSnapshot().profileRevision,2);
});

section('unsupported or per-person keys and values reject without RNG or state changes',()=>{
 const invalid=[null,undefined,[],{}, {slots:50,maskhouse:50}, {slots:50,maskhouse:50,lecipher:50,playerId:'a'},
  {slots:50,maskhouse:50,userId:50}, {slots:50,maskhouse:50,lecipher:50,userProfiles:{}},
  {slots:50,maskhouse:50,lecipher:50,balance:1000},
  ...[0,49,96,50.5,-1,NaN,Infinity,true,'55','rtp55',null,undefined,{}].map(v=>({...all(50),slots:v}))];
 let calls=0;const session=wallet(()=>{calls++;throw Error('Config validation must precede RNG');}),before=session.getSnapshot(),reserve=session.getReserveSnapshot();
 for(const value of invalid){raises(()=>session.setRtpProfiles(value));eq(session.getSnapshot(),before);eq(session.getReserveSnapshot(),reserve);eq(calls,0);eq(session.id,0);}
 for(const value of invalid.filter(v=>v!==undefined)){raises(()=>new HallSession(GameMath,()=>{calls++;return 0;},{rtpProfiles:value}));eq(calls,0);}
 for(const selection of offers){for(const value of [49,96,50.5,'55',{},NaN])raises(()=>liabilityTerms({...selection,stake:5,rtpProfile:value}));}
 raises(()=>liabilityTerms({game:'coinflip',choice:'heads',stake:5,rtpProfile:96}));eq(calls,0);
});

section('profiles preserve every offer price and cap and enter quote/idempotency identity',()=>{
 for(const selection of offers)for(const stake of [5,selection.game==='slots'?100:250]){
  const base=liabilityTerms({...selection,stake});ok(Object.isFrozen(base));
  for(const value of [50,55,60]){const q=liabilityTerms({...selection,stake,rtpProfile:value});eq(bounds(q),bounds(base));eq(q.rtpProfile,'rtp'+value);eq(q.profileRules,slotProfileSnapshot(selection.game,value,selection));ok(Object.isFrozen(q.profileRules));}
  const book=createDemoReserve({capitalCents:base.maxHouseLossCents+1}),request={...selection,stake,rtpProfile:55,roundId:'profile-pinned'};
  const held=book.reserve(request);ok(held);eq(held.record.terms.rtpProfile,'rtp55');eq(book.reserve(request).admittedNow,false);
  const snapshot=book.snapshot();raises(()=>book.reserve({...request,rtpProfile:60}));eq(book.snapshot(),snapshot);
  eq(book.settle('profile-pinned',0),true);eq(book.settle('profile-pinned',0),false);raises(()=>book.reserve({...request,rtpProfile:60}));
 }
});

section('native50 core results remain exact; bought public minimum adds only disclosed payment without RNG',()=>{
 for(let index=0;index<offers.length;index++){
  const selection=offers[index],seed=0x131B0100+index,traceSession=[],traceEngine=[];
  const session=wallet(rng(seed,traceSession)),stake=5,opts=options(selection);
  const round=session.begin(selection.game,selection.game,stake,opts);
  const raw=selection.game==='slots'?simulateBonanzaRound(stake*100,{...opts,randomInt:rng(seed,traceEngine)}):playMaskSlot({game:selection.game,stakeCents:stake*100,...opts,randomInt:rng(seed,traceEngine)});
  const pure=applyBonusPurchaseFloor(raw,{game:selection.game,mode:selection.mode,chargeCents:raw.chargeCents,profileRules:slotProfileSnapshot(selection.game,50,selection)});
  eq(round.payoutCents,pure.payoutCents);eq(round.spins,pure.spins);eq(traceSession,traceEngine);eq(round.rtpProfile.id,'rtp50');eq(round.profileRevision,1);eq(round.profileExtraFreeSpins,0);ok(Object.isFrozen(round.rtpProfile));
  eq(session.complete(round.id),true);
 }
});

section('55 and60 full lifecycle, all slots, bought tiers, LeHunt and Rainbow',()=>{
 for(const value of [55,60])for(let index=0;index<offers.length;index++)for(const stake of [5,offers[index].game==='slots'?100:250]){
  const selection=offers[index],trace=[],seed=0x131C0000+value*256+index*2+stake,session=wallet(rng(seed,trace),all(value)),q=liabilityTerms({...selection,stake,rtpProfile:value}),opening=session.balanceCents,bank=session.getReserveSnapshot().bankCents;
  const round=session.begin(selection.game,selection.game,stake,options(selection));ok(round);ok(trace.length>0);eq(round.chargeCents,q.chargeCents);ok(round.payoutCents<=q.maxPayoutCents);
  const tracePure=[],raw=selection.game==='slots'?simulateProfiledBonanzaRound(stake*100,{...options(selection),rtpProfile:value,randomInt:rng(seed,tracePure)}):playProfiledMaskSlot({game:selection.game,stakeCents:stake*100,...options(selection),rtpProfile:value,randomInt:rng(seed,tracePure)});
  const pure=applyBonusPurchaseFloor(raw,{game:selection.game,mode:selection.mode,chargeCents:raw.chargeCents,profileRules:q.profileRules});
  eq(round.payoutCents,pure.payoutCents);eq(round.spins,pure.spins);eq(trace,tracePure,'Hall selects the same pinned profile engine before RNG');
  eq(round.rtpProfile,q.profileRules);eq(round.profileRevision,1);eq(round.rtpProfile.targetReturnPercent,value);ok(Object.isFrozen(round));ok(Object.isFrozen(round.rtpProfile));
  ok([0,4,5,10].includes(round.profileExtraFreeSpins));eq(round.profileExtraFreeSpins,selection.game==='slots'?(pure.profile?.extraFreeSpins??0):(pure.profileExtraFreeSpins??0));
  eq(session.balanceCents,opening-q.chargeCents);eq(session.getReserveSnapshot(),{bankCents:bank,reservedCents:q.maxHouseLossCents,availableCents:bank-q.maxHouseLossCents,activeCount:1});
  const live=session.getSnapshot(),n=trace.length;raises(()=>session.setRtpProfiles(all(value===55?60:55)));raises(()=>session.setRtpProfiles(all(value)));eq(session.getSnapshot(),live);eq(trace.length,n);
  eq(session.begin('coinflip','heads',5),null);eq(session.reset(),false);eq(session.complete(round.id+1),false);eq(session.getSnapshot(),live);
  eq(session.complete(round.id),true);eq(session.balanceCents,opening-q.chargeCents+round.payoutCents);
  const cash=bank+q.chargeCents-round.payoutCents;eq(session.getReserveSnapshot(),{bankCents:cash,reservedCents:0,availableCents:cash,activeCount:0});
  eq(session.balanceCents+cash,opening+bank,'Player+house total is conserved');eq(session.getSnapshot().result.rtpProfile,round.rtpProfile);eq(session.getSnapshot().result.profileRevision,round.profileRevision);
  const completed=session.getSnapshot(),completedReserve=session.getReserveSnapshot();eq(session.complete(round.id),false);eq(session.completeStored({...round}),false);eq(session.getSnapshot(),completed);eq(session.getReserveSnapshot(),completedReserve);eq(trace.length,n);
  eq(session.setRtpProfiles(all(value===55?60:55)),true);eq(session.getSnapshot().profileRevision,2);eq(round.rtpProfile.targetReturnPercent,value);eq(round.profileRevision,1);
 }
});

section('actual gift alias matches forced won and missed purchase lotteries',()=>{
 for(const value of [55,60])for(const selection of offers.filter(v=>v.mode==='buy'&&v.game!=='slots'))for(const won of [false,true]){
  // House/LeXof use the disclosed additional-spin ticket. Bonanza uses
  // fixed symbol weights and has no preliminary ticket or extra-spin gift.
  let first=true;const tail=rng(0x132A0100+value+offers.indexOf(selection)),random=max=>{if(first){first=false;eq(max,1000000);return won?999999:0;}return tail(max);};
  const session=wallet(random,all(value)),round=session.begin(selection.game,selection.game,5,options(selection)),expected=won?4:0;
  eq(round.profileExtraFreeSpins,expected);eq(round.rtpProfile.id,'rtp'+value);eq(session.getSnapshot().rtpProfiles,all(value));ok(round.spins.length>0);
  eq(session.complete(round.id),true);
 }
});

section('profile is pinned and hold exists before RNG; computing reentry is denied',()=>{
 for(const selection of offers){let session,first=true,calls=0;const random=rng(0x131D0011+offers.indexOf(selection)),quote=liabilityTerms({...selection,stake:5,rtpProfile:55});
  session=wallet(max=>{calls++;if(first){first=false;const before=session.getSnapshot(),reserve=session.getReserveSnapshot();
   eq(before.rtpProfiles,all(55));eq(before.profileRevision,1);eq(session.id,0);eq(session.balanceCents,5000000);eq(reserve.reservedCents,quote.maxHouseLossCents);eq(reserve.activeCount,1);
   raises(()=>session.setRtpProfiles(all(60)));eq(session.getSnapshot(),before);eq(session.getReserveSnapshot(),reserve);eq(session.begin('coinflip','heads',5),null);eq(session.reset(),false);
  }return random(max);},all(55));
  const round=session.begin(selection.game,selection.game,5,options(selection));ok(calls>0);eq(round.rtpProfile.id,'rtp55');eq(round.profileRevision,1);eq(session.getSnapshot().rtpProfiles,all(55));eq(session.complete(round.id),true);
 }
});

section('admission and wallet failures reject before profile lottery; engine failure releases hold',()=>{
 for(const value of [55,60])for(const selection of offers){let calls=0;const quote=liabilityTerms({...selection,stake:5,rtpProfile:value});
  const denied=wallet(()=>{calls++;throw Error('Denied before RNG');},all(value),{houseCapitalCents:Math.max(0,quote.maxHouseLossCents-1)}),before=denied.getSnapshot(),reserve=denied.getReserveSnapshot();
  raises(()=>denied.begin(selection.game,selection.game,5,options(selection)));eq(calls,0);eq(denied.getSnapshot(),before);eq(denied.getReserveSnapshot(),reserve);eq(denied.id,0);
  const broke=wallet(()=>{calls++;throw Error('Wallet failure before RNG');},all(value),{initialBalanceCents:quote.chargeCents-1}),balanceBefore=broke.getSnapshot();
  raises(()=>broke.begin(selection.game,selection.game,5,options(selection)));eq(calls,0);eq(broke.getSnapshot(),balanceBefore);eq(broke.getReserveSnapshot().reservedCents,0);
  const failed=wallet(max=>max,all(value)),failureBefore=failed.getSnapshot(),failureReserve=failed.getReserveSnapshot();raises(()=>failed.begin(selection.game,selection.game,5,options(selection)));eq(failed.getSnapshot(),failureBefore);eq(failed.getReserveSnapshot(),failureReserve);eq(failed.id,0);eq(failed.active.size,0);
  eq(failed.setRtpProfiles(all(50)),true);eq(failed.getSnapshot().profileRevision,2);
 }
});

section('Bonanza preview preserves chosen profile but credits neither wallet nor reserve',()=>{
 for(const value of [50,55,60]){const trace=[],session=wallet(rng(0x131E0000+value,trace),all(value)),opening=session.balanceCents,reserve=session.getReserveSnapshot();
  const round=session.begin('slots','slots',5,{mode:'preview'});eq(round.rtpProfile.id,'rtp'+value);eq(round.chargeCents,0);eq(round.preview,true);eq(session.balanceCents,opening);eq(session.getReserveSnapshot(),reserve);
  eq(session.complete(round.id),true);eq(session.balanceCents,opening);eq(session.getReserveSnapshot(),reserve);eq(session.getSnapshot().history.length,0);
 }
});

section('global slot profiles do not change classic mode outcomes; active Plinko locks changes',()=>{
 for(const[game,choice]of [['coinflip','heads'],['dice',1],['plinko','standard'],['roulette','red'],['upgrader',2]]){
  const a=[],b=[],baseline=wallet(rng(0x131F0031,a),all(50)),configured=wallet(rng(0x131F0031,b),all(60));
  const one=baseline.begin(game,choice,5),two=configured.begin(game,choice,5);eq(one,two);eq(a,b);eq(two.rtpProfile.targetReturnPercent,70);eq(baseline.complete(one.id),true);eq(configured.complete(two.id),true);
 }
 const plinko=wallet(rng(23),all(60)),one=plinko.begin('plinko','standard',5),two=plinko.begin('plinko','standard',5),before=plinko.getSnapshot();
 raises(()=>plinko.setRtpProfiles(all(55)));eq(plinko.getSnapshot(),before);eq(plinko.complete(one.id),true);raises(()=>plinko.setRtpProfiles(all(55)));eq(plinko.complete(two.id),true);eq(plinko.setRtpProfiles(all(55)),true);
});

section('embedded DEMO admin entry fails closed regardless of query parameters',()=>{
 for(const url of ['https://indictus-originals.johndoesora.chatgpt.site/?demo-admin=1','http://127.0.0.1:5178/?demo-admin=1','https://example.test/?demo-admin=1&role=admin','', 'invalid'])eq(canOpenDemoAdmin({embedded:true,url}),false);
 eq(canOpenDemoAdmin({embedded:false,url:'http://127.0.0.1:5178/?demo-admin=1'}),true);eq(canOpenDemoAdmin({embedded:false,url:'https://example.test/'}),false);eq(canOpenDemoAdmin({embedded:false,url:'invalid'}),false);
 eq(canOpenDemoAdmin({embedded:false,url:'https://example.test/?demo-admin=0'}),false);eq(canOpenDemoAdmin({embedded:false,url:'https://example.test/?role=admin'}),false);
});

const sourceSHA256={};for(const name of ['hall-session.js','liability-terms.js','demo-reserve.js','slot-rtp-profiles.js','admin-access.js','profiled-bonanza.js','profiled-mask-slots.js','bonus-purchase-floor.js'])sourceSHA256[name]=createHash('sha256').update(readFileSync(new URL('src/'+name,site))).digest('hex');
const result={status:failures.length?'failed':'passed',checks,sections,sourceSHA256,offers,failures};
if(process.argv.includes('--report'))writeFileSync(new URL('./hall-rtp-profile-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));if(failures.length)process.exitCode=1;
