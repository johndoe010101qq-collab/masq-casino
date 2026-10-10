// Local DEMO regression only: these checks do not make browser funds authoritative.
import assert from 'node:assert/strict';
import {HallSession} from '../src/hall-session.js';
import GameMath from '../src/game-math.js';
import {createBlackjackHand,finishBlackjack} from '../src/blackjack.js';
import {liabilityTerms,LIABILITY_PROFILES} from '../src/liability-terms.js';
let checks=0;
const eq=(actual,expected,message)=>{checks++;assert.deepEqual(actual,expected,message);};
const ok=(actual,message)=>{checks++;assert.ok(actual,message);};
const rejects=(callback,pattern)=>{checks++;assert.throws(callback,pattern);};
const cards=ranks=>ranks.map(rank=>({rank,suit:'spades'}));
const games=[['coinflip','heads'],['dice',1],['plinko','standard'],['roulette','red'],['upgrader',2],['slots','bonanza'],['maskhouse','maskhouse'],['lecipher','lecipher']];
for(const [game,choice] of games)for(const stake of [-5,0,1,4,6,(game==='slots'?100:250)+5,5.5,'5',NaN,Infinity,Number.MAX_SAFE_INTEGER]) {
 let draws=0;const s=new HallSession(GameMath,()=>{draws++;return 0;}),before=s.getSnapshot(),reserve=s.getReserveSnapshot();
 rejects(()=>s.begin(game,choice,stake));eq(draws,0);eq(s.getSnapshot(),before);eq(s.getReserveSnapshot(),reserve);eq(s.active.size,0);eq(s.id,0);
}
// Every financial profile rejects an unfunded liability before consuming RNG.
for(const selection of LIABILITY_PROFILES) {
 let draws=0;const s=new HallSession(GameMath,()=>{draws++;return 0;},{initialBalanceCents:1000000,houseCapitalCents:0}),before=s.getSnapshot(),reserve=s.getReserveSnapshot();
 const choice=selection.game==='slots'?'bonanza':selection.choice;
 rejects(()=>selection.game==='blackjack'?s.beginBlackjack(5):s.begin(selection.game,choice,5,{mode:selection.mode,bonusTier:selection.bonusTier}),/Ставка временно недоступна\./);
 eq(draws,0);eq(s.getSnapshot(),before);eq(s.getReserveSnapshot(),reserve);eq(s.active.size,0);eq(s.id,0);
}
// Cloned payouts, copied active maps, readonly public fields and stale IDs cannot
// substitute credits or discard a hold. Original object settles exactly once.
{
 const s=new HallSession(GameMath,()=>0),round=s.begin('coinflip','heads',50),before=s.getSnapshot(),reserve=s.getReserveSnapshot();
 eq(round.payoutCents,10000);ok(Object.isFrozen(round));
 eq(s.completeStored({...round,payoutCents:999999999,payout:9999999.99}),false);
 eq(s.completeStored({...round}),false);eq(s.complete(round.id+1),false);
 const exposed=s.active;exposed.clear();eq(s.active.size,1);
 rejects(()=>{s.balanceCents=9999999;});rejects(()=>{s.pending=null;});rejects(()=>{s.id=999;});
 rejects(()=>{s.getSnapshot().balance=9999999;});rejects(()=>{round.payoutCents=9999999;});
 eq(typeof s.publish,'undefined');eq(s.getSnapshot(),before);eq(s.getReserveSnapshot(),reserve);
 eq(s.completeStored(round),true);eq(s.balanceCents,105000);eq(s.getReserveSnapshot().bankCents,995000);eq(s.getReserveSnapshot().reservedCents,0);
 const final=s.getSnapshot();eq(s.completeStored(round),false);eq(s.complete(round.id),false);eq(s.getSnapshot(),final);
 eq(s.reset(),true);const next=s.begin('coinflip','heads',5);ok(next.id>round.id);eq(s.complete(round.id),false);eq(s.complete(next.id),true);
}
// Paid Blackjack state is opaque. No future shoe/hole card/oracle is exposed;
// identity and current action lineage bind resolution to one chosen sequence.
{
 const s=new HallSession(GameMath,n=>n-1),round=s.beginBlackjack(50),initial=round.hand,before=s.getSnapshot();
 eq(initial.phase,'player');eq(initial.player.map(card=>card.rank),[1,3]);eq(initial.dealer[1],{hidden:true});
 for(const key of ['shoe','cursor','randomInt','roundToken','dealerBoostTickets','playerUnfavorableTickets'])eq(key in initial,false);
 eq(Object.keys(initial).sort(),['dealer','dealerTotal','phase','player','playerTotal','result','revealed']);
 ok(Object.isFrozen(initial)&&Object.isFrozen(initial.player)&&Object.isFrozen(initial.dealer));
 rejects(()=>{initial.player.push({rank:13,suit:'clubs'});});
 eq(s.blackjackView(round.id,initial,{revealed:true,settled:true}).dealer[1],{hidden:true});
 eq(s.blackjackView(round.id,initial,{revealed:true,settled:true}).result,null);
 eq(s.complete(round.id),false);eq(s.completeStored(round),false);
 rejects(()=>s.completeBlackjack(round.id,initial));
 const unrelated=finishBlackjack(createBlackjackHand({shoe:cards([1,9,10,8]),dealerBoostTickets:0}));
 rejects(()=>s.completeBlackjack(round.id,unrelated));rejects(()=>s.advanceBlackjack(round.id,'finish',unrelated));
 rejects(()=>s.advanceBlackjack(round.id,'hit',{...initial}));rejects(()=>s.advanceBlackjack(round.id,'toString',initial));
 eq(s.getSnapshot(),before);
 let coercions=0;const action={[Symbol.toPrimitive](){coercions++;return s.advanceBlackjack(round.id,'hit',initial)&&'stand';}};
 rejects(()=>s.advanceBlackjack(round.id,action,initial));eq(coercions,0);eq(s.blackjackView(round.id,initial).player.length,2);
 const hit=s.advanceBlackjack(round.id,'hit',initial);eq(hit.player.map(card=>card.rank),[1,3,13]);
 rejects(()=>s.advanceBlackjack(round.id,'stand',initial));rejects(()=>s.completeBlackjack(round.id,initial));rejects(()=>s.blackjackView(round.id,initial));
 const resolved=s.advanceBlackjack(round.id,'finish',hit);eq(resolved.phase,'resolved');
 rejects(()=>s.completeBlackjack(round.id,{...resolved}));
 const view=s.blackjackView(round.id,resolved,{revealed:true,settled:true});ok(view.result);ok(!view.dealer.some(card=>card.hidden));
 eq(s.completeBlackjack(round.id,resolved),true);eq(s.balanceCents,95000+5000*view.result.payoutMultiplier);
 eq(s.completeBlackjack(round.id,resolved),false);eq(s.advanceBlackjack(round.id,'finish',resolved),null);
 const next=s.beginBlackjack(50);rejects(()=>s.completeBlackjack(next.id,resolved));
 const nextResolved=s.advanceBlackjack(next.id,'finish',next.hand);eq(s.completeBlackjack(next.id,nextResolved),true);
}
// One maximum Plinko250 liability fits a 10,000 AR bank. A second is
// denied before RNG and debit. The next safe base stake is105AR; real maximum
// landing pays7250AR and leaves3000AR, never a negative book.
{
 let draws=0;const s=new HallSession(GameMath,()=>{draws++;return 0;},{initialBalanceCents:10000000}),opening=s.balanceCents;
 const terms=liabilityTerms({game:'plinko',choice:'standard',stake:250});eq(terms.maxPayoutCents,725000);eq(terms.maxHouseLossCents,700000);
 const round=s.begin('plinko','standard',250);eq(draws,1);eq(s.balanceCents,opening-25000);
 eq(s.getReserveSnapshot().reservedCents,700000);eq(s.getReserveSnapshot().availableCents,300000);
 const before=s.getSnapshot(),reserve=s.getReserveSnapshot();rejects(()=>s.begin('plinko','standard',250),/Ставка временно недоступна\./);eq(draws,1);eq(s.getSnapshot(),before);eq(s.getReserveSnapshot(),reserve);eq(s.id,1);
 eq(s.begin('coinflip','heads',5),null);eq(s.beginBlackjack(5),null);eq(s.reset(),false);
 eq(s.complete(round.id),true);eq(s.complete(round.id),false);
 eq(s.getReserveSnapshot(),{bankCents:300000,reservedCents:0,availableCents:300000,activeCount:0});
 eq(s.balanceCents,opening+700000);eq(s.reset(),true);eq(s.getReserveSnapshot().bankCents,1000000);
}
// Synchronous RNG/engine errors issue no playable round, debit or lingering hold.
for(const kind of ['rng','settle','cap']) {
 let draws=0;const math=kind==='settle'?{rules:GameMath.rules,settle(){throw new Error('settle failure');}}:kind==='cap'?{rules:GameMath.rules,settle(){return {payout:99999999};}}:GameMath;
 const s=new HallSession(math,()=>{draws++;if(kind==='rng')throw new Error('rng failure');return 0;}),before=s.getSnapshot(),reserve=s.getReserveSnapshot();
 rejects(()=>s.begin('coinflip','heads',5));eq(draws,1);eq(s.getSnapshot(),before);eq(s.getReserveSnapshot(),reserve);eq(s.id,0);eq(s.active.size,0);
}
// Injected RNG reentrancy cannot begin a second paid round during calculation.
{
 let s,reentered=0;s=new HallSession(GameMath,()=>{reentered++;eq(s.begin('coinflip','heads',5),null);eq(s.beginBlackjack(5),null);eq(s.reset(),false);return 0;});
 const round=s.begin('coinflip','heads',5);eq(reentered,1);eq(s.id,1);eq(s.active.size,1);eq(s.balanceCents,99500);eq(s.complete(round.id),true);
}
// A crashing observer cannot undo a committed debit/credit or leak a hold.
{
 const s=new HallSession(GameMath,()=>0),errors=[],original=console.error;
 console.error=(...args)=>errors.push(args);
 try {
  const unsubscribe=s.subscribe(()=>{throw new Error('observer fixture');});
  const round=s.begin('coinflip','heads',5);eq(s.balanceCents,99500);eq(s.active.size,1);
  eq(s.complete(round.id),true);eq(s.balanceCents,100500);eq(s.active.size,0);
  eq(s.getReserveSnapshot().reservedCents,0);eq(errors.length,2);
  unsubscribe();eq(s.reset(),true);eq(errors.length,2);
 } finally {console.error=original;}
}
console.log(JSON.stringify({status:'Hall security regression passed',checks,invalidStakeProfiles:88,preRngReserveProfiles:LIABILITY_PROFILES.length,blackjackState:'opaque, current-branch-only',localDemoOnly:true}));
