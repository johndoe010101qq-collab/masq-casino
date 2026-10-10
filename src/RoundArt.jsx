import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, extend, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ROULETTE_NUMBERS, PLINKO_MULTIPLIERS } from './game-math.js';
import { createSlotModel } from './art/createSlotModels.js';
import { FramePump, useReducedMotion, usePageVisible } from './SceneMotion.jsx';

const TAU = Math.PI * 2;
extend({ RoundedBoxGeometry });
const C = { ink:'#111b27', graphite:'#183946', edge:'#ac8547', cream:'#f3dfb6', silver:'#dac79c', red:'#902b38', warm:'#d3a143', cyan:'#237982' };
const toonRamp = new THREE.DataTexture(new Uint8Array([70,70,70,255,155,155,155,255,245,245,245,255]),3,1,THREE.RGBAFormat);
toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter;
toonRamp.needsUpdate = true;
const clamp = n => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const ease = n => 1 - Math.pow(1 - clamp(n), 3);
const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

// Pure presentation coordinates. All outcomes are supplied by the round engine.
export function computePlinkoPose(path, progress) {
  const route = Array.isArray(path) && path.length === 9 ? path : [0,-1,0,1,0,-1,0,1,0];
  const t = clamp(progress) * 9;
  if (t >= 8) return [route[8]*.28, -1.58-(t-8)*.20, .23-(t-8)*.13];
  const i = Math.min(7, Math.floor(t)), f=t-i;
  return [THREE.MathUtils.lerp(route[i], route[i+1], f) * .28,
    2.02 - (i + f) * .45, .23 + Math.sin(Math.PI * f) * .045];
}
export function rouletteBallAngle(pocketIndex, progress) {
  const p = clamp(progress);
  return -6 * TAU * ease(p) + (Math.max(0, Math.min(36, pocketIndex || 0)) * TAU / 37) * ease(p);
}

function Mat({ color=C.graphite, metal=.2, rough=.66, ...props }) {
  return <meshToonMaterial color={color} gradientMap={toonRamp} {...props}/>;
}
function BevelBox({ size, at=[0,0,0], color=C.graphite, metal=.55, rough=.32, radius=.05 }) {
  return <mesh position={at} castShadow receiveShadow>
    <roundedBoxGeometry args={[...size,3,radius]}/><Mat color={color} metal={metal} rough={rough}/>
  </mesh>;
}
function GlowBar({ size, at, color=C.cyan }) {
  return <mesh position={at}><boxGeometry args={size}/>
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={.12} roughness={.4} metalness={.6}/>
  </mesh>;
}
function Ring({ radius, tube=.025, at=[0,0,0], rotation=[0,0,0], color=C.silver, glow=false }) {
  return <mesh position={at} rotation={rotation} castShadow>
    <torusGeometry args={[radius,tube,8,80]}/><Mat color={color} metal={glow ? .62 : .84} rough={.27}
      emissive={glow ? color : '#000000'} emissiveIntensity={glow ? .1 : 0}/>
  </mesh>;
}
function Box({ size, at=[0,0,0], rotation=[0,0,0], color, metal, rough=.34 }) {
  return <mesh position={at} rotation={rotation} castShadow receiveShadow>
    <boxGeometry args={size}/><Mat color={color} metal={metal} rough={rough}/>
  </mesh>;
}
function Cylinder({ radius, height, at=[0,0,0], color, rotation=[0,0,0], segments=32, metal=.4, rough=.32 }) {
  return <mesh position={at} rotation={rotation} castShadow receiveShadow>
    <cylinderGeometry args={[radius,radius,height,segments]}/><Mat color={color} metal={metal} rough={rough}/>
  </mesh>;
}
function RasterLabel({ text, width=1, height=.35, at=[0,0,0], rotation=[0,0,0], color=C.cream, background=null }) {
  const [texture,setTexture] = useState(null);
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = Math.max(64,Math.round(256*height/width));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if (background) { ctx.fillStyle=background; ctx.fillRect(0,0,canvas.width,canvas.height); }
    ctx.font = `700 ${Math.round(canvas.height*.65)}px Arial, sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle=color; ctx.fillText(String(text),canvas.width/2,canvas.height/2,canvas.width*.94);
    const next = new THREE.CanvasTexture(canvas);
    next.colorSpace=THREE.SRGBColorSpace;
    setTexture(next);
    return () => next.dispose();
  },[text,color,background,width,height]);
  if (!texture) return null;
  return <mesh position={at} rotation={rotation}>
    <planeGeometry args={[width,height]}/>
    <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false}/>
  </mesh>;
}
function MaskMesh({ fit=1.65 }) {
  const [model,setModel] = useState(null);
  const [texture,setTexture] = useState(null);
  useEffect(() => {
    const next=createSlotModel('scatter',{fit});
    setModel(next);
    return () => next.userData.dispose();
  },[fit]);
  useEffect(() => {
    let active = true;
    const next = new THREE.TextureLoader().load(import.meta.env.BASE_URL + 'anonymous-mask-minimal.png', loaded => {
      if (active) { loaded.colorSpace = THREE.SRGBColorSpace; setTexture(loaded); }
      else loaded.dispose();
    }, undefined, () => {});
    return () => { active = false; next.dispose(); };
  }, []);
  if (texture) return <mesh><planeGeometry args={[fit,fit * texture.image.height / texture.image.width]}/><meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false}/></mesh>;
  return model ? <primitive object={model} dispose={null}/> : null;
}
function Ground({ width=5, depth=4, y=-1.3 }) {
  return <group position={[0,y,0]}>
    <BevelBox size={[width,.22,depth]} color={C.ink} radius={.065} rough={.28}/>
    <BevelBox size={[width-.10,.045,depth-.10]} at={[0,.1,0]} color={C.edge} radius={.025} rough={.28} metal={.82}/>
    <BevelBox size={[width-.19,.023,depth-.19]} at={[0,.13,0]} color={C.graphite} radius={.015} rough={.85} metal={.08}/>
    <GlowBar size={[width-.48,.025,.032]} at={[0,.042,depth/2+.006]}/>
    {[-1,1].map(side=><group key={side}>
      <GlowBar size={[.027,.022,depth-.56]} at={[side*(width/2-.025),.12,0]} color={side===1 ? C.red : C.cyan}/>
      {[-1,1].map(end=><Cylinder key={end} radius={.045} height={.015} segments={16} metal={.88}
        color={C.silver} at={[side*(width/2-.16),.145,end*(depth/2-.16)]}/>)}
    </group>)}
  </group>;
}
function StudioFloor({ y=-.57, width=7, depth=6 }) {
  return <mesh position={[0,y,0]} rotation={[-Math.PI/2,0,0]} receiveShadow>
    <planeGeometry args={[width,depth]}/><shadowMaterial opacity={.32}/>
  </mesh>;
}
const FIT = {
  coin:{w:3.8,h:4.6,at:[2.4,3.4,9],target:[0,.45,0]},
  dice:{w:2.7,h:2.55,at:[4.6,5.4,8],target:[0,.20,0]},
  plinko:{w:6.5,h:5.8,at:[1.8,3,10],target:[0,0,0]},
  roulette:{w:7.9,h:5.5,at:[3.2,8.6,10],target:[0,0,0]},
  slots:{w:4.1,h:4.1,at:[2,1.8,8],target:[0,0,0]},
};
function FitCamera({ game }) {
  const {camera,size,invalidate}=useThree();
  useEffect(() => {
    const b=FIT[game] || FIT.slots;
    camera.position.set(...b.at); camera.lookAt(...b.target);
    camera.zoom=Math.max(1,Math.min(size.width/b.w,size.height/b.h)*.93);
    camera.near=.1; camera.far=80;
    camera.updateProjectionMatrix(); invalidate();
  },[game,size.width,size.height,camera,invalidate]);
  return null;
}

function Coin({ round, progress, playing }) {
  const ref=useRef();
  const p=playing ? clamp(progress) : round ? 1 : 0;
  useFrame(() => {
    if (!ref.current) return;
    const angle=round?.face === 'tails' ? Math.PI : 0;
    ref.current.rotation.y=(4*TAU+angle)*ease(p);
    ref.current.rotation.z=Math.sin(p*Math.PI)*.18;
    ref.current.position.y=.2+Math.sin(p*Math.PI)*1.15;
  });
  return <>
    <StudioFloor y={-.94}/>
    <group ref={ref} position={[0,.2,0]}>
      <Cylinder radius={1.12} height={.20} rotation={[Math.PI/2,0,0]} color={C.warm} segments={80} metal={.88}/>
      <Cylinder radius={1.04} height={.225} rotation={[Math.PI/2,0,0]} color={C.graphite} segments={80} metal={.66}/>
      {[1,-1].map(side => <mesh key={side} position={[0,0,side*.13]} castShadow>
        <torusGeometry args={[1.06,.045,8,80]}/><Mat color={C.silver} metal={.88} rough={.19}/>
      </mesh>)}
      {[1,-1].map(side=><group key={'detail-'+side}>
        <Ring radius={.97} tube={.014} at={[0,0,side*.143]} color={side===1 ? C.silver : C.red}/>
        <Ring radius={.82} tube={.012} at={[0,0,side*.145]} color={C.warm}/>
        {Array.from({length:16},(_,i)=>{const a=i*TAU/16;return <mesh key={i} position={[Math.sin(a)*.925,Math.cos(a)*.925,side*.147]}>
          <sphereGeometry args={[.016,8,6]}/><Mat color={C.silver} metal={.9} rough={.2}/>
        </mesh>;})}
      </group>)}
      {Array.from({length:16},(_,i) => {
        const a=i*TAU/16;
        return <Box key={i} size={[.055,.085,.225]} at={[Math.sin(a)*1.125,Math.cos(a)*1.125,0]} rotation={[0,0,-a]} color={C.silver} metal={.7}/>;
      })}
      <group position={[0,.015,.141]}><MaskMesh fit={1.00}/></group>
      <RasterLabel text="1" width={.86} height={1.22} at={[0,0,-.145]} rotation={[0,Math.PI,0]}/>
    </group>
  </>;
}

const PIPS = {
  1:[[0,0]], 2:[[-1,1],[1,-1]], 3:[[-1,1],[0,0],[1,-1]],
  4:[[-1,-1],[-1,1],[1,-1],[1,1]],
  5:[[-1,-1],[-1,1],[0,0],[1,-1],[1,1]],
  6:[[-1,-1],[-1,0],[-1,1],[1,-1],[1,0],[1,1]]
};
const FACES = [
  [1,[0,.514,0],[-Math.PI/2,0,0]], [6,[0,-.514,0],[Math.PI/2,0,0]],
  [2,[0,0,.514],[0,0,0]], [5,[0,0,-.514],[0,Math.PI,0]],
  [3,[.514,0,0],[0,Math.PI/2,0]], [4,[-.514,0,0],[0,-Math.PI/2,0]]
];
const DIE_ROT = {1:[0,0,0],2:[-Math.PI/2,0,0],3:[0,0,Math.PI/2],4:[0,0,-Math.PI/2],5:[Math.PI/2,0,0],6:[Math.PI,0,0]};
// Real voids are cut into the six flat faces; the curved bowls sit inside the
// body, below its surface. The edge shell keeps its original rounded normals.
function DieEdges() {
  const [geometry,setGeometry]=useState(null);
  useEffect(()=>{
    const source=new RoundedBoxGeometry(1.02,1.02,1.02,6,.095);
    const positions=source.attributes.position, normals=source.attributes.normal;
    const vertices=[], directions=[];
    for(let i=0;i<positions.count;i+=3){
      const a=new THREE.Vector3().fromBufferAttribute(normals,i);
      const b=new THREE.Vector3().fromBufferAttribute(normals,i+1);
      const c=new THREE.Vector3().fromBufferAttribute(normals,i+2);
      const axial=Math.max(Math.abs(a.x),Math.abs(a.y),Math.abs(a.z))>.99999;
      if(axial && a.distanceTo(b)<.00001 && a.distanceTo(c)<.00001)continue;
      for(let j=i;j<i+3;j++){
        vertices.push(positions.getX(j),positions.getY(j),positions.getZ(j));
        directions.push(normals.getX(j),normals.getY(j),normals.getZ(j));
      }
    }
    const next=new THREE.BufferGeometry();
    next.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    next.setAttribute('normal',new THREE.Float32BufferAttribute(directions,3));
    next.computeBoundingSphere(); source.dispose(); setGeometry(next);
    return()=>next.dispose();
  },[]);
  return geometry && <mesh geometry={geometry} castShadow receiveShadow>
    <Mat color={C.cream} metal={.025} rough={.29}/>
  </mesh>;
}
function DieFace({ value, at, rotation }) {
  const shape=useMemo(()=>{
    const next=new THREE.Shape();
    next.moveTo(-.415,-.415);next.lineTo(.415,-.415);next.lineTo(.415,.415);next.lineTo(-.415,.415);next.closePath();
    for(const [x,y]of PIPS[value]){
      const hole=new THREE.Path();hole.absarc(x*.26,y*.26,.079,0,TAU,true);next.holes.push(hole);
    }
    return next;
  },[value]);
  const bowl=useMemo(()=>Array.from({length:10},(_,i)=>{
    const radius=.079*i/9;return new THREE.Vector2(radius,-.029*(1-(i/9)**2));
  }),[]);
  return <group position={at.map(n=>n/.514*.51)} rotation={rotation}>
    <mesh castShadow receiveShadow><shapeGeometry args={[shape,28]}/><Mat color={C.cream} metal={.025} rough={.29}/></mesh>
    {PIPS[value].map(([x,y],i)=><mesh key={i} position={[x*.26,y*.26,0]} rotation={[Math.PI/2,0,0]} receiveShadow>
      <latheGeometry args={[bowl,32]}/><meshToonMaterial color="#0b0e13" gradientMap={toonRamp} side={THREE.DoubleSide}/>
    </mesh>)}
  </group>;
}
export function computeDicePose(value, progress) {
  const p=clamp(progress), r=DIE_ROT[value]||DIE_ROT[1];
  const spin=Math.max(0,1-p/.9)**2;
  const rotation=[r[0]+spin*TAU*2.5,r[1]+spin*TAU*1.75,r[2]+spin*TAU*1.25];
  let height=0;
  if(p<.16){const t=p/.16;height=.42*(1-t)+.65*t*(1-t);}
  else if(p<.34)height=.34*Math.sin(Math.PI*(p-.16)/.18);
  else if(p<.53)height=.18*Math.sin(Math.PI*(p-.34)/.19);
  else if(p<.72)height=.075*Math.sin(Math.PI*(p-.53)/.19);
  else if(p<.92){const t=(p-.72)/.2;height=.016*Math.abs(Math.sin(t*TAU))*(1-t);}
  const matrix=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation));
  const e=matrix.elements;
  // Rounded-cube support function keeps every corner above the contact plane
  // during a roll, instead of pushing a spinning cube through its surface.
  const contact=.415*(Math.abs(e[1])+Math.abs(e[5])+Math.abs(e[9]))+.095;
  const travel=ease(Math.min(1,p/.72));
  return {rotation,position:[-.68*(1-travel)+Math.sin(p*Math.PI*3)*.075*(1-p),
    -.57+contact+height,-.24*(1-travel)+Math.sin(p*Math.PI*2)*.06*(1-p)]};
}
function Dice({ round, progress, playing }) {
  const ref=useRef();
  const p=playing ? clamp(progress) : round ? 1 : 0;
  useFrame(() => {
    if (!ref.current) return;
    const pose=computeDicePose(round?.value||1,round||playing ? p : 1);
    ref.current.rotation.set(...pose.rotation);
    ref.current.position.set(...pose.position);
  });
  return <>
    <StudioFloor y={-.57}/>
    <group ref={ref} position={[0,.05,0]}>
      <mesh scale={1.025}><roundedBoxGeometry args={[1.02,1.02,1.02,6,.095]}/><meshBasicMaterial color="#080b10" side={THREE.BackSide}/></mesh>
      <DieEdges/>{FACES.map(([value,at,rotation])=><DieFace key={value} value={value} at={at} rotation={rotation}/>)}
    </group>
  </>;
}
function Plinko({ round, progress, playing }) {
  const ball=useRef();
  const p=playing ? clamp(progress) : round ? 1 : 0;
  useFrame(() => { if(ball.current) ball.current.position.set(...computePlinkoPose(round?.path,p)); });
  return <>
    <BevelBox size={[5.68,4.67,.24]} at={[0,.1,-.21]} color={C.ink} radius={.065}/>
    <BevelBox size={[5.47,4.46,.07]} at={[0,.1,-.088]} color={C.edge} radius={.025} metal={.78}/>
    <Box size={[5.31,4.33,.045]} at={[0,.1,-.043]} color={C.graphite} rough={.92}/>
    <GlowBar size={[5.24,.038,.03]} at={[0,2.29,-.04]}/>
    {[-1,1].map(side=><GlowBar key={'glow-'+side} size={[.025,4.14,.032]} at={[side*2.75,.12,-.04]} color={side===1 ? C.red : C.cyan}/>)}
    {[-1,1].map(s => <Box key={s} size={[.1,4.5,.32]} at={[s*2.68,.1,0]} color={C.edge}/>)}
    {Array.from({length:8},(_,r) => Array.from({length:r+1},(_,c) =>
      <Cylinder key={r+'-'+c} radius={.05} height={.20} at={[(c-r/2)*.56,1.75-r*.45,.1]} rotation={[Math.PI/2,0,0]} color={C.silver} segments={20} metal={.86} rough={.2}/>
    ))}
    {Array.from({length:9},(_,i) => <group key={i} position={[(i-4)*.56,-1.96,0]}>
      <Box size={[.52,.12,.45]} color={i===round?.bin ? C.red : C.ink}/>
      <Box size={[.04,.48,.45]} at={[-.265,.18,0]} color={C.edge}/>
      <RasterLabel text={String(PLINKO_MULTIPLIERS[i])+'×'} width={.49} height={.19} at={[0,-.005,.24]} color={C.cream}/>
    </group>)}
    <Box size={[.04,.48,.45]} at={[2.51,-1.78,0]} color={C.edge}/>
    <mesh ref={ball} position={[0,2.02,.23]} castShadow>
      <sphereGeometry args={[.12,24,16]}/><Mat color={C.cream} metal={.52} rough={.16}/>
    </mesh>
  </>;
}
function Roulette({ round, progress, playing }) {
  const wheel=useRef(),ball=useRef();
  const p=playing ? clamp(progress) : round ? 1 : 0;
  useFrame(() => {
    if(wheel.current) wheel.current.rotation.y=4*TAU*ease(p);
    if(ball.current) {
      const a=rouletteBallAngle(round?.pocketIndex || 0,p);
      const settle=clamp((p-.60)/.40),r=2.45-.29*ease(settle);
      ball.current.position.set(Math.sin(a)*r,.29+Math.sin(Math.PI*settle)*.055,Math.cos(a)*r);
    }
  });
  const bowl=useMemo(()=>[[2.34,.14],[2.45,.205],[2.65,.31],[2.80,.26],[2.82,.12],
    [2.79,-.15],[2.60,-.29],[2.31,-.18],[2.34,.14]].reverse().map(([r,y])=>new THREE.Vector2(r,y)),[]);
  const cone=useMemo(()=>[[1.54,.265],[1.46,.295],[.50,.48],[.46,.485]].map(([r,y])=>new THREE.Vector2(r,y)),[]);
  return <>
    <StudioFloor y={-.315} width={10} depth={10}/>
    <mesh castShadow receiveShadow><latheGeometry args={[bowl,112]}/><Mat color={C.ink}/></mesh>
    <Ring radius={2.77} tube={.021} at={[0,.257,0]} rotation={[Math.PI/2,0,0]} color={C.silver}/>
    <Ring radius={2.76} tube={.013} at={[0,-.05,0]} rotation={[Math.PI/2,0,0]} color={C.red}/>
    <group ref={wheel}>
      {ROULETTE_NUMBERS.map((number,i) => {
        const a=i*TAU/37,s=TAU/37;
        const color=number===0 ? '#305046' : RED.has(number) ? '#b5322b' : '#17191c';
        return <group key={number}>
          <mesh position={[0,.16,0]} castShadow receiveShadow>
            <cylinderGeometry args={[2.34,2.34,.11,1,1,false,a-s*.475,s*.95]}/>
            <Mat color={color} metal={.28} rough={.35}/>
          </mesh>
          <group rotation={[0,a+s/2,0]}>
            <Box size={[.025,.065,.65]} at={[0,.24,2.0]} color={C.silver} metal={.65}/>
          </group>
          <group rotation={[0,a,0]}>
            <RasterLabel text={number} width={.29} height={.19} at={[0,.227,1.94]} rotation={[-Math.PI/2,0,0]}/>
          </group>
        </group>;
      })}
      <Cylinder radius={1.54} height={.21} at={[0,.165,0]} color={C.graphite} segments={80} metal={.72}/>
      <mesh castShadow receiveShadow><latheGeometry args={[cone,112]}/><Mat color={C.graphite}/></mesh>
      <Ring radius={1.51} tube={.018} at={[0,.279,0]} rotation={[Math.PI/2,0,0]} color={C.silver}/>
      <Cylinder radius={.48} height={.29} at={[0,.34,0]} color={C.warm} segments={40} metal={.86}/>
      <Cylinder radius={.115} height={.46} at={[0,.67,0]} color={C.silver} segments={24} metal={.86}/>
      <Box size={[1.05,.085,.085]} at={[0,.79,0]} color={C.silver} metal={.75}/>
    </group>
    <mesh ref={ball} position={[0,.32,2.45]} castShadow>
      <sphereGeometry args={[.075,24,16]}/><Mat color={C.cream} rough={.14} metal={.24}/>
    </mesh>
  </>;
}
function Slots() {
  return <>
    <Ground width={3.2} depth={2.2} y={-1.45}/>
    <Box size={[1.0,.25,.74]} at={[0,-1.22,-.04]} color={C.edge}/>
    <group position={[0,-.045,0]}><MaskMesh fit={2.1}/></group>
  </>;
}
function IdleCamera({ game, active }) {
  const camera=useThree(state=>state.camera),phase=useRef(0);
  useFrame((_,delta) => {
    if (!active) return;
    const b=FIT[game] || FIT.slots;
    phase.current+=Math.min(.05,Math.max(0,delta));
    camera.position.set(b.at[0]+Math.sin(phase.current*.55)*.22,b.at[1],b.at[2]);
    camera.lookAt(...b.target);
  });
  return null;
}
function World({ game, round, progress, playing, thumbnail, visible, targetChoice }) {
  const reduced=useReducedMotion(),pageVisible=usePageVisible();
  const active=visible && pageVisible && !reduced;
  const props={round,targetChoice,progress:reduced && round ? 1 : progress,playing:playing && !reduced};
  let scene;
  switch(game) {
    case 'coin': case 'coinflip': scene=<Coin {...props}/>; break;
    case 'dice': scene=<Dice {...props}/>; break;
    case 'plinko': scene=<Plinko {...props}/>; break;
    case 'roulette': scene=<Roulette {...props}/>; break;
    default: scene=<Slots/>;
  }
  const fitGame=game==='coinflip' ? 'coin' : FIT[game] ? game : 'slots';
  return <>
    <FitCamera game={fitGame}/>
    <IdleCamera game={fitGame} active={active && !playing && !round}/>
    <FramePump active={active} fps={playing ? 60 : thumbnail ? 30 : 45}/>
    <ambientLight intensity={.7}/>
    <hemisphereLight args={['#f4e9d0','#182637',.55]}/>
    <directionalLight position={[-3,7,5]} intensity={1.8} color="#fff1d8" castShadow shadow-mapSize-width={thumbnail ? 512 : 1024} shadow-mapSize-height={thumbnail ? 512 : 1024}
      shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={5} shadow-camera-bottom={-4} shadow-normalBias={.02} shadow-radius={3}/>
    <directionalLight position={[-5,3,-2]} intensity={.85} color="#cad3dc"/>
    <directionalLight position={[4,2,-3]} intensity={.45} color="#e2e7ed"/>
    {scene}
  </>;
}
class ArtBoundary extends React.Component {
  state={failed:false};
  static getDerivedStateFromError(){ return {failed:true}; }
  componentDidUpdate(prev){ if(prev.game!==this.props.game && this.state.failed) this.setState({failed:false}); }
  render(){ return this.state.failed ? <div className="art-fallback">Включи аппаратное ускорение браузера для 3D.</div> : this.props.children; }
}
function ContextMonitor({ onLost }) {
  const gl=useThree(state=>state.gl);
  useEffect(() => {
    const node=gl.domElement;
    const listener=event=>{event.preventDefault();onLost(true);};
    node.addEventListener('webglcontextlost',listener);
    return ()=>node.removeEventListener('webglcontextlost',listener);
  },[gl,onLost]);
  return null;
}
export default function GameArt({game,round=null,progress=0,playing=false,thumbnail=false,visible=true,targetChoice=2}) {
  const [lost,setLost]=useState(false);
  return <div className="game-art" style={{width:'100%',height:'100%',minHeight:140}}>
    <ArtBoundary game={game}>
      {lost ? <div className="art-fallback">3D-контекст прерван. Обнови страницу.</div> :
      <Canvas orthographic frameloop="demand" shadows="percentage" dpr={[1,thumbnail ? 1.25 : 1.6]} camera={{position:[3,4,9],zoom:55,near:.1,far:80}}
        gl={{antialias:true,alpha:true,powerPreference:'high-performance'}}
        fallback={<div className="art-fallback">Браузер не поддерживает WebGL.</div>}
        onCreated={({gl}) => gl.setClearColor(0x000000,0)}>
        <ContextMonitor onLost={setLost}/>
        <World game={game} round={round} progress={progress} playing={playing} thumbnail={thumbnail} visible={visible} targetChoice={targetChoice}/>
      </Canvas>}
    </ArtBoundary>
  </div>;
}

