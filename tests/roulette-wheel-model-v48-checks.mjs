import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {buildRouletteWheel,ROULETTE_WHEEL_V48 as layout} from '../src/roulette-wheel-model-v48.js';
import {ROULETTE_NUMBERS,rouletteColor} from '../src/game-math.js';

let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
const close=(a,b,message,tolerance=1e-6)=>check(Math.abs(a-b)<=tolerance,`${message}: ${a}/${b}`);
const labels=[];
const context={fillRect(){},beginPath(){},lineTo(){},moveTo(){},closePath(){},fill(){},save(){},translate(){},rotate(){},restore(){},
  fillText(text,x,y,width){labels.push({text,x,y,width,font:this.font});}};
const model=buildRouletteWheel(THREE,{canvasFactory:()=>({width:0,height:0,getContext:()=>context})});
assert.deepEqual(model.root.position.toArray(),[0,14.5,4.6]);checks++;
assert.deepEqual(model.anchors.numbers,ROULETTE_NUMBERS);checks++;
check(model.rotor.parent===model.root,'Rotor belongs to the source-aligned whole wheel');
check(model.budget.triangles<=25000,'Full rendered instance count fits the model triangle budget');
check(model.budget.triangles>10000,'The model includes a constructed hollow bowl, floors and machined details');
check(model.budget.drawCalls<=25,'Shared/instanced parts keep draw calls bounded');
check(labels.length===37,'Integrated canvas atlas prints37 numerals');
assert.deepEqual(labels.map(item=>Number(item.text)),ROULETTE_NUMBERS);checks++;
check(labels.every(item=>item.font.includes('Golos Text')&&item.width>50),'Numerals are physical atlas ink with a bounded cell width');
check(model.parts.pockets.count===37&&model.parts.separators.count===37,'Every pocket has a real floor and thin raised fret');
check(model.parts.pockets.parent===model.rotor&&model.parts.separators.parent===model.rotor&&model.parts.numberBand.parent===model.rotor,
  'Floors, separators and numerals rotate as the same rigid rotor');

const bounds=new THREE.Box3().setFromObject(model.root);
close(bounds.min.y,11.19,'Lower plinth covers the old source block-base silhouette',1e-5);
check(bounds.min.x<=-10.8&&bounds.max.x>=10.8,'New bowl covers the full original outer width');
check(bounds.max.y>18,'New crafted cross covers the original baked spindle tips');
const ray=new THREE.Raycaster(),up=new THREE.Vector3(0,1,0),matrix=new THREE.Matrix4(),color=new THREE.Color();
function surface(radius,angle,object){
  ray.set(new THREE.Vector3(Math.sin(angle)*radius,25,4.6+Math.cos(angle)*radius),new THREE.Vector3(0,-1,0));
  const intersections=ray.intersectObject(object,true);
  check(intersections.length>0,'Physical authored surface exists at the calibrated source radius');
  return intersections[0].point.y;
}
for(let index=0;index<37;index++){
  const angle=index*Math.PI*2/37;
  close(surface(5.25,angle,model.parts.pockets),14.50,'Accepted sphere rests on the real floor');
  close(surface(6.35,angle,model.parts.numberBand),15.0,'Number band retains source camera height');
  close(surface(9,angle,model.parts.track),15.77,'Track centreline retains source handoff surface height');
  model.parts.pockets.getMatrixAt(index,matrix);
  const center=new THREE.Vector3(0,0,5.25).applyMatrix4(matrix);
  close(center.x,Math.sin(angle)*5.25,'Canonical pocket floor x');
  close(center.z,Math.cos(angle)*5.25,'Canonical pocket floor z');
  model.parts.pockets.getColorAt(index,color);color.convertLinearToSRGB();
  const rgb=color.toArray().map(v=>Math.round(v*255)),expected={red:[111,32,42],black:[20,28,25],green:[29,94,65]}[rouletteColor(ROULETTE_NUMBERS[index])];
  assert.deepEqual(rgb,expected);checks++;
  model.parts.separators.getMatrixAt(index,matrix);
  const fretX=new THREE.Vector3(1,0,0).transformDirection(matrix),fretCenter=new THREE.Vector3().setFromMatrixPosition(matrix);
  const ballCenter=new THREE.Vector3(Math.sin(angle)*5.25,.42,Math.cos(angle)*5.25);
  const sideClearance=Math.abs(ballCenter.clone().sub(fretCenter).dot(fretX))-.42-layout.separatorWidth/2;
  check(sideClearance>.004,'Thin fret clears the full accepted sphere instead of cutting through it');
}
close(model.surfaceYAtRadius(9)+layout.ballRadius,layout.trackY,'Calibrated ball/track support contract');
close(model.surfaceYAtRadius(5.25)+layout.ballRadius,layout.pocketY,'Calibrated ball/pocket support contract');
for(const radius of [5.25,5.75,6.35,7.40,8.00,9.06,10.34]){
  close(model.surfaceYAtRadius(radius-1e-7),model.surfaceYAtRadius(radius+1e-7),'No support height step at an authored edge',1e-6);
  const h=1e-5,left=(model.surfaceYAtRadius(radius)-model.surfaceYAtRadius(radius-h))/h;
  const right=(model.surfaceYAtRadius(radius+h)-model.surfaceYAtRadius(radius))/h;
  close(left,right,'Support slope joins smoothly',1e-5);
}
for(let i=0;i<=100;i++){
  const distance=.42*i/100,radius=5.90-distance;
  const bandEdgeSupport=15+Math.sqrt(Math.max(0,.42*.42-distance*distance))-.42;
  check(model.surfaceYAtRadius(radius)>=bandEdgeSupport-1e-7,'Continuous pocket approach conservatively clears the band edge under the whole sphere');
}
const vertexColors=model.parts.bowl.geometry.attributes.color;
check(vertexColors&&model.parts.bowl.material.vertexColors,'Lower plinth is authored in the same single bowl draw call');
for(let i=0;i<vertexColors.count;i++){
  const y=model.parts.bowl.geometry.attributes.position.getY(i);
  if(y<-.55){check(vertexColors.getX(i)<.18&&vertexColors.getY(i)<.18&&vertexColors.getZ(i)<.18,'Lower bowl reads as a recessed dark plinth');break;}
}
for(let i=0;i<vertexColors.count;i++)if(model.parts.bowl.geometry.attributes.position.getY(i)>.72){
  close(vertexColors.getX(i),1,'Upper visible bowl keeps its original wood');break;
}
const pocketColors=Array.from({length:37},(_,i)=>{model.parts.pockets.getColorAt(i,color);return color.clone();});
model.setAcceptedPocket(4);model.parts.pockets.getColorAt(4,color);
check(!color.equals(pocketColors[4]),'Explicit accepted floor can receive a restrained result accent');
for(let i=0;i<37;i++)if(i!==4){model.parts.pockets.getColorAt(i,color);check(color.equals(pocketColors[i]),'Accent never touches a neighbouring or fabricated near-miss floor');}
model.setAcceptedPocket(null);
for(let i=0;i<37;i++){model.parts.pockets.getColorAt(i,color);check(color.equals(pocketColors[i]),'Null exactly restores original pocket colours');}
model.setAcceptedPocket(-1);model.setAcceptedPocket(37);model.setAcceptedPocket(NaN);
for(let i=0;i<37;i++){model.parts.pockets.getColorAt(i,color);check(color.equals(pocketColors[i]),'Malformed presentation accent cannot select an arbitrary pocket');}

const geometries=new Set(),materials=new Set(),textures=new Set();
model.root.traverse(object=>{if(!object.isMesh)return;geometries.add(object.geometry);materials.add(object.material);});
for(const material of materials)for(const key of ['map','bumpMap'])if(material[key])textures.add(material[key]);
let disposedGeometry=0,disposedMaterial=0,disposedTexture=0,disposedInstances=0;
for(const geometry of geometries)geometry.addEventListener('dispose',()=>disposedGeometry++);
for(const material of materials)material.addEventListener('dispose',()=>disposedMaterial++);
for(const texture of textures)texture.addEventListener('dispose',()=>disposedTexture++);
model.root.traverse(object=>{if(object.isInstancedMesh)object.addEventListener('dispose',()=>disposedInstances++);});
model.dispose();model.dispose();
close(disposedGeometry,geometries.size,'Shared geometry is disposed once');
close(disposedMaterial,materials.size,'Shared materials are disposed once');
close(disposedTexture,textures.size,'Used textures are disposed once');
close(disposedInstances,3,'Instanced attribute buffers are disposed once');
const headless=buildRouletteWheel(THREE);check(headless.budget.triangles===model.budget.triangles,'Headless layout audit uses the same physical model');headless.dispose();
const source=await readFile(new URL('../src/roulette-wheel-model-v48.js',import.meta.url),'utf8');
check(!/requestAnimationFrame|setTimeout|Math\.random|Date\.now|session\.(begin|complete)|round\./.test(source),
  'Model has no clock, outcome access, RNG or financial side effects');
console.log(`PASS roulette wheel v48: ${checks} checks;${model.budget.triangles} triangles/${model.budget.drawCalls} draw calls;37 source-aligned physical pockets`);
