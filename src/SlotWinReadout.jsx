import React from 'react';
import {slotWinReadout} from './slot-win-readout.js';
import './SlotWinReadout.css';
const money=cents=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(cents/100);
export default function SlotWinReadout({visual,game,atlas}) {
  const readout=slotWinReadout(visual,game);
  return <div className="slot-win-readout" data-winning={readout.winning} role="status" aria-live="polite">
    <div className="slot-win-total"><span>Выигрыш</span><strong key={readout.totalCents}>{money(readout.totalCents)} <small>АР</small></strong></div>
    <div className="slot-win-detail">
      {readout.winning?<>
        {atlas&&readout.symbols.length>0&&<span className="slot-win-symbols" aria-hidden="true">{readout.symbols.map((symbol,index)=>{
          const cell=atlas.indices[symbol.kind];
          return <span key={index} className="slot-win-mini" style={{backgroundImage:`url('${atlas.url}')`,backgroundPosition:`${cell%4/3*100}% ${Math.floor(cell/4)/2*100}%`}}>{symbol.value&&<b>×{symbol.value}</b>}</span>;
        })}</span>}
        <span>{readout.detail} <b>{money(readout.detailCents)} АР</b></span>
      </>:<span className="slot-win-caption">{visual.phase==='idle'?'Выберите ставку и вращайте':visual.phase==='settled'?'Итог раунда':visual.phase==='reel'?'Вращение барабанов':'Продолжение раунда'}</span>}
    </div>
  </div>;
}
