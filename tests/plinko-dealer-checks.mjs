import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import * as THREE from 'three';
import {OBB} from 'three/addons/math/OBB.js';
import {plinkoBallPose} from '../src/plinko-motion.js';
import {PLINKO_VISUAL_LAYOUT,plinkoVisualPoint} from '../src/plinko-visual-layout.js';
import {plinkoDealerPresentation,plinkoDealerBallPose,plinkoDealerHand,PLINKO_DEALER_STAGE as stage} from '../src/plinko-dealer-presentation.js';

let checks=0,minEntryClearance=Infinity,minBoardClearance=Infinity;
const collisions=[];
const vector=a=>new THREE.Vector3(...a),quaternion=a=>new THREE.Quaternion(...a);
const close=(a,b,message,tolerance=1e-8)=>{assert.ok(Math.abs(a-b)<tolerance,message+': '+a+' / '+b);checks++;};
const poison=()=>{throw new Error('Hidden Plinko data was read');};
const privateFlight=(id,progress)=>{
  const flight={id,progress};
  for(const key of ['path','stake','bin','won','payout','netCents'])Object.defineProperty(flight,key,{get:poison});
  return flight;
};
const renderedPosition=flight=>{
  const entry=plinkoDealerBallPose(flight);
  if(entry)return plinkoVisualPoint(entry.position);
  const point=plinkoBallPose(flight.path,flight.progress);point[2]+=(flight.id%5)*.004;
  return plinkoVisualPoint(point);
};
const ballRadius=stage.ballRadius*PLINKO_VISUAL_LAYOUT.scale;
assert.equal(stage.actorScale,2,'Approved rig is enlarged uniformly');checks++;
close(plinkoVisualPoint([0,-2.68,0])[1],-2.68,'Shared board scale preserves floor contact');
for(const id of [1,2,3,4])for(let tick=0;tick<400;tick++){
  const progress=stage.entryEnd*tick/400,flight=privateFlight(id,progress);
  const ball=plinkoDealerBallPose(flight),pose=plinkoDealerPresentation([flight]),side=plinkoDealerHand(id);
  assert.ok(ball&&ball.position.every(Number.isFinite)&&ball.quaternion.every(Number.isFinite));checks++;
  close(quaternion(ball.quaternion).length(),1,'Entry orientation is normalized');
  close(vector(pose.handSockets[side]).distanceTo(vector(stage.loadSockets[side])),0,'Both gloves keep exact world sockets');
  assert.equal(pose.dealer[side].reached,true,'Slim arm reaches without stretching');checks++;
  if(progress<=stage.release){
    close(vector(renderedPosition(flight)).distanceTo(vector(stage.loadSockets[side])),0,'Held ball contacts selected glove');
    assert.equal(ball.attached,true);checks++;
  }
}
for(const progress of [stage.entryEnd,.3,1,NaN,Infinity,-1]){
  assert.equal(plinkoDealerBallPose({progress,get id(){return poison();},get path(){return poison();}}),null,'Outside entry the old path takes over without reading private data');checks++;
}
for(let id=1;id<=251;id++){
  const side=plinkoDealerHand(id),held=plinkoDealerBallPose({id,progress:.01});
  close(vector(plinkoVisualPoint(held.position)).distanceTo(vector(stage.loadSockets[side])),0,'Every rapid launch uses an actual glove socket');
  const p=stage.entryEnd-1e-8,entry=plinkoDealerBallPose({id,progress:p}),old=plinkoBallPose([0],p);old[2]+=(id%5)*.004;
  assert.ok(vector(entry.position).distanceTo(vector(old))<1e-7,'All ids join unchanged contact and depth');checks++;
  assert.ok(quaternion(entry.quaternion).angleTo(new THREE.Quaternion().setFromEuler(new THREE.Euler(p*8,id,0)))<1e-6,'Spin joins old renderer orientation');checks++;
}
for(const id of [1,2]){
  const e=1e-7,a=plinkoDealerBallPose({id,progress:stage.entryEnd-e}),b=plinkoDealerBallPose({id,progress:stage.entryEnd-2*e});
  for(const [axis,speed] of [[0,0],[1,-4.86],[2,0]])close((a.position[axis]-b.position[axis])/e,speed,'C1 incoming contact speed',.001);
  const before=plinkoDealerBallPose({id,progress:stage.release-e}),after=plinkoDealerBallPose({id,progress:stage.release+e});
  assert.ok(vector(before.position).distanceTo(vector(after.position))<1e-8,'Hold/drop center is continuous');checks++;
  assert.ok(quaternion(before.quaternion).angleTo(quaternion(after.quaternion))<1e-6,'Hold/drop orientation is continuous');checks++;
}
for(const progress of [.01,.04,.075,.105]){
  const pair=plinkoDealerPresentation([privateFlight(1,progress),privateFlight(2,progress)]);
  const batch=plinkoDealerPresentation(Array.from({length:251},(_,i)=>privateFlight(i+1,progress)));
  assert.deepEqual(pair.dealer,batch.dealer,'Concurrent launches share two gestures without queuing or teleporting');checks++;
  assert.equal(batch.feedingCount,251,'Every accepted lead-in remains represented');checks++;
}
assert.deepEqual(plinkoDealerPresentation([privateFlight(1,.06),privateFlight(2,.08)],true).dealer,plinkoDealerPresentation([],true).dealer,'Reduced motion keeps rig neutral');checks++;
const oldPath=await readFile(new URL('../src/plinko-motion.js',import.meta.url));
assert.equal(createHash('sha256').update(oldPath).digest('hex'),'04ef20176b80384e5495828e767658bd8d8da88e73c731e7b8ae3ce3293f081b','Mathematical peg path remains byte-identical');checks++;

const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
const geometries=[];
try{
  const {applyPlinkoDealerPose}=await server.ssrLoadModule('/src/PlinkoDealer.jsx');
  const {makeCoinDealerSkinGeometry,COIN_DEALER_SKIN_PARTS:parts}=await server.ssrLoadModule('/src/CoinDealer.jsx');
  const group=new THREE.Group(),add=(parent,name,position=[0,0,0],rotation=[0,0,0])=>{
    const node=new THREE.Group();node.name=name;node.position.set(...position);node.rotation.set(...rotation);parent.add(node);return node;
  };
  const chair=add(group,'coin-dealer-chair'),hip=add(group,'coin-dealer-hip'),waist=add(hip,'coin-dealer-waist'),head=add(waist,'coin-dealer-neck',[0,12*stage.pixel,0]);
  const bones={body:waist,head};
  for(const side of ['left','right']){
    const suffix=side==='left'?'Left':'Right',shoulder=add(waist,'coin-dealer-shoulder-'+side),elbow=add(shoulder,'coin-dealer-elbow-'+side),wrist=add(elbow,'coin-dealer-wrist-'+side);
    add(wrist,'coin-socket-'+side);bones['upper'+suffix]=shoulder;bones['fore'+suffix]=elbow;bones['hand'+suffix]=wrist;
    const thigh=add(hip,'thigh-'+side,[(side==='left'?1:-1)*1.9*stage.pixel,0,-.1*stage.pixel],[-Math.acos(1/6),0,0]);
    const shin=add(thigh,'shin-'+side,[0,-6*stage.pixel,0],[Math.acos(1/6),0,0]),foot=add(shin,'foot-'+side,[0,-4*stage.pixel,0]);
    bones['thigh'+suffix]=thigh;bones['shin'+suffix]=shin;bones['foot'+suffix]=foot;
  }
  // Use complete actual skin boxes, original outer layer and joint covers.
  // The Plinko adapter hides the old chair, so obsolete perch bounds are excluded.
  const skinBounds=[];
  for(const [name,spec] of Object.entries(parts))for(const outer of [false,true])for(const cover of [null,...(spec.up?['up']:[]),...(spec.down?['down']:[])]){
    const shape=makeCoinDealerSkinGeometry(name,outer,cover);geometries.push(shape);shape.computeBoundingBox();
    skinBounds.push({bone:bones[name],box:shape.boundingBox,name:name+'/'+outer+'/'+cover});
  }
  const cache={},boundsFor=pose=>{
    applyPlinkoDealerPose(group,pose,cache);group.updateMatrixWorld(true);
    assert.equal(chair.visible,false,'Obsolete chair is actually hidden');checks++;
    close(group.scale.x,stage.actorScale,'Uniform actor scale is applied');
    for(const side of ['left','right']){
      const suffix=side==='left'?'Left':'Right',shoulder=bones['upper'+suffix].getWorldPosition(new THREE.Vector3()),elbow=bones['fore'+suffix].getWorldPosition(new THREE.Vector3()),wrist=bones['hand'+suffix].getWorldPosition(new THREE.Vector3());
      close(shoulder.distanceTo(elbow),stage.upperArm*stage.actorScale,'Actual upper arm length is fixed');
      close(elbow.distanceTo(wrist),stage.forearm*stage.actorScale,'Actual forearm length is fixed');
      close(group.getObjectByName('coin-socket-'+side).getWorldPosition(new THREE.Vector3()).distanceTo(vector(stage.loadSockets[side])),0,'Actual FK reaches reported world glove socket');
      assert.equal(pose.dealer[side].reached,true);checks++;
    }
    close(new THREE.Vector3(0,0,1).transformDirection(waist.matrixWorld).distanceTo(new THREE.Vector3(0,0,1)),0,'Mask faces camera while legs stay behind plate');
    return skinBounds.map(item=>{
      const obb=new OBB().fromBox3(item.box).applyMatrix4(item.bone.matrixWorld);
      // Three's OBB.applyMatrix4 scales axes but only adds translation to its
      // center. Skin segments are authored off-origin, so transform the real
      // local center explicitly, including the uniform 2x outer actor scale.
      obb.center.copy(item.box.getCenter(new THREE.Vector3())).applyMatrix4(item.bone.matrixWorld);
      return {...item,obb};
    });
  };
  const checkClearance=(center,bounds,entry,label)=>{
    for(const bound of bounds){
      const distance=bound.obb.clampPoint(center,new THREE.Vector3()).distanceTo(center),clearance=distance-ballRadius;
      if(entry)minEntryClearance=Math.min(minEntryClearance,clearance);else minBoardClearance=Math.min(minBoardClearance,clearance);
      if(clearance<-1e-8&&collisions.length<8)collisions.push({label,part:bound.name,position:center.toArray(),clearance});
      checks++;
    }
  };
  // Each released lead-in is checked while the other glove is idle or active.
  for(const id of [1,2])for(let tick=1;tick<=60;tick++){
    const progress=stage.release+(stage.entryEnd-stage.release)*tick/61;
    for(const otherProgress of [0,stage.entryEnd/2]){
      const flights=[privateFlight(id,progress),privateFlight(id+1,otherProgress)],bounds=boundsFor(plinkoDealerPresentation(flights));
      checkClearance(vector(renderedPosition(flights[0])),bounds,true,'Released entry id='+id+', p='+progress);
    }
  }
  // These 72 distinct row/direction segments exhaust all 256 possible paths.
  // Sample each full bounce once instead of repeatedly testing duplicate prefixes.
  for(const feeding of [[],[privateFlight(1,.055)],[privateFlight(2,.055)],[privateFlight(1,.055),privateFlight(2,.055)]]){
    const bounds=boundsFor(plinkoDealerPresentation(feeding));
    for(let row=0;row<8;row++)for(let prefix=-row;prefix<=row;prefix+=2)for(const direction of [-1,1]){
      const path=Array(9).fill(0);path[row]=prefix;path[row+1]=prefix+direction;
      for(let sample=0;sample<=20;sample++)for(const depth of [0,.016]){
        const progress=(row+1+sample/20)/9,point=plinkoBallPose(path,progress);point[2]+=depth;
        checkClearance(vector(plinkoVisualPoint(point)),bounds,false,'Board row='+row+', prefix='+prefix+', direction='+direction+', p='+progress);
      }
    }
  }
  assert.equal(collisions.length,0,'Drawn skin intersects accepted ball curves: '+JSON.stringify({minEntryClearance,minBoardClearance,collisions}));checks++;
  const renderer=await readFile(new URL('../src/PlinkoDealer.jsx',import.meta.url),'utf8'),motion=await readFile(new URL('../src/plinko-dealer-presentation.js',import.meta.url),'utf8');
  assert.ok(renderer.includes('useLoader(THREE.TextureLoader,COIN_DEALER_SKIN)')&&renderer.includes('controller?.render?.()'),'Texture-ready idle mount redraws through existing controller');checks++;
  for(const source of [renderer,motion]){
    assert.ok(!/Math\.random|Date\.now|performance\.now|requestAnimationFrame|setTimeout|setInterval|session\.complete|flight\.path|flight\.stake|flight\.bin|flight\.payout/.test(source),'Actor/entry owns no RNG, hidden path, wallet or second clock');checks++;
  }
}finally{geometries.forEach(g=>g.dispose());await server.close();}
console.log(JSON.stringify({passed:true,checks,minEntryClearance,minBoardClearance,scope:'2x exact skin FK/OBBs; two world glove sockets; blind concurrent lead-in; C1 old contact; all distinct board arcs; hidden old chair; existing controller clock'}));
