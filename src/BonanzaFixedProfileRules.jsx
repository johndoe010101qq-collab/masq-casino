import {CURRENCY} from './currency.js';
import React from 'react';
import {BONANZA_RTP_PROFILES,getBonanzaProfileSnapshot} from './bonanza-rtp-profiles.js';
import statistics from './bonanza-profile-statistics.json';
import {bonusPurchaseFloorSnapshot} from './bonus-purchase-floor.js';
import {bonusPurchaseFloorMeasurement} from './bonus-purchase-floor-measurement.js';
import {isLegacySlotProfile} from './universal-slot-profiles.js';
const n=value=>Number.isFinite(value)?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:5}).format(value):'—';
const pct=value=>n(value*100)+'%';
const names={hood:'Капюшон',suit:'Костюм',glove:'Перчатка',laptop:'Ноутбук',usb:'USB',lock:'Замок',key:'Ключ',radio:'Рация',flag:'Флаг',scatter:'SCATTER',bomb:'Жетон множителя'};
export function bonanzaFixedProfileMeasurement(snapshot,offer,stakeCents=5000) {
 if(offer.mode==='buy')return bonusPurchaseFloorMeasurement({...snapshot,bonusPurchaseFloor:snapshot.bonusPurchaseFloor??bonusPurchaseFloorSnapshot('buy')},{...offer,game:'slots'},stakeCents);
 if(statistics.status!=='passed'||statistics.version!==snapshot.revision
  ||statistics.sourceHashes['bonanza.js']!==snapshot.baseSourceSHA256
  ||statistics.sourceHashes['bonanza-profile-engine.js']!==snapshot.profileEngineSourceSHA256)return null;
 const row=statistics.resultsByStake[`${snapshot.id}_${offer.mode}_${stakeCents}`];
 return row?{meanPercent:row.estimatedReturn*100,ciPercent:row.estimatedReturn95CI.map(v=>v*100),profitFraction:row.playerProfitFrequency,samples:row.sampleRounds,baseStakeAR:row.stakeCents/100,chargeAR:row.chargeCentsPerRound/100,stage:'Независимая проверка'}:null;
}
export default function BonanzaFixedProfileRules({active=50}) {
 const legacy=isLegacySlotProfile(active),current=getBonanzaProfileSnapshot(legacy?active:50);
 return <details className="bonanza-fixed-profile-rules"><summary>Bonanza: фиксированные веса профилей 50 / 55 / 60</summary>
  <p>{legacy?`Активный ориентир — ${current.targetReturnPercent}%.`:`Активный ориентир ${active}% использует открытые веса полных кандидатов из общей таблицы выше. Здесь показаны сохранённые исходные профили 50/55/60; их отдельные измерения не подтверждают новый профиль.`} Профиль 50 вызывает исходный движок. Профили 55 и 60 выбирают каждый новый символ по открытым постоянным весам ниже; те же веса действуют на исходном поле и при падениях. Вероятность символа равна его весу, делённому на сумму соответствующей таблицы. Когда выбран жетон, его значение отдельно выбирается из таблицы множителей. Каждый выбор использует новый случайный результат.</p>
  <p>Эти профили не дарят дополнительных вращений. Четыре и более SCATTER в обычном спине запускают 10 бесплатных вращений; покупка стоит ×50 базовой ставки и начинается с 10. Только три и более SCATTER в бесплатном вращении начисляют обычный ретриггер +5. Все таблицы выплат сохранены, а естественный и купленный бонусы внутри профиля используют одинаковые веса и выплаты. Вся выплата раунда ограничена 100 базовыми ставками минус 1 {CURRENCY}; все начисленные вращения доигрываются и после исчерпания этого лимита дают нулевую денежную выплату.</p>
  <p>Веса фиксируются для принятого раунда. Баланс, игрок, история, доход казино и предыдущие результаты не изменяют вероятность. Здесь указаны приблизительные цели калибровки и измерения на отдельной проверочной выборке; это не точный теоретический RTP и не гарантия прибыли.</p>
  <p>Покупной бонус дополнительно имеет открытый минимум полной выплаты 10% всей цены покупки. Он начисляется отдельной денежной выплатой после движка и не меняет веса, символные выплаты или число вращений. Полная выплата купленного бонуса поэтому может отличаться от естественного.</p>
  <div className="odds-table-scroll"><table><caption>Проверка исходных профилей Bonanza: обычные раунды и покупки с минимумом 10%</caption><thead><tr><th scope="col">Профиль / режим</th><th scope="col">База / списание, {CURRENCY}</th><th scope="col">Измеренный возврат · 95% интервал</th><th scope="col">Раунды с прибылью</th><th scope="col">Полных раундов</th></tr></thead><tbody>
   {[50,55,60].flatMap(profile=>['paid','buy'].flatMap(mode=>[500,5000].map(stakeCents=>{
    const snapshot=getBonanzaProfileSnapshot(profile,mode),sample=bonanzaFixedProfileMeasurement(snapshot,{mode},stakeCents);
    return <tr key={`${profile}_${mode}_${stakeCents}`}><th scope="row">{profile}% · {mode==='paid'?'обычный спин':'покупка бонуса'}</th><td>{sample?`${n(sample.baseStakeAR)} / ${n(sample.chargeAR)}`:'—'}</td><td>{sample?<>{n(sample.meanPercent)}%<br/><small>{sample.ciPercent.map(n).join('–')}%</small></>:'Нет согласованной выборки'}</td><td>{sample?pct(sample.profitFraction):'—'}</td><td>{sample?n(sample.samples):'—'}</td></tr>;
   })))}
  </tbody></table></div>
  <p>Обычные раунды проверены по 200 000 на каждую пару профиля и ставки. Покупки с новым минимумом — по 20 000 при базе 50 {CURRENCY}; согласованной выборки покупок с этим минимумом при базе 5 {CURRENCY} здесь нет. Исходная проверка 1,8 млн раундов до адаптера сохранена отдельно как справочная история. Каждая строка использует собственную проверочную последовательность. Выплата включает все начисленные вращения и доплаты; знаменатель — вся цена входа. «Прибыль» означает выплату строго больше списания. Параметры зафиксированы до проверки; 95% интервал приближённо рассчитан по среднему выборки. Эти строки относятся к исходным профилям 50/55/60 и не подтверждают изменённые версии.</p>
  {[50,55,60].map(profile=>{
   const snapshot=getBonanzaProfileSnapshot(profile),base=snapshot.probabilities.baseWeights,free=snapshot.probabilities.freeWeights;
   return <details key={profile}><summary>Профиль {profile}%: таблицы весов и вероятностей</summary>
    <p>Сумма весов обычных символов — {n(base.totalWeight)}; бесплатных — {n(free.totalWeight)}. В профилях 55/60 исходные веса масштабированы ×1000 для точного целочисленного выбора; изменения вероятностей задают вес SCATTER обычного спина и вес жетона бесплатного спина.</p>
    <div className="odds-table-scroll"><table><thead><tr><th scope="col">Символ</th><th scope="col">Обычный вес</th><th scope="col">Вероятность в обычном спине</th><th scope="col">Бесплатный вес</th><th scope="col">Вероятность в бесплатном спине</th></tr></thead><tbody>{free.entries.map(entry=>{
      const regular=base.entries.find(v=>v.item===entry.item);
      return <tr key={entry.item}><th scope="row">{names[entry.item]}</th><td>{regular?n(regular.weight):'—'}</td><td>{regular?pct(regular.probability):'—'}</td><td>{n(entry.weight)}</td><td>{pct(entry.probability)}</td></tr>;
     })}</tbody></table></div>
   </details>;
  })}
  <details><summary>Общая таблица значений жетона множителя</summary>
   <p>Веса значений жетона одинаковы во всех профилях. Отдельные новые жетоны внутри бесплатного вращения суммируются; сумма умножает только символные выплаты этого вращения. SCATTER оплачивается отдельно. Ниже условная вероятность значения, когда выбран жетон, а не шанс верхнего предела всего бонуса.</p>
   <div className="odds-table-scroll"><table><thead><tr><th scope="col">Значение</th><th scope="col">Вес</th><th scope="col">Вероятность при выбранном жетоне</th></tr></thead><tbody>{getBonanzaProfileSnapshot(50).probabilities.bombWeights.entries.map(entry=><tr key={entry.item}><th scope="row">×{entry.item}</th><td>{n(entry.weight)}</td><td>{pct(entry.probability)}</td></tr>)}</tbody></table></div>
  </details>
  <p className="odds-footnote">Версия: {BONANZA_RTP_PROFILES.rtp50.revision}. Исходный движок SHA-256: {current.baseSourceSHA256}. Движок фиксированных весов SHA-256: {current.profileEngineSourceSHA256}. Источник измерений — проверка этих модулей через публичный движок; файлы и настройки сверяются по SHA-256.</p>
 </details>;
}
