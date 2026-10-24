import assert from 'node:assert/strict';
import {createSlotPlaybackController} from '../src/slot-playback-controller.js';
let busy=false,calls=0,resolve,queue=[];
const controller=createSlotPlaybackController({allowAsync:true,
 requestSpin(){calls++;busy=true;return new Promise(r=>resolve=r);},
 getConditions:()=>({busy,ready:true,canAfford:true}),
 schedule:fn=>{const id={fn};queue.push(id);return id;},cancel:id=>{queue=queue.filter(x=>x!==id);}
});
controller.start(10);assert.equal(queue.length,1);queue.shift().fn();
controller.sync();assert.equal(calls,1);assert.equal(queue.length,0,'No second request while server acceptance is pending');
resolve(true);await new Promise(r=>setImmediate(r));assert.equal(controller.snapshot().accepted,1);assert.equal(controller.snapshot().remaining,9);
busy=false;controller.sync();assert.equal(queue.length,1);queue.shift().fn();controller.stop();
resolve(true);await new Promise(r=>setImmediate(r));busy=false;controller.sync();assert.equal(queue.length,0);assert.equal(calls,2,'Stop leaves the accepted round alone and schedules nothing else');
controller.start(10);queue.shift().fn();resolve(false);await new Promise(r=>setImmediate(r));assert.equal(controller.snapshot().active,false);assert.equal(controller.snapshot().status,'launch-rejected');
console.log('PASS huEVO asynchronous autoplay: pending acceptance, count once, no duplicate request, Stop during pending acceptance, rejected server round.');
