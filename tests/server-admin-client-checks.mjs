import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformWithOxc} from 'vite';
import {ADMIN_DEFAULTS} from '../src/demo-admin-controls.js';
import {createServerAdminClient,ServerAdminError} from '../src/integrations/server-admin-client.js';

const now=()=>1800000000000;
const bearer='serverBearerCredential_01234567890123456789';
const claim={accountId:'owner-1',username:'deathlain',minecraftUUID:'b6979f4aa0414f1b8f357159248cc59c',timestamp:1800000000,roles:['member'],isAdmin:false,hash:'a'.repeat(64)};
const profile={accountId:claim.accountId,username:claim.username,minecraftUUID:claim.minecraftUUID};
const auth=()=>({profile,capabilities:['settings:read','settings:write','audit:read'],token:bearer,expiresAt:now()+600000});
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8'}});
const settings=()=>structuredClone(ADMIN_DEFAULTS);
const assertCode=code=>error=>error instanceof ServerAdminError&&error.code===code;
const calls=[];
let revision=1,current=settings(),conflict=false;
const client=createServerAdminClient({now,fetchImpl:async(path,options)=>{
  calls.push({path,options});
  if(path==='/api/auth/spw')return json(auth());
  if(path==='/api/auth/session')return json({ok:true});
  if(path.startsWith('/api/admin/audit'))return json({entries:[{id:1,revision:2,actor:{accountId:'owner-1',username:'deathlain'},reason:'Change global profile',createdAt:now(),before:settings(),after:current}],nextCursor:null});
  if(options.method==='PUT'){
    if(conflict)return json({error:{code:'REVISION_CONFLICT',message:`do not expose ${bearer}`}},409);
    const body=JSON.parse(options.body);assert.equal(body.expectedRevision,revision);current=body.settings;revision++;return json({settings:current,revision,changed:true});
  }
  return json({settings:current,revision});
}});
await assert.rejects(client.getSettings(),assertCode('SESSION_EXPIRED'));
const signedIn=await client.authenticate(claim);
assert.deepEqual(signedIn,{authenticated:true,profile,capabilities:['settings:read','settings:write','audit:read'],expiresAt:now()+600000});
assert.equal(calls[0].options.headers.Authorization,undefined,'Auth request cannot reuse an old bearer');
assert.deepEqual(JSON.parse(calls[0].options.body),claim,'Signed profile is sent intact to verification endpoint');
for(const exposed of [signedIn,client.getStatus(),client.capabilities,JSON.parse(JSON.stringify(client))]){
  const text=JSON.stringify(exposed);assert.ok(!text.includes(bearer));assert.ok(!text.includes(claim.hash));assert.ok(!text.includes('isAdmin'));assert.ok(!text.includes('roles'));
}
const publicStatus=client.getStatus();publicStatus.capabilities.length=0;publicStatus.profile.username='changed';
assert.equal(client.capabilities.length,3);assert.equal(client.getStatus().profile.username,'deathlain','Caller cannot mutate session permission state');
const loaded=await client.getSettings();assert.equal(loaded.revision,1);
assert.equal(calls.at(-1).path,'/api/admin/settings');
assert.equal(calls.at(-1).options.headers.Authorization,`Bearer ${bearer}`);
assert.equal(calls.at(-1).options.credentials,'omit');assert.equal(calls.at(-1).options.redirect,'error');
current=structuredClone(loaded.settings);current.rtpProfiles.slots=56;
const saved=await client.saveSettings({expectedRevision:1,settings:current,reason:'  Change global profile  '});
assert.equal(saved.revision,2);assert.equal(saved.settings.rtpProfiles.slots,56);
assert.equal(JSON.parse(calls.at(-1).options.body).reason,'Change global profile');
const audit=await client.getAudit({limit:50});assert.equal(audit.entries[0].revision,2);assert.equal(audit.entries[0].actor.username,'deathlain');
conflict=true;
await assert.rejects(client.saveSettings({expectedRevision:1,settings:settings(),reason:'Stale write'}),error=>{
  assert.equal(error.status,409);assert.equal(error.code,'REVISION_CONFLICT');assert.ok(!error.message.includes(bearer));return true;
});
assert.equal(client.authenticated,true,'Revision conflict preserves authenticated session');
assert.equal((await client.getSettings()).revision,2,'Conflict can refresh baseline without replacing UI draft');
for(const args of [{expectedRevision:0,settings:settings(),reason:'x'},{expectedRevision:2,settings:settings(),reason:'  '},{expectedRevision:2,settings:{},reason:'x'}]){
  const count=calls.length;await assert.rejects(client.saveSettings(args));assert.equal(calls.length,count,'Invalid mutation never reaches server');
}
await assert.rejects(client.getAudit({limit:1000}),assertCode('INVALID_REQUEST'));
await assert.rejects(client.getAudit({cursor:'https://evil.test'}),assertCode('INVALID_REQUEST'));
await client.revokeSession();assert.equal(calls.at(-1).path,'/api/auth/session');assert.equal(calls.at(-1).options.method,'DELETE');
assert.deepEqual(client.getStatus(),{authenticated:false,profile:null,capabilities:[],expiresAt:null});

const expired=createServerAdminClient({now,fetchImpl:async(path)=>path==='/api/auth/spw'?json(auth()):new Response('not JSON',{status:401})});
await expired.authenticate(claim);
await assert.rejects(expired.getSettings(),error=>error.status===401&&error.code==='SESSION_EXPIRED');
assert.equal(expired.authenticated,false,'Malformed 401 still removes bearer credential');

const nonOwner=createServerAdminClient({now,fetchImpl:async path=>path==='/api/auth/spw'?json({...auth(),capabilities:[]}):json({error:{code:'FORBIDDEN',message:bearer}},403)});
await nonOwner.authenticate(claim);assert.equal(nonOwner.authenticated,true);assert.deepEqual(nonOwner.capabilities,[]);
await assert.rejects(nonOwner.getSettings(),assertCode('FORBIDDEN'));assert.equal(nonOwner.authenticated,true,'Denied admin permission does not fabricate an admin session');

let clock=now();const automaticExpiry=createServerAdminClient({now:()=>clock,fetchImpl:async()=>json(auth())});
await automaticExpiry.authenticate(claim);clock+=600001;assert.equal(automaticExpiry.authenticated,false);
await assert.rejects(automaticExpiry.getSettings(),assertCode('SESSION_EXPIRED'));

const malformed=createServerAdminClient({now,fetchImpl:async()=>json({...auth(),profile:{...profile,token:bearer,roles:['owner']}})});
await malformed.authenticate(claim);assert.deepEqual(malformed.getStatus().profile,profile,'Only three safe display fields reach UI');
for(const response of [json({...auth(),token:'token with spaces'}),json({...auth(),capabilities:['isAdmin']}),json({...auth(),expiresAt:now()-1}),new Response('<html>secret</html>',{status:200,headers:{'Content-Type':'text/html'}})]){
  const invalid=createServerAdminClient({now,fetchImpl:async()=>response});
  await assert.rejects(invalid.authenticate(claim),assertCode('INVALID_RESPONSE'));assert.equal(invalid.authenticated,false);
}
const huge=createServerAdminClient({now,maxResponseBytes:1024,fetchImpl:async()=>json({...auth(),ignored:'x'.repeat(2000)})});
await assert.rejects(huge.authenticate(claim),assertCode('INVALID_RESPONSE'));
const timed=createServerAdminClient({now,timeoutMs:5,fetchImpl:async()=>new Promise(()=>{})});
await assert.rejects(timed.authenticate(claim),assertCode('TIMEOUT'));
const cancel=new AbortController(),aborted=createServerAdminClient({now,fetchImpl:async()=>new Promise(()=>{})});
const waiting=aborted.authenticate(claim,{signal:cancel.signal});cancel.abort();await assert.rejects(waiting,assertCode('ABORTED'));
let resolveDelayed;
const cancelledLogin=createServerAdminClient({now,fetchImpl:async()=>new Promise(resolve=>{resolveDelayed=resolve;})});
const login=cancelledLogin.authenticate(claim);cancelledLogin.logout();resolveDelayed(json(auth()));
await assert.rejects(login,assertCode('ABORTED'));assert.equal(cancelledLogin.authenticated,false,'A late login response cannot restore a logged-out session');
const revokeFailure=createServerAdminClient({now,fetchImpl:async(path)=>path==='/api/auth/spw'?json(auth()):json({error:{code:'SERVER_ERROR'}},500)});
await revokeFailure.authenticate(claim);await assert.rejects(revokeFailure.revokeSession());assert.equal(revokeFailure.authenticated,false,'Failed server revoke still erases local bearer');

// Render the actual dashboard with a hook-safe server render. This verifies
// financial limitations and the authenticated server presentation, not a
// second implementation of its API or game mathematics.
const componentURL=new URL('../src/ServerAdminPanel.jsx',import.meta.url);
let source=await fs.readFile(componentURL,'utf8');
source=source.replace(/import ['"]\.\/[^'"\n]+\.css['"];?\r?\n/g,'')
  .replace(/from ['"]react['"]/g,'from '+JSON.stringify(new URL('../node_modules/react/index.js',import.meta.url).href))
  .replace(/from ['"](\.\/[^'"]+\.js)['"]/g,(_,relative)=>'from '+JSON.stringify(new URL(relative,componentURL).href));
const transformed=await transformWithOxc(source,'ServerAdminPanel.jsx',{jsx:{runtime:'classic'}});
const Component=(await import('data:text/javascript;base64,'+Buffer.from(transformed.code).toString('base64'))).default;
const html=renderToStaticMarkup(React.createElement(Component,{client:{getStatus:()=>signedIn},onClose:()=>{}}));
assert.match(html,/Панель администратора/);assert.match(html,/Настройки хранятся на сервере/);
assert.match(html,/Игровой сервер и платежи ещё не подключены/);assert.match(html,/Реальные АР недоступны/);
assert.ok(!html.includes(bearer));assert.ok(!html.includes(claim.hash));
console.log('Server admin client checks passed: memory-only session, bounded same-origin API, expiry, revision conflicts, cancellation, revocation and dashboard disclosure.');
