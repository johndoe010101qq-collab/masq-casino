import * as THREE from 'three';
import {diceTossPresentation} from './dice-toss-presentation.js';
import {classicHostPresentation} from './classic-host-presentation.js';
import {diceRigidPose,diceRigidFrames} from './dice-rigid-motion.js';
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const smooth=v=>{const p=clamp(v);return p*p*p*(10+p*(-15+6*p));};
const freeze=values=>Object.freeze(values);
export const DICE_THROW_LAYOUT=Object.freeze({scale:.6,feltTop:-1.1975,contact:.55,reveal:.9,landing:.98,
 wide:Object.freeze({at:freeze([.30,2.8,8.5]),target:freeze([0,-.20,-.90]),width:4.7,height:4.4})});

// A deterministic rigid-body rehearsal supplies gravity, spin and felt impacts.
// Only the final presentation interval aligns the already accepted ticket face;
// the solver has no access to the ticket and never changes or awards a result.
export function diceDealerMotion(round,progress,playing,reduced,support){
 const raw=diceTossPresentation(round,progress,playing,reduced),p=raw.progress,active=!!round||playing;
 const release=classicHostPresentation('dice',.12,true),floor=DICE_THROW_LAYOUT.feltTop;
 if(!active||p<=release.actionRelease){const host=classicHostPresentation('dice',p,playing,reduced);return Object.freeze({position:host.gestureSocket,quaternion:host.holdingQuaternion,progress:p,phase:active?'held':'idle',attached:true});}
 const time=Math.max(0,(p-release.actionRelease)*.82/(DICE_THROW_LAYOUT.reveal-release.actionRelease)),body=diceRigidPose(time);
 const q=new THREE.Quaternion(...body.quaternion),position=[...body.position];
 const matrix=new THREE.Matrix4().makeRotationFromQuaternion(q).elements,boxSupport=.3306*(Math.abs(matrix[1])+Math.abs(matrix[5])+Math.abs(matrix[9]));
 const clearance=Math.max(0,position[1]-floor-boxSupport);
 let phase=body.time<diceRigidFrames().firstContact?'flight':'bounce';
 const settle=p>=DICE_THROW_LAYOUT.reveal?smooth((p-DICE_THROW_LAYOUT.reveal)/(1-DICE_THROW_LAYOUT.reveal)):0;
 if(p>=DICE_THROW_LAYOUT.reveal){
  const accepted=diceTossPresentation(round,1,false,reduced).quaternion;
  q.slerp(new THREE.Quaternion(...accepted),settle);phase=p<1?'settle':'landed';
  const end=diceRigidPose(.82);position[0]+=(end.position[0]-position[0])*settle;position[2]+=(end.position[2]-position[2])*settle;
 }
 position[1]=floor+support(q.toArray())+clearance*(1-settle);
 return Object.freeze({position:freeze(position),quaternion:freeze(q.toArray()),progress:p,phase,attached:false});
}

// Read-only render-pose tracking, independent of the rolled value.
export function diceCameraPresentation(draw){
 const wide=DICE_THROW_LAYOUT.wide,p=draw.progress,push=draw.phase==='idle'?0:smooth((p-.25)/.42);
 const target=wide.target.map((v,i)=>v+(draw.position[i]-v)*push),offset=wide.at.map((v,i)=>v-wide.target[i]);
 const finalOffset=[.16,5.8,4.5],position=target.map((v,i)=>v+offset[i]+(finalOffset[i]-offset[i])*push);
 return Object.freeze({position:freeze(position),target:freeze(target),width:wide.width*(1.8/wide.width)**push,height:wide.height*(1.5/wide.height)**push,push});
}
