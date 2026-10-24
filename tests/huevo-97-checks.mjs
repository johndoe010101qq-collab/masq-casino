import assert from 'node:assert/strict';
import {classicRules,classicProfileSnapshot,settleClassic} from '../src/classic-rtp-profiles.js';
import {slotProfileSnapshot} from '../src/slot-rtp-profiles.js';
import {HallSession} from '../src/hall-session.js';
import GameMath from '../src/game-math.js';
import {HUEVO_SLOT_PROFILES,HUEVO_CLASSIC_PROFILES} from '../src/huevo-edition.js';
import holdout from '../docs/huevo-blackjack-holdout.json' with {type:'json'};
const choices={coinflip:['heads','tails'],dice:[1,2,3,4,5,6],roulette:['red','black','green',...Array.from({length:37},(_,i)=>i)],upgrader:[1.5,2,4,8],plinko:['standard']};
let checks=0;
for(const [game,variants] of Object.entries(choices))for(const choice of variants){
 const rules=classicRules(game,choice,97);assert.equal(rules.expectedGrossReturn,.97);let total=0;
 for(let ticket=0;ticket<rules.sampleSize;ticket++){
  const r=settleClassic(game,choice,50,1000,ticket,97);total+=r.payoutCents;assert.ok(Number.isSafeInteger(r.payoutCents));
 }
 assert.ok(Math.abs(total/rules.sampleSize/5000-.97)<1e-12,game+' '+choice);checks++;
}
for(const game of ['slots','maskhouse','lecipher']){
 const profile=slotProfileSnapshot(game,97,{mode:'paid'});
 assert.ok(Math.abs(profile.calibrationPredictedReturn-.97)<1e-7);checks++;
 assert.throws(()=>slotProfileSnapshot(game,96));
}
const bj=classicProfileSnapshot('blackjack',97);
assert.equal(bj.playerUnfavorableTickets,0);assert.equal(bj.dealerBoostTickets,100);
assert.equal(holdout.hands,1000000);assert.ok(holdout.seed.includes('INDEPENDENT-HOLDOUT'));
assert.ok(holdout.return95CI_Percent[0]<=97&&holdout.return95CI_Percent[1]>=97);
const session=new HallSession(GameMath,()=>0,{rtpProfiles:HUEVO_SLOT_PROFILES,classicRtpProfiles:HUEVO_CLASSIC_PROFILES,fixedRtp:97});
assert.deepEqual(session.getSnapshot().rtpProfiles,HUEVO_SLOT_PROFILES);
assert.throws(()=>session.setRtpProfiles({slots:95,maskhouse:97,lecipher:97}));
assert.throws(()=>session.setClassicRtpProfiles({...HUEVO_CLASSIC_PROFILES,dice:95}));
const round=session.begin('dice',1,5);assert.equal(round.rtpProfile.targetReturnPercent,97);assert.equal(round.dieValue,1);session.complete(round.id);
console.log('PASS huEVO97: '+checks+' exhaustive ticket maps/calibrated slots, fixed session, independent blackjack holdout.');
