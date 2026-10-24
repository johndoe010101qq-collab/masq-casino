import assert from 'node:assert/strict';
import {createBonanzaPlayback,buildBonanzaTimeline} from '../src/BonanzaPresentation.js';
import {simulateBonanzaRound} from '../src/bonanza.js';
import {createSlotPlaybackController} from '../src/slot-playback-controller.js';
import {createRoundPlayback} from '../src/RoundPlayback.js';

let seed=98;const randomInt=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
const round=simulateBonanzaRound(1000,{mode:'buy',randomInt}),original=JSON.stringify(round);
const normal=buildBonanzaTimeline(round),turbo=buildBonanzaTimeline(round,{speed:4});
assert.deepEqual(turbo.terminal,normal.terminal);turbo.steps.forEach((s,i)=>{assert.equal(s.duration,normal.steps[i].duration/4);assert.deepEqual(s.visual,normal.steps[i].visual);});
let time=0,serial=0,timers=new Map(),finished=0,phase;
const clock={now:()=>time,set:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},clear:id=>timers.delete(id)};
const runner=createBonanzaPlayback(round,{manualBonus:true,speed:4,clock,visibility:null,onVisual:v=>phase=v.phase,onFinish:()=>finished++});
const completion=runner.start();assert.equal(phase,'bonus-intro');assert.equal(timers.size,0,'No free spin is consumed before confirmation');
assert.equal(runner.continueBonus(),true);assert.equal(runner.continueBonus(),false,'Repeated confirmation has no effect');
async function tick(){const [id,t]=timers.entries().next().value;timers.delete(id);time+=t.ms;t.fn();await Promise.resolve();await Promise.resolve();}
let iterations=0;while(timers.size&&iterations++<10000)await tick();
assert.equal(phase,'bonus-summary');assert.equal(finished,0,'Summary stays open until dismissed');
assert.equal(JSON.stringify(round),original);assert.equal(runner.continueBonus(),true);
while(timers.size)await tick();await completion;assert.equal(finished,1);assert.equal(runner.skip(),false);
let closed=0;const abandoned=createBonanzaPlayback(round,{manualBonus:true,clock,visibility:null,onVisual:()=>{},onFinish:()=>closed++});const pending=abandoned.start();abandoned.dispose();await pending;assert.equal(closed,1);assert.equal(timers.size,0,'No timer survives unmount at the bonus gate');

let balance=100,busy=false,queued=[],calls=0;
const auto=createSlotPlaybackController({schedule:fn=>{queued.push(fn);return fn;},cancel:fn=>queued=queued.filter(x=>x!==fn),requestSpin:()=>{balance-=5;calls++;return true;},getConditions:()=>({busy,canAfford:balance>=5})});
auto.start();assert.equal(auto.snapshot().remaining,null,'The default automatic mode is unbounded');
for(let i=0;i<12;i++)queued.shift()();assert.equal(auto.snapshot().active,true,'Autoplay does not stop at ten');auto.stop();assert.equal(queued.length,0);assert.equal(calls,12);

let frames=new Map(),id=0,completed=0,progress=0,paused=false;
const film=createRoundPlayback({duration:1000,requestFrame:fn=>{frames.set(++id,fn);return id;},cancelFrame:n=>frames.delete(n),isHidden:()=>false,onProgress:p=>{progress=p;if(p>=.2&&!paused){paused=true;film.pause();}},onComplete:()=>completed++});
film.start();for(let t=0;t<=300&&frames.size;t+=100){const [n,fn]=frames.entries().next().value;frames.delete(n);fn(t);}
assert.equal(progress,.2);assert.equal(frames.size,0);assert.equal(completed,0);assert.equal(film.resume(),true);
let stamp=5000;while(frames.size){const [n,fn]=frames.entries().next().value;frames.delete(n);fn(stamp);stamp+=100;}
assert.equal(completed,1);assert.equal(progress,1);assert.equal(JSON.stringify(round),original);
console.log('PASS original slot presentation: turbo preserves accepted results, explicit bonus/summary gates, dispose while held, continuous autoplay past ten, Stop and resumable media clock.');
