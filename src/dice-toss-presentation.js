import * as THREE from 'three';
import {CLASSIC_DIE_FACES,classicProgress} from './minecraft-classic-motion.js';

const TAU=Math.PI*2,REVEAL=.9;
const smooth=value=>{const p=Math.max(0,Math.min(1,value));return p*p*(3-2*p);};
const spinning=p=>new THREE.Quaternion().setFromEuler(new THREE.Euler(.32+TAU*3.8*p,.4+TAU*2.6*p,-.25+TAU*2.1*p));
const finalQuaternion=round=>{
  const value=Math.max(1,Math.min(6,Math.trunc(Number(round?.value)||1)));
  const face=CLASSIC_DIE_FACES.find(item=>item.value===value),up=new THREE.Vector3(0,1,0);
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...face.normal),up)
    .premultiply(new THREE.Quaternion().setFromAxisAngle(up,.4));
};

// Until disclosure the die stays in motion above the felt. It never appears
// to have landed on a temporary face before turning into the accepted result.
// The existing round clock supplies progress; this module draws no randomness.
export function diceTossPresentation(round,progress,playing,reduced=false){
  const p=classicProgress(round,progress,playing,reduced),active=playing&&!reduced;
  let quaternion=spinning(0),lift=0;
  if(active&&p<REVEAL){
    quaternion=spinning(p);
    const flight=p/REVEAL;
    lift=Math.sin(Math.PI*flight)*.65+.12*Math.sin(Math.PI*1.5*flight)**2;
  }else if(round){
    const phase=smooth((p-REVEAL)/(1-REVEAL));
    quaternion=active?spinning(REVEAL).slerp(finalQuaternion(round),phase):finalQuaternion(round);
    lift=active?.12*(1-phase):0;
  }
  return Object.freeze({progress:p,reveal:p>=REVEAL,quaternion:Object.freeze(quaternion.toArray()),lift,
    x:active?-.58*(1-p)+Math.sin(p*TAU)*.2*(1-p):0,z:active?-.12*(1-p):0});
}
