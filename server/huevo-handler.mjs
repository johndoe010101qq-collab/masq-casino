import {HuevoError,verifyHuevoLaunch,issueHuevoSession,verifyHuevoSession,verifyHuevoCallback,createHuevoApi} from './huevo-protocol.mjs';
import {createHuevoService} from './huevo-service.mjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function rawBody(request){
  const declared=request.headers.get('Content-Length');if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>16384))throw new HuevoError(413,'body_too_large');
  if(!request.body)return new Uint8Array();const reader=request.body.getReader(),chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();throw new HuevoError(413,'body_too_large');}chunks.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
function parseJSON(bytes){try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new HuevoError(400,'invalid_json');}}
export async function handleHuevoRequest(request,env,{api,now=Date.now}={}){
  try{
    const url=new URL(request.url),path=url.pathname.replace(/^\/api\/huevo/,'');
    if(path==='/health'&&request.method==='GET')return json({configured:!!(env.HUEVO_DB&&env.HUEVO_CLIENT_ID&&env.HUEVO_CLIENT_SECRET&&env.HUEVO_APP_ID),liveEnabled:env.HUEVO_LIVE_ENABLED==='true'});
    if(!env.HUEVO_DB||!env.HUEVO_CLIENT_ID||!env.HUEVO_CLIENT_SECRET||!/^\d+$/.test(env.HUEVO_APP_ID||''))throw new HuevoError(503,'huevo_unconfigured','Сервер huEVO ещё не настроен. Игровой баланс не подключён.');
    const service=createHuevoService({db:env.HUEVO_DB,api:api||createHuevoApi({clientId:env.HUEVO_CLIENT_ID,clientSecret:env.HUEVO_CLIENT_SECRET}),now});
    if(request.method==='POST'&&path==='/callback'){
      const raw=await rawBody(request);
      if(!verifyHuevoCallback(raw,request.headers.get('X-Huevo-Signature'),env.HUEVO_CLIENT_SECRET))throw new HuevoError(401,'invalid_signature');
      const p=parseJSON(raw);if(!p||p.event!=='payment'||p.app_id!==Number(env.HUEVO_APP_ID)||!Number.isSafeInteger(p.user_id)||p.user_id<1||typeof p.test!=='boolean'||!/^pi_[a-zA-Z0-9_-]+$/.test(p.intent_id||''))throw new HuevoError(400,'invalid_callback');
      if(!p.test&&env.HUEVO_LIVE_ENABLED!=='true')throw new HuevoError(403,'live_disabled');
      await service.reconcile({userId:p.user_id,mode:p.test?'test':'live'},p.intent_id);return new Response(null,{status:204});
    }
    if(request.headers.get('Origin')!==url.origin&&request.method!=='GET')throw new HuevoError(403,'origin_rejected');
    let body={};if(request.method==='POST'){
      if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))throw new HuevoError(415,'json_required');
      body=parseJSON(await rawBody(request));if(!body||Array.isArray(body)||typeof body!=='object')throw new HuevoError(400,'invalid_json');
    }
    if(path==='/login'&&request.method==='POST'){
      const s=verifyHuevoLaunch(body.query,env.HUEVO_CLIENT_SECRET,env.HUEVO_APP_ID,{now:now()});
      if(s.mode==='live'&&env.HUEVO_LIVE_ENABLED!=='true')throw new HuevoError(403,'live_disabled','Запуск с реальными монэтками пока выключен. Откройте тестовую версию huEVO.');
      const token=issueHuevoSession(s,env.HUEVO_CLIENT_SECRET,{appId:env.HUEVO_APP_ID,now:now()});return json({token,...await service.session(s)});
    }
    const s=verifyHuevoSession((request.headers.get('Authorization')||'').replace(/^Bearer /,''),env.HUEVO_CLIENT_SECRET,{appId:env.HUEVO_APP_ID,now:now()});
    if(s.mode==='live'&&env.HUEVO_LIVE_ENABLED!=='true')throw new HuevoError(403,'live_disabled');
    if(path==='/session'&&request.method==='GET')return json(await service.session(s));
    if(path.startsWith('/operations/')&&request.method==='GET')return json(await service.operation(s,path.slice('/operations/'.length)));
    if(path==='/rounds'&&request.method==='POST')return json(await service.round(s,body));
    if(path==='/blackjack'&&request.method==='POST')return json(await service.blackjack(s,body));
    if(path==='/deposits'&&request.method==='POST')return json(await service.deposit(s,body));
    if(path.startsWith('/deposits/pi_')&&request.method==='POST')return json(await service.reconcile(s,path.slice('/deposits/'.length)));
    if(path==='/withdrawals'&&request.method==='POST')return json(await service.withdraw(s,body));
    throw new HuevoError(404,'not_found');
  }catch(error){const known=error instanceof HuevoError;return json({error:{code:known?error.code:'internal',message:known?error.message:'Сервер не завершил запрос. Повторите с тем же номером операции.'}},known?error.status:500);}
}
