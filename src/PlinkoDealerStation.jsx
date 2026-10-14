import React,{useMemo} from 'react';
import * as THREE from 'three';
// The full operator rig is supported behind the cabinet. Its bust and feeding
// hands remain visible; the machine covers the service platform and lower body.
export default function PlinkoDealerStation(){
 const face=useMemo(()=>{const target=new THREE.Object3D();target.position.set(0,2.20,-.15);return target;},[]);
 return <group name="rear-anonymous-operator-station">
  <primitive object={face}/>
  <spotLight name="operator-overhead-key" position={[-2.8,4.6,3.2]} target={face} color="#e0ddc9" intensity={35} distance={10} decay={1} angle={.44} penumbra={.8} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-normalBias={.008}/>
  <spotLight name="operator-green-edge" position={[2.3,3.7,-1.2]} target={face} color="#90bca3" intensity={18} distance={7} decay={1} angle={.48} penumbra={.9}/>
  <mesh position={[0,-1.4875,-1.10]} castShadow receiveShadow><boxGeometry args={[1.45,2.385,.90]}/><meshStandardMaterial color="#18272e" roughness={.95}/></mesh>
  <mesh position={[0,.46,-.45]} castShadow receiveShadow><boxGeometry args={[1.35,.24,.50]}/><meshStandardMaterial color="#242c30" roughness={.9}/></mesh>
  <mesh position={[0,.08,-.60]} castShadow><boxGeometry args={[.20,.68,.20]}/><meshStandardMaterial color="#637578" roughness={.7} metalness={.20}/></mesh>
 </group>;
}
