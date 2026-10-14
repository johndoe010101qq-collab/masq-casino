import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { plinkoBallPose } from './plinko-motion.js';
import PlinkoDealer from './PlinkoDealer.jsx';
import PlinkoDealerStation from './PlinkoDealerStation.jsx';
import {plinkoDealerBallPose} from './plinko-dealer-presentation.js';
import {PLINKO_VISUAL_LAYOUT,plinkoVisualPoint} from './plinko-visual-layout.js';
import {ensurePlinkoInstanceCapacity} from './plinko-controller.js';
import { MinecraftPlinkoCabinet,PLINKO_CATCH_LABEL } from './MinecraftClassicArt.jsx';
import { MinecraftStudioMaterials, StudioBackdrop, StudioLights, StudioMaterial, MINECRAFT_STUDIO_PALETTE as C } from './MinecraftStudio.jsx';

const CAMERA = { position: [1.3,1.75,10], zoom: 60, near: .1, far: 40 };

// A contact cue uses only the current path prefix and the existing flight
// clock. It never looks at a bin, prize, stake, or future left/right choice.
export function plinkoContactLighting(flights, reduced = false, levels = new Float32Array(36)) {
  levels.fill(0);
  let entrance = false,shutter=0;
  for (const flight of flights) {
    const progress = Number(flight.progress);
    if (!Number.isFinite(progress) || progress < 0 || progress >= 1) continue;
    const stage = progress * 9;
    if (stage < 1) {
      entrance=true;
      const opening=Math.max(0,Math.min(1,stage/.18,(1-stage)/.25));
      shutter=Math.max(shutter,opening*opening*(3-2*opening));continue;
    }
    if (reduced) continue;
    const row = Math.floor(stage) - 1, phase = stage - row - 1;
    if (row < 0 || row > 7 || phase >= .30) continue;
    const prefix = flight.path[row], column = (prefix + row) / 2;
    if (!Number.isInteger(column) || column < 0 || column > row) continue;
    const index = row * (row + 1) / 2 + column;
    levels[index] = Math.max(levels[index], (1 - phase / .30) ** 2);
  }
  return { pegs: levels, entrance,shutter };
}

function Board({ controller, reduced }) {
  const balls = useRef(), particles = useRef();
  const bins = useRef([]);
  const pegMaterials = useRef([]), entranceMaterial = useRef(null);
  const shutter=useRef(null);
  const contactLevels = useMemo(() => new Float32Array(36), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const flights = controller.getPresentation();
    const effects = controller.getEffects();
    const contacts = plinkoContactLighting(flights, reduced, contactLevels);
    pegMaterials.current.forEach((material,index) => {
      if (material) material.emissiveIntensity = contacts.pegs[index] * .95;
    });
    if (entranceMaterial.current) entranceMaterial.current.emissiveIntensity = contacts.entrance ? .75 : .12;
    if(shutter.current)shutter.current.position.x=.33*contacts.shutter;
    if (balls.current) {
      ensurePlinkoInstanceCapacity(balls.current, flights.length + effects.length);
      balls.current.count = flights.length + effects.length;
      flights.forEach((ball, index) => {
        const entry=plinkoDealerBallPose(ball);
        dummy.position.set(...(entry?.position||plinkoBallPose(ball.path, ball.progress)));
        // Small depth offsets make simultaneous balls visible without changing
        // a single left/right choice, target bin, or mathematical result.
        if(!entry)dummy.position.z += (ball.id % 5) * .004;
        if(entry)dummy.quaternion.fromArray(entry.quaternion);
        else dummy.rotation.set(ball.progress * 8, ball.id, 0);
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
  return <><PlinkoDealerStation/><Suspense fallback={null}><PlinkoDealer controller={controller} reduced={reduced}/></Suspense>
    <group scale={PLINKO_VISUAL_LAYOUT.scale} position={PLINKO_VISUAL_LAYOUT.position}>
    <MinecraftPlinkoCabinet binMaterials={bins} pegMaterials={pegMaterials} entranceMaterial={entranceMaterial} shutter={shutter} showLabels={false}>
    <instancedMesh ref={balls} args={[null, null, 16]} frustumCulled={false} castShadow>
      <icosahedronGeometry args={[.074,1]} />
      <StudioMaterial color="#e1e8dc" kind="ivory" emissive="#a4bea7" intensity={.14} />
    </instancedMesh>
    <instancedMesh ref={particles} args={[null, null, 60]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <StudioMaterial color={C.brass} kind="steel" metalness={.15} />
    </instancedMesh>
  </MinecraftPlinkoCabinet></group></>;
}
export function plinkoBinLabelAnchors(camera,width,height) {
  const project=(x,y,z)=>{
    const point=new THREE.Vector3(...plinkoVisualPoint([x,y,z])).project(camera);return {x:(point.x+1)/2*width,y:(1-point.y)/2*height};
  };
  return Array.from({length:9},(_,index)=>{
    const x=(index-4)*.56,y=PLINKO_CATCH_LABEL.y,z=PLINKO_CATCH_LABEL.z;
    const center=project(x,y,z),left=project(x-PLINKO_CATCH_LABEL.width/2,y,z),right=project(x+PLINKO_CATCH_LABEL.width/2,y,z);
    const top=project(x,y+PLINKO_CATCH_LABEL.height/2,z),bottom=project(x,y-PLINKO_CATCH_LABEL.height/2,z);
    return Object.freeze({...center,width:Math.abs(right.x-left.x),height:Math.abs(bottom.y-top.y)});
  });
}
function CameraAndClock({ controller, onLost, onLayout }) {
  const { camera, size, advance, gl } = useThree();
  useEffect(() => {
    const zoom = Math.max(1, Math.min(size.width / PLINKO_VISUAL_LAYOUT.width, size.height / PLINKO_VISUAL_LAYOUT.height));
    camera.position.set(...CAMERA.position);camera.lookAt(...PLINKO_VISUAL_LAYOUT.target);camera.zoom=zoom;camera.updateProjectionMatrix();camera.updateMatrixWorld();
    const render = time => {
      camera.position.set(...CAMERA.position); camera.lookAt(...PLINKO_VISUAL_LAYOUT.target);
      camera.zoom = zoom; camera.updateProjectionMatrix();camera.updateMatrixWorld();
      advance(time, true);
    };
    // The live labels use the very same orthographic projection as the bins.
    const binAnchors=plinkoBinLabelAnchors(camera,size.width,size.height);
    onLayout?.({width:size.width,height:size.height,zoom,binAnchors,labelWidth:binAnchors[0].width,labelHeight:binAnchors[0].height});
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
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      fallback={<div className="render-fallback">Браузер не поддерживает WebGL.</div>}
      onCreated={({ gl }) => gl.setClearColor(C.black, 1)}>
      <MinecraftStudioMaterials><StudioLights floor={-2.68}/><StudioBackdrop table={false} floor={-2.68}/>
        <Board controller={controller} reduced={reduced} />
        <CameraAndClock controller={controller} onLost={setLost} onLayout={onLayout} />
      </MinecraftStudioMaterials>
    </Canvas>}</Boundary>;
}
