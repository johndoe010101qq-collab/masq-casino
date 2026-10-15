import assert from 'node:assert/strict';
import * as THREE from 'three';
import {rouletteWheelCameraMatrix} from '../src/roulette-wheel-camera-v48.js';
import {rouletteFilmView,rouletteFilmProject} from '../src/roulette-film-presentation.js';
let positions=0;
for(const mobile of [false,true]){
  const view=rouletteFilmView(mobile),camera=new THREE.PerspectiveCamera();
  camera.position.fromArray(view.eye);camera.updateMatrixWorld();
  camera.projectionMatrix.fromArray(rouletteWheelCameraMatrix(view));
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  // Sample the bowl, the airborne handoff and the final pockets, rather than
  // only the screen centre where an approximate camera would also pass.
  const points=[[-6.05086,16.58275,-1.53901],[0,11.2,4.6],[0,19,4.6]];
  for(const radius of [2.6,5.25,6.35,9,10.85])for(let i=0;i<74;i++)
    points.push([Math.sin(i*Math.PI/37)*radius,14.92,4.6+Math.cos(i*Math.PI/37)*radius]);
  for(const point of points){
    const ndc=new THREE.Vector3(...point).project(camera),reference=rouletteFilmProject(point,mobile);
    assert.ok(Math.abs((ndc.x+1)*view.width/2-reference.x)<1e-8,'Wheel and footage must share the horizontal camera');
    assert.ok(Math.abs((1-ndc.y)*view.height/2-reference.y)<1e-8,'Wheel and footage must share the vertical camera');
    assert.ok(ndc.z>-1&&ndc.z<1,'Visible wheel depth must remain inside the frustum');
    positions++;
  }
}
console.log(`Roulette wheel camera: ${positions} physical anchors PASS across both native views`);
