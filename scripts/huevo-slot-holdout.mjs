import {HUEVO_RTP as target} from '../src/runtime-rtp-range.js';
import calibration from '../src/universal-slot-calibration.json' with {type:'json'};
import {playUniversalSlotRound} from '../src/universal-slot-admission.js';
import {applyBonusPurchaseFloor} from '../src/bonus-purchase-floor.js';
import {slotProfileSnapshot} from '../src/slot-rtp-profiles.js';
import {writeFileSync,readFileSync} from 'node:fs';
const count=Number(process.argv[2]||20000);
const offers=[{game:'slots',mode:'paid'},{game:'slots',mode:'buy'},
 {game:'maskhouse',mode:'paid'},{game:'maskhouse',mode:'buy',bonusTier:'sticky'},
 {game:'lecipher',mode:'paid'},{game:'lecipher',mode:'buy',bonusTier:'luck'},
 {game:'lecipher',mode:'buy',bonusTier:'gold'},{game:'lecipher',mode:'paid',featureMode:'hunt'},
 {game:'lecipher',mode:'paid',featureMode:'rainbow'}];
const filter=process.argv[3]||null;
const evidenceFile='docs/huevo-slot-'+target+'-holdout.json';
const rows=filter?JSON.parse(readFileSync(evidenceFile)).rows:[];
for(const offer of offers){
 const snapshot=slotProfileSnapshot(offer.game,target,offer),seed='huEVO'+target+'-INDEPENDENT-HOLDOUT-v54:'+snapshot.offer;
 if(filter&&snapshot.offer!==filter)continue;
 let state=[...seed].reduce((s,c)=>Math.imul(s^c.charCodeAt(0),16777619)>>>0,2166136261);
 const rng=max=>{const cut=Math.floor(4294967296/max)*max;let x;do{state=(state+0x6d2b79f5)>>>0;x=state;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);x=(x^(x>>>14))>>>0;}while(x>=cut);return x%max;};
 let sum=0,sq=0,positive=0,profit=0,max=0,totalAttempts=0;
 for(let i=0;i<count;i++){
  const raw=playUniversalSlotRound({...offer,stakeCents:5000,rtpProfile:target,randomInt:rng});
  const r=offer.mode==='buy'?applyBonusPurchaseFloor(raw,{game:offer.game,mode:'buy'}):raw;
  if(r.spins.reduce((s,x)=>s+x.payoutCents,0)!==r.payoutCents||r.ledger.creditCents!==r.payoutCents)throw Error('Ledger mismatch');
  const ratio=r.payoutCents/r.chargeCents;sum+=ratio;sq+=ratio*ratio;positive+=r.payoutCents>0;profit+=r.payoutCents>=r.chargeCents;max=Math.max(max,ratio);totalAttempts+=raw.publicCandidateSelection.attempts;
 }
 const mean=sum/count,se=Math.sqrt((sq-count*mean*mean)/(count-1)/count);
 const row={offer:snapshot.offer,profile:target,samples:count,seed,profileRevision:snapshot.revision,baseSourceSHA256:snapshot.baseSourceSHA256,returnPercent:mean*100,
  return95CI_Percent:[(mean-1.96*se)*100,(mean+1.96*se)*100],positiveFrequency:positive/count,
  profitFrequency:profit/count,maxChargeMultiplier:max,meanAttempts:totalAttempts/count,
  predictedReturn:snapshot.calibrationPredictedReturn,calibrationStandardError:snapshot.acceptance.calibrationStandardError};
 const previous=rows.findIndex(x=>x.offer===row.offer);if(previous<0)rows.push(row);else rows[previous]=row;console.log(JSON.stringify(row));
 writeFileSync(evidenceFile,JSON.stringify({targetReturnPercent:target,stakeCents:5000,calibrationSourceSHA256:calibration.sourceSHA256,
  status:rows.length===offers.length?'complete':'running',limitation:'Monte Carlo estimates with sampling error; no certified exact theoretical slot RTP.',rows},null,2)+'\n');
}
