import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import './MinecraftClassicLook.css';
import CoinDealer from './CoinDealer.jsx';
import {coinDealerPresentation} from './coin-dealer-presentation.js';
import {diceTossPresentation} from './dice-toss-presentation.js';
import { ROULETTE_NUMBERS, PLINKO_MULTIPLIERS } from './game-math.js';
import { FramePump, usePageVisible, useReducedMotion } from './SceneMotion.jsx';
import { MinecraftStudioMaterials, StudioBackdrop, StudioBlock as Block, StudioMaterial, StudioLights, PixelMask, MINECRAFT_STUDIO_PALETTE as C } from './MinecraftStudio.jsx';
import { CLASSIC_DIE_FACES, CLASSIC_DIE_PIPS, MINECRAFT_PLINKO_GEOMETRY, minecraftRoulettePose, minecraftTerminalState } from './minecraft-classic-motion.js';

const TAU = Math.PI * 2;
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const MINECRAFT_CLASSIC_CAMERAS = Object.freeze({
  coinflip: { at: [.45, 2.1, 8.5], target: [0, -.38, -.9], width: 4.5, height: 3.1 },
  dice: { at: [6.3, 4.8, 8], target: [0, -.08, 0], width: 4.4, height: 3.4 },
  roulette: { at: [1.6, 6.5, 8], target: [0, -.20, 0], width: 6.7, height: 5.2 },
  upgrader: { at: [1.3, 2.35, 10], target: [0, -.1, .1], width: 5.1, height: 4.3 },
  plinko: { at: [1.3, 1.75, 10], target: [0, .18, 0], width: 7.25, height: 6.1 },
});

function Disc({ radius, depth, at = [0, 0, 0], color, segments = 24, rotation = [Math.PI / 2, 0, 0], kind = 'steel', metalness = .15, roughness = .92 }) {
  return <mesh position={at} rotation={rotation} castShadow receiveShadow><cylinderGeometry args={[radius, radius, depth, segments]} />
    <StudioMaterial color={color} kind={kind} metalness={metalness} roughness={roughness} /></mesh>;
}

export function StudioPrint({ text, width = 1, height = .22, at = [0, 0, 0], rotation, color = C.ivory, background = null, align = 'center' }) {
  const texture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = Math.max(64, Math.round(384 * height / width));
    const result = new THREE.CanvasTexture(canvas); result.colorSpace = THREE.SRGBColorSpace;
    result.minFilter = result.magFilter = THREE.NearestFilter; result.generateMipmaps = false;
    return result;
  }, [width, height]);
  useEffect(() => {
    if (!texture) return;
    const canvas = texture.image, context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (background) { context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height); }
    context.font = `700 ${Math.round(canvas.height * .7)}px monospace`;
    context.fillStyle = color; context.textAlign = align; context.textBaseline = 'middle';
    context.fillText(String(text), align === 'left' ? 4 : canvas.width / 2, canvas.height / 2, canvas.width - 8);
    texture.needsUpdate = true;
  }, [texture, text, color, background, align]);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  return <mesh position={at} rotation={rotation}><planeGeometry args={[width, height]} />
    <meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} /></mesh>;
}

function roundedRectangle(width,height,radius) {
  const x=-width/2,y=-height/2,r=Math.min(radius,width/2,height/2),shape=new THREE.Shape();
  shape.moveTo(x+r,y);shape.lineTo(x+width-r,y);shape.quadraticCurveTo(x+width,y,x+width,y+r);
  shape.lineTo(x+width,y+height-r);shape.quadraticCurveTo(x+width,y+height,x+width-r,y+height);
  shape.lineTo(x+r,y+height);shape.quadraticCurveTo(x,y+height,x,y+height-r);
  shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);shape.closePath();return shape;
}

function RoundedSolid({size,at=[0,0,0],rotation,color,kind='none',radius=.05,roughness=.86,metalness=.05}) {
  const [width,height,depth]=size;
  const geometry=useMemo(()=>{
    const bevel=Math.min(.035,width/6,height/6,depth/6),d=depth-2*bevel;
    const shape=roundedRectangle(width-2*bevel,height-2*bevel,radius);
    const result=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,curveSegments:10,steps:1});
    result.translate(0,0,-d/2);return result;
  },[width,height,depth,radius]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} position={at} rotation={rotation} castShadow receiveShadow><StudioMaterial color={color} kind={kind} roughness={roughness} metalness={metalness}/></mesh>;
}

function Tray({width=3.45,depth=2.55,top=-.85}) {
  return <group name="felt-lined-dice-tray">
    <RoundedSolid size={[width,.31,depth]} at={[0,top-.19,0]} color="#10191e" radius={.12}/>
    <RoundedSolid size={[width-.18,.025,depth-.18]} at={[0,top-.016,0]} color="#153438" kind="felt" radius={.11}/>
    {[-1,1].map(side=><RoundedSolid key={side} size={[.11,.15,depth]} at={[side*(width/2-.06),top+.06,0]} color="#273337" radius={.035}/>)}
    <RoundedSolid size={[width,.15,.11]} at={[0,top+.06,-depth/2+.055]} color="#273337" radius={.035}/>
    <RoundedSolid size={[width,.075,.10]} at={[0,top+.02,depth/2-.05]} color="#273337" radius={.025}/>
  </group>;
}

// Exact composited 8 by 8 head-front pixels from the approved dealer skin.
// The hood is left as the coin metal; face cells are struck individually.
export const COIN_SKIN_FRONT_ROWS=Object.freeze(['ABCCCCBA','BBBIIBBB','CBDJKDBC','CIILLIIC','BIIEFIIB','JDFMMFDJ','IIJEFJII','DKMDDMKD']);
export const COIN_SKIN_FRONT_PALETTE=Object.freeze({A:[18,17,17],B:[22,21,21],C:[28,26,26],D:[0,0,0],E:[20,18,18],F:[12,12,12],I:[222,214,190],J:[204,194,170],K:[187,176,153],L:[236,230,209],M:[166,155,133]});
export function coinPixelSealCells(size=.80) {
  const unit=size/8,cells=[];
  COIN_SKIN_FRONT_ROWS.forEach((row,y)=>[...row].forEach((key,x)=>{
    const source=COIN_SKIN_FRONT_PALETTE[key],raised=source[0]>100;
    const recessed=!raised&&source[0]<=20&&y>=2&&!(y===7&&(x===0||x===7));
    if(!raised&&!recessed)return;
    const shade=.82+(source[0]-166)/70*.20;
    const color=raised?'#'+[124,147,139].map(value=>Math.max(0,Math.min(255,Math.round(value*shade))).toString(16).padStart(2,'0')).join(''):'#102027';
    cells.push(Object.freeze({column:x,row:y,x:(x-3.5)*unit,y:(3.5-y)*unit,width:unit*.94,depth:raised?(source[0]>=222?.022:.014):.008,
      raised,source:Object.freeze([...source]),color}));
  }));
  return Object.freeze(cells);
}
export function makeCoinSealFace() {
  const circle=new THREE.Shape();circle.absarc(0,0,.85,0,TAU,false);
  for(const cell of coinPixelSealCells())if(!cell.raised) {
    const r=cell.width/2,hole=new THREE.Path();hole.moveTo(cell.x-r,cell.y-r);hole.lineTo(cell.x-r,cell.y+r);hole.lineTo(cell.x+r,cell.y+r);hole.lineTo(cell.x+r,cell.y-r);hole.closePath();circle.holes.push(hole);
  }
  const geometry=new THREE.ShapeGeometry(circle,64);geometry.userData.recessCount=circle.holes.length;return geometry;
}
function CoinPixelSeal() {
  const cells=useMemo(()=>coinPixelSealCells(),[]),geometry=useMemo(makeCoinSealFace,[]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <group name="small-minted-skin-pixel-seal">
    <mesh geometry={geometry} position={[0,0,.1985]} receiveShadow><meshStandardMaterial color="#15262c" metalness={.20} roughness={.72}/></mesh>
    {cells.map(cell=><mesh key={cell.column+'-'+cell.row} position={[cell.x,cell.y,cell.raised?.1985+cell.depth/2:.1865]} castShadow={cell.raised} receiveShadow>
      <boxGeometry args={[cell.width,cell.width,cell.depth]}/><meshStandardMaterial color={cell.color} metalness={cell.raised?.38:.12} roughness={.64}/>
    </mesh>)}
  </group>;
}

function Coin({ round, progress, playing, reduced }) {
  const pose = coinDealerPresentation(round, progress, playing, reduced);
  return <>
    <CoinDealer presentation={pose}/>
    <group position={pose.coin.position} quaternion={pose.coin.quaternion} scale={pose.coin.scale} name="physical-coin">
      <Disc radius={1.03} depth={.30} color="#525d5c" segments={48} kind="none" metalness={.40} roughness={.50}/>
      <Disc radius={1.0} depth={.35} color="#919986" segments={48} kind="none" metalness={.35} roughness={.55}/>
      <Disc radius={.94} depth={.38} color="#27383a" segments={48} kind="none" metalness={.28} roughness={.65}/>
      <mesh rotation={[Math.PI/2,0,0]} castShadow receiveShadow><cylinderGeometry args={[.85,.85,.397,64,1,true]}/><meshStandardMaterial color="#15262c" metalness={.20} roughness={.72}/></mesh>
      <mesh position={[0,0,-.1985]} rotation={[0,Math.PI,0]} receiveShadow><circleGeometry args={[.85,64]}/><meshStandardMaterial color="#15262c" metalness={.20} roughness={.72}/></mesh>
      <CoinPixelSeal/>
      <mesh position={[0,0,.202]}><torusGeometry args={[.80,.011,6,64]}/><meshStandardMaterial color="#516663" roughness={.6} metalness={.28}/></mesh>
      {Array.from({length:64},(_,index)=>{const angle=index*TAU/64;return <Block key={'milled-edge-'+index} size={[.013,.004,.27]} at={[Math.sin(angle)*1.030,Math.cos(angle)*1.030,0]} rotation={[0,0,-angle]} color="#26363c" kind="none" roughness={.72}/>;})}
      <group rotation={[0, Math.PI, 0]}>
        <RoundedSolid size={[.16,1.0,.043]} at={[.055,0,.219]} color="#d9ddcf" radius={.02}/>
        <RoundedSolid size={[.47,.13,.043]} at={[-.09,.44,.219]} color="#d9ddcf" radius={.02}/>
        <RoundedSolid size={[.62,.13,.043]} at={[0,-.49,.219]} color="#d9ddcf" radius={.02}/>
      </group>
    </group>
  </>;
}

export function makeClassicDieShell() {
  const source=new RoundedBoxGeometry(1.1,1.1,1.1,5,.055);
  const attributes=Object.fromEntries(['position','normal','uv'].map(key=>[key,source.getAttribute(key)]));
  const values={position:[],normal:[],uv:[]};
  for(let index=0;index<attributes.position.count;index+=3) {
    // Retain the rounded edges, but replace each flat central face with one
    // continuous surface containing genuine circular holes.
    const flat=[0,1,2].some(axis=>[-.55,.55].some(plane=>[0,1,2].every(offset=>Math.abs(attributes.position.array[(index+offset)*3+axis]-plane)<1e-6)));
    if(flat)continue;
    for(const [key,attribute] of Object.entries(attributes))for(let offset=0;offset<3;offset++)for(let part=0;part<attribute.itemSize;part++)values[key].push(attribute.array[(index+offset)*attribute.itemSize+part]);
  }
  const result=new THREE.BufferGeometry();for(const [key,attribute] of Object.entries(attributes))result.setAttribute(key,new THREE.Float32BufferAttribute(values[key],attribute.itemSize));
  result.computeBoundingBox();source.dispose();return result;
}

export function makeClassicDieFace(value) {
  const shape=roundedRectangle(.99,.99,0);
  for(const [x,y] of CLASSIC_DIE_PIPS[value]) {const hole=new THREE.Path();hole.absarc(x,y,.076,0,TAU,true);shape.holes.push(hole);}
  return new THREE.ShapeGeometry(shape,16);
}

function EngravedDieFace({face}) {
  const geometry=useMemo(()=>makeClassicDieFace(face.value),[face.value]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <group position={face.at} rotation={face.rotation} name="engraved-round-pip-face">
    <mesh geometry={geometry} receiveShadow><meshStandardMaterial color="#dee0d4" roughness={.60}/></mesh>
    {CLASSIC_DIE_PIPS[face.value].map(([x,y],index)=><mesh key={index} position={[x,y,-.001]} rotation={[Math.PI/2,0,0]} receiveShadow>
      <sphereGeometry args={[.076,20,10,0,TAU,Math.PI/2,Math.PI/2]}/><meshStandardMaterial color="#0c141b" roughness={.80} side={THREE.DoubleSide}/>
    </mesh>)}
  </group>;
}

export function classicDieRestQuaternion(round,progress) {
  const up=new THREE.Vector3(0,1,0),yaw=new THREE.Quaternion().setFromAxisAngle(up,.4),common=yaw.clone();
  const p=Number.isFinite(progress)?Math.max(0,Math.min(1,progress)):0;
  if(p<.9)return common;
  const value=Math.max(1,Math.min(6,Math.trunc(Number(round?.value)||1)));
  const face=CLASSIC_DIE_FACES.find(item=>item.value===value);
  const accepted=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...face.normal),up).premultiply(yaw);
  const phase=Math.max(0,Math.min(1,(p-.9)/.1)),blend=phase*phase*(3-2*phase);
  return common.slerp(accepted,blend);
}

let dieSurfaceVertices=null;
export function classicDieSurfaceVertices() {
  if(dieSurfaceVertices)return dieSurfaceVertices;
  const points=new Map(),vertex=new THREE.Vector3(),add=geometry=>{
    const position=geometry.getAttribute('position');
    for(let index=0;index<position.count;index++) {
      vertex.fromBufferAttribute(position,index);
      points.set(vertex.toArray().map(value=>value.toFixed(7)).join(','),Object.freeze(vertex.toArray()));
    }
  };
  const shell=makeClassicDieShell();add(shell);shell.dispose();
  for(const face of CLASSIC_DIE_FACES) {
    const geometry=makeClassicDieFace(face.value);
    geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...face.rotation)));
    geometry.translate(...face.at);add(geometry);geometry.dispose();
  }
  dieSurfaceVertices=Object.freeze([...points.values()]);return dieSurfaceVertices;
}
export function classicDieSupportHeight(quaternion) {
  const matrix=new THREE.Matrix4().makeRotationFromQuaternion(quaternion).elements;
  let minimum=Infinity;
  for(const [x,y,z] of classicDieSurfaceVertices())minimum=Math.min(minimum,matrix[1]*x+matrix[5]*y+matrix[9]*z);
  return -minimum;
}

function Die({ round, progress, playing, reduced }) {
  const body = useRef();
  const pose=diceTossPresentation(round,progress,playing,reduced);
  const geometry=useMemo(makeClassicDieShell,[]);
  const shadowGeometry=useMemo(()=>new RoundedBoxGeometry(1.1,1.1,1.1,5,.055),[]);
  useEffect(()=>()=>{geometry.dispose();shadowGeometry.dispose();},[geometry,shadowGeometry]);
  useFrame(() => {
    if (!body.current) return;
    body.current.quaternion.fromArray(pose.quaternion);
    const contact=classicDieSupportHeight(body.current.quaternion);
    body.current.position.set(pose.x,-.8535+contact+pose.lift,pose.z);
  });
  return <><Tray />
    <group ref={body} position={[0,-.3025,0]} name="six-physical-pip-faces">
    <mesh geometry={geometry} receiveShadow name="bevelled-solid-die"><meshStandardMaterial color="#dee0d4" roughness={.60}/></mesh>
    <mesh geometry={shadowGeometry} name="closed-die-shadow-proxy" castShadow><meshBasicMaterial colorWrite={false} depthWrite={false}/></mesh>
    {CLASSIC_DIE_FACES.map(face=><EngravedDieFace key={face.value} face={face}/>)}
  </group></>;
}

function Roulette({ round, progress, playing, reduced }) {
  const wheel = useRef(), ball = useRef();
  const pose = minecraftRoulettePose(round, progress, playing, reduced);
  useFrame(() => {
    if (wheel.current) wheel.current.rotation.y = -pose.wheelDegrees * Math.PI / 180;
    if (ball.current) ball.current.position.set(Math.sin(pose.angle) * pose.radius, .080 + Math.sin(Math.PI * Math.min(1, Math.max(0, (pose.progress - .6) / .4))) * .10, -Math.cos(pose.angle) * pose.radius);
  });
  return <group position={[0, -.15, 0]} name="37-pocket-physical-wheel">
    <Disc radius={2.55} depth={.36} at={[0, -.37, 0]} rotation={[0, 0, 0]} color={C.black} segments={37} kind="stone" />
    <Disc radius={2.56} depth={.10} at={[0, -.14, 0]} rotation={[0, 0, 0]} color={C.steel} segments={37} />
    <Disc radius={2.42} depth={.10} at={[0, -.09, 0]} rotation={[0, 0, 0]} color={C.felt} segments={37} kind="felt" />
    <group ref={wheel}>
      {ROULETTE_NUMBERS.map((number, index) => {
        const angle = index * TAU / 37;
        return <group key={number} rotation={[0, -angle, 0]}>
          <Block size={[.30, .07, .64]} at={[0, -.045, -1.98]} color={number === 0 ? '#38785a' : RED.has(number) ? C.red : C.black} kind="felt" />
          <Block size={[.015, .12, .63]} at={[.157, -.015, -1.98]} color={C.steel} kind="steel" />
          <StudioPrint text={number} width={.27} height={.15} at={[0, -.004, -2.14]} rotation={[-Math.PI / 2, 0, Math.PI]} />
        </group>;
      })}
      <Disc radius={1.59} depth={.15} at={[0, .015, 0]} rotation={[0, 0, 0]} color={C.stoneLight} segments={16} kind="stone" />
      <Disc radius={1.40} depth={.15} at={[0, .13, 0]} rotation={[0, 0, 0]} color={C.feltLight} segments={16} kind="felt" />
      <Block size={[.52, .26, .52]} at={[0, .33, 0]} color={C.brass} kind="steel" />
      <Block size={[.10, .48, .10]} at={[0, .65, 0]} color={C.steel} kind="steel" />
      <Block size={[1.15, .075, .075]} at={[0, .74, 0]} color={C.ivory} kind="ivory" />
      <Block size={[.075, .075, 1.15]} at={[0, .74, 0]} color={C.ivory} kind="ivory" />
    </group>
    <mesh ref={ball} position={[0, .080, -2.35]} castShadow><icosahedronGeometry args={[.083, 0]} /><StudioMaterial color={C.ivory} kind="ivory" /></mesh>
    <Block size={[1.45, .25, .08]} at={[0, -.39, 2.53]} color={C.stoneLight} />
    <StudioPrint text="MASQ / 37" width={1.23} height={.14} at={[0, -.37, 2.579]} color={C.mint} />
  </group>;
}

function TerminalScreen({ state }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 320;
    const result = new THREE.CanvasTexture(canvas); result.colorSpace = THREE.SRGBColorSpace;
    result.minFilter = result.magFilter = THREE.NearestFilter; result.generateMipmaps = false;
    return result;
  }, []);
  useEffect(() => {
    const context = texture.image.getContext('2d');
    const ink = state.outcome === 'denied' ? '#d79397' : state.outcome === 'success' ? '#e4ebdc' : '#9dd9b9';
    context.fillStyle = C.screen; context.fillRect(0, 0, 512, 320);
    context.fillStyle = '#153d2a';
    for (let y = 0; y < 320; y += 6) context.fillRect(0, y, 512, 1);
    context.strokeStyle = '#346649'; context.strokeRect(19, 20, 474, 281);
    context.fillStyle = ink; context.font = 'bold 20px monospace'; context.textAlign = 'left'; context.fillText('MASQ // TERMINAL', 36, 53);
    context.textAlign = 'right'; context.fillText(state.phase === 'idle' ? 'READY' : state.phase.toUpperCase(), 476, 53);
    context.textAlign = 'center'; context.font = 'bold 103px monospace'; context.fillText('×' + String(state.multiplier).replace('.', ','), 256, 163);
    context.font = 'bold 23px monospace'; context.fillText(state.code, 256, 214);
    for (let index = 0; index < 12; index++) {
      context.fillStyle = index < state.packets ? ink : '#173b28'; context.fillRect(38 + index * 37, 259, 29, 14);
    }
    if (!state.reveal && state.phase !== 'idle') {
      const y = 74 + state.scanY / 1400 * 176; context.fillStyle = '#72c59948'; context.fillRect(23, y, 466, 3);
    }
    texture.needsUpdate = true;
  }, [texture, state]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={[0, .30, .23]}><planeGeometry args={[2.78, 1.75]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh>;
}

function Terminal({ round, progress, playing, targetChoice, reduced }) {
  const state = minecraftTerminalState(round, progress, playing, targetChoice, reduced);
  return <group name="minecraft-terminal" position={[0, -.1, 0]}>
    <Block size={[3.15, 2.2, .6]} at={[0, .35, -.15]} color={C.black} />
    <Block size={[3.00, 2.07, .56]} at={[0, .35, -.09]} color={C.stoneLight} />
    <Block size={[2.88, 1.88, .03]} at={[0, .31, .211]} color={C.black} kind="none" />
    <TerminalScreen state={state} />
    <Block size={[.29, .05, .028]} at={[1.21, -.62, .224]} color={state.outcome === 'denied' ? '#b16872' : C.mint} kind="none" emissive={state.outcome === 'denied' ? '#70353f' : '#44916a'} intensity={.26} />
    <PixelMask size={.22} at={[-1.22, -.62, .235]} depth={.018} />
    <Block size={[.67, .42, .5]} at={[0, -.85, -.17]} color={C.steel} kind="steel" />
    <Block size={[1.74, .13, .83]} at={[0, -1.10, .04]} color={C.black} />
    <group position={[0, -1.11, 1.06]} rotation={[.12, 0, 0]}>
      <Block size={[3.14, .15, 1.02]} color={C.stoneLight} />
      {Array.from({ length: 4 }, (_, row) => Array.from({ length: 13 }, (_, column) => <Block key={row + '-' + column}
        size={[.17, .058, .16]} at={[(column - 6) * .225, .10, (row - 1.5) * .218]} color={row === 3 && column > 3 && column < 9 ? '#748b79' : C.steel} kind="steel" />))}
    </group>
    <Block size={[.72, .90, .85]} at={[2.11, -.7, .16]} color={C.black} />
    <Block size={[.58, .08, .035]} at={[2.11, -.40, .60]} color={C.steel} kind="steel" />
    {[0, 1, 2].map(index => <Block key={index} size={[.44, .038, .035]} at={[2.11, -.60 - index * .09, .601]} color={C.stoneLight} />)}
    <Block size={[.07, .07, .035]} at={[2.30, -.94, .61]} color={C.mint} kind="none" emissive="#459e6b" intensity={.42} />
  </group>;
}

// These wide bearings are mounted behind the flight plane. The protruding peg
// and ball bodies retain the exact original contact dimensions.
export const PLINKO_VISUAL_BEARING = Object.freeze({ radius: .095, depth: .03, z: .035 });
export const PLINKO_CATCH_LABEL=Object.freeze({y:-2.045,z:.535,width:.43,height:.21});
export function plinkoBackplateTiles() {
  return Array.from({length:80},(_,index)=>{const row=Math.floor(index/10),column=index%10;
    return {size:[.532,.470,.026],at:[(column-4.5)*.54,1.83-row*.48,-.018],color:(column+row)%2?'#30434b':'#20323b'};
  });
}
export function makePlinkoCaseGeometry() {
  const profile=new THREE.Shape(),points=[[-3.12,-2.38],[-3.12,1.97],[-2.83,2.25],[-1.49,2.25],[-1.19,2.78],[1.19,2.78],[1.49,2.25],[2.83,2.25],[3.12,1.97],[3.12,-2.38]];
  points.forEach(([x,y],index)=>index?profile.lineTo(x,y):profile.moveTo(x,y));profile.closePath();
  const geometry=new THREE.ExtrudeGeometry(profile,{depth:.68,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:2,steps:1});geometry.translate(0,0,-.34);return geometry;
}
function PlinkoCaseShell() {
  const geometry=useMemo(makePlinkoCaseGeometry,[]);useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} position={[0,0,-.45]} name="stepped-mechanical-cabinet-case" castShadow receiveShadow><meshStandardMaterial color="#25343d" roughness={.85} metalness={.13}/></mesh>;
}
function CheckerMetalBackplate() {
  const tiles=useMemo(plinkoBackplateTiles,[]),scratch=useMemo(()=>({matrix:new THREE.Matrix4(),quaternion:new THREE.Quaternion(),position:new THREE.Vector3(),scale:new THREE.Vector3(),color:new THREE.Color()}),[]);
  return <instancedMesh name="segmented-checker-metal-backplate" args={[null,null,80]} receiveShadow ref={mesh=>{
    if(!mesh)return;
    tiles.forEach((tile,index)=>{scratch.position.set(...tile.at);scratch.scale.set(...tile.size);scratch.matrix.compose(scratch.position,scratch.quaternion,scratch.scale);mesh.setMatrixAt(index,scratch.matrix);mesh.setColorAt(index,scratch.color.set(tile.color));});
    mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();
  }}><boxGeometry args={[1,1,1]}/><meshStandardMaterial color="#ffffff" roughness={.94} metalness={.10}/></instancedMesh>;
}

export function MinecraftPlinkoCabinet({children,binMaterials,pegMaterials,entranceMaterial,shutter,showLabels=true}) {
  return <group name="minecraft-plinko-cabinet">
    <PlinkoCaseShell/>
    <Block size={[5.54,4.02,.060]} at={[0,.15,-.076]} color="#13242c" kind="none"/>
    <CheckerMetalBackplate/>
    {[-1,1].map(side=><group key={side}>
      <RoundedSolid size={[.32,4.50,.58]} at={[side*2.96,-.06,-.205]} color="#34454e" radius={.04} metalness={.18}/>
      <Block size={[.095,4.02,.090]} at={[side*2.75,.16,.032]} color="#6b7d80" kind="none" metalness={.20}/>
      <RoundedSolid size={[.30,.58,.22]} at={[side*2.98,2.05,-.115]} rotation={[0,0,side*-.20]} color="#475860" radius={.028}/>
      <RoundedSolid size={[.84,.28,.85]} at={[side*2.28,-2.54,-.235]} color="#25343e" radius={.05}/>
      <RoundedSolid size={[.19,.51,.035]} at={[side*2.96,-1.47,.085]} color="#53636a" radius={.02}/>
      {[-1,0,1].map(vent=><Block key={vent} size={[.115,.018,.012]} at={[side*2.96,-1.47+vent*.092,.109]} color="#1a282e" kind="none"/>)}
      {[-1,1].map(end=><mesh key={end} position={[side*2.96,end*1.84,.097]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.043,.043,.020,6]}/><meshStandardMaterial color="#98a39c" roughness={.65} metalness={.30}/></mesh>)}
    </group>)}
    <RoundedSolid size={[5.65,.20,.42]} at={[0,-2.29,-.01]} color="#3c4c56" radius={.035}/>
    <RoundedSolid size={[2.36,.60,.66]} at={[0,2.40,-.30]} color="#334651" radius={.04}/>
    <RoundedSolid size={[1.73,.23,.22]} at={[0,2.77,-.23]} color="#52636d" radius={.025}/>
    <Block size={[.63,.53,.065]} at={[0,2.16,.020]} color="#12232b" kind="none"/>
    {[-1,1].map(side=><Block key={'ball-inlet-'+side} name="ball-inlet-rail" size={[.085,.48,.065]} at={[side*.20,2.12,.068]} color="#9bacaa" kind="none" metalness={.17}/>)}
    <Block size={[.485,.065,.055]} at={[0,2.388,.068]} color="#778b8e" kind="none"/>
    <mesh ref={mesh=>{if(shutter)shutter.current=mesh;}} name="public-flight-sliding-shutter" position={[0,2.13,.076]} castShadow receiveShadow>
      <boxGeometry args={[.27,.355,.015]}/><meshStandardMaterial color="#61757a" roughness={.82} metalness={.25}/>
    </mesh>
    <Block size={[.11,.34,.02]} at={[.365,2.145,.083]} color="#1c3039" kind="none"/>
    <RoundedSolid size={[.89,.205,.040]} at={[.765,2.427,.045]} color="#633c49" radius={.025}/>
    <StudioPrint text="PLINKO" width={.745} height={.135} at={[.765,2.43,.069]} color="#d5ddd5"/>
    <mesh name="ball-inlet-indicator" position={[-.395,2.20,.075]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.035,.035,.014,16]}/>
      <meshStandardMaterial ref={material=>{if(entranceMaterial)entranceMaterial.current=material;}} color="#a8bcb2" emissive="#81b794" emissiveIntensity={.12} roughness={.65}/>
    </mesh>
    {Array.from({length:8},(_,row)=>Array.from({length:row+1},(_,column)=><group key={row+'-'+column} position={[(column-row/2)*.56,1.75-row*.45,.1]}>
      <mesh name="recessed-peg-socket" position={[0,0,-.088]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.104,.104,.010,16]}/><meshStandardMaterial color="#0d1d25" roughness={.90}/></mesh>
      <mesh name="recessed-peg-bearing" position={[0,0,PLINKO_VISUAL_BEARING.z-.1]} rotation={[Math.PI/2,0,0]} receiveShadow>
        <cylinderGeometry args={[PLINKO_VISUAL_BEARING.radius,PLINKO_VISUAL_BEARING.radius,PLINKO_VISUAL_BEARING.depth,6]}/>
        <meshStandardMaterial ref={material=>{if(pegMaterials)pegMaterials.current[row*(row+1)/2+column]=material;}} color="#697e83" metalness={.20} roughness={.70} emissive="#91c3ac" emissiveIntensity={0}/>
      </mesh>
      <Block size={MINECRAFT_PLINKO_GEOMETRY.peg} color="#778b8e" kind="none"/>
      <mesh position={[0,0,.106]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.0225,.0225,MINECRAFT_PLINKO_GEOMETRY.pegFace[2],16]}/><meshStandardMaterial color="#e5eee2" emissive="#9abca4" emissiveIntensity={.18} roughness={.6}/></mesh>
    </group>))}
    {PLINKO_MULTIPLIERS.map((rate,index)=><group key={index} name="deep-mechanical-catch-tray" position={[(index-4)*.56,-1.96,0]}>
      <mesh position={[0,-.075,.15]} rotation={[-.12,0,0]} castShadow receiveShadow><boxGeometry args={[.50,.055,.69]}/>
        <meshStandardMaterial ref={material=>{if(binMaterials)binMaterials.current[index]=material;}} color="#253a44" roughness={.88} metalness={.1}/>
      </mesh>
      <Block size={[.50,.39,.045]} at={[0,.10,-.185]} color="#344953" kind="none"/>
      <RoundedSolid size={[.052,.43,.70]} at={[-.265,.14,.15]} color="#687e83" radius={.016} metalness={.18}/>
      <RoundedSolid size={[.492,.20,.048]} at={[0,-.075,.490]} color="#3d525b" radius={.015}/>
      <RoundedSolid size={[.475,.245,.040]} at={[0,PLINKO_CATCH_LABEL.y+1.96,.495]} color={index===0||index===8?'#603f4c':'#2d454e'} radius={.025}/>
      {showLabels&&<StudioPrint text={String(rate)} width={.38} height={.135} at={[0,PLINKO_CATCH_LABEL.y+1.96,PLINKO_CATCH_LABEL.z]} color="#d9e1d8"/>}
      <Block size={[.425,.017,.020]} at={[0,-.222,.519]} color={index===0||index===8?'#9a9180':'#8ba9a0'} kind="none"/>
    </group>)}
    <RoundedSolid size={[.052,.43,.70]} at={[2.505,-1.82,.15]} color="#687e83" radius={.016} metalness={.18}/>
    {children}
  </group>;
}

function FitCamera({ game }) {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    const fit = MINECRAFT_CLASSIC_CAMERAS[game] || MINECRAFT_CLASSIC_CAMERAS.coinflip;
    camera.position.set(...fit.at); camera.lookAt(...fit.target);
    camera.zoom = Math.max(1, Math.min(size.width / fit.width, size.height / fit.height) * .94);
    camera.updateProjectionMatrix(); invalidate();
  }, [game, camera, size.width, size.height, invalidate]);
  return null;
}

export function MinecraftClassicWorld({ game, round, progress = 0, playing = false, targetChoice = 2, thumbnail = false, visible = true, reduced = false }) {
  const systemReduced = useReducedMotion(reduced), pageVisible = usePageVisible();
  const props = { round, progress, playing, targetChoice, reduced: systemReduced };
  return <MinecraftStudioMaterials>
    <FitCamera game={game} /><FramePump active={visible && pageVisible && !systemReduced && playing} fps={60} />
    <StudioLights floor={game==='plinko'?-2.68:-1.78}/><StudioBackdrop table={game!=='plinko'} floor={game==='plinko'?-2.68:-1.78}/>
    {game === 'coinflip' || game === 'coin' ? <Coin {...props} /> : game === 'dice' ? <Die {...props} />
      : game === 'roulette' ? <Roulette {...props} /> : game === 'upgrader' ? <Terminal {...props} />
        : game === 'plinko' ? <MinecraftPlinkoCabinet><Block size={MINECRAFT_PLINKO_GEOMETRY.ball} at={[0, 2.04, .25]} color="#e1e8dc" kind="ivory" emissive="#a4bea7" intensity={.14} /></MinecraftPlinkoCabinet> : null}
  </MinecraftStudioMaterials>;
}

class ClassicArtBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="art-fallback">Не удалось отобразить стол. Включи аппаратное ускорение.</div> : this.props.children; }
}

function ContextMonitor({ onLost }) {
  const gl = useThree(state => state.gl);
  useEffect(() => {
    const lost = event => { event.preventDefault(); onLost(true); };
    gl.domElement.addEventListener('webglcontextlost', lost);
    return () => gl.domElement.removeEventListener('webglcontextlost', lost);
  }, [gl, onLost]);
  return null;
}

export default function MinecraftClassicArt(props) {
  const [lost, setLost] = useState(false);
  return <div className="game-art minecraft-classic-art" data-minecraft-game={props.game} aria-hidden="true" style={{ width: '100%', height: '100%', minHeight: 140 }}>
    <ClassicArtBoundary>{lost ? <div className="art-fallback">3D-контекст прерван. Обнови страницу.</div> :
      <Canvas orthographic frameloop="demand" shadows="percentage" dpr={[1, props.thumbnail ? 1.25 : 1.65]}
        camera={{ position: [2, 4, 10], zoom: 70, near: .1, far: 60 }} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        fallback={<div className="art-fallback">Браузер не поддерживает 3D.</div>} onCreated={({ gl }) => gl.setClearColor(C.black, 1)}>
        <ContextMonitor onLost={setLost} /><MinecraftClassicWorld {...props} />
      </Canvas>}
    </ClassicArtBoundary>
  </div>;
}
