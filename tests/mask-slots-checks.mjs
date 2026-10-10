import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const local=new URL('./mask-slots.js',import.meta.url),candidate=existsSync(local),url=candidate?local:new URL('../src/mask-slots.js',import.meta.url),source=await readFile(url,'utf8'),sha=body=>createHash('sha256').update(body).digest('hex'),sourceSHA256=sha(source);
const e=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')),r=e.MASK_SLOT_RULES;
let checks=0;const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;},ok=(truth,label)=>{assert(truth,label);checks++;};
function rng(seed){let x=seed>>>0;return maximum=>{const limit=Math.floor(4294967296/maximum)*maximum;let value;do{x^=x<<13;x^=x>>>17;x^=x<<5;value=x>>>0;}while(value>=limit);return value%maximum;};}
function noClusters(){return Array.from({length:6},(_,c)=>Array.from({length:5},(_,row)=>r.lecipher.baseRegularWeights[(c+row)%9]&&e.MASK_REGULAR_KINDS[(c+row)%9]));}
eq(r.version,'indictus-mask-slots-original-v10-features');eq(r.winCapOffsetCents,100);eq(r.bonusMinimumReturnBasisPoints,500);
eq(r.maskhouse.baseWildWeightsByReel,[0,1,40,1,0]);eq(r.maskhouse.freeWildWeightsByReel,[0,1,40,1,0]);
eq(r.maskhouse.baseRegularWeightScaleByReel,[1,100,1,100,1]);eq(r.maskhouse.bonusAwardWeights,[[1,72],[2,26],[3,2]]);
eq(r.lecipher.cloverMultiplierWeights,[[2,320],[3,240],[4,2],[5,2],[10,1]]);eq(r.lecipher.maximumVisibleActivationTokens,1);
eq(r.maskhouse.ordinaryRoundCapMultiplier,25);eq(r.lecipher.ordinaryRoundCapMultiplier,30);
eq(r.maskhouse.ordinaryFreeSpinCapPercent,260);eq(r.lecipher.ordinaryFreeSpinCapPercentByTier,{luck:350,gold:300,treasure:300});
// Independent integer line oracle: twenty equal hood lines, real wild values
// are added, and no-wild tables remain separate even when wild scale changes.
const hoodGrid=()=>Array.from({length:5},()=>Array.from({length:3},()=>({kind:'hood'})));
for(const stakeCents of[500,5000,25000])for(const wildcard of[[],[2],[3],[2,3],[3,2,3]]){
 const grid=hoodGrid();wildcard.forEach((value,index)=>grid[index+1]=Array.from({length:3},()=>({kind:'wild',value})));
 const wins=e.evaluateMaskHouseLines(grid,stakeCents,20000,500),multiplier=wildcard.length?wildcard.reduce((a,b)=>a+b):1,scale=wildcard.length?20000:500;
 eq(wins.length,20);for(const win of wins){eq(win.multiplier,multiplier);eq(win.payoutCents,Number(BigInt(stakeCents)*1958n*BigInt(multiplier)*BigInt(scale)/1000000n));}
}
// Exact visible House predicate: regular five-matches, two wilds, or a rare
// triple with different endpoints do not activate the exceptional award.
const house=Array.from({length:5},()=>Array.from({length:3},()=>({kind:'flag'})));house[0][1]={kind:'hood'};house[4][1]={kind:'hood'};for(let c=1;c<4;c++)house[c][1]={kind:'wild',value:c%2?2:3};
eq(e.findMaskHouseLegendaryLine(house),{line:0,cells:[0,1,2,3,4].map(column=>({column,row:1}))});
for(const c of[0,1,2,3,4]){const clone=house.map(col=>col.map(cell=>({...cell})));clone[c][1]={kind:'flag'};eq(e.findMaskHouseLegendaryLine(clone),null);}
for(const stakeCents of[500,5000,25000]){
 const spin=e.playMaskSpin({game:'maskhouse',stakeCents,randomInt:rng(13),initialGrid:house});eq(spin.payoutCents,stakeCents*40-100);ok(spin.legendary);ok(spin.frames[0].wins.some(win=>win.legendary&&win.cells.length===5));
 const normal=e.playMaskSpin({game:'maskhouse',stakeCents,freeSpin:true,randomInt:rng(13),initialGrid:hoodGrid()});eq(normal.legendary,false);ok(normal.payoutCents<=stakeCents*2.6);
}
// The four-x10 square has to be fresh and geometrically complete. Retained
// pots and arbitrary groups of high boosters cannot satisfy this predicate.
const square=[{column:0,row:0},{column:1,row:0},{column:0,row:1},{column:1,row:1}].map(spot=>({...spot,type:'clover',value:10,fresh:true}));
eq(e.findLeCipherLegendarySquare(square),square.map(({column,row})=>({column,row})));
for(const index of[0,1,2,3])for(const change of[{fresh:false},{type:'pot'},{value:5}]){const mutated=square.map(cell=>({...cell}));Object.assign(mutated[index],change);eq(e.findLeCipherLegendarySquare(mutated),null);}
eq(e.findLeCipherLegendarySquare(square.map((cell,index)=>({...cell,row:index}))),null);
for(const stakeCents of[500,5000,25000]){
 const grid=noClusters();grid[5][4]='bomb';let calls=0;const randomInt=maximum=>{const n=calls++;eq(maximum,n%2===0?100:565,'Actual independent type then multiplier draws.');return n%2===0?90:564;};
 const spin=e.playMaskSpin({game:'lecipher',stakeCents,randomInt,initialGrid:grid,goldenCells:square,freeSpin:true,bonusTier:'gold'});
 eq(calls,8);ok(spin.legendary);eq(spin.payoutCents,stakeCents*40-100);const f=spin.frames.at(-1);eq(f.legendaryCells.length,4);eq(f.wins.length,1);ok(f.wins[0].legendary);eq(f.wins[0].payoutCents,spin.payoutCents);
}
// A retained token on the last column must remove token tickets from ALL
// refill cells, even those encountered before that last column.
const tokenGrid=noClusters();for(let row=0;row<5;row++)tokenGrid[0][row]='hood';tokenGrid[5][4]='bomb';let ticketTotals=[];
e.playMaskSpin({game:'lecipher',stakeCents:5000,initialGrid:tokenGrid,randomInt:maximum=>{ticketTotals.push(maximum);return maximum-1;}});
ok(ticketTotals.length>=5);eq(ticketTotals.slice(0,5),Array(5).fill(142),'With retained token: regular total140 + scatter2, never token2.');
let invalidCalls=0;const invalid=noClusters();invalid[0][0]='bomb';invalid[5][4]='bomb';assert.throws(()=>e.playMaskSpin({game:'lecipher',stakeCents:5000,initialGrid:invalid,randomInt:()=>{invalidCalls++;return 0;}}),error=>error.code==='GRID');eq(invalidCalls,0);
// The floor is a monetary frame only: turn it off in a paired pure engine and
// verify identical RNG use, symbols and ordinary frames before the supplement.
const noFloor=await import('data:text/javascript;base64,'+Buffer.from(source.replace('bonusMinimumReturnBasisPoints:500','bonusMinimumReturnBasisPoints:0')).toString('base64'));
for(const [game,tier]of[['maskhouse','sticky'],['lecipher','luck'],['lecipher','gold']]){
 let floorCase=null;
 for(let seed=1;seed<=1000;seed++){let callsA=0,callsB=0,randA=rng(seed),randB=rng(seed);const a=e.playMaskSlot({game,mode:'buy',bonusTier:tier,stakeCents:5000,randomInt:max=>{callsA++;return randA(max);}}),b=noFloor.playMaskSlot({game,mode:'buy',bonusTier:tier,stakeCents:5000,randomInt:max=>{callsB++;return randB(max);}});eq(callsA,callsB);eq(a.bonusMinimumCents,game==='lecipher'&&tier==='gold'?6250:5000);ok(a.payoutCents>=a.bonusMinimumCents);
  if(a.bonusPaymentCents){floorCase={a,b};break;}
 }
 ok(floorCase,'A naturally sampled low bonus has a real minimum payment.');const {a,b}=floorCase,payment=a.spins.at(-1).frames.at(-1);eq(payment.phase,'bonus-payment');eq(payment.wins[0].cells,[]);eq(payment.before,payment.after);eq(payment.payoutCents,a.bonusMinimumCents-b.payoutCents);eq(a.payoutCents-b.payoutCents,a.bonusPaymentCents);
 const strip=round=>round.spins.map(spin=>({initial:spin.initial,frames:spin.frames.filter(frame=>frame.phase!=='bonus-payment'),terminal:spin.terminal,awardedSpins:spin.awardedSpins}));eq(strip(a),strip(b),'Floor consumes no random ticket and changes no symbol/ordinary award.');
}
// Holdout fixtures verify exact frame/spin/ledger accounting; no cap is faked,
// no activation token is deleted visually, and no round is silently retried.
const samples=[];
for(const [game,mode,tier]of[['maskhouse','paid','sticky'],['maskhouse','buy','sticky'],['lecipher','paid','luck'],['lecipher','buy','luck'],['lecipher','buy','gold']]){
 const randomInt=rng(984653+samples.length);let floors=0,ordinaryCaps=0;
 for(let i=0;i<10000;i++){
  const round=e.playMaskSlot({game,mode,bonusTier:tier,stakeCents:5000,randomInt});eq(round.capCents,199900);eq(round.ordinaryCapCents,game==='maskhouse'?125000:150000);ok(round.payoutCents<=round.capCents);eq(round.capReached,round.payoutCents===round.capCents);eq(round.payoutCents,round.spins.reduce((sum,spin)=>sum+spin.payoutCents,0));eq(round.ledger.creditCents,round.payoutCents);eq(round.ledger.chargeCents,round.chargeCents);if(!round.legendary)ok(round.payoutCents<=round.ordinaryCapCents);
  floors+=+(round.bonusPaymentCents>0);ordinaryCaps+=+round.ordinaryCapReached;
  for(const spin of round.spins){eq(spin.payoutCents,spin.frames.reduce((sum,frame)=>sum+frame.payoutCents,0));if(spin.freeSpin&&!spin.legendary){const capPercent=r[game].ordinaryFreeSpinCapPercentByTier?.[spin.bonusTier]??r[game].ordinaryFreeSpinCapPercent;ok(spin.payoutCents-round.bonusPaymentCents<=Math.floor(round.stakeCents*capPercent/100));}
   for(const frame of spin.frames){eq(frame.payoutCents,frame.wins.reduce((sum,win)=>sum+win.payoutCents,0));for(const grid of[frame.before,frame.after])if(game==='lecipher')ok(grid.flat().filter(cell=>cell.activation&&cell.token).length<=1);}
  }
 }
 samples.push({game,mode,tier,count:10000,floors,ordinaryCaps});
}
let sharedMechanicsChecks=0;
(()=>{const {playMaskSlot,playMaskSpin,MASK_SLOT_RULES:rules,MASK_REGULAR_KINDS:kinds}=e;
let checks=0;const eq=(a,b)=>{checks++;assert.equal(a,b);},ok=x=>{checks++;assert.ok(x);},deep=(a,b)=>{checks++;assert.deepEqual(a,b);},raises=(fn,code)=>{checks++;assert.throws(fn,e=>e.code===code);};
const grid=(cols,rows)=>Array.from({length:cols},(_,c)=>Array.from({length:rows},(_,r)=>kinds[(c+r)%8+1]));
function cycle(){let n=0;return maximum=>(n++*73)%maximum;}
function scripted(tickets){let i=0;return max=>{const ticket=tickets[i++]??0;assert(ticket<max);return ticket;};}
eq(rules.version,'indictus-mask-slots-original-v10-features');eq(rules.winCapMultiplier,40);
eq(rules.maskhouse.bonusBuyMultiplier,20);eq(rules.lecipher.bonusBuys[0].multiplier,20);eq(rules.lecipher.bonusBuys[1].multiplier,25);
eq(rules.maskhouse.baseScatterWeight,60);
deep(rules.maskhouse.freePays,rules.maskhouse.boughtFreePays);eq(rules.maskhouse.freePayScaleBasisPoints,rules.maskhouse.boughtFreePayScaleBasisPoints);
for(const tier of ['luck','gold']){
 deep(rules.lecipher.freePaysByTier[tier],rules.lecipher.boughtFreePaysByTier[tier]);
 deep(rules.lecipher.freeCoinPercentWeightsByTier[tier],rules.lecipher.boughtFreeCoinPercentWeightsByTier[tier]);
 eq(rules.lecipher.freePayScaleBasisPointsByTier[tier],rules.lecipher.bonusBuys.find(b=>b.id===tier).payScaleBasisPoints);
}
eq(rules.lecipher.freeCoinPercentWeightsByTier.treasure.length,4);
// Matching active state, stake, cap and RNG gives precisely the same bonus
// reveal and payouts regardless of natural or purchased entry.
for(const [game,tier]of [['maskhouse','sticky'],['lecipher','luck'],['lecipher','gold']])for(let seed=0;seed<150;seed++){
 const initial=grid(game==='maskhouse'?5:6,game==='maskhouse'?3:5);
 if(game==='lecipher'){
  initial[5][4]='bomb';
  if(tier==='luck'&&seed%10===0)for(let c=0;c<4;c++)initial[c][0]='scatter';
 }
 else{initial[0][0]='hood';initial[1][0]={kind:'wild',value:3};initial[2][0]={kind:'wild',value:2};initial[3][0]='hood';initial[4][0]='hood';}
 const options={game,bonusTier:tier,stakeCents:(1+seed%50)*500,freeSpin:true,initialGrid:initial,...(game==='lecipher'?{goldenCells:[{column:2,row:2},{column:3,row:2},{column:2,row:3}]}:{})};
 const seeded=()=>{let n=seed;return maximum=>(n++*73)%maximum;};
 const natural=playMaskSpin({...options,mode:'paid',randomInt:seeded()}),bought=playMaskSpin({...options,mode:'buy',randomInt:seeded()});
 const strip=({mode,...same})=>same;deep(strip(natural),strip(bought));
}

// Nine independent, disclosed weighted 1/2/3 tiles determine the House bonus.
for(const [ticket,value] of [[0,1],[72,2],[98,3]]){
 let first=0,n=0;const randomInt=max=>{if(first++<9){eq(max,100);return ticket;}return(n++*73)%max;};
 const round=playMaskSlot({game:'maskhouse',mode:'buy',stakeCents:500,randomInt});
 deep(round.bonusSelection,Array(9).fill(value));eq(round.initialFreeSpins,9*(value));eq(round.freeSpinsAwarded,round.initialFreeSpins);
 eq(round.freeSpinsPlayed+round.unplayedFreeSpins,round.initialFreeSpins);eq(round.chargeCents,10000);ok(round.spins.every(spin=>spin.freeSpin&&spin.awardedSpins===0));
 ok(round.spins.every(spin=>!spin.initial.flat().some(cell=>cell.kind==='scatter')));
}
{
 const initial=grid(5,3);initial[0][0]='scatter';initial[2][1]='scatter';initial[4][2]='scatter';
 const spin=playMaskSpin({game:'maskhouse',stakeCents:500,initialGrid:initial,randomInt:()=>72});
 eq(spin.awardedSpins,18);deep(spin.bonusSelection,Array(9).fill(2));eq(spin.awardedTier,'sticky');
 const trigger=spin.frames[0].wins.find(win=>win.trigger);eq(trigger.payoutCents,2500);eq(trigger.kind,'scatter');eq(trigger.cells.length,3);
 const illegal=grid(5,3);illegal[1][0]='scatter';raises(()=>playMaskSpin({game:'maskhouse',stakeCents:500,initialGrid:illegal,randomInt:()=>0}),'GRID');
 raises(()=>playMaskSpin({game:'maskhouse',stakeCents:500,freeSpin:true,initialGrid:initial,randomInt:()=>0}),'GRID');
}
{
 const initial=grid(5,3);initial[0][0]='scatter';initial[0][1]='scatter';initial[0][2]='scatter';
 const spin=playMaskSpin({game:'maskhouse',stakeCents:500,initialGrid:initial,randomInt:()=>0});
 eq(spin.awardedSpins,0);eq(spin.bonusSelection.length,0);
 initial[1][0]={kind:'wild',value:3};initial[1][1]={kind:'wild',value:2};
 const paid=playMaskSpin({game:'maskhouse',stakeCents:500,initialGrid:initial,randomInt:()=>0});
 eq(paid.initial[1][0].value,3);eq(paid.initial[1][1].value,3);
 const clean=grid(5,3);clean[1][0]={kind:'wild',value:3};clean[1][1]={kind:'wild',value:2};
 const free=playMaskSpin({game:'maskhouse',stakeCents:500,freeSpin:true,initialGrid:clean,randomInt:()=>0});
 eq(free.initial[1][0].value,3);eq(free.initial[1][1].value,2);
}

// Distinct natural tiers and retriggers; upgrading Luck immediately preserves gold.
for(const [count,tier,award]of [[3,'luck',8],[4,'gold',12],[5,'treasure',12]]){
 const initial=grid(6,5);for(let i=0;i<count;i++)initial[i][0]='scatter';
 const spin=playMaskSpin({game:'lecipher',stakeCents:500,initialGrid:initial,randomInt:cycle()});eq(spin.awardedTier,tier);eq(spin.awardedSpins,award);
}
for(const count of [2,3]){
 const initial=grid(6,5);for(let i=0;i<count;i++)initial[i][0]='scatter';
 const spin=playMaskSpin({game:'lecipher',stakeCents:500,freeSpin:true,bonusTier:'gold',initialGrid:initial,randomInt:()=>0});eq(spin.awardedSpins,count===2?2:4);eq(spin.awardedTier,null);
}
{
 const initial=grid(6,5);for(let i=0;i<4;i++)initial[i][0]='scatter';initial[5][4]='bomb';
 const spin=playMaskSpin({game:'lecipher',stakeCents:500,freeSpin:true,bonusTier:'luck',initialGrid:initial,goldenCells:[{column:2,row:2}],randomInt:()=>0});
 eq(spin.awardedTier,'gold');eq(spin.awardedSpins,4);deep(spin.goldenCells,[{column:2,row:2}]);
}
for(const tier of ['luck','gold','treasure']){
 const initial=grid(6,5);if(tier!=='treasure')initial[5][4]='bomb';
 const spin=playMaskSpin({game:'lecipher',stakeCents:500,freeSpin:true,bonusTier:tier,initialGrid:initial,goldenCells:[{column:2,row:2}],randomInt:()=>0});
 if(tier==='treasure'){ok(spin.guaranteedToken);ok(spin.initial.flat().some(cell=>cell.token));}
 eq(spin.goldenCells.length,tier==='luck'?0:1);ok(spin.frames.some(frame=>frame.phase==='collect'));
}

// One coin + two pots: A stores the coin, B stores coin + A. A pot triggers
// another full reveal, whose three coins are also paid. No repeated debit.
{
 const initial=grid(6,5);initial[5][4]='bomb';const gold=[{column:0,row:0},{column:1,row:0},{column:2,row:0}];
 const randomInt=scripted([0,0,97,97,0,0,0,0,0,0]);
 const spin=playMaskSpin({game:'lecipher',stakeCents:500,freeSpin:true,bonusTier:'gold',initialGrid:initial,goldenCells:gold,randomInt});
 const collect=spin.frames.filter(frame=>frame.phase==='collect'),coin=Math.floor(500*14*rules.lecipher.freePayScaleBasisPointsByTier.gold/1000000);
 eq(collect.length,2);eq(collect[0].payoutCents,0);eq(collect[1].payoutCents,coin*12);eq(spin.payoutCents,coin*12);
 deep(collect[0].pots.map(pot=>pot.collectedCentsExact),[String(coin),String(coin*2)]);eq(collect[0].repeatCollection,true);eq(collect[1].repeatCollection,false);
 eq(collect[0].after[1][0].collectionType,'collector');eq(collect[0].after[0][0].collectionType,'coin');
}
// A x2 clover doubles only orthogonally adjacent coins, before cents rounding.
{
 const initial=grid(6,5);initial[5][4]='bomb';const gold=[{column:2,row:2},{column:2,row:3},{column:0,row:0}];
 const spin=playMaskSpin({game:'lecipher',stakeCents:500,initialGrid:initial,goldenCells:gold,randomInt:scripted([90,0,0,0,0,0])});
 const frame=spin.frames.find(frame=>frame.phase==='collect');eq(frame.after[2][2].collectionType,'booster');eq(frame.after[2][2].value,2);
 const one=Math.floor(500*14*rules.lecipher.payScaleBasisPoints/1000000),two=Math.floor(500*14*2*rules.lecipher.payScaleBasisPoints/1000000);eq(frame.payoutCents,one+two);
 eq(frame.wins.find(win=>win.cells[0].column===2).multiplier,2);eq(frame.wins.find(win=>win.cells[0].column===0).multiplier,1);
}

// Bad inputs and safety-limit failures are explicit; callers must never debit.
for(const game of ['maskhouse','lecipher'])for(const stakeCents of [0,499,501,25500,NaN,'500']){
 let draws=0;raises(()=>playMaskSlot({game,stakeCents,randomInt:()=>{draws++;return 0;}}),'STAKE');eq(draws,0);
}
raises(()=>playMaskSlot({game:'lecipher',mode:'buy',bonusTier:'treasure',stakeCents:500,randomInt:()=>0}),'MODE');
raises(()=>playMaskSlot({game:'maskhouse',mode:'buy',stakeCents:500,randomInt:cycle(),maxSpins:1}),'SPIN_LIMIT');
raises(()=>playMaskSlot({game:'lecipher',stakeCents:500,randomInt:()=>0,maxCascades:1}),'CASCADE_LIMIT');
{
 const initial=grid(6,5);initial[5][4]='bomb';raises(()=>playMaskSpin({game:'lecipher',stakeCents:500,initialGrid:initial,goldenCells:[{column:2,row:2},{column:3,row:2}],maxCollections:1,randomInt:scripted([0,0,97])}),'COLLECTION_LIMIT');
}

// Cent-exact, immutable financial and cell-identity invariants across five APIs.
for(const [game,mode,bonusTier]of [['maskhouse','paid','sticky'],['maskhouse','buy','sticky'],['lecipher','paid','luck'],['lecipher','buy','luck'],['lecipher','buy','gold']]){
 const randomInt=cycle();
 for(let i=0;i<1200;i++){
  const stakeCents=(1+i%50)*500,round=playMaskSlot({game,mode,bonusTier,stakeCents,randomInt}),price=mode==='buy'?rules[game].bonusBuys.find(item=>item.id===bonusTier).multiplier:1;
  eq(round.chargeCents,stakeCents*price);eq(round.capCents,stakeCents*40-rules.winCapOffsetCents);ok(Number.isSafeInteger(round.payoutCents));ok(round.payoutCents>=0&&round.payoutCents<=round.capCents&&round.payoutCents<=1000000);
  eq(round.payoutCents,round.spins.reduce((sum,spin)=>sum+spin.payoutCents,0));eq(round.spins.reduce((sum,spin)=>sum+spin.chargeCents,0),round.chargeCents);
  eq(round.freeSpinsAwarded-round.freeSpinsPlayed,round.unplayedFreeSpins);eq(round.ledger.creditCents,round.payoutCents);ok(Object.isFrozen(round)&&Object.isFrozen(round.spins));
  const known=new Map();
  for(const spin of round.spins){
   eq(spin.payoutScaleBasisPoints,!spin.freeSpin?rules[game].payScaleBasisPoints:game==='maskhouse'?rules.maskhouse.freePayScaleBasisPoints:rules.lecipher.freePayScaleBasisPointsByTier[spin.bonusTier]);
   eq(spin.payoutCents,spin.frames.reduce((sum,frame)=>sum+frame.wins.reduce((s,win)=>s+win.payoutCents,0),0));
   for(const frame of spin.frames)for(const board of [frame.before,frame.after]){
    eq(new Set(board.flat().map(cell=>cell.id)).size,rules[game].columns*rules[game].rows);
    for(const cell of board.flat()){ok(Object.isFrozen(cell));const text=JSON.stringify(cell);if(known.has(cell.id))eq(known.get(cell.id),text);else known.set(cell.id,text);}
   }
  }
 }
}
sharedMechanicsChecks=checks;
})();
eq(sha(await readFile(url)),sourceSHA256,'Candidate changed during regression.');
const result={passed:true,checks:checks+sharedMechanicsChecks,newV8Checks:checks,sharedMechanicsChecks,sourceSHA256,rulesVersion:r.version,samples};if(candidate)await writeFile(new URL('./regression-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
