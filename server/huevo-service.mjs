import {createHash,randomInt,randomUUID} from 'node:crypto';
import {HuevoError} from './huevo-protocol.mjs';
import {quoteHuevoDeposit} from './huevo-economics.mjs';
import {HallSession} from '../src/hall-session.js';
import GameMath from '../src/game-math.js';
import {HUEVO_SLOT_PROFILES,HUEVO_CLASSIC_PROFILES} from '../src/huevo-edition.js';
import {createBlackjackHand,hitBlackjack,standBlackjack,revealBlackjack,dealerStepBlackjack,finishBlackjack,blackjackPublicView,evaluateBlackjack} from '../src/blackjack.js';
import {blackjackProfileOptions,classicProfileSnapshot} from '../src/classic-rtp-profiles.js';

const settings={rtpProfiles:HUEVO_SLOT_PROFILES,classicRtpProfiles:HUEVO_CLASSIC_PROFILES,fixedRtp:97};
const config=new HallSession(GameMath,randomInt,{...settings,initialBalanceCents:0}).getSnapshot();
const bjActions={hit:hitBlackjack,stand:standBlackjack,reveal:revealBlackjack,dealer:dealerStepBlackjack,finish:finishBlackjack};
export const huevoOwner=s=>`${s.mode}:${s.userId}`;
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validKey=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{8,64}$/.test(id);
const platformAmount=a=>{if(!Number.isSafeInteger(a)||a<1||a>100000)throw new HuevoError(400,'invalid_amount','Сумма — целое число от 1 до 100 000 монэток.');return a;};
function replayHand(state){
  let index=0;const tape=state.tape.map(x=>[...x]);
  const rng=n=>{const saved=tape[index++];if(saved){if(saved[0]!==n)throw Error('Blackjack RNG replay mismatch');return saved[1];}const v=randomInt(n);tape.push([n,v]);return v;};
  let hand=createBlackjackHand({randomInt:rng,...blackjackProfileOptions(97)});
  for(const action of state.actions)hand=bjActions[action](hand);
  return {hand,tape};
}
function publicHand(hand,revision){return {...blackjackPublicView(hand,{revealed:hand.revealed,settled:hand.phase==='resolved'}),phase:hand.phase,version:revision};}
export function createHuevoService({db,api,now=Date.now}){
  const stmt=(sql,...args)=>db.prepare(sql).bind(...args);
  const first=(sql,...args)=>stmt(sql,...args).first();
  const guard=()=>[stmt('INSERT INTO huevo_write_guard(ok) VALUES (changes())'),stmt('DELETE FROM huevo_write_guard')];
  const wallet=async owner=>{await stmt('INSERT OR IGNORE INTO huevo_wallets(owner) VALUES (?)',owner).run();return first('SELECT * FROM huevo_wallets WHERE owner=?',owner);};
  async function oldOperation(id,owner,fp){const old=await first('SELECT * FROM huevo_operations WHERE id=?',id);if(!old)return null;if(old.owner!==owner||old.fingerprint!==fp)throw new HuevoError(409,'idempotency_conflict');return JSON.parse(old.response);}
  async function commit(id,owner,fp,result,w,balance,extra=[]){
    try{await db.batch([stmt('INSERT INTO huevo_operations(id,owner,fingerprint,response,created) VALUES(?,?,?,?,?)',id,owner,fp,JSON.stringify(result),now()),
      stmt('UPDATE huevo_wallets SET balance=?, revision=revision+1 WHERE owner=? AND revision=?',balance,owner,w.revision),...guard(),...extra]);}
    catch(error){const old=await oldOperation(id,owner,fp);if(old)return old;throw new HuevoError(409,'retry_same_request','Повтори этот же запрос: состояние счёта изменилось.');}
    return result;
  }
  async function session(s){const owner=huevoOwner(s);
    const deposits=(await stmt("SELECT * FROM huevo_deposits WHERE owner=? AND status='pending' AND intent IS NOT NULL LIMIT 5",owner).all()).results;
    for(const d of deposits)try{await reconcile(s,d.intent);}catch{}
    const w=await wallet(owner);const active=await first('SELECT * FROM huevo_hands WHERE owner=? AND closed=0 ORDER BY rowid DESC LIMIT 1',owner);
    let hand=null;if(active){const state=JSON.parse(active.state),r=replayHand(state);hand={...state.record,hand:publicHand(r.hand,active.revision)};}
    const pendingWithdrawals=(await stmt("SELECT id,amount FROM huevo_withdrawals WHERE owner=? AND status='pending' ORDER BY rowid LIMIT 1",owner).all()).results;
    const pendingDeposits=(await stmt("SELECT id,amount FROM huevo_deposits WHERE owner=? AND status='pending' ORDER BY rowid LIMIT 1",owner).all()).results;
    return {user:{id:s.userId,username:s.username,displayName:s.displayName},mode:s.mode,wallet:{balanceCents:w.balance,revision:w.revision},config,activeBlackjack:hand,pendingOperation:pendingWithdrawals[0]?{...pendingWithdrawals[0],kind:'withdraw'}:pendingDeposits[0]?{...pendingDeposits[0],kind:'deposit'}:null};
  }
  async function round(s,body){
    const owner=huevoOwner(s),{id,game,choice,stake,options={}}=body;
    if(!validKey(id)||!['coinflip','dice','plinko','roulette','upgrader','slots','maskhouse','lecipher'].includes(game)||!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(k=>!['mode','bonusTier','featureMode'].includes(k))||options.mode==='preview')throw new HuevoError(400,'invalid_round');
    const fp=fingerprint({game,choice,stake,options}),old=await oldOperation(id,owner,fp);if(old)return old;
    if(await first('SELECT id FROM huevo_hands WHERE owner=? AND closed=0',owner))throw new HuevoError(409,'blackjack_in_progress');
    const w=await wallet(owner);
    // The shared pure engine runs on the server. This accounting-only capital
    // never reads the platform bankroll and never filters accepted outcomes.
    const h=new HallSession(GameMath,randomInt,{...settings,initialBalanceCents:w.balance,houseCapitalCents:1000000000000000});
    let accepted;try{accepted=h.begin(game,choice,stake,options);h.complete(accepted.id);}catch(error){throw new HuevoError(400,'round_rejected',error.message.replaceAll('демо-фишек','средств'));}
    const result={round:{...accepted,id},wallet:{balanceCents:h.balanceCents,revision:w.revision+1}};
    return commit(id,owner,fp,result,w,h.balanceCents);
  }
  async function blackjack(s,body){
    const owner=huevoOwner(s),{id,action,roundId,version,stake}=body;
    if(!validKey(id)||!['begin',...Object.keys(bjActions)].includes(action))throw new HuevoError(400,'invalid_action');
    const fp=fingerprint(body),old=await oldOperation(id,owner,fp);if(old)return old;
    const w=await wallet(owner);let state,hand,tape,handId,handRevision=0,balance=w.balance,extra=[];
    if(action==='begin'){
      const active=await first('SELECT * FROM huevo_hands WHERE owner=? AND closed=0',owner);
      if(active)throw new HuevoError(409,'blackjack_in_progress');
      const h=new HallSession(GameMath,randomInt,{...settings,initialBalanceCents:w.balance,houseCapitalCents:1000000000000000});
      // Shared stake validation and public settings, without drawing a second hand.
      const limits=config.stakeLimits.blackjack;
      if(!Number.isInteger(stake)||stake<limits.min||stake>limits.max||(stake-limits.min)%limits.step||stake*100>w.balance)throw new HuevoError(400,'invalid_stake');
      state={tape:[],actions:[],record:{id,game:'blackjack',mode:'paid',preview:false,stake,stakeCents:stake*100,chargeCents:stake*100,cost:stake,openingCents:w.balance,rtpProfile:classicProfileSnapshot('blackjack',97),profileRevision:1,settingsRevision:1,stakeLimits:limits,presentation:h.getSnapshot().presentation}};
      ({hand,tape}=replayHand(state));state.tape=tape;handId=id;balance-=stake*100;
      extra=[stmt('INSERT INTO huevo_hands(id,owner,state) VALUES(?,?,?)',id,owner,JSON.stringify(state))];
    }else{
      const saved=await first('SELECT * FROM huevo_hands WHERE id=? AND owner=?',roundId,owner);
      if(!saved||saved.closed||saved.revision!==version)throw new HuevoError(409,'stale_hand');
      state=JSON.parse(saved.state);({hand,tape}=replayHand(state));
      // Replay with a recorder that retains all new random draws from this move.
      let cursor=0;const rng=n=>{const p=tape[cursor++];if(p){if(p[0]!==n)throw Error('RNG mismatch');return p[1];}const v=randomInt(n);tape.push([n,v]);return v;};
      hand=createBlackjackHand({randomInt:rng,...blackjackProfileOptions(97)});for(const a of state.actions)hand=bjActions[a](hand);
      try{hand=bjActions[action](hand);}catch(error){throw new HuevoError(400,'invalid_action',error.message);}
      state.tape=tape;state.actions.push(action);handId=roundId;handRevision=saved.revision+1;
      if(hand.phase==='resolved'){const outcome=evaluateBlackjack(hand),payoutCents=state.record.stakeCents*outcome.payoutMultiplier;
        balance+=payoutCents;state.record={...state.record,...outcome,label:outcome.title,payoutCents,payout:payoutCents/100,netCents:payoutCents-state.record.chargeCents,net:(payoutCents-state.record.chargeCents)/100,won:payoutCents>state.record.chargeCents};}
      extra=[stmt('UPDATE huevo_hands SET state=?,revision=revision+1,closed=? WHERE id=? AND owner=? AND revision=?',JSON.stringify(state),hand.phase==='resolved'?1:0,handId,owner,saved.revision),...guard()];
    }
    const result={round:{...state.record,hand:publicHand(hand,handRevision)},wallet:{balanceCents:balance,revision:w.revision+1}};
    return commit(id,owner,fp,result,w,balance,extra);
  }
  async function deposit(s,{id,amount}){
    if(!validKey(id))throw new HuevoError(400,'invalid_key');platformAmount(amount);const owner=huevoOwner(s),grossCents=amount*100,quote=quoteHuevoDeposit(grossCents);
    await wallet(owner);await stmt('INSERT OR IGNORE INTO huevo_deposits(id,owner,amount) VALUES(?,?,?)',id,owner,amount).run();
    const d=await first('SELECT * FROM huevo_deposits WHERE id=?',id);if(d.owner!==owner||d.amount!==amount)throw new HuevoError(409,'idempotency_conflict');
    const p=await api('POST','/payments',{user_id:s.userId,amount,description:`MASQ: пополнение ${amount}. Комиссия 5%: ${quote.feeUnits/100}. На игровой баланс: ${quote.creditUnits/100}.`,idempotency_key:id,test:s.mode==='test'});
    validatePayment(p,s,d);await stmt('UPDATE huevo_deposits SET intent=? WHERE id=?',p.intent_id,id).run();
    return {intentId:p.intent_id,status:p.status,quote:{grossCents,feeCents:quote.feeUnits,creditCents:quote.creditUnits},test:p.test};
  }
  function validatePayment(p,s,d){if(typeof p.intent_id!=='string'||!/^pi_[a-zA-Z0-9_-]+$/.test(p.intent_id)||p.user_id!==s.userId||p.amount!==d.amount||p.test!==(s.mode==='test')||!['pending','succeeded','failed','cancelled','expired'].includes(p.status))throw new HuevoError(502,'payment_mismatch');}
  async function reconcile(s,intent){
    const owner=huevoOwner(s),d=await first('SELECT * FROM huevo_deposits WHERE intent=? AND owner=?',intent,owner);if(!d)throw new HuevoError(404,'payment_not_found');
    const p=await api('GET','/payments/'+intent);validatePayment(p,s,d);
    if(p.status==='succeeded'&&!d.credited){const credit=quoteHuevoDeposit(d.amount*100).creditUnits;
      try{await db.batch([stmt('UPDATE huevo_deposits SET credited=1,status=? WHERE id=? AND credited=0',p.status,d.id),...guard(),stmt('UPDATE huevo_wallets SET balance=balance+?,revision=revision+1 WHERE owner=?',credit,owner),...guard()]);}
      catch(error){const latest=await first('SELECT credited FROM huevo_deposits WHERE id=?',d.id);if(!latest?.credited)throw error;}
    }else await stmt('UPDATE huevo_deposits SET status=? WHERE id=?',p.status,d.id).run();
    const w=await wallet(owner);return {status:p.status,test:p.test,wallet:{balanceCents:w.balance,revision:w.revision}};
  }
  async function withdraw(s,{id,amount}){
    const owner=huevoOwner(s);if(!validKey(id))throw new HuevoError(400,'invalid_key');platformAmount(amount);
    let d=await first('SELECT * FROM huevo_withdrawals WHERE id=?',id);
    if(!d){const w=await wallet(owner);if(await first('SELECT id FROM huevo_hands WHERE owner=? AND closed=0',owner))throw new HuevoError(409,'blackjack_in_progress');if(amount*100>w.balance)throw new HuevoError(400,'insufficient_funds');
      try{await db.batch([stmt('INSERT INTO huevo_withdrawals(id,owner,amount) VALUES(?,?,?)',id,owner,amount),stmt('UPDATE huevo_wallets SET balance=balance-?,revision=revision+1 WHERE owner=? AND revision=? AND balance>=?',amount*100,owner,w.revision,amount*100),...guard()]);}
      catch{d=await first('SELECT * FROM huevo_withdrawals WHERE id=?',id);if(!d)throw new HuevoError(409,'retry_same_request');}
      d=await first('SELECT * FROM huevo_withdrawals WHERE id=?',id);
    }
    if(d.owner!==owner||d.amount!==amount)throw new HuevoError(409,'idempotency_conflict');
    if(d.status==='pending'){
      let p;try{p=await api('POST','/credits',{user_id:s.userId,amount,reason:'Вывод с игрового баланса MASQ',idempotency_key:id,test:s.mode==='test'});}
      catch(error){
        // Timeout/5xx/429 may hide a successful transfer: keep the hold and
        // retry the exact same platform key. Only a definite rejection refunds.
        if([400,403,404,409].includes(error.status)&&!['idempotency_conflict'].includes(error.code)){
          try{await db.batch([stmt("UPDATE huevo_withdrawals SET status='failed',receipt=? WHERE id=? AND status='pending'",JSON.stringify({code:error.code}),id),...guard(),stmt('UPDATE huevo_wallets SET balance=balance+?,revision=revision+1 WHERE owner=?',amount*100,owner),...guard()]);}catch{}
        }throw error;
      }
      if(p.status!=='succeeded'||p.user_id!==s.userId||p.amount!==amount||p.test!==(s.mode==='test'))throw new HuevoError(502,'credit_mismatch');
      await stmt("UPDATE huevo_withdrawals SET status='succeeded',receipt=? WHERE id=? AND status='pending'",JSON.stringify({creditId:p.credit_id,test:p.test}),id).run();
    }
    d=await first('SELECT * FROM huevo_withdrawals WHERE id=?',id);const w=await wallet(owner);
    return {status:d.status,receipt:d.receipt?JSON.parse(d.receipt):null,wallet:{balanceCents:w.balance,revision:w.revision}};
  }
  async function operation(s,id){const saved=await first('SELECT response FROM huevo_operations WHERE id=? AND owner=?',id,huevoOwner(s));if(!saved)throw new HuevoError(404,'operation_not_found');return JSON.parse(saved.response);}
  return {session,round,blackjack,deposit,reconcile,withdraw,operation};
}
