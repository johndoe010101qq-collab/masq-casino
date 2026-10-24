import {CURRENCY} from './currency.js';
import {huevoSlotMeasurement} from './huevo-rtp-evidence.js';
import React from 'react';
import {slotProfileSnapshot,validateSlotProfiles} from './slot-rtp-profiles.js';
import {DEMO_RTP_VALUES} from './rtp-range.js';
import {universalSlotProfileMeasurement} from './universal-slot-profiles.js';
import {universalSlotProfileMeasurement as huevoMeasurement} from './huevo-slot-profiles.js';
import {bonusPurchaseFloorMeasurement} from './bonus-purchase-floor-measurement.js';
import maskStatistics from './mask-profile-statistics.json';
import BonanzaFixedProfileRules,{bonanzaFixedProfileMeasurement} from './BonanzaFixedProfileRules.jsx';
import BonusPurchaseFloorRules from './BonusPurchaseFloorRules.jsx';
const n=value=>Number.isFinite(value)?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(value):'—';
const pct=value=>Number.isFinite(value)?n(value*100)+'%':'—';
const offers=[
 {game:'slots',mode:'paid',title:'Bonanza · обычный спин'},
 {game:'slots',mode:'buy',title:'Bonanza · покупка ×50'},
 {game:'maskhouse',mode:'paid',title:'Mask Hou$e · обычный спин'},
 {game:'maskhouse',mode:'buy',bonusTier:'sticky',title:'Mask Hou$e · «Маскарад» ×20'},
 {game:'lecipher',mode:'paid',title:'LeXof · обычный спин'},
 {game:'lecipher',mode:'buy',bonusTier:'luck',title:'LeXof · «Тайник» ×20'},
 {game:'lecipher',mode:'buy',bonusTier:'gold',title:'LeXof · «Золотой архив» ×25'},
 {game:'lecipher',mode:'paid',featureMode:'hunt',title:'LeXof · «Охота» ×3'},
 {game:'lecipher',mode:'paid',featureMode:'rainbow',title:'LeXof · «Радужный спин» ×10'}
];
function measurement(profile,offer){
 const current=huevoSlotMeasurement(profile,offer);if(current)return current;
 if(profile.targetReturnPercent===97)return huevoMeasurement(profile,offer);
 if(profile.selectionMethod==='public-whole-candidate-weighting')return universalSlotProfileMeasurement(profile,offer);
 if(offer.game==='slots')return bonanzaFixedProfileMeasurement(profile,offer);
 if(offer.mode==='buy')return bonusPurchaseFloorMeasurement(profile,offer);
 if(maskStatistics.baseSourceSHA256!==profile.baseSourceSHA256
  ||(profile.id!=='rtp50'&&maskStatistics.derivedSourceSHA256!==profile.derivedSourceSHA256))return null;
 const row=profile.measured?.find(item=>item.baseStakeAR===50);
 return row?{meanPercent:row.estimatedGrossReturnPercent,ciPercent:row.meanGrossReturn95CI_Percent,
  profitFraction:row.payoutAboveChargeFraction,samples:row.samples,baseStakeAR:row.baseStakeAR,chargeAR:row.chargeAR,
  stage:profile.id==='rtp50'?'Исходная калибровочная выборка':'Независимая проверка исходного профиля'}:null;
}
function profileRows(values){return offers.map(offer=>{const profile=slotProfileSnapshot(offer.game,values[offer.game],offer);return {offer,profile,sample:measurement(profile,offer)};});}
function Parameters({profile,offer}){
 if(profile.acceptance){const a=profile.acceptance;return <>Полная выплата ≥ цены: {n(a.profitableTicketWeight)}/{n(a.ticketDenominator)}<br/>Остальные: {n(a.otherTicketWeight)}/{n(a.ticketDenominator)}<br/><small>До {a.maxCandidates} кандидатов</small></>;}
 if(offer.game==='slots')return <>SCATTER обычного поля: {n(profile.probabilities.baseWeights.entries.find(row=>row.item==='scatter').weight)}/{n(profile.probabilities.baseWeights.totalWeight)}<br/>Жетон бонуса: {n(profile.probabilities.freeWeights.entries.find(row=>row.item==='bomb').weight)}/{n(profile.probabilities.freeWeights.totalWeight)}</>;
 return <>{n(profile.ticketWeight)}/{n(profile.ticketCount??profile.ticketDenominator)}<br/>Билет на +{profile.extraFreeSpins} вращений</>;
}
function OfferTable({rows,caption}){return <div className="odds-table-scroll"><table><caption>{caption}</caption>
 <thead><tr><th scope="col">Режим / ориентир</th><th scope="col">Открытая математика</th><th scope="col">Возврат · приближённый 95% интервал</th><th scope="col">Источник оценки</th><th scope="col">Прибыль игрока</th><th scope="col">База / вся цена, {CURRENCY}</th><th scope="col">Крупные выплаты ≥15,8× / ≥30× базы</th></tr></thead>
 <tbody>{rows.map(({offer,profile,sample})=><tr key={profile.id+profile.offer}>
  <th scope="row">{offer.title}<br/>Ориентир {profile.targetReturnPercent}%</th><td><Parameters profile={profile} offer={offer}/></td>
  <td>{sample?<>{n(sample.meanPercent)}%<br/><small>{sample.ciPercent.map(n).join('–')}%</small></>:'Нет согласованной выборки'}</td>
  <td>{sample?<>{sample.stage}<br/>{sample.samples!=null?`${n(sample.samples)} принятых раундов`:`Общая калибровка: ${n(sample.calibrationSamples)} исходных раундов; отдельного прогона этого профиля нет`}</>:'Нет данных этой версии'}</td>
  <td>{pct(sample?.profitFraction)}</td><td>{sample?`${n(sample.baseStakeAR)} / ${n(sample.chargeAR)}`:'—'}</td>
  <td>{sample?.tail?<>{pct(sample.tail.base15_8?.frequency)} / {pct(sample.tail.base30?.frequency)}</>:'Отдельная проверка отсутствует'}</td>
 </tr>)}</tbody></table></div>;}
export default function SlotRtpProfileRules({rtpProfiles}){
 try{validateSlotProfiles(rtpProfiles);}catch{return <article><h2>Активные профили слотов</h2><p>Не удалось прочитать общие настройки этого сеанса.</p></article>;}
 const active=profileRows(rtpProfiles);
 return <article className="slot-rtp-profile-rules">
  <h2>Активные профили слотов</h2>
  <p>Bonanza — ориентир {rtpProfiles.slots}%, Mask Hou$e — {rtpProfiles.maskhouse}%, LeXof — {rtpProfiles.lecipher}%. Для каждого слота доступен целый ориентир от 50 до 95% с шагом 1%. Это общие настройки демо-сеанса. Они фиксируются до случайной генерации и сохраняются до расчёта и выплаты принятого раунда. Настройки меняются после завершения активных раундов. Баланс, личность игрока, доход казино и предыдущие результаты не меняют веса.</p>
  <p>RTP делит полную выплату на всю цену входа, включая покупку бонуса и режимы ×3/×10. Ориентир профиля — приблизительная цель, а не точный сертифицированный RTP или гарантия результата. В таблице указаны отдельные независимые проверки либо расчёт по общей калибровочной выборке; они явно различаются. «Прибыль» означает выплату строго больше всей цены.</p>
  <OfferTable rows={active} caption="Текущие общие профили и фактическая база оценки"/>
  <h3>Как работают новые промежуточные и повышенные профили</h3>
  <p>Все значения, кроме сохранённых 50/55/60, используют исходный движок профиля 50 и открытый выбор полного кандидата. До каждой попытки берётся новый независимый билет от 0 до 999 999 999. Движок затем полностью рассчитывает поле, все каскады и бонусные вращения. Билет принимается, если он меньше опубликованного веса его класса: полная выплата не меньше всей цены либо остальные результаты. При покупке в эту классификацию включён уже опубликованный минимум 10% всей цены.</p>
  <p>Отказанный кандидат не показывается и не оплачивается. Следующая попытка использует новый билет и новый полный результат того же исходного движка. Принятые символы, закреплённые ячейки, число вращений и денежные выплаты движка сохраняются целиком. Плата списывается один раз после успешного расчёта; отдельная минимальная доплата купленного бонуса начисляется по прежнему правилу. Никакая выплата не заменяется выдуманным выигрышным полем.</p>
  <p>После 512 отказов вся заявка завершается без списания. Любая ошибка или защитный предел исходного движка также отклоняет всю заявку, без скрытого повторного выбора после ошибки. Ограничение попыток не изменяет распределение успешно принятых кандидатов при независимых случайных результатах. Резерв под настоящий максимальный денежный долг проверяется до RNG. Эти проверки локальной демонстрации не являются серверной защитой реальных средств.</p>
  <p>Постоянные веса получены из общей выборки исходного движка, отдельно для каждого входа и полной цены. Для классов с вероятностями q и 1−q и суммами ожидаемых выплат m₁ и m₀ в единицах цены ожидаемый возврат равен (a₁m₁ + a₀m₀) / (a₁q + a₀(1−q)), где a₁ и a₀ — опубликованные вероятности принятия. Веса округляются до целых билетов. После заморозки параметров проверяются отдельные случайные последовательности; интервалы конечной выборки не доказывают точность очень редких событий.</p>
  <p>Повышение RTP таким способом увеличивает долю целых раундов класса «выплата не меньше цены», включая крупные выигрыши этого класса. Оно не доказывает, что выплаты 15,8× или 30× редки. Частоты этих событий приведены только там, где есть отдельный прогон, и выражены относительно базовой ставки, а не цены покупки.</p>
  <h3>Сохранённые профили 50 / 55 / 60</h3>
  <p>Профиль 50 сохраняет исходный поток RNG каждой игры. Bonanza 55/60 используют прежние открытые постоянные веса новых символов. Mask Hou$e и LeXof 55/60 используют прежний независимый билет до первого исхода на четыре настоящих дополнительных вращения один раз за всю платную заявку. Цены, таблицы выплат и максимальный долг этих профилей не изменены.</p>
  <p>Bonanza запускает бонус с 10 вращениями; только обычный ретриггер за три и более SCATTER в бесплатном вращении даёт +5. Лимит Bonanza — 100 базовых ставок минус 1 {CURRENCY}: начисленные вращения доигрываются, но исчерпанный бюджет не добавляет денег. Лимит Mask Hou$e/LeXof — 40× минус 1 {CURRENCY}; обычные бюджеты House/LeXof — 25×/30×. House доигрывает вращения после обычного бюджета; LeXof сохраняет число несыгранных вращений при остановке. Все ограничения и минимальные доплаты входят в полную оценку возврата.</p>
  <BonanzaFixedProfileRules active={rtpProfiles.slots}/>
  <BonusPurchaseFloorRules/>
  <details><summary>Все 46 открытых профилей: веса, оценки и отдельные проверки</summary>
   {DEMO_RTP_VALUES.map(value=><React.Fragment key={value}><h3>Ориентир {value}%</h3><OfferTable rows={profileRows({slots:value,maskhouse:value,lecipher:value})} caption={`Профиль ${value}%: каждый режим по всей цене входа`}/></React.Fragment>)}
  </details>
 </article>;
}
