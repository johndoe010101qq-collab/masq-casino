import statistics from './bonus-purchase-floor-statistics.json' with {type:'json'};
import {BONUS_PURCHASE_FLOOR_REVISION} from './bonus-purchase-floor.js';
export const BONUS_FLOOR_REFERENCE_ADAPTER_SHA256='9ba39f7cf47abcd4244f3d9ef2e9753c19c518b3d9c6a5b46c31cbb25b581e1f';
// These are source-specific endpoint measurements. Unknown profiles or changed
// mathematics deliberately return no measurement rather than a target label.
export function bonusPurchaseFloorMeasurement(profile,offer,stakeCents=5000,stats=statistics) {
 if(offer?.mode!=='buy'||!profile||stats?.status!=='passed'||stats.version!==BONUS_PURCHASE_FLOOR_REVISION
  ||stats.adapterSourceSHA256!==BONUS_FLOOR_REFERENCE_ADAPTER_SHA256
  ||profile.bonusPurchaseFloor?.revision!==stats.version||profile.bonusPurchaseFloor.minimumReturnBasisPoints!==1000
  ||!['rtp50','rtp55','rtp60'].includes(profile.id)||stakeCents!==5000)return null;
 const bon=offer.game==='slots',game=bon?'bonanza':offer.game;
 if(bon){if(profile.revision!=='indictus-bonanza-demo-fixed-weights-2026-10-09-v12'
   ||profile.baseSourceSHA256!==stats.engineSourceHashes['bonanza.js']
   ||profile.profileEngineSourceSHA256!==stats.engineSourceHashes['bonanza-profile-engine.js'])return null;
 }else if(profile.revision!=='mask-public-profile-v1'
  ||profile.baseSourceSHA256!==stats.engineSourceHashes['mask-slots.js']
  ||(profile.id!=='rtp50'&&profile.derivedSourceSHA256!==stats.engineSourceHashes['profiled-mask-core.js']))return null;
 const row=stats.rows.find(item=>item.game===game&&item.bonusTier===(offer.bonusTier??null)
  &&item.profile===profile.targetReturnPercent&&item.stakeCents===stakeCents);
 return row?{meanPercent:row.finalGrossReturnPercent,ciPercent:row.finalMean95CI_Percent,
  profitFraction:row.playerProfitFrequency,samples:row.samples,baseStakeAR:row.baseStakeAR,chargeAR:row.fullChargeAR,
  floorFrequency:row.floorTransactionFrequency,floorFrequencyCI:row.floorTransactionFrequency95CI,
  rawMeanPercent:row.rawGrossReturnPercent,meanTopupAR:row.meanFloorTopupCentsPerRound/100,
  stage:'Независимая проверка с минимумом покупки 10%',referenceOnly:true}:null;
}
