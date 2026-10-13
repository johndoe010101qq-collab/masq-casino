import assert from 'node:assert/strict';
import { createBlackjackHand } from '../src/blackjack.js';
import { BlackjackPresentation } from '../src/blackjack-presentation.js';
import { BLACKJACK_DEALER_PRESENTATION_TIMING } from '../src/blackjack-dealer-clips.js';
import { advanceBlackjackDealerMedia } from '../src/blackjack-dealer-media-clock.js';
import { BLACKJACK_DEALER_CLIPS, blackjackDealerHandAt } from '../src/blackjack-dealer-clips.js';
import { BLACKJACK_TABLE_SCENE, blackjackTableHand } from '../src/blackjack-table-projection.js';
import { blackjackTableCardPresentation } from '../src/blackjack-card-motion.js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const hand = createBlackjackHand({ shoe: [10,9,5,8,6].map(rank=>({rank,suit:'spades'})), dealerBoostTickets:0,playerUnfavorableTickets:0 });
let settlements=0;
const p=new BlackjackPresentation(hand,{timing:BLACKJACK_DEALER_PRESENTATION_TIMING,onResolved:()=>settlements++});
p.deal();
const first=p.motion.stepId;
assert.equal(advanceBlackjackDealerMedia(p,first+1,1000),false);
assert.equal(p.elapsed,0);
advanceBlackjackDealerMedia(p,first,750);
assert.equal(p.elapsed,750);
advanceBlackjackDealerMedia(p,first,200);
assert.equal(p.elapsed,750);
advanceBlackjackDealerMedia(p,first,Infinity);
assert.equal(p.elapsed,750);
advanceBlackjackDealerMedia(p,first,1e6,true);
assert.notEqual(p.motion.stepId,first);
assert.equal(p.elapsed,0);
assert.equal(p.snapshot().view.player.length,1);
assert.equal(p.snapshot().view.dealer.length,1);
assert.equal(advanceBlackjackDealerMedia(p,first,1e6,true),false);
for(let n=0;n<3;n++) advanceBlackjackDealerMedia(p,p.motion.stepId,1e6,true);
assert.equal(p.snapshot().canAct,true);
assert.deepEqual(p.snapshot().view.dealer[1],{hidden:true});
p.stand();
const flip=p.motion.stepId;
advanceBlackjackDealerMedia(p,flip,599);
assert.deepEqual(p.snapshot().view.dealer[1],{hidden:true});
const beforeDisclosure=p.snapshot();
advanceBlackjackDealerMedia(p,flip,600);
assert.equal(p.snapshot().view.revealed,true);
assert.equal(p.snapshot().view.result,null);
const atDisclosure=p.snapshot();
advanceBlackjackDealerMedia(p,flip,1499.999999,true);
assert.equal(p.elapsed,0);
assert.equal(settlements,0);
p.flushTransitions();
assert.equal(settlements,1);
advanceBlackjackDealerMedia(p,flip,1e6,true);
assert.equal(settlements,1);

let motionChecks=0;
const near=(a,b,tolerance=1e-7)=>{assert.ok(Math.abs(a-b)<=tolerance,`${a} versus ${b}`);motionChecks++;};
for(const side of ['player','dealer']) {
  const geometry=blackjackTableHand(side,2)[0];
  const release=BLACKJACK_DEALER_CLIPS[`deal_${side}`].marks.release.timeMs;
  const pose=(elapsedMs,hidden=false,reducedMotion=false)=>blackjackTableCardPresentation(geometry,{side,index:0,hidden,reducedMotion,motion:{kind:'deal',side,index:0,elapsedMs}});
  assert.equal(pose(299.999).visible,false);motionChecks++;
  assert.equal(pose(300).stage,'extracting');motionChecks++;
  assert.equal(pose(300).extracted,0);motionChecks++;
  const start=pose(300).geometry;
  const leadingWorld={x:(start.worldCorners[0].x+start.worldCorners[1].x)/2,
    y:start.worldCorners[0].y,z:(start.worldCorners[0].z+start.worldCorners[1].z)/2};
  const {projectBlackjackTablePoint}=await import('../src/blackjack-table-projection.js');
  const edge=projectBlackjackTablePoint(leadingWorld);
  near(edge.x,BLACKJACK_TABLE_SCENE.shoe.x);near(edge.y,BLACKJACK_TABLE_SCENE.shoe.y);
  assert.equal(pose(390).stage,'extracting');near(pose(390).extracted,.5);
  assert.equal(pose(480).stage,'carried');assert.equal(pose(480).extracted,1);motionChecks+=2;
  const tracked=blackjackDealerHandAt(`deal_${side}`,480,'L');
  near(pose(480).geometry.center.x,tracked.x);near(pose(480).geometry.center.y,tracked.y);
  for(const boundary of [300,480,release,release+(side==='player'?350:300)]) {
    const a=pose(boundary-1e-5).geometry,b=pose(boundary+1e-5).geometry;
    near(a.center.x,b.center.x,.001);near(a.center.y,b.center.y,.001);
  }
  for(let ms=0;ms<=1334;ms++) {
    const hidden=pose(ms,true),open=pose(ms,false);
    assert.equal(hidden.frontVisible,false);assert.ok(hidden.geometry.matrix3d.every(Number.isFinite));motionChecks+=2;
    if(ms<=release) {assert.equal(open.frontVisible,false);motionChecks++;}
  }
  assert.equal(pose(0,false,true).geometry,geometry);motionChecks++;
}

// Exercise the actual JSX, not just a numeric pose. No rank/suit getter may be
// touched while the public hole card is hidden, even if the clip clock is late.
const loader=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,
  server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try {
  const {FeltCard}=await loader.ssrLoadModule('/src/RasterBlackjack.jsx');
  const geometry=blackjackTableHand('dealer',2)[1];
  const poison={hidden:true,get rank(){throw Error('Hidden rank read');},get suit(){throw Error('Hidden suit read');}};
  const html=(card,motion,reducedMotion=false)=>renderToStaticMarkup(React.createElement(FeltCard,{card,geometry,side:'dealer',index:1,motion,reducedMotion}));
  for(const elapsedMs of [0,300,433.333,599,599.999,600,766.6667,1500]) {
    const markup=html(poison,{kind:'flip',elapsedMs});
    assert.ok(markup.includes('data-face-visible="false"'));
    assert.ok(!markup.includes('bj-felt-card-corner'));
    assert.ok(!markup.includes('♠')&&!markup.includes('♥')&&!markup.includes('♦')&&!markup.includes('♣'));
    motionChecks+=3;
  }
  const before=html(beforeDisclosure.view.dealer[1],beforeDisclosure.motion);
  assert.ok(before.includes('data-face-visible="false"'));assert.ok(!before.includes('bj-felt-card-corner'));motionChecks+=2;
  const released=html(atDisclosure.view.dealer[1],atDisclosure.motion);
  assert.ok(released.includes('data-face-visible="true"'));assert.ok(released.includes('bj-felt-card-corner'));assert.ok(released.includes('♠'));motionChecks+=3;
  const reduced=html(poison,{kind:'flip',elapsedMs:599},true);
  assert.ok(reduced.includes('data-face-visible="false"'));motionChecks++;
} finally {await loader.close();}
console.log(`Blackjack dealer media/card motion: ${motionChecks} checks; actual shoe extraction, continuous native-frame paths, public 600ms JSX disclosure, stale events and once-only settlement passed.`);
