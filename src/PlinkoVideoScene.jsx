import React,{useEffect,useRef,useState} from 'react';
import {createBlackjackDealerVideoPlayback} from './blackjack-dealer-video-playback.js';
import {PLINKO_FILM,PlinkoFilmBatches,plinkoFilmProjection} from './plinko-film-presentation.js';

const directory='/plinko-dealer-v46/';
export default function PlinkoVideoScene({controller,reduced=false,onLayout,onPin}){
  const holder=useRef(null),video=useRef(null),canvas=useRef(null),playback=useRef(null);
  const [mobile,setMobile]=useState(false),[paused,setPaused]=useState(false),[mediaState,setMediaState]=useState('poster');
  const current=useRef({reduced,mobile:false,images:{},projection:null,contacts:new Map(),lastPin:-Infinity});
  current.current.reduced=reduced;current.current.mobile=mobile;current.current.paused=paused;current.current.onPin=onPin;
  const [batches]=useState(()=>new PlinkoFilmBatches());
  const renderer=useRef(()=>{});

  useEffect(()=>{
    let disposed=false;
    for(const side of ['left','right']){
      const image=new Image();
      image.onload=()=>{if(!disposed){current.current.images[side]=image;renderer.current();}};
      image.src=directory+`drop-${side}-atlas.webp`;
    }
    return ()=>{disposed=true;current.current.images={};};
  },[]);
  useEffect(()=>{
    const node=holder.current;
    const resize=()=>{
      const {width,height}=node.getBoundingClientRect();
      if(!width||!height)return;
      const compact=window.matchMedia('(max-width:650px)').matches;
      setMobile(compact);
      const projection=plinkoFilmProjection(width,height,compact);
      current.current.projection=projection;
      const ratio=Math.min(2,window.devicePixelRatio||1);
      const target=canvas.current;
      target.width=Math.round(width*ratio);target.height=Math.round(height*ratio);
      current.current.ratio=ratio;
      onLayout?.(projection);renderer.current();
    };
    const observer=new ResizeObserver(resize);observer.observe(node);
    resize();window.addEventListener('resize',resize);
    return ()=>{observer.disconnect();window.removeEventListener('resize',resize);};
  },[onLayout]);
  useEffect(()=>{
    const player=createBlackjackDealerVideoPlayback({video:video.current,onState:setMediaState,isHidden:()=>document.hidden});
    playback.current=player;
    const policy=()=>player.update({paused:paused||current.current.gestureActive,reducedMotion:reduced});
    policy();document.addEventListener('visibilitychange',policy);
    return ()=>{document.removeEventListener('visibilitychange',policy);if(playback.current===player)playback.current=null;player.dispose();};
  },[mobile,paused,reduced]);

  useEffect(()=>{
    const render=()=>{
      const {projection:p,ratio=1,images,reduced:quiet}=current.current;
      const ctx=canvas.current?.getContext('2d');
      if(!ctx||!p)return;
      const flights=controller.getPresentation(),clock=controller.clockMs,duration=controller.durationMs;
      batches.update(flights.map(({id,progress})=>({id,progress})),clock,duration,quiet);
      ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,p.width,p.height);
      ctx.translate(p.x,p.y);ctx.scale(p.factor,p.factor);
      const action=batches.action(clock,quiet),actor=PLINKO_FILM.actor;
      const gestureActive=Boolean(action&&images[action.side]);
      if(current.current.gestureActive&&!gestureActive){
        // Every supplied action ends in neutral. Resume the idle from that
        // same pose instead of cutting to a head turn halfway through its loop.
        try{video.current.currentTime=0;}catch{/* The poster already is neutral. */}
      }
      current.current.gestureActive=gestureActive;
      playback.current?.update({paused:current.current.paused||gestureActive,reducedMotion:quiet});
      if(action&&images[action.side]){
        ctx.globalAlpha=action.opacity;
        ctx.drawImage(images[action.side],action.frame%5*actor.width,Math.floor(action.frame/5)*actor.height,
          actor.width,actor.height,actor.x,actor.y,actor.width,actor.height);
        ctx.globalAlpha=1;
      }
      for(const effect of controller.getEffects()){
        const x=960+(effect.bin-4)*61.8,fade=1-effect.progress;
        ctx.fillStyle=`rgba(145,214,183,${fade*.25})`;ctx.fillRect(x-24,854,48,99);
        ctx.strokeStyle=`rgba(189,229,206,${fade*.65})`;ctx.lineWidth=1.5;ctx.strokeRect(x-23,918,46,38);
        ctx.globalAlpha=fade;
        drawBall(ctx,x,864+Math.sin(effect.progress*Math.PI*2)*2,7*(1-effect.progress*.4));
        ctx.globalAlpha=1;
      }
      const alive=new Set(flights.map(flight=>flight.id));
      for(const id of current.current.contacts.keys())if(!alive.has(id))current.current.contacts.delete(id);
      let pin=false;
      for(const flight of flights){
        const pose=batches.pose(flight,clock,duration,quiet);
        if(!pose.visible)continue;
        if(pose.phase==='board'&&pose.row>=0){
          const s=pose.boardProgress*9,row=Math.min(7,Math.floor(s)-1),u=s-row-1;
          if(current.current.contacts.get(flight.id)!==row){
            current.current.contacts.set(flight.id,row);if(u<.2)pin=true;
          }
          if(u<.2){
            const x=960+flight.path[row]*30.9,y=477+row*48.2;
            const glow=ctx.createRadialGradient(x,y,1,x,y,25);
            glow.addColorStop(0,`rgba(182,226,207,${(1-u/.2)*.5})`);glow.addColorStop(1,'rgba(130,210,180,0)');
            ctx.fillStyle=glow;ctx.fillRect(x-25,y-25,50,50);
          }
        }
        drawBall(ctx,pose.x,pose.y,PLINKO_FILM.ballRadius);
      }
      if(pin&&clock-current.current.lastPin>=80){
        current.current.lastPin=clock;try{current.current.onPin?.();}catch{/* Optional presentation cue. */}
      }
    };
    renderer.current=render;controller.setRenderer(render);
    return ()=>{if(controller.renderer===render)controller.setRenderer(null);renderer.current=()=>{};};
  },[controller,batches]);
  const source=mobile?'idle-mobile':'idle-desktop';
  return <div className="plinko-film" ref={holder}>
    <img className="plinko-film-backdrop" src={directory+source+'.webp'} alt="" />
    <video key={source} ref={video} className={'plinko-film-backdrop'+(mediaState==='playing'?' is-playing':'')}
      src={directory+source+'.mp4'} muted loop playsInline preload="auto" aria-hidden="true" />
    <canvas className="plinko-film-overlay" ref={canvas} aria-hidden="true" />
    <button className="plinko-film-pause" type="button" onClick={()=>setPaused(value=>!value)}
      aria-label={paused?'Включить фон':'Поставить фон на паузу'}>{paused?'Включить фон':'Пауза фона'}</button>
  </div>;
}

function drawBall(ctx,x,y,r){
  ctx.fillStyle='rgba(0,12,13,.5)';ctx.beginPath();ctx.ellipse(x+4,y+6,r*1.1,r*.5,-.35,0,Math.PI*2);ctx.fill();
  const fill=ctx.createRadialGradient(x-r*.35,y-r*.4,r*.05,x,y,r);
  fill.addColorStop(0,'#f4f9ed');fill.addColorStop(.25,'#d6e9d8');fill.addColorStop(.65,'#88b7ad');fill.addColorStop(1,'#335b5a');
  ctx.fillStyle=fill;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#f4fff2';ctx.fillRect(x-r*.4,y-r*.6,Math.max(1,r*.32),Math.max(1,r*.25));
}
