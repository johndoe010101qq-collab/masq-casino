import {createHash,createHmac,timingSafeEqual,randomBytes} from 'node:crypto';

export class HuevoError extends Error {
  constructor(status,code,message=code){super(message);this.status=status;this.code=code;}
}
const key=secret=>createHash('sha256').update(secret).digest();
const hexEqual=(a,b)=>typeof b==='string'&&/^[a-f0-9]{64}$/.test(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
export function verifyHuevoLaunch(query,secret,appId,{now=Date.now(),maxAge=86400}={}){
  if(typeof query!=='string'||query.length>16384)throw new HuevoError(401,'invalid_launch');
  const params=new URLSearchParams(query), seen=new Set();
  for(const [k,v] of params){if(!k.startsWith('hu_'))continue;
    if(seen.has(k)||!/^hu_[a-z0-9_]+$/.test(k)||/[\r\n]/.test(v))throw new HuevoError(401,'invalid_launch');seen.add(k);}
  const p=Object.fromEntries(params),data=Object.keys(p).filter(k=>k.startsWith('hu_')&&k!=='hu_hash').sort().map(k=>`${k}=${p[k]}`).join('\n');
  const expected=createHmac('sha256',key(secret)).update(data).digest('hex');
  if(!hexEqual(expected,p.hu_hash)||p.hu_app_id!==String(appId)||!/^\d+$/.test(p.hu_user_id||'')||!/^\d+$/.test(p.hu_ts||'')
    ||!Number.isSafeInteger(Number(p.hu_user_id))||Number(p.hu_user_id)<1||!['live','test'].includes(p.hu_mode))throw new HuevoError(401,'invalid_launch');
  const age=Math.floor(now/1000)-Number(p.hu_ts);
  if(age<0||age>maxAge)throw new HuevoError(401,'expired_launch');
  return {userId:Number(p.hu_user_id),mode:p.hu_mode,username:(p.hu_username||'').slice(0,100),displayName:(p.hu_display_name||p.hu_username||'').slice(0,100)};
}
export function verifyHuevoCallback(raw,signature,secret){
  return hexEqual(createHmac('sha256',key(secret)).update(raw).digest('hex'),signature);
}
export function issueHuevoSession(identity,secret,{now=Date.now(),appId}={}){
  const payload=Buffer.from(JSON.stringify({...identity,appId,exp:Math.floor(now/1000)+43200,nonce:randomBytes(16).toString('hex')})).toString('base64url');
  const sig=createHmac('sha256',key('MASQ session v1:'+secret)).update(payload).digest('hex');return payload+'.'+sig;
}
export function verifyHuevoSession(token,secret,{now=Date.now(),appId}={}){
  if(typeof token!=='string'||token.length>4096)throw new HuevoError(401,'session_required');
  const [payload,sig,...extra]=token.split('.');
  if(extra.length||!hexEqual(createHmac('sha256',key('MASQ session v1:'+secret)).update(payload).digest('hex'),sig))throw new HuevoError(401,'invalid_session');
  let p;try{p=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));}catch{throw new HuevoError(401,'invalid_session');}
  if(p.appId!==String(appId)||!Number.isSafeInteger(p.userId)||p.userId<1||!['test','live'].includes(p.mode)||p.exp<=Math.floor(now/1000))throw new HuevoError(401,'expired_session');
  return p;
}
export function createHuevoApi({clientId,clientSecret,fetcher=fetch}){
  const auth='Basic '+Buffer.from(clientId+':'+clientSecret).toString('base64');
  return async(method,path,body)=>{
    if(!/^\/(wallet|users\/\d+|payments(?:\/pi_[a-zA-Z0-9_-]+)?|credits)$/.test(path))throw new HuevoError(400,'invalid_api_path');
    let response;try{response=await fetcher('https://huevo.su/api/apps/v1'+path,{method,redirect:'manual',signal:AbortSignal.timeout(10000),headers:{Authorization:auth,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
    catch{throw new HuevoError(502,'platform_unavailable');}
    if(response.status>=300&&response.status<400)throw new HuevoError(502,'platform_redirect');
    let data;try{data=await response.json();}catch{throw new HuevoError(502,'invalid_platform_response');}
    if(!response.ok||data.ok!==true){const code=data.error?.code||'platform_error';throw new HuevoError(response.status>=400?response.status:502,code,data.error?.message||code);}
    return data;
  };
}
