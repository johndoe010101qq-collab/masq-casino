import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SLOT_MODEL_PARTS, SLOT_PALETTE } from '../art/createSlotModels.js';

// Authored solid geometry only. All geometries/materials below are declarative
// R3F children, so R3F owns and disposes their GPU resources on unmount.
const TAU = Math.PI * 2;
const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
const easeOut = value => 1 - (1 - value) ** 3;
const COLOR = {
  coal: '#191b1d', black: '#0e1012', edge: '#373b3e', steel: '#5b6265',
  beige: '#d8cfb7', beigeShade: '#9a927e', burgundy: '#67303a', felt: '#202427'
};

function Block({ size, at = [0, 0, 0], rotation, color = COLOR.coal }) {
  return (
    <mesh position={at} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.94} metalness={0.03} flatShading />
    </mesh>
  );
}

function Disc({ radius, depth, at = [0, 0, 0], color = COLOR.coal, segments = 20 }) {
  return (
    <mesh position={at} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, depth, segments]} />
      <meshStandardMaterial color={color} roughness={0.94} metalness={0.03} flatShading />
    </mesh>
  );
}

function MaskRelief({ scale = [0.75, 0.75, 0.28], at = [0, 0.04, 0.15] }) {
  return (
    <group position={at} scale={scale}>
      {SLOT_MODEL_PARTS.scatter.map(part => (
        <Block
          key={part.name}
          size={part.size}
          at={part.at}
          rotation={part.rotation.map(degrees => degrees * Math.PI / 180)}
          color={part.material === 'cheek' ? COLOR.beigeShade : SLOT_PALETTE[part.material]}
        />
      ))}
    </group>
  );
}

function Plate({ width = 2.5, depth = 2.0 }) {
  return (
    <group>
      <Block size={[width, 0.15, depth]} at={[0, -0.81, 0]} color={COLOR.black} />
      <Block size={[width - 0.13, 0.055, depth - 0.13]} at={[0, -0.705, 0]} color={COLOR.felt} />
      <Block size={[width, 0.085, 0.07]} at={[0, -0.68, -depth / 2 + 0.035]} color={COLOR.edge} />
      <Block size={[0.07, 0.085, depth]} at={[-width / 2 + 0.035, -0.68, 0]} color={COLOR.edge} />
      <Block size={[0.07, 0.085, depth]} at={[width / 2 - 0.035, -0.68, 0]} color={COLOR.edge} />
      <Block size={[0.30, 0.016, 0.075]} at={[0, -0.668, depth / 2 - 0.13]} color={COLOR.beigeShade} />
    </group>
  );
}

function facingQuaternion(direction) {
  const normal = new THREE.Vector3(...direction).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), normal).normalize();
  const up = new THREE.Vector3().crossVectors(normal, right).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, normal));
}

export function CoinScene({ round, elapsed = 0, duration = 1.6, busy = false }) {
  const body = useRef();
  const previousRound = useRef(null);
  const start = useRef(new THREE.Quaternion());
  const scratch = useMemo(() => ({
    front: facingQuaternion([0.47, 0.20, 0.86]),
    final: new THREE.Quaternion(), spin: new THREE.Quaternion(),
    axis: new THREE.Vector3(1, 0, 0), back: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)
  }), []);

  useFrame(({ clock }) => {
    const coin = body.current;
    if (!coin) return;
    scratch.final.copy(scratch.front);
    if (Number(round?.result) === 1) scratch.final.multiply(scratch.back);

    if (busy && round) {
      if (previousRound.current !== round) {
        previousRound.current = round;
        start.current.copy(coin.quaternion);
      }
      const progress = clamp01(elapsed / Math.max(0.001, duration));
      const eased = easeOut(progress);
      coin.quaternion.slerpQuaternions(start.current, scratch.final, eased);
      scratch.spin.setFromAxisAngle(scratch.axis, TAU * 3 * (1 - eased));
      coin.quaternion.multiply(scratch.spin);
      // An upward toss followed by a small, decaying physical landing wobble.
      const wobble = progress > 0.72 ? Math.sin((progress - 0.72) * 48) * (1 - progress) * 0.10 : 0;
      coin.position.set(0.16 * Math.sin(TAU * progress), 0.37 + 0.78 * Math.sin(Math.PI * progress) + wobble, 0.10 * Math.sin(Math.PI * progress));
    } else {
      coin.position.set(0, 0.37, 0);
      coin.quaternion.copy(scratch.final);
      if (!round) {
        scratch.spin.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(clock.elapsedTime * 0.6) * 0.10);
        coin.quaternion.multiply(scratch.spin);
      }
    }
  });

  return (
    <group>
      <Plate width={2.25} depth={1.70} />
      <Block size={[0.71, 0.16, 0.50]} at={[0, -0.58, 0]} color={COLOR.coal} />
      <Block size={[0.11, 0.23, 0.40]} at={[-0.35, -0.48, 0]} color={COLOR.steel} />
      <Block size={[0.11, 0.23, 0.40]} at={[0.35, -0.48, 0]} color={COLOR.steel} />
      <group ref={body} position={[0, 0.37, 0]} quaternion={scratch.front}>
        <Disc radius={0.78} depth={0.23} color={COLOR.beigeShade} segments={24} />
        <Disc radius={0.735} depth={0.245} color={COLOR.coal} segments={24} />
        <Disc radius={0.675} depth={0.255} color={COLOR.black} segments={24} />
        {Array.from({ length: 24 }, (_, index) => {
          const angle = index * TAU / 24;
          return <Block key={index} size={[0.018, 0.065, 0.235]} at={[Math.sin(angle) * 0.759, Math.cos(angle) * 0.759, 0]} rotation={[0, 0, -angle]} color={COLOR.edge} />;
        })}
        <MaskRelief />
        <group rotation={[0, Math.PI, 0]}>
          <Block size={[0.13, 0.78, 0.052]} at={[0.035, 0.04, 0.152]} color={COLOR.beige} />
          <Block size={[0.32, 0.105, 0.052]} at={[-0.055, 0.362, 0.152]} rotation={[0, 0, 0.48]} color={COLOR.beige} />
          <Block size={[0.43, 0.105, 0.052]} at={[0.01, -0.37, 0.152]} color={COLOR.beige} />
          <Block size={[0.44, 0.023, 0.030]} at={[0, -0.49, 0.153]} color={COLOR.beigeShade} />
        </group>
      </group>
    </group>
  );
}

// Six actual pip faces. 1↔6, 2↔5, and 3↔4; no face is painted or swapped.
const DIE_FACES = [
  { value: 1, normal: [0, 0, 1], at: [0, 0, 0.526], rotation: [0, 0, 0] },
  { value: 6, normal: [0, 0, -1], at: [0, 0, -0.526], rotation: [0, Math.PI, 0] },
  { value: 2, normal: [0, 1, 0], at: [0, 0.526, 0], rotation: [-Math.PI / 2, 0, 0] },
  { value: 5, normal: [0, -1, 0], at: [0, -0.526, 0], rotation: [Math.PI / 2, 0, 0] },
  { value: 3, normal: [1, 0, 0], at: [0.526, 0, 0], rotation: [0, Math.PI / 2, 0] },
  { value: 4, normal: [-1, 0, 0], at: [-0.526, 0, 0], rotation: [0, -Math.PI / 2, 0] }
];
const PIPS = {
  1: [[0, 0]],
  2: [[-0.23, 0.23], [0.23, -0.23]],
  3: [[-0.23, 0.23], [0, 0], [0.23, -0.23]],
  4: [[-0.23, 0.23], [0.23, 0.23], [-0.23, -0.23], [0.23, -0.23]],
  5: [[-0.23, 0.23], [0.23, 0.23], [0, 0], [-0.23, -0.23], [0.23, -0.23]],
  6: [[-0.23, 0.26], [0.23, 0.26], [-0.23, 0], [0.23, 0], [-0.23, -0.26], [0.23, -0.26]]
};

function Die() {
  return (
    <group>
      {/* Three crossed cuboids produce a solid cube with stepped corner bevels. */}
      <Block size={[1.04, 0.96, 0.96]} color={COLOR.steel} />
      <Block size={[0.96, 1.04, 0.96]} color={COLOR.steel} />
      <Block size={[0.96, 0.96, 1.04]} color={COLOR.steel} />
      {DIE_FACES.map(face => (
        <group key={face.value} position={face.at} rotation={face.rotation}>
          <Block size={[0.90, 0.90, 0.015]} color={COLOR.coal} />
          {PIPS[face.value].map(([x, y], index) => (
            <Disc key={index} radius={0.075} depth={0.018} at={[x, y, 0.018]} color={COLOR.beige} segments={8} />
          ))}
        </group>
      ))}
    </group>
  );
}

export function DiceScene({ round, elapsed = 0, duration = 1.6, busy = false }) {
  const body = useRef();
  const previousRound = useRef(null);
  const start = useRef(new THREE.Quaternion());
  const scratch = useMemo(() => ({
    final: new THREE.Quaternion(), spin: new THREE.Quaternion(),
    yaw: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.48),
    up: new THREE.Vector3(0, 1, 0), normal: new THREE.Vector3(), euler: new THREE.Euler(), matrix: new THREE.Matrix4()
  }), []);

  useFrame(() => {
    const die = body.current;
    if (!die) return;
    const result = Math.max(1, Math.min(6, Math.trunc(Number(round?.face) || 1)));
    const face = DIE_FACES.find(item => item.value === result);
    scratch.normal.set(...face.normal);
    // The selected face rests upward; the two side faces remain real and consistent.
    scratch.final.setFromUnitVectors(scratch.normal, scratch.up).premultiply(scratch.yaw);
    if (busy && round) {
      if (previousRound.current !== round) {
        previousRound.current = round;
        start.current.copy(die.quaternion);
      }
      const progress = clamp01(elapsed / Math.max(0.001, duration));
      const eased = easeOut(progress);
      die.quaternion.slerpQuaternions(start.current, scratch.final, eased);
      scratch.euler.set(TAU * 3 * (1 - eased), TAU * 2 * (1 - eased), TAU * (1 - eased));
      scratch.spin.setFromEuler(scratch.euler);
      die.quaternion.multiply(scratch.spin);
      const height = progress < 0.56
        ? Math.sin(Math.PI * progress / 0.56) * 0.78
        : Math.abs(Math.sin((progress - 0.56) * Math.PI / 0.19)) * (1 - progress) * 0.55;
      // Rotated corners must stay above the tray during each impact.
      scratch.matrix.makeRotationFromQuaternion(die.quaternion);
      const matrix = scratch.matrix.elements;
      const supportHeight = 0.556 * (Math.abs(matrix[1]) + Math.abs(matrix[5]) + Math.abs(matrix[9]));
      die.position.set(0.48 * Math.sin(TAU * progress) * (1 - progress), -0.6775 + supportHeight + height, -0.13 * Math.sin(Math.PI * progress));
    } else {
      die.position.set(0, -0.1215, 0);
      die.quaternion.copy(scratch.final);
    }
  });

  return (
    <group>
      <Plate width={2.65} depth={2.15} />
      <Block size={[0.065, 0.21, 2.15]} at={[-1.28, -0.61, 0]} color={COLOR.coal} />
      <Block size={[0.065, 0.21, 2.15]} at={[1.28, -0.61, 0]} color={COLOR.coal} />
      <Block size={[2.65, 0.21, 0.065]} at={[0, -0.61, -1.035]} color={COLOR.coal} />
      <group position={[-.94,-.491,.63]} rotation={[-Math.PI/2,0,0]}>
        <MaskRelief at={[0,0,0]} scale={[.18,.18,.05]} />
      </group>
      <group ref={body} position={[0, -0.1215, 0]}>
        <Die />
      </group>
    </group>
  );
}

function multiplierFrom(choice) {
  const value = typeof choice === 'object' && choice !== null ? choice.multiplier ?? choice.value : choice;
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number > 0 ? number : 2;
}

export function UpgradeScene({ round, elapsed = 0, duration = 1.8, busy = false, choice = 2 }) {
  const pointer = useRef();
  const previousRound = useRef(null);
  const fromAngle = useRef(0);
  const toAngle = useRef(0);
  const currentAngle = useRef(0);
  const faceOrientation = useMemo(() => facingQuaternion([0.47, 0.30, 0.83]), []);
  const chance = clamp01(0.96 / multiplierFrom(choice));
  const ticket = Math.max(0, Math.min(9999, Math.trunc(Number(round?.ticket) || 0)));
  const resultAngle = TAU * ticket / 10000;

  useFrame(() => {
    if (!pointer.current) return;
    if (busy && round) {
      if (previousRound.current !== round) {
        previousRound.current = round;
        fromAngle.current = currentAngle.current;
        const normalizedStart = ((currentAngle.current % TAU) + TAU) % TAU;
        const clockwiseDistance = (resultAngle - normalizedStart + TAU) % TAU;
        toAngle.current = fromAngle.current + TAU * 3 + clockwiseDistance;
      }
      const progress = clamp01(elapsed / Math.max(0.001, duration));
      currentAngle.current = THREE.MathUtils.lerp(fromAngle.current, toAngle.current, easeOut(progress));
    } else {
      currentAngle.current = round ? resultAngle : TAU * chance / 2;
    }
    pointer.current.rotation.z = -currentAngle.current;
  });

  return (
    <group>
      <Block size={[1.25, 0.16, 0.91]} at={[0, -0.79, -0.10]} color={COLOR.black} />
      <Block size={[0.34, 0.54, 0.35]} at={[0, -0.48, -0.20]} color={COLOR.edge} />
      <Block size={[0.79, 0.045, 0.51]} at={[0, -0.68, -0.10]} color={COLOR.coal} />
      <group position={[0, 0.36, 0]} quaternion={faceOrientation}>
        <Disc radius={1.25} depth={0.22} color={COLOR.black} segments={32} />
        <Disc radius={1.195} depth={0.235} color={COLOR.edge} segments={32} />
        <Disc radius={1.05} depth={0.25} color={COLOR.coal} segments={32} />
        {/* Clockwise chance starts at twelve o'clock. A precise boundary block
            supplements the segmented ring, including fractional-tick chances. */}
        {Array.from({ length: 64 }, (_, index) => {
          const ratio = (index + 0.5) / 64;
          const angle = ratio * TAU;
          const winning = ratio < chance;
          return (
            <Block key={index} size={[0.075, 0.20, 0.050]} at={[Math.sin(angle) * 1.102, Math.cos(angle) * 1.102, 0.145]} rotation={[0, 0, -angle]} color={winning ? COLOR.beige : COLOR.burgundy} />
          );
        })}
        {Array.from({ length: 16 }, (_, index) => {
          const angle = index * TAU / 16;
          return <Block key={index} size={[index % 4 === 0 ? 0.041 : 0.025, index % 4 === 0 ? 0.115 : 0.055, 0.026]} at={[Math.sin(angle) * 0.875, Math.cos(angle) * 0.875, 0.145]} rotation={[0, 0, -angle]} color={COLOR.beigeShade} />;
        })}
        <group rotation={[0, 0, -chance * TAU]}>
          <Block size={[0.035, 0.27, 0.075]} at={[0, 1.095, 0.171]} color={COLOR.beige} />
        </group>
        <Block size={[0.055, 0.15, 0.075]} at={[0, 1.19, 0.175]} color={COLOR.steel} />
        <group ref={pointer}>
          <Block size={[0.090, 0.94, 0.071]} at={[0, 0.42, 0.225]} color={COLOR.black} />
          <Block size={[0.040, 0.90, 0.077]} at={[0, 0.42, 0.249]} color={COLOR.beige} />
          <Block size={[0.070, 0.20, 0.078]} at={[-0.045, 0.855, 0.249]} rotation={[0, 0, -0.48]} color={COLOR.beige} />
          <Block size={[0.070, 0.20, 0.078]} at={[0.045, 0.855, 0.249]} rotation={[0, 0, 0.48]} color={COLOR.beige} />
          <Block size={[0.105, 0.21, 0.071]} at={[0, -0.18, 0.225]} color={COLOR.steel} />
        </group>
        <Disc radius={0.235} depth={0.15} at={[0, 0, 0.275]} color={round && !busy ? (round.won ? COLOR.beigeShade : COLOR.burgundy) : COLOR.steel} segments={12} />
        <MaskRelief at={[0, 0.015, 0.355]} scale={[0.26, 0.26, 0.10]} />
      </group>
    </group>
  );
}
