import {BONANZA_DEMO_RULES as native,BONANZA_SYMBOLS} from '../src/bonanza.js';
export function rng(seed, trace) { let state=seed>>>0;return max=>{if(trace)trace.push(max);const cut=Math.floor(4294967296/max)*max;let x;do {state=(state+0x6D2B79F5)>>>0;x=state;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);x=(x^(x>>>14))>>>0;}while(x>=cut);return x%max;}; }
export function weights({scatter=20,bomb=3,scale=1000}={}) { return {baseWeights:native.baseWeights.map(([k,w])=>[k,Math.round((k==='scatter'?scatter:w)*scale)]),freeWeights:native.freeWeights.map(([k,w])=>[k,Math.round((k==='bomb'?bomb:w)*scale)]),bombWeights:native.bombWeights.map(([v,w])=>[v,w])}; }
export function makeFast(probabilityWeights=native) {
 const build=entries=>{let total=0;return{total:entries.reduce((s,[,w])=>s+w,0),cuts:entries.map(([k,w])=>[k,total+=w])};};
 const base=build(probabilityWeights.baseWeights),free=build(probabilityWeights.freeWeights),bomb=build(probabilityWeights.bombWeights),indices=Object.fromEntries([...BONANZA_SYMBOLS,'scatter','bomb'].map((k,i)=>[k,i]));
 const pick=(rand,table)=>{const draw=rand(table.total);for(const[k,cut]of table.cuts)if(draw<cut)return k;throw Error('Bad draw');};
 return function play(stakeCents,{randomInt,mode='paid',maxSpins=200,maxTumbles=100,initialGrid}={}) {
  let nextId=0,total=0,pending=mode==='paid'?0:10,awarded=pending,freePlayed=0;const spins=[],cap=Math.max(0,stakeCents*100-100);
  const fresh=isFree=>{const kind=indices[pick(randomInt,isFree?free:base)];return{id:nextId++,kind,value:kind===10?pick(randomInt,bomb):0};};
  function spin(isFree,initial) {
   let grid=initial?initial.map(col=>col.map(c=>({id:nextId++,kind:indices[typeof c==='string'?c:c.kind],value:c.value??0}))):Array.from({length:6},()=>Array.from({length:5},()=>fresh(isFree)));
   let symbol=0,bombSum=0,tumbles=0;const seen=new Set();
   for(;;) {
    const counts=new Array(11).fill(0);for(const col of grid)for(const c of col){counts[c.kind]++;if(isFree&&c.kind===10&&!seen.has(c.id)){seen.add(c.id);bombSum+=c.value;}}
    const winners=[];for(let k=0;k<9;k++)if(counts[k]>=8){if(tumbles>=maxTumbles)throw Object.assign(Error('Tumble limit'),{code:'TUMBLE_LIMIT'});winners.push(k);const rate=(isFree?native.freePays:native.pays)[BONANZA_SYMBOLS[k]][counts[k]>=12?2:counts[k]>=10?1:0];symbol+=Math.floor(stakeCents*rate/100);}
    if(!winners.length)break;
    grid=grid.map(col=>{const keep=col.filter(c=>!winners.includes(c.kind));return Array.from({length:5-keep.length},()=>fresh(isFree)).concat(keep);});tumbles++;
   }
   const scatterCount=grid.flat().reduce((n,c)=>n+Number(c.kind===9),0),table=isFree?native.freeScatterPays:native.scatterPays;
   const scatterWin=scatterCount>=4?Math.floor(stakeCents*table[scatterCount>=6?2:scatterCount===5?1:0]/100):0;
   const factor=isFree&&symbol>0&&bombSum>0?bombSum:1,uncapped=symbol*factor+scatterWin,payout=Math.min(cap-total,uncapped),freeSpinsAwarded=isFree?(scatterCount>=3?5:0):(scatterCount>=4?10:0);
   const settled={isFreeSpin:isFree,payoutCents:payout,symbolWinCents:symbol,multiplier:factor,scatterCount,scatterWinCents:scatterWin,awardedSpins:freeSpinsAwarded,tumbles,uncappedPayoutCents:String(uncapped)};
   spins.push(settled);total+=payout;pending+=freeSpinsAwarded;awarded+=freeSpinsAwarded;
  }
  if(mode==='paid')spin(false,initialGrid);let first=mode!=='paid';while(pending>0){if(spins.length>=maxSpins)throw Object.assign(Error('Spin limit'),{code:'SPIN_LIMIT'});pending--;spin(true,first?initialGrid:undefined);first=false;freePlayed++;}
  return{mode,payoutCents:total,spins,freeSpinsPlayed:freePlayed,freeSpinsAwarded:awarded,chargeCents:mode==='preview'?0:stakeCents*(mode==='buy'?50:1),winCapCents:cap,capped:total>=cap,nextCellId:nextId};
 };
}
export function sample({scatter=20,bomb=3,mode='paid',stakeCents=5000,n=100000,seed=0x42100001,probabilityWeights}={}) {
 const play=makeFast(probabilityWeights??weights({scatter,bomb})),randomInt=rng(seed);let sum=0,mean=0,m2=0,profit=0,positive=0,caps=0,even=0,freeSpins=0,triggered=0,totalTumbles=0,maxSpins=0,continued=0,retriggers=0;
 const charge=stakeCents*(mode==='buy'?50:1),payouts=[];
 for(let i=1;i<=n;i++){const r=play(stakeCents,{randomInt,mode}),x=r.payoutCents/charge,d=x-mean;mean+=d/i;m2+=d*(x-mean);sum+=r.payoutCents;profit+=Number(r.payoutCents>charge);positive+=Number(r.payoutCents>0);even+=Number(r.payoutCents===charge);caps+=Number(r.capped);freeSpins+=r.freeSpinsPlayed;triggered+=Number(r.freeSpinsPlayed>0);maxSpins=Math.max(maxSpins,r.spins.length);for(const s of r.spins){totalTumbles+=s.tumbles;if(s.isFreeSpin&&s.awardedSpins)retriggers++;}if(r.capped){let accumulated=0;const first=r.spins.findIndex(s=>(accumulated+=s.payoutCents)>=r.winCapCents);continued+=Math.max(0,r.spins.length-first-1);}payouts.push(r.payoutCents);}
 const se=Math.sqrt(m2/(n-1)/n);payouts.sort((a,b)=>a-b);const q=p=>{const pos=(n-1)*p,lo=Math.floor(pos),hi=Math.ceil(pos);return(payouts[lo]+(payouts[hi]-payouts[lo])*(pos-lo))/100;};
 return{scatter,bomb,mode,stakeCents,baseStakeAR:stakeCents/100,seed,sampleRounds:n,chargeCentsPerRound:charge,totalChargeCents:n*charge,totalPayoutCents:sum,estimatedReturn:mean,estimatedReturn95CI:[mean-1.96*se,mean+1.96*se],standardError:se,playerProfitFrequency:profit/n,positivePayoutFrequency:positive/n,zeroPayoutFrequency:(n-positive)/n,breakEvenFrequency:even/n,capFrequency:caps/n,caps,freeSpinsPlayed:freeSpins,bonusTriggeredFrequency:triggered/n,retriggerTransactions:retriggers,totalTumbles,maximumSpinsInRound:maxSpins,continuedSpinsAfterFirstClipping:continued,actualExtraFSGiftTransactions:0,payoutDistributionAR:{median:q(.5),p90:q(.9),p95:q(.95),p99:q(.99),min:payouts[0]/100,max:payouts.at(-1)/100}};
}
