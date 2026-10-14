import * as THREE from 'three';
import {classicHostPresentation} from './classic-host-presentation.js';
const clamp=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
const blend=value=>{const t=clamp(value);return t*t*t*(10+t*(-15+6*t));};
// Input is an already computed public render pose, never the game result.
// The original pose takes over before disclosure; only its launch prefix moves.
export function classicPropPresentation(game,original,progress,playing,reduced=false,idle=false){
 const p=clamp(progress),host=classicHostPresentation(game,p,playing,reduced);
 if(!host||reduced||(!playing&&!idle))return original;
 const join=game==='dice'?.29:.19;
 if(playing&&p>=join)return original;
 if(idle||p<=host.actionRelease)return Object.freeze({position:host.gestureSocket,quaternion:host.holdingQuaternion,attached:true});
 const release=classicHostPresentation(game,host.actionRelease,true,false),t=blend((p-host.actionRelease)/(join-host.actionRelease));
 const position=new THREE.Vector3(...release.gestureSocket).lerp(new THREE.Vector3(...original.position),t);
 if(game==='roulette'){
  const from=new THREE.Vector2(release.gestureSocket[0],release.gestureSocket[2]),to=new THREE.Vector2(original.position[0],original.position[2]);
  const radius=from.length()*(1-t)+to.length()*t,direction=from.normalize().lerp(to.normalize(),t);
  if(direction.lengthSq()<1e-10)direction.set(-from.y,from.x);
  direction.normalize().multiplyScalar(radius);position.x=direction.x;position.z=direction.y;
  position.y+=Math.sin(Math.PI*t)*.065;
 }
 const quaternion=new THREE.Quaternion(...release.holdingQuaternion).slerp(new THREE.Quaternion(...original.quaternion),t);
 return Object.freeze({position:Object.freeze(position.toArray()),quaternion:Object.freeze(quaternion.toArray()),attached:false});
}
