import React, { createContext, useContext, useEffect, useMemo } from 'react';
import * as THREE from 'three';

// Small authored material tiles, sampled without interpolation like the studio
// skin. Their variation is deterministic; lighting still comes from real geometry.
export const MINECRAFT_STUDIO_PALETTE = Object.freeze({
  black: '#09120f', stone: '#182723', stoneLight: '#243830', steel: '#546861',
  felt: '#173e32', feltLight: '#235440', ivory: '#e4ebdc', mint: '#9dd9b9',
  brass: '#bca777', red: '#864451', rim: '#376950', screen: '#061b12',
});
const TextureContext = createContext(null);

function materialTile(kind) {
  const width = 16, data = new Uint8Array(width * width * 4);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    let value = 245;
    if (kind === 'stone') {
      value = x === 0 || y === 0 ? 161 : x === 15 || y === 15 ? 221 : 193;
      if ((y === 4 && x > 2 && x < 10) || (y === 11 && x > 7 && x < 14)) value = 183;
      if ((x === 5 && y > 7 && y < 12) || (x === 12 && y > 2 && y < 5)) value = 211;
    } else if (kind === 'felt') value = (x + y) % 4 === 0 ? 224 : x % 3 === 0 && y % 3 === 0 ? 233 : 248;
    else if (kind === 'steel') value = y === 0 ? 252 : y === 15 ? 171 : y < 3 ? 226 : 213;
    else if (kind === 'ivory') value = x === 0 || y === 0 ? 218 : x === 15 || y === 15 ? 198 : 246;
    const i = (y * width + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = value; data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, width, width, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = false; texture.needsUpdate = true;
  return texture;
}

export function MinecraftStudioMaterials({ children }) {
  const maps = useMemo(() => Object.fromEntries(['stone', 'felt', 'steel', 'ivory'].map(kind => [kind, materialTile(kind)])), []);
  useEffect(() => () => Object.values(maps).forEach(map => map.dispose()), [maps]);
  return <TextureContext.Provider value={maps}>{children}</TextureContext.Provider>;
}

export function StudioMaterial({ color = MINECRAFT_STUDIO_PALETTE.stone, kind = 'stone', emissive = '#000000', intensity = 0, metalness = .03, roughness = .92 }) {
  const maps = useContext(TextureContext);
  return <meshStandardMaterial color={color} map={maps?.[kind] || null} roughness={roughness} metalness={metalness}
    emissive={emissive} emissiveIntensity={intensity} flatShading />;
}

export function StudioBlock({ size, at = [0, 0, 0], rotation, color, kind = 'stone', emissive, intensity, metalness, roughness, ...props }) {
  return <mesh position={at} rotation={rotation} castShadow receiveShadow {...props}><boxGeometry args={size} />
    <StudioMaterial color={color} kind={kind} emissive={emissive} intensity={intensity} metalness={metalness} roughness={roughness} /></mesh>;
}

export const PIXEL_MASK = Object.freeze([
  '........', '..IIII..', 'IDDIIDDI', 'IIIIIIII', 'DIIDDIID', 'IDDSSDDI', 'IIIDDIII', '.SSDDSS.',
]);

export function PixelMask({ size = 1, at = [0, 0, 0], depth = .04, color = MINECRAFT_STUDIO_PALETTE.ivory }) {
  const unit = size / 8;
  return <group position={at} name="anonymous-pixel-mask">
    {PIXEL_MASK.flatMap((row, y) => [...row].map((cell, x) => cell === '.' ? null :
      <StudioBlock key={x + '-' + y} size={[unit, unit, depth]} at={[(x - 3.5) * unit, (3.5 - y) * unit, cell === 'D' ? -depth * .24 : 0]}
        color={cell === 'D' ? '#0a1710' : cell === 'S' ? '#a69b85' : color} kind={cell === 'D' ? 'none' : 'ivory'} />))}
  </group>;
}

export function StudioLights({ shadows = true }) {
  return <>
    <ambientLight intensity={.36} />
    <hemisphereLight args={['#b8d8c8', '#0a110e', .75]} />
    <directionalLight position={[-3, 7, 5]} color="#ebf0e2" intensity={2.6} castShadow={shadows}
      shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-6} shadow-camera-right={6}
      shadow-camera-top={7} shadow-camera-bottom={-4} shadow-normalBias={.018} />
    <directionalLight position={[4, 3, -3]} color="#60b58a" intensity={1.05} />
    <pointLight position={[-3, .8, -2.4]} color="#75dca7" intensity={8} distance={8} decay={2} />
  </>;
}

export function StudioBackdrop({ table = true, width = 11.4, floor = -1.78, back = -3.3 }) {
  const C = MINECRAFT_STUDIO_PALETTE;
  return <group name="minecraft-private-table-studio">
    <StudioBlock size={[width + 3, .4, 10]} at={[0, floor - .25, .3]} color={C.black} />
    <StudioBlock size={[width + 2, 7, .35]} at={[0, 1.3, back - .22]} color={C.black} kind="none" />
    {Array.from({ length: 6 }, (_, row) => Array.from({ length: 11 }, (_, column) => {
      const x = (column - 5) * 1.08 + (row % 2) * .16;
      return <StudioBlock key={row + '-' + column} size={[1.02, .88, .20]} at={[x, floor + .52 + row * .94, back]}
        color={(column + row) % 5 === 0 ? '#20322c' : C.stone} />;
    }))}
    <StudioBlock size={[width, .085, .22]} at={[0, 2.77, back + .18]} color="#abc2b6" kind="none" emissive="#a3d1ba" intensity={.18} />
    <StudioBlock size={[width, .035, .25]} at={[0, floor + .21, back + .24]} color={C.rim} kind="none" emissive="#3aaa6b" intensity={.42} />
    {[-1, 1].map(side => <group key={side}>
      <StudioBlock size={[.48, 6.7, .65]} at={[side * width / 2, 1.3, back + .2]} color={C.black} />
      <StudioBlock size={[.07, 6.2, .065]} at={[side * (width / 2 - .2), 1.35, back + .56]} color={C.rim} />
    </group>)}
    {table && <group>
      <StudioBlock size={[8.1, .35, 5.1]} at={[0, floor + .36, .1]} color={C.black} />
      <StudioBlock size={[7.83, .045, 4.83]} at={[0, floor + .56, .1]} color={C.felt} kind="felt" />
      <StudioBlock size={[7.98, .08, .14]} at={[0, floor + .60, 2.58]} color={C.steel} kind="steel" />
      {[-1, 1].map(side => <StudioBlock key={side} size={[.14, .12, 4.98]} at={[side * 3.99, floor + .6, .1]} color={C.steel} kind="steel" />)}
      <StudioBlock size={[6.8, .055, .09]} at={[0, floor + .06, 2.65]} color={C.rim} kind="none" emissive="#3a9460" intensity={.35} />
    </group>}
  </group>;
}
