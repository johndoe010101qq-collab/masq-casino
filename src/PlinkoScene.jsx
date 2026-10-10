import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, extend, useFrame, useThree, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PLINKO_MULTIPLIERS } from './game-math.js';
import StudioEnvironment from './StudioEnvironment.jsx';
import { plinkoBallPose } from './plinko-motion.js';

extend({ RoundedBoxGeometry });
const C = { ink: '#14241f', graphite: '#243730', edge: '#a08b65',
  cream: '#f8ebd4', silver: '#cdd3ca', red: '#b65c43', cyan: '#6fbb9b', gold: '#bc9b66' };
const CAMERA = { position: [0, .18, 10], zoom: 60, near: .1, far: 40 };
function Box({ size, at = [0, 0, 0], color = C.graphite, roughness = .4, metalness = .65, bevel = false }) {
  return <mesh position={at} castShadow receiveShadow>{bevel
    ? <roundedBoxGeometry args={[...size, 3, Math.min(...size) * .22]} /> : <boxGeometry args={size} />}
    <meshPhysicalMaterial color={color} roughness={roughness} metalness={metalness} clearcoat={.2} clearcoatRoughness={.35} /></mesh>;
}
function GlowBar({ size, at, color = C.cyan }) {
  return <mesh position={at}><boxGeometry args={size} />
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={.12} roughness={.38} metalness={.6} /></mesh>;
}
function Board({ controller, reduced }) {
  const balls = useRef(), particles = useRef();
  const cabinet = useLoader(THREE.TextureLoader,'/plinko-cabinet.png');
  cabinet.colorSpace = THREE.SRGBColorSpace;
  const bins = useRef([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const flights = controller.getPresentation();
    const effects = controller.getEffects();
    if (balls.current) {
      balls.current.count = flights.length + effects.length;
      flights.forEach((ball, index) => {
        dummy.position.set(...plinkoBallPose(ball.path, ball.progress));
        // Small depth offsets make simultaneous balls visible without changing
        // a single left/right choice, target bin, or mathematical result.
        dummy.position.z += (ball.id % 5) * .004;
        dummy.rotation.set(ball.progress * 8, ball.id, 0);
        dummy.scale.setScalar(1); dummy.updateMatrix();
        balls.current.setMatrixAt(index, dummy.matrix);
      });
      effects.forEach((effect,index) => {
        const p=effect.progress;
        dummy.position.set((effect.bin-4)*.56,-1.79 + (reduced ? 0 : Math.sin(p*Math.PI*4)*.035*Math.exp(-p*7)),.24);
        dummy.rotation.set(0,effect.id,0);
        dummy.scale.setScalar(p<.8?1:Math.max(0,(1-p)/.2)); dummy.updateMatrix();
        balls.current.setMatrixAt(flights.length+index,dummy.matrix);
      });
      balls.current.instanceMatrix.needsUpdate = true;
    }
    bins.current.forEach((material, index) => {
      if (!material) return;
      const landed = effects.find(effect => effect.bin === index);
      material.color.set(landed ? C.red : C.ink);
      material.emissive.set(landed?.won ? '#743127' : '#000000');
      material.emissiveIntensity = landed ? (1 - landed.progress) * 1.2 : 0;
    });
    if (particles.current) {
      const wins = effects.filter(effect => effect.won && !reduced);
      particles.current.count = wins.length * 3;
      wins.forEach((effect, index) => {
        for (let j = 0; j < 3; j++) {
          const p = effect.progress, angle = j * Math.PI * 2 / 3 + effect.id;
          dummy.position.set((effect.bin - 4) * .56 + Math.cos(angle) * p * .42,
            -1.8 + Math.sin(p * Math.PI) * (.5 + j * .13), .36 + Math.sin(angle) * p * .2);
          dummy.rotation.set(p * 8, p * 6, angle);
          dummy.scale.setScalar((1 - p) * .075); dummy.updateMatrix();
          particles.current.setMatrixAt(index * 3 + j, dummy.matrix);
        }
      });
      particles.current.instanceMatrix.needsUpdate = true;
    }
  });
  return <>
    <mesh position={[0,.18,-.09]}><planeGeometry args={[7,5.86]}/><meshBasicMaterial map={cabinet} toneMapped={false}/></mesh>
    {Array.from({ length: 8 }, (_, r) => Array.from({ length: r + 1 }, (_, c) =>
      <group key={r + '-' + c} position={[(c - r / 2) * .56, 1.75 - r * .45, .1]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.05, .05, .20, 20]} />
          <meshBasicMaterial color={C.cream} toneMapped={false} /></mesh>
        <mesh position={[0, 0, -.045]}><torusGeometry args={[.063, .012, 6, 20]} />
          <meshBasicMaterial color="#08161b" /></mesh>
      </group>))}
    {PLINKO_MULTIPLIERS.map((_, i) => <group key={i} position={[(i - 4) * .56, -1.96, 0]}>
      <mesh><boxGeometry args={[.52, .12, .45]} />
        <meshPhysicalMaterial ref={material => { bins.current[i] = material; }} color={C.ink} roughness={.35} metalness={.45} clearcoat={.22} /></mesh>
      <Box size={[.04, .48, .45]} at={[-.265, .18, 0]} color={C.edge} />
      <Box size={[.46, .24, .035]} at={[0, -.005, .221]} color="#202327" roughness={.4} metalness={.36} bevel />
      <GlowBar size={[.43, .016, .012]} at={[0, -.125, .247]} color={i === 0 || i === 8 ? C.gold : C.cyan} />
    </group>)}
    <Box size={[.04, .48, .45]} at={[2.51, -1.78, 0]} color={C.edge} />
    <instancedMesh ref={balls} args={[null, null, 120]} frustumCulled={false} castShadow>
      <sphereGeometry args={[.11, 24, 16]} />
      <meshToonMaterial color={C.cream} />
    </instancedMesh>
    <instancedMesh ref={particles} args={[null, null, 60]} frustumCulled={false}>
      <cylinderGeometry args={[1, 1, .28, 8]} />
      <meshPhysicalMaterial color={C.gold} roughness={.28} metalness={.82} clearcoat={.2} />
    </instancedMesh>
  </>;
}
function CameraAndClock({ controller, onLost, onLayout }) {
  const { camera, size, advance, gl } = useThree();
  useEffect(() => {
    const zoom = Math.max(1, Math.min(size.width / 7.4, size.height / 6.2));
    const render = time => {
      camera.position.set(0, .18, 10); camera.lookAt(0, .18, 0);
      camera.zoom = zoom; camera.updateProjectionMatrix();
      advance(time, true);
    };
    // The live labels use the very same orthographic projection as the bins.
    onLayout?.({width:size.width,height:size.height,zoom});
    controller.setRenderer(render);
    // A static board needs one redraw after Fiber resizes its drawing buffer.
    const resized = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(resized); controller.setRenderer(null); };
  }, [camera, size.width, size.height, advance, controller, onLayout]);
  useEffect(() => {
    const lost = event => { event.preventDefault(); onLost(true); };
    gl.domElement.addEventListener('webglcontextlost', lost);
    return () => gl.domElement.removeEventListener('webglcontextlost', lost);
  }, [gl, onLost]);
  return null;
}
class Boundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="render-fallback">Включите аппаратное ускорение браузера для 3D.</div> : this.props.children; }
}
export default function PlinkoScene({ controller, reduced = false, onLayout }) {
  const [lost, setLost] = useState(false);
  return <Boundary>{lost ? <div className="render-fallback">3D-контекст прерван. Расчёт шаров продолжается.</div> :
    <Canvas orthographic frameloop="never" shadows="percentage" dpr={[1, 1.6]}
      camera={CAMERA}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      fallback={<div className="render-fallback">Браузер не поддерживает WebGL.</div>}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}>
      <StudioEnvironment intensity={.42} />
      <ambientLight intensity={.2} />
      <hemisphereLight args={['#e4e5e5', '#252930', .5]} />
      <directionalLight position={[4, 8, 6]} intensity={2.5} color="#f5f7fa" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}
        shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} shadow-normalBias={.025} />
      <directionalLight position={[-4, 3, -2]} intensity={.9} color="#c7d3df" />
      <directionalLight position={[4, 1, -2]} intensity={.45} color="#d6dce4" />
      <Board controller={controller} reduced={reduced} />
      <CameraAndClock controller={controller} onLost={setLost} onLayout={onLayout} />
    </Canvas>}</Boundary>;
}
