import React,{useEffect,useState} from 'react';
import {SLOT_AUTO_BALANCE} from './slot-playback-controller.js';
import {adjustedStake} from './stake-limits.js';
import {CURRENCY,currencyText} from './currency.js';
import './OriginalSlots.css';

export const ORIGINAL_SPEEDS=Object.freeze([{value:1,label:'Обычная'},{value:2,label:'Быстрая'},{value:4,label:'Турбо'}]);
export function SpinArrow(){return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M49 19A23 23 0 1 0 54 42" fill="none" stroke="currentColor" strokeWidth="7"/><path d="m39 18 18 2-7 17z" fill="currentColor"/></svg>;}
const money=n=>new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);

export default function OriginalSlotControls({game,stake,onStakeChange,balance,limits,locked,busy,ready,validStake,
 controls,onSpin,onSkip,onInfo,onShop,bonusMode,onCancelBonus,feature,onFeature,onMenuChange,
 soundEnabled,musicEnabled,onSound,onMusic,error,buyMultiplier}){
 const [menu,setMenu]=useState(null),bandit=game==='lecipher';
 useEffect(()=>{onMenuChange?.(!!menu);return()=>onMenuChange?.(false);},[menu,onMenuChange]);
 const disabled=locked||!ready||!validStake;
 const change=direction=>onStakeChange(String(adjustedStake(Number(stake)+direction*limits.step,1,Infinity,limits)));
 const auto=()=>controls.active?controls.stopAutoplay():controls.startAutoplay(SLOT_AUTO_BALANCE);
 const speed=ORIGINAL_SPEEDS.find(s=>s.value===controls.speed)||ORIGINAL_SPEEDS[0];
 function cycle(){controls.setSpeed(ORIGINAL_SPEEDS[(ORIGINAL_SPEEDS.findIndex(s=>s.value===controls.speed)+1)%ORIGINAL_SPEEDS.length].value);}
 return <div className={'original-controls original-controls--'+game} aria-label="Управление слотом">
  <button className="original-buy" type="button" disabled={disabled||!!bonusMode} onClick={onShop}>{bandit?'КУПИТЬ БОНУС':<>КУПИТЬ<br/>БОНУС<strong>{money(Number(stake)*buyMultiplier)}</strong></>}</button>
  {bandit&&<div className="original-hunt"><span>Ставка <b>{money(Number(stake)*(feature?.multiplier||3))}</b></span><strong>{feature?.id==='rainbow'?<>РАДУЖНЫЙ<br/>СПИН</>:<>ОХОТА<br/>ЗА БОНУСОМ</>}</strong><button type="button" role="switch" aria-checked={!!feature} aria-label="Охота за бонусом" disabled={locked} onClick={onFeature}>{feature?'ВКЛ':'ВЫКЛ'}</button></div>}
  <div className="original-toolbar">
   <button type="button" className="original-menu" aria-label="Меню слота" aria-expanded={menu==='main'} onClick={()=>setMenu(menu==='main'?null:'main')}>☰</button>
   <button type="button" className="original-info" aria-label="Таблица выплат и правила" onClick={onInfo}>i</button>
   <div className="original-credit"><span>БАЛАНС</span><strong>{money(balance)} <small>{CURRENCY}</small></strong></div>
   <button type="button" className="original-stake" disabled={locked} aria-label="Изменить ставку" aria-expanded={menu==='stake'} onClick={()=>setMenu(menu==='stake'?null:'stake')}><span>СТАВКА</span><strong>{money(Number(stake))} <small>{CURRENCY}</small></strong></button>
   <button type="button" className="original-minus" disabled={locked||Number(stake)<=limits.min} aria-label="Уменьшить ставку" onClick={()=>change(-1)}>−</button>
   <button type="button" className="original-spin" disabled={!busy&&(disabled||balance<Number(stake))} aria-label={busy?'Пропустить анимацию':'Спин'} onClick={busy?onSkip:onSpin}><SpinArrow/></button>
   <button type="button" className="original-plus" disabled={locked||Number(stake)>=limits.max} aria-label="Увеличить ставку" onClick={()=>change(1)}>+</button>
   <button type="button" className="original-speed" aria-label={'Скорость: '+speed.label} title={speed.label} onClick={cycle} data-fast={controls.speed>1}>{controls.speed===4?'»»':controls.speed===2?'»':'›'}</button>
   <button type="button" className="original-auto" aria-label={controls.active?'Остановить автоспины':'Автоспины до остановки'} aria-pressed={controls.active} disabled={disabled&&!controls.active} onClick={auto}>{controls.active?'СТОП':bandit?'⟳':'АВТОИГРА'}</button>
  </div>
  {bonusMode&&<button className="original-mode" type="button" onClick={onCancelBonus}>БОНУС ВКЛЮЧЁН · ОТМЕНИТЬ</button>}
  {feature&&<button className="original-feature" type="button" disabled={busy} onClick={feature.onDisable}>FEATURESPINS · {feature.name} · ОТМЕНИТЬ</button>}
  {controls.active&&<span className="original-auto-status" role="status">{controls.status==='paused'?'ПАУЗА':'АВТОИГРА'} · ∞</span>}
  {error&&<p className="original-error" role="alert">{currencyText(error)}</p>}
  {menu&&<div className={'original-popup original-popup--'+menu} role="dialog" aria-label={menu==='main'?'Меню слота':'Настройки ставки'}>
   <button className="original-popup-close" type="button" aria-label="Закрыть меню" onClick={()=>setMenu(null)}>×</button>
   {menu==='main'?<>
    {onSound&&<button type="button" aria-pressed={soundEnabled} onClick={onSound}>ЗВУК <b>{soundEnabled?'ВКЛ':'ВЫКЛ'}</b></button>}
    {onMusic&&<button type="button" aria-pressed={musicEnabled} onClick={onMusic}>МУЗЫКА <b>{musicEnabled?'ВКЛ':'ВЫКЛ'}</b></button>}
    {ORIGINAL_SPEEDS.map(s=><button type="button" key={s.value} aria-pressed={controls.speed===s.value} onClick={()=>controls.setSpeed(s.value)}>{s.label.toUpperCase()} {controls.speed===s.value?'✓':''}</button>)}
    <button type="button" onClick={()=>{setMenu(null);onInfo();}}>ТАБЛИЦА ВЫПЛАТ И ПРАВИЛА</button>
   </>:<><h3>СТАВКА</h3><label>Сумма, {CURRENCY}<input type="number" value={stake} min={limits.min} max={limits.max} step={limits.step} disabled={locked} onChange={e=>onStakeChange(e.target.value)}/></label><div className="original-stake-picks">{Array.from({length:Math.min(12,Math.floor((limits.max-limits.min)/limits.step)+1)},(_,i)=>limits.min+i*limits.step).map(n=><button type="button" key={n} disabled={locked} aria-pressed={Number(stake)===n} onClick={()=>onStakeChange(String(n))}>{n}</button>)}</div><button type="button" className="original-done" onClick={()=>setMenu(null)}>ГОТОВО</button></>}
  </div>}
 </div>;
}
