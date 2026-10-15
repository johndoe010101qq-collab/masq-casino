import {ROULETTE_NUMBERS,rouletteColor} from './game-math.js';

const TAU=Math.PI*2;
export const ROULETTE_WHEEL_V48=Object.freeze({
  center:Object.freeze([0,14.5,4.6]),outerRadius:11.02,baseY:11.20,
  trackRadius:9,trackY:16.19,trackSurfaceY:15.77,
  pocketRadius:5.25,pocketY:14.92,pocketSurfaceY:14.50,
  numberRadius:6.35,numberY:15,ballRadius:.42,
  pocketInner:4.60,pocketOuter:5.90,separatorWidth:.040,
  numbers:Object.freeze([...ROULETTE_NUMBERS]),triangleLimit:25000,
});

const RGB={red:[111,32,42],black:[20,28,25],green:[29,94,65]};
const hash=(x,y,seed)=>{
  let value=Math.imul(x+seed*73,374761393)^Math.imul(y+seed*19,668265263);
  value=Math.imul(value^(value>>>13),1274126177);return ((value^(value>>>16))>>>0)/4294967295;
};

/** Closed annular solid with hard edges, top-down UVs and a real floor.
 * Pockets share this geometry as37 instances, rather than37 new meshes. */
function annularSolid(THREE,inner,outer,top,bottom,start,end,segments){
  const positions=[],uvs=[],span=end-start,point=(r,a,y)=>[Math.sin(a)*r,y,Math.cos(a)*r];
  const triangle=(a,b,c)=>{for(const p of [a,b,c]){positions.push(...p);uvs.push(.5+p[0]/14,.5-p[2]/14);}};
  const quad=(a,b,c,d)=>{triangle(a,b,c);triangle(a,c,d);};
  for(let i=0;i<segments;i++){
    const a=start+span*i/segments,b=start+span*(i+1)/segments;
    const ti=point(inner,a,top),to=point(outer,a,top),bi=point(inner,b,top),bo=point(outer,b,top);
    const li=point(inner,a,bottom),lo=point(outer,a,bottom),ri=point(inner,b,bottom),ro=point(outer,b,bottom);
    quad(ti,to,bo,bi);quad(ri,ro,lo,li);quad(li,ti,bi,ri);quad(lo,ro,bo,to);
    if(i===0&&span<TAU-1e-6)quad(li,lo,to,ti);
    if(i===segments-1&&span<TAU-1e-6)quad(ro,ri,bi,bo);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.computeVertexNormals();return geometry;
}

function surfaceYAtRadius(radius){
  // Continuous conservative support for the ball's authored5.25..9 path.
  // Hold the track/band heights slightly beyond an edge while the sphere
  // still overlaps it, then lower it smoothly. The caller adds radius.42.
  // These are support transitions, not replacements for the physical floors.
  const smooth=t=>{const q=Math.max(0,Math.min(1,t));return q*q*q*(10+q*(-15+6*q));};
  const mix=(a,b,t)=>a+(b-a)*smooth(t);
  const r=Number.isFinite(radius)?radius:5.25;
  if(r>=10.34)return 16.705;
  if(r>9.06)return mix(15.77,16.705,(r-9.06)/1.28);
  if(r>=8.00)return 15.77;
  if(r>7.40)return mix(15.10,15.77,(r-7.40)/.60);
  if(r>6.35)return mix(15.00,15.10,(r-6.35)/1.05);
  if(r>=5.75)return 15.00;
  if(r>5.25)return mix(14.50,15.00,(r-5.25)/.50);
  return 14.50;
}

/** No renderer, animation loop, elapsed time, accepted round or RNG lives here.
 * The caller rotates `rotor.rotation.y` and positions its accepted ball through
 * the same locked film camera. All units remain the supplied skin-pixel world. */
export function buildRouletteWheel(THREE,options={}){
  if(!THREE?.Group||!THREE?.LatheGeometry)throw new TypeError('Three.js is required');
  const geometries=new Set(),materials=new Set(),textures=new Set();
  const ownGeometry=geometry=>{geometries.add(geometry);return geometry;};
  const ownMaterial=material=>{materials.add(material);return material;};
  const ownTexture=texture=>{textures.add(texture);return texture;};
  const root=new THREE.Group();root.name='roulette-wheel-v48';root.position.set(...ROULETTE_WHEEL_V48.center);
  const rotor=new THREE.Group();rotor.name='roulette-rotor-v48';root.add(rotor);
  const parts={};
  const standard=parameters=>ownMaterial(new THREE.MeshStandardMaterial(parameters));
  const lathe=(profile,segments=128)=>{
    // Closed profiles must run counter-clockwise in radius/height space.
    // This makes every visible bowl/track face point out of the solid.
    const area=profile.reduce((sum,p,i)=>{const q=profile[(i+1)%profile.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
    const ordered=area<0?[...profile].reverse():profile;
    return ownGeometry(new THREE.LatheGeometry(ordered.map(([r,y])=>new THREE.Vector2(r,y)),segments));
  };
  const mesh=(name,geometry,material,parent=root)=>{
    const object=new THREE.Mesh(geometry,material);object.name=name;object.castShadow=true;object.receiveShadow=true;
    parent.add(object);parts[name]=object;return object;
  };

  function grain(kind){
    const width=128,height=128,data=new Uint8Array(width*height*4),bump=new Uint8Array(data.length);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const fine=hash(x,y,kind==='wood'?71:89),block=hash(Math.floor(x/8),Math.floor(y/8),12);
      const streak=Math.sin(y*.24+Math.sin(x*.075)*1.3+Math.sin(x*.17)*.35);
      const variation=kind==='wood'?1+.055*streak+.055*(fine-.5)+.025*(block-.5):.94+.08*fine;
      const base=kind==='wood'?[62,43,30]:[255,255,255],i=(y*width+x)*4;
      for(let channel=0;channel<3;channel++){data[i+channel]=Math.round(base[channel]*variation);bump[i+channel]=Math.round(128+20*streak+9*(fine-.5));}
      data[i+3]=bump[i+3]=255;
    }
    const texture=ownTexture(new THREE.DataTexture(data,width,height,THREE.RGBAFormat));
    texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
    const relief=ownTexture(new THREE.DataTexture(bump,width,height,THREE.RGBAFormat));
    relief.wrapS=relief.wrapT=THREE.RepeatWrapping;relief.magFilter=THREE.LinearFilter;relief.needsUpdate=true;
    return {map:texture,bumpMap:relief};
  }
  const woodGrain=grain('wood'),pocketGrain=grain('pocket');
  const wood=standard({...woodGrain,color:0xffffff,roughness:.57,metalness:.035,bumpScale:.026});
  const darkWood=standard({...woodGrain,color:0xafa799,roughness:.68,metalness:.025,bumpScale:.018});
  const trackMaterial=standard({color:0x27332e,metalness:.56,roughness:.31});
  const agedBrass=standard({color:0x867e64,metalness:.78,roughness:.46});
  const edgeMetal=standard({color:0x536257,metalness:.70,roughness:.34});
  const fretMaterial=standard({color:0x7f8d7d,metalness:.79,roughness:.29});
  const pocketMaterial=standard({map:pocketGrain.map,color:0xffffff,roughness:.70,metalness:.045});

  // One continuous turned shell. Its lower plinth covers the supplied film's
  // former block-base silhouette; the interior is genuinely hollow above-.65.
  const bowlProfile=[[0,-3.30],[10.37,-3.30],[10.62,-3.23],[10.83,-3.04],[10.98,-2.72],
    [11.02,-2.43],[11.02,-1.82],[10.97,-1.52],[10.84,-1.15],
    [10.84,-.55],[10.72,-.42],[10.71,-.33],[10.81,-.24],[10.80,.72],
    [10.77,1.34],[10.68,1.86],[10.55,2.12],[10.34,2.16],[10.12,2.08],
    [9.94,1.95],[9.73,1.66],[9.61,1.45],[9.44,1.245],[8.20,1.245],
    [8.09,.89],[7.72,.60],[6.84,.50],[6.84,-.65],[0,-.65],[0,-3.30]];
  const bowlGeometry=lathe(bowlProfile),bowlColor=[];
  for(let i=0;i<bowlGeometry.attributes.position.count;i++){
    const y=bowlGeometry.attributes.position.getY(i),q=Math.max(0,Math.min(1,(y+.48)/.28));
    const blend=q*q*(3-2*q);
    bowlColor.push(.13+.87*blend,.16+.84*blend,.17+.83*blend);
  }
  bowlGeometry.setAttribute('color',new THREE.Float32BufferAttribute(bowlColor,3));
  const bowlWood=ownMaterial(wood.clone());bowlWood.vertexColors=true;
  const bowl=mesh('roulette-bowl',bowlGeometry,bowlWood);
  mesh('roulette-lower-foot',lathe([[10.18,-3.29],[10.40,-3.31],[10.62,-3.25],[10.64,-3.19],[10.37,-3.17],[10.18,-3.29]],96),darkWood);
  mesh('roulette-fine-rim',lathe([[9.96,1.97],[10.13,2.115],[10.34,2.205],[10.55,2.17],
    [10.61,2.11],[10.55,2.07],[10.33,2.125],[10.15,2.045],[9.96,1.97]]),agedBrass);
  // The centreline at r9 is exactly15.77, so a radius.42 ball rests at16.19.
  const track=mesh('roulette-ball-track',lathe([[8.18,1.14],[8.24,1.23],[8.52,1.27],[9.06,1.27],
    [9.29,1.30],[9.47,1.37],[9.62,1.49],[9.66,1.46],[9.50,1.30],[9.31,1.20],[8.18,1.14]]),trackMaterial);
  mesh('roulette-track-inner-lip',lathe([[8.13,1.16],[8.18,1.25],[8.23,1.27],[8.26,1.24],[8.18,1.16],[8.13,1.16]],96),edgeMetal);

  // Small slanted deflectors replace the old oversized grey blocks. They are
  // outside the track centreline and do not intercept the filmed hand release.
  const diamondGeometry=ownGeometry(new THREE.ConeGeometry(.16,.40,4));
  const diamonds=new THREE.InstancedMesh(diamondGeometry,agedBrass,8);diamonds.name='roulette-apron-deflectors';
  const transform=new THREE.Object3D();
  for(let i=0;i<8;i++){
    const a=i*TAU/8+.2;transform.position.set(Math.sin(a)*7.5,.73,Math.cos(a)*7.5);
    transform.rotation.set(.12,a+Math.PI/4,.22);transform.scale.set(.8,1,1.5);transform.updateMatrix();diamonds.setMatrixAt(i,transform.matrix);
  }
  diamonds.castShadow=diamonds.receiveShadow=true;root.add(diamonds);parts.deflectors=diamonds;

  const numberColorTexture=makeNumberTexture();
  const numberMaterial=standard({map:numberColorTexture,color:0xffffff,roughness:.67,metalness:.055});
  const numberBand=mesh('roulette-number-band',ownGeometry(annularSolid(THREE,5.90,6.80,.50,.06,0,TAU,148)),numberMaterial,rotor);
  mesh('roulette-number-edge',lathe([[6.80,.48],[6.84,.49],[6.87,.46],[6.84,.43],[6.80,.44],[6.80,.48]],96),agedBrass,rotor);
  mesh('roulette-number-inner-edge',lathe([[5.89,.07],[5.89,.49],[5.92,.50],[5.94,.47],[5.93,.06],[5.89,.07]],96),edgeMetal,rotor);

  const gap=.004,half=TAU/74-gap;
  const floorGeometry=ownGeometry(annularSolid(THREE,4.60,5.90,0,-.09,-half,half,6));
  const pockets=new THREE.InstancedMesh(floorGeometry,pocketMaterial,37);pockets.name='roulette-pocket-floors';
  const pocketColors=[];
  for(let index=0;index<37;index++){
    const a=index*TAU/37;transform.position.set(0,0,0);transform.rotation.set(0,a,0);transform.scale.set(1,1,1);transform.updateMatrix();
    pockets.setMatrixAt(index,transform.matrix);const color=new THREE.Color(...RGB[rouletteColor(ROULETTE_NUMBERS[index])].map(v=>v/255));
    color.convertSRGBToLinear();pockets.setColorAt(index,color);pocketColors.push(color.clone());
  }
  pockets.castShadow=pockets.receiveShadow=true;rotor.add(pockets);parts.pockets=pockets;

  // Width.040 including bevel leaves>.005 clearance to an accepted.42 ball
  // at every pocket centre. The film's former.16-wide blocks could not fit it.
  const shape=new THREE.Shape();shape.moveTo(-.016,0);shape.lineTo(.016,0);shape.lineTo(.016,.43);shape.lineTo(-.016,.43);shape.closePath();
  const separatorGeometry=ownGeometry(new THREE.ExtrudeGeometry(shape,{depth:1.30,steps:1,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:1,curveSegments:1}));
  separatorGeometry.translate(0,0,-.65);
  const separators=new THREE.InstancedMesh(separatorGeometry,fretMaterial,37);separators.name='roulette-pocket-separators';
  for(let i=0;i<37;i++){
    const a=(i+.5)*TAU/37;transform.position.set(Math.sin(a)*5.25,0,Math.cos(a)*5.25);
    transform.rotation.set(0,a,0);transform.updateMatrix();separators.setMatrixAt(i,transform.matrix);
  }
  separators.castShadow=separators.receiveShadow=true;rotor.add(separators);parts.separators=separators;
  mesh('roulette-pocket-inner-wall',lathe([[4.32,-.1],[4.32,.47],[4.40,.55],[4.53,.55],[4.60,.47],[4.60,-.1],[4.32,-.1]],96),edgeMetal,rotor);

  const cone=mesh('roulette-rotor-cone',lathe([[0,.10],[4.32,.10],[4.30,.34],[4.11,.43],[3.78,.53],
    [3.18,.83],[2.43,1.20],[1.50,1.58],[.87,1.77],[0,1.77]],96),wood,rotor);
  // Rounded weighted cross shares the old cross envelope to occlude its baked
  // silhouette, while replacing the grey cubes with a crafted dark-metal hub.
  const hub=mesh('roulette-spindle',lathe([[0,1.55],[.77,1.55],[.80,1.70],[.73,1.92],[.72,2.65],
    [.81,2.85],[.79,3.04],[.61,3.18],[0,3.18]],48),edgeMetal,rotor);
  const crossGeometry=ownGeometry(new THREE.CylinderGeometry(.34,.34,4.40,16,1));
  const crossX=mesh('roulette-spindle-cross-x',crossGeometry,agedBrass,rotor);crossX.position.y=3.1;crossX.rotation.z=Math.PI/2;
  const crossZ=mesh('roulette-spindle-cross-z',crossGeometry,agedBrass,rotor);crossZ.position.y=3.1;crossZ.rotation.x=Math.PI/2;
  const endGeometry=ownGeometry(new THREE.SphereGeometry(.58,12,8));
  for(const [index,position]of [[-2.2,3.1,0],[2.2,3.1,0],[0,3.1,-2.2],[0,3.1,2.2]].entries()){
    const end=mesh('roulette-cross-counterweight-'+index,endGeometry,agedBrass,rotor);end.position.set(...position);end.scale.set(1,.86,1);
  }
  const cap=mesh('roulette-spindle-cap',ownGeometry(new THREE.SphereGeometry(.31,16,8)),agedBrass,rotor);cap.position.y=3.28;cap.scale.y=.7;

  // Accepted result lighting is explicit and optional, never inferred here.
  // It only tints the real accepted floor. Null restores all original colours.
  let accepted=null,disposed=false;
  function setAcceptedPocket(index){
    const next=Number.isInteger(index)&&index>=0&&index<37?index:null;
    if(next===accepted)return;
    if(accepted!==null)pockets.setColorAt(accepted,pocketColors[accepted]);
    accepted=next;
    if(accepted!==null)pockets.setColorAt(accepted,pocketColors[accepted].clone().lerp(new THREE.Color(0xa3b09b),.20));
    pockets.instanceColor.needsUpdate=true;
  }

  root.updateMatrixWorld(true);
  let triangleCount=0,drawCalls=0;
  root.traverse(object=>{if(!object.isMesh)return;drawCalls++;
    triangleCount+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3*(object.isInstancedMesh?object.count:1);
  });
  const budget=Object.freeze({triangles:triangleCount,drawCalls,geometries:geometries.size,materials:materials.size,textures:textures.size,limit:25000});
  if(triangleCount>25000){dispose();throw new RangeError('Roulette model exceeded25000 triangles: '+triangleCount);}
  root.userData={presentationOnly:true,numberOrder:[...ROULETTE_NUMBERS],budget};
  function dispose(){
    if(disposed)return;disposed=true;
    root.traverse(object=>{if(object.isInstancedMesh)object.dispose();});
    for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();for(const texture of textures)texture.dispose();
  }
  return {root,rotor,parts:{...parts,bowl,track,numberBand,pockets,separators,cone,hub},anchors:ROULETTE_WHEEL_V48,
    surfaceYAtRadius,setAcceptedPocket,budget,dispose};

  function makeNumberTexture(){
    const createCanvas=options.canvasFactory??(typeof document!=='undefined'?()=>document.createElement('canvas'):null);
    const canvas=createCanvas?.(),context=canvas?.getContext?.('2d');
    if(!context){
      // Geometry-only/headless consumers need no DOM. Browser builds always
      // use the full stencil atlas below, through the same public API.
      const data=new Uint8Array(128*128*4);
      for(let y=0;y<128;y++)for(let x=0;x<128;x++){
        const a=(Math.atan2(x-63.5,y-63.5)+TAU)%TAU,index=Math.round(a/TAU*37)%37;
        const rgb=RGB[rouletteColor(ROULETTE_NUMBERS[index])],offset=(y*128+x)*4;
        data.set([...rgb,255],offset);
      }
      const texture=ownTexture(new THREE.DataTexture(data,128,128,THREE.RGBAFormat));texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=true;texture.needsUpdate=true;return texture;
    }
    const size=1024,unit=size/14,mid=size/2;canvas.width=canvas.height=size;
    context.fillStyle='#17231c';context.fillRect(0,0,size,size);
    for(let index=0;index<37;index++){
      const angle=index*TAU/37,number=ROULETTE_NUMBERS[index],rgb=RGB[rouletteColor(number)];
      context.beginPath();
      for(let i=0;i<=8;i++){const a=angle-TAU/74+TAU/37*i/8,x=mid+Math.sin(a)*6.82*unit,y=mid+Math.cos(a)*6.82*unit;i?context.lineTo(x,y):context.moveTo(x,y);}
      for(let i=8;i>=0;i--){const a=angle-TAU/74+TAU/37*i/8;context.lineTo(mid+Math.sin(a)*5.88*unit,mid+Math.cos(a)*5.88*unit);}
      context.closePath();context.fillStyle='rgb('+rgb.join(',')+')';context.fill();
      context.save();context.translate(mid+Math.sin(angle)*6.35*unit,mid+Math.cos(angle)*6.35*unit);context.rotate(-angle);
      context.font='700 '+(.70*unit)+'px "Golos Text",Arial,sans-serif';context.textAlign='center';context.textBaseline='middle';
      context.fillStyle='#e9e2cb';context.fillText(String(number),0,0,.89*unit);
      // A fine ink bridge makes the numerals a printed stencil, not glowing
      // floating text. Its width remains below one source-camera pixel.
      context.fillStyle='rgb('+rgb.join(',')+')';context.fillRect(-.006*unit,-.33*unit,.012*unit,.66*unit);
      context.restore();
    }
    // Low-contrast material wear, fixed in the rotor rather than animated.
    for(let i=0;i<2400;i++){
      const x=Math.floor(hash(i,17,41)*size),y=Math.floor(hash(i,23,43)*size);
      context.fillStyle=hash(i,31,47)>.5?'#ffffff05':'#00000008';context.fillRect(x,y,1+(i%3),1);
    }
    const texture=ownTexture(new THREE.CanvasTexture(canvas));texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=8;texture.needsUpdate=true;return texture;
  }
}
