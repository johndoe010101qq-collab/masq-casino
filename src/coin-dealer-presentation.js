import * as THREE from 'three';
import {classicProgress} from './minecraft-classic-motion.js';

const TAU=Math.PI*2;
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const p=clamp(value);return p*p*(3-2*p);};
const vector=values=>new THREE.Vector3(...values);
const frozen=values=>Object.freeze(values);

// All dimensions use the same one-skin-pixel = 1/16 world-unit scale as the
// approved Blackjack studio. The default table is StudioBackdrop's real felt.
export const COIN_DEALER_STAGE=Object.freeze({
  pixel:1/16,floor:-1.78,feltTop:-1.1975,actorZ:-2.7125,hipHeight:7/16,
  shoulderX:5.5/16,shoulderY:10/16,upperArm:4/16,forearm:4/16,hand:2/16,
  coinScale:.16,coinRadius:1.038,coinHalfThickness:.241,
  release:.26,reveal:.90,landing:.98,returnNeutral:.70,
});

function scalarHermite(from,to,fromVelocity,toVelocity,phase,duration) {
  const t=clamp(phase),t2=t*t,t3=t2*t;
  return (2*t3-3*t2+1)*from+(-2*t3+3*t2)*to
    +(t3-2*t2+t)*duration*fromVelocity+(t3-t2)*duration*toVelocity;
}

// Retime the same physical arc, without introducing a second clock. The
// continuous positive speed rises quickly, lingers around the apex and slows
// into a final edge contact. Knots share derivatives, so camera tracking has
// neither a hold-frame jump nor a sudden restart.
export function coinDealerFlightTime(progress,stage=COIN_DEALER_STAGE) {
  progress=Number.isFinite(progress)?progress:0;
  if(progress<stage.release)return Object.freeze({progress:0,velocity:0});
  if(progress>=stage.landing)return Object.freeze({progress:1,velocity:0});
  const duration=stage.landing-stage.release,s=clamp((progress-stage.release)/duration);
  const reveal=(stage.reveal-stage.release)/duration;
  const knots=[[0,0,1],[.21,.38,.48],[.58,.70,.75],[reveal,.978,.34],[1,1,0]];
  let index=0;while(index<knots.length-2&&s>knots[index+1][0])index++;
  const [x0,y0,m0]=knots[index],[x1,y1,m1]=knots[index+1],span=x1-x0,t=(s-x0)/span;
  const value=scalarHermite(y0,y1,m0,m1,t,span),t2=t*t;
  const slope=((6*t2-6*t)*y0+(-6*t2+6*t)*y1+(3*t2-4*t+1)*span*m0+(3*t2-2*t)*span*m1)/span;
  return Object.freeze({progress:clamp(value),velocity:Math.max(0,slope/duration)});
}

function hermite(from,to,fromVelocity,toVelocity,phase,duration) {
  const t=clamp(phase),t2=t*t,t3=t2*t;
  return from.clone().multiplyScalar(2*t3-3*t2+1)
    .addScaledVector(to,-2*t3+3*t2)
    .addScaledVector(fromVelocity,(t3-2*t2+t)*duration)
    .addScaledVector(toVelocity,(t3-t2)*duration);
}

function aimDown(from,to,pole) {
  const y=from.clone().sub(to).normalize();
  let z=pole.clone().addScaledVector(y,-pole.dot(y));
  if(z.lengthSq()<1e-10)z=new THREE.Vector3(0,0,-1).addScaledVector(y,y.z);
  z.normalize();
  const x=new THREE.Vector3().crossVectors(y,z).normalize();
  z.crossVectors(x,y).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
}

// Analytic two-bone reach: limb lengths never scale to follow a target. A hand
// socket is calculated from the exact same hierarchy returned to the renderer.
export function coinDealerArmPose(side,rootPosition,rootQuaternion,coinSocket,wristWorldQuaternion,stage=COIN_DEALER_STAGE) {
  const shoulderLocal=new THREE.Vector3(side==='right'?-stage.shoulderX:stage.shoulderX,stage.shoulderY,0);
  const shoulder=shoulderLocal.clone().applyQuaternion(rootQuaternion).add(rootPosition);
  const palmLocal=new THREE.Vector3(0,-stage.hand/2,(4.5*stage.pixel)/2+stage.coinHalfThickness*stage.coinScale);
  const requestedWrist=coinSocket.clone().sub(palmLocal.clone().applyQuaternion(wristWorldQuaternion));
  const delta=requestedWrist.clone().sub(shoulder),distance=delta.length();
  const reach=Math.min((stage.upperArm+stage.forearm)*.9995,Math.max(.0001,distance));
  const direction=delta.normalize();
  const pole=new THREE.Vector3(side==='right'?-.65:.65,-.40,-.42).applyQuaternion(rootQuaternion);
  const bend=pole.clone().addScaledVector(direction,-pole.dot(direction)).normalize();
  const along=(stage.upperArm**2+reach**2-stage.forearm**2)/(2*reach);
  const outward=Math.sqrt(Math.max(0,stage.upperArm**2-along**2));
  const elbow=shoulder.clone().addScaledVector(direction,along).addScaledVector(bend,outward);
  const wrist=shoulder.clone().addScaledVector(direction,reach);
  const upperWorld=aimDown(shoulder,elbow,bend.clone().negate());
  const foreWorld=aimDown(elbow,wrist,bend.clone().negate());
  const upper=rootQuaternion.clone().invert().multiply(upperWorld);
  const lower=upperWorld.clone().invert().multiply(foreWorld);
  const hand=foreWorld.clone().invert().multiply(wristWorldQuaternion);
  const socket=wrist.clone().add(palmLocal.clone().applyQuaternion(wristWorldQuaternion));
  return Object.freeze({shoulder:frozen(shoulderLocal.toArray()),upper:frozen(upper.toArray()),
    elbow:frozen([0,-stage.upperArm,0]),lower:frozen(lower.toArray()),
    wrist:frozen([0,-stage.forearm,0]),hand:frozen(hand.toArray()),
    socketLocal:frozen(palmLocal.toArray()),socketWorld:frozen(socket.toArray()),
    wristWorld:frozen(wrist.toArray()),elbowWorld:frozen(elbow.toArray()),shoulderWorld:frozen(shoulder.toArray()),
    reached:distance<=(stage.upperArm+stage.forearm)*.9995});
}

export function coinDealerCoinSupport(quaternion,stage=COIN_DEALER_STAGE) {
  const normal=new THREE.Vector3(0,0,1).applyQuaternion(quaternion);
  const vertical=Math.min(1,Math.abs(normal.y));
  return stage.coinScale*(stage.coinRadius*Math.sqrt(Math.max(0,1-vertical*vertical))+stage.coinHalfThickness*vertical);
}

export function coinDealerPresentation(round,progress=0,playing=false,reduced=false,options={}) {
  const stage={...COIN_DEALER_STAGE,...options},p=classicProgress(round,progress,playing,reduced);
  const active=!!round||playing;
  const rootPosition=new THREE.Vector3(0,stage.floor+stage.hipHeight,stage.actorZ);
  const bodyLean=active&&!reduced&&p<stage.returnNeutral?-.035*Math.sin(Math.PI*clamp(p/stage.returnNeutral)):0;
  const rootQuaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(bodyLean,0,0));
  const palmQuaternion=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
  const neutral=new THREE.Vector3(-.43,stage.feltTop+.44,-2.31);
  const windup=new THREE.Vector3(-.49,stage.feltTop+.43,-2.43);
  const releaseTarget=new THREE.Vector3(-.40,stage.feltTop+.72,-2.40);
  const follow=new THREE.Vector3(-.37,stage.feltTop+.80,-2.24);
  const landing=new THREE.Vector3(.18,stage.feltTop+stage.coinScale*stage.coinHalfThickness,.60);
  const arcHeight=1.25;
  const releaseVelocity=landing.clone().sub(releaseTarget);
  releaseVelocity.y+=4*arcHeight;
  releaseVelocity.multiplyScalar(coinDealerFlightTime(stage.release,stage).velocity);
  const zero=new THREE.Vector3();
  let rightTarget=neutral.clone(),phase='idle';
  if(active&&!reduced&&p<stage.landing) {
    if(p<.14){rightTarget.lerp(windup,smooth(p/.14));phase='prepare';}
    else if(p<stage.release){rightTarget=hermite(windup,releaseTarget,zero,releaseVelocity,(p-.14)/(stage.release-.14),stage.release-.14);phase='toss';}
    else if(p<.32){rightTarget=hermite(releaseTarget,follow,releaseVelocity,zero,(p-stage.release)/(.32-stage.release),.32-stage.release);phase='flight';}
    else{rightTarget=follow.clone().lerp(neutral,smooth((p-.32)/(stage.returnNeutral-.32)));phase='flight';}
  } else if(active)phase='landed';
  const right=coinDealerArmPose('right',rootPosition,rootQuaternion,rightTarget,palmQuaternion,stage);
  const left=coinDealerArmPose('left',rootPosition,rootQuaternion,new THREE.Vector3(.43,stage.feltTop+.44,-2.31),palmQuaternion,stage);
  const handSocket=vector(right.socketWorld);
  const releaseLean=-.035*Math.sin(Math.PI*clamp(stage.release/stage.returnNeutral));
  const releaseRootQuaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(releaseLean,0,0));
  const releaseArm=coinDealerArmPose('right',rootPosition,releaseRootQuaternion,releaseTarget,palmQuaternion,stage);
  const releaseSocket=vector(releaseArm.socketWorld);
  let position=handSocket.clone(),quaternion=palmQuaternion.clone();
  const reveal=active&&p>=stage.reveal;
  const flightTime=coinDealerFlightTime(reduced&&active?stage.landing:p,stage);
  // Reading the private face is confined to the existing public reveal gate.
  const tails=reveal&&round?.face==='tails';
  if(active&&(reduced||p>=stage.release)) {
    const t=flightTime.progress,gateTime=coinDealerFlightTime(stage.reveal,stage);
    const spinScale=TAU*2.25/gateTime.progress,settleDuration=stage.landing-stage.reveal;
    const settling=clamp((p-stage.reveal)/settleDuration);
    let spin=spinScale*t,tilt=.24*Math.sin(Math.PI*t);
    if(reveal) {
      // The common coin reaches disclosure edge-on. Only now may it tip onto
      // the accepted face; it never almost rests on a provisional heads face.
      spin=scalarHermite(TAU*2.25,TAU*(tails?2.5:2),spinScale*gateTime.velocity,0,settling,settleDuration);
      const gateTilt=.24*Math.sin(Math.PI*gateTime.progress),gateTiltVelocity=.24*Math.PI*Math.cos(Math.PI*gateTime.progress)*gateTime.velocity;
      tilt=scalarHermite(gateTilt,0,gateTiltVelocity,0,settling,settleDuration);
    }
    quaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2+spin,tilt,0));
    if(tails)quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI*smooth(settling)));
    // Evaluate the exact hand socket at release: no approximate screen anchor,
    // attachment jump or enlarged hand is used for the transfer.
    position=releaseSocket.clone().lerp(landing,t);position.y+=4*arcHeight*t*(1-t);
    // Exact rotated cylinder support also covers the tiny minted relief. This
    // limits late contact while preserving the common airborne ballistic arc.
    position.y=Math.max(position.y,stage.feltTop+coinDealerCoinSupport(quaternion,stage));
  }
  const watch=active&&!reduced&&p>stage.release&&p<stage.landing?Math.sin(Math.PI*flightTime.progress):0;
  const head=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.19*watch+.025,-.075*watch,.015*watch));
  const legAngle=Math.acos(1/6);
  return Object.freeze({progress:p,flightProgress:active?flightTime.progress:0,flightVelocity:active?flightTime.velocity:0,phase,reveal,attached:!active||(!reduced&&p<stage.release),
    coin:Object.freeze({position:frozen(position.toArray()),quaternion:frozen(quaternion.toArray()),scale:stage.coinScale}),
    dealer:Object.freeze({position:frozen(rootPosition.toArray()),quaternion:frozen(rootQuaternion.toArray()),head:frozen(head.toArray()),
      right,left,legAngle,pixel:stage.pixel}),
    handSocket:frozen(handSocket.toArray()),releaseSocket:frozen(releaseSocket.toArray()),
    stage:Object.freeze(stage)});
}
