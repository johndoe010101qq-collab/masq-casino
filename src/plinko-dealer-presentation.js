import * as THREE from 'three';
import {coinDealerArmPose,COIN_DEALER_STAGE} from './coin-dealer-presentation.js';
import {PLINKO_VISUAL_LAYOUT} from './plinko-visual-layout.js';
const freeze=values=>Object.freeze(values);
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
const actorPosition=freeze([0,0,-.35]),actorScale=2;
const loadY=1.40,loadZ=.24*PLINKO_VISUAL_LAYOUT.scale+PLINKO_VISUAL_LAYOUT.position[2];
export const PLINKO_DEALER_STAGE=Object.freeze({
 ...COIN_DEALER_STAGE,floor:-.1475,actorZ:0,coinScale:1,
 coinHalfThickness:.074*PLINKO_VISUAL_LAYOUT.scale/actorScale,
 hipY:.29,position:actorPosition,actorScale,chairYaw:Math.PI,
 armPoles:Object.freeze({left:freeze([.95,.10,-1]),right:freeze([-.95,.10,-1])}),
 loadSockets:Object.freeze({left:freeze([.40,loadY,loadZ]),right:freeze([-.40,loadY,loadZ])}),
 release:.025,entryEnd:1/9,ballRadius:.074,
});
export function plinkoDealerHand(id){return Number.isSafeInteger(id)&&id>0&&id%2?'right':'left';}
const actorPoint=world=>world.map((value,index)=>(value-actorPosition[index])/actorScale);
const worldPoint=local=>local.map((value,index)=>value*actorScale+actorPosition[index]);

// Both gloves hold a fixed world socket above the cabinet. Rapid launches can
// share either actual hand without a queue, teleport, or additional clock.
export function plinkoDealerPresentation(flights=[],reduced=false){
 const stage=PLINKO_DEALER_STAGE,pulses={left:0,right:0};let feedingCount=0;
 for(const flight of flights){
  const p=flight.progress;if(!Number.isFinite(p)||p<0||p>=stage.entryEnd)continue;
  feedingCount++;const side=plinkoDealerHand(flight.id);
  if(!reduced)pulses[side]=Math.max(pulses[side],Math.sin(Math.PI*p/stage.entryEnd)**2);
 }
 const actorQuaternion=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),stage.chairYaw);
 const root=new THREE.Vector3(0,stage.hipY,0),bodyWorld=new THREE.Quaternion();
 const arms={};
 for(const side of ['left','right']){
  // The palm faces down and stays above the sphere; the falling ball never
  // passes through a stationary horizontal hand below the chute.
  const palm=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2)
   .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),(side==='left'?1:-1)*.26*pulses[side]));
  arms[side]=coinDealerArmPose(side,root,bodyWorld,new THREE.Vector3(...actorPoint(stage.loadSockets[side])),palm,stage);
 }
 const head=new THREE.Quaternion().setFromEuler(new THREE.Euler(.02+.13*Math.max(pulses.left,pulses.right),.07*(pulses.right-pulses.left),0));
 return Object.freeze({phase:feedingCount?'feed':'idle',feedingCount,
  actor:Object.freeze({position:actorPosition,quaternion:freeze(actorQuaternion.toArray()),scale:actorScale}),
  dealer:Object.freeze({position:freeze(root.toArray()),quaternion:freeze(actorQuaternion.clone().invert().toArray()),
   head:freeze(head.toArray()),left:arms.left,right:arms.right,legAngle:Math.acos(1/6),pixel:stage.pixel}),
  handSockets:Object.freeze({left:freeze(worldPoint(arms.left.socketWorld)),right:freeze(worldPoint(arms.right.socketWorld))}),stage});
}

// Only the prefix before the first peg changes. These local board coordinates
// join the existing path and incoming velocity exactly at 1/9.
export function plinkoDealerBallPose(flight){
 const stage=PLINKO_DEALER_STAGE,p=flight.progress;
 if(!Number.isFinite(p)||p<0||p>=stage.entryEnd)return null;
 const id=Number.isSafeInteger(flight.id)&&flight.id>0?flight.id:0;
 const world=stage.loadSockets[plinkoDealerHand(id)];
 const start=world.map((value,index)=>(value-PLINKO_VISUAL_LAYOUT.position[index])/PLINKO_VISUAL_LAYOUT.scale);
 if(p<=stage.release)return Object.freeze({position:freeze(start),quaternion:freeze([0,0,0,1]),attached:true});
 const duration=stage.entryEnd-stage.release,t=clamp((p-stage.release)/duration),t2=t*t,t3=t2*t,blend=smooth(t);
 const y=(2*t3-3*t2+1)*start[1]+(-2*t3+3*t2)*1.91+(t3-t2)*duration*-4.86;
 const position=freeze([start[0]*(1-blend),y,start[2]+(id%5)*.004*blend]);
 const quaternion=new THREE.Quaternion().slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(p*8,id,0)),blend);
 return Object.freeze({position,quaternion:freeze(quaternion.toArray()),attached:false});
}
