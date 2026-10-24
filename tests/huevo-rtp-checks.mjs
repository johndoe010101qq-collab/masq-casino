import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classicRules,classicProfileSnapshot,settleClassic} from '../src/classic-rtp-profiles.js';
import {slotProfileSnapshot} from '../src/slot-rtp-profiles.js';
import {HallSession} from '../src/hall-session.js';
import GameMath from '../src/game-math.js';
import {HUEVO_SLOT_PROFILES,HUEVO_CLASSIC_PROFILES} from '../src/huevo-edition.js';
import {HUEVO_RTP} from '../src/runtime-rtp-range.js';
import {HUEVO_ECONOMICS,quoteHuevoDeposit} from '../server/huevo-economics.mjs';
assert.equal(HUEVO_RTP,92);assert.equal(HUEVO_ECONOMICS.targetRtpBps,9200);assert.equal(HUEVO_ECONOMICS.depositFeeBps,500);
assert.equal(quoteHuevoDeposit(10000).creditUnits,9500);
assert.deepEqual(Object.values(HUEVO_SLOT_PROFILES),[92,92,92]);assert.deepEqual(Object.values(HUEVO_CLASSIC_PROFILES),[92,92,92,92,92,92]);
const choices={coinflip:['heads','tails'],dice:[1,2,3,4,5,6],roulette:['red','black','green',...Array.from({length:37},(_,i)=>i)],upgrader:[1.5,2,4,8],plinko:['standard']};
let checks=0;
for(const [game,variants] of Object.entries(choices))for(const choice of variants){
 const rules=classicRules(game,choice,92);assert.equal(rules.expectedGrossReturn,.92);let total=0;
 for(let ticket=0;ticket<rules.sampleSize;ticket++){const r=settleClassic(game,choice,50,1000,ticket,92);total+=r.payoutCents;assert.ok(Number.isSafeInteger(r.payoutCents));}
 assert.ok(Math.abs(total/rules.sampleSize/5000-.92)<1e-12,game+' '+choice);checks++;
}
const offers=[{game:'slots',mode:'paid'},{game:'slots',mode:'buy'},{game:'maskhouse',mode:'paid'},{game:'maskhouse',mode:'buy',bonusTier:'sticky'},{game:'lecipher',mode:'paid'},{game:'lecipher',mode:'buy',bonusTier:'luck'},{game:'lecipher',mode:'buy',bonusTier:'gold'},{game:'lecipher',mode:'paid',featureMode:'hunt'},{game:'lecipher',mode:'paid',featureMode:'rainbow'}];
for(const offer of offers){const p=slotProfileSnapshot(offer.game,92,offer);assert.ok(Math.abs(p.calibrationPredictedReturn-.92)<1e-7);assert.equal(p.targetReturnPercent,92);assert.ok(p.acceptance.profitableTicketWeight>0&&p.acceptance.otherTicketWeight>0);checks++;}
const blackjack=classicProfileSnapshot('blackjack',92);assert.equal(blackjack.dealerBoostTickets,607);assert.equal(blackjack.playerUnfavorableTickets,284);
const holdout=JSON.parse(readFileSync(new URL('../docs/huevo-blackjack-92-holdout.json',import.meta.url),'utf8'));
assert.equal(holdout.hands,1000000);assert.equal(holdout.dealerBoostTickets,607);assert.equal(holdout.playerUnfavorableTickets,284);assert.ok(holdout.seed.includes('INDEPENDENT-HOLDOUT'));
assert.ok(Math.abs(holdout.returnPercent-92)<.6,'Independent actual-engine check must remain near the declared approximate target');
const slots=JSON.parse(readFileSync(new URL('../docs/huevo-slot-92-holdout.json',import.meta.url),'utf8'));
assert.equal(slots.targetReturnPercent,92);assert.equal(slots.status,'complete');assert.equal(slots.rows.length,9);assert.ok(slots.rows.every(r=>r.profile===92&&r.samples>=20000&&r.seed.includes('INDEPENDENT-HOLDOUT')));
const session=new HallSession(GameMath,()=>0,{rtpProfiles:HUEVO_SLOT_PROFILES,classicRtpProfiles:HUEVO_CLASSIC_PROFILES,fixedRtp:92});
assert.deepEqual(session.getSnapshot().rtpProfiles,HUEVO_SLOT_PROFILES);assert.throws(()=>session.setRtpProfiles({slots:97,maskhouse:92,lecipher:92}));assert.throws(()=>session.setClassicRtpProfiles({...HUEVO_CLASSIC_PROFILES,dice:97}));
assert.throws(()=>new HallSession(GameMath,()=>0,{rtpProfiles:HUEVO_SLOT_PROFILES,classicRtpProfiles:HUEVO_CLASSIC_PROFILES,fixedRtp:97}));
const round=session.begin('dice',1,5);assert.equal(round.rtpProfile.targetReturnPercent,92);assert.equal(round.dieValue,1);session.complete(round.id);
console.log('PASS huEVO92: '+checks+' exhaustive ticket maps and calibrated offers, nine independent slot holdouts, one million blackjack hands, fixed client/server policy and unchanged 5% deposit fee.');
