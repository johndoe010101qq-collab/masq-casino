import calibration from './universal-slot-calibration.json' with {type:'json'};
import statistics from './universal-slot-statistics.json' with {type:'json'};
import {DEMO_RTP_VALUES,isDemoRtp} from './rtp-range.js';
import {simulateProfiledBonanzaRound,getBonanzaProfileSnapshot} from './profiled-bonanza.js';
import {playProfiledMaskSlot,getMaskProfileSnapshot} from './profiled-mask-slots.js';
import {bonusPurchaseFloorSnapshot,bonusPurchaseMinimumCents} from './bonus-purchase-floor.js';

export const UNIVERSAL_SLOT_PROFILE_REVISION='indictus-public-whole-candidate-profiles-v13';
export const UNIVERSAL_SLOT_PROFILE_VALUES=DEMO_RTP_VALUES;
export const UNIVERSAL_SLOT_TICKET_COUNT=1000000000;
export const UNIVERSAL_SLOT_MAX_CANDIDATES=512;
export const isLegacySlotProfile=value=>[50,55,60].includes(value);
const games=['slots','maskhouse','lecipher'];
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const integer=(value,name)=>{if(!Number.isSafeInteger(value)||value<0)throw new RangeError(name+' must be nonnegative integer cents.');return value;};
const cache=new Map();

export class SlotCandidateLimitError extends Error {
 constructor(){super('Не удалось принять полный раунд за 512 попыток. Ставка не списана.');this.name='SlotCandidateLimitError';this.code='CANDIDATE_LIMIT';}
}
export function universalSlotOfferKey(game,{mode='paid',bonusTier,featureMode}={}) {
 if(!games.includes(game))throw new RangeError('Unsupported public slot.');
 if(game==='slots'){
  if(bonusTier!=null||featureMode!=null)throw new RangeError('Bonanza has one bonus offer and no feature spin.');
  getBonanzaProfileSnapshot(50,mode);return game+':'+mode;
 }
 if(mode==='paid'&&bonusTier!=null)throw new RangeError('A paid slot derives its bonus tier from its symbols.');
 if(mode==='buy'&&featureMode!=null)throw new RangeError('A bought bonus cannot have a feature spin.');
 return getMaskProfileSnapshot(50,{game,mode,bonusTier,featureMode}).offer;
}
function checkedCalibration(game,offer) {
 const row=calibration.offers?.[offer],base=game==='slots'?getBonanzaProfileSnapshot(50):getMaskProfileSnapshot(50,{game});
 const key=game==='slots'?'bonanza.js':'mask-slots.js';
 if(calibration.revision!==UNIVERSAL_SLOT_PROFILE_REVISION||calibration.status!=='passed'
  ||calibration.engineSourceSHA256?.[key]!==base.baseSourceSHA256
  ||calibration.engineSourceSHA256?.['bonus-purchase-floor.js']!=='9ba39f7cf47abcd4244f3d9ef2e9753c19c518b3d9c6a5b46c31cbb25b581e1f'
  ||!row||!Number.isSafeInteger(row.accepted)||row.accepted<1000)
  throw new RangeError('Для этой версии нет согласованной калибровки полного раунда.');
 return row;
}
// Fixed, public acceptance probabilities. Classification uses the entire
// payment, including the disclosed purchase minimum, divided by entire price.
function acceptanceFor(row,targetPercent) {
 const charge=row.chargeCents,q=row.profit.probability,nq=row.nonprofit.probability;
 const p=row.profit.conditionalMeanPayoutCents/charge*q;
 const n=row.nonprofit.conditionalMeanPayoutCents/charge*nq;
 const target=targetPercent/100,mean=p+n;
 let profitableTicketWeight=UNIVERSAL_SLOT_TICKET_COUNT,otherTicketWeight=UNIVERSAL_SLOT_TICKET_COUNT;
 if(target>mean){
  const ratio=(target*nq-n)/(p-target*q);
  if(!(ratio>=1&&Number.isFinite(ratio)))throw new RangeError('Target is outside the measured native outcome support.');
  otherTicketWeight=Math.round(UNIVERSAL_SLOT_TICKET_COUNT/ratio);
 }else if(target<mean){
  const ratio=(p-target*q)/(target*nq-n);
  if(!(ratio>=1&&Number.isFinite(ratio)))throw new RangeError('Target is outside the measured native outcome support.');
  profitableTicketWeight=Math.round(UNIVERSAL_SLOT_TICKET_COUNT/ratio);
 }
 if(profitableTicketWeight<1||otherTicketWeight<1)throw new RangeError('Acceptance probability is too small.');
 const ap=profitableTicketWeight/UNIVERSAL_SLOT_TICKET_COUNT,an=otherTicketWeight/UNIVERSAL_SLOT_TICKET_COUNT;
 const acceptanceProbability=ap*q+an*nq,predictedReturn=(ap*p+an*n)/acceptanceProbability;
 const p2=row.profit.conditionalSecondMomentPayoutCents2/(charge*charge)*q;
 const n2=row.nonprofit.conditionalSecondMomentPayoutCents2/(charge*charge)*nq;
 const varianceOfEstimate=Math.max(0,(ap*ap*(p2-2*predictedReturn*p+predictedReturn*predictedReturn*q)
  +an*an*(n2-2*predictedReturn*n+predictedReturn*predictedReturn*nq))/(row.accepted*acceptanceProbability*acceptanceProbability));
 return freeze({ticketDenominator:UNIVERSAL_SLOT_TICKET_COUNT,profitableTicketWeight,otherTicketWeight,
  profitableThreshold:'payout >= entire charge',ticketBeforeCandidate:true,maxCandidates:UNIVERSAL_SLOT_MAX_CANDIDATES,
  calibrationAcceptanceProbability:acceptanceProbability,calibrationFailureProbability:(1-acceptanceProbability)**UNIVERSAL_SLOT_MAX_CANDIDATES,
  calibrationPredictedReturn:predictedReturn,calibrationStandardError:Math.sqrt(varianceOfEstimate)});
}
export function getUniversalSlotProfileSnapshot(game,value,{mode='paid',bonusTier,featureMode}={}) {
 if(!isDemoRtp(value))throw new RangeError('Выберите целый ориентир RTP от 50 до 95%.');
 const offer=universalSlotOfferKey(game,{mode,bonusTier,featureMode});
 if(isLegacySlotProfile(value))throw new RangeError('Legacy profiles retain their separate published native mathematics.');
 const key=value+':'+offer;if(cache.has(key))return cache.get(key);
 const base=game==='slots'?getBonanzaProfileSnapshot(50,mode):getMaskProfileSnapshot(50,{game,mode,bonusTier,featureMode});
 const preview=mode==='preview',row=preview?null:checkedCalibration(game,offer),acceptance=preview?null:acceptanceFor(row,value);
 const result=freeze({id:'rtp'+value,revision:UNIVERSAL_SLOT_PROFILE_REVISION,targetReturnPercent:value,
  game,offer,selectionMethod:'public-whole-candidate-weighting',baselineProfile:'rtp50',baseSourceSHA256:base.baseSourceSHA256,
  bonusPurchaseFloor:bonusPurchaseFloorSnapshot(mode),extraFreeSpins:0,offeredExtraFreeSpins:0,
  acceptance,calibrationSource:row?{stakeCents:calibration.stakeCents,samples:row.accepted,attempted:row.samples,
   sourceRevision:calibration.revision,nativeMeanReturn:row.meanPayoutCents/row.chargeCents}:null,
  calibrationPredictedReturn:acceptance?.calibrationPredictedReturn??null,
  notice:preview?'Просмотр не имеет платы или денежного RTP; показывается исходный бонус без изменения выплат.':
   'Общий открытый профиль принимает полные результаты исходного движка по постоянным весам. До каждой попытки выбирается независимый билет. Полная выплата не меньше полной цены: '+acceptance.profitableTicketWeight+'/'+UNIVERSAL_SLOT_TICKET_COUNT+'; остальные результаты: '+acceptance.otherTicketWeight+'/'+UNIVERSAL_SLOT_TICKET_COUNT+'. Принятое поле, вращения и символные выплаты сохраняются. После 512 отказов или ошибки движка вся заявка отклоняется без списания. Покупной минимум 10% включён в классификацию и отдельно начисляется прежним правилом. Профиль зафиксирован до RNG и не зависит от баланса, игрока или истории. RTP — приблизительная калибровочная цель, не сертифицированное точное значение.'});
 cache.set(key,result);return result;
}

// A rejected candidate is never shown, charged or partially settled. Engine
// integrity failures abort this entire request; they are not silently retried.
export function playUniversalSlotRound(input={}) {
 const allowed=new Set(['game','stakeCents','mode','bonusTier','featureMode','rtpProfile','randomInt']);
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!allowed.has(key)))throw new TypeError('Unsupported universal slot parameter.');
 const {game,stakeCents,mode='paid',bonusTier,featureMode,rtpProfile=50,randomInt}=input;
 if(!isDemoRtp(rtpProfile))throw new RangeError('Unsupported public slot profile.');
 universalSlotOfferKey(game,{mode,bonusTier,featureMode});
 const native=profile=>game==='slots'?simulateProfiledBonanzaRound(stakeCents,{mode,randomInt,rtpProfile:profile})
  :playProfiledMaskSlot({game,stakeCents,mode,bonusTier,featureMode,randomInt,rtpProfile:profile});
 if(isLegacySlotProfile(rtpProfile))return native(rtpProfile);
 const pinned=getUniversalSlotProfileSnapshot(game,rtpProfile,{mode,bonusTier,featureMode});
 if(mode==='preview')return native(50);
 if(typeof randomInt!=='function')throw new TypeError('An independent integer RNG is required.');
 for(let attempt=1;attempt<=UNIVERSAL_SLOT_MAX_CANDIDATES;attempt++){
  const ticket=randomInt(UNIVERSAL_SLOT_TICKET_COUNT);
  if(!Number.isSafeInteger(ticket)||ticket<0||ticket>=UNIVERSAL_SLOT_TICKET_COUNT)throw new RangeError('Invalid acceptance ticket.');
  const candidate=native(50),charge=integer(candidate.chargeCents,'candidate charge'),payout=integer(candidate.payoutCents,'candidate payout');
  if(charge===0||!Array.isArray(candidate.spins)||!candidate.spins.length||candidate.spins.reduce((sum,spin)=>sum+integer(spin.payoutCents,'spin payout'),0)!==payout
   ||candidate.ledger?.chargeCents!==charge||candidate.ledger?.creditCents!==payout)throw new RangeError('Invalid complete native round.');
  const finalPayout=mode==='buy'?Math.max(payout,bonusPurchaseMinimumCents(charge)):payout;
  const profitable=finalPayout>=charge,weight=profitable?pinned.acceptance.profitableTicketWeight:pinned.acceptance.otherTicketWeight;
  if(ticket<weight)return freeze({...candidate,publicCandidateSelection:{revision:pinned.revision,profile:pinned.id,
   offer:pinned.offer,attempts:attempt,ticket,acceptedTicketWeight:weight,classificationPayoutCents:finalPayout,
   profitable,rawCandidateUnchanged:true},mathNotice:pinned.notice});
 }
 throw new SlotCandidateLimitError();
}

export function universalSlotProfileMeasurement(profile,offer,stakeCents=5000,stats=statistics) {
 if(profile?.selectionMethod!=='public-whole-candidate-weighting'||profile.revision!==UNIVERSAL_SLOT_PROFILE_REVISION
  ||profile.offer!==universalSlotOfferKey(offer.game,offer)||offer.mode==='preview'||stakeCents!==calibration.stakeCents)return null;
 const row=checkedCalibration(offer.game,profile.offer);
 const holdout=stats?.status==='passed'&&stats.revision===profile.revision
  &&stats.calibrationSourceSHA256===calibration.sourceSHA256
  ?stats.rows.find(item=>item.offer===profile.offer&&item.profile===profile.targetReturnPercent&&item.stakeCents===stakeCents):null;
 if(holdout)return {...holdout,meanPercent:holdout.meanPercent,ciPercent:holdout.ciPercent,
  samples:holdout.accepted,baseStakeAR:stakeCents/100,chargeAR:row.chargeCents/100,
  stage:'Независимая проверка полных принятых раундов',evidenceKind:'independent-holdout'};
 const a=profile.acceptance;
 return {meanPercent:a.calibrationPredictedReturn*100,
  ciPercent:[a.calibrationPredictedReturn-1.96*a.calibrationStandardError,a.calibrationPredictedReturn+1.96*a.calibrationStandardError].map(value=>value*100),
  samples:null,calibrationSamples:row.accepted,baseStakeAR:stakeCents/100,chargeAR:row.chargeCents/100,
  stage:'Расчёт по общей калибровочной выборке исходного движка; отдельный прогон профиля отсутствует',
  evidenceKind:'weighted-native-calibration',acceptanceProbability:a.calibrationAcceptanceProbability};
}
