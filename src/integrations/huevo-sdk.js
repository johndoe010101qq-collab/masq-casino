let loading;
export function loadHuevoSdk(){
  if(window.huevo)return Promise.resolve(window.huevo);
  if(!loading)loading=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://huevo.su/static/js/huevo-apps-v1.js';script.async=true;
    script.onload=()=>window.huevo?resolve(window.huevo):reject(new Error('SDK huEVO недоступен.'));
    script.onerror=()=>{loading=null;reject(new Error('Не удалось загрузить SDK huEVO.'));};document.head.append(script);
  });return loading;
}
export function createHuevoClient(token,{fetcher=fetch}={}){
  return async(path,body)=>{
    let last;
    for(let attempt=0;attempt<3;attempt++){
      try{const response=await fetcher('/api/huevo'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},cache:'no-store',...(body===undefined?{}:{body:JSON.stringify(body)})});
        const data=await response.json();if(!response.ok){const e=new Error(data.error?.message||'Ошибка соединения с huEVO.');e.code=data.error?.code;e.status=response.status;throw e;}return data;
      }catch(error){last=error;if(error.status&&error.status<500&&error.code!=='retry_same_request')throw error;}
    }throw last;
  };
}
