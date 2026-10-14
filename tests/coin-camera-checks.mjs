import assert from 'node:assert/strict';
import * as THREE from 'three';
import {coinDealerPresentation,COIN_DEALER_STAGE} from '../src/coin-dealer-presentation.js';
import {coinCameraPresentation,coinCameraZoom,COIN_WIDE_CAMERA} from '../src/coin-camera-presentation.js';

let checks=0;
const vector=values=>new THREE.Vector3(...values);
const cameraFor=(pose,width,height)=>{
  const framing=coinCameraPresentation(pose);
  const camera=new THREE.OrthographicCamera(-width/2,width/2,height/2,-height/2,.1,60);
  camera.position.fromArray(framing.position);camera.lookAt(...framing.target);
  camera.zoom=coinCameraZoom(framing,width,height);
  camera.updateProjectionMatrix();camera.updateMatrixWorld();return camera;
};
const project=(pose,camera,x,y,z)=>new THREE.Vector3(x,y,z).multiplyScalar(pose.coin.scale)
  .applyQuaternion(new THREE.Quaternion(...pose.coin.quaternion)).add(vector(pose.coin.position)).project(camera);

const idle=coinCameraPresentation(coinDealerPresentation(null));
assert.deepEqual(idle.position,COIN_WIDE_CAMERA.at);assert.deepEqual(idle.target,COIN_WIDE_CAMERA.target);checks+=2;
for(let tick=0;tick<900;tick+=3){
  const poison={get face(){throw Error('Camera exposed a private face');}},p=tick/1000;
  const common=coinCameraPresentation(coinDealerPresentation(poison,p,true));
  assert.deepEqual(common,coinCameraPresentation(coinDealerPresentation({face:'heads'},p,true)));checks++;
  assert.deepEqual(common,coinCameraPresentation(coinDealerPresentation({face:'tails'},p,true)));checks++;
}
for(const face of ['heads','tails']){
  for(const p of [.26,.28,.50,.64,.90,COIN_DEALER_STAGE.landing]){
    const before=coinCameraPresentation(coinDealerPresentation({face},p-1e-7,true));
    const after=coinCameraPresentation(coinDealerPresentation({face},p+1e-7,true));
    assert.ok(vector(before.position).distanceTo(vector(after.position))<1e-4);checks++;
    assert.ok(Math.abs(before.width-after.width)<1e-4);checks++;
  }
  const final=coinDealerPresentation({face},1,false),view=coinCameraPresentation(final);
  const faceNormal=vector([0,0,face==='heads'?1:-1]).applyQuaternion(new THREE.Quaternion(...final.coin.quaternion));
  assert.ok(faceNormal.dot(vector(view.position).sub(vector(view.target)).normalize())>.85,'Result face has a readable overhead angle');checks++;
  const camera=cameraFor(final,300,272),center=vector(final.coin.position).project(camera);
  const edge=project(final,camera,COIN_DEALER_STAGE.coinRadius,0,0);
  assert.ok(2*center.distanceTo(edge)*150>90,'The small coin projects to a readable mobile close-up');checks++;
  assert.deepEqual(view,coinCameraPresentation(coinDealerPresentation({face},.1,true,true)));checks++;
  for(const [width,height] of [[300,272],[360,420],[794,567],[960,600],[1440,600],[320,140]]){
    for(let tick=0;tick<=100;tick++){
      const pose=coinDealerPresentation({face},tick/100,true),camera=cameraFor(pose,width,height);
      for(let index=0;index<24;index++)for(const depth of [-COIN_DEALER_STAGE.coinHalfThickness,COIN_DEALER_STAGE.coinHalfThickness]){
        const angle=index*Math.PI/12,point=project(pose,camera,Math.cos(angle)*COIN_DEALER_STAGE.coinRadius,Math.sin(angle)*COIN_DEALER_STAGE.coinRadius,depth);
        assert.ok(Math.abs(point.x)<.95&&Math.abs(point.y)<.95&&point.z>-1&&point.z<1,'Whole flight and both faces fit the camera without clipping');checks++;
      }
    }
  }
}
for(const size of [0,-1,NaN,Infinity]){assert.ok(Number.isFinite(coinCameraZoom(idle,size,size)));checks++;}
console.log(JSON.stringify({passed:true,checks,scope:'Public reveal, mobile face readability, whole-flight framing, continuous camera, skip and reduced motion'}));
