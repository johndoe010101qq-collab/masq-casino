import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { getLexofMascotPresentation as pose, lexofMascotCreditedCents } from '../src/lexof-mascot-presentation.js';
import { playMaskSlot } from '../src/mask-slots.js';
import { maskSlotSteps } from '../src/mask-slot-presentation.js';
import { transformWithOxc } from '../node_modules/vite/dist/node/index.js';
import postcss from '../node_modules/postcss/lib/postcss.js';

let checks=0;
const eq=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const le=visual=>pose(visual,'lecipher');
const frame=(visual,expected)=>eq(le(visual).frame,expected);

eq(pose().visible,false);
for(const game of ['maskhouse','slots','coinflip',null,undefined,'LeXof'])eq(pose({phase:'win',wins:[{payoutCents:50}]},game).visible,false);
frame(null,0);eq(lexofMascotCreditedCents(null),0);
frame({phase:'idle'},0);frame({phase:'reel'},2);frame({phase:'cascade'},2);
for(const phase of ['decode','reveal-coins','boost','collector','scatter','bonus','bonus-selection','profile-gift'])frame({phase},4);

frame({phase:'win',wins:[{payoutCents:1}]},3);
frame({phase:'payline',activeLine:{payoutCents:1}},3);
frame({phase:'collect',featurePayoutCents:1},3);
frame({phase:'bonus-payment',bonusPaymentCents:1},3);
// Prior wins, preview coin values, and raw payout values cannot cause a cheer.
frame({phase:'win',totalPayoutCents:10000,shownPayoutCents:11000,wins:[]},2);
frame({phase:'win',wins:[{payoutCents:0,rawPayoutCents:10000}]},2);
frame({phase:'win',wins:[{payoutCents:10000,creditedPayoutCents:0}]},2);
frame({phase:'collect',featurePayoutCents:10000,creditedFeaturePayoutCents:0,coinPreviewPayouts:[{payoutCents:50000}]},2);
frame({phase:'summary',spinPayoutCents:0,totalPayoutCents:10000},5);
frame({phase:'summary',spinPayoutCents:1,totalPayoutCents:0},3);
frame({phase:'settled',totalPayoutCents:0,spinPayoutCents:10000},5);
frame({phase:'settled',totalPayoutCents:1},3);
eq(le({phase:'summary',spinPayoutCents:0}).transient,true);
eq(le({phase:'reel'}).transient,false);
for(const invalid of [-1,NaN,Infinity,1.5,'500'])frame({phase:'collect',featurePayoutCents:invalid},2);

const frozen=Object.freeze({phase:'win',serial:7,wins:Object.freeze([Object.freeze({payoutCents:123,rawPayoutCents:99999})])});
const before=JSON.stringify(frozen),mapped=le(frozen);
eq(Object.isFrozen(mapped),true);eq(mapped.creditedPayoutCents,123);eq(JSON.stringify(frozen),before);eq(le(frozen),mapped);

const outcome=Object.freeze({phase:'settled',totalPayoutCents:50});
const sameValueNextRound=Object.freeze({...outcome});
eq(pose(outcome,'lecipher').frame,3);
eq(pose(outcome,'lecipher',outcome).frame,0);
eq(pose(outcome,'lecipher',outcome).transient,false);
eq(pose(sameValueNextRound,'lecipher',outcome).frame,3);
const losingSpin=Object.freeze({phase:'summary',serial:8,spinPayoutCents:0});
eq(pose(losingSpin,'lecipher',losingSpin).frame,0);
eq(pose({...losingSpin,serial:9},'lecipher',losingSpin).frame,5);
eq(pose({phase:'reel',serial:10},'lecipher',losingSpin).frame,2);
eq(le({phase:'win',serial:7,wins:[{payoutCents:50}]}).reactionKey===le({phase:'win',serial:8,wins:[{payoutCents:50}]}).reactionKey,false);

let state=0x12a8b6e5;
const randomInt=n=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return Math.floor(state/4294967296*n);};
let rounds=0,steps=0,actualWinPoses=0,lossSummaries=0;
for(const selection of [{mode:'paid'},{mode:'buy',bonusTier:'luck'},{mode:'buy',bonusTier:'gold'},{mode:'paid',featureMode:'hunt'},{mode:'paid',featureMode:'rainbow'}]) {
  for(let i=0;i<40;i++) {
    const round=playMaskSlot({game:'lecipher',stakeCents:5000,randomInt,...selection});
    const timeline=maskSlotSteps(round);rounds++;
    for(const visual of [...timeline.steps,timeline.terminal]) {
      const result=le(visual);steps++;
      if(['win','payline','collect','bonus-payment','summary','settled'].includes(visual.phase)) {
        const actual=lexofMascotCreditedCents(visual);
        eq(result.pose==='win',actual>0);
        if(result.pose==='win')actualWinPoses++;
        if(visual.phase==='summary'&&actual===0)lossSummaries++;
      }
      eq(pose(visual,'maskhouse').visible,false);
    }
    eq(le(timeline.terminal).creditedPayoutCents,round.payoutCents);
  }
}
assert(actualWinPoses>0&&lossSummaries>0);checks++;

const root=new URL('../src/',import.meta.url);
const jsx=fs.readFileSync(new URL('LexofMascot.jsx',root),'utf8');
const transformed=await transformWithOxc(jsx,new URL('LexofMascot.jsx',root).pathname,{jsx:{runtime:'classic'}});
assert(transformed.code.length>0);checks++;
const css=fs.readFileSync(new URL('LexofMascot.css',root),'utf8');
const parsed=postcss.parse(css);let cssRules=0;parsed.walkRules(()=>cssRules++);
assert(cssRules>=20);checks++;
let outcomeTiming=false,idleTiming=false,pausedTiming=false,reducedTiming=false;
parsed.walkRules(rule=>{
  if(rule.selector.includes('.lexof-mascot'))rule.walkDecls(decl=>{
    if(/^(animation|transition)(-|$)/.test(decl.prop)){
      assert(!decl.value.includes('--slot-speed'),'LeXof mascot reactions must keep their own pace at every reel speed');checks++;
    }
  });
  const animations=[];rule.walkDecls('animation',decl=>animations.push(decl.value));
  if(rule.selector.includes("[data-transient='true']"))outcomeTiming ||= animations.some(value=>value.includes('lexof-mascot-outcome 1.4s')&&value.includes('steps(1,end)'));
  if(rule.selector.includes("[data-pose='idle']")&&rule.selector.includes('sprite'))idleTiming=animations.some(value=>value.includes('5.6s')&&!value.includes('--slot-speed'));
  if(rule.selector.includes("[data-playback-paused='true']"))rule.walkDecls('animation-play-state',decl=>{pausedTiming=decl.value==='paused'&&decl.important;});
  if(rule.selector.includes("[data-reduced-motion='true']"))rule.walkDecls('animation',decl=>{reducedTiming=decl.value==='none'&&decl.important;});
});
eq(outcomeTiming,true);eq(idleTiming,true);eq(pausedTiming,true);eq(reducedTiming,true);
assert(jsx.includes("event.animationName === 'lexof-mascot-outcome'"));checks++;
assert(!/\b(setTimeout|setInterval|Math\.random|randomInt|session\.)\b/.test(jsx));checks++;
const sha=name=>createHash('sha256').update(fs.readFileSync(new URL(name,root))).digest('hex');
const receipt={passed:true,checks,rounds,steps,actualWinPoses,lossSummaries,jsxTransformed:true,cssRules,
  scope:'Deterministic presentation and current accepted LeXof timeline data; no browser screenshot validation',
  sourceSHA256:Object.fromEntries(['LexofMascot.jsx','LexofMascot.css','lexof-mascot-presentation.js'].map(name=>[name,sha(name)]))};

console.log(JSON.stringify(receipt));
