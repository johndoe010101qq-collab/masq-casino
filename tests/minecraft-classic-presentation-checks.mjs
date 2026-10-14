import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {createServer} from 'vite';
import * as THREE from 'three';
import { rules, settle, ROULETTE_NUMBERS } from '../src/game-math.js';
import { CLASSIC_DIE_FACES, CLASSIC_DIE_PIPS, MINECRAFT_PLINKO_GEOMETRY, minecraftCoinPose, minecraftRoulettePose, minecraftTerminalState } from '../src/minecraft-classic-motion.js';
import { plinkoBallPose } from '../src/plinko-motion.js';

let checks = 0;
const close = (a, b, message) => { assert.ok(Math.abs(a - b) < 1e-9, message); checks++; };
const up = new THREE.Vector3(0, 1, 0), front = new THREE.Vector3(0, 0, 1);
for (const face of CLASSIC_DIE_FACES) {
  const drawn = front.clone().applyEuler(new THREE.Euler(...face.rotation));
  close(drawn.distanceTo(new THREE.Vector3(...face.normal)), 0, 'Pips lie on their actual cube face');
  assert.equal(CLASSIC_DIE_PIPS[face.value].length, face.value); checks++;
  const opposite = CLASSIC_DIE_FACES.find(item => item.value === 7 - face.value);
  close(new THREE.Vector3(...face.normal).dot(new THREE.Vector3(...opposite.normal)), -1, 'Opposite physical faces sum to seven');
}
for (let chosen = 1; chosen <= 6; chosen++) {
  const config = rules('dice', chosen);
  for (let ticket = 0; ticket < config.sampleSize; ticket++) {
    const round = settle('dice', chosen, 5, 1000, ticket);
    const face = CLASSIC_DIE_FACES.find(item => item.value === round.value);
    const final = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...face.normal), up)
      .premultiply(new THREE.Quaternion().setFromAxisAngle(up, .4));
    close(new THREE.Vector3(...face.normal).applyQuaternion(final).distanceTo(up), 0, 'The accepted ticket face is physically upward');
  }
}
for (let step = 0; step < 90; step++) {
  const neutral = minecraftCoinPose({ face: 'heads' }, step / 100, true);
  assert.deepEqual(minecraftCoinPose({ face: 'tails' }, step / 100, true), neutral); checks++;
  assert.doesNotThrow(() => minecraftCoinPose({ get face() { throw new Error('Private face read'); } }, step / 100, true)); checks++;
}
for (const face of ['heads', 'tails']) {
  const pose = minecraftCoinPose({ face }, 0, false);
  close(Math.cos(pose.radians), face === 'heads' ? 1 : -1, 'Settled coin exposes the actual physical side');
}
for (const chosen of ['red', 'black', 'green', ...ROULETTE_NUMBERS]) {
  const config = rules('roulette', chosen);
  for (let ticket = 0; ticket < config.sampleSize; ticket++) {
    const round = settle('roulette', chosen, 5, 1000, ticket);
    const pose = minecraftRoulettePose(round, 1, false);
    const index = ((Math.round(pose.angle * 37 / (Math.PI * 2)) % 37) + 37) % 37;
    assert.equal(ROULETTE_NUMBERS[index], round.number); checks++;
    close(pose.wheelDegrees % 360, 0, 'Wheel ends on its original physical pocket map');
    assert.ok(pose.radius >= 1.66 && pose.radius <= 2.30, 'Ball rests inside its actual pocket'); checks++;
  }
}
for (const target of [1.5, 2, 4, 8]) for (let step = 0; step < 92; step++) {
  assert.deepEqual(minecraftTerminalState({ targetMultiplier: target, won: true }, step / 100, true), minecraftTerminalState({ targetMultiplier: target, won: false }, step / 100, true)); checks++;
  assert.doesNotThrow(() => minecraftTerminalState({ targetMultiplier: target, get won() { throw new Error('Private outcome read'); } }, step / 100, true)); checks++;
}

// The rotated cube and the square peg fit strictly within the original contact
// separation. This checks the new geometry against every accepted Plinko path.
const ballRadius = Math.hypot(...MINECRAFT_PLINKO_GEOMETRY.ball) / 2;
const pegRadius = Math.hypot(...MINECRAFT_PLINKO_GEOMETRY.peg.slice(0, 2)) / 2;
const pegs = [];
for (let row = 0; row < 8; row++) for (let column = 0; column <= row; column++) pegs.push([(column - row / 2) * .56, 1.75 - row * .45]);
let minSeparation = Infinity;
for (let ticket = 0; ticket < 256; ticket++) {
  const path = [0]; for (let bit = 0; bit < 8; bit++) path.push(path.at(-1) + ((ticket >> bit) & 1 ? 1 : -1));
  for (let step = 0; step <= 180; step++) {
    const [x, y] = plinkoBallPose(path, step / 180);
    for (const [px, py] of pegs) minSeparation = Math.min(minSeparation, Math.hypot(x - px, y - py));
  }
}
assert.ok(ballRadius + pegRadius < minSeparation, 'Even fully rotated cube balls cannot cut through the block pegs'); checks++;
const loader=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try {
  const {MINECRAFT_CLASSIC_CAMERAS,MinecraftPlinkoCabinet,PLINKO_VISUAL_BEARING,PLINKO_CATCH_LABEL,plinkoBackplateTiles,makePlinkoCaseGeometry,makeClassicDieShell,makeClassicDieFace,coinPixelSealCells,makeCoinSealFace,classicDieRestQuaternion,classicDieSurfaceVertices,classicDieSupportHeight}=await loader.ssrLoadModule('/src/MinecraftClassicArt.jsx');
  const {plinkoContactLighting,plinkoBinLabelAnchors}=await loader.ssrLoadModule('/src/PlinkoScene.jsx');
  const {blackjackStudioBlocks,blackjackStudioLighting,BLACKJACK_STUDIO_REFERENCE,makeBlackjackStudioTexture}=await loader.ssrLoadModule('/src/MinecraftStudio.jsx');
  // The actual resting cube must show volume for every accepted upward face,
  // rather than lining up its side edges with the camera.
  const camera=MINECRAFT_CLASSIC_CAMERAS.dice;
  const eye=new THREE.Vector3(...camera.at).sub(new THREE.Vector3(...camera.target)).normalize();
  for(const upward of CLASSIC_DIE_FACES) {
    const rest=classicDieRestQuaternion({value:upward.value},1);
    close(new THREE.Vector3(...upward.normal).applyQuaternion(rest).distanceTo(up),0,'Actual revealed die helper preserves the accepted top face');
    const visible=CLASSIC_DIE_FACES.map(face=>new THREE.Vector3(...face.normal).applyQuaternion(rest).dot(eye)).filter(dot=>dot>.18);
    assert.equal(visible.length,3,'All resting die results show three substantial physical faces');checks++;
  }
  // Wide visual bearings sit behind the flight, so their apparent size cannot
  // add a new collision or shorten the original mathematical contact gap.
  const bearingFront=PLINKO_VISUAL_BEARING.z+PLINKO_VISUAL_BEARING.depth/2;
  const ballBack=plinkoBallPose([0,1,2,3,4,5,6,7,8],.5)[2]-ballRadius;
  assert.ok(bearingFront<ballBack,'Even a fully rotated ball clears the recessed bearings in depth');checks++;
  const nodes=tree=>[tree,...React.Children.toArray(tree?.props?.children).flatMap(child=>typeof child==='object'?nodes(child):[])];
  const cabinetNodes=nodes(MinecraftPlinkoCabinet({showLabels:false}));
  const bodies=cabinetNodes.filter(node=>node.type?.name==='StudioBlock'&&JSON.stringify(node.props.size)===JSON.stringify(MINECRAFT_PLINKO_GEOMETRY.peg));
  assert.equal(bodies.length,36,'The actual cabinet retains exactly the original 36 protruding contact pegs');checks++;
  const positionedNodes=(tree,parent=new THREE.Matrix4())=>{
    const props=tree?.props||{},position=props.position||props.at||[0,0,0],rotation=props.rotation||[0,0,0];
    const local=new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(1,1,1));
    const world=parent.clone().multiply(local);
    return [{node:tree,world},...React.Children.toArray(props.children).flatMap(child=>typeof child==='object'?positionedNodes(child,world):[])];
  };
  const positioned=positionedNodes(MinecraftPlinkoCabinet({showLabels:false}));
  const physicalPegs=positioned.filter(({node})=>node.type?.name==='StudioBlock'&&JSON.stringify(node.props.size)===JSON.stringify(MINECRAFT_PLINKO_GEOMETRY.peg));
  for(let index=0;index<pegs.length;index++) {
    const actual=new THREE.Vector3().setFromMatrixPosition(physicalPegs[index].world);
    close(actual.x,pegs[index][0],'Mechanical refinements retain every exact original collider x');
    close(actual.y,pegs[index][1],'Mechanical refinements retain every exact original collider y');
    close(actual.z,.1,'Protruding peg bodies retain their original collision depth');
  }
  const caseGeometry=makePlinkoCaseGeometry();caseGeometry.computeBoundingBox();
  assert.ok(caseGeometry.boundingBox.max.z-.45<.10,'The solid case remains wholly behind every rotated ball');checks++;
  assert.ok(caseGeometry.boundingBox.max.z-caseGeometry.boundingBox.min.z>.70,'The stepped cabinet has a closed physical depth');checks++;
  caseGeometry.dispose();
  const tiles=plinkoBackplateTiles();assert.equal(tiles.length,80,'Working chamber consists of separate metal plates');checks++;
  for(const tile of tiles){assert.ok(tile.at[2]+tile.size[2]/2<ballBack,'Checker plates remain behind the actual flight');checks++;}
  const trays=positioned.filter(({node})=>node.props?.name==='deep-mechanical-catch-tray');
  assert.equal(trays.length,9,'All nine accepted bins have their own physical catch tray');checks++;
  for(let index=0;index<trays.length;index++) {
    const {node,world}=trays[index],center=new THREE.Vector3().setFromMatrixPosition(world);
    close(center.x,(index-4)*.56,'Catch tray centers preserve the original accepted bin locations');
    const floor=React.Children.toArray(node.props.children).find(child=>child.type==='mesh');
    const floorSize=React.Children.toArray(floor.props.children).find(child=>child.type==='boxGeometry').props.args;
    const floorTransform=world.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...floor.props.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...floor.props.rotation)),new THREE.Vector3(1,1,1)));
    let top=-Infinity;
    for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])top=Math.max(top,new THREE.Vector3(x*floorSize[0]/2,y*floorSize[1]/2,z*floorSize[2]/2).applyMatrix4(floorTransform).y);
    assert.ok(top<-1.79-ballRadius,'The inclined catch floor clears the fully rotated settling ball');checks++;
  }
  const coverLabels=positionedNodes(MinecraftPlinkoCabinet({showLabels:true})).filter(({node})=>node.type?.name==='StudioPrint'&&node.props.text!=='PLINKO');
  assert.equal(coverLabels.length,9,'Authoring has solid compact rates on each actual catch plate');checks++;
  for(let index=0;index<coverLabels.length;index++) {
    const center=new THREE.Vector3().setFromMatrixPosition(coverLabels[index].world);
    close(center.x,(index-4)*.56,'Cover labels share their live projected bin center');
    close(center.y,PLINKO_CATCH_LABEL.y,'Cover and live rates use the same physical table height');
    close(center.z,PLINKO_CATCH_LABEL.z,'Cover and live rates use the same physical front plane');
    assert.ok(coverLabels[index].node.props.width<PLINKO_CATCH_LABEL.width&&coverLabels[index].node.props.height<PLINKO_CATCH_LABEL.height,'Cover lettering fits inside the real catch plate');checks++;
  }
  assert.equal(positioned.filter(({node})=>node.props?.name==='public-flight-sliding-shutter').length,1,'Only one actual public launch shutter exists');checks++;
  for(const [width,height] of [[390,450],[1366,690],[960,600]]) {
    const fit=MINECRAFT_CLASSIC_CAMERAS.plinko,projection=new THREE.OrthographicCamera(-width/2,width/2,height/2,-height/2,.1,40);
    projection.position.set(...fit.at);projection.lookAt(...fit.target);projection.zoom=Math.min(width/7.4,height/6.2);projection.updateProjectionMatrix();projection.updateMatrixWorld();
    const anchors=plinkoBinLabelAnchors(projection,width,height);
    assert.equal(anchors.length,9);checks++;
    anchors.forEach((anchor,index)=>{
      assert.ok(Object.values(anchor).every(Number.isFinite)&&anchor.width>0&&anchor.height>0,'Real bin projection returns finite readable bounds');checks++;
      assert.ok(anchor.x-anchor.width/2>0&&anchor.x+anchor.width/2<width&&anchor.y-anchor.height/2>0&&anchor.y+anchor.height/2<height,'Every angled bin label remains inside the live canvas');checks++;
      if(index){assert.ok(anchor.x>anchors[index-1].x+anchor.width,'Adjacent tilted labels remain separated');checks++;}
    });
  }
  for(let tick=0;tick<9000;tick+=31) {
    const progress=tick/10000,common=classicDieRestQuaternion({value:1},progress).toArray();
    for(let value=1;value<=6;value++){assert.deepEqual(classicDieRestQuaternion({value},progress).toArray(),common,'All unrevealed dice use the same actual orientation');checks++;}
    assert.doesNotThrow(()=>classicDieRestQuaternion({get value(){throw Error('Premature die result read');}},progress));checks++;
  }
  for(let value=1;value<=6;value++) {
    const before=classicDieRestQuaternion({value},.9-1e-8),boundary=classicDieRestQuaternion({value},.9),after=classicDieRestQuaternion({value},.9001);
    assert.ok(before.angleTo(boundary)<1e-8,'The public boundary has no rotation pop');checks++;
    assert.ok(boundary.angleTo(after)<1e-5,'The actual reveal begins with a smooth zero-slope turn');checks++;
  }
  const studio=blackjackStudioBlocks();
  assert.equal(studio.wall.length,15*6,'Approved room retains 15 by 6 real wall volumes');checks++;
  assert.equal(studio.ground.length,15*7,'Approved room retains its floor volume grid');checks++;
  assert.equal(studio.panels.filter(box=>box[1]===52/16).length,4,'All four tall acoustic panels remain visible geometry');checks++;
  assert.equal(studio.trims.length,4,'All approved acoustic-panel trim caps remain');checks++;
  assert.deepEqual(BLACKJACK_STUDIO_REFERENCE.window,{x:26/16,y:32/16,width:3/16,height:48/16},'The narrow frosted strip uses the approved vertical proportions');checks++;
  assert.equal(BLACKJACK_STUDIO_REFERENCE.palette.felt,'#1F3B35');checks++;
  const light=blackjackStudioLighting();
  assert.equal(light.key.intensity,520/16,'Key exposure rescales the source spotlight at the same 1/16 scene scale');checks++;
  assert.equal(light.key.angle,.32);checks++;
  assert.equal(light.rim.color,'#6fa89a');checks++;
  assert.equal(light.rim2.color,'#5f8f84');checks++;
  const felt=makeBlackjackStudioTexture('felt'),feltAgain=makeBlackjackStudioTexture('felt');
  assert.deepEqual(felt.image.data,feltAgain.image.data,'Approved felt nap is deterministic, independent of presentation time and game RNG');checks++;
  for(let channel=0;channel<3;channel++) {
    const values=[];for(let index=channel;index<felt.image.data.length;index+=4)values.push(felt.image.data[index]);
    assert.ok(Math.max(...values)-Math.min(...values)<=6,'Felt stays low contrast, without large bright block noise');checks++;
  }
  felt.dispose();feltAgain.dispose();
  const shell=makeClassicDieShell();
  for(const axis of ['x','y','z']) {
    assert.ok(Math.abs(shell.boundingBox.min[axis]+.55)<1e-6&&Math.abs(shell.boundingBox.max[axis]-.55)<1e-6,'Rounded die preserves the original 1.1 body envelope');checks++;
  }
  const ray=new THREE.Raycaster(),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  for(const face of CLASSIC_DIE_FACES) {
    const geometry=makeClassicDieFace(face.value),mesh=new THREE.Mesh(geometry,material);
    mesh.updateMatrixWorld();
    for(const [x,y] of CLASSIC_DIE_PIPS[face.value]) {
      ray.set(new THREE.Vector3(x,y,.5),new THREE.Vector3(0,0,-1));
      assert.equal(ray.intersectObject(mesh).length,0,'Every pip cuts a real circular hole through its face');checks++;
    }
    ray.set(new THREE.Vector3(.40,.40,.5),new THREE.Vector3(0,0,-1));
    assert.ok(ray.intersectObject(mesh).length>0,'The die face remains one continuous surface around its holes');checks++;
    geometry.dispose();
  }
  // The small minted identity retains the exact head-front silhouette. Dark
  // eye/moustache cells are real recesses, while hood pixels remain bare metal.
  const sealCells=coinPixelSealCells(),seal=makeCoinSealFace(),sealMesh=new THREE.Mesh(seal,material);
  sealMesh.updateMatrixWorld();
  const heightMap=['........','...HH...','..DMMD..','.HHHHHH.','.HHDDHH.','MDDMMDDM','HHMDDMHH','.MMDDMM.'];
  assert.equal(sealCells.filter(cell=>cell.raised).length,28,'All 28 accepted skin face cells become minted relief');checks++;
  assert.equal(sealCells.filter(cell=>!cell.raised).length,12,'Only the 12 internal dark marks become recesses');checks++;
  assert.equal(seal.userData.recessCount,12,'Coin metal has a physical aperture for every recessed mark');checks++;
  for(let row=0;row<8;row++)for(let column=0;column<8;column++) {
    const expected=heightMap[row][column],cell=sealCells.find(item=>item.row===row&&item.column===column);
    if(expected==='.') {assert.equal(cell,undefined,'Hood/background pixels do not create a giant face backing');checks++;continue;}
    assert.ok(cell);checks++;
    assert.equal(cell.raised,expected!=='D','Minted pixels preserve the supplied identity mask');checks++;
    close(cell.depth,expected==='D'?.008:expected==='H'?.022:.014,'Raised relief retains clear high and low surfaces');
    ray.set(new THREE.Vector3(cell.x,cell.y,.5),new THREE.Vector3(0,0,-1));
    assert.equal(ray.intersectObject(sealMesh).length>0,cell.raised,'Only recessed marks cut through the front metal');checks++;
  }
  ray.set(new THREE.Vector3(.68,0,.5),new THREE.Vector3(0,0,-1));
  assert.ok(ray.intersectObject(sealMesh).length>0,'The small seal sits in one continuous coin surface');checks++;
  // Reconstruct the visible envelope independently from actual drawn meshes.
  // Support must touch the felt for every orientation, never float or clip.
  const visibleVertices=[];
  const addVertices=(geometry,transform=new THREE.Matrix4())=>{
    const positions=geometry.getAttribute('position');
    for(let index=0;index<positions.count;index++)visibleVertices.push(new THREE.Vector3().fromBufferAttribute(positions,index).applyMatrix4(transform));
  };
  addVertices(shell);
  for(const face of CLASSIC_DIE_FACES) {
    const geometry=makeClassicDieFace(face.value),transform=new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...face.rotation));
    transform.setPosition(...face.at);addVertices(geometry,transform);geometry.dispose();
  }
  assert.ok(Object.isFrozen(classicDieSurfaceVertices())&&classicDieSurfaceVertices().every(Object.isFrozen),'Shared contact vertices stay immutable');checks++;
  const poses=CLASSIC_DIE_FACES.map(face=>classicDieRestQuaternion({value:face.value},1));
  for(let step=0;step<128;step++)poses.push(new THREE.Quaternion().setFromEuler(new THREE.Euler(step*.171,step*.293,step*.419)));
  for(const rotation of poses) {
    const support=classicDieSupportHeight(rotation);
    const bottom=Math.min(...visibleVertices.map(vertex=>vertex.clone().applyQuaternion(rotation).y));
    close(support,-bottom,'Contact height is derived from the actual drawn hull, including engraved face rims');
    close(-.8535+support+bottom,-.8535,'Every rotated physical die touches the actual felt plane without a gap');
    assert.ok(support>=.55-1e-6&&support<Math.sqrt(3)*.551,'Support stays within the real rounded die envelope');checks++;
  }
  [shell,seal].forEach(geometry=>geometry.dispose());material.dispose();
  for(let ticket=0;ticket<256;ticket++) {
    const path=[0];for(let bit=0;bit<8;bit++)path.push(path.at(-1)+((ticket>>bit)&1?1:-1));
    for(let row=0;row<8;row++)for(const phase of [0,.04,.10,.22,.29]) {
      const progress=(row+1+phase)/9;
      const column=(path[row]+row)/2,index=row*(row+1)/2+column;
      const prefixOnly=new Proxy(path,{get(target,key){if(/^\d+$/.test(String(key))&&Number(key)>row)throw Error('Future path choice read');return Reflect.get(target,key);}});
      const flight={progress,path:prefixOnly};
      for(const key of ['won','bin','stake','payout','netCents'])Object.defineProperty(flight,key,{get(){throw Error('Hidden result read');}});
      const light=plinkoContactLighting([flight]);
      assert.ok(light.pegs[index]>0&&light.pegs[index]<=1,'Only the current physical contact bearing lights');checks++;
      assert.equal([...light.pegs].filter(value=>value>0).length,1,'No predictive trail or future peg lights');checks++;
      const [x,y]=plinkoBallPose(path,progress),pegX=(column-row/2)*.56,pegY=1.75-row*.45;
      assert.ok(Math.hypot(x-pegX,y-pegY)<=.19,'The active cue remains next to the real contact path');checks++;
      assert.ok([...plinkoContactLighting([flight],true).pegs].every(value=>value===0),'Reduced motion removes bearing flashes');checks++;
    }
  }
  const first={path:[0],progress:1/9},later={path:[0],progress:1.1/9};
  assert.equal(plinkoContactLighting([later,first]).pegs[0],1,'Concurrent flights use the strongest actual contact, not additive flashes');checks++;
  for(const progress of [0,.05,.11]) {
    const flight={progress,get path(){throw Error('A launch indicator cannot read future choices');}};
    const light=plinkoContactLighting([flight]);
    assert.equal(light.entrance,true);checks++;
    assert.ok([...light.pegs].every(value=>value===0));checks++;
  }
  for(let step=0;step<=100;step++) {
    const progress=step/900,flight={progress,get path(){if(step===100)return [0];throw Error('The launch shutter cannot inspect future path');}};
    for(const key of ['won','bin','stake','payout','netCents'])Object.defineProperty(flight,key,{get(){throw Error('A launch shutter cannot read a hidden result');}});
    const shutter=plinkoContactLighting([flight]).shutter;
    assert.ok(shutter>=0&&shutter<=1,'Public launch shutter stays within its fixed mechanical travel');checks++;
    if(step===0||step===100)close(shutter,0,'Shutter is closed before flight and after the public inlet phase');
    if(step===50)close(shutter,1,'A paid public flight visibly opens the mechanical inlet');
  }
  close(plinkoContactLighting([]).shutter,0,'No separate animation clock can open an idle cabinet');
  for(const progress of [1,-1,NaN,Infinity]) {
    const light=plinkoContactLighting([{progress,get path(){throw Error('An inactive cue cannot read path');}}]);
    assert.equal(light.entrance,false);checks++;
    assert.ok([...light.pegs].every(value=>value===0));checks++;
    close(light.shutter,0,'Inactive or finished flights leave the shutter closed');
  }
} finally {await loader.close();}
console.log(JSON.stringify({ passed: true, checks, plinkoMinimum: minSeparation, newBodiesBound: ballRadius + pegRadius, scope: 'Actual ticket maps, private boundaries, 256-path body clearance, die volume, recessed bearings and prefix-only Plinko contact cues' }));
