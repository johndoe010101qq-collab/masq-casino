import {validateAdminDraft} from '../demo-admin-controls.js';
import {cleanRewardPolicy} from '../reward-policy.js';

const CAPABILITIES = new Set(['settings:read', 'settings:write', 'audit:read']);
const ERROR_MESSAGES = Object.freeze({
  AUTH_UNCONFIGURED:'Серверный вход ещё не настроен.',
  UNAUTHENTICATED:'Сеанс закончился. Откройте приложение в SP Worlds заново.',
  SESSION_EXPIRED:'Сеанс закончился. Откройте приложение в SP Worlds заново.',
  FORBIDDEN:'Для этого действия нет прав администратора.',
  REVISION_CONFLICT:'Настройки изменились на сервере. Проверьте новую версию перед сохранением.',
  INVALID_SETTINGS:'Сервер отклонил настройки. Проверьте значения.',
  INVALID_REQUEST:'Сервер отклонил запрос. Проверьте значения и причину изменения.',
  INVALID_REVISION:'Версия настроек некорректна. Обновите данные с сервера.',
  INVALID_REASON:'Укажите причину изменения: от 1 до 500 символов.',
  INVALID_CLAIM:'Не удалось получить корректный профиль SP Worlds.',
  INVALID_SIGNATURE:'Не удалось подтвердить профиль SP Worlds.',
  EXPIRED_CLAIM:'Обновите профиль SP Worlds и повторите вход.',
  SESSION_CAPACITY:'Новый сеанс временно недоступен. Попробуйте позже.',
  ORIGIN_REJECTED:'Серверный вход должен выполняться из приложения MASQ.',
  INVALID_IDENTITY:'Не удалось подтвердить профиль SP Worlds.',
  RATE_LIMITED:'Слишком много запросов. Попробуйте позже.',
  TIMEOUT:'Сервер не ответил вовремя. Попробуйте ещё раз.',
  ABORTED:'Запрос отменён.',
  NETWORK_ERROR:'Не удалось связаться с сервером.',
  INVALID_RESPONSE:'Сервер вернул некорректный ответ.',
  SERVER_ERROR:'Не удалось выполнить действие на сервере.',
});

export class ServerAdminError extends Error {
  constructor(code, status = 0) {
    super(ERROR_MESSAGES[code] || ERROR_MESSAGES.SERVER_ERROR);
    this.name = 'ServerAdminError';
    this.code = Object.hasOwn(ERROR_MESSAGES, code) ? code : 'SERVER_ERROR';
    this.status = status;
  }
}

const plainObject = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const textWithin = (value, limit) => typeof value === 'string' && value.length > 0 && value.length <= limit;
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const clone = value => structuredClone(value);
const failResponse = () => {throw new ServerAdminError('INVALID_RESPONSE');};

function cleanProfile(profile) {
  if(!plainObject(profile) || !textWithin(profile.accountId,128) ||
    !textWithin(profile.username,64) || !textWithin(profile.minecraftUUID,64))failResponse();
  return {accountId:profile.accountId,username:profile.username,minecraftUUID:profile.minecraftUUID};
}

function cleanSettingsResult(data) {
  if(!plainObject(data) || !positiveInteger(data.revision) || !plainObject(data.settings))failResponse();
  let settings;
  try {settings=validateAdminDraft(data.settings);} catch {failResponse();}
  return {settings,revision:data.revision,...(typeof data.changed==='boolean'?{changed:data.changed}:{})};
}

function cleanRewardResult(data) {
  if(!plainObject(data)||!positiveInteger(data.settingsRevision)||typeof data.authorityConfigured!=='boolean')failResponse();
  let settings;
  try {settings=cleanRewardPolicy(data.settings);} catch {failResponse();}
  const amounts={};
  for(const key of ['availableBudgetCents','outstandingLiabilityCents','entitlementShortfallCents']){
    if(!Number.isSafeInteger(data[key])||data[key]<0)failResponse();amounts[key]=data[key];
  }
  if(!Number.isSafeInteger(data.marginCents)||!Number.isSafeInteger(data.roundCount)||data.roundCount<0)failResponse();
  return {settings,settingsRevision:data.settingsRevision,authorityConfigured:data.authorityConfigured,
    ...amounts,marginCents:data.marginCents,roundCount:data.roundCount,...(typeof data.changed==='boolean'?{changed:data.changed}:{})};
}

function cleanAudit(data) {
  if(!plainObject(data)||!Array.isArray(data.entries)||data.entries.length>100||
    !(data.nextCursor===null||positiveInteger(data.nextCursor)))failResponse();
  return {entries:data.entries.map(entry=>{
    if(!plainObject(entry)||!positiveInteger(entry.id)||!positiveInteger(entry.revision)||
      !positiveInteger(entry.createdAt)||!Number.isFinite(new Date(entry.createdAt).getTime())||!textWithin(entry.reason,500)||
      !plainObject(entry.actor)||!textWithin(entry.actor.accountId,128)||!textWithin(entry.actor.username,64))failResponse();
    let before,after;
    try {before=validateAdminDraft(entry.before);after=validateAdminDraft(entry.after);} catch {failResponse();}
    return {id:entry.id,revision:entry.revision,actor:{accountId:entry.actor.accountId,username:entry.actor.username},
      reason:entry.reason,createdAt:entry.createdAt,before,after};
  }),nextCursor:data.nextCursor};
}

async function readBoundedJSON(response, limit) {
  const contentType=response.headers.get('content-type')||'';
  if(!/^application\/json(?:\s*;|$)/i.test(contentType))failResponse();
  const contentLength=response.headers.get('content-length');
  if(contentLength!==null&&Number(contentLength)>limit)failResponse();
  const reader=response.body?.getReader();
  if(!reader)failResponse();
  const parts=[];let length=0;
  try {
    for(;;){
      const {done,value}=await reader.read();if(done)break;
      length+=value.byteLength;
      if(length>limit){await reader.cancel();failResponse();}
      parts.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;
  for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
  try {return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));} catch {failResponse();}
}

// The bearer credential remains in this closure. No storage, URL, UI status,
// auth result, or error message ever receives the token or raw signed claim.
export function createServerAdminClient({fetchImpl=globalThis.fetch?.bind(globalThis),timeoutMs=10000,
  maxResponseBytes=524288,now=()=>Date.now()}={}) {
  if(typeof fetchImpl!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<1||
    !Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1024)throw new TypeError('Invalid server admin client configuration');
  let token=null,profile=null,capabilities=[],expiresAt=null,generation=0;
  const controllers=new Set();

  function clearCredentials(exceptController) {
    generation++;token=null;profile=null;capabilities=[];expiresAt=null;
    for(const controller of controllers)if(controller!==exceptController)controller.abort();
    controllers.clear();
  }
  function logout() {clearCredentials();}
  function expire() {if(token&&now()>=expiresAt)logout();}
  function getStatus() {
    expire();return {authenticated:Boolean(token),profile:profile?clone(profile):null,
      capabilities:[...capabilities],expiresAt};
  }
  function requireSession() {expire();if(!token)throw new ServerAdminError('SESSION_EXPIRED',401);}

  async function request(path,{method='GET',body,signal,authenticated=true}={}) {
    if(authenticated)requireSession();
    // Paths are private constants below, never caller-supplied URLs.
    if(!path.startsWith('/api/')||path.startsWith('//'))throw new TypeError('Same-origin API path required');
    const requestGeneration=generation,requestToken=authenticated?token:null;
    const controller=new AbortController();controllers.add(controller);
    let timedOut=false,timer;
    let rejectCancellation;
    const cancellation=new Promise((_,reject)=>{rejectCancellation=reject;});
    const cancel=()=>{controller.abort();rejectCancellation(new ServerAdminError(timedOut?'TIMEOUT':'ABORTED'));};
    controller.signal.addEventListener('abort',()=>rejectCancellation(new ServerAdminError(timedOut?'TIMEOUT':'ABORTED')),{once:true});
    signal?.addEventListener('abort',cancel,{once:true});
    if(signal?.aborted)cancel();
    timer=setTimeout(()=>{timedOut=true;cancel();},timeoutMs);
    const operation=(async()=>{
      const response=await fetchImpl(path,{method,body:body===undefined?undefined:JSON.stringify(body),
        headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'}),
          ...(requestToken?{Authorization:`Bearer ${requestToken}`}:{})},
        credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});
      if(requestGeneration!==generation)throw new ServerAdminError('ABORTED');
      // Clear an expired session even if the server's 401 body is malformed.
      if(response.status===401&&authenticated){clearCredentials(controller);throw new ServerAdminError('SESSION_EXPIRED',401);}
      const data=await readBoundedJSON(response,maxResponseBytes);
      if(requestGeneration!==generation)throw new ServerAdminError('ABORTED');
      if(!response.ok){
        const code=typeof data?.error?.code==='string'?data.error.code:
          response.status===403?'FORBIDDEN':response.status===409?'REVISION_CONFLICT':'SERVER_ERROR';
        throw new ServerAdminError(code,response.status);
      }
      return data;
    })();
    try {return await Promise.race([operation,cancellation]);}
    catch(error){if(error instanceof ServerAdminError)throw error;
      throw new ServerAdminError(timedOut?'TIMEOUT':controller.signal.aborted?'ABORTED':'NETWORK_ERROR');}
    finally {clearTimeout(timer);signal?.removeEventListener('abort',cancel);controllers.delete(controller);}
  }

  return Object.freeze({
    getStatus,
    get authenticated(){return getStatus().authenticated;},
    get capabilities(){return getStatus().capabilities;},
    async authenticate(claim,options={}) {
      logout();
      const authGeneration=generation;
      const response=await request('/api/auth/spw',{method:'POST',body:claim,signal:options.signal,authenticated:false});
      if(generation!==authGeneration)throw new ServerAdminError('ABORTED');
      const nextProfile=cleanProfile(response.profile);
      if(!Array.isArray(response.capabilities)||response.capabilities.length>CAPABILITIES.size||
        response.capabilities.some(value=>!CAPABILITIES.has(value))||
        new Set(response.capabilities).size!==response.capabilities.length||
        !textWithin(response.token,512)||!/^[A-Za-z0-9_-]+$/.test(response.token)||response.token.length<32||
        !positiveInteger(response.expiresAt)||response.expiresAt<=now())failResponse();
      token=response.token;profile=nextProfile;capabilities=[...response.capabilities];expiresAt=response.expiresAt;
      return getStatus();
    },
    async getSettings(options={}) {return cleanSettingsResult(await request('/api/admin/settings',{signal:options.signal}));},
    async getRewardBank(options={}) {return cleanRewardResult(await request('/api/admin/rewards',{signal:options.signal}));},
    async saveRewardPolicy({expectedRevision,settings,reason},options={}) {
      if(!positiveInteger(expectedRevision))throw new ServerAdminError('INVALID_REVISION');
      if(typeof reason!=='string'||!textWithin(reason.trim(),500)||reason.length>500||/[\u0000-\u001f\u007f]/.test(reason))throw new ServerAdminError('INVALID_REASON');
      let cleanSettings;
      try {cleanSettings=cleanRewardPolicy(settings);} catch {throw new ServerAdminError('INVALID_SETTINGS');}
      return cleanRewardResult(await request('/api/admin/rewards',{method:'PUT',body:{expectedRevision,settings:cleanSettings,reason:reason.trim()},signal:options.signal}));
    },
    async saveSettings({expectedRevision,settings,reason},options={}) {
      if(!positiveInteger(expectedRevision))throw new ServerAdminError('INVALID_REVISION');
      if(typeof reason!=='string'||!textWithin(reason.trim(),500)||reason.length>500||/[\u0000-\u001f\u007f]/.test(reason))throw new ServerAdminError('INVALID_REASON');
      let cleanSettings;
      try {cleanSettings=validateAdminDraft(settings);} catch {throw new ServerAdminError('INVALID_SETTINGS');}
      return cleanSettingsResult(await request('/api/admin/settings',{method:'PUT',
        body:{expectedRevision,settings:cleanSettings,reason:reason.trim()},signal:options.signal}));
    },
    async getAudit({limit=50,cursor,signal}={}) {
      if(!positiveInteger(limit)||limit>100||(cursor!==undefined&&!positiveInteger(cursor)))throw new ServerAdminError('INVALID_REQUEST');
      return cleanAudit(await request(`/api/admin/audit?limit=${limit}${cursor===undefined?'':`&cursor=${cursor}`}`,{signal}));
    },
    async revokeSession(options={}) {
      expire();if(!token){logout();return;}
      try {await request('/api/auth/session',{method:'DELETE',signal:options.signal});}
      finally {logout();}
    },
    logout,
  });
}
