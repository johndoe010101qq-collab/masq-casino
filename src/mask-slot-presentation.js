// A presentation timeline consumes the immutable result; it never generates it.
export function maskSlotSteps(round,openingGrid=null,{originalUi=false}={}) {
 const steps=[];let free=round.initialFreeSpins||0,credited=0,serial=0;
 const add=(visual,ms)=>steps.push({...visual,ms,serial:++serial,...(visual.phase==='reel'?{reelDurationMs:1600,reelDelayMs:40}:{})});
 let previous=openingGrid,previousGold=[],activeTier=round.bonusPurchaseTier||null,cellPayouts=[];
 const intro=(grid,goldenCells,added,bonusSelection=[])=>{
  const common={grid,wins:[],goldenCells,freeRemaining:free,added,totalPayoutCents:credited,bonusTier:activeTier};
  if(bonusSelection.length)for(let revealed=1;revealed<=bonusSelection.length;revealed++)add({...common,phase:'bonus-selection',bonusSelection,revealed,selectionTotal:bonusSelection.slice(0,revealed).reduce((sum,n)=>sum+n,0)},revealed===bonusSelection.length?920:260);
  add({...common,phase:'bonus'},1800);
 };
 if(round.mode==='buy')intro(openingGrid||round.spins[0].initial,[],free,round.bonusSelection);
 for(const spin of round.spins) {
  cellPayouts=[];
  const common={freeRemaining:free,totalPayoutCents:credited,freeSpin:spin.freeSpin,bonusTier:activeTier};
  let presented=0;
  add({...common,phase:'reel',grid:spin.initial,previous,goldenCells:spin.freeSpin?previousGold:[],wins:[]},1900);
  for(const frame of spin.frames) {
   common.shownPayoutCents=credited+presented;
   if(frame.phase==='bonus-payment') {
    presented+=frame.payoutCents;
    add({...common,phase:'bonus-payment',grid:frame.after,goldenCells:frame.goldenCells,wins:[],cellPayouts,bonusPaymentCents:frame.payoutCents,shownPayoutCents:credited+presented},1900);
    continue;
   }
   if(frame.phase==='collect') {
    const collectionCells=frame.after.flatMap((column,c)=>column.flatMap((cell,r)=>cell.coin?[{column:c,row:r,type:cell.collectionType}]:[]));
    const feature={...common,goldenCells:frame.goldenCells,clovers:frame.clovers||[],pots:frame.pots||[],collectionCells,collectionIndex:frame.collectionIndex};
    if(!frame.collectionIndex)add({...feature,phase:'decode',grid:frame.before,wins:[]},1000);
    add({...feature,phase:'reveal-coins',grid:frame.after,wins:[],coinPreviewPayouts:maskCollectionPayouts(frame)},1600);
    if(feature.clovers.length)add({...feature,phase:'boost',grid:frame.after,wins:[],coinPreviewPayouts:maskCollectionPayouts(frame)},1100);
    for(const pot of feature.pots)add({...feature,phase:'collector',grid:frame.after,wins:[],activeCollector:pot,coinPreviewPayouts:maskCollectionPayouts(frame)},650);
    cellPayouts=maskCollectionPayouts(frame);presented+=frame.payoutCents;
    add({...feature,phase:'collect',grid:frame.after,wins:frame.wins,cellPayouts,featurePayoutCents:frame.payoutCents,shownPayoutCents:credited+presented},1900);
    continue;
   }
   if(frame.wins.length) {
    presented+=frame.payoutCents;
    add({...common,phase:'win',grid:frame.before,goldenCells:frame.goldenCells,wins:frame.wins,shownPayoutCents:credited+presented},1500);
    if(round.game==='maskhouse')for(const win of frame.wins.filter(w=>Number.isInteger(w.line)).slice(0,3))add({...common,phase:'payline',grid:frame.before,goldenCells:frame.goldenCells,wins:[win],activeLine:win,shownPayoutCents:credited+presented},850);
   }
   if(frame.phase==='cascade'&&frame.removed?.length)add({...common,phase:'remove',grid:frame.before,goldenCells:frame.goldenCells,wins:[],removedCells:frame.removed,shownPayoutCents:credited+presented},650);
   if(frame.phase==='cascade'&&frame.after.flat().some((cell,index)=>cell.id!==frame.before.flat()[index].id))add({...common,phase:'cascade',grid:frame.after,previous:frame.before,goldenCells:frame.goldenCells,wins:[],cascadeCells:maskCascadeCells(frame.before,frame.after),shownPayoutCents:credited+presented},1200);
  }
  credited+=spin.payoutCents;
  if(spin.freeSpin)free--;
  free+=spin.awardedSpins;
  if(spin.awardedTier)activeTier=spin.awardedTier;
  add({phase:'summary',grid:spin.terminal,wins:[],cellPayouts,goldenCells:spin.goldenCells,freeRemaining:free,totalPayoutCents:credited,spinPayoutCents:spin.payoutCents,freeSpin:spin.freeSpin,bonusTier:activeTier},1000);
  const gift=spin.profileExtraSpinsAwarded||0;
  const natural=spin.naturalAwardedSpins??(spin.awardedSpins-gift);
  if(natural){add({phase:'scatter',grid:spin.terminal,wins:[],goldenCells:spin.goldenCells,freeRemaining:free,totalPayoutCents:credited},1000);intro(spin.terminal,spin.goldenCells,natural,spin.bonusSelection);}
  if(gift)add({phase:'profile-gift',grid:spin.terminal,wins:[],goldenCells:spin.goldenCells,freeRemaining:free,added:gift,totalPayoutCents:credited,bonusTier:activeTier},1800);
  previous=spin.terminal;previousGold=spin.goldenCells;
 }
 if(originalUi&&round.spins.some(spin=>spin.freeSpin))add({phase:'bonus-summary',grid:round.spins.at(-1).terminal,wins:[],cellPayouts,goldenCells:round.spins.at(-1).goldenCells,freeRemaining:0,totalPayoutCents:round.payoutCents,bonusTier:activeTier,freeSpinsPlayed:round.spins.filter(spin=>spin.freeSpin).length},2400);
 return {steps,terminal:{phase:'settled',grid:round.spins.at(-1).terminal,wins:[],cellPayouts,goldenCells:round.spins.at(-1).goldenCells,freeRemaining:0,totalPayoutCents:round.payoutCents,capped:round.capReached,bonusTier:activeTier},duration:steps.reduce((sum,s)=>sum+s.ms,0)};
}

// Labels describe the credited portion, never an unclipped nominal coin value.
export function maskCollectionPayouts(frame) {
 return frame.wins.filter(win=>['coin','collector'].includes(win.collectionType)).flatMap(win=>win.cells.map(({column,row})=>({id:frame.after[column][row].id,payoutCents:win.payoutCents})));
}

// Coordinates are derived only from immutable engine IDs. Symbols that keep
// their cell get zero offset and no animation; only gravity/refills move.
export function maskCascadeCells(before,after) {
 return after.flatMap((column,c)=>{const refills=column.filter(cell=>!before[c].some(previous=>previous.id===cell.id)).length;return column.map((cell,r)=>{
  const oldRow=before[c].findIndex(previous=>previous.id===cell.id);
  return Object.freeze({id:cell.id,column:c,row:r,fromRow:oldRow,
   offsetRows:oldRow<0?-refills:oldRow-r,moving:oldRow!==r});
 });});
}

// Reel foley belongs to a single visual spin, never the entire bonus session.
// Ending the previous reel also cancels late audio unlock callbacks on skip.
export function maskSlotStepAudio(audio,step,previous=null) {
 if(previous?.phase==='reel')audio?.endRound();
 if(step.phase==='reel') {
  audio?.beginRound(step.game||'maskhouse',{durationMs:step.ms});
  return;
 }
 const effect=step.phase==='win'?'cascade':step.phase==='bonus-payment'?'receipt':step.phase==='bonus-selection'?(previous?.phase==='bonus-selection'?'pin':'bonus'):['bonus','profile-gift'].includes(step.phase)?'bonus':['collect','decode','scatter'].includes(step.phase)?'scatter':step.phase==='boost'?'multiplier':step.phase==='collector'?'fall':null;
 if(effect)audio?.play(effect);
}
