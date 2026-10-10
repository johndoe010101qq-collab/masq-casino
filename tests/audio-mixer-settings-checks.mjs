import assert from 'node:assert/strict';
import {GameAudio} from '../src/audio/GameAudio.js';
import {applyDemoAudio} from '../src/demo-ui-settings.js';

// Inspect the actual gains written by GameAudio, rather than a setter mock.
const gain=()=>({gain:{target:null,cancelScheduledValues(){},setTargetAtTime(value){this.target=value;}}});
const audio=new GameAudio();
audio.context={currentTime:12};audio.master=gain();audio.sfxBus=gain();audio.musicBus=gain();
audio.sfxEnabled=true;audio.musicEnabled=true;
const values=()=>({master:audio.master.gain.target,sfx:audio.sfxBus.gain.target,music:audio.musicBus.gain.target});
applyDemoAudio(audio,{sfxVolume:100,musicVolume:100});
assert.deepEqual(values(),{master:.62*.65,sfx:.7,music:.27},'Default mixer matches existing levels');
applyDemoAudio(audio,{sfxVolume:0,musicVolume:100});
assert.deepEqual(values(),{master:.62*.65,sfx:0,music:.27},'SFX zero cannot mute music');
applyDemoAudio(audio,{sfxVolume:100,musicVolume:0});
assert.deepEqual(values(),{master:.62*.65,sfx:.7,music:0},'Music zero cannot mute effects');
applyDemoAudio(audio,{sfxVolume:25,musicVolume:50});
assert.deepEqual(values(),{master:.62*.65,sfx:.175,music:.135});
audio.ducks.set('round',{});audio.updateGains();
assert.deepEqual(values(),{master:.62*.65,sfx:.175,music:.135*.22},'Music duck preserves independent SFX scaling');
audio.musicEnabled=false;audio.updateGains();assert.equal(values().music,0);assert.equal(values().sfx,.175);
audio.musicEnabled=true;audio.sfxEnabled=false;audio.updateGains();assert.equal(values().sfx,0);assert.equal(values().music,.135*.22);
audio.setSfxVolume(2);assert.equal(audio.sfxVolume,1);
audio.setSfxVolume(-1);assert.equal(audio.sfxVolume,0);
console.log('Audio mixer settings passed: independent SFX/music, unchanged default/master gain, scaling, manual mute, ducking and limits.');
