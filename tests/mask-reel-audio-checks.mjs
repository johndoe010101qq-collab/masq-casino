import assert from 'node:assert/strict';
import {playMaskSlot} from '../src/mask-slots.js';
import {maskSlotSteps,maskSlotStepAudio} from '../src/mask-slot-presentation.js';
import {GameAudio} from '../src/audio/GameAudio.js';
let checks=0,seed=198303;
const randomInt=max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;};
class ReelProbe extends GameAudio {
 loopsSeen=[];calls=[];active=false;impacts=0;
 constructor(){super();this.context={currentTime:0,state:'running'};this.sfxEnabled=true;}
 canPlay(){return true;}
 tone(){} noise(){} duckMusic(){} mechanicalTick(){}
 impact(){this.impacts++;}
 loop(name,duration){this.active=true;this.loopsSeen.push({name,duration});}
 stopLoop(){this.active=false;}
 play(cue){this.calls.push(cue);}
}
for(const game of ['maskhouse','lecipher'])for(let sample=0;sample<40;sample++) {
 const round=playMaskSlot({game,mode:'buy',stakeCents:500,randomInt});
 const timeline=maskSlotSteps(round),audio=new ReelProbe();let previous=null;
 for(const step of timeline.steps) {
  maskSlotStepAudio(audio,{...step,game},previous);
  assert.equal(audio.active,step.phase==='reel','Reel loop is silent in bonus/reveal/summary phases');checks++;
  if(step.phase==='reel') {assert.equal(audio.loopsSeen.at(-1).duration,step.ms);checks++;}
  previous=step;
 }
 audio.endRound();const impacts=audio.impacts;audio.endRound();
 assert.equal(audio.impacts,impacts,'Idempotent stop cannot add another drum');checks++;
 assert.equal(audio.loopsSeen.length,round.spins.length);checks++;
 assert.ok(audio.loopsSeen.every(loop=>loop.duration<=2000));checks++;
 assert.equal(audio.active,false);checks++;
}
// A skipped step cancels a pending autoplay-unlock start through generation.
let unlock;const pending=new ReelProbe();pending.canPlay=()=>false;
pending.unlockPromise=new Promise(resolve=>{unlock=resolve;});
pending.beginRound('maskhouse',{durationMs:1900});pending.endRound();
unlock(true);await Promise.resolve();
assert.equal(pending.roundGame,null);assert.equal(pending.loopsSeen.length,0);checks+=2;
console.log(`Mask reel audio: ${checks} checks; one bounded loop per actual spin, quiet between spins and after skip.`);
