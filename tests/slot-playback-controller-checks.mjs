import assert from 'node:assert/strict';

import {createSlotPlaybackController,SLOT_AUTO_BALANCE} from '../src/slot-playback-controller.js';
class FakeClock {
  now=0; id=0; queue=new Map();
  schedule=(fn,delay)=>{const id=++this.id;this.queue.set(id,{fn,at:this.now+delay});return id;};
  cancel=id=>this.queue.delete(id);
  advance(ms){const end=this.now+ms;let safety=0;while(true){const next=[...this.queue].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!next)break;if(++safety>10000)throw new Error('Unbounded fake-clock queue');this.now=next[1].at;this.queue.delete(next[0]);next[1].fn();}this.now=end;}
}
function fixture(extra={}) {
  const clock=new FakeClock(),gate={busy:false,hidden:false,payoutOpen:false,modalOpen:false,ready:true,normalOnly:true,canAfford:true},requests=[];
  let controller;
  controller=createSlotPlaybackController({schedule:clock.schedule,cancel:clock.cancel,getConditions:()=>gate,
    requestSpin:settings=>{requests.push(settings);if(extra.rejectAt===requests.length)return false;if(extra.neverBusy)return true;gate.busy=true;clock.schedule(()=>{gate.busy=false;if(extra.payout)gate.payoutOpen=true;controller.sync();},1000);return true;},gapMs:600});
  return {clock,gate,requests,controller};
}
let checks=0;
for(const count of [10,25,50]) {
  const f=fixture();f.controller.start(count);f.clock.advance(100000);
  assert.equal(f.requests.length,count);assert.equal(f.controller.snapshot().accepted,count);assert.equal(f.controller.snapshot().status,'complete');assert.equal(f.clock.queue.size,0);
  for(const request of f.requests){assert.equal(request.mode,'paid');assert.equal(request.featureMode,null);assert(Object.isFrozen(request));}checks++;
}
{
 const f=fixture({rejectAt:3});f.controller.start(10);f.clock.advance(100000);
 assert.equal(f.requests.length,3);assert.equal(f.controller.snapshot().accepted,2);assert.equal(f.controller.snapshot().status,'launch-rejected');assert.equal(f.clock.queue.size,0);checks++;
}
{
 const f=fixture();f.controller.start(10);f.clock.advance(400);f.controller.stop();f.clock.advance(100000);
 assert.equal(f.requests.length,0);assert.equal(f.controller.snapshot().active,false);checks++;
}
{
 const f=fixture();f.controller.start(10);f.clock.advance(600);f.controller.stop();f.clock.advance(100000);
 assert.equal(f.requests.length,1,'Stop preserves current accepted round, cancels future starts.');assert.equal(f.gate.busy,false);checks++;
}
for(const gateName of ['hidden','modalOpen','payoutOpen','busy']) {
 const f=fixture();f.gate[gateName]=true;f.controller.start(10);f.clock.advance(100000);assert.equal(f.requests.length,0);assert.equal(f.controller.snapshot().remaining,10);
 f.gate[gateName]=false;f.controller.sync();f.clock.advance(599);assert.equal(f.requests.length,0);f.clock.advance(1);assert.equal(f.requests.length,1);f.controller.stop();checks++;
}
{
 const f=fixture();f.controller.start(10);f.clock.advance(400);f.gate.hidden=true;f.controller.sync();f.clock.advance(100000);assert.equal(f.requests.length,0);
 f.gate.hidden=false;f.controller.sync();f.clock.advance(600);assert.equal(f.requests.length,1);f.controller.stop();checks++;
}
{
 const f=fixture({payout:true});f.controller.start(10);f.clock.advance(100000);assert.equal(f.requests.length,1);assert.equal(f.controller.snapshot().status,'paused');assert.equal(f.controller.snapshot().remaining,9);
 f.gate.payoutOpen=false;f.controller.sync();f.clock.advance(600);assert.equal(f.requests.length,2);f.controller.stop();checks++;
}
{
 const f=fixture();f.controller.start(10);f.clock.advance(600);f.controller.setSpeed(2);f.clock.advance(1600);
 assert.equal(f.requests[0].speed,1);assert.equal(f.requests[1].speed,2,'Next accepted round captures new speed; old round is immutable.');f.controller.stop();checks++;
}
{
 const f=fixture();f.gate.normalOnly=false;f.controller.start(10);f.clock.advance(100000);assert.equal(f.requests.length,0);assert.equal(f.controller.snapshot().pauseReason,'feature');
 f.gate.normalOnly=true;f.controller.sync();f.clock.advance(600);assert.equal(f.requests[0].featureMode,null);f.controller.stop();checks++;
}
{
 const f=fixture();f.gate.canAfford=false;f.controller.start(10);f.clock.advance(100000);assert.equal(f.requests.length,0);assert.equal(f.controller.snapshot().status,'unavailable');checks++;
}
{
 const f=fixture({neverBusy:true});f.controller.start(10);f.clock.advance(100000);assert.equal(f.requests.length,10,'Accepted and synchronously completed reduced-motion rounds continue without a stuck queue.');assert.equal(f.controller.snapshot().status,'complete');checks++;
}
{
 const f=fixture();f.controller.start(10);f.controller.disable();f.clock.advance(100000);assert.equal(f.requests.length,0);assert.equal(f.controller.start(10),false);
 f.controller.enable();assert.equal(f.controller.start(10),true);f.clock.advance(600);assert.equal(f.requests.length,1);f.controller.stop();checks++;
}
{
 const f=fixture();assert.throws(()=>f.controller.start(100));assert.throws(()=>f.controller.setSpeed(3));assert.equal(f.requests.length,0);checks++;
}
{
 const clock=new FakeClock();let callbacks=0,controller;
 controller=createSlotPlaybackController({schedule:clock.schedule,cancel:()=>{},requestSpin:()=>{callbacks++;return true;}});
 controller.start(10);controller.stop();clock.advance(100000);assert.equal(callbacks,0,'Generation token rejects callback even if cancel loses a race.');checks++;
}
// A deterministic settlement fixture exercises available funds independently
// of countdown values. Every accepted round owns its debit and later credit.
function balanceFixture({opening=250,stake=100,payouts=[],synchronous=false,rejectAt,throwAt}={}) {
 const clock=new FakeClock(),gate={busy:false,hidden:false,payoutOpen:false,modalOpen:false,normalOnly:true},requests=[],states=[];
 const funds={balance:opening,settled:0};let controller;
 controller=createSlotPlaybackController({schedule:clock.schedule,cancel:clock.cancel,gapMs:600,
  getConditions:()=>({...gate,canAfford:funds.balance>=stake}),onChange:state=>states.push(state),
  requestSpin:settings=>{
   assert.equal(gate.busy,false,'An active round must finish before another debit.');
   assert(funds.balance>=stake,'No round may launch against an insufficient current balance.');
   requests.push(settings);
   if(requests.length===throwAt)throw new Error('Rejected test launch');
   if(requests.length===rejectAt)return false;
   funds.balance-=stake;const payout=payouts[requests.length-1]||0;
   const settle=()=>{funds.balance+=payout;funds.settled++;gate.busy=false;if(!synchronous)controller.sync();};
   if(synchronous)settle();else{gate.busy=true;clock.schedule(settle,1000);}
   return true;
  }});
 return {clock,gate,funds,requests,states,controller};
}
let balanceChecks=0;
{
 const f=balanceFixture({opening:6050});f.controller.start(SLOT_AUTO_BALANCE);
 assert.equal(f.controller.snapshot().remaining,null);
 f.clock.advance(150000);
 assert.equal(f.requests.length,60,'Balance mode must continue beyond the largest fixed queue.');
 assert.equal(f.controller.snapshot().accepted,60);assert.equal(f.funds.balance,50);
 assert.equal(f.controller.snapshot().status,'unavailable');assert.equal(f.controller.snapshot().active,false);
 assert.equal(f.clock.queue.size,0);assert(f.states.filter(s=>s.active).every(s=>s.remaining===null));
 for(const request of f.requests){assert.equal(request.mode,'paid');assert.equal(request.featureMode,null);assert(Object.isFrozen(request));}
 balanceChecks++;
}
{
 const f=balanceFixture({opening:99});f.controller.start(SLOT_AUTO_BALANCE);f.clock.advance(100000);
 assert.equal(f.requests.length,0);assert.equal(f.funds.balance,99);assert.equal(f.controller.snapshot().status,'unavailable');
 f.funds.balance=1000;f.controller.sync();f.clock.advance(100000);
 assert.equal(f.requests.length,0,'An exhausted queue does not restart when funds are replenished.');balanceChecks++;
}
{
 const f=balanceFixture({payouts:[100,300]});f.controller.start(SLOT_AUTO_BALANCE);f.clock.advance(100000);
 assert.equal(f.requests.length,6,'Settled winnings fund more spins than the opening balance alone.');
 assert.equal(f.funds.balance,50);assert.equal(f.funds.settled,6);assert.equal(f.controller.snapshot().status,'unavailable');balanceChecks++;
}
{
 const f=balanceFixture({opening:100,payouts:[150]});f.controller.start(SLOT_AUTO_BALANCE);f.clock.advance(600);
 assert.equal(f.funds.balance,0);f.controller.sync();
 assert.equal(f.controller.snapshot().active,true,'A temporary debit must not stop an accepted round before its bonus payout settles.');
 assert.equal(f.controller.snapshot().status,'waiting');assert.equal(f.requests.length,1);
 f.clock.advance(1000);assert.equal(f.funds.balance,150);assert.equal(f.requests.length,1);
 f.clock.advance(600);assert.equal(f.requests.length,2);
 f.clock.advance(100000);assert.equal(f.funds.balance,50);assert.equal(f.controller.snapshot().status,'unavailable');balanceChecks++;
}
for(const stopAt of [400,600]) {
 const f=balanceFixture({payouts:[150]});f.controller.start(SLOT_AUTO_BALANCE);f.clock.advance(stopAt);f.controller.stop();f.clock.advance(100000);
 assert.equal(f.requests.length,stopAt===400?0:1);assert.equal(f.funds.settled,stopAt===400?0:1);
 assert.equal(f.funds.balance,stopAt===400?250:300,'Stop leaves an accepted round to settle and credit once.');
 assert.equal(f.controller.snapshot().active,false);assert.equal(f.controller.snapshot().status,'stopped');assert.equal(f.clock.queue.size,0);balanceChecks++;
}
for(const [gateName,blockedValue,reason] of [['hidden',true,'hidden'],['modalOpen',true,'modal'],['payoutOpen',true,'payout'],['normalOnly',false,'feature']]) {
 const f=balanceFixture();f.gate[gateName]=blockedValue;f.controller.start(SLOT_AUTO_BALANCE);f.clock.advance(100000);
 assert.equal(f.requests.length,0);assert.equal(f.controller.snapshot().remaining,null);assert.equal(f.controller.snapshot().pauseReason,reason);
 f.gate[gateName]=!blockedValue;f.controller.sync();f.clock.advance(599);assert.equal(f.requests.length,0);
 f.clock.advance(1);assert.equal(f.requests.length,1);f.controller.stop();f.clock.advance(100000);assert.equal(f.requests.length,1);balanceChecks++;
}
{
 const f=balanceFixture();f.controller.start(SLOT_AUTO_BALANCE);f.clock.advance(400);
 f.gate.hidden=true;f.clock.advance(200);
 assert.equal(f.requests.length,0,'Conditions are re-read at launch even without an intermediate sync.');
 assert.equal(f.controller.snapshot().pauseReason,'hidden');
 f.gate.hidden=false;f.controller.sync();f.clock.advance(600);assert.equal(f.requests.length,1);f.controller.stop();f.clock.advance(100000);balanceChecks++;
}
{
 const f=balanceFixture();f.controller.start(SLOT_AUTO_BALANCE);f.clock.advance(400);f.funds.balance=50;f.clock.advance(200);
 assert.equal(f.requests.length,0,'Current balance is checked again after the scheduled gap.');
 assert.equal(f.controller.snapshot().status,'unavailable');assert.equal(f.clock.queue.size,0);balanceChecks++;
}
for(const [failureKey,status] of [['rejectAt','launch-rejected'],['throwAt','launch-error']]) {
 const f=balanceFixture({opening:1000,[failureKey]:3});f.controller.start(SLOT_AUTO_BALANCE);f.clock.advance(100000);
 assert.equal(f.requests.length,3);assert.equal(f.controller.snapshot().accepted,2);assert.equal(f.funds.settled,2);assert.equal(f.funds.balance,800);
 assert.equal(f.controller.snapshot().status,status);assert.equal(f.controller.snapshot().active,false);assert.equal(f.clock.queue.size,0);balanceChecks++;
}
{
 const f=balanceFixture({opening:100,payouts:[150],synchronous:true});f.controller.start(SLOT_AUTO_BALANCE);f.clock.advance(100000);
 assert.equal(f.requests.length,2);assert.equal(f.funds.settled,2);assert.equal(f.funds.balance,50);
 assert.equal(f.controller.snapshot().accepted,2);assert.equal(f.controller.snapshot().status,'unavailable');assert.equal(f.clock.queue.size,0);balanceChecks++;
}
{
 const f=balanceFixture();f.controller.start(SLOT_AUTO_BALANCE);f.clock.advance(600);f.controller.disable();f.clock.advance(100000);
 assert.equal(f.requests.length,1);assert.equal(f.funds.settled,1);assert.equal(f.controller.snapshot().status,'unmounted');
 assert.equal(f.controller.start(SLOT_AUTO_BALANCE),false);assert.equal(f.clock.queue.size,0);balanceChecks++;
}
const result={status:'passed',behaviorCases:checks+balanceChecks,fixedQueueCases:checks,balanceModeCases:balanceChecks,queueCounts:[10,25,50,SLOT_AUTO_BALANCE],speedValues:[1,1.5,2],rngOrLedgerCalls:0,limitations:'Pure scheduling tests only. React integration and game-specific duration/CSS scaling need root build/browser verification.'};


console.log(JSON.stringify(result));
