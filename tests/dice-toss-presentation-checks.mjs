import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import * as THREE from 'three';
import {diceTossPresentation} from '../src/dice-toss-presentation.js';
import {CLASSIC_DIE_FACES} from '../src/minecraft-classic-motion.js';

let checks=0;
const q=pose=>new THREE.Quaternion().fromArray(pose.quaternion);
for(let frame=0;frame<162;frame++){
  const p=frame/180,hidden={get value(){throw Error('Private die face read before disclosure');}};
  const common=diceTossPresentation(hidden,p,true);
  for(let value=1;value<=6;value++){
    assert.deepEqual(diceTossPresentation({value},p,true),common,'Every private outcome follows the same unrevealed throw');checks++;
  }
  if(p>=.75){
    assert.ok(common.lift>.1,'The die cannot look landed before its real face is disclosed');checks++;
    assert.ok(q(common).angleTo(q(diceTossPresentation({value:1},p+1/180,true)))>.02,'Visible spinning must continue through the formerly static temporary face');checks++;
  }
}
const up=new THREE.Vector3(0,1,0);
for(const face of CLASSIC_DIE_FACES){
  const round={value:face.value};
  for(const [p,playing,reduced] of [[1,true,false],[.4,false,false],[0,true,true]]){
    const pose=diceTossPresentation(round,p,playing,reduced);
    assert.ok(new THREE.Vector3(...face.normal).applyQuaternion(q(pose)).distanceTo(up)<1e-9,'Finished, skipped and reduced motion show the actual accepted upward face');checks++;
    assert.equal(pose.lift,0,'Accepted result rests on the felt');checks++;
  }
  const before=diceTossPresentation({get value(){throw Error('Private value');}},.9-1e-8,true),entry=diceTossPresentation(round,.9,true);
  assert.ok(q(before).angleTo(q(entry))<1e-5,'Disclosure does not produce an orientation jump');checks++;
  assert.ok(Math.abs(before.lift-entry.lift)<1e-5,'Disclosure does not produce a height jump');checks++;
  let previous=diceTossPresentation(round,.9,true);
  for(let frame=1;frame<=18;frame++){
    const pose=diceTossPresentation(round,.9+frame/180,true);
    assert.ok(pose.lift<=previous.lift+1e-12&&pose.lift>=0,'The real result settles monotonically after disclosure');checks++;
    assert.ok(q(previous).angleTo(q(pose))<.3,'The last rotation stays continuous across rendered frames');checks++;
    previous=pose;
  }
}
const loader=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
  const {classicDieSurfaceVertices,classicDieSupportHeight}=await loader.ssrLoadModule('/src/MinecraftClassicArt.jsx');
  for(let value=1;value<=6;value++)for(let frame=0;frame<=180;frame++){
    const pose=diceTossPresentation({value},frame/180,true),rotation=q(pose),center=-.8535+classicDieSupportHeight(rotation)+pose.lift;
    let bottom=Infinity;
    for(const vertex of classicDieSurfaceVertices())bottom=Math.min(bottom,new THREE.Vector3(...vertex).applyQuaternion(rotation).y+center);
    assert.ok(Math.abs(bottom-(-.8535+pose.lift))<1e-7,'The actual rounded die keeps the correct support throughout its new throw');checks++;
  }
}finally{await loader.close();}
console.log(JSON.stringify({passed:true,checks,scope:'No temporary settled face, continuous public disclosure, all six physical outcomes, exact felt support'}));
