import React, { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import StudioEnvironment from './StudioEnvironment.jsx';
import { usePageVisible } from './SceneMotion.jsx';

const NICKEL = '#afb3b5', GRAPHITE = '#45484a', WINE = '#84332e';

function MachinedRing({ radius, y, tube = .012, color = NICKEL, roughness = .33 }) {
  return <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
    <torusGeometry args={[radius, tube, 8, 112]} />
    <meshPhysicalMaterial color={color} metalness={.88} roughness={roughness} clearcoat={.08} />
  </mesh>;
}
function DiamondMark({ y }) {
  const shape = useMemo(() => {
    const mark = new THREE.Shape();
    mark.moveTo(0, .42); mark.lineTo(.32, 0); mark.lineTo(0, -.42); mark.lineTo(-.32, 0); mark.closePath();
    const inset = new THREE.Path();
    inset.moveTo(0, .27); inset.lineTo(-.20, 0); inset.lineTo(0, -.27); inset.lineTo(.20, 0); inset.closePath();
    mark.holes.push(inset); return mark;
  }, []);
  return <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
    <extrudeGeometry args={[shape, { depth: .022, steps: 1, bevelEnabled: true,
      bevelThickness: .006, bevelSize: .006, bevelSegments: 2, curveSegments: 1 }]} />
    <meshPhysicalMaterial color="#c1c3c3" metalness={.92} roughness={.27} clearcoat={.06} />
  </mesh>;
}
function Coin({ position = [0, 0, 0], mark = true }) {
  return <group position={position}>
    <mesh castShadow receiveShadow><cylinderGeometry args={[1.1, 1.1, .16, 112]} />
      <meshPhysicalMaterial color={NICKEL} metalness={.92} roughness={.32} anisotropy={.25} clearcoat={.08} /></mesh>
    <mesh castShadow receiveShadow><cylinderGeometry args={[1.01, 1.01, .171, 112]} />
      <meshPhysicalMaterial color={GRAPHITE} metalness={.78} roughness={.4} anisotropy={.2} /></mesh>
    <MachinedRing radius={1.07} y={.087} tube={.022} />
    <MachinedRing radius={1.025} y={.089} tube={.009} color={WINE} roughness={.5} />
    <MachinedRing radius={.955} y={.09} tube={.008} />
    <MachinedRing radius={.92} y={.09} tube={.004} roughness={.42} />
    <MachinedRing radius={1.07} y={-.087} tube={.022} />
    {Array.from({ length: 80 }, (_, i) => {
      const angle = i * Math.PI * 2 / 80;
      return <mesh key={i} position={[Math.sin(angle) * 1.098, 0, Math.cos(angle) * 1.098]} rotation={[0, angle, 0]}>
        <boxGeometry args={[.019, .13, .013]} />
        <meshStandardMaterial color="#92989c" metalness={.86} roughness={.43} />
      </mesh>;
    })}
    {mark && <DiamondMark y={.089} />}
  </group>;
}
function ProductScene() {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    camera.position.set(0, 1.7, 6); camera.lookAt(0, -.08, 0);
    camera.zoom = Math.max(1, Math.min(size.width / 3.5, size.height / 3.05) * .98);
    camera.updateProjectionMatrix(); invalidate();
  }, [camera, size.width, size.height, invalidate]);
  return <>
    <StudioEnvironment intensity={.5} />
    <ambientLight intensity={.15} />
    <hemisphereLight args={['#e5e6e6', '#222427', .4]} />
    <directionalLight position={[-3, 6, 5]} intensity={2.1} color="#fffaf2" castShadow
      shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-3} shadow-camera-right={3}
      shadow-camera-top={3} shadow-camera-bottom={-3} shadow-normalBias={.025} shadow-radius={4} />
    <directionalLight position={[4, 2, -3]} intensity={.6} color="#d2dae0" />
    <mesh position={[0, -1.14, -.45]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[5.6, 3.7]} />
      <shadowMaterial opacity={.28} />
    </mesh>
    <group position={[.16, -.11, 0]} rotation={[1.22, .12, -.18]}>
      <Coin position={[-.26, -.11, -.17]} />
      <Coin position={[0, .075, 0]} />
    </group>
  </>;
}
class HeroBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="render-fallback">MASQ</div> : this.props.children; }
}

// Static product photography composed entirely from authored 3D geometry.
// The Canvas has no RAF pump, gameplay input, external art, or image texture.
export default function StudioHero({ visible = true }) {
  const pageVisible = usePageVisible();
  return <div className="studio-hero" aria-hidden="true" style={{ width: '100%', height: '100%', minHeight: 160 }}>
    {visible && pageVisible && <HeroBoundary><Canvas orthographic frameloop="demand" shadows="percentage" dpr={[1, 1.5]}
      camera={{ position: [0, 1.7, 6], zoom: 65, near: .1, far: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      fallback={<div className="render-fallback">MASQ</div>}
      onCreated={({ gl }) => gl.setClearColor(0, 0)}>
      <ProductScene />
    </Canvas></HeroBoundary>}
  </div>;
}
