import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {getBonanzaMascotPresentation as pose,bonanzaMascotCreditedCents as credited,bonanzaShownPayoutCents as shown} from '../src/bonanza-mascot-presentation.js';
import {playBonanzaRound} from '../src/bonanza.js';
import {buildBonanzaTimeline} from '../src/BonanzaPresentation.js';
import {transformWithOxc} from '../node_modules/vite/dist/node/index.js';
import postcss from '../node_modules/postcss/lib/postcss.js';

let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
eq(pose(null).pose,'idle');eq(credited(null),0);
eq(pose({phase:'deal',totalPayoutCents:999999}).pose,'watch');
for(const phase of ['win','payout','payout-out']){
  eq(pose({phase,cascadePayoutCents:1}).pose,'win');
  eq(pose({phase,cascadePayoutCents:0,uncappedPayoutCents:100000,currentPayoutCents:10000,totalPayoutCents:100000}).pose,'watch');
  eq(pose({phase,cascadePayoutCents:100000,creditedCascadePayoutCents:0}).pose,'watch');
}
eq(pose({phase:'spin-summary',spinSummary:{payoutCents:0},totalPayoutCents:100000}).pose,'idle');
eq(pose({phase:'spin-summary',spinSummary:{payoutCents:1}}).pose,'win');
eq(pose({phase:'spin-summary',spinSummary:{payoutCents:100,creditedPayoutCents:0}}).pose,'idle');
eq(pose({phase:'bonus-summary',bonusPayoutCents:0,totalPayoutCents:10000}).pose,'idle');
eq(pose({phase:'bonus-summary',bonusPayoutCents:1}).pose,'win');
eq(pose({phase:'settled',totalPayoutCents:100,creditedTotalPayoutCents:0}).pose,'idle');
eq(pose({phase:'bonus-payment',bonusPaymentCents:1}).pose,'win');
eq(pose({phase:'bonus-payment',bonusPaymentCents:100,creditedBonusPaymentCents:0}).pose,'watch');
eq(pose({phase:'bonus-payment',bonusPaymentCents:0,totalPayoutCents:9999}).pose,'watch');
eq(shown({phase:'deal',currentPayoutCents:99,totalPayoutCents:10}),10);
eq(shown({phase:'payout',currentPayoutCents:99,totalPayoutCents:10}),109);
eq(shown({phase:'payout',currentPayoutCents:99,creditedCurrentPayoutCents:0,totalPayoutCents:10}),10);
eq(shown({phase:'spin-summary',currentPayoutCents:99,totalPayoutCents:10}),10);
for(const amount of [-1,NaN,Infinity,1.5,'10'])eq(pose({phase:'win',cascadePayoutCents:amount}).pose,'watch');
for(const phase of ['scatter','bonus-intro'])eq(pose({phase,totalPayoutCents:0}).pose,'bonus');

// A late animationend can expire only the exact visual that started it.
const outcome=Object.freeze({phase:'settled',totalPayoutCents:2000});
eq(pose(outcome).transient,true);
eq(pose(outcome,outcome).pose,'idle');eq(pose(outcome,outcome).transient,false);
eq(pose({...outcome},outcome).pose,'win');
const frozen=Object.freeze({phase:'win',cascadePayoutCents:100});
const untouched=JSON.stringify(frozen);
eq(Object.isFrozen(pose(frozen)),true);eq(JSON.stringify(frozen),untouched);

let seed=0x130ba114;
const randomInt=maximum=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/4294967296*maximum);};
let rounds=0,steps=0,winSteps=0,zeroPaidSteps=0;
for(const mode of ['paid','buy'])for(let index=0;index<80;index++){
  const round=playBonanzaRound({stakeCents:5000,randomInt,mode});
  const before=JSON.stringify(round);
  const timeline=buildBonanzaTimeline(round);rounds++;
  for(const view of [...timeline.steps.map(step=>step.visual),timeline.terminal]){
    const mapped=pose(view);steps++;
    if(['win','payout','payout-out','spin-summary','settled','bonus-summary'].includes(view.phase)){
      eq(mapped.pose==='win',credited(view)>0);
      if(mapped.pose==='win')winSteps++;else zeroPaidSteps++;
    }
    eq(Number.isInteger(mapped.frame)&&mapped.frame>=0&&mapped.frame<=7,true);
    assert(Number.isSafeInteger(shown(view))&&shown(view)>=0&&shown(view)<=round.payoutCents);checks++;
  }
  eq(credited(timeline.terminal),round.payoutCents);
  eq(JSON.stringify(round),before);
}
assert(winSteps>0&&zeroPaidSteps>0);checks++;
for(const capCents of [1,100,1000])for(let index=0;index<8;index++){
  const capped=playBonanzaRound({stakeCents:5000,randomInt,mode:'buy',capCents});
  const timeline=buildBonanzaTimeline(capped);
  for(const step of timeline.steps){assert(shown(step.visual)<=capped.payoutCents);checks++;}
  eq(shown(timeline.terminal),capped.payoutCents);
}

// Parse the real shipped JSX/CSS and check reduced-motion/hidden-tab controls.
const names=['BonanzaMascot.jsx','bonanza-mascot-presentation.js','BonanzaCommercial.css'];
const jsx=fs.readFileSync(new URL('../src/BonanzaMascot.jsx',import.meta.url),'utf8');
const transformed=await transformWithOxc(jsx,'BonanzaMascot.jsx',{jsx:{runtime:'classic'}});
assert(transformed.code.length>0);checks++;
const slotJSX=fs.readFileSync(new URL('../src/BonanzaSlot.jsx',import.meta.url),'utf8');
const compiledSlot=await transformWithOxc(slotJSX,'BonanzaSlot.jsx',{jsx:{runtime:'classic'}});
assert(compiledSlot.code.length>0);checks++;
assert(!/\b(setTimeout|setInterval|Math\.random|randomInt|session\.)\b/.test(jsx));checks++;
const css=postcss.parse(fs.readFileSync(new URL('../src/BonanzaCommercial.css',import.meta.url),'utf8'));
let paused=false,reduced=false,square=false;
css.walkRules(rule=>{
  if(rule.selector.includes("[data-playback-paused='true']"))rule.walkDecls('animation-play-state',decl=>{paused=decl.value==='paused'&&decl.important;});
  if(rule.selector.includes("[data-reduced-motion='true']"))rule.walkDecls('animation',decl=>{reduced=decl.value==='none'&&decl.important;});
  if(rule.selector.endsWith('.slot-cell .slot-sprite')){
    const d=Object.fromEntries(rule.nodes.filter(node=>node.type==='decl').map(node=>[node.prop,node.value]));
    square=d.width===d.height&&d.width.includes('100cqh')&&d.width.includes('100cqw');
  }
});
eq(paused,true);eq(reduced,true);eq(square,true);
const sha256=name=>createHash('sha256').update(fs.readFileSync(new URL('../src/'+name,import.meta.url))).digest('hex');
console.log(JSON.stringify({passed:true,checks,rounds,steps,winSteps,zeroPaidSteps,jsxTransformed:true,
  scope:'Accepted native Bonanza timelines; credited outcomes, pure presentation, reduced motion and square image sizing. Browser verification remains separate.',
  sourceSHA256:Object.fromEntries(names.map(name=>[name,sha256(name)]))}));
