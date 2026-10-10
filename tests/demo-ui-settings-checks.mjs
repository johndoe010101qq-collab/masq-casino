import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformWithOxc} from 'vite';
import {HallSession} from '../src/hall-session.js';
import GameMath from '../src/game-math.js';
import {DEMO_SETTINGS_GAMES} from '../src/demo-settings.js';
import {uiStakeLimits,uiBoundedStake,uiPlaybackSpeed,applyDemoAudio,applyDemoUiSettings} from '../src/demo-ui-settings.js';

let randomCalls=0;
const session=new HallSession(GameMath,max=>{randomCalls++;return max-1;});
const audioCalls=[],audio={setVolume:value=>audioCalls.push(['master',value]),setSfxVolume:value=>audioCalls.push(['sfx',value]),setMusicVolume:value=>audioCalls.push(['music',value])};
const draft=()=>{const s=session.getSnapshot();return structuredClone({rtpProfiles:s.rtpProfiles,classicRtpProfiles:s.classicRtpProfiles,stakeLimits:s.stakeLimits,presentation:s.presentation});};
const baseline=session.getSnapshot(),settings=draft();
for(const game of DEMO_SETTINGS_GAMES)settings.stakeLimits[game]={min:20,max:game==='slots'?80:120,step:5};
settings.presentation={speed:2,sfxVolume:50,musicVolume:25};
assert.equal(applyDemoUiSettings(session,settings,{expectedRevision:1},audio),true);
assert.equal(session.getSnapshot().profileRevision,2);
assert.deepEqual(audioCalls,[['master',.62],['sfx',.5],['music',.0675]]);
assert.equal(randomCalls,0,'Applying UI settings cannot draw results');
assert.equal(session.getSnapshot().balance,baseline.balance,'Applying controls cannot change money');
for(const game of DEMO_SETTINGS_GAMES){
  const limits=uiStakeLimits(session.getSnapshot(),game);
  assert.equal(uiBoundedStake(5,limits),20);
  assert.equal(uiBoundedStake(250,limits),limits.max);
  assert.equal(uiBoundedStake('not a number',limits),20);
  assert.equal(uiBoundedStake(45,limits),45);
}
assert.equal(uiStakeLimits({},'slots').max,100);
assert.equal(uiStakeLimits({},'dice').max,250);
for(const speed of [1,1.5,2])assert.equal(uiPlaybackSpeed({speed}),speed);
for(const speed of [undefined,0,3,Infinity,'2'])assert.equal(uiPlaybackSpeed({speed}),1);
assert.equal(applyDemoUiSettings(session,draft(),{expectedRevision:2},audio),false);
assert.equal(audioCalls.length,3,'Unchanged draft does not rewrite the mixer');
const changed=draft();changed.presentation.speed=1.5;
assert.throws(()=>applyDemoUiSettings(session,changed,{expectedRevision:1},audio));
const invalid=draft();invalid.stakeLimits.slots.max=105;
assert.throws(()=>applyDemoUiSettings(session,invalid,{expectedRevision:2},audio));
const accepted=session.begin('coinflip','heads',20),acceptedPresentation=accepted.presentation;
assert.throws(()=>applyDemoUiSettings(session,changed,{expectedRevision:2},audio));
assert.equal(audioCalls.length,3,'Invalid/stale/busy draft does not touch sound');
assert.equal(uiPlaybackSpeed(acceptedPresentation),2,'Accepted round keeps its presentation version');
assert.equal(session.complete(accepted.id),true);
assert.equal(session.complete(accepted.id),false);
assert.equal(applyDemoUiSettings(session,changed,{expectedRevision:2},audio),true);
assert.equal(uiPlaybackSpeed(acceptedPresentation),2,'Later settings cannot change accepted animation speed');
assert.equal(uiPlaybackSpeed(session.getSnapshot().presentation),1.5);
applyDemoAudio(audio,{sfxVolume:100,musicVolume:100});
assert.deepEqual(audioCalls.slice(-3),[['master',.62],['sfx',1],['music',.27]],'Default percentages preserve original levels');

async function loadControl(name){
  const url=new URL('../src/'+name,import.meta.url);
  let source=await fs.readFile(url,'utf8');
  source=source.replace(/import ['"]\.\/[^'"\n]+\.css['"];?\r?\n/g,'')
    .replace(/from ['"]react['"]/g,'from '+JSON.stringify(new URL('../node_modules/react/index.js',import.meta.url).href))
    .replace(/from ['"](\.\/[^'"]+\.js)['"]/g,(_,relative)=>'from '+JSON.stringify(new URL(relative,url).href));
  const result=await transformWithOxc(source,name,{jsx:{runtime:'classic'}});
  return (await import('data:text/javascript;base64,'+Buffer.from(result.code).toString('base64'))).default;
}
function nodes(tree){return [tree,...React.Children.toArray(tree?.props?.children).flatMap(child=>typeof child==='object'?nodes(child):[])];}
const SlotControls=await loadControl('SlotControls.jsx'),SlotDock=await loadControl('SlotDock.jsx');
let changedStake=null;
const bonanzaProps={stake:20,stakeLimits:{min:20,max:80,step:5},balance:10000,onStakeChange:value=>changedStake=value,onSpin:()=>{},onBuyBonus:()=>{}};
let tree=SlotControls(bonanzaProps),elements=nodes(tree);
assert.equal(elements.find(node=>node.props?.['aria-label']==='Уменьшить ставку на 5 АР').props.disabled,true);
elements.find(node=>node.props?.['aria-label']==='Увеличить ставку на 5 АР').props.onClick();
assert.equal(changedStake,25);
tree=SlotControls({...bonanzaProps,stake:80});elements=nodes(tree);
assert.equal(elements.find(node=>node.props?.['aria-label']==='Увеличить ставку на 5 АР').props.disabled,true);
elements.find(node=>node.props?.['aria-label']==='Уменьшить ставку на 5 АР').props.onClick();assert.equal(changedStake,75);
assert.match(renderToStaticMarkup(React.createElement(SlotControls,{...bonanzaProps,stake:15})),/slot-spin-button[^>]*disabled/,'Invalid configured stake cannot spin');

const dockProps={game:'lecipher',stake:30,stakeLimits:{min:30,max:120,step:5},balance:90,payout:0,locked:false,busy:false,ready:true,validStake:true,onStakeChange:value=>changedStake=value,onSpin:()=>{},onSkip:()=>{},onShop:()=>{}};
tree=SlotDock(dockProps);elements=nodes(tree);
const input=elements.find(node=>node.type==='input');
assert.equal(input.props.min,30);assert.equal(input.props.max,120);assert.equal(input.props.step,5);
assert.equal(elements.find(node=>node.props?.['aria-label']==='Уменьшить ставку на 5 АР').props.disabled,true);
elements.find(node=>node.props?.['aria-label']==='Увеличить ставку на 5 АР').props.onClick();assert.equal(changedStake,'35');
elements.find(node=>node.type==='button'&&node.props.children==='Макс.').props.onClick();assert.equal(changedStake,'90','Max obeys both balance and configured limit');
const rendered=renderToStaticMarkup(React.createElement(SlotDock,dockProps));
assert.match(rendered,/30–120 АР/);assert.match(rendered,/min="30" max="120"/);
assert.equal(nodes(SlotDock({...dockProps,stake:120})).find(node=>node.props?.['aria-label']==='Увеличить ставку на 5 АР').props.disabled,true);
for(const name of ['App.jsx','BonanzaSlot.jsx','MaskSlotRoom.jsx','PlinkoRoom.jsx','BlackjackRoom.jsx']){
  await transformWithOxc(await fs.readFile(new URL('../src/'+name,import.meta.url),'utf8'),name,{jsx:{runtime:'classic'}});
}
console.log('Demo UI settings passed: atomic/stale/busy application, mixer scaling, all9limits, pinned speed, rendered boundary/Max controls, JSX parse. Browser focus/layout checks remain separate.');
