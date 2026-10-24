import slots from '../docs/huevo-slot-92-holdout.json' with {type:'json'};
import calibration from './universal-slot-calibration.json' with {type:'json'};

// Evidence is shown only for the exact frozen engine/calibration being played.
export function huevoSlotMeasurement(profile,offer){
 if(profile?.targetReturnPercent!==92||slots.status!=='complete'||slots.calibrationSourceSHA256!==calibration.sourceSHA256)return null;
 const row=slots.rows.find(r=>r.offer===profile.offer&&r.profile===92);
 if(!row||row.profileRevision!==profile.revision||row.baseSourceSHA256!==profile.baseSourceSHA256)return null;
 return {...row,meanPercent:row.returnPercent,ciPercent:row.return95CI_Percent,profitFraction:row.profitFrequency,
  baseStakeAR:slots.stakeCents/100,chargeAR:calibration.offers[profile.offer].chargeCents/100,
  stage:'Независимая проверка huEVO · фиксированный профиль 92%',evidenceKind:'independent-holdout'};
}
