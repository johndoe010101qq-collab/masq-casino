import assert from 'node:assert/strict';
import {HallSession} from '../src/hall-session.js';
import {MASK_SLOT_RULES,playMaskSlot} from '../src/mask-slots.js';
import {BONANZA_DEMO_RULES} from '../src/bonanza.js';
import {liabilityTerms,maximumSafeStake} from '../src/liability-terms.js';
import {createDemoReserve} from '../src/demo-reserve.js';
let checks=0;
const eq=(actual,expected)=>{checks++;assert.deepEqual(actual,expected);};
const ok=value=>{checks++;assert.ok(value);};
const raises=callback=>{checks++;assert.throws(callback);};
eq(MASK_SLOT_RULES.version,'indictus-mask-slots-original-v10-features');eq(MASK_SLOT_RULES.winCapMultiplier,40);eq(MASK_SLOT_RULES.winCapOffsetCents,100);
eq(BONANZA_DEMO_RULES.winCapMultiplier,100);
const profiles=[{game:'maskhouse'},{game:'maskhouse',mode:'buy',bonusTier:'sticky'},{game:'lecipher'},{game:'lecipher',mode:'buy',bonusTier:'luck'},{game:'lecipher',mode:'buy',bonusTier:'gold'}];
for(const selection of profiles)for(let stake=5;stake<=250;stake+=5) {
 const terms=liabilityTerms({...selection,stake}),gross=stake*100*40-100;
 eq(terms.maxPayoutCents,gross);eq(terms.maxHouseLossCents,Math.max(0,gross-terms.chargeCents));ok(Number.isSafeInteger(terms.maxPayoutCents));
 eq(maximumSafeStake(selection,terms.maxHouseLossCents,terms.chargeCents),stake);
 const book=createDemoReserve({capitalCents:terms.maxHouseLossCents}),request={...selection,stake,roundId:'exact-boundary'};
 ok(book.reserve(request));eq(book.snapshot().availableCents,0);
 const held=book.snapshot();raises(()=>book.settle(request.roundId,gross+1));eq(book.snapshot(),held);
 eq(book.settle(request.roundId,gross),true);eq(book.snapshot().bankCents,0);eq(book.snapshot().reservedCents,0);eq(book.settle(request.roundId,gross),false);
 if(terms.maxHouseLossCents){const insufficient=createDemoReserve({capitalCents:terms.maxHouseLossCents-1});eq(insufficient.reserve(request),null);}
}
for(const selection of profiles) {
 const base=liabilityTerms({...selection,stake:5});eq(maximumSafeStake(selection,base.maxHouseLossCents-1),0);eq(maximumSafeStake(selection,base.maxHouseLossCents),5);
 let draws=0;const s=new HallSession(undefined,()=>{draws++;return 0;},{initialBalanceCents:1000000,houseCapitalCents:base.maxHouseLossCents-1}),before=s.getSnapshot(),reserve=s.getReserveSnapshot();
 raises(()=>s.begin(selection.game,selection.game,5,{mode:selection.mode,bonusTier:selection.bonusTier}));eq(draws,0);eq(s.getSnapshot(),before);eq(s.getReserveSnapshot(),reserve);eq(s.active.size,0);eq(s.id,0);
}
for(const mode of ['paid','buy'])for(let stake=5;stake<=100;stake+=5){const terms=liabilityTerms({game:'slots',stake,mode});eq(terms.maxPayoutCents,stake*100*100-100);}
const expectedMaxima=[['maskhouse','paid',undefined,999900,974900],['maskhouse','buy','sticky',999900,499900],['lecipher','paid',undefined,999900,974900],['lecipher','buy','luck',999900,499900],['lecipher','buy','gold',999900,374900]];
for(const [game,mode,bonusTier,gross,net]of expectedMaxima){const terms=liabilityTerms({game,mode,bonusTier,stake:250});eq(terms.maxPayoutCents,gross);eq(terms.maxHouseLossCents,net);}
for(const game of ['maskhouse','lecipher']) {
 const book=createDemoReserve();for(const roundId of [1,2])ok(book.reserve({roundId,game,stake:250,mode:'buy',bonusTier:game==='maskhouse'?'sticky':'luck'}));
 eq(book.snapshot().availableCents,200);for(const roundId of [2,1])book.settle(roundId,999900);eq(book.snapshot().bankCents,200);eq(book.snapshot().reservedCents,0);
}
// Results are capped by the same formula and never rounded to an undisclosed40x.
let seed=781;const randomInt=maximum=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%maximum;};
for(const selection of profiles)for(const stake of [5,100,250])for(let sample=0;sample<20;sample++) {
 const result=playMaskSlot({...selection,stakeCents:stake*100,randomInt});eq(result.capCents,liabilityTerms({...selection,stake}).maxPayoutCents);ok(result.payoutCents<=result.capCents);eq(result.ledger.creditCents,result.payoutCents);
}

// Actual Hall minimum payments: no symbol wins are invented and the only credit
// is the explicit final receipt. All ordinary paid/free prices remain unchanged.
function zeroWinTickets(game,tier,stake,mode='buy') {
 const config=MASK_SLOT_RULES[game],kinds=['hood','suit','glove','laptop','usb','lock','key','radio','flag'];
 const queue=[];
 const field=(free,natural=false)=>{
  const weights=free?config.freeRegularWeights:config.baseRegularWeights;
  for(let column=0;column<config.columns;column++)for(let row=0;row<config.rows;row++) {
   const scale=game==='maskhouse'?(free?config.freeRegularWeightScaleByReel:config.baseRegularWeightScaleByReel)[column]:1;
   const regularTotal=weights.reduce((a,b)=>a+b,0)*scale;
   const scatterWeight=game==='lecipher'?(free?config.freeScatterWeight:config.baseScatterWeight):(!free&&config.scatterColumns.includes(column)?config.baseScatterWeight:0);
   const wild=game==='maskhouse'?(free?config.freeWildWeightsByReel:config.baseWildWeightsByReel)[column]:0;
   const token=game==='lecipher'?(free?config.freeTokenWeight:config.baseTokenWeight):0;
   const kind=(column+row*2)%9;
   const ticket=natural&&config.scatterColumns.includes(column)&&row===0?regularTotal:weights.slice(0,kind).reduce((a,b)=>a+b,0)*scale;
   queue.push([regularTotal+scatterWeight+wild+token,ticket]);
  }
 };
 if(game==='maskhouse'){
  if(mode==='paid')field(false,true);
  for(let index=0;index<9;index++)queue.push([100,0]);
  for(let index=0;index<9;index++)field(true);
 }else for(let index=0;index<config.bonusTiers[tier].initialFreeSpins;index++)field(true);
 let draws=0;return{randomInt:maximum=>{draws++;const [n,ticket]=queue.shift()||[];eq(maximum,n);ok(Number.isInteger(ticket)&&ticket>=0&&ticket<maximum);return ticket;},remaining:()=>queue.length,draws:()=>draws};
}
for(const [game,tier,multiplier]of [['maskhouse','sticky',20],['lecipher','luck',20],['lecipher','gold',25]])for(const stake of [5,100,250]) {
 const tickets=zeroWinTickets(game,tier,stake),s=new HallSession(undefined,tickets.randomInt,{initialBalanceCents:1000000}),opening=s.balanceCents;
 const round=s.begin(game,game,stake,{mode:'buy',bonusTier:tier}),minimum=Math.ceil(stake*100*multiplier*.10),nativeMinimum=Math.floor(stake*100*multiplier*MASK_SLOT_RULES.bonusMinimumReturnBasisPoints/10000);
 eq(tickets.remaining(),0);eq(round.chargeCents,stake*100*multiplier);eq(round.payoutCents,minimum);eq(round.bonusMinimumCents,minimum);eq(round.bonusPaymentCents,minimum);eq(round.legendary,false);
 eq(round.enginePayoutCents,nativeMinimum);eq(round.bonusPurchaseFloorPaymentCents,minimum-nativeMinimum);
 const frames=round.spins.flatMap(spin=>spin.frames),receipts=frames.filter(frame=>frame.phase==='bonus-payment');
 eq(receipts.length,2);eq(receipts.reduce((sum,frame)=>sum+frame.payoutCents,0),minimum);for(const receipt of receipts){eq(receipt.wins.length,1);eq(receipt.wins[0].kind,'bonus-payment');eq(receipt.wins[0].cells,[]);eq(receipt.wins[0].bonusPayment,true);}
 ok(frames.filter(frame=>frame.phase!=='bonus-payment').every(frame=>frame.payoutCents===0));
 eq(round.ledger.creditCents,minimum);eq(s.balanceCents,opening-round.chargeCents);const draws=tickets.draws();
 eq(s.complete(round.id),true);eq(s.balanceCents,opening-round.chargeCents+minimum);eq(s.getSnapshot().result.payout,minimum/100);
 eq(s.complete(round.id),false);eq(tickets.draws(),draws);eq(s.balanceCents,opening-round.chargeCents+minimum);eq(s.getReserveSnapshot().reservedCents,0);
}
// A natural House launch's real BONUS payout already exceeds the minimum;
// that paid launch counts once and creates no unnecessary supplemental receipt.
{
 const tickets=zeroWinTickets('maskhouse','sticky',5,'paid'),s=new HallSession(undefined,tickets.randomInt),opening=s.balanceCents;
 const round=s.begin('maskhouse','maskhouse',5);eq(tickets.remaining(),0);eq(round.chargeCents,500);eq(round.freeSpinsPlayed,9);
 eq(round.bonusMinimumCents,500);eq(round.bonusPaymentCents,0);eq(round.payoutCents,2500);
 eq(round.spins.flatMap(spin=>spin.frames).filter(frame=>frame.phase==='bonus-payment').length,0);
 eq(s.complete(round.id),true);eq(s.balanceCents,opening-500+2500);eq(s.complete(round.id),false);
}
console.log(JSON.stringify({passed:true,checks,maskCapFormula:'40*stakeCents-100',bonanzaCapUnchanged:100,profiles:profiles.length,stakes:50,preRngBoundaryGuards:true}));
