import React from 'react';
import { STANDARD_STAKE_LIMITS, adjustedStake } from './stake-limits.js';
import './SlotDock.css';
import { MasqMark } from './MasqIdentity.jsx';

const money = n => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
export default function SlotDock({ game, stake, onStakeChange, balance, payout, locked,
  busy, ready, validStake, onSpin, onSkip, onShop, feature = null, error = '', stakeLimits = STANDARD_STAKE_LIMITS }) {
  const theme = game === 'lecipher' ? 'lexof' : game === 'slots' ? 'bonanza' : game;
  return <form className={'slot-dock theme-'+theme} data-busy={busy} aria-label="Управление слотом"
    onSubmit={event=>{event.preventDefault();onSpin();}}>
    <button className="slot-dock-buy" type="button" disabled={locked||!ready||!validStake}
      onClick={onShop}><MasqMark flat/><span className="slot-dock-buy-copy"><strong>{game==='maskhouse'?'Купить бонус':'Бонусы'}</strong><small>{game==='maskhouse'?'Маскарад':'Выбрать режим'}</small></span></button>
    <div className="slot-dock-totals">
    <div className="slot-dock-balance"><span>Баланс</span><strong>{money(balance)} <small>АР</small></strong></div>
    <div className="slot-dock-payout" aria-live="polite"><span>Выплата</span><strong>{money(payout)} <small>АР</small></strong></div></div>
    <div className="slot-dock-stake"><label htmlFor={'stake-'+game}>Ставка <small>АР</small></label><div className="slot-stake-row">
      <button className="slot-stake-step" type="button" aria-label="Уменьшить ставку на 5 АР" disabled={locked||!validStake||Number(stake)<=stakeLimits.min} onClick={()=>onStakeChange(String(Math.max(stakeLimits.min,Number(stake)-stakeLimits.step)))}>−</button>
      <input className="stake-input" id={'stake-'+game} type="number" inputMode="numeric" step={stakeLimits.step} min={stakeLimits.min} max={stakeLimits.max} value={stake} disabled={locked} aria-invalid={!validStake||!!error} aria-describedby={'stake-help-'+game} onChange={e=>onStakeChange(e.target.value)}/>
      <button className="slot-stake-step" type="button" aria-label="Увеличить ставку на 5 АР" disabled={locked||!validStake||Number(stake)>=stakeLimits.max} onClick={()=>onStakeChange(String(Math.min(stakeLimits.max,Number(stake)+stakeLimits.step)))}>+</button>
    </div></div>
    <button className="slot-dock-spin" type="submit" disabled={locked||!ready||!validStake||balance<Number(stake)*(feature?.multiplier||1)} aria-label={busy?'Раунд выполняется':'Прокрутить слот за '+money(Number(stake)*(feature?.multiplier||1))+' АР'}><span className="slot-spin-face"><span className="slot-spin-arrow" aria-hidden="true">↻</span><span className="slot-spin-word">{busy?'Вращение':money(Number(stake)*(feature?.multiplier||1))+' АР'}</span></span></button>
    <div className="slot-dock-tools"><small id={'stake-help-'+game}>{stakeLimits.min}–{stakeLimits.max} АР</small><button type="button" disabled={locked} onClick={()=>onStakeChange(String(adjustedStake(stakeLimits.max,1,balance,stakeLimits)))}>Макс.</button><button className="slot-dock-skip" type="button" disabled={!busy} onClick={onSkip}>Пропустить</button></div>
    {feature&&<div className={'slot-dock-feature'+(feature.persistent?' slot-bonus-mode':'')} role="status"><span>{feature.name} · {feature.persistent?'каждый запуск':'следующий спин'} {money(Number(stake)*feature.multiplier)} АР</span><button type="button" disabled={locked&&!feature.persistent} onClick={feature.onDisable}>{feature.persistent?'Отменить бонус':'Отмена'}</button></div>}
    {error&&<p className="form-error" role="alert">{error}</p>}
  </form>;
}
