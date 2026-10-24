import {CURRENCY} from './currency.js';
import React,{useEffect,useId,useRef,useState} from 'react';
import {cleanRewardPolicy} from './reward-policy.js';
import './ServerRewardPanel.css';
const money=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value/100);
const fields=[['returnPercent','Доля маржи в банк',0,100,1,'%'],['minimumBankCents','Порог розыгрыша',.01,1000000,.01,CURRENCY],['minStakeMultiple','Минимальный приз',1,100,1,'× ставки'],['maxStakeMultiple','Максимальный приз',1,100,1,'× ставки'],['maxWinners','Получателей за розыгрыш',1,100,1,'']];
export default function ServerRewardPanel({client,onSessionExpired}) {
  const uid=useId(),alive=useRef(false),request=useRef(null),saving=useRef(false);
  const [bank,setBank]=useState(null),[draft,setDraft]=useState(null),[reason,setReason]=useState('');
  const [pending,setPending]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const canWrite=client.getStatus().capabilities.includes('settings:write');
  const changed=bank&&draft&&JSON.stringify(bank.settings)!==JSON.stringify(draft);
  const fail=exception=>{if(!alive.current||exception?.code==='ABORTED')return;setError(exception.message||'Банк наград недоступен.');if(exception.status===401)onSessionExpired?.();};
  async function load() {
    if(saving.current)return;setPending(true);setError('');
    try {const next=await client.getRewardBank({signal:request.current.signal});if(alive.current){setBank(next);setDraft(next.settings);}}
    catch(exception){fail(exception);}finally {if(alive.current)setPending(false);}
  }
  useEffect(()=>{alive.current=true;request.current=new AbortController();load();return()=>{alive.current=false;request.current.abort();};},[client]);
  async function save(event) {
    event.preventDefault();if(saving.current||pending||!canWrite||!changed||!reason.trim())return;
    let settings;try {settings=cleanRewardPolicy(draft);} catch(exception){setError(exception.message);return;}
    saving.current=true;setPending(true);setError('');setMessage('');
    try {
      const next=await client.saveRewardPolicy({settings,expectedRevision:bank.settingsRevision,reason:reason.trim()},{signal:request.current.signal});
      if(alive.current){setBank(next);setDraft(next.settings);setReason('');setMessage('Настройки банка сохранены.');}
    } catch(exception){fail(exception);}finally {saving.current=false;if(alive.current)setPending(false);}
  }
  return <section className="server-reward-panel" aria-labelledby={`${uid}-title`}>
    <header><div><h3 id={`${uid}-title`}>Банк наград</h3><p>Случайные призы из общей маржи завершённых ставок.</p></div><button type="button" disabled={pending} onClick={load}>Обновить</button></header>
    {!bank&&pending&&<p role="status">Загружаем банк…</p>}
    {bank&&<>
      <p className="server-admin-status-note">{bank.authorityConfigured?'Серверный учёт ставок подключён.':'Учёт настоящих ставок не подключён. Настройки сохраняются; розыгрыши и начисления недоступны.'}</p>
      <dl className="server-reward-totals"><div><dt>Маржа ставок</dt><dd>{money(bank.marginCents)} {CURRENCY}</dd></div><div><dt>Доступно в банке</dt><dd>{money(bank.availableBudgetCents)} {CURRENCY}</dd></div><div><dt>Зарезервировано под награды</dt><dd>{money(bank.outstandingLiabilityCents)} {CURRENCY}</dd></div></dl>
      <form onSubmit={save} noValidate><fieldset disabled={pending||!canWrite}><legend>Параметры розыгрыша</legend><div className="server-reward-fields">
        {fields.map(([key,label,min,max,step,suffix])=><label key={key} htmlFor={`${uid}-${key}`}>{label}<span><input id={`${uid}-${key}`} type="number" min={min} max={max} step={step} value={key==='minimumBankCents'?Number(draft[key])/100:draft[key]} onChange={event=>{const numeric=Number(event.target.value);setDraft(previous=>({...previous,[key]:key==='minimumBankCents'?Math.round(numeric*100):numeric}));setError('');setMessage('');}}/><small>{suffix}</small></span></label>)}
      </div></fieldset>
      <p>Призы считаются от последней базовой ставки участника. Остаток банка сохраняется. Каждый участник может получить один приз в одном розыгрыше; повтор запроса не выдаёт награду ещё раз.</p>
      <label className="server-admin-reason" htmlFor={`${uid}-reason`}>Причина изменения<input id={`${uid}-reason`} maxLength={500} disabled={pending||!canWrite} value={reason} onChange={event=>setReason(event.target.value)}/></label>
      <div className="demo-admin-actions"><button type="submit" disabled={pending||!canWrite||!changed||!reason.trim()}>{pending?'Сохраняем…':'Сохранить банк'}</button></div>
      <small>Смена доли пересчитывает невыданный банк. Уже зарезервированные награды сохраняются; призы повышают полный возврат сверх игровых профилей.</small>
      </form>
    </>}
    {error&&<p className="demo-admin-error" role="alert">{error}</p>}{message&&<p className="demo-admin-success" role="status">{message}</p>}
  </section>;
}
