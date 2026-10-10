import assert from 'node:assert/strict';
import { BLACKJACK_RULES, CANDIDATE_RULES, createBlackjackShoe, createBlackjackHand,
  blackjackScore, blackjackPublicView, hitBlackjack, standBlackjack, finishBlackjack,
  evaluateBlackjack, blackjackResearchAudit, isBlackjackContinuation } from '../src/blackjack.js';
let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const ok=value=>{assert.ok(value);checks++;};
const raises=fn=>{assert.throws(fn);checks++;};
const close=(a,b)=>{ok(Math.abs(a-b)<1e-12);};
const fixture=(ranks,options={})=>createBlackjackHand({shoe:ranks.map((rank,i)=>({rank,suit:'spades',id:`f${i}`})),dealerBoostTickets:0,playerUnfavorableTickets:0,...options});
const queue=(values,calls=[])=>n=>{calls.push(n);const value=values.shift();assert.ok(Number.isInteger(value)&&value>=0&&value<n);return value;};
const player=CANDIDATE_RULES.playerUnfavorableTickets,denominator=CANDIDATE_RULES.ticketCount;
eq(BLACKJACK_RULES.playerUnfavorableTickets,player);
eq(BLACKJACK_RULES.playerTicketCount,denominator);
eq(BLACKJACK_RULES.dealerBoostTickets,CANDIDATE_RULES.dealerBoostTickets);
eq(BLACKJACK_RULES.variant,'dual-selection-v10');
eq(CANDIDATE_RULES.payouts,{blackjack:2.5,win:2,push:1,lose:0});
for(const invalid of [-1,10001,.5,NaN,Infinity,'1500',null]){
 let calls=0;raises(()=>createBlackjackHand({playerUnfavorableTickets:invalid,randomInt:n=>{calls++;return n-1;}}));eq(calls,0);
}
// Initial deal is independent of both selection ticket fractions.
function seeded(seed){let state=seed>>>0;return n=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state%n;};}
for(let seed=1;seed<=100;seed++){
 const uniform=createBlackjackHand({randomInt:seeded(seed),dealerBoostTickets:0,playerUnfavorableTickets:0});
 const biased=createBlackjackHand({randomInt:seeded(seed),dealerBoostTickets:10000,playerUnfavorableTickets:10000});
 eq(uniform.shoe,biased.shoe);eq(uniform.player,biased.player);eq(uniform.dealer,biased.dealer);eq(uniform.phase,biased.phase);
}
// Exact ticket boundaries. Player 16: bust physical cards10,13; ordinary branch draws ace.
let selectedTickets=0;
for(let ticket=0;ticket<denominator;ticket++){
 const unfavorable=ticket<player,calls=[];
 const initial=fixture([10,9,6,8,10,13,5,1,2],{playerUnfavorableTickets:player,randomInt:queue([ticket,unfavorable?1:3],calls),audit:true});
 raises(()=>blackjackResearchAudit(initial));
 const next=hitBlackjack(initial);eq(calls,[10000,unfavorable?2:5]);
 eq(next.player.at(-1).rank,unfavorable?13:1);eq(next.phase,unfavorable?'reveal':'player');
 const result=finishBlackjack(next),audit=blackjackResearchAudit(result);
 eq(audit.length,1);eq(audit[0].actor,'player');eq(audit[0].unfavorable,unfavorable);
 eq(audit[0].ticket,ticket);eq(audit[0].exactProbabilities.bustPreferred,true);
 const q=audit[0].exactProbabilities;
 eq(q.remainingCards,5);eq(q.preferredCards,2);close(q.unfavorableProbability,player/denominator);
 close(q.perPreferredCard,(1-player/denominator)/5+player/denominator/2);
 close(q.perOtherCard,(1-player/denominator)/5);close(q.ranks.reduce((sum,e)=>sum+e.probability,0),1);
 eq(hitBlackjack(initial),next);eq(calls.length,2);eq(initial.cursor,4);eq(initial.player.length,2);
 ok(isBlackjackContinuation(initial,next));ok(isBlackjackContinuation(initial,result));
 eq(new Set(result.shoe.map(c=>c.id)).size,result.shoe.length);
 eq(new Set([...result.player,...result.dealer].map(c=>c.id)).size,result.cursor);
 selectedTickets+=Number(unfavorable);
}
eq(selectedTickets,player);
// With no available bust, choose the minimum new total; ties count physical cards.
for(const chosen of [0,1]){
 const calls=[],initial=fixture([3,9,5,8,2,2,5,1,13],{playerUnfavorableTickets:10000,randomInt:queue([9999,chosen],calls),audit:true});
 const next=hitBlackjack(initial),settled=finishBlackjack(next),entry=blackjackResearchAudit(settled)[0];
 eq(next.player.at(-1).rank,2);eq(next.player.at(-1).id,`f${4+chosen}`);eq(blackjackScore(next.player).total,10);
 eq(entry.exactProbabilities.bustPreferred,false);eq(entry.exactProbabilities.minimumResultingTotal,10);
 eq(entry.exactProbabilities.preferredCards,2);eq(calls,[10000,2]);
}
// Every busting card is equally favored, independent of how far over21 it goes.
for(const chosen of [0,1,2]){
 const initial=fixture([10,9,6,8,6,13,7,1,2],{playerUnfavorableTickets:10000,randomInt:queue([0,chosen]),audit:true});
 const next=hitBlackjack(initial),entry=blackjackResearchAudit(finishBlackjack(next))[0];
 eq(next.player.at(-1).rank,[6,13,7][chosen]);eq(entry.exactProbabilities.preferredCards,3);
 close(entry.exactProbabilities.perPreferredCard,1/3);close(entry.exactProbabilities.perOtherCard,0);
}
// Ordinary branches may still draw an unfavorable card: no outcome rejection/reroll.
const ordinary=fixture([10,9,6,8,10,13,5,1,2],{playerUnfavorableTickets:player,randomInt:queue([player,1]),audit:true});
const ordinaryNext=hitBlackjack(ordinary);eq(blackjackScore(ordinaryNext.player).bust,true);
eq(blackjackResearchAudit(finishBlackjack(ordinaryNext))[0].unfavorable,false);
// Invalid tickets do not create an authorized transition; clones lack lineage.
for(const invalid of [-1,10000,.5,NaN]){
 const initial=fixture([10,9,6,8,10,13,5,1,2],{playerUnfavorableTickets:player,randomInt:()=>invalid});
 raises(()=>hitBlackjack(initial));eq(initial.cursor,4);eq(initial.player.length,2);raises(()=>hitBlackjack({...initial}));
}
for(const seed of [1,2,3,4,5]){
 const initial=createBlackjackHand({randomInt:seeded(seed)}),foreign=createBlackjackHand({randomInt:seeded(seed)});
 eq(isBlackjackContinuation(initial,foreign),false);eq(isBlackjackContinuation(initial,{...initial}),false);
}
// Selection cannot consume the same physical card twice or expose future cards publicly.
for(let seed=1;seed<=1000;seed++){
 let next=createBlackjackHand({randomInt:seeded(seed),audit:seed<=5});
 while(next.phase==='player'){
  const view=blackjackPublicView(next);eq(view.dealer[1],{hidden:true});eq(view.result,null);
  for(const key of ['shoe','cursor','randomInt','roundToken','playerUnfavorableTickets','dealerBoostTickets'])eq(key in view,false);
  next=blackjackScore(view.player).total<17?hitBlackjack(next):standBlackjack(next);
 }
 next=finishBlackjack(next);const result=evaluateBlackjack(next);
 eq(next.cursor,next.player.length+next.dealer.length);eq(new Set(next.shoe.map(c=>c.id)).size,312);
 eq(new Set([...next.player,...next.dealer].map(c=>c.id)).size,next.cursor);ok([0,1,2,2.5].includes(result.payoutMultiplier));
}
console.log(`Blackjack dual-selection: ${checks} checks passed (ticket boundaries, physical-card ties, private audit, uniform initial deal, immutable lineage, unchanged payouts).`);
