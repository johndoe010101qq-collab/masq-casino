import React,{useEffect,useId,useRef,useState} from 'react';
import {ADMIN_GAMES,ADMIN_DEFAULTS,settingsFromSnapshot,validateAdminDraft,draftChanges} from './demo-admin-controls.js';
import './DemoAdminPanel.css';
import './ServerAdminPanel.css';
import ServerRewardPanel from './ServerRewardPanel.jsx';

const ALL_CONTROLS={rtpProfiles:true,classicRtpProfiles:true,stakeLimits:true,presentation:true};
const groups=[['slots','Слоты'],['classic','Настольные игры'],['presentation','Звук и анимация']];
const format=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value);
const timestamp=value=>Number.isFinite(new Date(value).getTime())?new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short'}).format(value):'Дата недоступна';

function RangeField({id,label,value,min,max,step=1,suffix='',disabled,onChange}) {
  const numeric=Number(value),usable=Number.isFinite(numeric)?Math.min(max,Math.max(min,numeric)):min;
  return <div className="demo-admin-range-field">
    <div className="demo-admin-field-heading"><label htmlFor={id}>{label}</label><div className="demo-admin-number-wrap"><input id={id} type="number" min={min} max={max} step={step} value={value} disabled={disabled} onChange={event=>onChange(event.target.value)}/><span aria-hidden="true">{suffix}</span></div></div>
    <input id={`${id}-range`} type="range" aria-label={`${label} — ползунок`} min={min} max={max} step={step} value={usable} disabled={disabled} onChange={event=>onChange(Number(event.target.value))}/>
    <div className="demo-admin-range-endpoints" aria-hidden="true"><span>{format(min)}{suffix}</span><span>{format(max)}{suffix}</span></div>
  </div>;
}

function ProfileEvidence({details,target}) {
  const exact=details?.kind==='exact'&&Number.isFinite(details.expectedGrossReturn);
  return <div className="demo-admin-evidence"><span>{exact?'Возврат по распределению':'Целевой профиль'}</span><strong>{exact?`${format(details.expectedGrossReturn*100)}%`:`≈${target}%`}</strong>
    <p>{details?.rule||'Профиль — общий вариант математики. Короткая серия и отдельный раунд могут сильно отличаться от среднего возврата.'}</p>
    {details?.revision&&<small className="demo-admin-source">Версия математики: {details.revision}</small>}
    <p className="server-admin-runtime-note">Это конфигурация на сервере. В текущей версии игровые раунды остаются локальными; этот профиль ещё не применяется игровым сервером.</p>
  </div>;
}

// This panel edits persistent global configuration through the authenticated
// API. It deliberately never receives HallSession or writes a player balance.
export default function ServerAdminPanel({client,onClose,getProfileDetails,onSessionExpired}) {
  const uid=useId().replaceAll(':',''),dialog=useRef(null),close=useRef(null),alive=useRef(false),controller=useRef(null),saving=useRef(false),auditRequest=useRef(0);
  const [active,setActive]=useState(null),[draft,setDraft]=useState(null),[baseRevision,setBaseRevision]=useState(null);
  const [group,setGroup]=useState('slots'),[gameId,setGameId]=useState('slots'),[reason,setReason]=useState('');
  const [loading,setLoading]=useState(true),[pending,setPending]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [audit,setAudit]=useState([]),[auditError,setAuditError]=useState(''),[auditLoading,setAuditLoading]=useState(false);
  const status=client.getStatus(),canWrite=status.capabilities.includes('settings:write'),canAudit=status.capabilities.includes('audit:read');
  const locked=loading||pending||!canWrite,stale=active&&baseRevision!==active.revision;
  const selected=ADMIN_GAMES.find(game=>game.id===gameId)||ADMIN_GAMES[0],profileKey=selected.group==='slots'?'rtpProfiles':'classicRtpProfiles';
  const changes=active&&draft?draftChanges(active.settings,draft,ALL_CONTROLS):[];
  let details=null;
  try {if(draft&&getProfileDetails)details=getProfileDetails(selected.id,Number(draft[profileKey][selected.id]));} catch {details=null;}

  function reportFailure(failure) {
    if(!alive.current||failure?.code==='ABORTED')return;
    setError(failure?.message||'Не удалось загрузить настройки.');
    if(failure?.status===401)onSessionExpired?.();
  }
  async function refreshAudit(signal) {
    if(!canAudit)return;
    const requestId=++auditRequest.current;if(alive.current)setAuditLoading(true);
    try {const result=await client.getAudit({limit:50,signal});if(alive.current&&requestId===auditRequest.current){setAudit(result.entries);setAuditError('');}}
    catch(failure){if(alive.current&&requestId===auditRequest.current&&failure?.code!=='ABORTED'){
      setAuditError(failure?.message||'Журнал временно недоступен.');if(failure?.status===401)reportFailure(failure);
    }}
    finally {if(alive.current&&requestId===auditRequest.current)setAuditLoading(false);}
  }
  useEffect(()=>{
    alive.current=true;const requestController=new AbortController();controller.current=requestController;
    const previous=document.activeElement,node=dialog.current;
    if(!node.open)node.showModal();close.current?.focus();
    (async()=>{
      try {
        const result=await client.getSettings({signal:requestController.signal});
        if(alive.current){setActive(result);setDraft(settingsFromSnapshot(result.settings));setBaseRevision(result.revision);}
      } catch(failure){reportFailure(failure);}
      finally {if(alive.current)setLoading(false);}
    })();
    refreshAudit(requestController.signal);
    return()=>{
      alive.current=false;requestController.abort();if(node.open)node.close();
      queueMicrotask(()=>{if(previous instanceof HTMLElement&&previous.isConnected&&!previous.matches(':disabled'))previous.focus();});
    };
  },[client]);

  function update(callback) {setDraft(callback);setError('');setMessage('');}
  function chooseGroup(next) {setGroup(next);if(next!=='presentation')setGameId(ADMIN_GAMES.find(game=>game.group===next).id);}
  function discard() {
    if(!active)return;setDraft(settingsFromSnapshot(active.settings));setBaseRevision(active.revision);setReason('');setError('');setMessage('');
  }
  async function reloadSettings() {
    if(pending||loading)return;setLoading(true);setError('');setMessage('');
    try {
      const result=await client.getSettings({signal:controller.current.signal});
      if(!alive.current)return;
      setActive(result);
      if(!draft||!changes.length){setDraft(settingsFromSnapshot(result.settings));setBaseRevision(result.revision);}
    } catch(failure){reportFailure(failure);}
    finally {if(alive.current)setLoading(false);}
    await refreshAudit(controller.current.signal);
  }
  async function apply(event) {
    event.preventDefault();if(saving.current||locked||stale||!changes.length)return;
    const trimmedReason=reason.trim();
    if(!trimmedReason){setError('Укажите причину изменения для журнала.');return;}
    let settings;
    try {settings=validateAdminDraft(draft);} catch(failure){setError(failure.message);return;}
    saving.current=true;setPending(true);setError('');setMessage('');
    try {
      const result=await client.saveSettings({expectedRevision:baseRevision,settings,reason:trimmedReason},{signal:controller.current.signal});
      if(!alive.current)return;
      setActive(result);setDraft(settingsFromSnapshot(result.settings));setBaseRevision(result.revision);setReason('');
      setMessage(result.changed===false?'Настройки уже совпадают с сохранённой версией.':`Настройки сохранены на сервере. Версия ${result.revision}.`);
      await refreshAudit(controller.current.signal);
    } catch(failure){
      reportFailure(failure);
      if(failure?.status===409){
        try {const latest=await client.getSettings({signal:controller.current.signal});if(alive.current)setActive(latest);}
        catch(refreshFailure){reportFailure(refreshFailure);}
      }
    } finally {saving.current=false;if(alive.current)setPending(false);}
  }

  async function signOut() {
    if(pending)return;
    setPending(true);
    try {await client.revokeSession();}
    catch { /* The credential is cleared even when revocation cannot reach the server. */ }
    finally {client.logout();onSessionExpired?.();onClose();}
  }

  return <dialog ref={dialog} className="demo-admin-panel server-admin-panel" aria-labelledby={`${uid}-title`} onCancel={event=>{event.preventDefault();if(!pending)onClose();}} onClick={event=>{if(event.target===dialog.current&&!pending)onClose();}}>
    <header className="demo-admin-header"><div><span className="demo-admin-kicker">MASQ · Серверное управление</span><h2 id={`${uid}-title`}>Панель администратора</h2><p>Общие настройки и журнал изменений.</p></div><button ref={close} type="button" className="demo-admin-close" disabled={pending} aria-label="Закрыть панель администратора" onClick={onClose}>×</button></header>
    <div className="demo-admin-session-line"><span><i aria-hidden="true"/>{status.profile?.username||'Администратор'} · {active?`Версия ${active.revision}`:'Загрузка версии'}</span><span>Настройки хранятся на сервере</span></div>
    <div className="server-admin-signout"><button type="button" className="demo-admin-discard" disabled={pending} onClick={signOut}>Выйти из управления</button></div>
    <p className="server-admin-status-note">Игровой сервер и платежи ещё не подключены. Реальные АР недоступны.</p>
    {!canWrite&&<p className="server-admin-status-note">Ваш сеанс позволяет только просматривать настройки.</p>}
    {loading&&<p className="server-admin-loading" role="status">Загружаем настройки…</p>}
    {!draft&&error&&<div className="server-admin-load-error"><p className="demo-admin-error" role="alert">{error}</p><button type="button" className="demo-admin-discard" disabled={loading} onClick={reloadSettings}>Повторить загрузку</button></div>}
    {draft&&<>
      <nav className="demo-admin-tabs" aria-label="Разделы настроек">{groups.map(([id,label])=><button key={id} type="button" aria-pressed={group===id} className={group===id?'selected':''} onClick={()=>chooseGroup(id)}>{label}</button>)}</nav>
      <form onSubmit={apply} noValidate>
        {group!=='presentation'?<div className="demo-admin-workspace">
          <nav className="demo-admin-game-picker" aria-label="Выбор игры">{ADMIN_GAMES.filter(game=>game.group===group).map(game=>{
            const key=game.group==='slots'?'rtpProfiles':'classicRtpProfiles';
            return <button key={game.id} type="button" className={game.id===selected.id?'selected':''} aria-pressed={game.id===selected.id} onClick={()=>setGameId(game.id)}><span>{game.name}{Number(draft[key][game.id])!==active.settings[key][game.id]&&<i aria-label="Есть изменения"/>}</span><small>≈{draft[key][game.id]}%<span aria-hidden="true">›</span></small></button>;
          })}</nav>
          <section className="demo-admin-game-settings" aria-labelledby={`${uid}-game`}><div className="demo-admin-game-title"><h3 id={`${uid}-game`}>{selected.name}</h3><span>Сохранено: {active.settings[profileKey][selected.id]}%</span></div>
            <fieldset disabled={locked}><legend>Возврат игроку · RTP</legend><RangeField id={`${uid}-rtp`} label="Целевой возврат" min={50} max={95} step={1} suffix="%" value={draft[profileKey][selected.id]} disabled={locked} onChange={value=>update(previous=>({...previous,[profileKey]:{...previous[profileKey],[selected.id]:value}}))}/><small>50–95%, шаг 1%. Один открытый профиль для всех игроков.</small></fieldset>
            <ProfileEvidence details={details} target={draft[profileKey][selected.id]}/>
            <fieldset className="demo-admin-stake-controls" disabled={locked}><legend>Пределы базовой ставки</legend><div className="demo-admin-stake-grid">{[['min','Минимум'],['max','Максимум']].map(([field,label])=><RangeField key={field} id={`${uid}-${field}`} label={label} value={draft.stakeLimits[selected.id][field]} min={5} max={selected.maxStake} step={5} suffix=" АР" disabled={locked} onChange={value=>update(previous=>({...previous,stakeLimits:{...previous.stakeLimits,[selected.id]:{...previous.stakeLimits[selected.id],[field]:value}}}))}/>)}</div><small>Шаг 5 АР. Верхний предел движка — {selected.maxStake} АР. Для бонусов и особых спинов полная цена считается отдельно.</small></fieldset>
          </section>
        </div>:<section className="demo-admin-presentation"><div className="demo-admin-game-title"><h3>Звук и анимация</h3><span>Общие настройки</span></div><fieldset disabled={locked}><legend>Скорость показа</legend><div className="demo-admin-speed-presets">{[1,1.5,2].map(speed=><label key={speed} className={Number(draft.presentation.speed)===speed?'selected':''}><input type="radio" name={`${uid}-speed`} checked={Number(draft.presentation.speed)===speed} onChange={()=>update(previous=>({...previous,presentation:{...previous.presentation,speed}}))}/><strong>×{format(speed)}</strong><small>{speed===1?'Обычный':speed===1.5?'Быстрый':'Турбо'}</small></label>)}</div></fieldset><div className="demo-admin-volume-grid">{[['sfxVolume','Громкость эффектов'],['musicVolume','Громкость музыки']].map(([field,label])=><RangeField key={field} id={`${uid}-${field}`} label={label} value={draft.presentation[field]} min={0} max={100} suffix="%" disabled={locked} onChange={value=>update(previous=>({...previous,presentation:{...previous.presentation,[field]:value}}))}/>)}</div></section>}
        <div className="demo-admin-apply-area">
          {stale&&<div className="demo-admin-stale" role="alert"><p>На сервере появилась версия {active.revision}. Ваш черновик сохранён. Проверьте изменения относительно новой версии.</p><button type="button" disabled={pending||loading} onClick={()=>{setBaseRevision(active.revision);setError('');setMessage('Версия обновлена. Проверьте черновик и причину перед сохранением.');}}>Продолжить с версией {active.revision}</button></div>}
          {!!changes.length&&<details className="demo-admin-change-preview" open><summary>Изменений: {changes.length}</summary><ul>{changes.map(change=><li key={change}>{change}</li>)}</ul></details>}
          <label className="server-admin-reason" htmlFor={`${uid}-reason`}>Причина изменения<input id={`${uid}-reason`} type="text" maxLength={500} disabled={locked} value={reason} onChange={event=>setReason(event.target.value)} placeholder="Например: обновление общего профиля"/></label>
          {error&&<p className="demo-admin-error" role="alert">{error}</p>}{message&&<p className="demo-admin-success" role="status">{message}</p>}
          <div className="demo-admin-actions"><button className="demo-admin-reset" type="button" disabled={locked} onClick={()=>update(()=>settingsFromSnapshot(ADMIN_DEFAULTS))}>Значения по умолчанию</button><button className="demo-admin-discard" type="button" disabled={loading||pending} onClick={reloadSettings}>Обновить с сервера</button><button className="demo-admin-discard" type="button" disabled={locked||!changes.length} onClick={discard}>Сбросить черновик</button><button className="demo-admin-apply" type="submit" disabled={locked||stale||!changes.length||!reason.trim()}>{pending?'Сохраняем…':'Сохранить на сервере'}</button></div>
          <p className="demo-admin-apply-note">Изменение сохраняется целиком с проверкой версии и записью в журнал. Балансы и исходы уже принятых раундов эта панель не меняет.</p>
        </div>
      </form>
    </>}
    {draft&&<ServerRewardPanel client={client} onSessionExpired={onSessionExpired}/>}
    {canAudit&&<section className="server-admin-audit" aria-labelledby={`${uid}-audit`}><div className="server-admin-audit-heading"><h3 id={`${uid}-audit`}>Журнал изменений</h3><button type="button" disabled={pending||loading||auditLoading} onClick={()=>refreshAudit(controller.current.signal)}>{auditLoading?'Загрузка…':'Обновить'}</button></div>{auditError&&<p className="demo-admin-error" role="alert">{auditError}</p>}{!auditLoading&&!auditError&&!audit.length&&<p>Изменений пока нет.</p>}<ol>{audit.map(entry=><li key={entry.id}><div><strong>Версия {entry.revision}</strong><time dateTime={new Date(entry.createdAt).toISOString()}>{timestamp(entry.createdAt)}</time></div><p>{entry.reason}</p><small>{entry.actor.username}</small><details><summary>Что изменилось</summary><ul>{draftChanges(entry.before,entry.after,ALL_CONTROLS).map(change=><li key={change}>{change}</li>)}</ul></details></li>)}</ol></section>}
    <p className="demo-admin-limit">Доступ проверяется сервером по учётной записи SP Worlds и списку разрешённых администраторов. Адрес страницы сам по себе не даёт права изменить настройки.</p>
  </dialog>;
}
