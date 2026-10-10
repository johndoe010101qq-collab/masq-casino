import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DEMO_RTP_VALUES} from '../src/rtp-range.js';
import {classicProfileSnapshot} from '../src/classic-rtp-profiles.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report=JSON.parse(readFileSync(new URL('../docs/blackjack-rtp-50-95-holdout.json',import.meta.url)));
let checks=0;const eq=(a,b)=>{checks++;assert.deepEqual(a,b);},ok=x=>{checks++;assert.ok(x);};
eq(report.status,'passed');eq(report.engineSHA256,sha(readFileSync(new URL('../src/blackjack.js',import.meta.url))));
eq(Object.keys(report.profiles).length,46);eq(report.independentHoldoutHands,4600000);
const params={};let hands=0;
for(const value of DEMO_RTP_VALUES){
 const profile=classicProfileSnapshot('blackjack',value),row=report.profiles['rtp'+value],sample=row.measurements.basic_hit_stand;
 eq(profile.kind,'approximate');eq(profile.decks,6);eq(profile.dealerBoostTickets,row.dealerBoostTickets);eq(profile.playerUnfavorableTickets,row.playerUnfavorableTickets);
 eq(profile.measurements,row.measurements);eq(profile.revision,report.version);eq(profile.engineSourceSHA256,report.engineSHA256);
 ok(Object.isFrozen(profile)&&Object.isFrozen(profile.measurements.basic_hit_stand));eq(sample.hands,100000);
 ok(row.calibration.pilot.hands>=1000000&&row.calibration.final.hands>=1000000);
 ok(row.measurements.seed.startsWith(report.holdoutSeed)&&!row.measurements.seed.startsWith(report.calibrationSeed));
 params['rtp'+value]={dealerBoostTickets:profile.dealerBoostTickets,playerUnfavorableTickets:profile.playerUnfavorableTickets};
 const o=sample.outcomes,n=Object.values(o).reduce((sum,count)=>sum+count,0),payout=2.5*o.blackjack+2*o.win+o.push,
  squares=6.25*o.blackjack+4*o.win+o.push,mean=payout/n,se=Math.sqrt((squares-n*mean*mean)/(n-1)/n);
 eq(n,sample.hands);ok(Math.abs(mean*100-sample.returnPercent)<1e-12);
 eq(sample.return95CI_Percent,[(mean-1.96*se)*100,(mean+1.96*se)*100]);hands+=n;
}
eq(hands,4600000);eq(sha(JSON.stringify(params)),report.paramsSHA256);
eq(params.rtp70,{dealerBoostTickets:3200,playerUnfavorableTickets:1500});
ok(classicProfileSnapshot('blackjack',70).note.includes('а не ровно 70'));
const result={passed:true,checks,profiles:46,independentHands:hands,
 coverage:'Unchanged physical engine SHA; all46 pinned public ticket pairs; frozen parameter digest; independent seed partition; recomputed payout-count mean and95%CI; approximate labels; native70 retained.'};
writeFileSync(new URL('./blackjack-range-evidence-results.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
