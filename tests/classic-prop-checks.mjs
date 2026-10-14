import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import * as THREE from 'three';
import {OBB} from 'three/addons/math/OBB.js';
import {classicPropPresentation} from '../src/classic-prop-presentation.js';
import {classicHostPresentation,CLASSIC_HOST_STAGES} from '../src/classic-host-presentation.js';
import {diceTossPresentation} from '../src/dice-toss-presentation.js';
import {minecraftRoulettePose} from '../src/minecraft-classic-motion.js';

let checks=0;
const vector=a=>new THREE.Vector3(...a),quaternion=a=>new THREE.Quaternion(...a);
const close=(a,b,message,tolerance=1e-8)=>{assert.ok(Math.abs(a-b)<tolerance,message+': '+a+' / '+b);checks++;};
const poison=()=>{throw new Error('A private prop result was read');};
const matrix=(position,rotation=[0,0,0,1],scale=1)=>new THREE.Matrix4().compose(vector(position),quaternion(rotation),new THREE.Vector3(scale,scale,scale));
const privateOriginal=original=>{
  for(const key of ['round','face','value','won','payout','stake','netCents'])Object.defineProperty(original,key,{get:poison});
  return original;
};
const frameFor=host=>{
  const actor=matrix(host.actor.position,host.actor.quaternion,host.actor.scale);
  const hip=actor.clone().multiply(matrix(host.dealer.position));
  const waist=hip.clone().multiply(matrix([0,0,0],host.dealer.quaternion));
  const bones={body:waist,head:waist.clone().multiply(matrix([0,12*host.stage.pixel,0],host.dealer.head))};
  for(const side of ['left','right']){
    const joints=host.dealer[side],suffix=side==='left'?'Left':'Right';
    const upper=waist.clone().multiply(matrix(joints.shoulder,joints.upper)),fore=upper.clone().multiply(matrix(joints.elbow,joints.lower)),hand=fore.clone().multiply(matrix(joints.wrist,joints.hand));
    bones['upper'+suffix]=upper;bones['fore'+suffix]=fore;bones['hand'+suffix]=hand;
  }
  for(const [index,suffix] of ['Right','Left'].entries()){
    const rotation=angle=>new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),angle).toArray(),pixel=host.stage.pixel;
    const thigh=hip.clone().multiply(matrix([(index?1:-1)*1.9*pixel,0,-.1*pixel],rotation(-host.dealer.legAngle)));
    const shin=thigh.clone().multiply(matrix([0,-6*pixel,0],rotation(host.dealer.legAngle))),foot=shin.clone().multiply(matrix([0,-4*pixel,0]));
    bones['thigh'+suffix]=thigh;bones['shin'+suffix]=shin;bones['foot'+suffix]=foot;
  }
  return bones;
};
const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
const geometries=[];
try{
  const {classicDieSupportHeight,classicDieSurfaceVertices}=await server.ssrLoadModule('/src/MinecraftClassicArt.jsx');
  const originalFor=(game,p)=>{
    if(game==='dice'){
      const pose=diceTossPresentation({get value(){return p<.9?poison():4;}},p,true),q=quaternion(pose.quaternion);
      return privateOriginal({position:[pose.x,-.8535+classicDieSupportHeight(q)*.6+pose.lift,pose.z],quaternion:pose.quaternion});
    }
    const pose=minecraftRoulettePose({pocketIndex:0},p,true);
    return privateOriginal({position:[Math.sin(pose.angle)*pose.radius,-.070+Math.sin(Math.PI*Math.min(1,Math.max(0,(pose.progress-.6)/.4)))*.10,-Math.cos(pose.angle)*pose.radius],quaternion:[0,0,0,1]});
  };
  const drawFor=(game,p)=>classicPropPresentation(game,originalFor(game,p),p,true);
  for(const game of ['dice','roulette']){
    const config=CLASSIC_HOST_STAGES[game],release=config.release,join=game==='dice'?.29:.19;
    for(let tick=0;tick<=200;tick++){
      const p=tick/200,original=originalFor(game,p),draw=classicPropPresentation(game,original,p,true),host=classicHostPresentation(game,p,true);
      assert.ok(draw.position.every(Number.isFinite)&&draw.quaternion.every(Number.isFinite),'Public pose is finite');checks++;
      close(quaternion(draw.quaternion).length(),1,'Every draw quaternion is normalized');
      if(p>=join){assert.equal(draw,original,'Original public trajectory returns by reference before disclosure');checks++;}
      if(p<=release){
        const frame=frameFor(host),suffix=host.activeHand==='left'?'Left':'Right',joints=host.dealer[host.activeHand];
        const actualSocket=vector(joints.socketLocal).applyMatrix4(frame['hand'+suffix]);
        close(actualSocket.distanceTo(vector(draw.position)),0,'Held prop touches actual skin rig FK socket');
        assert.deepEqual(draw.quaternion,[0,0,0,1],'Held die/ball has its intended original orientation');checks++;
        assert.equal(draw.attached,true);checks++;
      }
      for(const reduced of [false,true]){
        if(reduced)assert.equal(classicPropPresentation(game,original,p,true,true),original,'Reduced motion returns original pose without actor delay');
        else assert.equal(classicPropPresentation(game,original,p,false),original,'Completed/skip returns original by reference');
        checks++;
      }
    }
    const held=classicPropPresentation(game,{get position(){return poison();},get quaternion(){return poison();}},release*.5,true);
    assert.ok(held.attached,'Held prefix does not inspect the upcoming original pose');checks++;
    const idleHost=classicHostPresentation(game,0,false),idle=classicPropPresentation(game,originalFor(game,0),0,false,false,true);
    close(vector(idle.position).distanceTo(vector(idleHost.gestureSocket)),0,'Idle prop is held on its real glove');
    for(const boundary of [release,join]){
      const e=1e-6,a=drawFor(game,boundary-e),b=drawFor(game,boundary),c=drawFor(game,boundary+e);
      assert.ok(vector(a.position).distanceTo(vector(c.position))<.001,'Boundary center has no pop');checks++;
      assert.ok(quaternion(a.quaternion).angleTo(quaternion(c.quaternion))<.001,'Boundary orientation has no pop');checks++;
      const incoming=vector(b.position).sub(vector(a.position)).divideScalar(e),outgoing=vector(c.position).sub(vector(b.position)).divideScalar(e);
      assert.ok(incoming.distanceTo(outgoing)<.015,'Center velocity is C1 at hold/release and original-path join');checks++;
      const reference=quaternion(b.quaternion),canonical=q=>reference.dot(q)<0?q.toArray().map(n=>-n):q.toArray(),qa=canonical(quaternion(a.quaternion)),qb=reference.toArray(),qc=canonical(quaternion(c.quaternion));
      const derivativeGap=Math.hypot(...qa.map((value,index)=>(qb[index]-value)/e-(qc[index]-qb[index])/e));
      assert.ok(derivativeGap<.015,'Quaternion tangent is continuous after canonicalizing equivalent signs');checks++;
    }
  }
  const untouched=originalFor('dice',.5);
  assert.equal(classicPropPresentation('unsupported',untouched,.1,true),untouched);checks++;
  for(const p of [NaN,Infinity,-1]){
    const draw=classicPropPresentation('dice',{get position(){return poison();},get quaternion(){return poison();}},p,true);
    assert.equal(draw.attached,true,'Invalid progress safely uses held prefix');checks++;
  }

  // Optional bounded collision evidence after the actor's final layout is frozen.
  // The OBB uses actual die surface extrema and the complete exact-skin pieces.
  if(process.env.MASQ_PROP_GEOMETRY==='1'){
    const {makeCoinDealerSkinGeometry,COIN_DEALER_SKIN_PARTS:parts}=await server.ssrLoadModule('/src/CoinDealer.jsx');
    const skinBoxes=[];
    for(const [name,spec] of Object.entries(parts))for(const outer of [false,true])for(const cover of [null,...(spec.up?['up']:[]),...(spec.down?['down']:[])]){
      const geometry=makeCoinDealerSkinGeometry(name,outer,cover);geometries.push(geometry);geometry.computeBoundingBox();
      skinBoxes.push({name:name+'/'+outer+'/'+cover,part:name,box:geometry.boundingBox});
    }
    const dieBox=new THREE.Box3().setFromPoints(classicDieSurfaceVertices().map(vector));
    const failures=[];
    for(let sample=1;sample<=35;sample++){
      const p=CLASSIC_HOST_STAGES.dice.release+(.29-CLASSIC_HOST_STAGES.dice.release)*sample/36,host=classicHostPresentation('dice',p,true),bones=frameFor(host),draw=drawFor('dice',p),dieMatrix=matrix(draw.position,draw.quaternion,.6);
      const dieOBB=new OBB().fromBox3(dieBox).applyMatrix4(dieMatrix);
      dieOBB.center.copy(dieBox.getCenter(new THREE.Vector3())).applyMatrix4(dieMatrix);
      for(const skin of skinBoxes){
        const obb=new OBB().fromBox3(skin.box).applyMatrix4(bones[skin.part]);
        obb.center.copy(skin.box.getCenter(new THREE.Vector3())).applyMatrix4(bones[skin.part]);
        if(dieOBB.intersectsOBB(obb,1e-8)&&failures.length<8)failures.push({p,part:skin.name,dieCenter:draw.position});
        checks++;
      }
    }
    assert.equal(failures.length,0,'Sampled drawn die OBB crosses real sleeve/body bounds after release: '+JSON.stringify(failures));checks++;
  }
  const source=await readFile(new URL('../src/classic-prop-presentation.js',import.meta.url),'utf8');
  assert.ok(!/Math\.random|Date\.now|performance\.now|requestAnimationFrame|setTimeout|setInterval|session\.|round\.|\.won|\.payout/.test(source),'Prop prefix owns no RNG, private result, settlement or second clock');checks++;
}finally{geometries.forEach(g=>g.dispose());await server.close();}
console.log(JSON.stringify({passed:true,checks,geometry:process.env.MASQ_PROP_GEOMETRY==='1',scope:'Public pose only; real held FK; C1 release/join; normalized rotations; exact original reference for final/reduced/skip; optional actual die/skin OBB samples'}));
