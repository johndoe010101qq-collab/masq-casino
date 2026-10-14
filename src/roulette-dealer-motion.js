import * as THREE from 'three';
import {classicProgress} from './minecraft-classic-motion.js';
import {classicHostPresentation} from './classic-host-presentation.js';
const TAU=Math.PI*2,clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{const p=clamp(v);return p*p*p*(10+p*(-15+6*p));};
export const ROULETTE_THROW_LAYOUT=Object.freeze({reveal:.82,landing:.98,trackRadius:2.35,pocketRadius:1.985,ballY:-.077});
function orbit(p){
 const release=classicHostPresentation('roulette',.07,true),start=Math.atan2(release.gestureSocket[0],-release.gestureSocket[2]);
 const t=clamp((p-release.actionRelease)/(1-release.actionRelease));
 return start-TAU*4*(1-(1-t)**3);
}
export function rouletteDealerMotion(round,progress,playing,reduced=false){
 const p=classicProgress(round,progress,playing,reduced),active=!!round||playing;
 const wheelDegrees=1800*(1-(1-p)**3),layout=ROULETTE_THROW_LAYOUT;
 if(!active){const host=classicHostPresentation('roulette');return Object.freeze({progress:0,wheelDegrees:0,position:host.gestureSocket,quaternion:host.holdingQuaternion,attached:true,reveal:false});}
 let angle=orbit(p),radius=layout.trackRadius,y=layout.ballY,reveal=p>=layout.reveal;
 if(reveal){
  const index=Math.max(0,Math.min(36,Math.trunc(Number(round?.pocketIndex)||0)));
  const start=orbit(layout.reveal),t=clamp((p-layout.reveal)/(layout.landing-layout.reveal));
  let end=index*TAU/37-TAU*5;while(end>start)end-=TAU;
  // Match the incoming tangent of the decelerating rim run at the drop gate.
  const u=(layout.reveal-.07)/.93,velocity=-TAU*4*3*(1-u)**2/.93,span=layout.landing-layout.reveal;
  angle=(2*t*t*t-3*t*t+1)*start+(-2*t*t*t+3*t*t)*end+(t*t*t-2*t*t+t)*span*velocity;
  radius=layout.trackRadius+(layout.pocketRadius-layout.trackRadius)*smooth(t);
  y+=.045*Math.abs(Math.sin(Math.PI*3*t))*Math.exp(-4*t);
 }
 const original={position:Object.freeze([Math.sin(angle)*radius,y,-Math.cos(angle)*radius]),quaternion:Object.freeze([0,0,0,1])};
 let draw=original;
 const release=classicHostPresentation('roulette',.07,true),join=.19;
 if(playing&&!reduced&&p<=release.actionRelease){const host=classicHostPresentation('roulette',p,true);draw={position:host.gestureSocket,quaternion:host.holdingQuaternion,attached:true};}
 else if(playing&&!reduced&&p<join){
  const span=join-release.actionRelease,t=clamp((p-release.actionRelease)/span),t2=t*t,t3=t2*t;
  const start=Math.atan2(release.gestureSocket[0],-release.gestureSocket[2]),end=orbit(join),u=(join-.07)/.93,velocity=-TAU*4*3*(1-u)**2/.93;
  const entryAngle=(2*t3-3*t2+1)*start+(-2*t3+3*t2)*end+(t3-t2)*span*velocity;
  const heldRadius=Math.hypot(release.gestureSocket[0],release.gestureSocket[2]),entryRadius=heldRadius+(layout.trackRadius-heldRadius)*smooth(t),entryY=release.gestureSocket[1]+(layout.ballY-release.gestureSocket[1])*smooth(t);
  draw={position:Object.freeze([Math.sin(entryAngle)*entryRadius,entryY,-Math.cos(entryAngle)*entryRadius]),quaternion:release.holdingQuaternion,attached:false};
 }
 return Object.freeze({...draw,progress:p,wheelDegrees,reveal,attached:!!draw.attached});
}
