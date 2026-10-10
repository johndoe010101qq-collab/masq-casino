import React,{useId,useState} from 'react';
import {SLOT_AUTO_BALANCE,SLOT_AUTO_COUNTS,SLOT_PLAYBACK_SPEEDS} from './slot-playback-controller.js';
import './SlotPlaybackOptions.css';

export default function SlotPlaybackOptions({controls,disabled=false,autoAllowed=true,game}) {
  const [count,setCount]=useState(10),selectId=useId();
  const c=controls,theme=game==='lecipher'?'lexof':game==='slots'?'bonanza':game;
  return <div className={'slot-playback-options theme-'+theme}>
    <div className="slot-playback-speed" role="group" aria-label="Скорость анимации со следующего спина">
      <span>Скорость</span>{SLOT_PLAYBACK_SPEEDS.map(speed=><button type="button" key={speed}
        aria-pressed={c.speed===speed} onClick={()=>c.setSpeed(speed)}>×{String(speed).replace('.',',')}</button>)}
    </div>
    <div className="slot-playback-auto"><label htmlFor={selectId}>Автоспины</label>
      <select id={selectId} value={count} disabled={disabled||!autoAllowed||c.active} onChange={e=>setCount(e.target.value===SLOT_AUTO_BALANCE?SLOT_AUTO_BALANCE:Number(e.target.value))}>
        {SLOT_AUTO_COUNTS.map(n=><option key={n} value={n}>{n}</option>)}
        <option value={SLOT_AUTO_BALANCE}>До конца баланса</option>
      </select>
      {c.active?<button className="slot-auto-stop" type="button" onClick={c.stopAutoplay}>Стоп</button>
        :<button type="button" disabled={disabled||!autoAllowed} onClick={()=>c.startAutoplay(count)}>Запустить</button>}
      {c.active&&<small role="status" aria-live="polite">{c.remaining===null?(c.status==='paused'?'Пауза · до конца баланса':'Спинов: '+c.accepted):c.remaining===0?'Последний спин':c.status==='paused'?'Пауза · осталось '+c.remaining:'Осталось '+c.remaining}</small>}
      {!c.active&&c.status==='unavailable'&&<small role="status">Недостаточно средств для следующего спина</small>}
    </div>
  </div>;
}
