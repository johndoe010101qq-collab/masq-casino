import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { plinkoBallPose } from './plinko-motion.js';
import { MINECRAFT_PLINKO_GEOMETRY } from './minecraft-classic-motion.js';
import { MinecraftPlinkoCabinet } from './MinecraftClassicArt.jsx';
import { MinecraftStudioMaterials, StudioBackdrop, StudioLights, StudioMaterial, MINECRAFT_STUDIO_PALETTE as C } from './MinecraftStudio.jsx';

const CAMERA = { position: [0, .18, 10], zoom: 60, near: .1, far: 40 };
function Board({ controller, reduced }) {
  const balls = useRef(), particles = useRef();
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
      material.color.set(landed ? landed.won ? C.feltLight : C.red : C.black);
      material.emissive.set(landed?.won ? '#296342' : '#000000');
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
  return <MinecraftPlinkoCabinet binMaterials={bins} showLabels={false}>
    <instancedMesh ref={balls} args={[null, null, 120]} frustumCulled={false} castShadow>
      <boxGeometry args={MINECRAFT_PLINKO_GEOMETRY.ball} />
      <StudioMaterial color={C.ivory} kind="ivory" />
    </instancedMesh>
    <instancedMesh ref={particles} args={[null, null, 60]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <StudioMaterial color={C.brass} kind="steel" metalness={.15} />
    </instancedMesh>
  </MinecraftPlinkoCabinet>;
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
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
      fallback={<div className="render-fallback">Браузер не поддерживает WebGL.</div>}
      onCreated={({ gl }) => gl.setClearColor(C.black, 1)}>
      <MinecraftStudioMaterials><StudioLights /><StudioBackdrop table={false} floor={-2.68} />
        <Board controller={controller} reduced={reduced} />
        <CameraAndClock controller={controller} onLost={setLost} onLayout={onLayout} />
      </MinecraftStudioMaterials>
    </Canvas>}</Boundary>;
}
