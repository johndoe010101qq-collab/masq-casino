import React,{useLayoutEffect,useMemo,useRef} from 'react';
import {useLoader,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import CoinDealer,{COIN_DEALER_SKIN} from './CoinDealer.jsx';
import {classicHostPresentation} from './classic-host-presentation.js';

// The shared rig owns its skin materials and geometries. Only the supported
// chair orientation is independent of the legs turned behind the instrument.
export function applyClassicHostPose(group,pose) {
  if(!group||!pose)return;
  group.position.fromArray(pose.actor.position);
  group.quaternion.fromArray(pose.actor.quaternion);
  group.scale.setScalar(pose.actor.scale);
  const chair=group.getObjectByName('coin-dealer-chair');
  if(chair)chair.quaternion.copy(group.quaternion).invert();
}

export default function ClassicHost({game,progress=0,playing=false,reduced=false}) {
  // Suspend the parent on the same cached local asset, so the initial idle
  // redraw happens after the complete exact-skin child can actually mount.
  useLoader(THREE.TextureLoader,COIN_DEALER_SKIN);
  const invalidate=useThree(state=>state.invalidate),group=useRef();
  const pose=useMemo(()=>classicHostPresentation(game,progress,playing,reduced),[game,progress,playing,reduced]);
  useLayoutEffect(()=>{applyClassicHostPose(group.current,pose);invalidate();},[pose,invalidate]);
  if(!pose)return null;
  return <group ref={group} name={'whole-anonymous-'+game+'-host'} position={pose.actor.position}
    quaternion={pose.actor.quaternion} scale={pose.actor.scale}>
    <CoinDealer presentation={pose}/>
  </group>;
}
