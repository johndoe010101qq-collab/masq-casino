import React,{useState,useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {quoteHuevoDeposit} from '../server/huevo-economics.mjs';
import {runHuevoWalletOperation} from './integrations/huevo-wallet-operations.js';
import './HuevoWallet.css';
const fmt=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(v);
export default function HuevoWalletPanel({connection,session,disabled}){
 const connected=!!session.remote&&connection.status==='ready';
 const [open,setOpen]=useState(false),[tab,setTab]=useState('deposit');
 const [amount,setAmount]=useState(String(connection.initial?.pendingOperation?.amount||100));
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState(connection.initial?.pendingOperation),[message,setMessage]=useState('');
 const dialog=useRef(null),running=useRef(false);
 const value=Number(amount),valid=Number.isSafeInteger(value)&&value>=1&&value<=100000;
 const quote=valid?quoteHuevoDeposit(value*100):null;
 useEffect(()=>{if(!connected)return;setPending(connection.initial?.pendingOperation);if(connection.initial?.pendingOperation)setAmount(String(connection.initial.pendingOperation.amount));},[connected,connection.initial]);
 useEffect(()=>{if(session.remote)session.setWalletOpen(open);return()=>{if(session.remote)session.setWalletOpen(false);};},[open,session]);
 useEffect(()=>{if(!open)return;const previous=document.activeElement;dialog.current?.focus();return()=>previous?.isConnected&&previous.focus?.();},[open]);
 function close(){if(!running.current)setOpen(false);}
 async function run(){
  if(running.current||!connected||!valid)return;
  running.current=true;setBusy(true);setError('');setMessage('');
  const operation=pending||{kind:tab,id:crypto.randomUUID(),amount:value};setPending(operation);
  try{
   const result=await runHuevoWalletOperation(connection,session,operation,{confirm:!pending});
   if(result.status==='pending'){setMessage('Операция ещё обрабатывается. Проверьте её статус через несколько секунд.');return;}
   setMessage(result.status==='succeeded'?(operation.kind==='deposit'?'Пополнение зачислено.':'Вывод выполнен.'):(operation.kind==='deposit'?'Пополнение отменено или не оплачено.':'Вывод отклонён, средства возвращены.'));
   setPending(null);
  }catch(e){setError(e.message);if(e.status&&e.status<500&&e.code!=='retry_same_request'&&e.code!=='idempotency_conflict'){setPending(null);const fresh=await connection.request('/session').catch(()=>null);if(fresh)session.syncWallet(fresh.wallet);}}
  finally{running.current=false;setBusy(false);}
 }
 function trap(e){if(e.key==='Escape'){e.preventDefault();close();}if(e.key!=='Tab')return;const nodes=[...dialog.current.querySelectorAll('button,a,input')].filter(n=>!n.disabled&&n.getClientRects().length);if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}}
 return <><button className="huevo-wallet-open" disabled={disabled} onClick={()=>setOpen(true)}>Пополнить</button>{open&&createPortal(<div className="huevo-wallet-shade" onClick={e=>{if(e.target===e.currentTarget)close();}}><section ref={dialog} tabIndex={-1} className="huevo-wallet-dialog" role="dialog" aria-modal="true" aria-labelledby="huevo-wallet-title" onKeyDown={trap}>
  <button className="huevo-wallet-close" disabled={busy} onClick={close} aria-label="Закрыть кошелёк">×</button><h2 id="huevo-wallet-title">Кошелёк MASQ</h2>
  {!connected?<><p>Войдите через huEVO, чтобы пополнять игровой счёт и выводить монэтки.</p><a className="huevo-wallet-connect" href="https://huevo.su/apps/221">Войти через huEVO</a><p>Демонстрационный баланс не обменивается на монэтки. Комиссия за пополнение — 5%.</p></>:<>
   <p className="huevo-wallet-balance">На игровом счёте <strong>{fmt(session.getSnapshot().balance)} <small>монэтки</small></strong></p>
   {connection.mode==='test'&&<p className="huevo-wallet-test">Тест huEVO. Реальные монэтки не списываются.</p>}
   <div className="huevo-wallet-tabs" role="group" aria-label="Операция">{[['deposit','Пополнение'],['withdraw','Вывод']].map(([id,label])=><button type="button" key={id} disabled={busy||!!pending} aria-pressed={(pending?.kind||tab)===id} onClick={()=>{setTab(id);setError('');setMessage('');}}>{label}</button>)}</div>
   <label>Сумма, монэтки<input type="number" min="1" max="100000" step="1" disabled={busy||!!pending} value={amount} onChange={e=>{setAmount(e.target.value);setMessage('');setError('');}}/></label>
   <div className="huevo-wallet-presets">{[100,500,1000].map(n=><button type="button" key={n} disabled={busy||!!pending} onClick={()=>setAmount(String(n))}>{fmt(n)}</button>)}</div>
   {(pending?.kind||tab)==='deposit'&&quote?<div className="huevo-wallet-quote"><span>Списание в huEVO <b>{fmt(value)}</b></span><span>Комиссия 5% <b>{fmt(quote.feeUnits/100)}</b></span><span>На игровой счёт <b>{fmt(quote.creditUnits/100)}</b></span></div>:<p>Вывод без комиссии, целыми монэтками. Дробный остаток сохраняется на счёте.</p>}
   {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
   <button className="huevo-wallet-submit" disabled={busy||!valid||(!pending&&tab==='withdraw'&&value>Math.floor(session.getSnapshot().balance))} onClick={run}>{busy?'Обрабатываем…':pending?'Проверить операцию':tab==='deposit'?'Пополнить через huEVO':'Вывести в huEVO'}</button>
  </>}
 </section></div>,document.body)}</>;
}
