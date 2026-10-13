import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ROULETTE_NUMBERS, PLINKO_MULTIPLIERS } from './game-math.js';
import { FramePump, usePageVisible, useReducedMotion } from './SceneMotion.jsx';
import { MinecraftStudioMaterials, StudioBackdrop, StudioBlock as Block, StudioMaterial, StudioLights, PixelMask, MINECRAFT_STUDIO_PALETTE as C } from './MinecraftStudio.jsx';
import { CLASSIC_DIE_FACES, CLASSIC_DIE_PIPS, MINECRAFT_PLINKO_GEOMETRY, classicProgress, minecraftCoinPose, minecraftRoulettePose, minecraftTerminalState } from './minecraft-classic-motion.js';

const TAU = Math.PI * 2;
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const MINECRAFT_CLASSIC_CAMERAS = Object.freeze({
  coinflip: { at: [2.6, 2.7, 10], target: [0, .25, 0], width: 4.9, height: 4.6 },
  dice: { at: [3.8, 5.8, 9], target: [0, -.05, 0], width: 4.9, height: 4.2 },
  roulette: { at: [1.6, 6.5, 8], target: [0, -.20, 0], width: 6.7, height: 5.2 },
  upgrader: { at: [1.3, 2.35, 10], target: [0, -.1, .1], width: 5.1, height: 4.3 },
  plinko: { at: [.7, 1.2, 10], target: [0, .18, 0], width: 7.25, height: 6.1 },
});

function Disc({ radius, depth, at = [0, 0, 0], color, segments = 24, rotation = [Math.PI / 2, 0, 0], kind = 'steel' }) {
  return <mesh position={at} rotation={rotation} castShadow receiveShadow><cylinderGeometry args={[radius, radius, depth, segments]} />
    <StudioMaterial color={color} kind={kind} metalness={.15} /></mesh>;
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

function Tray({ width = 3.45, depth = 2.55, top = -.85 }) {
  return <group>
    <Block size={[width, .23, depth]} at={[0, top - .15, 0]} color={C.black} />
    <Block size={[width - .18, .025, depth - .18]} at={[0, top -.016, 0]} color={C.felt} kind="felt" />
    {[-1, 1].map(side => <Block key={side} size={[.11, .15, depth]} at={[side * (width / 2 - .06), top + .06, 0]} color={C.steel} kind="steel" />)}
    <Block size={[width, .15, .11]} at={[0, top + .06, -depth / 2 + .055]} color={C.steel} kind="steel" />
    <Block size={[width, .075, .1]} at={[0, top + .02, depth / 2 - .05]} color={C.stoneLight} />
    <Block size={[.45, .012, .1]} at={[0, top + .071, depth / 2 - .05]} color={C.brass} kind="steel" />
  </group>;
}

function Coin({ round, progress, playing, reduced }) {
  const ref = useRef();
  const pose = minecraftCoinPose(round, progress, playing, reduced);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.rotation.set(0, round || playing ? pose.radians : -.15, pose.tilt * Math.PI / 180);
    ref.current.position.y = .38 - pose.flight / 25;
  });
  return <>
    <Tray width={3.45} depth={2.2} />
    <Block size={[1.5, .14, .55]} at={[0, -.70, 0]} color={C.stoneLight} />
    {[-1, 1].map(side => <Block key={side} size={[.16, .52, .4]} at={[side * .64, -.48, 0]} color={C.steel} kind="steel" />)}
    <group ref={ref} position={[0, .38, 0]} name="physical-coin">
      <Disc radius={1.03} depth={.24} color={C.brass} segments={16} />
      <Disc radius={.94} depth={.252} color={C.stoneLight} segments={16} />
      <Disc radius={.85} depth={.27} color={C.felt} segments={16} kind="felt" />
      {Array.from({ length: 16 }, (_, index) => { const angle = index * TAU / 16; return <Block key={index} size={[.065, .085, .26]} at={[Math.sin(angle) * 1.005, Math.cos(angle) * 1.005, 0]} rotation={[0, 0, -angle]} color={C.steel} kind="steel" />; })}
      <PixelMask size={1.28} at={[0, 0, .164]} depth={.044} />
      <group rotation={[0, Math.PI, 0]}>
        <Block size={[.16, 1.0, .043]} at={[.055, 0, .164]} color={C.ivory} kind="ivory" />
        <Block size={[.47, .13, .043]} at={[-.09, .44, .164]} color={C.ivory} kind="ivory" />
        <Block size={[.62, .13, .043]} at={[0, -.49, .164]} color={C.ivory} kind="ivory" />
      </group>
    </group>
  </>;
}

function Die({ round, progress, playing, reduced }) {
  const body = useRef();
  const p = classicProgress(round, progress, playing, reduced);
  const result = Math.max(1, Math.min(6, Math.trunc(Number(round?.value) || 1)));
  const rest = useMemo(() => {
    const face = CLASSIC_DIE_FACES.find(item => item.value === result);
    const base = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...face.normal), new THREE.Vector3(0, 1, 0));
    return base.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), .4));
  }, [result]);
  const scratch = useMemo(() => ({ spin: new THREE.Quaternion(), euler: new THREE.Euler(), matrix: new THREE.Matrix4() }), []);
  useFrame(() => {
    if (!body.current) return;
    const spin = playing ? (1 - p) ** 3 : 0;
    scratch.euler.set(spin * TAU * 3, spin * TAU * 2, spin * TAU);
    scratch.spin.setFromEuler(scratch.euler);
    body.current.quaternion.copy(rest).multiply(scratch.spin);
    scratch.matrix.makeRotationFromQuaternion(body.current.quaternion);
    const elements = scratch.matrix.elements;
    const contact = .57 * (Math.abs(elements[1]) + Math.abs(elements[5]) + Math.abs(elements[9]));
    const lift = playing ? Math.abs(Math.sin(p * Math.PI * 3)) * (1 - p) * .85 : 0;
    body.current.position.set(playing ? -.58 * (1 - p) + Math.sin(p * TAU) * .2 * (1 - p) : 0, -.836 + contact + lift, -.12 * (1 - p));
  });
  return <><Tray /><group ref={body} position={[0, -.266, 0]} name="six-physical-pip-faces">
    <Block size={[1.1, 1.1, 1.1]} color={C.ivory} kind="ivory" />
    {CLASSIC_DIE_FACES.map(face => <group key={face.value} position={face.at} rotation={face.rotation}>
      <Block size={[.88, .88, .011]} color="#dce3d4" kind="ivory" />
      {CLASSIC_DIE_PIPS[face.value].map(([x, y], index) => <Block key={index} size={[.14, .14, .035]} at={[x, y, .023]} color={C.black} kind="none" />)}
    </group>)}
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

export function MinecraftPlinkoCabinet({ children, binMaterials, showLabels = true }) {
  return <group name="minecraft-plinko-cabinet">
    <Block size={[6.10, 5.02, .58]} at={[0, .12, -.40]} color={C.black} />
    <Block size={[5.90, 4.82, .35]} at={[0, .12, -.24]} color={C.steel} kind="steel" />
    <Block size={[5.58, 4.46, .09]} at={[0, .11, -.04]} color={C.felt} kind="felt" />
    {[-1, 1].map(side => <group key={side}>
      <Block size={[.12, 4.49, .17]} at={[side * 2.79, .11, .04]} color={C.stoneLight} />
      <Block size={[.034, 3.83, .023]} at={[side * 2.895, .12, .09]} color={C.rim} kind="none" emissive="#4ebc80" intensity={.4} />
    </group>)}
    <Block size={[5.65, .13, .17]} at={[0, 2.33, .02]} color={C.stoneLight} />
    <Block size={[1.0, .31, .29]} at={[0, 2.32, .15]} color={C.black} />
    <StudioPrint text="PLINKO" width={.87} height={.18} at={[0, 2.33, .30]} color={C.mint} />
    {Array.from({ length: 8 }, (_, row) => Array.from({ length: row + 1 }, (_, column) => <group key={row + '-' + column} position={[(column - row / 2) * .56, 1.75 - row * .45, .1]}>
      <Block size={MINECRAFT_PLINKO_GEOMETRY.peg} color={C.steel} kind="steel" />
      <Block size={MINECRAFT_PLINKO_GEOMETRY.pegFace} at={[0, 0, .106]} color={C.ivory} kind="ivory" />
    </group>))}
    {PLINKO_MULTIPLIERS.map((rate, index) => <group key={index} position={[(index - 4) * .56, -1.96, 0]}>
      <mesh position={[0, -.015, .1]} castShadow receiveShadow><boxGeometry args={[.52, .14, .45]} />
        <meshStandardMaterial ref={material => { if (binMaterials) binMaterials.current[index] = material; }} color={C.black} roughness={.9} flatShading /></mesh>
      <Block size={[.04, .43, .43]} at={[-.265, .14, .10]} color={C.steel} kind="steel" />
      <Block size={[.48, .26, .04]} at={[0, -.07, .349]} color={index === 0 || index === 8 ? '#365c47' : C.stoneLight} />
      {showLabels && <StudioPrint text={String(rate)} width={.42} height={.13} at={[0, -.07, .373]} color={C.ivory} />}
      <Block size={[.43, .024, .018]} at={[0, -.216, .375]} color={index === 0 || index === 8 ? C.brass : C.rim} kind="none" />
    </group>)}
    <Block size={[.04, .43, .43]} at={[2.51, -1.82, .10]} color={C.steel} kind="steel" />
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
    <StudioLights /><StudioBackdrop table={game !== 'plinko'} floor={game === 'plinko' ? -2.68 : -1.78} />
    {game === 'coinflip' || game === 'coin' ? <Coin {...props} /> : game === 'dice' ? <Die {...props} />
      : game === 'roulette' ? <Roulette {...props} /> : game === 'upgrader' ? <Terminal {...props} />
        : game === 'plinko' ? <MinecraftPlinkoCabinet><Block size={[.18, .18, .18]} at={[0, 2.04, .25]} color={C.ivory} kind="ivory" /></MinecraftPlinkoCabinet> : null}
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
        camera={{ position: [2, 4, 10], zoom: 70, near: .1, far: 60 }} gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
        fallback={<div className="art-fallback">Браузер не поддерживает 3D.</div>} onCreated={({ gl }) => gl.setClearColor(C.black, 1)}>
        <ContextMonitor onLost={setLost} /><MinecraftClassicWorld {...props} />
      </Canvas>}
    </ClassicArtBoundary>
  </div>;
}
