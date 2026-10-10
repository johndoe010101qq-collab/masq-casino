import assert from 'node:assert/strict';
import {scaleSlotPresentation} from '../src/scaleSlotPresentation.js';
const grid=Object.freeze([[{id:'same',kind:'hood'}]]),terminal=Object.freeze({grid,payoutCents:12345});
const mask=Object.freeze({steps:Object.freeze([Object.freeze({ms:1200,reelDurationMs:1600,reelDelayMs:40,grid,wins:Object.freeze([])})]),duration:1200,terminal});
for(const speed of [1,1.5,2]) {
 const scaled=scaleSlotPresentation(mask,speed);
 assert.equal(scaled.duration,1200/speed);assert.equal(scaled.steps[0].ms,1200/speed);assert.equal(scaled.steps[0].reelDurationMs,1600/speed);assert.equal(scaled.steps[0].reelDelayMs,40/speed);
 assert.equal(scaled.terminal,terminal);assert.equal(scaled.steps[0].grid,grid);assert.equal(scaled.steps[0].wins,mask.steps[0].wins);
 assert.equal(mask.steps[0].ms,1200);assert.equal(mask.terminal.payoutCents,12345);
}
const visual=Object.freeze({grid,totalPayoutCents:12345});
const bonanza=Object.freeze({steps:[Object.freeze({visual,duration:850,cue:'win'})],terminal});
const scaled=scaleSlotPresentation(bonanza,2);assert.equal(scaled.steps[0].duration,425);assert.equal(scaled.steps[0].visual,visual);assert.equal(scaled.terminal,terminal);
assert.throws(()=>scaleSlotPresentation(mask,3));
console.log('Visual speed tests passed: times scaled; terminal/grid/wins/payout objects retained; original timeline unmodified.');

import {simulateBonanzaRound} from '../src/bonanza.js';
import {buildBonanzaTimeline} from '../src/BonanzaPresentation.js';
let seed=99;const randomInt=max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;};
const round=simulateBonanzaRound(1000,{mode:'buy',randomInt}),proof=JSON.stringify(round);
const normal=buildBonanzaTimeline(round);for(const speed of [1.5,2]){const fast=buildBonanzaTimeline(round,{speed});assert.equal(fast.steps.length,normal.steps.length);assert.deepEqual(fast.terminal,normal.terminal);for(let i=0;i<fast.steps.length;i++){assert.equal(fast.steps[i].duration,normal.steps[i].duration/speed);assert.deepEqual(fast.steps[i].visual,normal.steps[i].visual);}assert.equal(JSON.stringify(round),proof);}
console.log('Real Bonanza complete-round speed: all visual/credit fields unchanged.');
