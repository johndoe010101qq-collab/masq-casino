import React,{useLayoutEffect,useRef} from 'react';
import * as THREE from 'three';
import {buildRouletteWheel} from './roulette-wheel-model-v48.js';
import {rouletteFilmView} from './roulette-film-presentation.js';
import {rouletteWheelCameraMatrix} from './roulette-wheel-camera-v48.js';

/** A single physical wheel and ball, rendered only when public progress or
 * decoded footage changes. This layer never owns a round or an animation clock. */
export default function RouletteWheelScene({layout,pose,showBall,visible=true}){
  const canvas=useRef(null),runtime=useRef(null);
  useLayoutEffect(()=>{
    const node=canvas.current;if(!node)return;
    let renderer;
    try{renderer=new THREE.WebGLRenderer({canvas:node,alpha:true,antialias:true,powerPreference:'low-power'});}
    catch{return;}
    renderer.setClearColor(0,0);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.03;
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
    const wheel=buildRouletteWheel(THREE);scene.add(wheel.root);
    scene.add(new THREE.HemisphereLight('#c7d6ce','#18231f',.95));
    const key=new THREE.DirectionalLight('#f5e7ce',2.8);key.position.set(-17,39,27);
    key.castShadow=true;key.shadow.mapSize.set(1024,1024);
    Object.assign(key.shadow.camera,{left:-15,right:15,top:15,bottom:-15,near:.5,far:100});
    key.shadow.bias=-.0003;key.shadow.normalBias=.035;
    key.target.position.set(0,14.5,4.6);scene.add(key,key.target);
    const fill=new THREE.DirectionalLight('#73b9a9',.65);fill.position.set(20,24,4);scene.add(fill);
    const rim=new THREE.DirectionalLight('#a1d8cd',1.35);rim.position.set(-3,30,-24);scene.add(rim);
    const ball=new THREE.Mesh(new THREE.SphereGeometry(.42,24,16),new THREE.MeshStandardMaterial({
      color:'#f0e8d5',roughness:.25,metalness:.04}));
    ball.castShadow=true;scene.add(ball);
    const state={renderer,scene,camera,wheel,ball,width:0,height:0};runtime.current=state;
    return()=>{
      if(runtime.current===state)runtime.current=null;
      wheel.dispose();ball.geometry.dispose();ball.material.dispose();
      key.shadow.map?.dispose();renderer.dispose();
    };
  },[]);
  useLayoutEffect(()=>{
    const state=runtime.current;if(!state||!layout||!visible)return;
    const {renderer,scene,camera,wheel,ball}=state,view=rouletteFilmView(layout.mobile);
    const quality=Math.min(2,window.devicePixelRatio||1)*(layout.viewportFactor||1);
    const width=Math.max(1,Math.round(view.width*quality)),height=Math.max(1,Math.round(view.height*quality));
    if(state.width!==width||state.height!==height){renderer.setSize(width,height,false);state.width=width;state.height=height;}
    camera.position.fromArray(view.eye);camera.updateMatrixWorld();
    camera.projectionMatrix.fromArray(rouletteWheelCameraMatrix(view));
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    wheel.rotor.rotation.y=pose.rotorAngle;
    wheel.setAcceptedPocket?.(pose.phase==='settled'?pose.pocketIndex:null);
    ball.position.fromArray(pose.position);ball.visible=showBall;
    // The sphere must clear the entire lip, rather than checking only its
    // centre against the surface directly below it.
    for(let i=-12;i<=12;i++){
      const offset=.42*i/12,surface=wheel.surfaceYAtRadius?.(pose.radius+offset);
      if(Number.isFinite(surface))ball.position.y=Math.max(ball.position.y,surface+Math.sqrt(.42*.42-offset*offset));
    }
    renderer.render(scene,camera);
  },[layout,pose,showBall,visible]);
  return <canvas ref={canvas} className="roulette-wheel-scene" aria-hidden="true" />;
}
