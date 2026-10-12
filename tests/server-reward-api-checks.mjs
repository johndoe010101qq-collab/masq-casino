import assert from 'node:assert/strict';
import {createHmac,createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative} from 'node:path';
import {createAdminServer} from '../server/admin-server.mjs';
import {createServerAdminClient} from '../src/integrations/server-admin-client.js';
import {DEFAULT_REWARD_POLICY,validateRewardPolicy} from '../server/reward-bank.mjs';
import {cleanRewardPolicy} from '../src/reward-policy.js';
const clock=()=>1800000000000,origin='http://127.0.0.1:5188';
const directory=mkdtempSync(join(tmpdir(),'masq-reward-api-'));
const databasePath=join(directory,'admin.sqlite');
const secret='synthetic-reward-api-only';
const env={SPW_APP_TOKEN:secret,MASQ_OWNER_ACCOUNT_IDS:'owner',SPW_TIMESTAMP_UNIT:'milliseconds'};
const claim=accountId=>{
  const value={accountId,username:'fixture',minecraftUUID:'00000000-0000-4000-8000-000000000000',timestamp:clock(),roles:[],isAdmin:false};
  const check=Object.keys(value).sort().filter(k=>value[k]).map(k=>k+'='+value[k]).join('\n');
  return {...value,hash:createHmac('sha256',createHash('sha256').update(secret).digest()).update(check).digest('hex')};
};
let application,base;
async function start(){application=createAdminServer({env,databasePath,appOrigin:origin,now:clock});await new Promise(resolveListen=>application.server.listen(0,'127.0.0.1',resolveListen));base='http://127.0.0.1:'+application.server.address().port;}
const adapter=(path,options)=>fetch(base+path,{...options,headers:{...options.headers,Origin:origin}});
try{
  await start();
  assert.equal((await fetch(base+'/api/admin/rewards')).status,401);
  const player=createServerAdminClient({now:clock,fetchImpl:adapter});await player.authenticate(claim('player'));
  await assert.rejects(player.getRewardBank(),error=>error.status===403);
  const owner=createServerAdminClient({now:clock,fetchImpl:adapter});await owner.authenticate(claim('owner'));
  const initial=await owner.getRewardBank();
  assert.equal(initial.authorityConfigured,false);assert.equal(initial.availableBudgetCents,0);assert.equal(initial.roundCount,0);
  assert.deepEqual(initial.settings,DEFAULT_REWARD_POLICY);assert.equal(initial.settingsRevision,1);
  const settings={...initial.settings,minStakeMultiple:12,maxStakeMultiple:25,maxWinners:4};
  assert.deepEqual(cleanRewardPolicy(settings),validateRewardPolicy(settings));
  const saved=await owner.saveRewardPolicy({settings,expectedRevision:1,reason:'Test global rewards policy'});
  assert.equal(saved.settingsRevision,2);assert.equal(saved.authorityConfigured,false);assert.equal(saved.changed,true);
  assert.deepEqual(saved.settings,settings);assert.equal(saved.availableBudgetCents,0);
  await assert.rejects(owner.saveRewardPolicy({settings:initial.settings,expectedRevision:1,reason:'Stale policy'}),error=>error.status===409);
  await assert.rejects(owner.saveRewardPolicy({settings:{...settings,minStakeMultiple:40},expectedRevision:2,reason:'Invalid ranges'}),error=>error.code==='INVALID_SETTINGS');
  await assert.rejects(owner.saveRewardPolicy({settings,expectedRevision:2,reason:''}),error=>error.code==='INVALID_REASON');
  // Neither authenticated nor unauthenticated browser requests can feed the
  // bank alleged profit or trigger payments: only settings GET/PUT exist.
  assert.equal((await adapter('/api/admin/rewards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profitCents:1000000})})).status,405);
  assert.equal((await adapter('/api/admin/rewards/draw',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,404);
  assert.equal((await adapter('/api/admin/rewards/rounds',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,404);
  assert.equal((await owner.getRewardBank()).roundCount,0);
  const config=await(await fetch(base+'/api/config')).json();assert.equal(config.currencyMode,'unavailable');
  await application.close();application=null;await start();
  const reloaded=createServerAdminClient({now:clock,fetchImpl:adapter});await reloaded.authenticate(claim('owner'));
  assert.deepEqual((await reloaded.getRewardBank()).settings,settings);assert.equal((await reloaded.getRewardBank()).settingsRevision,2);
  assert.equal((await reloaded.getRewardBank()).authorityConfigured,false);
  console.log('Reward API passed: owner-only durable configuration, version conflicts, full policy validation, no browser funding/draw/credit routes.');
}finally{
  if(application)await application.close();
  const checked=resolve(directory),inside=relative(resolve(tmpdir()),checked);
  if(inside.startsWith('..')||!inside.startsWith('masq-reward-api-'))throw new Error('Unexpected test cleanup directory');
  rmSync(checked,{recursive:true,force:true});
}
