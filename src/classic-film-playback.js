const owners=new WeakMap();
const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
export const classicFilmTime=(duration,progress)=>Math.max(0,(Number(duration)||0)-1/30)*clamp(progress);

// Media is a slave of public presentation progress. Paused action videos seek
// decoded frames; neither media events nor playback failure can settle a bet.
export function createClassicFilmPlayback({videos,onState=()=>{},onFrame=()=>{}}){
  // React clears callback-ref slots before passive effect cleanup. Own stable
  // DOM handles rather than the caller's mutable ref array.
  videos=[...videos];
  if(videos.length!==2||videos.some(video=>!video))throw new TypeError('Two film buffers required');
  const owner={};videos.forEach(video=>owners.set(video,owner));
  let disposed=false,target=null,visibleIndex=null,intent=null,state=null,generation=0;
  const owned=index=>!disposed&&owners.get(videos[index])===owner;
  const pause=index=>{if(owners.get(videos[index])!==owner)return;try{videos[index].pause();}catch{}};
  const publish=status=>{
    if(disposed)return;
    const next={status,visibleIndex};
    if(state?.status===status&&state?.visibleIndex===visibleIndex)return;
    state=next;onState(next);
  };
  const active=()=>target&&!target.failed&&owned(target.index)&&intent?.visible;
  const show=()=>{
    if(!active())return;visibleIndex=target.index;publish('ready');
    const time=Number(videos[target.index].currentTime)||0;
    if(target.lastReportedTime!==time){
      target.lastReportedTime=time;try{onFrame({time,frame:Math.floor(time*30+1e-5),token:target.token,src:target.src,index:target.index});}catch{/* Optional visual handoff must not break playback. */}
    }
  };
  const drive=()=>{
    if(!active())return;
    const video=videos[target.index];
    if(target.failed||video.readyState<1)return;
    if(target.idle&&!intent.reduced){
      if(video.readyState>=2)show();
      if(!video.paused||target.starting||target.blocked)return;
      const ticket=generation,requestTarget=target;target.starting=true;
      try{
        const request=video.play();
        Promise.resolve(request).then(()=>{
          if(!owned(requestTarget.index)){
            if(!owners.has(video)){try{video.pause();}catch{}}
            return;
          }
          if(target!==requestTarget||ticket!==generation||!intent.visible||intent.reduced){
            if(target?.index!==requestTarget.index||!intent.visible||intent.reduced)pause(requestTarget.index);
            return;
          }
          requestTarget.starting=false;
          if(video.readyState>=2)show();
        },()=>{
          if(target!==requestTarget||ticket!==generation||!owned(requestTarget.index))return;
          requestTarget.starting=false;
          requestTarget.blocked=true;pause(requestTarget.index);visibleIndex=null;publish('poster');
        });
      }catch{target.starting=false;target.blocked=true;visibleIndex=null;publish('poster');}
      return;
    }
    pause(target.index);
    const time=target.idle?0:classicFilmTime(video.duration,intent.progress);
    if(video.seeking)return;
    if(Math.abs(video.currentTime-time)>1/120){
      try{video.currentTime=time;}catch{target.failed=true;visibleIndex=null;publish('poster');}
      return;
    }
    if(video.readyState>=2)show();
  };
  const listeners=videos.map((video,index)=>{
    const ready=event=>{
      if(target?.index!==index||!owned(index))return;
      // A moving public target can advance while a frame decodes. Present the
      // newly decoded frame before requesting the next seek; never starve it.
      if(event?.type==='seeked'&&video.readyState>=2&&!video.seeking)show();
      drive();
    };
    const failed=()=>{if(target?.index!==index||!owned(index))return;target.failed=true;pause(index);visibleIndex=null;publish('poster');};
    const playing=()=>{if(target?.index!==index||!active()||!target.idle||intent.reduced)pause(index);else drive();};
    for(const name of ['loadedmetadata','loadeddata','canplay','seeked'])video.addEventListener(name,ready);
    video.addEventListener('error',failed);video.addEventListener('playing',playing);
    return{ready,failed,playing};
  });
  return{
    update(next){
      if(disposed)return;
      const previous=intent;
      intent={src:String(next.src),token:String(next.token??'idle'),idle:Boolean(next.idle),
        progress:clamp(next.progress),visible:next.visible!==false,reduced:Boolean(next.reduced)};
      const changed=!target||target.src!==intent.src||target.token!==intent.token;
      if(changed){
        ++generation;videos.forEach((_,index)=>pause(index));
        if(target&&target.src.includes('/mobile/')!==intent.src.includes('/mobile/'))visibleIndex=null;
        const index=visibleIndex===null?(target?1-target.index:0):1-visibleIndex;
        target={src:intent.src,token:intent.token,index,idle:intent.idle,failed:false,blocked:false,starting:false};
        const video=videos[index];video.muted=true;video.defaultMuted=true;video.loop=intent.idle;video.preload='auto';
        if(video.getAttribute('src')!==intent.src){video.setAttribute('src',intent.src);video.load();}
        else if(target.idle){try{video.currentTime=0;}catch{}}
        publish('loading');
      }else if(previous?.visible!==intent.visible||previous?.reduced!==intent.reduced){
        ++generation;target.blocked=false;target.starting=false;
      }
      if(!intent.visible){videos.forEach((_,index)=>pause(index));publish('paused');return;}
      drive();
    },
    dispose(){
      if(disposed)return;disposed=true;++generation;
      videos.forEach((video,index)=>{
        const {ready,failed,playing}=listeners[index];
        for(const name of ['loadedmetadata','loadeddata','canplay','seeked'])video.removeEventListener(name,ready);
        video.removeEventListener('error',failed);video.removeEventListener('playing',playing);
        pause(index);if(owners.get(video)===owner)owners.delete(video);
      });
    },
  };
}
