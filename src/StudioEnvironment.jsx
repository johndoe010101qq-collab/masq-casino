import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Local softboxes supply physically filtered reflections to nickel, lacquer
// and ivory. No HDR download, visible backdrop, clock, or gameplay state.
export default function StudioEnvironment({ intensity = .44 }) {
  const { gl, scene, invalidate } = useThree();
  useEffect(() => {
    const previous = scene.environment, previousIntensity = scene.environmentIntensity;
    const room = new RoomEnvironment();
    const generator = new PMREMGenerator(gl);
    const previousTarget = gl.getRenderTarget(), previousCubeFace = gl.getActiveCubeFace();
    const previousMipmap = gl.getActiveMipmapLevel(), previousXR = gl.xr.enabled;
    let target = null;
    try {
      target = generator.fromScene(room, .04, .1, 100, { size: 128 });
      scene.environment = target.texture;
      scene.environmentIntensity = intensity;
      invalidate();
    } catch (failure) {
      target?.dispose(); target = null;
      console.warn('Indictus studio reflections:', failure);
    } finally {
      // PMREM output owns its texture independently of the source/generator.
      gl.setRenderTarget(previousTarget, previousCubeFace, previousMipmap);
      gl.xr.enabled = previousXR;
      room.dispose(); generator.dispose();
    }
    return () => {
      if (target && scene.environment === target.texture) {
        scene.environment = previous;
        scene.environmentIntensity = previousIntensity;
      }
      target?.dispose();
    };
  }, [gl, scene, invalidate, intensity]);
  return null;
}
