import React,{useState,useEffect} from 'react';
import {createPortal} from 'react-dom';
import {quoteHuevoDeposit} from '../server/huevo-economics.mjs';
import './HuevoWallet.css';
const fmt=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(v);
export default function HuevoWallet({connection,session,disabled}){
  const [open,setOpen]=useState(false),[amount,setAmount]=useState(String(connection.initial.pendingOperation?.amount||100)),[busy,setBusy]=useState(false),[error,setError]=useState(''),[pending,setPending]=useState(connection.initial.pendingOperation),[message,setMessage]=useState('');
  const value=Number(amount),valid=Number.isSafeInteger(value)&&value>=1&&value<=100000;
  const quote=valid?quoteHuevoDeposit(value*100):null;
  useEffect(()=>{session.setWalletOpen(open);return()=>session.setWalletOpen(false);},[open,session]);
  async function run(kind){
    if(busy||!valid)return;setBusy(true);setError('');setMessage('');
    const operation=pending||{kind,id:crypto.randomUUID(),amount:value};setPending(operation);
    try{
      if(operation.kind==='deposit'){
        const p=await connection.request('/deposits',{id:operation.id,amount:operation.amount});
        // The SDK dialog never authorizes a balance credit. Reconcile on our server.
        try{await connection.sdk.confirmPayment(p.intentId);}catch{}
        const result=await connection.request('/deposits/'+p.intentId,{});session.syncWallet(result.wallet);
        if(result.status==='pending'){setError('Оплата ожидает решения. Нажмите «Проверить операцию».');return;}
        setMessage(result.status==='succeeded'?'Пополнение зачислено.':'Пополнение не выполнено.');
      }else{
        const result=await connection.request('/withdrawals',{id:operation.id,amount:operation.amount});session.syncWallet(result.wallet);
        setMessage(result.status==='succeeded'?'Вывод выполнен.':'Вывод отклонён, средства возвращены.');
      }setPending(null);
    }catch(e){setError(e.message);if(e.status&&e.status<500&&e.code!=='retry_same_request'&&e.code!=='idempotency_conflict'){setPending(null);const fresh=await connection.request('/session').catch(()=>null);if(fresh)session.syncWallet(fresh.wallet);}}
    finally{setBusy(false);}
  }
  return <><button className="huevo-wallet-open" disabled={disabled} onClick={()=>setOpen(true)}>Кошелёк</button>{open&&createPortal(<div className="huevo-wallet-shade"><section className="huevo-wallet-dialog" role="dialog" aria-modal="true" aria-labelledby="huevo-wallet-title"><button className="huevo-wallet-close" disabled={busy} onClick={()=>setOpen(false)} aria-label="Закрыть кошелёк">×</button><h2 id="huevo-wallet-title">Кошелёк MASQ</h2><p>{connection.mode==='test'?'Тест huEVO: реальные монэтки не перемещаются.':'Игровой баланс в монэтках huEVO.'}</p><label>Сумма<input type="number" min="1" max="100000" step="1" disabled={busy||!!pending} value={amount} onChange={e=>setAmount(e.target.value)}/></label>{quote&&<div className="huevo-wallet-quote"><span>Депозит <b>{fmt(value)}</b></span><span>Комиссия 5% <b>{fmt(quote.feeUnits/100)}</b></span><span>Будет зачислено <b>{fmt(quote.creditUnits/100)}</b></span></div>}<p>Комиссия 5% только за пополнение. Вывод без комиссии.</p><p>Вывод — целыми монэтками. Дробный остаток сохраняется на игровом счёте.</p>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}{pending?<button disabled={busy} onClick={()=>run(pending.kind)}>{busy?'Проверяем…':'Проверить операцию'}</button>:<div className="huevo-wallet-actions"><button disabled={busy||!valid} onClick={()=>run('deposit')}>Пополнить через huEVO</button><button disabled={busy||!valid||value>Math.floor(session.getSnapshot().balance)} onClick={()=>run('withdraw')}>Вывести</button></div>}</section></div>,document.body)}</>;
}
