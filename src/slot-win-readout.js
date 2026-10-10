const cents=value=>Number.isSafeInteger(value)&&value>0?value:0;
const paid=win=>cents(win.creditedPayoutCents??win.payoutCents);
export function slotWinReadout(visual={},game='maskhouse') {
  const totalCents=cents(visual.creditedTotalPayoutCents??visual.shownPayoutCents??visual.totalPayoutCents);
  const wins=visual.creditedPayoutCents===0?[]:(visual.wins||[]).filter(win=>paid(win)>0);
  const line=visual.creditedPayoutCents!==0&&visual.activeLine&&paid(visual.activeLine)>0?visual.activeLine:null;
  const selected=line||wins.find(win=>!win.collectionType&&win.kind!=='bonus-payment');
  const symbols=selected?(selected.cells||[]).slice(0,5).map(({column,row})=>{
    const cell=visual.grid?.[column]?.[row];
    return {kind:cell?.kind||selected.kind,value:cell?.kind==='wild'?cell.value:null};
  }):[];
  let detail='',detailCents=0;
  if(visual.phase==='bonus-payment') {detail='Бонусная выплата';detailCents=cents(visual.creditedBonusPaymentCents??visual.bonusPaymentCents);}
  else if(line) {detail=`Линия ${line.line+1} платит`;detailCents=paid(line);}
  else if(visual.phase==='collect') {detail='Сбор золотых ячеек';detailCents=cents(visual.creditedFeaturePayoutCents??visual.featurePayoutCents);}
  else if(wins.length) {const lines=wins.filter(win=>Number.isInteger(win.line)).length;detail=game==='maskhouse'?(lines?`${lines} выигрышных линий`:'Выигрыш за символы'):'Выигрышные группы';detailCents=wins.reduce((sum,win)=>sum+paid(win),0);}
  // Only actual credited wins carry icons. A zero-budget nominal combination
  // cannot animate or become a winning line in the readout.
  return Object.freeze({totalCents,detail,detailCents,symbols:detailCents>0?symbols:[],winning:detailCents>0});
}
