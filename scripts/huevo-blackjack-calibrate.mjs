import {createBlackjackHand,blackjackScore,hitBlackjack,finishBlackjack,evaluateBlackjack} from '../src/blackjack.js';
import {writeFileSync} from 'node:fs';
const count=Number(process.argv[2]||20000),q=Number(process.argv[3]||0),p=Number(process.argv[4]||0),seed=process.argv[5]||'pilot';
let state=[...seed].reduce((s,c)=>Math.imul(s^c.charCodeAt(0),16777619)>>>0,2166136261);
const rng=max=>{const cut=Math.floor(4294967296/max)*max;let x;do{state=(state+0x6d2b79f5)>>>0;x=state;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);x=(x^(x>>>14))>>>0;}while(x>=cut);return x%max;};
const outcomes={blackjack:0,win:0,push:0,lose:0};let sum=0,sq=0;
for(let i=0;i<count;i++){
 let hand=createBlackjackHand({randomInt:rng,dealerBoostTickets:q,playerUnfavorableTickets:p});
 const up=hand.dealer[0].rank===1?11:Math.min(10,hand.dealer[0].rank);
 while(hand.phase==='player'){
  const s=blackjackScore(hand.player),stand=s.soft?s.total>=19||(s.total===18&&up<=8):s.total>=17||(s.total>=13&&s.total<=16&&up<=6)||(s.total===12&&up>=4&&up<=6);
  if(stand)break;hand=hitBlackjack(hand);
 }
 const r=evaluateBlackjack(finishBlackjack(hand));outcomes[r.outcome]++;sum+=r.payoutMultiplier;sq+=r.payoutMultiplier**2;
}
const mean=sum/count,se=Math.sqrt((sq-count*mean*mean)/(count-1)/count);
const result={hands:count,seed,dealerBoostTickets:q,playerUnfavorableTickets:p,returnPercent:mean*100,return95CI_Percent:[(mean-1.96*se)*100,(mean+1.96*se)*100],outcomes};
console.log(JSON.stringify(result));if(process.argv[6])writeFileSync(process.argv[6],JSON.stringify(result,null,2)+'\n');
