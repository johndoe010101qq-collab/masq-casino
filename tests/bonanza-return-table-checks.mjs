// Copy-ready tests/bonanza-return-table-checks.mjs. Run outside Site with an explicit module path argument.
// Exact deterministic money contracts; approximate RTP is not asserted here.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const moduleUrl=process.argv[2]?pathToFileURL(resolve(process.argv[2])):new URL('../src/bonanza.js',import.meta.url);
const {BONANZA_DEMO_RULES:rules,playBonanzaRound,simulateBonanzaSpin}=await import(moduleUrl.href);
const BASE={"hood":[474,1172,4715],"suit":[383,948,2832],"glove":[330,751,2357],"laptop":[276,658,1883],"usb":[238,566,1646],"lock":[185,474,1409],"key":[145,383,1172],"radio":[119,276,948],"flag":[93,238,712]};
const FREE={"hood":[239,317,423],"suit":[228,304,405],"glove":[218,290,386],"laptop":[207,276,368],"usb":[196,262,350],"lock":[185,248,331],"key":[175,235,313],"radio":[164,221,294],"flag":[153,207,276]};
const BOUGHT=FREE;
const SCATTER=[948,1883,9430],FREE_SCATTER=[307,460,613],BOUGHT_SCATTER=FREE_SCATTER;
let checks=0;
const deep=(a,b)=>{checks++;assert.deepEqual(a,b);};
const eq=(a,b)=>{checks++;assert.equal(a,b);};
const yes=a=>{checks++;assert.ok(a);};
deep(rules.pays,BASE);deep(rules.freePays,FREE);deep(rules.boughtFreePays,BOUGHT);
deep(rules.scatterPays,SCATTER);deep(rules.freeScatterPays,FREE_SCATTER);deep(rules.boughtFreeScatterPays,BOUGHT_SCATTER);
for(const table of [rules.pays,rules.freePays,rules.boughtFreePays])yes(Object.isFrozen(table)&&Object.values(table).every(Object.isFrozen));
eq(rules.freePays,rules.boughtFreePays);eq(rules.freeScatterPays,rules.boughtFreeScatterPays);
eq(rules.rtp,null);eq(rules.bonusBuyMultiplier,50);eq(rules.winCapMultiplier,100);
eq(rules.minimumUserStake,5);eq(rules.maximumUserStake,100);eq(rules.userStakeStep,5);
deep(rules.baseWeights,[['hood',80],['suit',85],['glove',90],['laptop',95],['usb',100],
 ['lock',105],['key',110],['radio',115],['flag',120],['scatter',20]]);
deep(rules.freeWeights,[["hood",45],["suit",49],["glove",53],["laptop",57],["usb",61],["lock",150],["key",156],["radio",162],["flag",168],["scatter",1],["bomb",3]]);
let state=0xad9f723c;
function randomInt(max){const limit=Math.floor(4294967296/max)*max;let value;
 do{state=(Math.imul(state,1664525)+1013904223)>>>0;value=state;}while(value>=limit);return value%max;}
for(const mode of ['paid','buy','preview'])for(const stakeCents of [1,501,1000,10000,100000000]){
 for(let i=0;i<100;i++){
  const round=playBonanzaRound({mode,stakeCents,randomInt});
  eq(round.chargeCents,mode==='preview'?0:stakeCents*(mode==='buy'?50:1));
  eq(round.payoutCents,round.spins.reduce((s,v)=>s+v.payoutCents,0));
  eq(round.ledger.chargeCents,round.chargeCents);
  eq(round.ledger.creditCents,mode==='preview'?0:round.payoutCents);
  eq(round.ledger.deltaCents,mode==='preview'?0:round.payoutCents-round.chargeCents);
  eq(round.capCents,Math.max(0,stakeCents*100-100));eq(round.unplayedFreeSpins,0);eq(round.freeSpinsPlayed,round.freeSpinsAwarded);yes(round.payoutCents<=round.capCents);
  let cumulative=0;
  for(const spin of round.spins){
   const table=spin.freeSpin?(mode==='buy'?BOUGHT:FREE):BASE;
   const scatters=spin.freeSpin?(mode==='buy'?BOUGHT_SCATTER:FREE_SCATTER):SCATTER;
   const count=spin.scatter.count,rate=count>=6?scatters[2]:count===5?scatters[1]:count===4?scatters[0]:0;
   eq(spin.scatter.ratePercent,rate);eq(spin.scatter.payoutCents,Number(BigInt(stakeCents)*BigInt(rate)/100n));
   let symbolTotal=0;
   for(const frame of spin.frames){
    for(const win of frame.wins){const tier=win.count>=12?2:win.count>=10?1:0;
     eq(win.ratePercent,table[win.kind][tier]);eq(win.payoutCents,Number(BigInt(stakeCents)*BigInt(table[win.kind][tier])/100n));}
    eq(frame.payoutCents,frame.wins.reduce((s,v)=>s+v.payoutCents,0));
    symbolTotal+=frame.payoutCents;eq(frame.cumulativeSymbolWinCents,symbolTotal);
   }
   eq(spin.symbolWinCents,symbolTotal);
   const raw=BigInt(symbolTotal)*BigInt(spin.multiplier.applied)+BigInt(spin.scatter.payoutCents);
   const remaining=BigInt(round.capCents-cumulative);
   eq(spin.uncappedPayoutCents,raw.toString());eq(spin.payoutCents,Number(raw>remaining?remaining:raw));
   cumulative+=spin.payoutCents;yes(Number.isSafeInteger(spin.payoutCents));
  }
  eq(cumulative,round.payoutCents);
 }
}
// Every free-spin API uses the same natural/bought table, including large internal fixture stakes.
const flat=[...Array(12).fill('hood'),...Array.from({length:18},()=>({kind:'bomb',value:25}))];
let refillIndex=0;
const refill=max=>{const kind=['suit','glove','laptop','usb','lock','key','radio','flag'][refillIndex++%8];
 let offset=0;for(const[item,weight]of rules.freeWeights){if(item===kind){yes(offset<max);return offset;}offset+=weight;}throw Error('Missing fixture symbol');};
const capped=simulateBonanzaSpin({stakeCents:100000000,freeSpin:true,randomInt:refill,
 initialGrid:Array.from({length:6},(_,c)=>flat.slice(c*5,c*5+5))});
// 100000000*9938/100 =423000000; ×(18*25) =4472100000000.
eq(capped.symbolWinCents,423000000);eq(capped.multiplier.sum,450);
eq(capped.uncappedPayoutCents,'190350000000');eq(capped.payoutCents,9999999900);eq(capped.capped,true);
console.log(JSON.stringify({status:'Bonanza v11 complete-bonus shared base/natural/bought frame, cent, ledger and whole-round cap contracts passed',checks}));
