import {CURRENCY,currencyText} from './currency.js';
import React,{useEffect,useId,useRef,useState} from 'react';
import {ADMIN_GAMES,ADMIN_DEFAULTS,settingsFromSnapshot,validateAdminDraft,draftChanges} from './demo-admin-controls.js';
import './DemoAdminPanel.css';

const format=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value);
const percentage=value=>Number.isFinite(value)?`${format(value)}%`:'Нет согласованной оценки';
const groups=[['slots','Слоты','03'],['classic','Настольные игры','06'],['presentation','Звук и анимация',null]];

function RangeField({id,label,value,min,max,step=1,suffix='',disabled,onChange,description}) {
  const usable=Number.isFinite(Number(value))?Number(value):min;
  return <div className="demo-admin-range-field">
    <div className="demo-admin-field-heading"><label htmlFor={id}>{label}</label><div className="demo-admin-number-wrap"><input id={id} type="number" inputMode="decimal" min={min} max={max} step={step} value={value} disabled={disabled} aria-describedby={description?`${id}-help`:undefined} onChange={event=>onChange(event.target.value)}/><span aria-hidden="true">{suffix}</span></div></div>
    <input id={`${id}-slider`} type="range" aria-label={`${label} — ползунок`} aria-describedby={description?`${id}-help`:undefined} min={min} max={max} step={step} value={Math.max(min,Math.min(max,usable))} disabled={disabled} onChange={event=>onChange(Number(event.target.value))}/>
    <div className="demo-admin-range-endpoints" aria-hidden="true"><span>{format(min)}{suffix}</span><span>{format(max)}{suffix}</span></div>
    {description&&<small id={`${id}-help`}>{description}</small>}
  </div>;
}

function ProfileEvidence({details,game,target}) {
  if(!details)return <details className="demo-admin-evidence"><summary><span>Математика и измерения<small>Ориентир профиля · ≈{target}%</small></span></summary><div className="demo-admin-evidence-body"><p>Для этой версии нет согласованной оценки в панели. Перед применением проверьте измерения в «Правилах шансов».</p></div></details>;
  const exact=details.kind==='exact'&&Number.isFinite(details.expectedGrossReturn),offers=[...(details.offers||[])];
  if(!offers.length&&details.measurements)for(const [id,name] of [['basic_hit_stand','Базовая стратегия Hit / Stand'],['hit_below_17','Добор до 17']]){
    const sample=details.measurements[id];
    if(sample)offers.push({id,name,meanPercent:sample.returnPercent,ciPercent:sample.return95CI_Percent,samples:sample.hands??details.measurements.handsPerStrategy});
  }
  return <details className="demo-admin-evidence"><summary><span>Математика и измерения<small>{exact?'Расчёт распределения':'Ориентир профиля'} · {exact?percentage(details.expectedGrossReturn*100):`≈${target}%`}</small></span></summary><div className="demo-admin-evidence-body">
    <div className="demo-admin-evidence-top"><div><span>{exact?'Возврат по распределению':'Ориентир профиля'}</span><strong>{exact?percentage(details.expectedGrossReturn*100):`≈${target}%`}</strong></div><span className="demo-admin-math-kind">{exact?'Расчёт распределения':offers.some(offer=>offer.evidenceKind==='weighted-native-calibration')?'Оценка калибровки':'Измеряется на серии'}</span></div>
    {details.rule&&<p>{details.rule}</p>}
    {offers.length>0&&<div className="demo-admin-measurements"><table><caption>Полная выплата / полное списание · источник указан для каждого режима</caption><thead><tr><th scope="col">Режим</th><th scope="col">Возврат и источник</th><th scope="col">Раундов</th></tr></thead><tbody>{offers.map((offer,index)=><tr key={offer.id||index}><th scope="row">{offer.name}</th><td>{percentage(offer.meanPercent)}{offer.evidenceKind==='weighted-native-calibration'&&<small>Расчёт по общей калибровке, отдельного прогона нет</small>}{Array.isArray(offer.ciPercent)&&<small>95% интервал: {offer.ciPercent.map(format).join('–')}%</small>}{offer.note&&<small>{offer.note}</small>}</td><td>{Number.isFinite(offer.samples)?format(offer.samples):Number.isFinite(offer.calibrationSamples)?<><span>—</span><small>Общая калибровка: {format(offer.calibrationSamples)}</small></>:'—'}</td></tr>)}</tbody></table></div>}
    {!exact&&!offers.length&&<p className="demo-admin-evidence-note">{game.id==='blackjack'?'Средний возврат зависит от решений игрока. Выбранный процент — имя проверенного варианта, а не точный результат любой стратегии.':'Процент — приблизительная цель калибровки. Результат отдельного раунда и короткой серии может сильно отличаться.'}</p>}
    {details.revision&&<small className="demo-admin-source">Версия математики: {details.revision}</small>}
  </div></details>;
}

// onApply must validate and commit the entire object synchronously/atomically in
// HallSession, rechecking busy and expectedRevision there. The panel never writes
// individual setters in sequence. The old slot-only HallSession remains usable.
export default function DemoAdminPanel({session,snapshot={},onClose,onApply,capabilities={},getProfileDetails,initialGroup='slots',initialGame='slots'}) {
  const dialog=useRef(null),close=useRef(null),applying=useRef(false),uid=useId().replaceAll(':','');
  const atomic=typeof onApply==='function'||typeof session?.setDemoSettings==='function';
  const supported={rtpProfiles:atomic||typeof session?.setRtpProfiles==='function',classicRtpProfiles:false,stakeLimits:false,presentation:false,...capabilities};
  const active=settingsFromSnapshot(snapshot),[draft,setDraft]=useState(()=>settingsFromSnapshot(snapshot));
  const [baseRevision,setBaseRevision]=useState(snapshot.profileRevision??1),[group,setGroup]=useState(initialGroup),[selectedGame,setSelectedGame]=useState(initialGame);
  const [message,setMessage]=useState(''),[error,setError]=useState(''),[pending,setPending]=useState(false);
  const changes=draftChanges(active,draft,supported),stale=(snapshot.profileRevision??1)!==baseRevision;
  const locked=!!snapshot.busy||pending,selected=ADMIN_GAMES.find(game=>game.id===selectedGame)||ADMIN_GAMES[0],key=selected.group==='slots'?'rtpProfiles':'classicRtpProfiles';
  const profileValue=Number(draft[key][selected.id]),activeValue=active[key][selected.id];
  let reserve=null;
  try {const current=session?.getReserveSnapshot?.();if(current&&['bankCents','reservedCents','availableCents','activeCount'].every(field=>Number.isFinite(current[field])))reserve=current;} catch { /* Read-only overview remains optional for older sessions. */ }
  let details=null;
  try{if(getProfileDetails&&selected.profiles.includes(profileValue))details=getProfileDetails(selected.id,profileValue);}catch{details=null;}
  useEffect(()=>{
    const node=dialog.current,previous=document.activeElement;
    if(!node.open)node.showModal();close.current?.focus();
    return()=>{if(node.open)node.close();queueMicrotask(()=>{if(previous instanceof HTMLElement&&previous.isConnected&&!previous.matches(':disabled'))previous.focus();});};
  },[]);
  function update(next) {setDraft(previous=>typeof next==='function'?next(previous):next);setError('');setMessage('');}
  function chooseGroup(next) {setGroup(next);if(next!=='presentation')setSelectedGame(ADMIN_GAMES.find(game=>game.group===next).id);}
  function resetDraft(defaults=false) {
    const current=settingsFromSnapshot(snapshot),baseline=settingsFromSnapshot(ADMIN_DEFAULTS);
    update(defaults?Object.fromEntries(Object.keys(current).map(field=>[field,supported[field]?baseline[field]:current[field]])):current);setBaseRevision(snapshot.profileRevision??1);
  }
  async function apply(event) {
    event.preventDefault();if(applying.current||session?.getSnapshot?.().busy||snapshot.busy||!changes.length)return;
    if(stale){setError('Активные настройки изменились. Сначала загрузите их и повторите выбор.');return;}
    try{
      const next=validateAdminDraft(draft);
      applying.current=true;setPending(true);setError('');setMessage('');
      if(onApply)await onApply(next,{expectedRevision:baseRevision});
      else if(typeof session?.setDemoSettings==='function')await session.setDemoSettings(next,{expectedRevision:baseRevision});
      else if(supported.rtpProfiles&&!supported.classicRtpProfiles&&!supported.stakeLimits&&!supported.presentation)session.setRtpProfiles(next.rtpProfiles);
      else throw new Error('Применение общих настроек ещё не подключено.');
      const committed=session?.getSnapshot?.();setBaseRevision(committed?.profileRevision??baseRevision+1);
      if(committed)setDraft(settingsFromSnapshot(committed));
      setMessage('Настройки применены ко всем новым раундам этого демо-сеанса.');
    }catch(failure){setError(failure?.message||'Не удалось применить настройки.');}
    finally{applying.current=false;setPending(false);}
  }
  return <dialog ref={dialog} className="demo-admin-panel" aria-labelledby={`${uid}-title`} onCancel={event=>{event.preventDefault();if(!pending)onClose();}} onClick={event=>{if(event.target===dialog.current&&!pending)onClose();}}>
    <header className="demo-admin-header"><div><span className="demo-admin-kicker"><b>MASQ</b><span>Локальная DEMO</span></span><h2 id={`${uid}-title`}>Управление играми</h2><p>Профили, ставки и темп для всех новых раундов.</p></div><button ref={close} type="button" className="demo-admin-close" disabled={pending} aria-label="Закрыть демо-панель" onClick={onClose}>×</button></header>
    <div className="demo-admin-session-line"><span><i aria-hidden="true"/>Активная версия {snapshot.profileRevision??1}</span><span>Только этот браузерный сеанс</span></div>
    <details className="demo-admin-overview-section"><summary><span>Сводка сеанса</span><small>{ADMIN_GAMES.length} игр · версия {snapshot.profileRevision??1}{reserve?.availableCents<0&&<span className="demo-admin-summary-warning"> · непокрытие {format(-reserve.availableCents/100)} {CURRENCY}</span>}</small></summary><dl className="demo-admin-overview" aria-label="Состояние DEMO-сеанса"><div><dt>Игры в панели</dt><dd>{ADMIN_GAMES.length}<small>{ADMIN_GAMES.filter(game=>game.group==='slots').length} слота · {ADMIN_GAMES.filter(game=>game.group==='classic').length} игр</small></dd></div><div><dt>Версия настроек</dt><dd>{snapshot.profileRevision??1}<small>Активная конфигурация</small></dd></div><div><dt>Открытые раунды</dt><dd>{reserve?reserve.activeCount:Number.isFinite(snapshot.activeCount)?snapshot.activeCount:snapshot.busy?'1':'0'}<small>{snapshot.busy?'Сеанс занят игрой':'Сеанс свободен'}</small></dd></div><div><dt>{reserve?'Доступный резерв':'Скорость показа'}</dt><dd className={reserve?.availableCents<0?'is-negative':undefined}>{reserve?currencyText(`${format(reserve.availableCents/100)} АР`):`×${format(active.presentation.speed)}`}<small>{reserve?'С учётом открытых обязательств':'Для новых раундов'}</small></dd></div></dl>
    {reserve&&<details className="demo-admin-reserve" open={reserve.bankCents<0||reserve.availableCents<0}><summary>Банк и обязательства DEMO-сеанса<span>{reserve.availableCents<0?'Есть непокрытие':'Резерв обеспечен'}</span></summary><dl><div><dt>Банк казино</dt><dd>{format(reserve.bankCents/100)} {CURRENCY}</dd></div><div><dt>Открытые обязательства</dt><dd>{format(reserve.reservedCents/100)} {CURRENCY}</dd></div><div><dt>Долг после выплат</dt><dd>{format(Math.max(0,-reserve.bankCents)/100)} {CURRENCY}</dd></div><div><dt>Непокрытие с резервами</dt><dd>{format(Math.max(0,-reserve.availableCents)/100)} {CURRENCY}</dd></div></dl><p>Данные только этого DEMO-сеанса. Открытые обязательства резервируют максимальную чистую выплату принятых раундов. Непокрытие с резервами учитывает эти возможные выплаты; долг после выплат отражает отрицательный банк уже завершённых раундов.</p></details>}
    </details><form className="demo-admin-form" onSubmit={apply} noValidate><div className="demo-admin-workspace">
      <aside className="demo-admin-sidebar"><span className="demo-admin-section-label">Настройки</span><nav className="demo-admin-tabs" aria-label="Разделы настроек">{groups.map(([id,name,count])=><button type="button" key={id} className={group===id?'selected':''} aria-pressed={group===id} onClick={()=>chooseGroup(id)}>{name}{count&&<small>{count}</small>}</button>)}</nav>
        {group!=='presentation'?<><span className="demo-admin-section-label demo-admin-games-label">{group==='slots'?'Слоты':'Настольные игры'}</span><nav className="demo-admin-game-picker" aria-label={group==='slots'?'Выбор слота':'Выбор настольной игры'}>{ADMIN_GAMES.filter(game=>game.group===group).map(game=>{
          const field=game.group==='slots'?'rtpProfiles':'classicRtpProfiles',changed=(supported[field]&&Number(draft[field][game.id])!==active[field][game.id])||(supported.stakeLimits&&['min','max'].some(limit=>Number(draft.stakeLimits[game.id][limit])!==active.stakeLimits[game.id][limit]));
          return <button type="button" key={game.id} className={selected.id===game.id?'selected':''} aria-pressed={selected.id===game.id} onClick={()=>setSelectedGame(game.id)}><span>{game.name}{changed&&<i role="img" aria-label="Есть неприменённые изменения"/>}</span><small><span>{game.id==='blackjack'||game.group==='slots'?'≈':''}{draft[field][game.id]}% RTP</span><span>{draft.stakeLimits[game.id].min||'…'}–{draft.stakeLimits[game.id].max||'…'} {CURRENCY}</span></small></button>;
        })}</nav></>:<p className="demo-admin-sidebar-note">Звук и темп едины для всех игр. Принятый раунд сохраняет свои настройки до завершения.</p>}
        <p className="demo-admin-sidebar-scope">DEMO-сеанс<br/>Настройки действуют в этом браузере.</p>
      </aside>
      {group!=='presentation'?
        <section className="demo-admin-game-settings" aria-labelledby={`${uid}-game-title`}>
          <div className="demo-admin-game-title"><div><span className="demo-admin-section-label">{selected.group==='slots'?'Слот':'Настольная игра'}</span><h3 id={`${uid}-game-title`}>{selected.name}</h3></div><span>Активно: {selected.id==='blackjack'||selected.group==='slots'?'≈':''}{activeValue}%</span></div>
          <fieldset className="demo-admin-math-controls" disabled={locked||!supported[key]}><legend>Возврат игроку · RTP</legend>
            <RangeField id={`${uid}-rtp`} label="Целевой возврат" value={draft[key][selected.id]} min={50} max={95} step={1} suffix="%" disabled={locked||!supported[key]} onChange={value=>update(previous=>({...previous,[key]:{...previous[key],[selected.id]:value}}))} description={selected.id==='blackjack'?'Шаг 1%. Открытые доли добора откалиброваны для базовой стратегии Hit / Stand. RTP приблизительный и зависит от решений игрока.':'Шаг 1%. Профиль задаёт общее открытое распределение для всех новых раундов.'}/>
          </fieldset>
          {!supported[key]&&<p className="demo-admin-unavailable">Изменение математики этой игры ещё не подключено.</p>}
          <ProfileEvidence details={details} game={selected} target={selected.profiles.includes(profileValue)?profileValue:'…'}/>
          <fieldset className="demo-admin-stake-controls" disabled={locked||!supported.stakeLimits}><legend>Пределы ставки</legend><div className="demo-admin-stake-grid">
            <RangeField id={`${uid}-min`} label="Минимум" value={draft.stakeLimits[selected.id].min} min={5} max={selected.maxStake} step={5} suffix={currencyText(" АР")} disabled={locked||!supported.stakeLimits} onChange={value=>update(previous=>({...previous,stakeLimits:{...previous.stakeLimits,[selected.id]:{...previous.stakeLimits[selected.id],min:value}}}))}/>
            <RangeField id={`${uid}-max`} label="Максимум" value={draft.stakeLimits[selected.id].max} min={5} max={selected.maxStake} step={5} suffix={currencyText(" АР")} disabled={locked||!supported.stakeLimits} onChange={value=>update(previous=>({...previous,stakeLimits:{...previous.stakeLimits,[selected.id]:{...previous.stakeLimits[selected.id],max:value}}}))}/>
          </div><small>Шаг ставки — 5 {CURRENCY}. Предел движка: {selected.maxStake} {CURRENCY}. Для покупки бонуса и особого спина это базовая ставка; полная цена указана в игре.</small></fieldset>
          {!supported.stakeLimits&&<p className="demo-admin-unavailable">Настраиваемые пределы ставок ещё не подключены.</p>}
        </section>
      :<section className="demo-admin-presentation" aria-labelledby={`${uid}-presentation-title`}>
        <div className="demo-admin-game-title"><h3 id={`${uid}-presentation-title`}>Звук и анимация</h3><span>Общие настройки</span></div>
        <fieldset disabled={locked||!supported.presentation}><legend>Скорость показа</legend><div className="demo-admin-speed-presets">{[1,1.5,2].map(value=><label key={value} className={Number(draft.presentation.speed)===value?'selected':''}><input type="radio" name={`${uid}-speed`} checked={Number(draft.presentation.speed)===value} onChange={()=>update(previous=>({...previous,presentation:{...previous.presentation,speed:value}}))}/><strong>×{format(value)}</strong><small>{value===1?'Обычный':value===1.5?'Быстрый':'Турбо'}</small></label>)}</div><small>Меняет длительность показа новых раундов. Прибыль, шансы и число игровых шагов сохраняются.</small></fieldset>
        <div className="demo-admin-volume-grid">{[['sfxVolume','Громкость эффектов'],['musicVolume','Громкость музыки']].map(([field,label])=><RangeField key={field} id={`${uid}-${field}`} label={label} value={draft.presentation[field]} min={0} max={100} suffix="%" disabled={locked||!supported.presentation} onChange={value=>update(previous=>({...previous,presentation:{...previous.presentation,[field]:value}}))} description="0% — без звука. Кнопки звука и музыки в игре сохраняют своё состояние."/>)}</div>
        {!supported.presentation&&<p className="demo-admin-unavailable">Общие настройки звука и темпа ещё не подключены.</p>}
      </section>}</div>
      <div className="demo-admin-apply-area">
        {stale&&<p className="demo-admin-stale" role="alert">Активная версия изменилась. <button type="button" disabled={pending} onClick={()=>resetDraft()}>Загрузить активные настройки</button></p>}
        {snapshot.busy&&<p className="demo-admin-busy" role="status">Раунд идёт. Применение станет доступно после его завершения.</p>}
        <div className="demo-admin-draft-heading"><div><span className={changes.length?'demo-admin-dirty':'demo-admin-clean'} aria-hidden="true"/><strong role="status">{changes.length?`В черновике: ${changes.length}`:'Все изменения применены'}</strong><small>{stale?'Нужно обновить версию':`Основан на версии ${baseRevision}`}</small></div><span>Локальная DEMO</span></div>
        {changes.length>0&&<details className="demo-admin-change-preview"><summary>Проверить изменения перед применением</summary><ul>{changes.map(change=><li key={change}>{change}</li>)}</ul></details>}
        {error&&<p className="demo-admin-error" role="alert">{error}</p>}{message&&<p className="demo-admin-success" role="status">{message}</p>}
        <div className="demo-admin-actions"><button className="demo-admin-reset" type="button" disabled={locked} onClick={()=>resetDraft(true)}>Вернуть значения по умолчанию</button><button className="demo-admin-discard" type="button" disabled={locked||!changes.length} onClick={()=>resetDraft()}>Отменить изменения</button><button className="demo-admin-apply" type="submit" disabled={locked||stale||!changes.length}>{pending?'Применение…':'Применить изменения'}</button></div>
        <p className="demo-admin-apply-note">До нажатия «Применить» значения остаются черновиком. Принятый раунд сохраняет свою версию настроек до выплаты. Общие шансы видны в «Правилах шансов».</p>
      </div>
    </form>
    <p className="demo-admin-limit">Панель доступна только в отдельной браузерной DEMO. Во встроенном мини-приложении вход закрыт. Настройки общие для сеанса: баланс, имя игрока и прошлые результаты на шансы не влияют.</p>
  </dialog>;
}
