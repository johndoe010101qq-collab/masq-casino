import assert from 'node:assert/strict';
import { readAudioPreferences, saveAudioPreferences, AUDIO_PREFERENCES_KEY } from '../src/audio/audioPreferences.js';
import { GameAudio, MUSIC_PROFILES } from '../src/audio/GameAudio.js';
import { createRoundPlayback } from '../src/RoundPlayback.js';
import { GAME_META } from '../src/game-meta.js';
let assertions = 0;
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
const data = new Map();
const storage = { getItem:key=>data.get(key)??null, setItem:(key,value)=>data.set(key,value) };
equal(readAudioPreferences(storage), {music:true,sfx:true}, 'Both channels default on');
saveAudioPreferences(storage,{music:false,sfx:true});
equal(readAudioPreferences(storage),{music:false,sfx:true},'Manual mute survives remount');
data.set(AUDIO_PREFERENCES_KEY,'broken'); equal(readAudioPreferences(storage),{music:true,sfx:true});
data.set(AUDIO_PREFERENCES_KEY,JSON.stringify({music:false})); equal(readAudioPreferences(storage),{music:false,sfx:true});
const listeners = new Map();
globalThis.document = { hidden:false, addEventListener:(type,fn)=>listeners.set(type,fn), removeEventListener:(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type);} };
class ProbeAudio extends GameAudio {
  builds=0; starts=0; notes=0; closed=0;
  createContext(){if(this.context)return this.context;this.builds++;this.context={state:'suspended',currentTime:0,resume:async()=>{this.context.state='running';},suspend:async()=>{this.context.state='suspended';},close:async()=>{this.closed++;}};return this.context;}
  updateGains(){}
  startMusic(){this.starts++;this.musicTimer=1;}
  stopMusic(){this.musicTimer=null;}
  stopVoices(){}
  tone(){this.notes++;}
  noise(){}
  mechanicalTick(){}
  impact(){}
  loop(){}
}
const audio = new ProbeAudio(); audio.attach(); audio.setPreferences({music:true,sfx:true});
equal(audio.builds,0,'Mount does not trigger autoplay context');
const unlock = audio.unlock(); audio.beginRound('coinflip'); await unlock; await Promise.resolve();
equal(audio.builds,1); equal(audio.starts,1); equal(audio.notes,1,'First key gesture preserves round cue through resume');
for(let i=0;i<100;i++){await audio.unlock();audio.play('ui');}
equal(audio.builds,1,'100 actions share context'); equal(audio.starts,1,'Repeated gestures do not duplicate music loop');
audio.setPreferences({music:false,sfx:true}); await audio.unlock(); equal(audio.starts,1,'Music stays muted');
audio.setPreferences({music:true,sfx:true}); equal(audio.starts,2);
document.hidden=true; await audio.handleVisibility(); equal(audio.context.state,'suspended');equal(audio.musicTimer,null);
document.hidden=false; await audio.handleVisibility();equal(audio.starts,3);
audio.dispose();audio.dispose();equal(audio.closed,1);equal(listeners.size,0);
const loopProbe = new ProbeAudio(); loopProbe.attach(); loopProbe.setPreferences({music:false,sfx:true}); await loopProbe.unlock();
let loopSteps=0; GameAudio.prototype.loop.call(loopProbe,'flight',1000,()=>{loopSteps++;return 100000;});
equal(loopSteps,1); document.hidden=true; await loopProbe.handleVisibility(); equal(loopProbe.loops.get('flight').timer,null,'Hidden SFX loop has no polling timer');
document.hidden=false; await loopProbe.handleVisibility();equal(loopSteps,2,'Visible SFX loop resumes from audio time'); loopProbe.dispose();
const remount=new ProbeAudio();remount.attach();remount.setPreferences({music:false,sfx:false});await remount.unlock();equal(remount.builds,0);remount.dispose();
const themes = new ProbeAudio(); themes.setPreferences({music:true,sfx:false});
themes.setMusicMode('blackjack'); equal(themes.builds,0,'Theme changes do not bypass browser autoplay');
await themes.unlock(); equal(themes.starts,1);
themes.setMusicMode('dice'); equal(themes.starts,2,'Entering another room replaces the music loop');
themes.setMusicMode('dice'); equal(themes.starts,2,'Same room keeps one loop');
themes.setPreferences({music:false,sfx:false}); themes.setMusicMode('plinko'); equal(themes.starts,2,'New room respects manual mute');
themes.dispose();
class MusicProbe extends ProbeAudio {
  score=[];
  tone(frequency,duration,level,options){this.score.push({frequency,duration,level,...options});}
  noise(duration,level,from,to,options){this.score.push({duration,level,from,to,...options});}
}
const musicScores=[];
for(const mode of Object.keys(MUSIC_PROFILES)) {
  const probe = new MusicProbe(); probe.musicMode=mode;
  for(let step=0;step<32;step++) probe.musicBeat(step,step*.25);
  equal(probe.score.every(note=>note.channel==='music'&&note.tag==='music'),true,'Every background voice obeys the music switch');
  musicScores.push(JSON.stringify(probe.score)); probe.dispose();
}
equal(Object.keys(MUSIC_PROFILES).sort(),['hall',...GAME_META.map(game=>game.id)].sort(),'Every catalog game has a background arrangement');
equal(new Set(musicScores).size,10,'Hall and nine games have distinct authored arrangements');
const fanfare = new MusicProbe(); fanfare.setPreferences({music:false,sfx:true}); await fanfare.unlock();
fanfare.play('payout',{positive:true});
equal(fanfare.score.filter(note=>note.to===1568||note.to===2093).length,2,'Winning payout includes the two rising whistles');
fanfare.score=[]; fanfare.play('payout',{positive:false});
equal(fanfare.score.some(note=>note.to===1568||note.to===2093),false,'Returned stake never triggers a winning whistle');
fanfare.dispose();
let hidden=false, sequence=0, completes=0, lastProgress=-1;
const frames=new Map();
const request=fn=>{const id=++sequence;frames.set(id,fn);return id;};
const cancel=id=>frames.delete(id);
const fire=now=>{const entries=[...frames.values()];frames.clear();entries.forEach(fn=>fn(now));};
const runner=createRoundPlayback({duration:1000,requestFrame:request,cancelFrame:cancel,isHidden:()=>hidden,onProgress:value=>lastProgress=value,onComplete:()=>completes++});
runner.start();fire(0);fire(100);fire(200);fire(300);equal(lastProgress,.3);
hidden=true;runner.visibilityChanged();equal(frames.size,0);
hidden=false;runner.visibilityChanged();fire(50000);equal(lastProgress,.3,'Hidden wall time does not advance animation');fire(50700);equal(lastProgress,.4,'A foreground stall cannot jump to the result');for(let now=50800;now<=51300;now+=100)fire(now);equal(lastProgress,1);equal(completes,1);equal(runner.finish(),false);equal(completes,1);
const unmount=createRoundPlayback({duration:1000,requestFrame:request,cancelFrame:cancel,isHidden:()=>false,onProgress:()=>{},onComplete:()=>completes++});unmount.start();unmount.finish(false);unmount.finish(false);equal(completes,2);equal(frames.size,0);
// Run the actual Dice scheduler on an audio-time clock. Its contact landmarks
// must still agree with the scene after a long hidden-tab pause, and stopping
// or muting a roll must prevent all later contacts.
class DiceFoleyProbe extends ProbeAudio {
  contacts=[]; rolls=[]; noiseVoices=[];
  loop(...args){return GameAudio.prototype.loop.apply(this,args);}
  noise(duration,level,from,to,options={}){this.noiseVoices.push({duration,level,from,to,...options});}
  impact(){this.notes++;}
  diceContact(time,strength){this.contacts.push({time,strength});super.diceContact(time,strength);}
  diceRollContact(time,strength){this.rolls.push({time,strength});super.diceRollContact(time,strength);}
}
const actualSetTimeout=globalThis.setTimeout, actualClearTimeout=globalThis.clearTimeout;
const scheduled=new Map(); let timerId=0, wallMs=0;
globalThis.setTimeout=(callback,delay)=>{const id=++timerId;scheduled.set(id,{callback,at:wallMs+delay});return id;};
globalThis.clearTimeout=id=>scheduled.delete(id);
const foley=new DiceFoleyProbe();
const advanceFoley=ms=>{
  const end=wallMs+ms;
  const move=at=>{if(foley.context?.state==='running')foley.context.currentTime+=(at-wallMs)/1000;wallMs=at;};
  for(;;){const next=[...scheduled].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;
    move(next[1].at);scheduled.delete(next[0]);next[1].callback();}
  move(end);
};
try {
  foley.attach();foley.setPreferences({music:false,sfx:true});await foley.unlock();
  const durationMs=GAME_META.find(game=>game.id==='dice').duration*1000;
  foley.beginRound('dice',{durationMs});
  advanceFoley(durationMs*.2);
  equal(foley.contacts.length,1,'First contact follows the first visible bounce');
  document.hidden=true;await foley.handleVisibility();advanceFoley(60000);
  equal(foley.contacts.length,1,'Hidden wall time cannot consume Dice contacts');
  equal(scheduled.size,0,'Hidden Dice has no audio polling timer');
  document.hidden=false;await foley.handleVisibility();advanceFoley(durationMs*.8+100);
  equal(foley.contacts.length,4,'Exactly four main Dice contacts');
  for(const [index,phase] of [.16,.34,.53,.72].entries()){
    equal(Math.abs(foley.contacts[index].time-phase*durationMs/1000)<.027,true,
      'Contact remains aligned after pause: '+JSON.stringify(foley.contacts));
  }
  equal(foley.contacts.every((contact,index)=>index===0||contact.strength<foley.contacts[index-1].strength),true,'Bounce contacts damp naturally');
  equal(foley.rolls.length>0,true,'Quiet edge roll follows the final bounce');
  equal(foley.notes,0,'Dice foley creates no pitched or generic impact notes');
  foley.endRound();equal(foley.notes,0,'Dice settles without a generic ending drum');
  const beforeStop=foley.contacts.length;
  foley.beginRound('dice',{durationMs});advanceFoley(durationMs*.2);foley.endRound();advanceFoley(durationMs);
  equal(foley.contacts.length,beforeStop+1,'Skip cancels all later Dice contacts');
  const beforeMute=foley.contacts.length;
  foley.beginRound('dice',{durationMs});foley.setPreferences({music:false,sfx:false});advanceFoley(durationMs);
  equal(foley.contacts.length,beforeMute,'Manual SFX mute cancels the roll');
  foley.dispose();equal(scheduled.size,0,'Dispose leaves no Dice or duck timers');
} finally {
  foley.dispose();document.hidden=false;globalThis.setTimeout=actualSetTimeout;globalThis.clearTimeout=actualClearTimeout;
}
console.log('Audio preferences, Dice foley, gesture lifecycle and playback: '+assertions+' assertions passed');

