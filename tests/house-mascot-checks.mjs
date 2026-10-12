import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformWithOxc} from 'vite';
import postcss from 'postcss';
import {getHouseMascotPresentation as pose,houseMascotCreditedCents as credit} from '../src/house-mascot-presentation.js';
import {playProfiledMaskSlot} from '../src/profiled-mask-slots.js';
import {maskSlotSteps} from '../src/mask-slot-presentation.js';

let checks=0;const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
const house=visual=>pose(visual,'maskhouse');
eq(house(null).frame,0);eq(credit(null),0);
for(const game of [null,undefined,'lecipher','slots','coinflip','Mask Hou$e'])eq(pose({phase:'win',wins:[{payoutCents:1}]},game).visible,false);
for(const phase of ['reel','deal','remove','cascade'])eq(house({phase}).pose,'watch');
for(const phase of ['scatter','bonus','bonus-selection','bonus-intro','profile-gift'])eq(house({phase}).pose,'bonus');
for(const visual of [{phase:'win',wins:[{payoutCents:1}]},{phase:'payline',activeLine:{payoutCents:1}},{phase:'bonus-payment',bonusPaymentCents:1},{phase:'summary',spinPayoutCents:1},{phase:'settled',totalPayoutCents:1}])eq(house(visual).pose,'win');
for(const visual of [
  {phase:'win',wins:[{payoutCents:0,rawPayoutCents:10000}],shownPayoutCents:50000,totalPayoutCents:50000},
  {phase:'win',wins:[{payoutCents:10000,creditedPayoutCents:0}]},
  {phase:'payline',activeLine:{payoutCents:10000,creditedPayoutCents:0}},
  {phase:'bonus-payment',bonusPaymentCents:10000,creditedBonusPaymentCents:0},
  {phase:'win',creditedPayoutCents:0,wins:[{payoutCents:10000}]},
])eq(house(visual).pose,'watch','Only credited amounts can celebrate');
eq(house({phase:'summary',spinPayoutCents:0,totalPayoutCents:50000}).pose,'loss','Past profits cannot cheer a losing spin');
eq(house({phase:'settled',totalPayoutCents:10000,creditedTotalPayoutCents:0}).pose,'loss');
for(const invalid of [-1,Infinity,NaN,'1',.5])eq(house({phase:'win',wins:[{payoutCents:invalid}]}).pose,'watch');
const finished=Object.freeze({phase:'settled',serial:9,totalPayoutCents:123});
eq(pose(finished,'maskhouse',finished).pose,'idle');
eq(pose({...finished},'maskhouse',finished).pose,'win','Late completion cannot expire another visual snapshot');
eq(pose(finished,'maskhouse').transient,true);
eq(house({phase:'reel'}).transient,false);
eq(Object.isFrozen(house(finished)),true);

let seed=0x51453b17,randomCalls=0;
const randomInt=max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;randomCalls++;return Math.floor(seed/4294967296*max);};
let rounds=0,steps=0,wins=0,losses=0,bonuses=0;
for(const rtpProfile of ['rtp50','rtp55','rtp60'])for(const mode of ['paid','buy'])for(let index=0;index<25;index++) {
  const round=playProfiledMaskSlot({game:'maskhouse',stakeCents:5000,mode,bonusTier:mode==='buy'?'sticky':undefined,rtpProfile,randomInt});
  const before=JSON.stringify(round),beforeRng=randomCalls,timeline=maskSlotSteps(round);rounds++;
  for(const visual of [...timeline.steps,timeline.terminal]){
    steps++;const mapped=house(visual),credited=credit(visual);
    if(['win','payline','bonus-payment','summary','settled'].includes(visual.phase))eq(mapped.pose==='win',credited>0);
    if(mapped.pose==='win')wins++;
    if(mapped.pose==='loss')losses++;
    if(mapped.pose==='bonus')bonuses++;
    eq(pose(visual,'lecipher').visible,false);
  }
  eq(house(timeline.terminal).creditedPayoutCents,round.payoutCents);
  eq(JSON.stringify(round),before,'Host mapping cannot mutate the settled financial result');
  eq(randomCalls,beforeRng,'Host mapping cannot draw extra RNG');
}
assert(wins>0&&losses>0&&bonuses>0);checks++;

const root=new URL('../src/',import.meta.url);
const jsx=fs.readFileSync(new URL('HouseMascot.jsx',root),'utf8');
const source=jsx.replace(/import ['"]\.\/[^'"\n]+\.css['"];?\r?\n/g,'')
  .replace(/from ['"]react['"]/g,'from '+JSON.stringify(new URL('../node_modules/react/index.js',import.meta.url).href))
  .replace(/from ['"]\.\/house-mascot-presentation\.js['"]/g,'from '+JSON.stringify(new URL('house-mascot-presentation.js',root).href));
const transformed=await transformWithOxc(source,'HouseMascot.jsx',{jsx:{runtime:'classic'}});
const {default:HouseMascot}=await import('data:text/javascript;base64,'+Buffer.from(transformed.code).toString('base64'));
const html=visual=>renderToStaticMarkup(React.createElement(HouseMascot,{game:'maskhouse',visual}));
assert.match(html({phase:'win',wins:[{payoutCents:1}]}),/data-pose="win"/);checks++;
assert.match(html({phase:'win',wins:[{payoutCents:0,rawPayoutCents:99999}]}),/data-pose="watch"/);checks++;
assert.match(html({phase:'summary',spinPayoutCents:0,totalPayoutCents:99999}),/data-pose="loss"/);checks++;
eq(renderToStaticMarkup(React.createElement(HouseMascot,{game:'lecipher',visual:{phase:'bonus'}})),'');
assert.match(renderToStaticMarkup(React.createElement(HouseMascot,{game:'maskhouse',visual:{phase:'bonus'},reducedMotion:true})),/data-reduced-motion="true"/);checks++;
assert(!/\b(setTimeout|setInterval|Math\.random|randomInt|session\.)\b/.test(jsx));checks++;
assert(jsx.includes("event.animationName==='house-mascot-outcome'"));checks++;

const css=fs.readFileSync(new URL('HouseMascot.css',root),'utf8'),parsed=postcss.parse(css);
let dance=false,paused=false,reduced=false,finite=false;
parsed.walkRules(rule=>{
  if(rule.selector.includes('.house-mascot'))rule.walkDecls(decl=>{
    if(/^(animation|transition)(-|$)/.test(decl.prop)){
      assert(!decl.value.includes('--slot-speed'),'House mascot reactions must keep their own pace at every reel speed');checks++;
    }
  });
  if(rule.selector.includes("[data-pose='win']")&&rule.selector.includes('sprite'))rule.walkDecls('background-image',decl=>{dance||=decl.value.includes('/maskhouse-host-dance-packed-v13.webp');});
  if(rule.selector.includes("[data-playback-paused='true']"))rule.walkDecls('animation-play-state',decl=>{paused||=decl.value==='paused'&&decl.important;});
  if(rule.selector.includes("[data-reduced-motion='true']"))rule.walkDecls('animation',decl=>{reduced||=decl.value==='none'&&decl.important;});
  if(rule.selector.includes("[data-transient='true']"))rule.walkDecls('animation',decl=>{finite||=decl.value.includes('house-mascot-outcome')&&!/outcome[^,]*infinite/.test(decl.value);});
});
eq(dance,true);eq(paused,true);eq(reduced,true);eq(finite,true);
const danceFrames=[];parsed.walkAtRules('keyframes',rule=>{if(rule.params==='house-mascot-dance')rule.walkDecls('background-position',decl=>danceFrames.push(decl.value));});
eq(danceFrames,['0% 0%','33.333333% 0%','66.666667% 0%','100% 0%'],'Actual four-frame cycle, not a static bob');
const geometry=Object.fromEntries(parsed.nodes.find(rule=>rule.selector==='.house-mascot').nodes.filter(node=>node.type==='decl').map(node=>[node.prop,node.value]));
assert(Number.parseFloat(geometry.left) + Number.parseFloat(geometry.width) <= 12.5, 'Mascot stays to the left of the reels');checks++;eq(geometry.bottom,'22%');
const sha=name=>createHash('sha256').update(fs.readFileSync(new URL(name,root))).digest('hex');
console.log(JSON.stringify({passed:true,checks,rounds,steps,wins,losses,bonuses,ssrVerified:true,
  scope:'Credited presentation, real House rounds50/55/60, SSR and CSS; final raster geometry/browser appearance verified separately',
  sourceSHA256:Object.fromEntries(['HouseMascot.jsx','HouseMascot.css','house-mascot-presentation.js'].map(name=>[name,sha(name)]))}));
