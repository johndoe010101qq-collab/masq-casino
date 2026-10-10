import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const moduleUrl=process.argv[2]?pathToFileURL(resolve(process.argv[2])):(existsSync(new URL('./profiled-bonanza.js',import.meta.url))?new URL('./profiled-bonanza.js',import.meta.url):new URL('../src/profiled-bonanza.js',import.meta.url));
const {simulateProfiledBonanzaRound:play,getBonanzaProfileSnapshot:get,BONANZA_RTP_PROFILES:profiles}=await import(moduleUrl.href),native=await import(new URL('./bonanza.js',moduleUrl)),clone=await import(new URL('./bonanza-profile-engine.js',moduleUrl)),rules=native.BONANZA_DEMO_RULES;
const fastUrl=existsSync(new URL('./fast-audit-engine.mjs',import.meta.url))?new URL('./fast-audit-engine.mjs',import.meta.url):new URL('./bonanza-fixed-weight-audit.mjs',import.meta.url);
const {rng,makeFast}=await import(fastUrl);
let checks=0;const eq=(a,b)=>{checks++;assert.equal(a,b);},deep=(a,b)=>{checks++;assert.deepEqual(a,b);},yes=x=>{checks++;assert.ok(x);},throws=(fn,expected)=>{checks++;assert.throws(fn,expected);};
const sha=s=>createHash('sha256').update(s).digest('hex');
eq(sha(await readFile(new URL('./bonanza.js',moduleUrl))),'6868ec7dc51da9aba0a8c8a37f5ee9bb6b2267cab7e14940b62c5ea8270b0d96');
deep(clone.BONANZA_DEMO_RULES,rules);
for(const stake of [500,5000])for(const mode of ['paid','buy','preview'])for(let seed=1;seed<=100;seed++){
 const a=[],b=[],c=[],one=play(stake,{mode,rtpProfile:50,randomInt:rng(seed,a)}),two=native.simulateBonanzaRound(stake,{mode,randomInt:rng(seed,b)}),three=clone.simulateBonanzaRound(stake,{mode,randomInt:rng(seed,c)});
 deep(one,two);deep(two,three);deep(a,b);deep(b,c);yes(!Object.hasOwn(one,'profile'));
}
for(const value of [50,'50','rtp50',55,'55','rtp55',60,'60','rtp60']){const s=get(value);yes(Object.isFrozen(s));eq(s.extraFreeSpins,0);eq(s.offeredExtraFreeSpins,0);eq(s.ticketWeight,0);eq(s.extraAwardChance,0);yes(Object.isFrozen(s.probabilityWeights.freeWeights));}
let consumed=0;throws(()=>play(500,{rtpProfile:70,randomInt:()=>{consumed++;return 0;}}),RangeError);eq(consumed,0);
throws(()=>play(500,{rtpProfile:55,randomInt:max=>max}),RangeError);
const fixture=flat=>Array.from({length:6},(_,c)=>flat.slice(c*5,c*5+5)),regular=n=>Array.from({length:n},(_,i)=>native.BONANZA_SYMBOLS[i%9]);
function cycle(profile){let i=0;const weights=get(profile).probabilityWeights.freeWeights;return max=>{const kind=native.BONANZA_SYMBOLS[i++%9];let offset=0;for(const[k,w]of weights){if(k===kind){yes(offset<max);return offset;}offset+=w;}throw Error('Bad fixture');};}
for(const profile of [55,60]){
 const snap=get(profile),w=snap.probabilityWeights,baseSum=w.baseWeights.reduce((s,[,v])=>s+v,0),freeSum=w.freeWeights.reduce((s,[,v])=>s+v,0);
 for(const mode of ['paid','buy','preview']){const trace=[];const round=play(500,{mode,rtpProfile:profile,randomInt:rng(741,trace)});eq(trace[0],mode==='paid'?baseSum:freeSum);yes(!trace.includes(1000000));eq(round.profile.offeredExtraFreeSpins,0);eq(round.profile.extraFreeSpins,0);eq(round.profile.ticketMatched,false);eq(round.profile.ticket,null);}
 const bought=play(500,{mode:'buy',rtpProfile:profile,randomInt:cycle(profile)});eq(bought.freeSpinsPlayed,10);eq(bought.freeSpinsAwarded,10);eq(bought.chargeCents,25000);eq(bought.ledger.creditCents,bought.payoutCents);
 const natural=play(500,{mode:'paid',rtpProfile:profile,initialGrid:fixture([...Array(4).fill('scatter'),...regular(26)]),randomInt:cycle(profile)});eq(natural.freeSpinsPlayed,10);eq(natural.spins[0].awardedSpins,10);eq(natural.ledger.chargeCents,500);
 const threeBase=play(500,{mode:'paid',rtpProfile:profile,initialGrid:fixture([...Array(3).fill('scatter'),...regular(27)]),randomInt:cycle(profile)});eq(threeBase.freeSpinsPlayed,0);
 const retrigger=play(500,{mode:'buy',rtpProfile:profile,initialGrid:fixture([...Array(3).fill('scatter'),...regular(27)]),randomInt:cycle(profile)});eq(retrigger.spins[0].awardedSpins,5);eq(retrigger.freeSpinsPlayed,15);eq(retrigger.freeSpinsAwarded,15);eq(retrigger.chargeCents,25000);
 const capGrid=fixture([...Array(12).fill('hood'),...Array.from({length:18},()=>({kind:'bomb',value:25}))]);
 const cap=play(500,{mode:'buy',rtpProfile:profile,initialGrid:capGrid,randomInt:cycle(profile)});eq(cap.payoutCents,49900);eq(cap.freeSpinsPlayed,10);eq(cap.unplayedFreeSpins,0);eq(cap.stopReason,'complete');yes(cap.spins.slice(1).every(s=>s.payoutCents===0));eq(cap.spins[0].symbolWinCents,2115);eq(cap.spins[0].multiplier,450);
 const capRetriggerGrid=fixture([...Array(12).fill('hood'),...Array(3).fill('scatter'),...Array.from({length:15},()=>({kind:'bomb',value:25}))]);
 const capRetrigger=play(500,{mode:'buy',rtpProfile:profile,initialGrid:capRetriggerGrid,randomInt:cycle(profile)});eq(capRetrigger.payoutCents,49900);eq(capRetrigger.spins[0].awardedSpins,5);eq(capRetrigger.freeSpinsPlayed,15);yes(capRetrigger.spins.slice(1).every(s=>s.payoutCents===0));
 const preview=play(500,{preview:true,rtpProfile:profile,randomInt:cycle(profile)});eq(preview.freeSpinsPlayed,10);deep(preview.ledger,{chargeCents:0,creditCents:0,deltaCents:0});
 throws(()=>play(500,{mode:'buy',rtpProfile:profile,initialGrid:capGrid,maxSpins:1,randomInt:cycle(profile)}),x=>x.code==='SPIN_LIMIT');
 // Caller-supplied weight overrides cannot change a public profile.
 deep(play(500,{rtpProfile:profile,randomInt:rng(12),probabilityWeights:{}}),play(500,{rtpProfile:profile,randomInt:rng(12)}));
}
const parityCounts={};
for(const profile of [50,55,60])for(const mode of ['paid','buy','preview'])for(const stake of [500,5000]){
 const key=`rtp${profile}_${mode}_${stake}`,fast=makeFast(get(profile).probabilityWeights),n=mode==='preview'?100:1000;parityCounts[key]=n;
 const a=[],b=[],realRng=rng(0x43A00000+profile*256+stake,a),fastRng=rng(0x43A00000+profile*256+stake,b);
 for(let i=0;i<n;i++){
  a.length=0;b.length=0;const r=play(stake,{mode,rtpProfile:profile,randomInt:realRng}),f=fast(stake,{mode,randomInt:fastRng});deep(a,b);
  eq(r.chargeCents,f.chargeCents);eq(r.payoutCents,f.payoutCents);eq(r.freeSpinsPlayed,f.freeSpinsPlayed);eq(r.freeSpinsAwarded,f.freeSpinsAwarded);eq(r.winCapCents,f.winCapCents);eq(r.capped,f.capped);eq(r.nextCellId,f.nextCellId);eq(r.spins.length,f.spins.length);
  eq(r.payoutCents,r.spins.reduce((s,v)=>s+v.payoutCents,0));eq(r.freeSpinsPlayed,r.freeSpinsAwarded);eq(r.unplayedFreeSpins,0);
  for(let j=0;j<r.spins.length;j++){const s=r.spins[j],v=f.spins[j];for(const field of ['isFreeSpin','payoutCents','symbolWinCents','multiplier','scatterCount','scatterWinCents','awardedSpins','uncappedPayoutCents'])eq(s[field],v[field]);eq(s.frames.filter(frame=>!frame.terminal).length,v.tumbles);eq(s.creditedSymbolWinCents+s.creditedMultiplierWinCents+s.creditedScatterWinCents,s.payoutCents);eq(s.frames.reduce((sum,frame)=>sum+frame.creditedPayoutCents,0),s.creditedSymbolWinCents);yes(Number.isSafeInteger(s.payoutCents));}
 }
}
const report={generatedAt:new Date().toISOString(),status:'passed',checks,sourceHashes:Object.fromEntries(await Promise.all(['bonanza.js','bonanza-profile-engine.js','bonanza-rtp-profiles.js','profiled-bonanza.js','fast-audit-engine.mjs'].map(async name=>[name,sha(await readFile(name==='fast-audit-engine.mjs'?fastUrl:new URL(name,moduleUrl)))]))),parityCounts,contracts:['Native50 exact result and RNG trace parity','Clone default weights reproduce native result','Only immutable public symbol/bomb weights change55/60','No profile lottery or free-spin gifts','Bought initial10; scatter-only +5 retriggers','Single charged entry and complete cent credit reconciliation','All awarded spins continue after cap with zero money','Preview zero ledger','Fast independent audit agrees with actual engine per spin and exact RNG trace']};
await writeFile(new URL('profile-checks-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks,sourceHashes:report.sourceHashes,parityCounts}));
