import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import SPWMini from 'spwmini/client';
import {createServerAdminClient} from '../src/integrations/server-admin-client.js';

// Execute the production hook and its actual SDK subclass. Only React's
// lifecycle scheduler, window messages, and browser timers are substituted.
// Credentials below are synthetic fixtures, never a browser account login.
const hookURL=new URL('../src/integrations/useSPWMini.js',import.meta.url);
const original=await fs.readFile(hookURL,'utf8');
const source=original.replace(/^import .+;\r?$/gm,'')
  .replaceAll('import.meta.env.VITE_SPW_VALIDATE_URL','VALIDATE_PATH')
  .replace(/export default function useSPWMini/,'function useSPWMini')
  .replace(/export (function|class) /g,'$1 ');
const loadHook=new Function('useEffect','useState','SPWMini','SPW_APP_ID','VALIDATE_PATH','window','Date',
  source+'\nreturn {useSPWMini,SPWMiniIdentityAdapter,isSPWUserData};');
const APP_ID='bd091111-ef20-4f65-8651-a88c1dd1b459';
const SPW_ORIGIN='https://spworlds.ru';
const START=1800000000000;
const CLAIM={accountId:'synthetic-owner',username:'deathlain',minecraftUUID:'b6979f4aa0414f1b8f357159248cc59c',
  timestamp:START/1000,roles:['owner'],isAdmin:true,hash:'a'.repeat(64)};
const PROFILE={accountId:CLAIM.accountId,username:CLAIM.username,minecraftUUID:CLAIM.minecraftUUID};
const BEARER='syntheticSessionCredential_01234567890123456789';
const CAPABILITIES=['settings:read','settings:write','audit:read'];
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
const flush=async()=>{for(let index=0;index<32;index++)await Promise.resolve();};
const clone=value=>structuredClone(value);

function harness({embedded=true,appId=APP_ID,validatePath='',fetchImpl,expiresIn=5000,serverCapabilities=CAPABILITIES,serverProfile=PROFILE}={}) {
  let clock=START,state,effect,cleanup,timerId=0;
  const states=[],timers=new Map(),messages=[],listeners=new Set(),requests=[];
  const parent={postMessage:(message,origin)=>messages.push({message,origin})};
  const browser={location:{origin:'https://masq.invalid'},parent,
    addEventListener:(event,listener)=>{assert.equal(event,'message');listeners.add(listener);},
    removeEventListener:(event,listener)=>{assert.equal(event,'message');listeners.delete(listener);},
    setTimeout:(handler,delay)=>{const id=++timerId;timers.set(id,{handler,due:clock+delay});return id;},
    clearTimeout:id=>timers.delete(id),
    fetch:()=>{throw new Error('The legacy validator must not be used by server authentication.');},
  };
  if(!embedded)browser.parent=browser;
  const client=createServerAdminClient({now:()=>clock,timeoutMs:1000,fetchImpl:async(path,options)=>{
    requests.push({path,options});
    if(fetchImpl)return fetchImpl(path,options);
    return json({profile:serverProfile,capabilities:serverCapabilities,token:BEARER,expiresAt:clock+expiresIn});
  }});
  const useState=initial=>{
    state=clone(initial);states.push(clone(state));
    return [state,next=>{state=typeof next==='function'?next(state):next;states.push(clone(state));}];
  };
  const useEffect=callback=>{effect=callback;};
  class Clock extends Date {static now(){return clock;}}
  const module=loadHook(useEffect,useState,SPWMini,appId,validatePath,browser,Clock);
  function mount({verify=true}={}) {
    module.useSPWMini(verify?{verifyIdentity:(claim,options)=>client.authenticate(claim,options)}:{});
    cleanup=effect();
  }
  function dispatch(payload=CLAIM,{origin=SPW_ORIGIN,source=browser.parent,type='initResponse'}={}) {
    for(const listener of [...listeners])listener({origin,source,data:{type,payload}});
  }
  async function advance(ms) {
    const target=clock+ms;
    for(;;){
      const next=[...timers.entries()].filter(([,timer])=>timer.due<=target).sort((a,b)=>a[1].due-b[1].due)[0];
      if(!next)break;
      clock=next[1].due;timers.delete(next[0]);next[1].handler();await flush();
    }
    clock=target;await flush();
  }
  function unmount(){cleanup?.();cleanup=null;}
  function assertSafeStates() {
    for(const snapshot of states){
      const serialized=JSON.stringify(snapshot);
      assert.ok(!serialized.includes(CLAIM.hash),'Signature cannot enter React state');
      assert.ok(!serialized.includes(BEARER),'Bearer cannot enter React state');
      assert.ok(!Object.hasOwn(snapshot.user||{},'roles'),'Provider roles cannot enter display profile');
      assert.ok(!Object.hasOwn(snapshot.user||{},'isAdmin'),'Provider admin metadata cannot become a casino grant');
      assert.ok(!Object.hasOwn(snapshot.user||{},'timestamp'),'Signed timestamp cannot enter display profile');
    }
  }
  return {client,module,browser,requests,messages,listeners,timers,states,mount,dispatch,advance,unmount,assertSafeStates,
    get state(){return state;},get clock(){return clock;}};
}

const standalone=harness({embedded:false});standalone.mount();await flush();
assert.equal(standalone.state.mode,'demo');assert.equal(standalone.state.status,'demo');
assert.equal(standalone.requests.length,0);assert.equal(standalone.listeners.size,0);assert.equal(standalone.timers.size,0);
standalone.unmount();standalone.assertSafeStates();

const owner=harness();
assert.ok(owner.module.SPWMiniIdentityAdapter.prototype instanceof SPWMini,'Transport extends the installed SDK, not a mock implementation');
owner.mount();
assert.equal(owner.state.status,'connecting');assert.equal(owner.listeners.size,1);assert.equal(owner.timers.size,1);
assert.deepEqual(owner.messages,[{message:{type:'init',payload:APP_ID},origin:SPW_ORIGIN}],'Initial request targets the exact SP Worlds origin');
owner.dispatch(CLAIM,{origin:'https://forged.invalid'});
owner.dispatch(CLAIM,{source:{postMessage(){}}});
owner.dispatch({...CLAIM,roles:'owner'});
owner.dispatch({...CLAIM,hash:'invalid'});
await flush();
assert.equal(owner.requests.length,0,'Untrusted windows, origins, and malformed claims cannot reach authentication');
assert.equal(owner.state.status,'connecting');
owner.dispatch();assert.equal(owner.state.status,'verifying');await flush();
assert.equal(owner.requests.length,1);assert.equal(owner.requests[0].path,'/api/auth/spw');
assert.deepEqual(JSON.parse(owner.requests[0].options.body),CLAIM,'The installed SDK passes the complete host claim to the actual server client');
assert.equal(owner.requests[0].options.headers.Authorization,undefined);
assert.equal(owner.state.status,'verified');assert.equal(owner.state.verified,true);assert.deepEqual(owner.state.user,PROFILE);
assert.deepEqual(owner.state.capabilities,CAPABILITIES);assert.equal(owner.state.sessionExpiresAt,START+5000);
assert.equal(owner.timers.size,1,'Host and verification timers are cleared; only session expiry remains');
assert.equal([...owner.timers.values()][0].due,START+5000);
owner.dispatch({...CLAIM,username:'forged-new-user'});await flush();
assert.equal(owner.requests.length,1,'The SDK accepts identity only once per initialization');assert.equal(owner.state.user.username,'deathlain');
await owner.advance(4999);assert.equal(owner.state.verified,true);
await owner.advance(1);assert.equal(owner.state.status,'expired');assert.equal(owner.state.verified,false);assert.deepEqual(owner.state.capabilities,[]);
assert.deepEqual(owner.state.user,PROFILE);assert.equal(owner.client.authenticated,false,'Expired bearer is cleared by the client status guard');
assert.equal(owner.timers.size,0);owner.assertSafeStates();
owner.unmount();assert.equal(owner.listeners.size,0);assert.equal(owner.timers.size,0);
const ownerUpdates=owner.states.length;owner.dispatch();await flush();assert.equal(owner.states.length,ownerUpdates,'Disposed SDK cannot accept later host messages');

const member=harness({serverCapabilities:[]});member.mount();member.dispatch();await flush();
assert.equal(member.state.status,'verified');assert.deepEqual(member.state.capabilities,[],'Signed provider isAdmin/owner role cannot grant casino permissions');
assert.equal(member.client.authenticated,true);member.assertSafeStates();member.unmount();
assert.equal(member.listeners.size,0);assert.equal(member.timers.size,0,'Unmount removes a still-active session timer');

const mismatch=harness({serverProfile:{...PROFILE,accountId:'another-account'}});mismatch.mount();mismatch.dispatch();await flush();
assert.equal(mismatch.state.status,'error');assert.equal(mismatch.state.verified,false);
assert.deepEqual(mismatch.state.capabilities||[],[],'Mismatched server identity cannot enter verified UI state');
assert.ok(!mismatch.states.some(state=>state.verified));assert.equal(mismatch.timers.size,0);mismatch.assertSafeStates();mismatch.unmount();

let resolvePending,capturedSignal;
const pending=harness({fetchImpl:async(_path,options)=>{capturedSignal=options.signal;return new Promise(resolve=>{resolvePending=resolve;});}});
pending.mount();pending.dispatch();assert.equal(pending.state.status,'verifying');
assert.equal(capturedSignal.aborted,false);assert.equal(pending.timers.size,1,'Pending verification keeps only its timeout');
const pendingUpdates=pending.states.length;pending.unmount();
assert.equal(capturedSignal.aborted,true,'Unmount aborts the actual client HTTP request');
assert.equal(pending.listeners.size,0);assert.equal(pending.timers.size,0);
await flush();assert.equal(pending.states.length,pendingUpdates,'An aborted verification cannot commit after unmount');
resolvePending(json({profile:PROFILE,capabilities:CAPABILITIES,token:BEARER,expiresAt:START+5000}));await flush();
assert.equal(pending.states.length,pendingUpdates);assert.equal(pending.timers.size,0,'Late HTTP completion cannot recreate a session timer');
assert.equal(pending.client.authenticated,false);pending.assertSafeStates();

let timeoutSignal;
const verifyTimeout=harness({fetchImpl:async(_path,options)=>{timeoutSignal=options.signal;return new Promise(()=>{});}});
verifyTimeout.mount();verifyTimeout.dispatch();await verifyTimeout.advance(10000);
assert.equal(timeoutSignal.aborted,true);assert.equal(verifyTimeout.state.status,'error');assert.equal(verifyTimeout.state.verified,false);
assert.equal(verifyTimeout.timers.size,0);verifyTimeout.assertSafeStates();verifyTimeout.unmount();

const hostTimeout=harness();hostTimeout.mount();await hostTimeout.advance(10000);
assert.equal(hostTimeout.state.status,'error');assert.equal(hostTimeout.listeners.size,0);assert.equal(hostTimeout.timers.size,0);
hostTimeout.dispatch();await flush();assert.equal(hostTimeout.requests.length,0,'Host timeout disposes the message adapter');hostTimeout.unmount();

const unconfigured=harness({appId:''});unconfigured.mount();await flush();
assert.equal(unconfigured.state.status,'unconfigured');assert.equal(unconfigured.requests.length,0);
assert.equal(unconfigured.messages.length,0);assert.equal(unconfigured.listeners.size,0);assert.equal(unconfigured.timers.size,0);unconfigured.unmount();

const noServer=harness();noServer.mount({verify:false});noServer.dispatch();await flush();
assert.equal(noServer.state.status,'unverified');assert.equal(noServer.state.verified,false);
assert.deepEqual(noServer.state.user,PROFILE);assert.equal(noServer.requests.length,0);
noServer.assertSafeStates();noServer.unmount();assert.equal(noServer.listeners.size,0);assert.equal(noServer.timers.size,0);

console.log('SP Worlds server session lifecycle checks passed: actual hook + installed SDK/client; origin/source gate, safe profiles, capability grants, TTL, verification/unmount cancellation, host timeout and standalone fallback.');
