import assert from 'node:assert/strict';
import {
  BLACKJACK_DEALER_CLIPS, BLACKJACK_DEALER_PRESENTATION_TIMING,
  selectBlackjackDealerClip, blackjackDealerHandAt,
  blackjackDealerDealPose, blackjackDealerRevealPose,
} from '../src/blackjack-dealer-clips.js';
import { BlackjackPresentation } from '../src/blackjack-presentation.js';
import { createBlackjackHand, evaluateBlackjack } from '../src/blackjack.js';

let checks = 0;
const check = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const near = (actual, expected) => { assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} vs ${expected}`); checks++; };
const fixture = ranks => createBlackjackHand({ shoe: ranks.map(rank => ({rank, suit:'spades'})),
  dealerBoostTickets:0, playerUnfavorableTickets:0 });
const advanceTo = (presentation, ms) => {
  while (presentation.elapsed < ms) presentation.advance(Math.min(100, ms - presentation.elapsed));
};
const finishStep = presentation => {
  const id = presentation.motion.stepId;
  while (presentation.motion?.stepId === id) presentation.advance(100);
};

check(Object.keys(BLACKJACK_DEALER_CLIPS).sort(),
  ['big_win','deal_dealer','deal_player','idle','lose_laugh','player_bust','player_win','push','reveal']);
for (const [id, frames] of Object.entries({idle:300,deal_player:40,deal_dealer:40,reveal:45,
  lose_laugh:79,player_bust:79,player_win:73,big_win:109,push:55})) {
  const clip = BLACKJACK_DEALER_CLIPS[id];
  check(clip.src, `/blackjack-dealer-v35/${id}.mp4`);
  check(clip.frames, frames); check(clip.fps,30); near(clip.durationMs, frames/30*1000);
  check(clip.loop,id === 'idle'); check(Object.isFrozen(clip),true);
  for (const mark of Object.values(clip.marks)) {
    near(mark.timeMs,mark.frame/30*1000); check(Object.isFrozen(mark),true);
    check(mark.frame < frames,true); check(Object.isFrozen(mark.screenPx),true);
  }
}
check(BLACKJACK_DEALER_CLIPS.lose_laugh.marks.chuckle_peak.frame,23);
check(BLACKJACK_DEALER_CLIPS.deal_dealer.marks.release.frame,22);
check(Object.isFrozen(BLACKJACK_DEALER_CLIPS),true);
check(Object.isFrozen(BLACKJACK_DEALER_PRESENTATION_TIMING),true);

// Frame positions, interpolation and exact release anchors preserve the shoe.
check(blackjackDealerHandAt('deal_player',300),{x:1159,y:530});
check(blackjackDealerHandAt('deal_player',700),{x:1022,y:551});
check(blackjackDealerHandAt('deal_dealer',22/30*1000),{x:1025,y:544});
check(blackjackDealerHandAt('reveal',600,'R'),{x:848,y:508});
check(blackjackDealerHandAt('deal_player', 10.5/30*1000),{x:1152.5,y:533});
check(blackjackDealerHandAt('deal_player',-20),{x:1080,y:545});
check(blackjackDealerHandAt('deal_player',90000),{x:1080,y:545});
assert.throws(()=>blackjackDealerHandAt('idle',100)); checks++;
assert.throws(()=>blackjackDealerHandAt('deal_player',100,'both')); checks++;
assert.throws(()=>blackjackDealerDealPose('invalid',100)); checks++;
for (const side of ['player','dealer']) {
  const releaseMs = BLACKJACK_DEALER_CLIPS[`deal_${side}`].marks.release.timeMs;
  const before = blackjackDealerDealPose(side,299.999);
  check(before.stage,'waiting'); check(before.visible,false);
  const carried = blackjackDealerDealPose(side,300);
  check(carried.stage,'carried'); check(carried.visible,true); check(carried.origin,{x:1159,y:530});
  const released = blackjackDealerDealPose(side,releaseMs);
  check(released.stage,'flying'); check(released.flightProgress,0);
  check(released.origin,{x:side === 'player' ? 1022 : 1025,y:side === 'player' ? 551 : 544});
  const midway = blackjackDealerDealPose(side,(releaseMs+released.landMs)/2);
  near(midway.flightProgress,.5); check(midway.origin,released.origin);
  const landed = blackjackDealerDealPose(side,released.landMs);
  check(landed.stage,'landed'); check(landed.flightProgress,1);
  check(landed.landMs < BLACKJACK_DEALER_CLIPS[`deal_${side}`].durationMs,true);
  check(Object.isFrozen(landed) && Object.isFrozen(landed.origin),true);
}
for (const ms of [0,100,400,433.333]) check(blackjackDealerRevealPose(ms).faceProgress,0);
near(blackjackDealerRevealPose(600).faceProgress,.5);
near(blackjackDealerRevealPose(23/30*1000).faceProgress,1);
check(blackjackDealerRevealPose(599.999).faceProgress < .5,true);
check(blackjackDealerRevealPose(600.001).faceProgress > .5,true);
check(blackjackDealerRevealPose(Infinity).faceProgress,0);

// No result reaction before public resolution, including an engine natural.
const outcomes = {blackjack:'big_win',win:'player_win',lose:'lose_laugh',push:'push'};
for (const [outcome,clip] of Object.entries(outcomes)) {
  const view={revealed:true,result:{outcome},playerTotal:20};
  check(selectBlackjackDealerClip({view,status:'resolved'}),clip);
  check(selectBlackjackDealerClip({view,status:'resolving'}),'idle');
  check(selectBlackjackDealerClip({view,status:'resolved',settled:false}),'idle');
  check(selectBlackjackDealerClip({view:{...view,revealed:false},status:'resolved'}),'idle');
  check(selectBlackjackDealerClip({view:{...view,result:null},status:'resolved'}),'idle');
}
check(selectBlackjackDealerClip({view:{revealed:true,result:{outcome:'lose'},playerTotal:21},status:'resolved'}),'lose_laugh');
check(selectBlackjackDealerClip({view:{revealed:true,result:{outcome:'lose'},playerTotal:22},status:'resolved'}),'player_bust');
check(selectBlackjackDealerClip({motion:{kind:'deal',side:'player'}}),'deal_player');
check(selectBlackjackDealerClip({motion:{kind:'deal',side:'dealer'}}),'deal_dealer');
check(selectBlackjackDealerClip({motion:{kind:'deal',side:'invalid'}}),'idle');
check(selectBlackjackDealerClip({motion:{kind:'flip'}}),'reveal');
check(selectBlackjackDealerClip(), 'idle');

const updates=[];
let settlements=0;
const timed = new BlackjackPresentation(fixture([10,10,8,7]), {
  timing:BLACKJACK_DEALER_PRESENTATION_TIMING,
  onUpdate:snapshot=>updates.push(snapshot),onResolved:()=>settlements++,
});
timed.deal();
check(timed.motion.durationMs,40/30*1000); check(timed.motion.stepId,1);
advanceTo(timed,300); check(timed.motion.elapsedMs,300);
near(timed.motion.progress,300/(40/30*1000));
const frozen = timed.snapshot(); timed.advance(100,{hidden:true}); check(timed.snapshot(),frozen);
while (timed.snapshot().status === 'dealing') timed.advance(100);
check(timed.snapshot().status,'player'); check(timed.snapshot().canAct,true);
check(timed.snapshot().view.dealer[1],{hidden:true});
check(timed.stand(),true); check(timed.motion.kind,'flip'); check(timed.motion.durationMs,1500);
advanceTo(timed,599); check(timed.snapshot().view.revealed,false);
check(timed.snapshot().view.dealer[1],{hidden:true}); check(timed.snapshot().view.result,null);
timed.advance(1); check(timed.snapshot().view.revealed,true);
check(timed.snapshot().view.dealer[1].rank,7); check(timed.snapshot().view.result,null);
check(selectBlackjackDealerClip(timed.snapshot()),'reveal');
timed.flushTransitions(); check(settlements,1);
check(selectBlackjackDealerClip(timed.snapshot()),'player_win');
check(timed.snapshot().view.result.outcome,'win');
check(updates.filter(update=>update.status !== 'resolved').every(update=>update.view.result === null),true);
const stepIds=[...new Set(updates.filter(update=>update.motion).map(update=>update.motion.stepId))];
check(stepIds, [1,2,3,4,5,6]);
check(updates.filter(update=>update.motion).every(update=>Object.isFrozen(update.motion)),true);

// Consecutive dealer gestures must restart the clip through distinct step IDs.
const draws=new BlackjackPresentation(fixture([10,5,8,5,2,2,5]),{timing:BLACKJACK_DEALER_PRESENTATION_TIMING});
draws.deal();draws.flushTransitions();draws.stand();finishStep(draws);
const drawIds=[];
while (draws.motion?.kind === 'deal') {
  drawIds.push(draws.motion.stepId); check(draws.motion.durationMs,40/30*1000);finishStep(draws);
}
check(drawIds.length,3); check(new Set(drawIds).size,3);draws.flushTransitions();
check(evaluateBlackjack(draws.hand).outcome,'lose');

// Optional timing preserves default disclosure and once-only reduced settlement.
const legacy=new BlackjackPresentation(fixture([10,10,8,7]));
legacy.deal();check(legacy.motion.durationMs,400);legacy.flushTransitions();legacy.stand();
advanceTo(legacy,379);check(legacy.snapshot().view.revealed,false);
legacy.advance(1);check(legacy.snapshot().view.revealed,true);
let reducedSettlements=0;
const reduced=new BlackjackPresentation(fixture([1,10,10,7]),{
  timing:BLACKJACK_DEALER_PRESENTATION_TIMING,onResolved:()=>reducedSettlements++,
});
reduced.deal();reduced.flushTransitions();reduced.flushTransitions();
check(reducedSettlements,1);check(reduced.snapshot().view.result.outcome,'blackjack');
check(selectBlackjackDealerClip(reduced.snapshot()),'big_win');
for (const timing of [{dealPlayerMs:0},{dealDealerMs:NaN},{revealMs:-1},{revealAtMs:1000,revealMs:500}]) {
  assert.throws(()=>new BlackjackPresentation(fixture([10,10,8,7]),{timing})); checks++;
}

console.log(`Blackjack dealer clips: ${checks} checks passed (frame marks, public reactions, hand tracks, release, reveal, step tokens, legacy timing).`);
