// Integration checks against the actual Hall wallet and immutable slot timeline.
// Copy this file into indictus-site/tests unchanged. --candidate is only for
// read-only pre-merge review; the default always tests the live Site engine.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
const localSite=new URL('../src/hall-session.js',import.meta.url);
const site=existsSync(localSite)?new URL('../',import.meta.url):new URL('../../indictus-site/',import.meta.url);
const candidate=process.argv.includes('--candidate');
const skipAudit=candidate||process.argv.includes('--skip-audit');
const engineURL=candidate?new URL('../../slot-expansion-output/mask-slots-v4.js',import.meta.url):new URL('src/mask-slots.js',site);
const bonanzaURL=candidate?new URL('../../math-research/bonanza-shared-v9/bonanza-v9.js',import.meta.url):new URL('src/bonanza.js',site);
let hallURL=new URL('src/hall-session.js',site);
if(candidate){
 const source=readFileSync(hallURL,'utf8').replace(/from '\.\/([^']+)'/g,(_all,file)=>`from '${file==='mask-slots.js'?engineURL.href:file==='bonanza.js'?bonanzaURL.href:new URL('src/'+file,site).href}'`);
 hallURL=new URL('./candidate-hall-session.mjs',import.meta.url);writeFileSync(hallURL,source);
}
const {playMaskSlot,playMaskSpin,MASK_SLOT_RULES:rules,MASK_REGULAR_KINDS:kinds}=await import(engineURL);
const {BONANZA_DEMO_RULES:bonanza,simulateBonanzaRound}=await import(bonanzaURL);
const {HallSession,bonusPurchaseConfig,validateBonusPurchase}=await import(hallURL);
const {maskSlotSteps}=await import(new URL('src/mask-slot-presentation.js',site));
const {createRoundPlayback}=await import(new URL('src/RoundPlayback.js',site));
const {SLOT_THEMES}=await import(new URL('src/slot-themes.js',site));
const {applyBonusPurchaseFloor}=await import(new URL('src/bonus-purchase-floor.js',site));
let checks=0;const failures=[];
const eq=(a,b,message)=>{checks++;assert.deepEqual(a,b,message);};
const ok=(value,message)=>{checks++;assert.ok(value,message);};
const raises=(callback)=>{checks++;assert.throws(callback);};
const section=(name,callback)=>{try{callback();console.log(JSON.stringify({section:name,passed:true}));}catch(error){failures.push({section:name,message:error.message});console.error(JSON.stringify(failures.at(-1)));}};
const seed='indictus-independent-shared-bonus-integration-2026-10-09';
function rng(label){
 const digest=createHash('sha256').update(seed+'/'+label).digest();
 let a=digest.readUInt32LE(0),b=digest.readUInt32LE(4),c=digest.readUInt32LE(8),d=digest.readUInt32LE(12);
 const rot=(word,bits)=>((word<<bits)|(word>>>(32-bits)))>>>0;
 return maximum=>{const limit=Math.floor(4294967296/maximum)*maximum;let word;do{word=Math.imul(rot(Math.imul(b,5),7),9)>>>0;const t=b<<9;c^=a;d^=b;b^=c;a^=d;c^=t;d=rot(d,11);}while(word>=limit);return word%maximum;};
}
function wallet(randomInt=rng('wallet'),balance=10000){return new HallSession(null,randomInt,{initialBalanceCents:Math.round(balance*100),houseCapitalCents:10000000});}
const scenarios=[['maskhouse','paid','sticky',1],['maskhouse','buy','sticky',20],['lecipher','paid','luck',1],['lecipher','buy','luck',20],['lecipher','buy','gold',25]];
const board=(columns,rows)=>Array.from({length:columns},(_,column)=>Array.from({length:rows},(_,row)=>kinds[(column+row*2)%9]));
const auditRows=[];let stickyHolds=0,selections=0,freeReels=0;const collectionTypes=new Set();

section('available offers, exact prices, minimum wallet and validation before RNG',()=>{
 eq(rules.version,'indictus-mask-slots-original-v10-features');eq(rules.winCapMultiplier,40);eq(rules.winCapOffsetCents,100);eq(rules.maskhouse.baseScatterWeight,60);
 eq(bonanza.version,'indictus-demo-2026-10-09-v11');eq(bonanza.winCapMultiplier,100);
 for(const [game,tier,multiplier] of [['slots',undefined,50],['maskhouse','sticky',20],['lecipher','luck',20],['lecipher','gold',25]]){
  eq(bonusPurchaseConfig(game,tier).multiplier,multiplier);
  eq(validateBonusPurchase(5,5*multiplier,game,tier),'');ok(validateBonusPurchase(5,5*multiplier-0.01,game,tier));
  for(const invalid of [0,4,6,255,NaN,Infinity,'5',5.5]){
   let draws=0;const session=wallet(()=>{draws++;return 0;}),before=session.getSnapshot();
   raises(()=>session.begin(game,game,invalid,{mode:'buy',bonusTier:tier}));
   eq(draws,0);eq(session.getSnapshot(),before);eq(session.id,0);eq(session.active.size,0);
  }
  let draws=0;const session=wallet(()=>{draws++;return 0;},5*multiplier-.01),before=session.getSnapshot();
  raises(()=>session.begin(game,game,5,{mode:'buy',bonusTier:tier}));eq(draws,0);eq(session.getSnapshot(),before);eq(session.id,0);
  // Merely computing or validating a confirmation is reversible and does not
  // reserve funds. Cancelling the UI dialog has no Hall transaction to undo.
  const review=wallet(()=>{throw new Error('Purchase review must not draw');}),snapshot=review.getSnapshot();
  eq(validateBonusPurchase(50,snapshot.balance,game,tier),'');
  eq(review.getSnapshot(),snapshot);eq(review.balanceCents,1000000);eq(review.id,0);eq(review.active.size,0);
  // The reviewed amount survives later control changes, while confirmation
  // checks the current wallet again rather than trusting the old review.
  let confirmDraws=0;
  const request=Object.freeze({stake:50,tier,cost:50*multiplier});
  const confirmed=wallet(()=>{confirmDraws++;return 0;},request.cost-.01),changed=confirmed.getSnapshot();
  raises(()=>confirmed.begin(game,game,request.stake,{mode:'buy',bonusTier:request.tier}));
  eq(confirmDraws,0);eq(confirmed.getSnapshot(),changed);eq(confirmed.id,0);eq(confirmed.active.size,0);
 }
 for(const [game,tier]of [['maskhouse','gold'],['maskhouse','unknown'],['lecipher','sticky'],['lecipher','treasure'],['slots','gold']]){
  let draws=0;const session=wallet(()=>{draws++;return 0;}),before=session.getSnapshot();
  raises(()=>session.begin(game,game,5,{mode:'buy',bonusTier:tier}));eq(draws,0);eq(session.getSnapshot(),before);eq(session.id,0);
 }
 for(const game of ['maskhouse','lecipher'])for(const invalid of [0,4,6,255,NaN,Infinity,'5',5.5]){
  let draws=0;const session=wallet(()=>{draws++;return 0;}),before=session.getSnapshot();
  raises(()=>session.begin(game,game,invalid));eq(draws,0);eq(session.getSnapshot(),before);eq(session.id,0);
 }
 for(const game of ['maskhouse','lecipher'])for(const options of [{mode:'invalid'},{mode:'preview'},{mode:'buy',preview:true}]){
  let draws=0;const session=wallet(()=>{draws++;return 0;}),before=session.getSnapshot();
  raises(()=>session.begin(game,game,5,options));eq(draws,0);eq(session.getSnapshot(),before);eq(session.id,0);
 }
 for(const game of ['maskhouse','lecipher']){
  let draws=0;const session=wallet(()=>{draws++;return 0;},4.99),before=session.getSnapshot();
  raises(()=>session.begin(game,game,5));eq(draws,0);eq(session.getSnapshot(),before);eq(session.id,0);
 }
});

section('5/100/250 AR engine identity, exclusive play and exact one-time credit',()=>{
 for(const [game,mode,tier,multiplier]of scenarios){
  let totalPayout=0,freeSpins=0;
  for(let sample=0;sample<90;sample++){
   const stake=[5,100,250][sample%3],label=`${game}/${mode}/${tier}/${sample}`;
   const native=playMaskSlot({game,mode,bonusTier:tier,stakeCents:stake*100,randomInt:rng(label)});
   const expected=mode==='buy'?applyBonusPurchaseFloor(native,{game,mode,chargeCents:stake*100*multiplier}):native;
   let draws=0;const random=rng(label),session=wallet(maximum=>{draws++;return random(maximum);});
   const opening=session.balanceCents,round=session.begin(game,game,stake,{mode,...(mode==='buy'?{bonusTier:tier}:{})});
   eq(round.chargeCents,stake*100*multiplier);eq(round.payoutCents,expected.payoutCents);eq(round.spins,expected.spins);
   eq(round.bonusPurchaseTier,mode==='buy'?tier:null);ok(Object.isFrozen(round));ok(Object.isFrozen(round.spins));
   eq(round.capCents,stake*100*40-rules.winCapOffsetCents);ok(round.capCents<=1000000);ok(round.payoutCents<=round.capCents);
   eq(round.spins.reduce((sum,spin)=>sum+spin.chargeCents,0),round.chargeCents);
   eq(round.ledger,{chargeCents:round.chargeCents,creditCents:round.payoutCents});
   eq(session.balanceCents,opening-round.chargeCents);eq(session.getSnapshot().result,null);
   const before=session.getSnapshot(),beforeDraws=draws;
   for(const game2 of ['maskhouse','lecipher','plinko','coinflip'])eq(session.begin(game2,game2,5),null);
   eq(session.beginBlackjack(5),null);eq(session.reset(),false);eq(session.getSnapshot(),before);eq(draws,beforeDraws);
   eq(session.complete(round.id+1),false);eq(session.balanceCents,opening-round.chargeCents);
   eq(session.complete(round.id),true);eq(session.balanceCents,opening-round.chargeCents+round.payoutCents);
   const settled=session.getSnapshot();eq(session.complete(round.id),false);eq(session.getSnapshot(),settled);eq(draws,beforeDraws);
   eq(session.active.size,0);eq(settled.busy,false);
   totalPayout+=round.payoutCents;freeSpins+=round.freeSpinsPlayed;
   const serialized=JSON.stringify(round),timeline=maskSlotSteps(round,round.spins[0].initial);
   eq(JSON.stringify(round),serialized);eq(timeline.duration,timeline.steps.reduce((sum,step)=>sum+step.ms,0));
   eq(timeline.terminal.totalPayoutCents,round.payoutCents);eq(timeline.terminal.freeRemaining,0);eq(timeline.terminal.capped,round.capReached);
   const summaries=timeline.steps.filter(step=>step.phase==='summary');eq(summaries.length,round.spins.length);
   let activeTier=round.bonusPurchaseTier,cursor=0;
   for(let index=0;index<round.spins.length;index++){
    const spin=round.spins[index];eq(summaries[index].grid,spin.terminal);
    eq(summaries[index].totalPayoutCents,spin.totalPayoutCents);eq(summaries[index].freeRemaining,spin.freeSpinsRemaining);
    const reel=timeline.steps.find(step=>step.phase==='reel'&&step.grid===spin.initial&&step.serial>cursor);ok(reel);cursor=reel.serial;
    eq(reel.freeSpin,spin.freeSpin);eq(reel.bonusTier,activeTier);
    eq(spin.payoutScaleBasisPoints,spin.freeSpin?(game==='maskhouse'?rules.maskhouse.freePayScaleBasisPoints:rules.lecipher.freePayScaleBasisPointsByTier[activeTier]):rules[game].payScaleBasisPoints);
    if(spin.awardedTier)activeTier=spin.awardedTier;
    if(spin.freeSpin){freeReels++;ok(reel.freeRemaining>0);}
    if(game==='maskhouse'){
     if(spin.freeSpin){eq(spin.awardedSpins,0);ok(!spin.initial.flat().some(cell=>cell.kind==='scatter'));}
     else for(const column of spin.initial){const wilds=column.filter(cell=>cell.kind==='wild');if(wilds.length>1)eq(new Set(wilds.map(cell=>cell.value)).size,1);}
    }
    if(spin.freeSpin&&reel.previous)for(let column=0;column<reel.grid.length;column++)for(let row=0;row<reel.grid[column].length;row++){
     const outgoing=reel.previous[column][row],incoming=reel.grid[column][row];
     if(outgoing.kind==='wild'&&outgoing===incoming){eq(outgoing.value,incoming.value);stickyHolds++;}
    }
    for(const frame of spin.frames)for(const grid of [frame.before,frame.after])for(const cell of grid.flat()){
     ok(kinds.includes(cell.kind)||['wild','scatter','bomb'].includes(cell.kind));
     if(cell.coin){ok(['coin','booster','collector'].includes(cell.collectionType));ok(Number.isFinite(cell.value)&&cell.value>=0);collectionTypes.add(cell.collectionType);}
    }
   }
   eq(timeline.terminal.bonusTier,activeTier);ok(timeline.steps.every(step=>step.freeRemaining>=0&&Number.isInteger(step.freeRemaining)));
   for(const intro of timeline.steps.filter(step=>step.phase==='bonus-selection')){
    eq(game,'maskhouse');eq(intro.bonusSelection.length,9);ok(intro.bonusSelection.every(value=>[1,2,3].includes(value)));
    eq(intro.added,intro.bonusSelection.reduce((sum,value)=>sum+value,0));selections++;
   }
   if(game==='maskhouse'&&mode==='buy'){
    const intro=timeline.steps.find(step=>step.phase==='bonus-selection');ok(intro);eq(intro.freeRemaining,round.initialFreeSpins);
    ok(round.initialFreeSpins>=9&&round.initialFreeSpins<=27);
   }
  }
  auditRows.push({game,mode,tier,samples:90,totalPayoutAR:totalPayout/100,freeSpins});
 }
 ok(freeReels>0);ok(stickyHolds>0);ok(selections>=90);for(const type of ['coin','booster','collector'])ok(collectionTypes.has(type));
});

section('Bonanza v11 prices, shared aliases and exact-once paid/bought wallet settlement',()=>{
 ok(bonanza.freePays===bonanza.boughtFreePays);ok(bonanza.freeScatterPays===bonanza.boughtFreeScatterPays);
 for(const mode of ['paid','buy'])for(const stake of [5,100])for(let sample=0;sample<20;sample++){
  const label=`bonanza/${mode}/${stake}/${sample}`,native=simulateBonanzaRound(stake*100,{mode,randomInt:rng(label)}),expected=mode==='buy'?applyBonusPurchaseFloor(native,{game:'slots',mode,chargeCents:stake*100*50}):native;
  const session=wallet(rng(label)),opening=session.balanceCents,round=session.begin('slots','slots',stake,{mode});
  eq(round.chargeCents,stake*100*(mode==='buy'?50:1));eq(round.payoutCents,expected.payoutCents);eq(round.spins,expected.spins);
  ok(round.payoutCents<=stake*100*100);eq(session.balanceCents,opening-round.chargeCents);
  eq(session.complete(round.id),true);eq(session.balanceCents,opening-round.chargeCents+round.payoutCents);
  const final=session.getSnapshot();eq(session.complete(round.id),false);eq(session.getSnapshot(),final);
 }
});

section('shared free tables pay identically for natural/bought entry with the same state and RNG',()=>{
 eq(rules.maskhouse.freePays,rules.maskhouse.boughtFreePays);eq(rules.maskhouse.freePayScaleBasisPoints,rules.maskhouse.boughtFreePayScaleBasisPoints);
 for(const tier of ['luck','gold']){
  eq(rules.lecipher.freePaysByTier[tier],rules.lecipher.boughtFreePaysByTier[tier]);
  eq(rules.lecipher.freeCoinPercentWeightsByTier[tier],rules.lecipher.boughtFreeCoinPercentWeightsByTier[tier]);
 }
 eq(rules.lecipher.freeCoinPercentWeightsByTier.treasure.length,4);
 eq(rules.lecipher.freeCoinPercentWeightsByTier.treasure.reduce((sum,[,weight])=>sum+weight,0),17);
 for(const [game,tier]of [['maskhouse','sticky'],['lecipher','luck'],['lecipher','gold']])for(let sample=0;sample<40;sample++){
  const initial=board(rules[game].columns,rules[game].rows);
  const options={game,stakeCents:[500,10000,25000][sample%3],freeSpin:true,bonusTier:tier,initialGrid:initial};
  if(game==='maskhouse')options.stickyWilds=[{column:1,row:1,value:2},{column:2,row:1,value:3}];
  else{initial[5][4]='bomb';options.goldenCells=[{column:0,row:0},{column:1,row:0},{column:2,row:0}];}
  const label=`same-state/${game}/${tier}/${sample}`;
  const natural=playMaskSpin({...options,mode:'paid',randomInt:rng(label)}),bought=playMaskSpin({...options,mode:'buy',randomInt:rng(label)});
  const {mode:naturalMode,...naturalValue}=natural,{mode:boughtMode,...boughtValue}=bought;
  eq(naturalMode,'paid');eq(boughtMode,'buy');eq(naturalValue,boughtValue);
 }
 raises(()=>playMaskSpin({game:'lecipher',mode:'buy',bonusTier:'treasure',stakeCents:500,freeSpin:true,initialGrid:board(6,5),randomInt:rng('not-buyable')}));
});

section('an engine round applies the Gold table on the spin after a Luck upgrade',()=>{
 const weights=rules.lecipher.freeRegularWeights,kindTicket=kind=>weights.slice(0,kinds.indexOf(kind)).reduce((sum,weight)=>sum+weight,0);
 const scatterTicket=weights.reduce((sum,weight)=>sum+weight,0),tickets=[];
 const first=board(6,5);for(const column of [0,1,2,3])first[column][0]='scatter';
 const second=board(6,5);second[0]=Array(5).fill('flag');
 for(const grid of [first,second])for(const column of grid)for(const kind of column)tickets.push(kind==='scatter'?scatterTicket:kindTicket(kind));
 // The five-cell flag cluster falls once, refilling with a non-winning column.
 for(const kind of board(6,5)[0])tickets.push(kindTicket(kind));
 const fallback=rng('upgrade-rest');let cursor=0;
 const round=playMaskSlot({game:'lecipher',mode:'buy',bonusTier:'luck',stakeCents:500,randomInt:maximum=>{if(cursor<tickets.length){const ticket=tickets[cursor++];ok(ticket<maximum);return ticket;}return fallback(maximum);}});
 eq(round.spins[0].awardedTier,'gold');eq(round.spins[0].payoutScaleBasisPoints,rules.lecipher.freePayScaleBasisPointsByTier.luck);
 eq(round.spins[1].bonusTier,'gold');eq(round.spins[1].payoutScaleBasisPoints,rules.lecipher.freePayScaleBasisPointsByTier.gold);
 const flagWin=round.spins[1].frames.flatMap(frame=>frame.wins).find(win=>win.kind==='flag'&&win.count===5);ok(flagWin);
 eq(flagWin.payoutCents,Math.floor(500*rules.lecipher.freePaysByTier.gold.flag[0]/100));
 const timeline=maskSlotSteps(round,first),secondReel=timeline.steps.find(step=>step.phase==='reel'&&step.grid===round.spins[1].initial);
 eq(secondReel.bonusTier,'gold');
});

section('natural House requires BONUS on every eligible reel; nine awards sum visibly',()=>{
 const missing=board(5,3);for(let row=0;row<3;row++)missing[0][row]='scatter';
 const noAward=playMaskSpin({game:'maskhouse',stakeCents:500,initialGrid:missing,randomInt:rng('missing-reel')});
 eq(noAward.awardedSpins,0);eq(noAward.awardedTier,null);eq(noAward.bonusSelection,[]);
 const initial=board(5,3);for(const column of [0,2,4])initial[column][0]='scatter';
 const spin=playMaskSpin({game:'maskhouse',stakeCents:500,initialGrid:initial,randomInt:()=>72});
 eq(spin.awardedTier,'sticky');eq(spin.bonusSelection,Array(9).fill(2));eq(spin.awardedSpins,18);
 const round={game:'maskhouse',mode:'paid',bonusPurchaseTier:null,initialFreeSpins:0,spins:[spin],payoutCents:spin.payoutCents,capReached:spin.capReached};
 const timeline=maskSlotSteps(round,initial),intro=timeline.steps.find(step=>step.phase==='bonus-selection');
 eq(intro.bonusSelection,spin.bonusSelection);eq(intro.freeRemaining,18);eq(intro.bonusTier,'sticky');eq(intro.added,18);
});

section('LeXof tier counters, upgrade, persistent gold, guaranteed token and collection timeline',()=>{
 const gold=[{column:2,row:2}];
 for(const [count,tier,award]of [[3,'luck',8],[4,'gold',12],[5,'treasure',12]]){
  const initial=board(6,5);for(let column=0;column<count;column++)initial[column][0]='scatter';
  const spin=playMaskSpin({game:'lecipher',stakeCents:500,initialGrid:initial,randomInt:rng('natural/'+tier)});
  eq(spin.awardedTier,tier);eq(spin.awardedSpins,award);
  const round={mode:'paid',bonusPurchaseTier:null,initialFreeSpins:0,spins:[spin],payoutCents:spin.payoutCents,capReached:spin.capReached};
  const intro=maskSlotSteps(round,initial).steps.find(step=>step.phase==='bonus');ok(intro);eq(intro.freeRemaining,award);eq(intro.bonusTier,tier);
 }
 for(const tier of ['luck','gold','treasure']){
  const initial=board(6,5);if(tier!=='treasure')initial[5][4]='bomb';
  const first=playMaskSpin({game:'lecipher',stakeCents:500,freeSpin:true,bonusTier:tier,initialGrid:initial,goldenCells:gold,randomInt:()=>0});
  const collect=first.frames.find(frame=>frame.phase==='collect');ok(collect);eq(collect.goldenCells,gold);
  eq(first.goldenCells,tier==='luck'?[]:gold);
  if(tier==='treasure'){ok(first.guaranteedToken);ok(first.initial.flat().some(cell=>cell.activation&&cell.guaranteed));}
  const second=playMaskSpin({game:'lecipher',stakeCents:500,freeSpin:true,bonusTier:tier,initialGrid:board(6,5),goldenCells:first.goldenCells,randomInt:()=>0});
  const round={mode:'buy',bonusPurchaseTier:tier,initialFreeSpins:2,spins:[first,second],payoutCents:first.payoutCents+second.payoutCents,capReached:false};
  const timeline=maskSlotSteps(round,initial),reel=timeline.steps.find(step=>step.phase==='reel'&&step.grid===second.initial);
  eq(reel.goldenCells,first.goldenCells);eq(reel.bonusTier,tier);
  ok(timeline.steps.some(step=>step.phase==='collect'&&step.grid===collect.after));
 }
 const initial=board(6,5);for(let column=0;column<4;column++)initial[column][0]='scatter';initial[5][4]='bomb';
 const upgrade=playMaskSpin({game:'lecipher',stakeCents:500,freeSpin:true,bonusTier:'luck',initialGrid:initial,goldenCells:gold,randomInt:()=>0});
 eq(upgrade.awardedTier,'gold');eq(upgrade.awardedSpins,4);eq(upgrade.goldenCells,gold);
 const next=playMaskSpin({game:'lecipher',stakeCents:500,freeSpin:true,bonusTier:'gold',initialGrid:board(6,5),goldenCells:upgrade.goldenCells,randomInt:()=>0});
 const round={mode:'buy',bonusPurchaseTier:'luck',initialFreeSpins:2,spins:[upgrade,next],payoutCents:upgrade.payoutCents+next.payoutCents,capReached:false};
 const timeline=maskSlotSteps(round,initial),intro=timeline.steps.find(step=>step.phase==='bonus'&&step.added===4);
 eq(intro.bonusTier,'gold');eq(intro.freeRemaining,5);eq(timeline.steps.find(step=>step.phase==='reel'&&step.grid===next.initial).bonusTier,'gold');
 for(const [count,award]of [[2,2],[3,4]]){
  const grid=board(6,5);for(let column=0;column<count;column++)grid[column][0]='scatter';
  const spin=playMaskSpin({game:'lecipher',stakeCents:500,freeSpin:true,bonusTier:'gold',initialGrid:grid,randomInt:()=>0});eq(spin.awardedSpins,award);eq(spin.awardedTier,null);
 }
});

section('hidden pause/resume, skip, reduced-motion finish and unmount settle once',()=>{
 for(const completion of ['natural','skip','reduced','unmount']){
  const session=wallet(rng(completion)),round=session.begin('lecipher','lecipher',5,{mode:'buy',bonusTier:'gold'}),debited=session.balanceCents;
  let callback=null,hidden=completion==='reduced',onCompleteCalls=0;const progress=[];
  const playback=createRoundPlayback({duration:100,requestFrame:fn=>{callback=fn;return 1;},cancelFrame:()=>{callback=null;},isHidden:()=>hidden,
   onProgress:value=>progress.push(value),onComplete:show=>{onCompleteCalls++;eq(show,completion!=='unmount');eq(session.complete(round.id),true);}});
  playback.start();
  if(hidden){eq(callback,null);eq(session.balanceCents,debited);playback.finish();}
  else{
   callback(0);callback(20);eq(progress.at(-1),.2);hidden=true;playback.visibilityChanged();eq(callback,null);
   eq(session.balanceCents,debited);eq(session.getSnapshot().busy,true);
   hidden=false;playback.visibilityChanged();callback(10000);eq(progress.at(-1),.2);
   if(completion==='natural')callback(10080);else playback.finish(completion!=='unmount');
  }
  eq(onCompleteCalls,1);eq(session.balanceCents,debited+round.payoutCents);eq(session.getSnapshot().busy,false);
  eq(playback.finish(),false);eq(session.complete(round.id),false);eq(onCompleteCalls,1);
 }
});

section('invalid RNG/safety failures never debit or reserve an ID',()=>{
 for(const game of ['maskhouse','lecipher'])for(const ticket of [-1,NaN,Infinity,'0']){
  const session=wallet(()=>ticket),before=session.getSnapshot();raises(()=>session.begin(game,game,5));
  eq(session.getSnapshot(),before);eq(session.balanceCents,1000000);eq(session.id,0);eq(session.active.size,0);
 }
 // This fixture deterministically exceeds the engine cascade guard. A failed
 // engine result cannot reach the wallet debit which follows full evaluation.
 const flagTicket=rules.lecipher.baseRegularWeights.slice(0,-1).reduce((sum,weight)=>sum+weight,0);
 const scatterTicket=rules.lecipher.baseRegularWeights.reduce((sum,weight)=>sum+weight,0);let calls=0;
 const session=wallet(()=>{const index=calls++;return index<5||index>=30?flagTicket:scatterTicket;}),before=session.getSnapshot();
 raises(()=>session.begin('lecipher','lecipher',5));ok(calls>30);
 eq(session.getSnapshot(),before);eq(session.balanceCents,1000000);eq(session.id,0);eq(session.active.size,0);
});

section('each new slot has its own raster atlas and collection glyphs exist',()=>{
 const sources=[];
 for(const game of ['maskhouse','lecipher']){
  eq(Object.keys(SLOT_THEMES[game].names).length,12);
  const bytes=readFileSync(new URL('public/'+SLOT_THEMES[game].atlas,site));
  if(bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'){eq(bytes.readUInt32BE(16),1448);eq(bytes.readUInt32BE(20),1086);}
  else {eq(bytes.toString('ascii',0,4),'RIFF');eq(bytes.toString('ascii',8,12),'WEBP');eq(bytes.toString('ascii',12,16),'VP8X');eq(bytes.readUIntLE(24,3)+1,1448);eq(bytes.readUIntLE(27,3)+1,1086);}
  sources.push(createHash('sha256').update(bytes).digest('hex'));
 }
 ok(sources[0]!==sources[1]);
 for(const path of ['lexof-amplifier.png','lexof-archive.png']){
  const bytes=readFileSync(new URL('public/'+path,site));eq(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');ok(bytes.readUInt32BE(16)>0&&bytes.readUInt32BE(20)>0);
 }
});

// Render the actual React rules component, then compare every displayed pay
// cell with the current engine table. This catches stale display copies or a
// wrong tier/table binding without requiring a browser gambling interaction.
const {transformWithOxc}=await import(new URL('node_modules/vite/dist/node/index.js',site));
const {default:React}=await import(new URL('node_modules/react/index.js',site));
const renderer=await import(new URL('node_modules/react-dom/server.node.js',site));
const rulesSource=readFileSync(new URL('src/MaskSlotOddsRules.jsx',site),'utf8');
const transformed=await transformWithOxc(rulesSource,'MaskSlotOddsRules.jsx',{jsx:{runtime:'classic',development:false}});
const rulesModule=transformed.code
 .replace(/from "react"/g,`from '${new URL('node_modules/react/index.js',site).href}'`)
 .replace(/from "\.\/mask-slots\.js"/g,`from '${engineURL.href}'`)
 .replace(/from "\.\/slot-themes\.js"/g,`from '${new URL('src/slot-themes.js',site).href}'`);
const {default:RulesDisplay}=await import('data:text/javascript;base64,'+Buffer.from(rulesModule).toString('base64'));
const display=renderer.renderToStaticMarkup(React.createElement(RulesDisplay,{rules,audits:[]}));
const strip=text=>text.replace(/<[^>]*>/g,'');
const tables=[...display.matchAll(/<table>(.*?)<\/table>/gs)].map(match=>({html:match[1],caption:strip(match[1].match(/<caption>(.*?)<\/caption>/s)?.[1]||'')}));
const displayNumber=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:5}).format(value);
const articleFor=game=>display.split(/<article\b[^>]*>/).slice(1).find(article=>strip(article.match(/<h2[^>]*>(.*?)<\/h2>/s)?.[1]||'')===(game==='maskhouse'?'Mask Hou$e':'LeXof'));
section('all eight shared/paid/no-WILD pay tables and four coin tables match the current engine',()=>{
 const tablesByArticle=['maskhouse','lecipher'].map(articleFor).map(article=>[...article.matchAll(/<table>(.*?)<\/table>/gs)].map(match=>({html:match[1],caption:strip(match[1].match(/<caption>(.*?)<\/caption>/s)?.[1]||'')})));
 const expected=[
  [0,'Платный спин: база линии с WILD, умножается на сумму WILD','maskhouse',rules.maskhouse.pays],
  [0,'Бонус: база линии с WILD, умножается на сумму WILD','maskhouse',rules.maskhouse.freePays],
  [0,'Платный спин: линия без WILD','maskhouse',rules.maskhouse.noWildPays],
  [0,'Бонус: линия без WILD','maskhouse',rules.maskhouse.freeNoWildPays],
  [1,'Платный спин: номиналы групп до бюджета','lecipher',rules.lecipher.pays],
  [1,'«Тайник»: номиналы групп до бюджета','lecipher',rules.lecipher.freePaysByTier.luck],
  [1,'«Золотой архив»: номиналы групп до бюджета','lecipher',rules.lecipher.freePaysByTier.gold],
  [1,'«Главный код»: номиналы групп до бюджета','lecipher',rules.lecipher.freePaysByTier.treasure]
 ];
 for(const [article,caption,game,expectedPays]of expected){
  const table=tablesByArticle[article].find(table=>table.caption===caption);ok(table,'Missing payout table '+caption);
  const rows=[...table.html.match(/<tbody>(.*?)<\/tbody>/s)[1].matchAll(/<tr>(.*?)<\/tr>/gs)];eq(rows.length,kinds.length);
  rows.forEach((row,index)=>{
   const cells=[...row[1].matchAll(/<td>(.*?)<\/td>/gs)].map(cell=>strip(cell[1]));
   eq(cells[0],SLOT_THEMES[game].names[kinds[index]]);
   eq(cells.slice(1),expectedPays[kinds[index]].map(percent=>'×'+displayNumber(percent/100)));
  });
 }
 const coinTables=[['Платный спин',rules.lecipher.coinPercentWeights],['«Тайник»',rules.lecipher.freeCoinPercentWeightsByTier.luck],['«Золотой архив»',rules.lecipher.freeCoinPercentWeightsByTier.gold],['«Главный код»',rules.lecipher.freeCoinPercentWeightsByTier.treasure]];
 for(const [title,entries]of coinTables){
  const coins=tables.find(table=>table.caption===title+': номиналы монет до усилителей и бюджета');ok(coins);
  const rows=[...coins.html.match(/<tbody>(.*?)<\/tbody>/s)[1].matchAll(/<tr>(.*?)<\/tr>/gs)];eq(rows.length,entries.length);
  const total=entries.reduce((sum,[,weight])=>sum+weight,0);
  rows.forEach((row,index)=>{
   const cells=[...row[1].matchAll(/<td>(.*?)<\/td>/gs)].map(cell=>strip(cell[1])),[value,weight]=entries[index];
   eq(cells[0],'×'+displayNumber(value/100));eq(cells[1],String(weight));
   eq(cells[2],`${weight}/${total} · ${displayNumber(weight/total*100)}%`);
  });
 }
 const house=rules.maskhouse,regularTotal=house.baseRegularWeights.reduce((sum,weight)=>sum+weight,0);
 // Independent exact frozen distribution: outer eligible reels total920,
 // middle eligible reel960. Undefined removed legacy fields cannot pass asNaN.
 const eligibleTotals=house.scatterColumns.map(column=>regularTotal*house.baseRegularWeightScaleByReel[column]+house.baseScatterWeight+house.baseWildWeightsByReel[column]);
 eq(eligibleTotals,[920,960,920]);
 const triggerProbability=(1-(860/920)**3)**2*(1-(900/960)**3);
 ok(Number.isFinite(triggerProbability)&&triggerProbability>0&&triggerProbability<1);
 const publishedHouse=strip(articleFor('maskhouse'));
 ok(publishedHouse.includes('Естественный запуск требует'));
 const naturalDisplay=publishedHouse.match(/Естественный запуск[\s\S]*?вероятность\s*([0-9.,\u00a0\u202f ]+)%/);
 ok(naturalDisplay,'House natural trigger probability must be present.');
 eq(naturalDisplay[1].trim(),displayNumber(triggerProbability*100),'House natural trigger must publish the actual finite920/960/920 probability.');
 ok(!/NaN|Infinity|undefined/.test(strip(display)),'Every published probability must be finite and use a defined current weight.');
 ok(!/70\s*%/.test(strip(display)),'No stale 70% slot-return claim in the rules component');
});

section('six House reel distributions and both no-WILD pay tables are published accurately',()=>{
 const houseTables=articleFor('maskhouse');
 const available=[...houseTables.matchAll(/<table>(.*?)<\/table>/gs)].map(match=>({html:match[1],rows:[...match[1].matchAll(/<tr>(.*?)<\/tr>/gs)].filter(row=>/<td>/.test(row[1])).map(row=>[...row[1].matchAll(/<td>(.*?)<\/td>/gs)].map(cell=>strip(cell[1])))}));
 for(const free of [false,true])for(const column of [0,1,2]){
  const config=rules.maskhouse,weights=free?config.freeRegularWeights:config.baseRegularWeights;
  const scale=(free?config.freeRegularWeightScaleByReel:config.baseRegularWeightScaleByReel)[column];
  const entries=kinds.map((kind,i)=>[kind,weights[i]*scale]);
  if(!free&&config.scatterColumns.includes(column))entries.push(['scatter',config.baseScatterWeight]);
  const wild=(free?config.freeWildWeightsByReel:config.baseWildWeightsByReel)[column];if(wild)entries.push(['wild',wild]);
  const total=entries.reduce((sum,[,w])=>sum+w,0),expected=entries.map(([kind,w])=>[SLOT_THEMES.maskhouse.names[kind],String(w),`${w}/${total} · ${displayNumber(w/total*100)}%`]);
  ok(available.some(table=>JSON.stringify(table.rows)===JSON.stringify(expected)),`Missing actual House ${free?'free':'paid'} reel${column+1} weights/physical-cell probabilities total${total}.`);
 }
 for(const [name,pays]of [['paid without WILD',rules.maskhouse.noWildPays],['free without WILD',rules.maskhouse.freeNoWildPays]]){
  const expected=kinds.map(kind=>[SLOT_THEMES.maskhouse.names[kind],...pays[kind].map(value=>'×'+displayNumber(value/100))]);
  ok(available.some(table=>JSON.stringify(table.rows)===JSON.stringify(expected)),`Missing ${name} payout table.`);
 }
 const text=strip(display);ok(!/NaN|Infinity|undefined/.test(text));
 // Both cap and non-symbol receipt must be visible in this public rules view.
 ok(text.includes('9\u00a0999')||text.includes('9999'),'Actual max payout at250AR must be9999AR.');
 ok(/5\s*%/.test(text),'Disclosed bonus minimum return must be present.');
});
if(!skipAudit)section('published simulation is tied to this engine and all five slot modes estimate about 50%',()=>{
 const audit=JSON.parse(readFileSync(new URL('src/mask-slot-statistics.json',site),'utf8'));
 eq(audit.rulesVersion,rules.version);eq(audit.sourceSHA256,createHash('sha256').update(readFileSync(engineURL)).digest('hex'));
 eq(audit.rules,rules);eq(audit.results.length,5);
 // v8 methodology reports accounting in text; concrete plans and full first-series
 // charges independently prove the exact volume rather than a duplicate header.
 eq(audit.methodology.repeatSessions,2000);
 for(const entry of audit.results){eq(entry.transactionPlan.totalStakesAR,10000);eq(entry.example.paidRounds.reduce((sum,round)=>sum+round.chargeAR,0),10000);}
 for(const [game,mode,tier]of scenarios){
  const entry=audit.results.find(row=>row.game===game&&row.mode===mode&&row.bonusTier===tier);ok(entry);
  const row=entry.repeatedSessions?{...entry,...entry.repeatedSessions}:entry;
  ok(row.transactions>0);ok(row.sessions>0);eq(row.unchargedGuardFailures,0);
  ok(row.estimatedGrossReturnPercent>=47&&row.estimatedGrossReturnPercent<=53,'Return near 50%, not a stale 70% audit');
  eq(row.meanGrossReturn95CI_Percent.length,2);ok(row.meanGrossReturn95CI_Percent[0]<=row.estimatedGrossReturnPercent&&row.estimatedGrossReturnPercent<=row.meanGrossReturn95CI_Percent[1]);
  eq(entry.payoutScaleBasisPoints,mode==='paid'?rules[game].payScaleBasisPoints:rules[game].bonusBuys.find(offer=>offer.id===tier).payScaleBasisPoints);
  eq(entry.transactionPlan.totalStakesAR,10000);
  eq(Math.round((row.meanPayoutAR+row.meanCasinoResultAR)*100),1000000);
  ok(Math.abs(row.meanPayoutAR/100-row.estimatedGrossReturnPercent)<=.0051);
  eq(entry.example.totalStakesAR,10000);eq(Math.round((entry.example.payoutAR+entry.example.casinoResultAR)*100),1000000);
  if(mode==='buy'&&tier!=='gold'){
   eq(entry.transactionPlan.mixed,false);eq(entry.transactionPlan.buyTransactions,100);eq(entry.transactionPlan.buyChargeAR,100);
   eq(entry.transactionPlan.paidTransactions,0);eq(entry.transactionPlan.paidStakeAR,0);
  }else if(mode==='buy'){
   eq(entry.transactionPlan.mixed,false);eq(entry.transactionPlan.buyTransactions,80);eq(entry.transactionPlan.buyChargeAR,125);eq(entry.transactionPlan.paidTransactions,0);
  }else{
   eq(entry.transactionPlan.mixed,false);eq(entry.transactionPlan.paidTransactions,100);eq(entry.transactionPlan.paidStakeAR,100);eq(entry.transactionPlan.buyTransactions,0);
  }
 }
 const html=renderer.renderToStaticMarkup(React.createElement(RulesDisplay,{rules,audits:audit.results}));
 for(const row of audit.results)ok(strip(html).includes(displayNumber(row.estimatedGrossReturnPercent)+'%'));
});
const sourceSHA256={};
for(const name of ['mask-slots','mask-slot-presentation','hall-session','RoundPlayback','MaskSlotRoom']){
 const url=name==='mask-slots'?engineURL:new URL('src/'+name+(name==='MaskSlotRoom'?'.jsx':'.js'),site);
 sourceSHA256[name]=createHash('sha256').update(readFileSync(url)).digest('hex');
}
sourceSHA256.bonanza=createHash('sha256').update(readFileSync(bonanzaURL)).digest('hex');
const report={passed:failures.length===0,checks,candidate,auditSkipped:skipAudit,seed,sourceSHA256,scenarios:auditRows,freeReels,stickyHolds,selections,collectionTypes:[...collectionTypes].sort(),failures};
if(process.argv.includes('--report'))writeFileSync(new URL('./mask-slot-integration-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(failures.length)process.exitCode=1;
