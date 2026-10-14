import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import * as THREE from 'three';
import {OBB} from 'three/addons/math/OBB.js';
import {classicHostPresentation,CLASSIC_HOST_STAGES,CLASSIC_HOST_CAMERAS} from '../src/classic-host-presentation.js';
import {diceTossPresentation} from '../src/dice-toss-presentation.js';
import {minecraftRoulettePose} from '../src/minecraft-classic-motion.js';
import {classicPropPresentation} from '../src/classic-prop-presentation.js';

let checks=0,minimumClearance=Infinity;
const v=a=>new THREE.Vector3(...a),q=a=>new THREE.Quaternion(...a);
const close=(a,b,message,tolerance=1e-8)=>{assert.ok(Math.abs(a-b)<tolerance,message+': '+a+' / '+b);checks++;};
const poison=()=>{throw new Error('Private result was inspected by a host');};
assert.equal(classicHostPresentation('blackjack'),null,'Existing accepted Blackjack is not replaced');checks++;
assert.equal(classicHostPresentation('coinflip'),null,'Existing accepted Coinflip is not replaced');checks++;
for(const [game,config] of Object.entries(CLASSIC_HOST_STAGES)){
  const neutral=classicHostPresentation(game,0,false),privatePlaying={};
  for(const key of ['face','value','number','won','payout','stake','result'])Object.defineProperty(privatePlaying,key,{get:poison});
  for(let tick=0;tick<=1000;tick++){
    const p=tick/1000,pose=classicHostPresentation(game,p,privatePlaying);
    assert.ok(pose.gestureSocket.every(Number.isFinite));checks++;
    for(const part of ['quaternion','head'])close(q(pose.dealer[part]).length(),1,'Normalized torso/head');
    for(const side of ['left','right']){
      const arm=pose.dealer[side];assert.equal(arm.reached,true,game+' '+side+' must never stretch');checks++;
      for(const part of ['upper','lower','hand'])close(q(arm[part]).length(),1,'Normalized articulated joint');
      close(v(arm.shoulderWorld).distanceTo(v(arm.elbowWorld)),pose.stage.upperArm,'Fixed upper arm length');
      close(v(arm.elbowWorld).distanceTo(v(arm.wristWorld)),pose.stage.forearm,'Fixed forearm length');
      close(v(arm.socketWorld).multiplyScalar(config.scale).add(v(config.position)).distanceTo(v(pose.handSockets[side])),0,'Returned socket is in scene world coordinates');
    }
  }
  for(const p of [0,.05,.1,.2,.5,.9,1,NaN,Infinity,-1,2]){
    assert.deepEqual(classicHostPresentation(game,p,false).dealer,neutral.dealer,'Inactive host stays neutral');checks++;
    assert.deepEqual(classicHostPresentation(game,p,true,true).dealer,neutral.dealer,'Reduced motion is neutral');checks++;
  }
  const release=classicHostPresentation(game,config.release,true);
  close(v(release.gestureSocket).distanceTo(v(config.contact)),0,'Release contacts the real rear tray/rim/side control');
  assert.equal(release.actionRelease,config.release);checks++;
  assert.equal(release.attached,false);checks++;
  assert.equal(classicHostPresentation(game,config.release-1e-8,true).attached,true);checks++;
  for(const boundary of [config.release*.55,config.release,config.release+.07,config.returnNeutral]){
    const a=classicHostPresentation(game,boundary-1e-8,true),b=classicHostPresentation(game,boundary+1e-8,true);
    assert.ok(v(a.gestureSocket).distanceTo(v(b.gestureSocket))<1e-6,'No hand teleport at '+game+' '+boundary);checks++;
    for(const side of ['left','right'])for(const part of ['upper','lower','hand'])assert.ok(q(a.dealer[side][part]).angleTo(q(b.dealer[side][part]))<1e-5,'No joint pop at gesture transfer');checks++;
  }
  assert.deepEqual(classicHostPresentation(game,1,true).dealer,neutral.dealer,'Whole host returns to the same neutral pose');checks++;
  const camera=CLASSIC_HOST_CAMERAS[game];assert.ok(camera.at.every(Number.isFinite)&&camera.width>0&&camera.height>0);checks++;
}

const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
const shapes=[];
try{
  const {applyClassicHostPose}=await server.ssrLoadModule('/src/ClassicHost.jsx');
  const {makeCoinDealerSkinGeometry,COIN_DEALER_SKIN_PARTS:parts}=await server.ssrLoadModule('/src/CoinDealer.jsx');
  const {classicDieSupportHeight}=await server.ssrLoadModule('/src/MinecraftClassicArt.jsx');
  for(const [game,config] of Object.entries(CLASSIC_HOST_STAGES)){
    const group=new THREE.Group(),add=(parent,name,position=[0,0,0],rotation=[0,0,0])=>{
      const node=new THREE.Group();node.name=name;node.position.set(...position);node.rotation.set(...rotation);parent.add(node);return node;
    };
    const chair=add(group,'coin-dealer-chair'),hip=add(group,'coin-dealer-hip'),waist=add(hip,'coin-dealer-waist'),head=add(waist,'coin-dealer-neck',[0,12/16,0]),bones={body:waist,head};
    for(const side of ['left','right']){
      const suffix=side==='left'?'Left':'Right',shoulder=add(waist,'coin-dealer-shoulder-'+side),elbow=add(shoulder,'coin-dealer-elbow-'+side),wrist=add(elbow,'coin-dealer-wrist-'+side);
      add(wrist,'coin-socket-'+side);bones['upper'+suffix]=shoulder;bones['fore'+suffix]=elbow;bones['hand'+suffix]=wrist;
      const thigh=add(hip,'thigh-'+side,[(side==='left'?1:-1)*1.9/16,0,-.1/16],[-Math.acos(1/6),0,0]);
      const shin=add(thigh,'shin-'+side,[0,-6/16,0],[Math.acos(1/6),0,0]),foot=add(shin,'foot-'+side,[0,-4/16,0]);
      bones['thigh'+suffix]=thigh;bones['shin'+suffix]=shin;bones['foot'+suffix]=foot;
    }
    const fixtures=[];
    for(const [name,spec] of Object.entries(parts))for(const outer of [false,true])for(const cover of [null,...(spec.up?['up']:[]),...(spec.down?['down']:[])]){
      const shape=makeCoinDealerSkinGeometry(name,outer,cover);shape.computeBoundingBox();shapes.push(shape);
      fixtures.push({bone:bones[name],box:shape.boundingBox,name:name+'/'+outer+'/'+cover});
    }
    const setPose=pose=>{
      applyClassicHostPose(group,pose);
      chair.position.set(0,pose.stage.floor,pose.stage.actorZ);
      hip.position.fromArray(pose.dealer.position);waist.quaternion.fromArray(pose.dealer.quaternion);head.quaternion.fromArray(pose.dealer.head);
      for(const side of ['left','right']){
        const suffix=side==='left'?'Left':'Right',arm=pose.dealer[side];
        bones['upper'+suffix].position.fromArray(arm.shoulder);bones['upper'+suffix].quaternion.fromArray(arm.upper);
        bones['fore'+suffix].position.fromArray(arm.elbow);bones['fore'+suffix].quaternion.fromArray(arm.lower);
        bones['hand'+suffix].position.fromArray(arm.wrist);bones['hand'+suffix].quaternion.fromArray(arm.hand);
        group.getObjectByName('coin-socket-'+side).position.fromArray(arm.socketLocal);
      }
      group.updateMatrixWorld(true);
    };
    for(let tick=0;tick<=120;tick++){
      const p=tick/120,pose=classicHostPresentation(game,p,true);setPose(pose);
      close(new THREE.Vector3(0,0,1).transformDirection(waist.matrixWorld).z,Math.cos(-.018*(pose.phase==='idle'?0:1)),'Frontal torso stays independent of tucked legs',.001);
      close(new THREE.Vector3(0,0,1).transformDirection(chair.matrixWorld).z,1,'Chair remains properly oriented behind host');
      close(chair.getWorldPosition(new THREE.Vector3()).y,-1.78,'Chair is supported on real studio floor');
      close(hip.getWorldPosition(new THREE.Vector3()).y,-1.78+7/16*config.scale,'Seat height matches body hip');
      for(const side of ['left','right'])close(group.getObjectByName('coin-socket-'+side).getWorldPosition(new THREE.Vector3()).distanceTo(v(pose.handSockets[side])),0,'Actual shared-rig FK matches prop socket');
      for(const fixture of fixtures){
        const box=new THREE.Box3().copy(fixture.box).applyMatrix4(fixture.bone.matrixWorld);
        if(fixture.name.startsWith('foot')){
          const solePadding=parts.footRight.inflate/2*pose.dealer.pixel*config.scale;
          assert.ok(box.min.y>=-1.78-solePadding-1e-8,'Only the exact scaled outer sole padding extends below the floor');checks++;
          if(fixture.name.endsWith('/null')){assert.ok(box.min.y<=-1.779,'Complete feet touch the supported floor');checks++;}
        }
        if(game==='upgrader')continue;
        if(p>=config.release)continue;
        const body=new OBB().fromBox3(fixture.box).applyMatrix4(fixture.bone.matrixWorld);
        body.center.copy(fixture.box.getCenter(new THREE.Vector3())).applyMatrix4(fixture.bone.matrixWorld);
        const center=v(pose.gestureSocket);
        if(game==='roulette'){
          const clearance=body.clampPoint(center,new THREE.Vector3()).distanceTo(center)-config.propRadius;
          minimumClearance=Math.min(minimumClearance,clearance);
          assert.ok(clearance>=-1e-7,'Released ball is outside whole '+fixture.name+': '+clearance);checks++;
        }else{
          const held=new OBB(center,new THREE.Vector3().setScalar(config.propRadius-1e-6));
          assert.equal(body.intersectsOBB(held),false,'Held solid die must not pass through '+fixture.name+' at p='+p);checks++;
        }
      }
    }
    if(game!=='upgrader')for(let tick=0;tick<=400;tick++){
      const join=game==='dice'?.29:.19,p=config.release+(join-config.release)*tick/400;
      const host=classicHostPresentation(game,p,true);setPose(host);
      let original;
      if(game==='dice'){
        const render=diceTossPresentation({get value(){return poison();}},p,true);
        original={position:[render.x,-.8535+classicDieSupportHeight(q(render.quaternion))*.6+render.lift,render.z],quaternion:render.quaternion};
      }else{
        const render=minecraftRoulettePose({pocketIndex:0},p,true);
        original={position:[Math.sin(render.angle)*render.radius,-.070,-Math.cos(render.angle)*render.radius],quaternion:[0,0,0,1]};
      }
      const draw=classicPropPresentation(game,original,p,true);
      for(const fixture of fixtures){
        const body=new OBB().fromBox3(fixture.box).applyMatrix4(fixture.bone.matrixWorld);
        body.center.copy(fixture.box.getCenter(new THREE.Vector3())).applyMatrix4(fixture.bone.matrixWorld);
        if(game==='dice'){
          const held=new OBB(v(draw.position),new THREE.Vector3().setScalar(config.propRadius-1e-6),new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q(draw.quaternion))));
          assert.equal(body.intersectsOBB(held),false,'Actual launched die clears '+fixture.name+' at p='+p);checks++;
        }else{
          const clearance=body.clampPoint(v(draw.position),new THREE.Vector3()).distanceTo(v(draw.position))-config.propRadius;
          assert.ok(clearance>=-1e-7,'Actual launched roulette ball clears '+fixture.name+' at p='+p+': '+clearance);checks++;
        }
      }
    }
  }
  const source=await readFile(new URL('../src/ClassicHost.jsx',import.meta.url),'utf8'),motion=await readFile(new URL('../src/classic-host-presentation.js',import.meta.url),'utf8');
  assert.ok(source.includes('useLoader(THREE.TextureLoader,COIN_DEALER_SKIN)')&&source.includes('useLayoutEffect')&&source.includes('invalidate()'),'First idle draw waits for exact cached skin');checks++;
  for(const code of [source,motion]){
    const executable=code.replace(/\/\/[^\n]*/g,'');
    assert.ok(!/Math\.random|Date\.now|performance\.now|requestAnimationFrame|setTimeout|setInterval|\bround[?.]|session\.complete|\.won|\.payout/.test(executable),'Presentation owns no private result, random draw, payout or second clock');checks++;
  }
  const skin=await readFile(new URL('../public/masq-dealer-skin-v36.png',import.meta.url));
  assert.equal(createHash('sha256').update(skin).digest('hex'),'15f78c57554093f495f291cd19b75f7d5bbd93472b0acc09d943c14ef5d5b358','Supplied exact Minecraft skin stays unchanged');checks++;
}finally{shapes.forEach(shape=>shape.dispose());await server.close();}
console.log(JSON.stringify({passed:true,checks,minimumClearance,scope:'Public-only three host gestures; real slim FK/skin; supported chair; complete limbs clear held die/ball; neutral/reduced/transfer continuity; no private round or second clock'}));
