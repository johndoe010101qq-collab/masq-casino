import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HallSession,bonusPurchaseConfig,validateBonusPurchase} from '../src/hall-session.js';
import {createSlotPlaybackController,SLOT_AUTO_BALANCE} from '../src/slot-playback-controller.js';
import {uiStakeLimits} from '../src/demo-ui-settings.js';
import {permittedStake} from '../src/stake-limits.js';
import {LEXOF_FEATURE_RULES} from '../src/mask-slots.js';

// Actual accepted bought rounds and the common scheduler. This fixture owns
// selected UI intent only; HallSession owns RNG, charge and once-only credit.
const offers=[['slots',undefined,50],['maskhouse','sticky',20],['lecipher','luck',20],['lecipher','gold',25]];
let assertions=0,cases=0;
const eq=(actual,expected,message)=>{assertions++;assert.deepEqual(actual,expected,message);};
const ok=(value,message)=>{assertions++;assert.ok(value,message);};
const throws=(callback,pattern)=>{assertions++;assert.throws(callback,pattern);};
function random(seed){
 let word=seed>>>0,draws=0;
 const fn=maximum=>{word=(Math.imul(word,1664525)+1013904223)>>>0;draws++;return word%maximum;};
 fn.draws=()=>draws;return fn;
}
class Clock {
 now=0;id=0;queue=new Map();
 schedule=(fn,delay)=>{this.queue.set(++this.id,{fn,at:this.now+delay});return this.id;};
 cancel=id=>this.queue.delete(id);
 advance(ms){const until=this.now+ms;let loops=0;while(true){const next=[...this.queue].filter(([,item])=>item.at<=until).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!next)break;if(++loops>1000)throw new Error('Unexpected unbounded test queue');this.now=next[1].at;this.queue.delete(next[0]);next[1].fn();}this.now=until;}
}
function fixture(game,tier,{openingCents=10000000,capitalCents=10000000,seed=723}={}) {
 const clock=new Clock(),rng=random(seed),session=new HallSession(null,rng,{initialBalanceCents:openingCents,houseCapitalCents:capitalCents});
 const gate={hidden:false,modalOpen:false,payoutOpen:false};
 const intent={selected:true,game,tier,stake:5},rounds=[],launches=[];
 const canAfford=()=>intent.selected
  ? !validateBonusPurchase(intent.stake,session.getSnapshot().balance,intent.game,intent.tier,session.getSnapshot().stakeLimits[intent.game])
  : session.getSnapshot().balance>=intent.stake;
 const launch=settings=>{
  const selection=Object.freeze({game:intent.game,tier:intent.selected?intent.tier:undefined,stake:intent.stake,mode:intent.selected?'buy':'paid'});
  launches.push(selection);
  const round=session.begin(selection.game,selection.game==='slots'?'bonanza':selection.game,selection.stake,{mode:selection.mode,bonusTier:selection.tier});
  if(!round)return false;
  rounds.push(round);return true;
 };
 const controller=createSlotPlaybackController({schedule:clock.schedule,cancel:clock.cancel,gapMs:600,
  requestSpin:launch,getConditions:()=>({...gate,busy:session.getSnapshot().busy,canAfford:canAfford()})});
 const settle=()=>{
  const round=session.pending;ok(round,'An accepted package must exist before settlement.');
  const before=session.balanceCents,draws=rng.draws();
  eq(session.complete(round.id),true);eq(session.balanceCents,before+round.payoutCents);
  eq(session.complete(round.id),false,'A duplicate callback cannot credit a bonus twice.');
  eq(session.balanceCents,before+round.payoutCents);eq(rng.draws(),draws,'Animation/credit cannot reroll the purchased package.');
  controller.sync();return round;
 };
 const cancelBonus=()=>{controller.stop();intent.selected=false;};
 return {clock,rng,session,gate,intent,rounds,launches,controller,launch,settle,cancelBonus};
}

for(const [game,tier,multiplier] of offers) {
 const costCents=5*100*multiplier;
 eq(bonusPurchaseConfig(game,tier).multiplier,multiplier);
 {
  const f=fixture(game,tier),opening=f.session.balanceCents;
  // Selecting a bonus mode by itself never starts an autoplay queue.
  f.clock.advance(100000);eq(f.rounds.length,0);eq(f.session.balanceCents,opening);
  for(let n=0;n<3;n++){
   const before=f.session.balanceCents;eq(f.launch(),true);
   const round=f.rounds.at(-1);eq(round.mode,'buy');eq(round.game,game);eq(round.stake,5);eq(round.bonusBought,true);
   eq(round.chargeCents,costCents);eq(f.session.balanceCents,before-costCents);
   if(game!=='slots')eq(round.bonusPurchaseTier,tier,'Repeat manual spins keep the selected purchase tier.');
   const debited=f.session.balanceCents;eq(f.launch(),false,'Clicking during the active package cannot create a second purchase.');
   eq(f.session.balanceCents,debited);f.settle();
   eq(f.intent.selected,true,'The bonus mode remains selected after its package completes.');
   f.clock.advance(100000);eq(f.rounds.length,n+1,'Manual bonus mode needs a new explicit spin for every purchase.');
  }
  f.cancelBonus();eq(f.launch(),true);eq(f.rounds.at(-1).mode,'paid');eq(f.rounds.at(-1).chargeCents,500);
  f.settle();cases++;
 }
 {
  const f=fixture(game,tier,{seed:931}),direct=new HallSession(null,random(931),{initialBalanceCents:10000000,houseCapitalCents:10000000});
  f.controller.start(SLOT_AUTO_BALANCE);
  eq(f.rounds.length,0,'Only the separate autoplay action schedules repeated purchases.');
  for(let n=0;n<3;n++){
   f.clock.advance(600);eq(f.rounds.length,n+1);eq(f.controller.snapshot().accepted,n+1);
   const round=f.rounds.at(-1),reference=direct.begin(game,game==='slots'?'bonanza':game,5,{mode:'buy',bonusTier:tier});
   eq(round,reference,'Selected bonus autoplay preserves direct bought-round math under the same RNG.');
   eq(round.chargeCents,costCents);eq(f.session.balanceCents,direct.balanceCents);
   if(n===2)f.controller.stop();
   f.settle();eq(direct.complete(reference.id),true);
   eq(f.session.balanceCents,direct.balanceCents);eq(f.session.getReserveSnapshot(),direct.getReserveSnapshot());
  }
  f.clock.advance(100000);eq(f.rounds.length,3);eq(f.session.getSnapshot().busy,false);
  eq(f.controller.snapshot().active,false);eq(f.controller.snapshot().status,'stopped');
  ok(f.launches.every(s=>s.game===game&&s.tier===tier&&s.mode==='buy'&&s.stake===5));
  eq(f.intent.selected,true,'Stopping autoplay keeps the selected manual bonus mode.');
  eq(f.clock.queue.size,0);cases++;
 }
 {
  const f=fixture(game,tier,{openingCents:costCents-1}),before=f.session.getSnapshot();
  ok(f.session.getSnapshot().balance>=5,'The wallet can afford a base spin but cannot afford the bonus package.');
  f.controller.start(SLOT_AUTO_BALANCE);f.clock.advance(100000);
  eq(f.rounds.length,0);eq(f.launches.length,0);eq(f.controller.snapshot().status,'unavailable');
  eq(f.session.getSnapshot(),before);eq(f.rng.draws(),0);eq(f.intent.selected,true);
  throws(()=>f.launch(),/покупки бонуса|демо-фишек/);eq(f.session.getSnapshot(),before);eq(f.rng.draws(),0);
  eq(f.launches.at(-1).mode,'buy','Insufficient bonus funds never silently fall back to a cheaper paid round.');cases++;
 }
 {
  const f=fixture(game,tier,{capitalCents:0}),before=f.session.getSnapshot(),reserve=f.session.getReserveSnapshot();
  f.controller.start(SLOT_AUTO_BALANCE);f.clock.advance(100000);
  eq(f.controller.snapshot().status,'launch-error');eq(f.controller.snapshot().active,false);
  eq(f.rounds.length,0);eq(f.launches.length,1);eq(f.session.getSnapshot(),before);
  eq(f.session.getReserveSnapshot(),reserve);eq(f.rng.draws(),0);eq(f.session.id,0);eq(f.session.active.size,0);cases++;
 }
 {
  // Pick a reproducible real bought result which pays less than its package
  // price. This checks the queue's post-credit gate, not any win probability.
  let f;
  for(let seed=1;seed<=24;seed++){
   const candidate=fixture(game,tier,{openingCents:costCents,seed});candidate.controller.start(SLOT_AUTO_BALANCE);candidate.clock.advance(600);
   if(candidate.rounds[0].payoutCents<costCents){f=candidate;break;}
   candidate.controller.stop();candidate.settle();
  }
  ok(f,'A deterministic losing-package fixture must be available.');
  eq(f.session.balanceCents,0);f.controller.sync();
  eq(f.controller.snapshot().active,true,'Debit-to-zero during a purchased bonus must wait for its final payout.');
  eq(f.controller.snapshot().status,'waiting');f.settle();
  eq(f.session.balanceCents,f.rounds[0].payoutCents);eq(f.controller.snapshot().status,'unavailable');
  f.clock.advance(100000);eq(f.rounds.length,1);eq(f.intent.selected,true);
  ok(f.session.balanceCents<costCents);eq(f.clock.queue.size,0);cases++;
 }
 {
  const f=fixture(game,tier);f.controller.start(SLOT_AUTO_BALANCE);f.clock.advance(600);
  const round=f.rounds[0],debited=f.session.balanceCents;f.cancelBonus();
  eq(f.intent.selected,false);eq(f.controller.snapshot().active,false);eq(f.session.pending,round);
  eq(f.session.balanceCents,debited,'Cancel does not refund or replace the already accepted bought package.');
  f.settle();f.clock.advance(100000);eq(f.rounds.length,1);eq(f.session.getSnapshot().busy,false);
  eq(f.launch(),true);eq(f.rounds.at(-1).mode,'paid');f.settle();cases++;
 }
 for(const gateName of ['hidden','modalOpen','payoutOpen']){
  const f=fixture(game,tier);f.gate[gateName]=true;f.controller.start(SLOT_AUTO_BALANCE);f.clock.advance(100000);
  eq(f.rounds.length,0);eq(f.rng.draws(),0);eq(f.controller.snapshot().status,'paused');
  f.gate[gateName]=false;f.controller.sync();f.clock.advance(600);eq(f.rounds.length,1);eq(f.rounds[0].mode,'buy');
  f.controller.stop();f.settle();f.clock.advance(100000);eq(f.rounds.length,1);cases++;
 }
}

// Bind the transaction contract to the actual room callbacks: execute each
// room's pure affordability/dispatch expression with isolated UI dependencies.
const rooms=['BonanzaSlot.jsx','MaskSlotRoom.jsx'].map(file=>({file,source:readFileSync(new URL('../src/'+file,import.meta.url),'utf8')}));
for(const {file,source} of rooms){
 const affordability=source.match(/const canAffordSpin\s*=\s*([\s\S]*?);/);
 const dispatch=source.match(/requestSpin:(settings=>[^\n]+?)\}\);/);
 ok(affordability,file+' must provide a pure full-cost affordability callback.');
 ok(dispatch,file+' must dispatch the selected mode through the scheduler.');
 const roomOffers=file==='BonanzaSlot.jsx'?offers.slice(0,1):offers.slice(1);
 for(const [game,tier,multiplier] of roomOffers){
  const enabled=file==='BonanzaSlot.jsx'?true:tier,disabled=file==='BonanzaSlot.jsx'?false:null;
  const makeAffordability=bonusMode=>Function('bonusMode','stake','game','validateBonusPurchase','uiStakeLimits','permittedStake','featureMode','LEXOF_FEATURE_RULES','return ('+affordability[1]+');')(bonusMode,5,game,validateBonusPurchase,uiStakeLimits,permittedStake,null,LEXOF_FEATURE_RULES);
  const snapshot=new HallSession(null,random(74)).getSnapshot(),selected=makeAffordability(enabled),ordinary=makeAffordability(disabled);
  eq(selected({...snapshot,balance:5*multiplier-.01}),false,file+' blocks a bonus when only its base stake is affordable.');
  eq(selected({...snapshot,balance:5*multiplier}),true);eq(ordinary({...snapshot,balance:5}),true);eq(ordinary({...snapshot,balance:4.99}),false);
  eq(selected({...snapshot,balance:100000,stakeLimits:{...snapshot.stakeLimits,[game]:{min:10,max:100,step:5}}}),false,'Committed limits still apply to a selected bonus.');
  const settings=Object.freeze({mode:'paid',featureMode:null,speed:2}),spy=(...args)=>args;
  const callback=Function('bonusMode','stake','start','play','return ('+dispatch[1]+');')(enabled,5,spy,spy);
  const ordinaryCallback=Function('bonusMode','stake','start','play','return ('+dispatch[1]+');')(disabled,5,spy,spy);
  eq(callback(settings),file==='BonanzaSlot.jsx'?['buy',5,2]:['buy',5,tier,settings]);
  eq(ordinaryCallback(settings),file==='BonanzaSlot.jsx'?['paid',5,2]:['paid',5,undefined,settings]);cases++;
 }
 ok(/onSpin=\{\(\)\s*=>\s*(?:start|play)\(bonusMode\?'buy':'paid'/.test(source),file+' manual spin uses the same selected mode.');
 ok(/stopAutoplay\(\);\s*setBonusMode\((?:false|null)\)/.test(source),file+' cancellation clears mode and scheduled launches together.');
 const confirmBody=source.split('function confirmPurchase()')[1]?.split(/\n\s*function /)[0];
 ok(confirmBody&&!confirmBody.includes('startAutoplay'),'Buying/selecting a mode never implicitly starts repeated purchases.');
}
console.log(JSON.stringify({passed:true,cases,assertions,offers:offers.map(([game,tier,multiplier])=>({game,tier,multiplier})),scope:'Selected manual bonus modes and explicitly started autoplay; real Hall charges, credits, affordability, Stop/cancel, refusal and seeded bought-round equivalence.'}));
