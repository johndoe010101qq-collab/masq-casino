import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createSlotModel, SLOT_PALETTE } from '../art/createSlotModels.js';
import { PLINKO_MULTIPLIERS } from '../game-math.js';

// Authored, solid low-poly props. The parent owns the clock and the outcome.
// A CanvasTexture is used only for printed type on physical label plates.
const C = SLOT_PALETTE;
const TAU = Math.PI * 2;
const clamp = value => Math.min(1, Math.max(0, Number(value) || 0));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const easeOut = t => 1 - (1 - t) ** 3;
const MULTIPLIERS = PLINKO_MULTIPLIERS;
const BIN_WIDTH = .59;
const ROW_Y = 1.42;
const ROW_GAP = .34;
const BALL_RADIUS = .105;

export const EUROPEAN_POCKETS = Object.freeze([
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23,
  10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
]);
const RED_POCKETS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const POCKET_ANGLE = TAU / EUROPEAN_POCKETS.length;

function roundProgress(round, elapsed, duration, busy, fallback) {
  if (!round) return 0;
  if (!busy) return 1;
  return clamp(elapsed / (duration > 0 ? duration : fallback));
}

function SolidBox({ at = [0, 0, 0], size, color = C.coal, rotation, metal = 0, ...rest }) {
  return <mesh position={at} rotation={rotation} castShadow receiveShadow {...rest}>
    <boxGeometry args={size}/>
    <meshStandardMaterial color={color} roughness={.88} metalness={metal} flatShading/>
  </mesh>;
}

function PrintedLabel({ text, width = 1, height = .2, at = [0, 0, 0], rotation, color = C.ivory, background, fontSize = 54 }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (background) {
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.fillStyle = color;
    context.font = `600 ${fontSize}px "Arial", sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 2, 490);
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = 4;
    result.name = `indictus-print-${text}`;
    return result;
  }, [text, color, background, fontSize]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={at} rotation={rotation}>
    <planeGeometry args={[width, height]}/>
    <meshStandardMaterial map={texture} transparent={!background} roughness={.95} metalness={0} depthWrite={false} polygonOffset polygonOffsetFactor={-1}/>
  </mesh>;
}

function MaskSeal({ at, size = .45, rotation }) {
  const model = useMemo(() => createSlotModel('scatter', { fit: size }), [size]);
  useEffect(() => () => model.userData.dispose(), [model]);
  return <primitive object={model} position={at} rotation={rotation} dispose={null}/>;
}

// The eight given bits choose the side of each pin. Every successive contact is
// another pin in the triangular grid; the eighth contact leads to sum(bits).
export function plinkoBallPosition(path, progress) {
  const bits = Array.from({ length: 8 }, (_, i) => path?.[i] === 1 ? 1 : 0);
  const t = clamp(progress);
  if (t < .08) return [0, mix(1.94, ROW_Y + .15, (t / .08) ** 2), .30];
  let ones = 0;
  for (let row = 0; row < 8; row++) {
    const start = .08 + row * .10;
    const end = row === 7 ? 1 : start + .10;
    const startX = (ones - row / 2) * BIN_WIDTH;
    const startY = ROW_Y - row * ROW_GAP + .15;
    const bit = bits[row];
    ones += bit;
    if (t <= end || row === 7) {
      const q = clamp((t - start) / (end - start));
      const endX = (ones - (row + 1) / 2) * BIN_WIDTH;
      const endY = row === 7 ? -1.295 : startY - ROW_GAP;
      const bounce = row === 7 ? .095 : .125;
      return [mix(startX, endX, smooth(q)), mix(startY, endY, q) + Math.sin(q * Math.PI) * bounce, .30];
    }
  }
  return [(ones - 4) * BIN_WIDTH, -1.295, .30];
}

export function PlinkoScene({ round, elapsed = 0, duration = 1.8, busy = false }) {
  const ball = useRef();
  const progress = roundProgress(round, elapsed, duration, busy, 1.8);
  const bits = round?.path;
  const selectedBin = round && progress === 1 ? bits?.reduce((sum, bit) => sum + (bit === 1 ? 1 : 0), 0) : -1;
  useFrame(() => {
    if (!ball.current) return;
    const at = round ? plinkoBallPosition(bits, progress) : [0, 1.94, .30];
    ball.current.position.set(...at);
    ball.current.rotation.set(progress * 8, 0, progress * 12);
  });
  return <group name="indictus-plinko-physical-board">
    <SolidBox size={[5.66, 3.94, .28]} at={[0, .20, -.20]} color={C.black}/>
    <SolidBox size={[5.30, 3.56, .055]} at={[0, .17, -.03]} color={C.coal}/>
    <SolidBox size={[5.36, .13, .20]} at={[0, 2.10, -.02]} color={C.cloth}/>
    <SolidBox size={[5.36, .15, .25]} at={[0, -1.70, .015]} color={C.black}/>
    {[-1, 1].map(side => <group key={`side-${side}`}>
      <SolidBox size={[.16, 3.90, .24]} at={[side * 2.72, .20, .025]} color={C.cloth}/>
      <SolidBox size={[.03, 3.63, .025]} at={[side * 2.60, .17, .162]} color={C.seam}/>
      <SolidBox size={[.38, .12, .78]} at={[side * 2.37, -1.79, -.05]} color={C.black}/>
      <SolidBox size={[.13, .96, .16]} at={[side * 2.35, -1.40, -.35]} color={C.darkSteel}/>
      {[1.95, -1.56].map(y => <mesh key={y} position={[side * 2.72, y, .167]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[.035, .035, .019, 6]}/>
        <meshStandardMaterial color={C.steel} roughness={.7} metalness={.4} flatShading/>
      </mesh>)}
    </group>)}
    <SolidBox size={[1.40, .54, .036]} at={[-1.83, 1.75, .038]} color={C.black}/>
    <MaskSeal at={[-2.27, 1.75, .115]} size={.41}/>
    <PrintedLabel text="MASQ" width={.85} height={.16} at={[-1.59, 1.80, .07]}/>
    <PrintedLabel text="PLINKO  /  08" width={.83} height={.12} at={[-1.59, 1.61, .07]} color={C.steel} fontSize={44}/>
    <SolidBox size={[1.16, .24, .035]} at={[1.97, 1.84, .037]} color={C.black}/>
    <PrintedLabel text="9 POCKETS" width={.95} height={.13} at={[1.97, 1.84, .062]} color={C.ivoryShadow} fontSize={46}/>
    {Array.from({ length: 8 }, (_, row) => Array.from({ length: row + 1 }, (_, pin) => {
      const x = (pin - row / 2) * BIN_WIDTH;
      const y = ROW_Y - row * ROW_GAP;
      return <group key={`pin-${row}-${pin}`} position={[x, y, .14]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[.055, .065, .17, 8]}/>
          <meshStandardMaterial color={C.steel} roughness={.67} metalness={.35} flatShading/>
        </mesh>
        <mesh position={[0, 0, .091]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[.036, .036, .015, 8]}/>
          <meshStandardMaterial color={C.ivoryShadow} roughness={.8} metalness={.16} flatShading/>
        </mesh>
      </group>;
    }))}
    {MULTIPLIERS.map((multiplier, bin) => {
      const selected = bin === selectedBin;
      const x = (bin - 4) * BIN_WIDTH;
      return <group key={`bin-${bin}`}>
        <SolidBox at={[x, -1.425, .05]} size={[BIN_WIDTH - .035, .42, .055]} color={selected ? C.burgundyLight : bin === 0 || bin === 8 ? C.burgundy : C.black}/>
        <SolidBox at={[x, -1.42, .25]} size={[BIN_WIDTH - .035, .04, .36]} color={C.cloth}/>
        <SolidBox at={[x, -1.53, .42]} size={[BIN_WIDTH - .07, .19, .04]} color={selected ? C.burgundy : C.coal}/>
        <PrintedLabel text={`${multiplier}×`} width={BIN_WIDTH - .10} height={.13} at={[x, -1.53, .443]} color={selected ? C.ivory : C.ivoryShadow} fontSize={57}/>
      </group>;
    })}
    {Array.from({ length: 10 }, (_, index) => <SolidBox key={`divider-${index}`} at={[(index - 4.5) * BIN_WIDTH, -1.31, .25]} size={[.028, .43, .28]} color={C.seam}/>)}
    <mesh ref={ball} position={[0, 1.94, .30]} castShadow>
      <icosahedronGeometry args={[BALL_RADIUS, 1]}/>
      <meshStandardMaterial color={C.ivory} roughness={.54} metalness={.13} flatShading/>
    </mesh>
  </group>;
}

function annularWedge(inner, outer, angle, height) {
  const lo = -angle / 2;
  const hi = angle / 2;
  const corners = [[inner, lo], [outer, lo], [outer, hi], [inner, hi]];
  const vertices = [];
  for (const y of [0, height]) {
    corners.forEach(([radius, theta]) => vertices.push(Math.sin(theta) * radius, y, Math.cos(theta) * radius));
  }
  const indices = [4, 5, 6, 4, 6, 7, 0, 2, 1, 0, 3, 2];
  for (let side = 0; side < 4; side++) {
    const next = (side + 1) % 4;
    indices.push(side, next, next + 4, side, next + 4, side + 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  const faceted = geometry.toNonIndexed();
  faceted.computeVertexNormals();
  geometry.dispose();
  return faceted;
}

const WHEEL_TURNS = 3.25;
function wheelAngle(progress) {
  return TAU * WHEEL_TURNS * easeOut(clamp(progress));
}

// The ball is counter-rotating in the fixed raceway, then drops relative to the
// moving wheel. Its final local angle is exactly the chosen European pocket.
export function rouletteBallTransform(number, progress) {
  const t = clamp(progress);
  const winner = Math.max(0, EUROPEAN_POCKETS.indexOf(Number(number)));
  const winningAngle = winner * POCKET_ANGLE;
  const releaseTime = .68;
  const raceAngle = at => .3 - TAU * 4.35 * (1 - (1 - at) ** 1.7);
  if (t <= releaseTime) {
    const angle = raceAngle(t);
    return { at: [Math.sin(angle) * 2.43, .095, Math.cos(angle) * 2.43], angle };
  }
  const startLocal = raceAngle(releaseTime) - wheelAngle(releaseTime);
  const targetLocal = winningAngle + TAU * Math.floor((startLocal - winningAngle) / TAU);
  const q = clamp((t - releaseTime) / .29);
  const travel = easeOut(q);
  const angle = wheelAngle(t) + mix(startLocal, targetLocal, travel);
  const radius = mix(2.43, 1.925, smooth(q));
  const hop = Math.sin(q * Math.PI) * .075 + Math.sin(q * Math.PI * 3) ** 2 * .025 * (1 - q);
  const y = mix(.095, -.123, smooth(q)) + hop;
  return { at: [Math.sin(angle) * radius, y, Math.cos(angle) * radius], angle };
}

function HorizontalRing({ radius, tube, y, color = C.cloth, radial = 6, segments = 74 }) {
  return <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
    <torusGeometry args={[radius, tube, radial, segments]}/>
    <meshStandardMaterial color={color} roughness={.8} metalness={.15} flatShading/>
  </mesh>;
}

export function RouletteScene({ round, elapsed = 0, duration = 3.4, busy = false }) {
  const wheel = useRef();
  const ball = useRef();
  const progress = roundProgress(round, elapsed, duration, busy, 3.4);
  const winner = round ? Number(round.number) : null;
  const pocketGeometry = useMemo(() => annularWedge(1.68, 2.17, POCKET_ANGLE * .92, .065), []);
  const numberGeometry = useMemo(() => annularWedge(2.18, 2.36, POCKET_ANGLE * .94, .065), []);
  useEffect(() => () => { pocketGeometry.dispose(); numberGeometry.dispose(); }, [pocketGeometry, numberGeometry]);
  useFrame(() => {
    if (wheel.current) wheel.current.rotation.y = round ? wheelAngle(progress) : 0;
    if (ball.current) {
      const transform = round ? rouletteBallTransform(winner, progress) : { at: [0, .095, 2.43] };
      ball.current.position.set(...transform.at);
      ball.current.rotation.set(progress * 14, progress * 27, 0);
    }
  });
  return <group name="indictus-european-roulette-physical-wheel">
    <mesh position={[0, -.67, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[2.65, 2.57, .62, 48]}/>
      <meshStandardMaterial color={C.black} roughness={.88} metalness={.02} flatShading/>
    </mesh>
    <mesh position={[0, -.99, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[2.59, 2.59, .12, 48]}/>
      <meshStandardMaterial color={C.cloth} roughness={.88} flatShading/>
    </mesh>
    {[-1, 1].flatMap(x => [-1, 1].map(z => <group key={`foot-${x}-${z}`}>
      <SolidBox at={[x * 1.57, -1.21, z * 1.44]} size={[.20, .34, .20]} color={C.darkSteel}/>
      <SolidBox at={[x * 1.57, -1.41, z * 1.44]} size={[.45, .08, .40]} color={C.black}/>
    </group>))}
    <mesh position={[0, -.25, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[2.53, 2.55, .25, 74]}/>
      <meshStandardMaterial color={C.coal} roughness={.87} flatShading/>
    </mesh>
    <HorizontalRing radius={2.56} tube={.105} y={-.04} color={C.cloth}/>
    <HorizontalRing radius={2.43} tube={.055} y={-.042} color={C.coal} radial={8}/>
    <HorizontalRing radius={2.365} tube={.031} y={-.056} color={C.darkSteel}/>
    <HorizontalRing radius={2.57} tube={.024} y={-.305} color={C.burgundy}/>
    <HorizontalRing radius={2.425} tube={.018} y={-.020} color={C.seam}/>
    {Array.from({ length: 18 }, (_, i) => {
      const angle = i * TAU / 18;
      return <mesh key={`rim-fastener-${i}`} position={[Math.sin(angle) * 2.56, .055, Math.cos(angle) * 2.56]} castShadow>
        <cylinderGeometry args={[.026, .026, .016, 6]}/>
        <meshStandardMaterial color={C.darkSteel} roughness={.65} metalness={.3} flatShading/>
      </mesh>;
    })}
    <group ref={wheel} name="rotating-pocket-assembly">
      <mesh position={[0, -.26, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.365, 2.365, .10, 74]}/>
        <meshStandardMaterial color={C.black} roughness={.89} flatShading/>
      </mesh>
      {EUROPEAN_POCKETS.map((number, index) => {
        const angle = index * POCKET_ANGLE;
        const color = number === 0 ? '#294d41' : RED_POCKETS.has(number) ? C.burgundy : C.coal;
        const settled = round && progress === 1 && winner === number;
        const dividerAngle = angle + POCKET_ANGLE / 2;
        return <group key={`pocket-${number}`}>
          <mesh position={[0, -.27, 0]} rotation={[0, angle, 0]} castShadow receiveShadow>
            <primitive object={pocketGeometry} attach="geometry" dispose={null}/>
            <meshStandardMaterial color={settled ? number === 0 ? '#376451' : RED_POCKETS.has(number) ? C.burgundyLight : C.cloth : color} roughness={.92} flatShading/>
          </mesh>
          <mesh position={[0, -.18, 0]} rotation={[0, angle, 0]} castShadow receiveShadow>
            <primitive object={numberGeometry} attach="geometry" dispose={null}/>
            <meshStandardMaterial color={color} roughness={.88} flatShading/>
          </mesh>
          <SolidBox at={[Math.sin(dividerAngle) * 1.925, -.155, Math.cos(dividerAngle) * 1.925]} size={[.018, .15, .51]} rotation={[0, dividerAngle, 0]} color={C.darkSteel} metal={.2}/>
          <group position={[Math.sin(angle) * 2.265, -.111, Math.cos(angle) * 2.265]} rotation={[0, angle, 0]}>
            <PrintedLabel text={String(number)} width={.265} height={.145} rotation={[-Math.PI / 2, 0, 0]} fontSize={70}/>
          </group>
        </group>;
      })}
      <HorizontalRing radius={1.665} tube={.042} y={-.08} color={C.darkSteel}/>
      <mesh position={[0, -.08, 0]} castShadow receiveShadow>
        <coneGeometry args={[1.62, .39, 37, 1]}/>
        <meshStandardMaterial color={C.cloth} roughness={.87} metalness={.05} flatShading/>
      </mesh>
      <mesh position={[0, .14, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[.36, .49, .25, 12]}/>
        <meshStandardMaterial color={C.black} roughness={.83} metalness={.14} flatShading/>
      </mesh>
      <mesh position={[0, .39, 0]} castShadow>
        <cylinderGeometry args={[.09, .14, .34, 8]}/>
        <meshStandardMaterial color={C.darkSteel} roughness={.64} metalness={.4} flatShading/>
      </mesh>
      <SolidBox at={[0, .52, 0]} size={[.87, .055, .07]} color={C.steel} metal={.35}/>
      <SolidBox at={[0, .52, 0]} size={[.07, .055, .87]} color={C.steel} metal={.35}/>
      <mesh position={[0, .59, 0]} castShadow>
        <icosahedronGeometry args={[.095, 0]}/>
        <meshStandardMaterial color={C.ivoryShadow} roughness={.63} metalness={.3} flatShading/>
      </mesh>
    </group>
    <SolidBox size={[1.39, .36, .07]} at={[0, -.66, 2.60]} color={C.cloth}/>
    <MaskSeal at={[-.47, -.66, 2.65]} size={.28}/>
    <PrintedLabel text="MASQ" width={.80} height={.13} at={[.12, -.60, 2.647]}/>
    <PrintedLabel text="EUROPEAN  /  37" width={.87} height={.095} at={[.12, -.75, 2.647]} color={C.steel} fontSize={45}/>
    <mesh ref={ball} position={[0, .095, 2.43]} castShadow>
      <icosahedronGeometry args={[.082, 1]}/>
      <meshStandardMaterial color={C.ivory} roughness={.42} metalness={.12} flatShading/>
    </mesh>
  </group>;
}
