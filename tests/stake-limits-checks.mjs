// v9 minimum base5AR costs250AR (25000cents); wallet249.99AR rejects before RNG.
import assert from 'node:assert/strict';
import GameMath, {settle,PLINKO_PATH_TICKET_STARTS} from '../src/game-math.js';
import {HallSession,validateAmount,validateBonusPurchase} from '../src/hall-session.js';
import {BONANZA_DEMO_RULES as rules,BONANZA_SYMBOLS,playBonanzaRound} from '../src/bonanza.js';
import {createBonusPurchaseController} from '../src/BonanzaPresentation.js';
import {adjustedStake} from '../src/stake-limits.js';
const choices={coinflip:'heads',dice:1,roulette:'red',plinko:'standard',upgrader:2};
for(const [game,choice]of Object.entries(choices)) {
 for(const stake of [5,15,100,110,250]) {
  const wallet=new HallSession(GameMath,()=>0),round=wallet.begin(game,choice,stake);
  assert.equal(wallet.getSnapshot().balance,1000-stake);
  assert.equal(wallet.complete(round.id),true);
  assert.equal(wallet.getSnapshot().balance,1000-stake+round.payout);
  const once=wallet.getSnapshot();assert.equal(wallet.complete(round.id),false);assert.equal(wallet.getSnapshot(),once);
 }
 for(const invalid of [0,4,6,255]) {
  let draws=0;const wallet=new HallSession(GameMath,()=>{draws++;return 0;}),before=wallet.getSnapshot();
  assert.throws(()=>wallet.begin(game,choice,invalid));assert.equal(draws,0);assert.equal(wallet.getSnapshot(),before);assert.equal(wallet.id,0);
 }
}
for(const stake of [5,250]) {const wallet=new HallSession(GameMath);const round=wallet.beginBlackjack(stake);assert.equal(round.stakeCents,stake*100);assert.equal(wallet.getSnapshot().balance,1000-stake);}
for(const mode of ['paid','buy','preview']) {let draws=0;const wallet=new HallSession(GameMath,()=>{draws++;return 0;}),before=wallet.getSnapshot();assert.throws(()=>wallet.begin('slots','bonanza',105,{mode}));assert.equal(draws,0);assert.equal(wallet.getSnapshot(),before);}
assert.equal(settle('coinflip','heads',5,1000,0).payoutCents,1000);
assert.equal(settle('coinflip','heads',250,1000,0).payoutCents,50000);
assert.equal(settle('plinko','standard',5,1000,0).payoutCents,14500);
const middlePlinko=settle('plinko','standard',5,1000,PLINKO_PATH_TICKET_STARTS[15]);
assert.equal(middlePlinko.pathIndex,15);assert.equal(middlePlinko.bin,4);assert.equal(middlePlinko.payoutCents,100);
assert.equal(validateAmount(100,1000,'slots'),'');assert.ok(validateAmount(105,1000,'slots'));
assert.equal(validateBonusPurchase(5,250),'');assert.ok(validateBonusPurchase(5,249.99));
let index=0,draws=0;
const cycle=max=>{draws++;const kind=BONANZA_SYMBOLS[index++%9];let offset=0;for(const [value,weight]of rules.freeWeights){if(value===kind)return offset;offset+=weight;}throw Error('fixture');};
const wallet=new HallSession(GameMath,cycle,{initialBalanceCents:25000});
const intent=createBonusPurchaseController(wallet),request=intent.open(5);
assert.equal(request.cost,250);assert.equal(draws,0);
const bought=intent.confirm(request.id);assert.equal(bought.chargeCents,25000);assert.equal(wallet.getSnapshot().balance,0);
assert.equal(intent.confirm(request.id),null);assert.equal(wallet.complete(bought.id),true);assert.equal(wallet.complete(bought.id),false);
const flat=[...Array(12).fill('hood'),...Array.from({length:18},()=>({kind:'bomb',value:25}))];
for(const stakeCents of [500,10000]) {const capped=playBonanzaRound({mode:'buy',stakeCents,randomInt:cycle,initialGrid:Array.from({length:6},(_,c)=>flat.slice(c*5,c*5+5))});assert.equal(capped.chargeCents,stakeCents*50);assert.equal(capped.payoutCents,stakeCents*100-100);assert.equal(capped.capReached,true);assert.equal(capped.spins.length,10);}
assert.equal(adjustedStake(5,.5),5);assert.equal(adjustedStake(250,2),250);assert.equal(adjustedStake(250,1,43),40);
console.log('Stake5/250, Bonanza5/100, price×50/cap×100: rejection before RNG, cents settlement and one confirmation passed');
