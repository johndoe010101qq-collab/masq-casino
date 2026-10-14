import * as THREE from 'three';
import {coinDealerArmPose,COIN_DEALER_STAGE} from './coin-dealer-presentation.js';

const freeze=values=>Object.freeze(values);
const clamp=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
const smooth=value=>{const p=clamp(value);return p*p*(3-2*p);};
const point=values=>new THREE.Vector3(...values);

// Physical positions refer to the existing tray, wheel rim and terminal. The
// public playback progress is the only animation input; this host has no round.
export const CLASSIC_HOST_STAGES=Object.freeze({
  dice:Object.freeze({position:freeze([0,0,-2.65]),scale:1.8,activeHand:'right',release:.12,
    right:freeze([-.41,-.34,-1.88]),left:freeze([.43,-.50,-2.05]),
    prepare:freeze([-.41,-.28,-1.88]),contact:freeze([-.41,-.34,-1.88]),
    follow:freeze([-.41,-.34,-2.02]),palm:'front',propRadius:.3306,returnNeutral:.48}),
  roulette:Object.freeze({position:freeze([0,0,-3.15]),scale:2.2,activeHand:'right',release:.07,
    right:freeze([-.43,-.07,-2.40]),left:freeze([.85,-.32,-3.02]),
    prepare:freeze([-.48,.02,-2.46]),contact:freeze([-.43,-.07,-2.40]),
    follow:freeze([-.43,-.07,-2.52]),palm:'front',propRadius:.083,returnNeutral:.46}),
  upgrader:Object.freeze({position:freeze([-2.15,0,-2.65]),scale:1.8,activeHand:'left',release:.22,
    right:freeze([-2.58,-.50,-2.10]),left:freeze([-1.75,-.50,-2.12]),
    prepare:freeze([-1.74,-.52,-2.14]),contact:freeze([-1.65,-.60,-1.93]),
    follow:freeze([-1.74,-.50,-2.08]),palm:'front',propRadius:0,returnNeutral:.55}),
});

export const CLASSIC_HOST_CAMERAS=Object.freeze({
  dice:Object.freeze({at:freeze([.8,3.2,8]),target:freeze([0,-.05,-.40]),width:5.4,height:4.4}),
  roulette:Object.freeze({at:freeze([1.6,6.0,8]),target:freeze([.12,-.20,0]),width:6.9,height:5.3}),
  upgrader:Object.freeze({at:freeze([1.3,2.35,10]),target:freeze([-.10,-.10,.10]),width:6.0,height:4.5}),
});

function gestureTarget(config,p,active) {
  const neutral=point(config[config.activeHand]);
  if(!active)return {position:neutral,phase:'idle',amount:0};
  const windup=config.release*.55;
  if(p<windup)return {position:neutral.lerp(point(config.prepare),smooth(p/windup)),phase:'prepare',amount:smooth(p/windup)};
  if(p<config.release)return {position:point(config.prepare).lerp(point(config.contact),smooth((p-windup)/(config.release-windup))),phase:'release',amount:1};
  const followEnd=config.release+.07;
  if(p<followEnd)return {position:point(config.contact).lerp(point(config.follow),smooth((p-config.release)/.07)),phase:'follow',amount:1};
  const back=smooth((p-followEnd)/(config.returnNeutral-followEnd));
  if(back===1)return {position:neutral,phase:'idle',amount:0};
  return {position:point(config.follow).lerp(neutral,back),phase:back<1?'recover':'idle',amount:1-back};
}

function hostArmPose(game,side,rootPosition,rootQuaternion,target,palm,stage) {
  const original=coinDealerArmPose(side,rootPosition,rootQuaternion,target,palm,stage);
  if(!['dice','roulette'].includes(game)||side!=='right')return original;
  // The fingers grip the rear face of the die. A level outward elbow keeps the
  // complete original sleeve and joint covers behind/beside its solid hull.
  const shoulder=point(original.shoulderWorld),wrist=point(original.wristWorld);
  const dx=wrist.x-shoulder.x,dy=wrist.y-shoulder.y,dz=wrist.z-shoulder.z;
  const distance=Math.hypot(dx,dz),radiusSquared=stage.upperArm**2-dy**2;
  const along=(radiusSquared+distance**2-stage.forearm**2)/(2*distance),height=Math.sqrt(Math.max(0,radiusSquared-along**2));
  const elbow=new THREE.Vector3(shoulder.x+dx/distance*along-dz/distance*height,wrist.y,
    shoulder.z+dz/distance*along+dx/distance*height);
  const aim=(from,to)=>{
    const y=from.clone().sub(to).normalize(),front=new THREE.Vector3(0,1,0);
    const z=front.addScaledVector(y,-front.dot(y)).normalize(),x=new THREE.Vector3().crossVectors(y,z).normalize();
    z.crossVectors(x,y).normalize();return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
  };
  const upper=aim(shoulder,elbow),fore=aim(elbow,wrist);
  return Object.freeze({...original,upper:freeze(rootQuaternion.clone().invert().multiply(upper).toArray()),
    lower:freeze(upper.clone().invert().multiply(fore).toArray()),hand:freeze(fore.clone().invert().multiply(palm).toArray()),
    elbowWorld:freeze(elbow.toArray())});
}

export function classicHostPresentation(game,progress=0,playing=false,reduced=false) {
  const config=CLASSIC_HOST_STAGES[game];
  if(!config)return null;
  const p=clamp(progress),active=Boolean(playing&&!reduced),gesture=gestureTarget(config,p,active);
  const actorQuaternion=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI);
  const stage=Object.freeze({...COIN_DEALER_STAGE,floor:-1.78/config.scale,actorZ:0,coinScale:1,coinHalfThickness:0});
  const rootPosition=new THREE.Vector3(0,stage.floor+stage.hipHeight,0);
  const rootQuaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.018*gesture.amount,0,0));
  const toFrame=target=>target.clone().sub(point(config.position)).divideScalar(config.scale);
  const palms={front:new THREE.Quaternion(),down:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2)};
  const joints={};
  for(const side of ['right','left']) {
    const target=side===config.activeHand?gesture.position:point(config[side]);
    const palm=side===config.activeHand?palms[config.palm].clone():palms.down.clone();
    // A visible wrist turn accompanies the public release, but is zero at the
    // exact prop contact. Its target is solved again with fixed limb lengths.
    if(active&&game==='upgrader'&&side===config.activeHand&&p>config.release&&p<config.release+.07) {
      const flick=Math.sin(Math.PI*clamp((p-config.release)/.07))*.12;
      palm.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),flick));
    }
    const armStage={...stage,coinHalfThickness:side===config.activeHand?config.propRadius/config.scale:0};
    joints[side]=hostArmPose(game,side,rootPosition,rootQuaternion,toFrame(target),palm,armStage);
  }
  const socketWorld=side=>freeze(point(joints[side].socketWorld).multiplyScalar(config.scale).add(point(config.position)).toArray());
  const head=new THREE.Quaternion().setFromEuler(new THREE.Euler(.035+.10*gesture.amount,
    (game==='roulette'?-.18:.18)*gesture.amount,0));
  const handSockets=Object.freeze({right:socketWorld('right'),left:socketWorld('left')});
  return Object.freeze({game,progress:p,phase:gesture.phase,release:config.release,actionRelease:config.release,activeHand:config.activeHand,
    attached:active&&p<config.release,holdingQuaternion:freeze([0,0,0,1]),handClearance:config.propRadius,
    actor:Object.freeze({position:config.position,scale:config.scale,quaternion:freeze(actorQuaternion.toArray())}),
    dealer:Object.freeze({position:freeze(rootPosition.toArray()),quaternion:freeze(actorQuaternion.clone().invert().multiply(rootQuaternion).toArray()),
      head:freeze(head.toArray()),right:joints.right,left:joints.left,legAngle:Math.acos(1/6),pixel:stage.pixel}),
    handsWorld:handSockets,handSockets,
    gestureSocket:socketWorld(config.activeHand),stage});
}
