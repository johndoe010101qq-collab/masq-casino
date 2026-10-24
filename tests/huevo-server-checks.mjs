import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash,createHmac} from 'node:crypto';
import {verifyHuevoLaunch,issueHuevoSession,verifyHuevoSession,verifyHuevoCallback,HuevoError} from '../server/huevo-protocol.mjs';
import {createHuevoService} from '../server/huevo-service.mjs';
import {handleHuevoRequest} from '../server/huevo-handler.mjs';
import {HuevoSession} from '../src/integrations/huevo-session.js';
import {RemoteBlackjackPresentation} from '../src/RemoteBlackjackPresentation.js';
import {classicProfileSnapshot} from '../src/classic-rtp-profiles.js';
import {createBlackjackHand,finishBlackjack,blackjackPublicView,evaluateBlackjack} from '../src/blackjack.js';

const secret='test-fixture-only-never-a-real-secret',now=1800000000000;
function sign(extra={}){const p={hu_app_id:'221',hu_user_id:'42',hu_username:'tester',hu_display_name:'Имя & =',hu_mode:'test',hu_ts:String(now/1000),hu_future:'✓',...extra};
 const data=Object.keys(p).sort().map(k=>k+'='+p[k]).join('\n');p.hu_hash=createHmac('sha256',createHash('sha256').update(secret).digest()).update(data).digest('hex');return '?'+new URLSearchParams(p);}
const signed=sign(),identity=verifyHuevoLaunch(signed,secret,'221',{now});assert.equal(identity.userId,42);assert.equal(identity.displayName,'Имя & =');
for(const q of [signed.replace('hu_user_id=42','hu_user_id=43'),signed+'&hu_user_id=42',sign({hu_app_id:'222'}),sign({hu_ts:String(now/1000+1)}),sign({hu_ts:String(now/1000-86401)}),sign({hu_mode:'invalid'}),sign({hu_user_id:'-2'}),sign({hu_future:'bad\nvalue'})])assert.throws(()=>verifyHuevoLaunch(q,secret,'221',{now}));
const token=issueHuevoSession(identity,secret,{now,appId:'221'});assert.equal(verifyHuevoSession(token,secret,{now,appId:'221'}).mode,'test');assert.throws(()=>verifyHuevoSession(token+'a',secret,{now,appId:'221'}));assert.throws(()=>verifyHuevoSession(token,secret,{now:now+43201000,appId:'221'}));
const raw='{"event":"payment"}',sig=createHmac('sha256',createHash('sha256').update(secret).digest()).update(raw).digest('hex');assert.ok(verifyHuevoCallback(raw,sig,secret));assert.ok(!verifyHuevoCallback(raw+' ',sig,secret));

const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync(new URL('../server/huevo-schema.sql',import.meta.url),'utf8'));
const wrap=(sql,args=[])=>({bind(...values){return wrap(sql,values);},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){return sqlite.prepare(sql).run(...args);},execute(){return sqlite.prepare(sql).run(...args);}});
const db={prepare:sql=>wrap(sql),async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const result=statements.map(s=>s.execute());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
const payments=new Map(),credits=new Map();let creditEffects=0,loseResponse=false,rejectCredit=false;
const api=async(method,path,body)=>{
 if(path==='/payments'&&method==='POST'){
  let p=payments.get(body.idempotency_key);if(!p){p={intent_id:'pi_'+body.idempotency_key,status:'pending',amount:body.amount,user_id:body.user_id,test:body.test};payments.set(body.idempotency_key,p);}return p;
 }
 if(path.startsWith('/payments/'))return [...payments.values()].find(p=>p.intent_id===path.slice(10));
 if(path==='/credits'){
  if(rejectCredit)throw new HuevoError(409,'insufficient_wallet');let p=credits.get(body.idempotency_key);
  if(!p){creditEffects++;p={credit_id:creditEffects,status:'succeeded',amount:body.amount,user_id:body.user_id,test:body.test};credits.set(body.idempotency_key,p);}
  if(loseResponse){loseResponse=false;throw new HuevoError(502,'platform_unavailable');}return p;
 }throw Error(path);
};
let service=createHuevoService({db,api,now:()=>now});const s={...identity};
assert.equal((await service.session(s)).wallet.balanceCents,0);
await assert.rejects(service.round(s,{id:'round-0001',game:'dice',choice:1,stake:5}),/средств/);
const d=await service.deposit(s,{id:'deposit-0001',amount:100});assert.deepEqual(d.quote,{grossCents:10000,feeCents:500,creditCents:9500});assert.equal((await service.session(s)).wallet.balanceCents,0);
payments.get('deposit-0001').status='succeeded';await Promise.all([service.reconcile(s,d.intentId),service.reconcile(s,d.intentId)]);assert.equal((await service.session(s)).wallet.balanceCents,9500);
await service.reconcile(s,d.intentId);assert.equal((await service.session(s)).wallet.balanceCents,9500);
await assert.rejects(service.reconcile({...s,userId:43},d.intentId),e=>e.status===404);
assert.equal((await service.session({...s,mode:'live'})).wallet.balanceCents,0,'No test credit can become live credit');
const r=await service.round(s,{id:'round-0002',game:'dice',choice:1,stake:5});const after=(await service.session(s)).wallet.balanceCents;
assert.deepEqual(await service.round(s,{id:'round-0002',game:'dice',choice:1,stake:5}),r);assert.equal((await service.session(s)).wallet.balanceCents,after);await assert.rejects(service.round(s,{id:'round-0002',game:'dice',choice:2,stake:5}),e=>e.code==='idempotency_conflict');
const bj=await service.blackjack(s,{id:'blackjack-0001',action:'begin',stake:5});assert.equal(bj.round.hand.dealer[1].hidden,true);assert.ok(!('shoe' in bj.round.hand));assert.ok(!JSON.stringify(bj).includes('tape'));const initialHand=bj.round.hand;
service=createHuevoService({db,api,now:()=>now});assert.deepEqual((await service.session(s)).activeBlackjack.hand,initialHand,'Restart resumes the exact funded hand');
await assert.rejects(service.round(s,{id:'round-0003',game:'dice',choice:1,stake:5}),e=>e.code==='blackjack_in_progress');
const finished=await service.blackjack(s,{id:'blackjack-finish-0001',action:'finish',roundId:bj.round.id,version:0});assert.equal(finished.round.hand.phase,'resolved');assert.ok(finished.round.hand.dealer.every(c=>!c.hidden));const bjAfter=(await service.session(s)).wallet.balanceCents;
assert.deepEqual(await service.blackjack(s,{id:'blackjack-finish-0001',action:'finish',roundId:bj.round.id,version:0}),finished);assert.equal((await service.session(s)).wallet.balanceCents,bjAfter);
loseResponse=true;await assert.rejects(service.withdraw(s,{id:'withdraw-0001',amount:10}),e=>e.status===502);assert.equal((await service.session(s)).wallet.balanceCents,bjAfter-1000);
await service.withdraw(s,{id:'withdraw-0001',amount:10});await service.withdraw(s,{id:'withdraw-0001',amount:10});assert.equal(creditEffects,1,'A lost successful response never pays twice');assert.equal((await service.session(s)).wallet.balanceCents,bjAfter-1000);
rejectCredit=true;await assert.rejects(service.withdraw(s,{id:'withdraw-0002',amount:5}),e=>e.code==='insufficient_wallet');assert.equal((await service.session(s)).wallet.balanceCents,bjAfter-1000,'A definite rejected transfer refunds once');rejectCredit=false;
await assert.rejects(service.withdraw(s,{id:'withdraw-0001',amount:9}),e=>e.code==='idempotency_conflict');
// Restoring SQLite after serializable CAS failure cannot leave an operation receipt.
const revision=(await service.session(s)).wallet.revision;const batch=[db.prepare("INSERT INTO huevo_operations(id,owner,fingerprint,response,created) VALUES ('rollback-test','test:42','x','{}',0)"),db.prepare('INSERT INTO huevo_write_guard(ok) VALUES(0)')];await assert.rejects(db.batch(batch));assert.equal(await db.prepare("SELECT id FROM huevo_operations WHERE id='rollback-test'").first(),null);assert.equal((await service.session(s)).wallet.revision,revision);
const env={HUEVO_DB:db,HUEVO_APP_ID:'221',HUEVO_CLIENT_ID:'public-fixture-id',HUEVO_CLIENT_SECRET:secret,HUEVO_LIVE_ENABLED:'false'};
const request=(path,body,auth)=>new Request('https://game.example/api/huevo'+path,{method:'POST',headers:{Origin:'https://game.example','Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},body:JSON.stringify(body)});
const login=await handleHuevoRequest(request('/login',{query:signed}),env,{api,now:()=>now});assert.equal(login.status,200);
assert.equal((await handleHuevoRequest(request('/login',{query:sign({hu_mode:'live'})}),env,{api,now:()=>now})).status,403);
assert.equal((await handleHuevoRequest(request('/rounds',{id:'forged-0001',game:'dice',choice:1,stake:5},'fake'),env,{api,now:()=>now})).status,401);
assert.equal((await handleHuevoRequest(new Request('https://game.example/api/huevo/health'),{})).status,200);
const eventBody=Buffer.from(JSON.stringify({event:'payment',app_id:221,intent_id:d.intentId,user_id:42,test:true,status:'succeeded',note:'Проверка байтов'}));
const eventSignature=createHmac('sha256',createHash('sha256').update(secret).digest()).update(eventBody).digest('hex');
const callback=body=>new Request('https://game.example/api/huevo/callback',{method:'POST',headers:{'Content-Type':'application/json','X-Huevo-Signature':eventSignature},body});
assert.equal((await handleHuevoRequest(callback(eventBody),env,{api,now:()=>now})).status,204);
assert.equal((await handleHuevoRequest(callback(Buffer.concat([eventBody,Buffer.from(' ')])),env,{api,now:()=>now})).status,401);
assert.equal((await handleHuevoRequest(callback(Buffer.alloc(16385)),env,{api,now:()=>now})).status,413);
// Local presentation completion cannot alter the authoritative receipt or balance.
const initial=await service.session(s),latestRound=await service.round(s,{id:'round-remote-0001',game:'dice',choice:1,stake:5}),remote=new HuevoSession(initial,async()=>latestRound);const rr=await remote.begin('dice',1,5);assert.equal(rr.id,latestRound.round.id);assert.equal(remote.getSnapshot().balance,(latestRound.wallet.balanceCents-latestRound.round.payoutCents)/100);remote.complete(rr.id);assert.equal(remote.getSnapshot().balance,latestRound.wallet.balanceCents/100);assert.equal(remote.complete(rr.id),false);
const fixtureFunds=await service.deposit(s,{id:'deposit-fixture-10000',amount:10000});payments.get('deposit-fixture-10000').status='succeeded';await service.reconcile(s,fixtureFunds.intentId);
const offers=[['coinflip','heads',{}],['dice',6,{}],['plinko','standard',{}],['roulette','red',{}],['upgrader',2,{}],['slots','bonanza',{}],['slots','bonanza',{mode:'buy'}],['maskhouse','maskhouse',{}],['maskhouse','maskhouse',{mode:'buy',bonusTier:'sticky'}],['lecipher','lecipher',{}],['lecipher','lecipher',{mode:'buy',bonusTier:'luck'}],['lecipher','lecipher',{mode:'buy',bonusTier:'gold'}],['lecipher','lecipher',{featureMode:'hunt'}],['lecipher','lecipher',{featureMode:'rainbow'}]];
for(const [i,[game,choice,options]] of offers.entries()){
 const before=await service.session(s),r=await service.round(s,{id:'server-offer-check-'+i,game,choice,stake:5,options});
 assert.equal(r.wallet.balanceCents,before.wallet.balanceCents-r.round.chargeCents+r.round.payoutCents);assert.equal(r.round.rtpProfile.targetReturnPercent,92);
 assert.deepEqual(await service.operation(s,r.round.id),r);assert.ok(Number.isSafeInteger(r.round.payoutCents));
}
const bjRemote=new HuevoSession(await service.session(s),async(path,body)=>{
 if(path==='/blackjack')return service.blackjack(s,body);throw Error(path);
});
const bjRecord=await bjRemote.beginBlackjack(5);let closed=false;
const presentation=new RemoteBlackjackPresentation(bjRecord.hand,{transition:(a,h)=>bjRemote.advanceBlackjack(bjRecord.id,a,h),publicView:(h,o)=>bjRemote.blackjackView(bjRecord.id,h,o),onResolved:h=>{assert.ok(bjRemote.completeBlackjack(bjRecord.id,h));closed=true;}});
presentation.onError=e=>{throw e;};presentation.deal();
for(let step=0;step<200&&!closed;step++){presentation.flushTransitions();if(presentation.snapshot().canAct)presentation.stand();await new Promise(resolve=>setImmediate(resolve));}
assert.ok(closed,'Network transitions finish through the existing presentation clock');assert.equal(bjRemote.getSnapshot().busy,false);
// A previously accepted 97% hand retains the exact published draw parameters after the policy changes to 92%.
const legacyHand=await service.blackjack(s,{id:'legacy-profile-hand-v54',action:'begin',stake:5});
const legacyState=JSON.parse(sqlite.prepare('SELECT state FROM huevo_hands WHERE id=?').get(legacyHand.round.id).state);
legacyState.record.rtpProfile=classicProfileSnapshot('blackjack',97);
sqlite.prepare('UPDATE huevo_hands SET state=? WHERE id=?').run(JSON.stringify(legacyState),legacyHand.round.id);
assert.equal((await service.session(s)).config.classicRtpProfiles.blackjack,92);
assert.equal((await service.session(s)).activeBlackjack.rtpProfile.targetReturnPercent,97);
const legacyFinished=await service.blackjack(s,{id:'legacy-profile-finish-v54',action:'finish',roundId:legacyHand.round.id,version:0});
const savedLegacy=JSON.parse(sqlite.prepare('SELECT state FROM huevo_hands WHERE id=?').get(legacyHand.round.id).state);let tapeIndex=0;
const legacyRng=n=>{const [bound,ticket]=savedLegacy.tape[tapeIndex++];assert.equal(bound,n);return ticket;};
const expectedLegacy=finishBlackjack(createBlackjackHand({randomInt:legacyRng,dealerBoostTickets:100,playerUnfavorableTickets:0}));
assert.equal(legacyFinished.round.rtpProfile.targetReturnPercent,97);
assert.deepEqual(legacyFinished.round.hand.dealer,blackjackPublicView(expectedLegacy,{revealed:true,settled:true}).dealer);
assert.equal(legacyFinished.round.payoutCents,500*evaluateBlackjack(expectedLegacy).payoutMultiplier);
sqlite.close();console.log('PASS huEVO server: signed identity, replay protection, test/live isolation, atomic cent ledger, deposit dedup, funded blackjack replay, idempotent rounds and withdrawals, lost-response recovery, rollback and async remote presentation. No real platform transactions performed.');
