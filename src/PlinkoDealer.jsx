import React,{useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame,useLoader} from '@react-three/fiber';
import * as THREE from 'three';
import CoinDealer,{COIN_DEALER_SKIN} from './CoinDealer.jsx';
import {plinkoDealerPresentation} from './plinko-dealer-presentation.js';

// Update the same whole skinned rig. The board's existing Fiber advance calls
// this hook; the dealer owns neither a RAF loop nor a separate wall clock.
export function applyPlinkoDealerPose(group,pose,cache={}) {
  if(!group)return cache;
  group.position.fromArray(pose.actor.position);group.quaternion.fromArray(pose.actor.quaternion);group.scale.setScalar(pose.actor.scale);
  const hip=group.getObjectByName('coin-dealer-hip');
  if(!hip)return cache;
  if(cache.hip!==hip) {
    cache.hip=hip;cache.chair=group.getObjectByName('coin-dealer-chair');cache.waist=hip.getObjectByName('coin-dealer-waist');cache.head=hip.getObjectByName('coin-dealer-neck');
    for(const side of ['left','right'])cache[side]={
      shoulder:hip.getObjectByName('coin-dealer-shoulder-'+side),elbow:hip.getObjectByName('coin-dealer-elbow-'+side),
      wrist:hip.getObjectByName('coin-dealer-wrist-'+side),socket:hip.getObjectByName('coin-socket-'+side)};
  }
  if(cache.chair)cache.chair.visible=false;
  hip.position.fromArray(pose.dealer.position);cache.waist.quaternion.fromArray(pose.dealer.quaternion);cache.head.quaternion.fromArray(pose.dealer.head);
  for(const side of ['left','right']) {
    const nodes=cache[side],joints=pose.dealer[side];
    nodes.shoulder.position.fromArray(joints.shoulder);nodes.shoulder.quaternion.fromArray(joints.upper);
    nodes.elbow.position.fromArray(joints.elbow);nodes.elbow.quaternion.fromArray(joints.lower);
    nodes.wrist.position.fromArray(joints.wrist);nodes.wrist.quaternion.fromArray(joints.hand);
    nodes.socket.position.fromArray(joints.socketLocal);
  }
  return cache;
}

export default function PlinkoDealer({controller,reduced=false}) {
  useLoader(THREE.TextureLoader,COIN_DEALER_SKIN);
  const group=useRef(),cache=useRef({});
  const initial=useMemo(()=>plinkoDealerPresentation([],true),[]);
  useLayoutEffect(()=>{controller?.render?.();},[controller]);
  useFrame(()=>{
    const pose=plinkoDealerPresentation(controller?.getPresentation()||[],reduced);
    applyPlinkoDealerPose(group.current,pose,cache.current);
  });
  return <group ref={node=>{group.current=node;if(node)applyPlinkoDealerPose(node,initial,cache.current);}} name="whole-plinko-anonymous-operator" position={initial.actor.position} quaternion={initial.actor.quaternion} scale={initial.actor.scale}>
    <CoinDealer presentation={initial}/>
  </group>;
}
