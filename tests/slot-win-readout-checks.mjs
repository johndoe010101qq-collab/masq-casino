import assert from 'node:assert/strict';
import {slotWinReadout} from '../src/slot-win-readout.js';
import {maskSlotSteps} from '../src/mask-slot-presentation.js';
import {playProfiledMaskSlot} from '../src/profiled-mask-slots.js';
let checks=0;const eq=(a,b)=>{checks++;assert.deepEqual(a,b);};
for(const visual of [{phase:'win',wins:[{payoutCents:0,rawPayoutCents:10000}]},{phase:'win',wins:[{payoutCents:10000,creditedPayoutCents:0}]},{phase:'payline',activeLine:{payoutCents:10000,creditedPayoutCents:0}},{phase:'bonus-payment',bonusPaymentCents:5000,creditedBonusPaymentCents:0}]) {eq(slotWinReadout(visual).winning,false);eq(slotWinReadout(visual).symbols,[]);}
const grid=[[{kind:'hood'}],[{kind:'wild',value:2}],[{kind:'hood'}]];
const fixture={phase:'payline',shownPayoutCents:12000,grid,activeLine:{line:3,kind:'hood',cells:[{column:0,row:0},{column:1,row:0},{column:2,row:0}],payoutCents:6000}};
eq(slotWinReadout(fixture),{totalCents:12000,detail:'Линия 4 платит',detailCents:6000,symbols:[{kind:'hood',value:null},{kind:'wild',value:2},{kind:'hood',value:null}],winning:true});
eq(slotWinReadout({phase:'bonus-payment',shownPayoutCents:5000,bonusPaymentCents:5000}).symbols,[]);
eq(slotWinReadout({phase:'settled',totalPayoutCents:5000}).totalCents,5000);
let state=0x68232b7a,calls=0,rounds=0,steps=0;
const randomInt=max=>{state=(Math.imul(state,1664525)+1013904223)>>>0;calls++;return Math.floor(state/4294967296*max);};
for(const game of ['maskhouse','lecipher'])for(const mode of ['paid','buy'])for(let i=0;i<40;i++){
 const round=playProfiledMaskSlot({game,mode,bonusTier:game==='maskhouse'?'sticky':'luck',stakeCents:5000,rtpProfile:'rtp55',randomInt}),before=JSON.stringify(round),count=calls,timeline=maskSlotSteps(round);rounds++;
 for(const visual of [...timeline.steps,timeline.terminal]){const row=slotWinReadout(visual,game);steps++;eq(row.totalCents,Math.max(0,visual.shownPayoutCents??visual.totalPayoutCents??0));assert(row.detailCents<=row.totalCents);checks++;if(!row.winning)eq(row.symbols,[]);if(row.detail==='Бонусная выплата')eq(row.symbols,[]);}
 eq(slotWinReadout(timeline.terminal).totalCents,round.payoutCents);eq(JSON.stringify(round),before);eq(calls,count);
}
console.log(JSON.stringify({passed:true,checks,rounds,steps,scope:'Only credited full-round totals and actual cell/line/collection detail, no RNG or financial mutation.'}));
