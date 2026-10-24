import React,{useEffect,useState} from 'react';
import {minecraftSlotReaction} from './minecraft-slot-presentation.js';
import {slotRasterArt,SLOT_RASTER_POSE_FRAMES} from './slot-raster-art.js';
import {getMinecraftSlotMascot} from './art/renderRasterSlotMascot.js';
import './MinecraftSlotScene.css';
import {HUEVO_EDITION} from './huevo-edition.js';
const base=import.meta.env.BASE_URL||'/';

export default function SlotScene(props){
 if(HUEVO_EDITION)return <div className={'studio-slot-world studio-slot-world--'+(props.game||'slots')} aria-hidden="true"><i/><i/><i/></div>;
 return <MinecraftScene {...props}/>;
}
function MinecraftScene({game='slots',visual,reducedMotion=false}){
 const art=slotRasterArt(game),[finishedVisual,setFinishedVisual]=useState(null),[mascot,setMascot]=useState(null),[mascotStatus,setMascotStatus]=useState('loading');
 useEffect(()=>{
  let active=true;setMascot(null);setMascotStatus('loading');
  getMinecraftSlotMascot(game).then(image=>{if(active){setMascot(image);setMascotStatus('ready');}}).catch(()=>{if(active)setMascotStatus('unavailable');});
  return()=>{active=false;};
 },[game]);
 const reaction=minecraftSlotReaction(visual,game,finishedVisual),pose=reaction.pose==='rainbow'?'bonus':reaction.pose,frame=SLOT_RASTER_POSE_FRAMES[pose]??0;
 return <div className="mc-slot-scene" data-world={game} data-raster="true" data-mascot-status={mascotStatus} aria-hidden="true"><img className="mc-slot-backdrop" src={base+art.background} alt="" width={art.width} height={art.height}/><div className="mc-slot-header-crop" style={{backgroundImage:`url('${base+art.background}')`}}/><div className="mc-slot-footer-crop" style={{backgroundImage:`url('${base+art.background}')`}}/>{mascot&&<div className="mc-slot-mascot" data-pose={pose} data-transient={reaction.transient} data-reduced={reducedMotion} style={{'--mc-mascot-ratio':mascot.tileWidth/mascot.tileHeight}}><span key={reaction.key} className="mc-slot-mascot-sprite" style={{backgroundImage:`url('${mascot.url}')`,backgroundPosition:`${frame%4/3*100}% ${Math.floor(frame/4)*100}%`}} onAnimationEnd={event=>{if(event.target===event.currentTarget&&['mc-raster-win','mc-raster-loss'].includes(event.animationName))setFinishedVisual(visual);}}/></div>}</div>;
}

export function MinecraftSlotEmblem({atlas,className=''}){return <img className={'mc-slot-emblem '+className} src={atlas?.maskUrl||base+'anonymous-mask-minimal.png'} alt=""/>;}
