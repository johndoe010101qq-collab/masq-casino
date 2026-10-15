import React,{useEffect,useRef,useState} from 'react';
import {createClassicFilmPlayback} from './classic-film-playback.js';
import './ClassicFilmStage.css';

export function classicFilmProjection(width,height,mobile=false){
  const sourceWidth=mobile?720:1920,sourceHeight=mobile?960:1080,factor=height/sourceHeight;
  return{width,height,mobile,factor,x:(width-sourceWidth*factor)/2,y:0,sourceWidth,sourceHeight};
}

export default function ClassicFilmStage({basePath,clip='idle',token='idle',mediaProgress,progress=0,
  reduced=false,visible=true,camera,onLayout,onMediaFrame,children,className=''}){
  const container=useRef(null),buffers=useRef([null,null]),driver=useRef(null);
  const [layout,setLayout]=useState(null),[state,setState]=useState({status:'poster',visibleIndex:null});
  const props=useRef(null);
  const mobile=layout?.mobile??false;
  const selected=typeof clip==='function'?clip(mobile):clip;
  const source=`${basePath}/${mobile?'mobile':'desktop'}/${selected}.mp4`;
  const sourceCamera=typeof camera==='function'?camera(mobile):camera;
  props.current={src:source,token,idle:selected==='idle',progress:mediaProgress??progress,reduced,visible:visible&&!document.hidden,onMediaFrame};
  useEffect(()=>{
    const update=()=>{
      const r=container.current.getBoundingClientRect();if(!r.width||!r.height)return;
      const next=classicFilmProjection(r.width,r.height,matchMedia('(max-width:650px)').matches);
      setLayout(next);onLayout?.(next);
    };
    const observer=new ResizeObserver(update);observer.observe(container.current);update();
    window.addEventListener('resize',update);return()=>{observer.disconnect();window.removeEventListener('resize',update);};
  },[onLayout]);
  useEffect(()=>{
    const player=createClassicFilmPlayback({videos:buffers.current,onState:setState,onFrame:frame=>props.current.onMediaFrame?.(frame)});driver.current=player;
    const refresh=()=>player.update({...props.current,visible:visible&&!document.hidden});
    refresh();document.addEventListener('visibilitychange',refresh);
    return()=>{document.removeEventListener('visibilitychange',refresh);if(driver.current===player)driver.current=null;player.dispose();};
  },[visible]);
  useEffect(()=>{driver.current?.update(props.current);},[source,token,mediaProgress,progress,reduced,visible]);
  const scale=Math.max(1,Number(sourceCamera?.scale)||1);
  const ox=layout?layout.x+(sourceCamera?.originX??layout.sourceWidth/2)*layout.factor:0;
  const oy=layout?(sourceCamera?.originY??layout.sourceHeight/2)*layout.factor:0;
  return <div className={'classic-film-stage '+className} ref={container}>
    <div className="classic-film-world" style={{transform:scale===1?undefined:`scale(${scale})`,transformOrigin:`${ox}px ${oy}px`}}>
      <img className="classic-film-native" src={`${basePath}/${mobile?'mobile':'desktop'}/poster.webp`} alt="" />
      {[0,1].map(index=><video key={index} ref={node=>{buffers.current[index]=node;}}
        className={'classic-film-native'+(state.visibleIndex===index?' is-visible':'')}
        muted playsInline preload="auto" aria-hidden="true" />)}
      {children}
    </div>
  </div>;
}
