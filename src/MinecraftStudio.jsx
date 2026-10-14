import React, { createContext, useContext, useEffect, useMemo } from 'react';
import * as THREE from 'three';

// Small authored material tiles, sampled without interpolation like the studio
// skin. Their variation is deterministic; lighting still comes from real geometry.
export const MINECRAFT_STUDIO_PALETTE = Object.freeze({
  black: '#0a0d0d', stone: '#1c2021', stoneLight: '#2b2f34', steel: '#8e9399',
  felt: '#1f3b35', feltLight: '#2b5145', ivory: '#e4ebdc', mint: '#9dd9b9',
  brass: '#bca777', red: '#864451', rim: '#376950', screen: '#061b12',
});
const TextureContext = createContext(null);

// Numeric recipes and composition were transcribed from the approved dealer
// studio source. That supplied script is never imported or executed here.
export const BLACKJACK_STUDIO_REFERENCE = Object.freeze({scale:1/16,wallColumns:15,wallRows:6,floorColumns:15,floorRows:7,
  panelX:Object.freeze([-4.5,-2.5,2.5,4.5]),window:Object.freeze({x:26/16,y:32/16,width:3/16,height:48/16}),
  palette:Object.freeze({bg:'#0A0D0D',stone:'#1C2021',panel:'#2B2F34',trim:'#8E9399',leather:'#25282C',window:'#9DB8AE',felt:'#1F3B35',rail:'#1B1D20',apron:'#2A2724'})});

function referenceTexture(kind) {
  const recipes={wall:[16,16,3,'#1C2021'],panel:[16,16,5,'#2B2F34'],floor:[16,16,9,'#1A1D20'],trim:[8,2,13,'#8E9399'],leather:[16,16,15,'#25282C'],window:[8,48,17,'#9DB8AE'],felt:[16,16,23,'#1F3B35'],rail:[16,4,25,'#1B1D20'],apron:[16,16,27,'#2A2724']};
  const [width,height,seed,hex]=recipes[kind],base=parseInt(hex.slice(1),16),rgb=[base>>16,(base>>8)&255,base&255];
  const data=new Uint8Array(width*height*4);let state=seed;
  const random=()=>((state=(state*16807)%2147483647)/2147483647);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const r=random();let k;
    if(kind==='wall'){k=.9+r*.14;if(y%8===7)k=.7;if((x+(y>>3)*5)%16===0&&y%8!==7)k=.78;}
    else if(kind==='panel'){k=.94+r*.08;if(x===0||y===0)k=1.12;if(x===15||y===15)k=.72;}
    else if(kind==='floor'){k=.9+r*.10;if(x===0||y===0)k=.72;}
    else if(kind==='trim')k=(y?.82:1.06)+r*.06;
    else if(kind==='leather'){k=.9+r*.12;if((x===4||x===11)&&y%2)k=.74;}
    else if(kind==='window')k=.55+.4*Math.sin(y/47*Math.PI)+r*.08-(x===0||x===7?.25:0)-(y%12===0?.30:0);
    else if(kind==='felt')k=.93+r*.1;
    else if(kind==='rail'){k=.9+r*.1;if(y===0)k=1.25;if(x%8===7)k*=.78;}
    else k=.9+r*.1-(y%4===3?.12:0);
    // Typed texture rows are stored bottom-up, matching the source CanvasTexture
    // with flipY=true rather than reversing its panel seams and window bars.
    const offset=((height-1-y)*width+x)*4;rgb.forEach((value,index)=>{data[offset+index]=Math.max(0,Math.min(255,Math.round(value*k)));});data[offset+3]=255;
  }
  const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.generateMipmaps=false;texture.needsUpdate=true;return texture;
}
export const makeBlackjackStudioTexture=referenceTexture;

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
  const maps=useMemo(()=>Object.fromEntries([
    ...['stone','felt','steel','ivory'].map(kind=>[kind,materialTile(kind)]),
    ...['wall','panel','floor','trim','leather','window','felt','rail','apron'].map(kind=>['reference-'+kind,referenceTexture(kind)])
  ]),[]);
  useEffect(() => () => Object.values(maps).forEach(map => map.dispose()), [maps]);
  return <TextureContext.Provider value={maps}>{children}</TextureContext.Provider>;
}

export function StudioMaterial({ color = MINECRAFT_STUDIO_PALETTE.stone, kind = 'stone', emissive = '#000000', intensity = 0, metalness = .03, roughness = .92, ...props }) {
  const maps = useContext(TextureContext);
  if(kind.startsWith('reference-'))return <meshLambertMaterial color={color||'#ffffff'} map={maps?.[kind]||null} emissive={emissive} emissiveIntensity={intensity} {...props}/>;
  return <meshStandardMaterial color={color} map={maps?.[kind] || null} roughness={roughness} metalness={metalness}
    emissive={emissive} emissiveIntensity={intensity} flatShading {...props} />;
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

export function blackjackStudioLighting(floor=-1.78) {
  return {
    ambient:{color:'#9aa3ad',intensity:.36},camera:{color:'#e6ebe8',intensity:.14,position:[0,4,10]},
    key:{name:'approved-studio-key',color:'#e2ebe7',intensity:520/16,distance:280/16,angle:.32,penumbra:.8,decay:1,position:[-34/16,74/16+floor,96/16],target:[0,.20,.25]},
    rim:{name:'approved-studio-rim',color:'#6fa89a',intensity:2.4,position:[40/16,36/16+floor,-60/16]},
    rim2:{name:'approved-studio-rim-secondary',color:'#5f8f84',intensity:1.1,position:[-44/16,40/16+floor,-50/16]},
    fill:{name:'approved-studio-fill',color:'#b9c2cc',intensity:.22,position:[30/16,10/16+floor,60/16]},
    wall:{name:'approved-studio-wall-glow',color:'#79a99b',intensity:70/16,distance:110/16,decay:1,position:[20/16,30/16+floor,-14/16-1.175]},
    wallBounce:{name:'studio-wall-bounce',color:'#9eada8',intensity:2.0,distance:6.5,decay:1,position:[-2.8,floor+2.4,-1.65]},
    cabinetFill:{name:'studio-cabinet-front-fill',color:'#b5c3c5',intensity:.74,position:[-3,2.5,6]},
    table:{name:'approved-studio-felt-pool',color:'#cfe0d8',intensity:260/16,distance:120/16,angle:.62,penumbra:.95,decay:1,position:[0,62/16+floor,26/16],target:[0,floor+.5825,.10]}
  };
}

export function StudioLights({shadows=true,floor=-1.78}) {
  const lights=useMemo(()=>blackjackStudioLighting(floor),[floor]);
  const targets=useMemo(()=>{
    const key=new THREE.Object3D(),table=new THREE.Object3D(),rim=new THREE.Object3D();
    key.position.set(...lights.key.target);table.position.set(...lights.table.target);rim.position.set(0,floor,0);
    return {key,table,rim};
  },[floor,lights]);
  return <>
    <primitive object={targets.key}/><primitive object={targets.table}/><primitive object={targets.rim}/>
    <ambientLight {...lights.ambient}/><directionalLight {...lights.camera}/>
    <spotLight {...lights.key} target={targets.key} castShadow={shadows}
      shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-radius={3} shadow-bias={-.00015} shadow-normalBias={.004}/>
    <directionalLight {...lights.rim} target={targets.rim}/><directionalLight {...lights.rim2} target={targets.rim}/>
    <directionalLight {...lights.fill} target={targets.rim}/><pointLight {...lights.wall}/><pointLight {...lights.wallBounce}/>
    {floor<-2&&<directionalLight {...lights.cabinetFill} target={targets.key}/>}
    <spotLight {...lights.table} target={targets.table}/>
  </>;
}

export function blackjackStudioBlocks(floor=-1.78,back=-3.3) {
  const zShift=back+34/16,wall=[],ground=[],panels=[],trims=[];
  for(let ix=-7;ix<=7;ix++)for(let iz=-2;iz<=4;iz++)ground.push([1,1,1,ix,floor-.5,iz-10/16+zShift]);
  for(let ix=-7;ix<=7;ix++)for(let iy=0;iy<6;iy++)wall.push([1,1,1,ix,floor+iy+.5,back]);
  for(const side of [-1,1])for(const x of [40,72]) {
    panels.push([14/16,52/16,1.2/16,side*x/16,30/16+floor,-25.6/16+zShift]);
    trims.push([14.4/16,.6/16,1.4/16,side*x/16,56.3/16+floor,-25.5/16+zShift]);
  }
  panels.push([160/16,3/16,2/16,0,1.5/16+floor,-25.2/16+zShift]);
  return {wall,ground,panels,trims,zShift};
}

function ReferenceBatch({name,boxes,kind}) {
  const scratch=useMemo(()=>({matrix:new THREE.Matrix4(),rotation:new THREE.Quaternion(),position:new THREE.Vector3(),scale:new THREE.Vector3()}),[]);
  return <instancedMesh name={name} args={[null,null,boxes.length]} castShadow receiveShadow ref={mesh=>{
    if(!mesh)return;
    boxes.forEach(([w,h,d,x,y,z],index)=>{scratch.position.set(x,y,z);scratch.scale.set(w,h,d);scratch.matrix.compose(scratch.position,scratch.rotation,scratch.scale);mesh.setMatrixAt(index,scratch.matrix);});
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
  }}><boxGeometry args={[1,1,1]}/><StudioMaterial color="#ffffff" kind={'reference-'+kind}/></instancedMesh>;
}

function TiledReferenceBlock({size,at,kind,name}) {
  const [w,h,d]=size;
  const geometry=useMemo(()=>{
    const g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv,n=g.attributes.normal;
    for(let index=0;index<uv.count;index++) {
      const ax=Math.abs(n.getX(index)),ay=Math.abs(n.getY(index));
      const [a,b]=ax>.5?[d,h]:ay>.5?[w,d]:[w,h];uv.setXY(index,uv.getX(index)*a,uv.getY(index)*b);
    }
    return g;
  },[w,h,d]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} position={at} name={name} castShadow receiveShadow><StudioMaterial color="#ffffff" kind={'reference-'+kind}/></mesh>;
}

export function StudioBackdrop({table=true,floor=-1.78,back=-3.3}) {
  const layout=useMemo(()=>blackjackStudioBlocks(floor,back),[floor,back]);
  const maps=useContext(TextureContext),feltTop=floor+.5825;
  const tableColumns=useMemo(()=>{
    const columns=[],R=4,step=.25,zBack=-2.4;
    for(let x0=-R;x0<R;x0+=step) {
      const x=x0+step/2,zFront=Math.round((1.7+.8*Math.sqrt(Math.max(0,1-(x/R)**2)))*32)/32;
      columns.push({x,zFront,zBack});
    }
    return columns;
  },[]);
  return <group name="approved-blackjack-studio-port">
    <ReferenceBatch name="approved-studio-wall-volumes" boxes={layout.wall} kind="wall"/>
    <ReferenceBatch name="approved-studio-floor-volumes" boxes={layout.ground} kind="floor"/>
    <ReferenceBatch name="approved-studio-acoustic-panels" boxes={layout.panels} kind="panel"/>
    <ReferenceBatch name="approved-studio-panel-trim" boxes={layout.trims} kind="trim"/>
    <StudioBlock size={[4.2/16,49.2/16,.8/16]} at={[26/16,32/16+floor,-25.8/16+layout.zShift]} color="#5a5e63" kind="reference-trim"/>
    <mesh name="approved-vertical-frosted-strip" position={[26/16,32/16+floor,-25.4/16+layout.zShift]}>
      <boxGeometry args={[3/16,48/16,.6/16]}/><meshBasicMaterial map={maps?.['reference-window']} color={new THREE.Color(1,1,1).multiplyScalar(.42)} toneMapped={false}/>
    </mesh>
    {table&&<group name="approved-stepped-felt-table">
      {tableColumns.map(({x,zFront,zBack},index)=><group key={index}>
        <TiledReferenceBlock name="felt-column" size={[.25,.10,zFront-zBack]} at={[x,feltTop-.05,(zFront+zBack)/2]} kind="felt"/>
        <TiledReferenceBlock name="apron-column" size={[.25,.48,Math.max(.1,zFront-zBack-.375)]} at={[x,floor+.25,(zFront+zBack)/2-.0625]} kind="apron"/>
        <TiledReferenceBlock name="padded-rail-column" size={[.25125,.125,.1875]} at={[x,feltTop+.0125,zFront+.08125]} kind="rail"/>
        <StudioBlock size={[.25125,.01875,.01875]} at={[x,feltTop-.05625,zFront+.178125]} color="#ffffff" kind="reference-trim"/>
      </group>)}
      <TiledReferenceBlock name="dealer-edge" size={[8,.075,.075]} at={[0,feltTop-.025,-2.425]} kind="rail"/>
    </group>}
  </group>;
}
