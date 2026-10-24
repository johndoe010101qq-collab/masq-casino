import React,{useState} from 'react';
import {SLOT_AUTO_BALANCE} from './slot-playback-controller.js';
import {adjustedStake} from './stake-limits.js';
import './DoghouseReference.css';
const money=value=>new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
function SpinIcon(){return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 25a22 22 0 0 1 37-10l5-5v22H32l7-7a11 11 0 0 0-18 3zM52 39a22 22 0 0 1-37 10l-5 5V32h22l-7 7a11 11 0 0 0 18-3z" fill="currentColor"/></svg>;}
function Coin(){return <span className="dog-coin" aria-hidden="true">◉</span>;}
export default function DoghouseControls({stake,onStakeChange,balance,locked,busy,ready,validStake,limits,
 onSpin,onSkip,onInfo,onShop,controls,bonusMode,onCancelBonus,error}){
 const [menu,setMenu]=useState(null),[count,setCount]=useState(10);
 const disabled=locked||!ready||!validStake;
 function step(direction){onStakeChange(String(adjustedStake(Number(stake)+direction*limits.step,1,balance,limits)));}
 return <div className="doghouse-controls" aria-label="Управление слотом">
  <button className="dog-info" type="button" aria-label="Информация и правила" onClick={onInfo}>i</button>
  <div className="dog-credit" aria-label={'Демонстрационный баланс '+money(balance)+' АР'}><span>БАЛАНС</span><strong><Coin/>{money(balance)}</strong></div>
  <div className="dog-stake"><span>СТАВКА</span><button type="button" disabled={locked} aria-expanded={menu==='stake'} onClick={()=>setMenu(menu==='stake'?null:'stake')} aria-label="Настроить ставку"><Coin/>{money(Number(stake))}<small>✎</small></button></div>
  <button type="button" className="dog-spin" aria-label={busy?'Пропустить анимацию':'Спин'} disabled={!busy&&(disabled||balance<Number(stake))} onClick={busy?onSkip:onSpin}><SpinIcon/></button>
  <button type="button" className="dog-minus" aria-label="Уменьшить ставку" disabled={locked||Number(stake)<=limits.min} onClick={()=>step(-1)}>−</button>
  <button type="button" className="dog-plus" aria-label="Увеличить ставку" disabled={locked||Number(stake)>=limits.max} onClick={()=>step(1)}>+</button>
  <div className="dog-auto"><button type="button" className="dog-turbo" aria-label="Турбо" aria-pressed={controls.speed===2} onClick={()=>controls.setSpeed(controls.speed===2?1:2)}>»</button><button type="button" className="dog-auto-label" aria-expanded={menu==='auto'} disabled={disabled&&!controls.active} onClick={()=>{if(controls.active){controls.stopAutoplay();setMenu(null);}else setMenu(menu==='auto'?null:'auto');}}>{controls.active?'СТОП':'АВТОИГРА'}</button></div>
  {bonusMode&&<button type="button" className="dog-bonus-active" onClick={onCancelBonus}>БОНУС ВКЛЮЧЁН · ОТМЕНИТЬ</button>}
  {menu&&<div className={'dog-popup dog-popup--'+menu} role="dialog" aria-label={menu==='stake'?'Настройки ставки':'Автоигра'}><button className="dog-popup-close" onClick={()=>setMenu(null)} aria-label="Закрыть настройки">×</button>
   {menu==='stake'?<><h3>Ставка</h3><label>Сумма, АР<input type="number" min={limits.min} max={limits.max} step={limits.step} value={stake} disabled={locked} onChange={e=>onStakeChange(e.target.value)}/></label><div className="dog-popup-steps"><button disabled={locked} onClick={()=>step(-1)}>−</button><button disabled={locked} onClick={()=>step(1)}>+</button></div><button disabled={locked||!ready||!validStake} onClick={()=>{setMenu(null);onShop();}}>Купить бонус</button></>
   :<><h3>Автоигра</h3><label>Вращения<select value={count} onChange={e=>setCount(e.target.value===SLOT_AUTO_BALANCE?SLOT_AUTO_BALANCE:Number(e.target.value))}>{[10,25,50].map(n=><option key={n} value={n}>{n}</option>)}<option value={SLOT_AUTO_BALANCE}>До конца баланса</option></select></label><button disabled={disabled} onClick={()=>{setMenu(null);controls.startAutoplay(count);}}>НАЧАТЬ</button></>}
  </div>}
  {error&&<p className="dog-error" role="alert">{error}</p>}
 </div>;
}
