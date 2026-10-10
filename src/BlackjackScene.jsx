import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FramePump, usePageVisible } from './SceneMotion.jsx';
import StudioEnvironment from './StudioEnvironment.jsx';

const C = { felt: '#17342b', edge: '#1a1c20', red: '#d83d34', cream: '#f3f3ef', silver: '#b7bec0', cyan: '#80929d', gold: '#bcc3ca' };
const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => 1 - (1 - clamp(value)) ** 3;

// Raster CanvasTextures on real thick meshes. Suits are authored canvas paths,
// rather than SVG assets, emoji, or a flat illustration of the table.
function paintSuit(ctx, suit, x, y, size) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 100, size / 100); ctx.beginPath();
  if (suit === 'diamonds') { ctx.moveTo(0, -52); ctx.lineTo(35, 0); ctx.lineTo(0, 52); ctx.lineTo(-35, 0); ctx.closePath(); }
  else if (suit === 'hearts') {
    ctx.moveTo(0, 43); ctx.bezierCurveTo(-88, -12, -36, -75, 0, -31);
    ctx.bezierCurveTo(36, -75, 88, -12, 0, 43);
  } else if (suit === 'spades') {
    ctx.moveTo(0, -49); ctx.bezierCurveTo(-84, 5, -41, 58, -7, 22);
    ctx.lineTo(-15, 47); ctx.lineTo(15, 47); ctx.lineTo(7, 22);
    ctx.bezierCurveTo(41, 58, 84, 5, 0, -49);
  } else {
    ctx.arc(0, -25, 23, 0, Math.PI * 2); ctx.moveTo(6, 8); ctx.arc(-26, 8, 23, 0, Math.PI * 2);
    ctx.moveTo(49, 8); ctx.arc(26, 8, 23, 0, Math.PI * 2);
    ctx.moveTo(-7, 10); ctx.lineTo(-17, 48); ctx.lineTo(17, 48); ctx.lineTo(7, 10);
  }
  ctx.fill(); ctx.restore();
}
function paintBack(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, 256, 384);
  gradient.addColorStop(0, '#24282d'); gradient.addColorStop(.5, '#15181c'); gradient.addColorStop(1, '#24282d');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 384);
  ctx.strokeStyle = '#c1c7cf'; ctx.lineWidth = 5; ctx.strokeRect(15, 15, 226, 354);
  ctx.strokeStyle = '#687e86'; ctx.lineWidth = 2; ctx.strokeRect(24, 24, 208, 336);
  ctx.strokeStyle = '#525861'; ctx.lineWidth = 3;
  for (let y = 40; y < 360; y += 22) for (let x = 32; x < 240; x += 22) {
    ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 7, y); ctx.closePath(); ctx.stroke();
  }
  ctx.fillStyle = '#181b20'; ctx.fillRect(46, 142, 164, 104);
  ctx.fillStyle = C.cream; ctx.textAlign = 'center'; ctx.font = 'bold 22px Arial'; ctx.fillText('MASQ', 128, 192);
  ctx.fillStyle = '#b5bcc5'; ctx.font = '12px Arial'; ctx.fillText('CASINO', 128, 217);
}
function useCardTexture(card, back = false) {
  const [texture, setTexture] = useState(null);
  const invalidate = useThree(state => state.invalidate);
  const rank = card?.rank, suit = card?.suit;
  useEffect(() => {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 384;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    if (back || !rank) paintBack(ctx);
    else {
      const paper = ctx.createLinearGradient(0, 0, 256, 384); paper.addColorStop(0, '#f8f8f5'); paper.addColorStop(1, '#e8ebed');
      ctx.fillStyle = paper; ctx.fillRect(0, 0, 256, 384);
      ctx.strokeStyle = '#bdc3c9'; ctx.lineWidth = 3; ctx.strokeRect(9, 9, 238, 366);
      ctx.fillStyle = ['hearts', 'diamonds'].includes(suit) ? '#d03932' : '#14171b';
      const value = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[rank] ?? String(rank);
      for (const flipped of [false, true]) {
        ctx.save(); if (flipped) { ctx.translate(256, 384); ctx.rotate(Math.PI); }
        ctx.font = 'bold 52px Arial'; ctx.textAlign = 'center'; ctx.fillText(value, 43, 60);
        paintSuit(ctx, suit, 43, 92, 30); ctx.restore();
      }
      paintSuit(ctx, suit, 128, 191, 114);
      if (rank >= 11) { ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center'; ctx.fillText(value, 128, 283); }
    }
    const next = new THREE.CanvasTexture(canvas); next.colorSpace = THREE.SRGBColorSpace;
    next.anisotropy = 4; setTexture(next);
    return () => next.dispose();
  }, [rank, suit, back]);
  // Texture creation follows the first React commit. Demand rendering needs a
  // frame after the mapped surface is committed, including a stationary hand.
  useLayoutEffect(() => { if (texture) invalidate(); }, [texture, invalidate]);
  return texture;
}
function Card({ card, at, dealProgress = 1, flipProgress = null }) {
  const ref = useRef();
  const face = useCardTexture(card, card.hidden), back = useCardTexture(null, true);
  const p = ease(dealProgress);
  const angle = flipProgress === null ? card.hidden ? Math.PI : 0 : Math.PI * (1 - clamp(flipProgress));
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.set(THREE.MathUtils.lerp(2.8, at[0], p), at[1] + Math.sin(p * Math.PI) * .65,
      THREE.MathUtils.lerp(-1.8, at[2], p));
    ref.current.rotation.set(-Math.PI / 2, 0, 0);
  });
  return <group ref={ref} position={at} rotation={[-Math.PI / 2, 0, 0]}>
    <group rotation={[0, angle, (1 - p) * -.2]}>
      <mesh castShadow receiveShadow><boxGeometry args={[.68, 1.02, .025]} />
        <meshPhysicalMaterial color={C.cream} roughness={.37} clearcoat={.32} clearcoatRoughness={.26} /></mesh>
      {/* Mount a mapped material only once its texture exists. A material first
          compiled with map=null can retain the no-map shader after assignment. */}
      {face && <mesh position={[0, 0, .014]}><planeGeometry args={[.66, 1]} />
        <meshPhysicalMaterial key={face.uuid} map={face} color="#ffffff" roughness={.63} clearcoat={.18} /></mesh>}
      {back && <mesh position={[0, 0, -.014]} rotation={[0, Math.PI, 0]}><planeGeometry args={[.66, 1]} />
        <meshPhysicalMaterial key={back.uuid} map={back} color="#ffffff" roughness={.57} clearcoat={.26} /></mesh>}
    </group>
  </group>;
}
function Felt() {
  const [texture, setTexture] = useState(null);
  useEffect(() => {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#173e31'; ctx.fillRect(0, 0, 128, 128);
    // Deterministic authored weave, independent of every game's RNG/outcome.
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const light = ((x * 17 + y * 31) % 11) - 5;
      ctx.fillStyle = `rgba(${light > 0 ? '187,225,204' : '2,20,27'},${Math.abs(light) * .007})`;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.strokeStyle = '#ffffff04'; ctx.lineWidth = .5;
    for (let i = 0; i < 128; i += 3) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke(); }
    const next = new THREE.CanvasTexture(canvas); next.colorSpace = THREE.SRGBColorSpace;
    next.wrapS = next.wrapT = THREE.RepeatWrapping; next.repeat.set(8, 8); next.anisotropy = 8;
    setTexture(next); return () => next.dispose();
  }, []);
  return <mesh position={[0, .10, 0]} scale={[1.48, 1, .98]} receiveShadow>
    <cylinderGeometry args={[2.50, 2.50, .065, 80]} />
    <meshPhysicalMaterial color={texture ? '#ffffff' : C.felt} map={texture} roughness={.93}
      sheen={.22} sheenColor="#849688" sheenRoughness={.9} />
  </mesh>;
}
function TableRing({ radius, y, tube, color, glow = false }) {
  return <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.49, 1, 1]} castShadow>
    <torusGeometry args={[radius, tube, 10, 96]} />
    <meshPhysicalMaterial color={color} metalness={glow ? .62 : .85} roughness={.3} clearcoat={.2}
      emissive={glow ? color : '#000000'} emissiveIntensity={glow ? .08 : 0} />
  </mesh>;
}
function TableMark() {
  const [texture, setTexture] = useState(null);
  useEffect(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, 1024, 512); ctx.textAlign = 'center'; ctx.fillStyle = '#b9dbc8';
    ctx.font = 'bold 70px Arial'; ctx.fillText('MASQ', 512, 210);
    ctx.fillStyle = '#a1bdb1'; ctx.font = '26px Arial'; ctx.fillText('BLACKJACK 3:2  ·  DEALER STANDS ON 17', 512, 278);
    ctx.strokeStyle = '#7b9d91'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(512, 280, 420, 130, 0, .1, Math.PI - .1); ctx.stroke();
    ctx.strokeStyle = '#aec4ae'; ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(512 + side * 300, 190); ctx.lineTo(512 + side * 405, 190); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(512 + side * 290, 190); ctx.lineTo(512 + side * 279, 179);
      ctx.lineTo(512 + side * 267, 190); ctx.lineTo(512 + side * 279, 201); ctx.closePath(); ctx.stroke();
    }
    const next = new THREE.CanvasTexture(canvas); next.colorSpace = THREE.SRGBColorSpace; setTexture(next);
    return () => next.dispose();
  }, []);
  return texture ? <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .137, 0]}>
    <planeGeometry args={[5.2, 2.6]} /><meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} /></mesh> : null;
}
function FitCamera() {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    camera.position.set(0, 8.5, 7.3); camera.lookAt(0, 0, 0);
    camera.zoom = Math.min(size.width / 8.6, size.height / 6.1) * .96;
    camera.updateProjectionMatrix(); invalidate();
  }, [camera, size.width, size.height, invalidate]);
  return null;
}
function World({ view, motion, active }) {
  const player = view.player ?? [], dealer = view.dealer ?? [];
  const renderHand = (cards, side, z) => {
    const spacing = Math.min(.79, 5.7 / Math.max(1, cards.length - 1));
    return cards.map((card, i) => <Card key={`${side}-${i}`} card={card}
      at={[(i - (cards.length - 1) / 2) * spacing, .19 + i * .012, z]}
      dealProgress={motion?.kind === 'deal' && motion.side === side && motion.index === i ? motion.progress : 1}
      flipProgress={motion?.kind === 'flip' && side === 'dealer' && i === 1 ? motion.progress : null} />);
  };
  return <>
    <FitCamera /><FramePump active={active} fps={60} />
    <StudioEnvironment intensity={.4} />
    <ambientLight intensity={.23} /><hemisphereLight args={['#e8e6dd', '#282b2e', .5]} />
    <directionalLight position={[-3, 8, 5]} intensity={2.35} color="#fff4e6" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}
      shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} shadow-normalBias={.035} />
    <directionalLight position={[5, 3, -5]} intensity={.85} color="#c8d2dc" />
    <directionalLight position={[-5, 2, -3]} intensity={.45} color="#d4bfb2" />
    <mesh position={[0, -.10, 0]} scale={[1.5, 1, 1]} castShadow receiveShadow>
      <cylinderGeometry args={[2.65, 2.73, .4, 80]} /><meshPhysicalMaterial color={C.edge} roughness={.4} metalness={.5} clearcoat={.2} /></mesh>
    <TableRing radius={2.68} y={-.17} tube={.025} color={C.cyan} glow />
    <TableRing radius={2.65} y={.025} tube={.024} color={C.silver} />
    <Felt />
    <mesh position={[0, .13, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.49, 1, 1]} castShadow>
      <torusGeometry args={[2.60, .115, 12, 96]} /><meshPhysicalMaterial color="#2b2e30" roughness={.58} metalness={.12} clearcoat={.2} /></mesh>
    <TableRing radius={2.49} y={.16} tube={.018} color={C.gold} />
    <TableRing radius={2.68} y={.14} tube={.017} color={C.silver} />
    <TableMark />
    <group position={[2.9, .21, -1.7]}><mesh castShadow><boxGeometry args={[.77, .23, 1.13]} />
      <meshPhysicalMaterial color={C.edge} roughness={.29} metalness={.65} clearcoat={.4} /></mesh>
      <mesh position={[0, .08, .56]}><boxGeometry args={[.72, .025, .018]} />
        <meshStandardMaterial color={C.cyan} emissive={C.cyan} emissiveIntensity={.08} roughness={.38} metalness={.55} /></mesh>
      <Card card={{ hidden: true }} at={[0, .15, 0]} /></group>
    {[0, 1, 2].map(stack => <group key={stack} position={[-2.85 + stack * .39, .17, 1.2]}>
      {Array.from({ length: 4 }, (_, i) => <group key={i} position={[0, i * .057, 0]}>
        <mesh castShadow><cylinderGeometry args={[.17, .17, .049, 24]} />
          <meshPhysicalMaterial color={stack === 1 ? C.silver : C.red} roughness={.34} metalness={.36} clearcoat={.18} /></mesh>
        <mesh position={[0, .026, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.118, .011, 5, 24]} />
          <meshStandardMaterial color={C.gold} metalness={.82} roughness={.25} /></mesh>
        {[0,1,2,3].map(edge=><mesh key={edge} position={[Math.sin(edge*Math.PI/2)*.15,0,Math.cos(edge*Math.PI/2)*.15]} rotation={[0,edge*Math.PI/2,0]}>
          <boxGeometry args={[.026,.052,.027]}/><meshStandardMaterial color={C.cream} roughness={.44}/>
        </mesh>)}
      </group>)}
    </group>)}
    {renderHand(dealer, 'dealer', -1.02)}{renderHand(player, 'player', 1.12)}
  </>;
}
class ArtBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="art-fallback">Для 3D включите аппаратное ускорение браузера.</div> : this.props.children; }
}
const previewView = { dealer: [{ rank: 10, suit: 'spades' }, { hidden: true }], player: [{ rank: 1, suit: 'spades' }, { rank: 13, suit: 'hearts' }] };
export default function BlackjackScene({ view = null, motion = null, thumbnail = false, visible = true }) {
  const pageVisible = usePageVisible();
  return <div className="blackjack-canvas" aria-hidden="true" style={{ width: '100%', height: '100%', minHeight: 140 }}>
    <ArtBoundary><Canvas orthographic frameloop="demand" shadows="percentage" dpr={[1, thumbnail ? 1.25 : 1.6]}
      camera={{ position: [0, 8.5, 7.3], zoom: 50, near: .1, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} onCreated={({ gl }) => gl.setClearColor(0, 0)}
      fallback={<div className="art-fallback">Браузер не поддерживает WebGL.</div>}>
      <World view={view ?? (thumbnail ? previewView : { player: [], dealer: [] })} motion={motion} active={visible && pageVisible && !!motion} />
    </Canvas></ArtBoundary>
  </div>;
}
