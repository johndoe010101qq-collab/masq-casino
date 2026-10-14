import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import * as THREE from 'three';
import {OBB} from 'three/addons/math/OBB.js';
import {diceDealerMotion,diceCameraPresentation,DICE_THROW_LAYOUT as diceLayout} from '../src/dice-dealer-motion.js';
import {rouletteDealerMotion,ROULETTE_THROW_LAYOUT as rouletteLayout} from '../src/roulette-dealer-motion.js';
import {classicHostPresentation,CLASSIC_HOST_STAGES} from '../src/classic-host-presentation.js';
import {CLASSIC_DIE_FACES} from '../src/minecraft-classic-motion.js';

let checks=0,failures=0,minFloor=Infinity,minBallClearance=Infinity,maxFrame=0;
const findings=new Map(),v=a=>new THREE.Vector3(...a),q=a=>new THREE.Quaternion(...a);
const check=(condition,key,data)=>{checks++;if(!condition){failures++;if(!findings.has(key))findings.set(key,data);}};
const close=(a,b,key,tolerance=1e-7)=>check(Math.abs(a-b)<tolerance,key,{a,b});
const poison=()=>{throw new Error('Unrevealed result was read');};
const diePrivate={get value(){return poison();}},roulettePrivate={get pocketIndex(){return poison();}};
const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
const geometries=[];
try{
  const {classicDieSupportHeight,classicDieSurfaceVertices}=await server.ssrLoadModule('/src/MinecraftClassicArt.jsx');
  const support=values=>classicDieSupportHeight(q(values))*diceLayout.scale;
  const hull=classicDieSurfaceVertices(),supportCalls=[];
  const trackedSupport=values=>{supportCalls.push(values);return support(values);};
  const {makeCoinDealerSkinGeometry,COIN_DEALER_SKIN_PARTS:parts}=await server.ssrLoadModule('/src/CoinDealer.jsx');
  const {applyClassicHostPose}=await server.ssrLoadModule('/src/ClassicHost.jsx');

  for(const [game,gate,privateRound,motion] of [['dice',.9,diePrivate,(r,p)=>diceDealerMotion(r,p,true,false,trackedSupport)],['roulette',.82,roulettePrivate,(r,p)=>rouletteDealerMotion(r,p,true)]]){
    for(let tick=0;tick<1200;tick++){
      const p=gate*tick/1200,draw=motion(privateRound,p);
      check(draw.position.every(Number.isFinite)&&draw.quaternion.every(Number.isFinite),'finite '+game,{p,draw});
      close(q(draw.quaternion).length(),1,'normalized '+game);
      if(game==='dice'){
        const bottom=draw.position[1]-support(draw.quaternion);minFloor=Math.min(minFloor,bottom);
        check(bottom>=diceLayout.feltTop-1e-8,'die crosses actual felt',{p,bottom});
      }
    }
    const release=classicHostPresentation(game,0).actionRelease,hand=classicHostPresentation(game,release,true);
    const draw=motion(privateRound,release);close(v(draw.position).distanceTo(v(hand.gestureSocket)),0,'Exact hand release '+game);
    for(const boundary of game==='dice'?[release,.29,.55,.9,.98]:[release,.19,.82,.98]){
      const publicRound=game==='dice'?{value:6}:{pocketIndex:36},a=motion(publicRound,boundary-1e-8),b=motion(publicRound,boundary+1e-8);
      check(v(a.position).distanceTo(v(b.position))<1e-5,'Position pop '+game,{boundary,a:a.position,b:b.position});
      check(q(a.quaternion).angleTo(q(b.quaternion))<1e-4,'Orientation pop '+game,{boundary});
    }
  }
  check(supportCalls.length>0,'actual mesh support is used');
  for(const value of [1,2,3,4,5,6]){
    const final=diceDealerMotion({value},1,true,false,support),face=CLASSIC_DIE_FACES.find(item=>item.value===value);
    close(v(face.normal).applyQuaternion(q(final.quaternion)).y,1,'Accepted die face '+value);
    close(final.position[1]-support(final.quaternion),diceLayout.feltTop,'Final die contact '+value);
    const reduced=diceDealerMotion({value},0,true,true,support),complete=diceDealerMotion({value},0,false,false,support);
    close(v(reduced.position).distanceTo(v(final.position)),0,'Reduced die is accepted final');
    close(q(complete.quaternion).angleTo(q(final.quaternion)),0,'Completed die is accepted final');
  }
  for(let tick=0;tick<100;tick++){
    const p=.55+.34*tick/100,a=diceDealerMotion(diePrivate,p,true,false,support),b=diceDealerMotion(diePrivate,p+.001,true,false,support);
    check(q(a.quaternion).angleTo(q(b.quaternion))>.001,'Provisional die face stops before disclosure',{p});
  }
  for(let pocketIndex=0;pocketIndex<37;pocketIndex++){
    const final=rouletteDealerMotion({pocketIndex},1,true),angle=pocketIndex*2*Math.PI/37;
    close(Math.hypot(final.position[0],final.position[2]),rouletteLayout.pocketRadius,'Final pocket radius');
    close(final.position[0],Math.sin(angle)*rouletteLayout.pocketRadius,'Exact pocket x '+pocketIndex);
    close(final.position[2],-Math.cos(angle)*rouletteLayout.pocketRadius,'Exact pocket z '+pocketIndex);
    close(final.wheelDegrees,1800,'Wheel five complete rotations');
    const reduced=rouletteDealerMotion({pocketIndex},0,true,true),complete=rouletteDealerMotion({pocketIndex},0,false);
    close(v(reduced.position).distanceTo(v(final.position)),0,'Reduced roulette accepted final');
    close(v(complete.position).distanceTo(v(final.position)),0,'Completed roulette accepted final');
    let lastAngle=null;
    for(let tick=0;tick<=1000;tick++){
      const p=.07+.93*tick/1000,draw=rouletteDealerMotion({pocketIndex},p,true),current=Math.atan2(draw.position[0],-draw.position[2]);
      if(lastAngle!==null){const turn=Math.atan2(Math.sin(current-lastAngle),Math.cos(current-lastAngle));check(turn<=1e-7,'Roulette reverses clockwise run',{p,pocketIndex,turn});}
      lastAngle=current;
    }
  }

  for(const [width,height] of [[300,272],[960,600]])for(let tick=0;tick<=240;tick++){
    const p=tick/240,draw=diceDealerMotion({value:6},p,true,false,support),pose=diceCameraPresentation(draw);
    const camera=new THREE.OrthographicCamera(-width/2,width/2,height/2,-height/2,.1,60);
    camera.position.fromArray(pose.position);camera.lookAt(...pose.target);camera.zoom=Math.max(1,Math.min(width/pose.width,height/pose.height)*.94);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
    for(const vertex of hull){
      const projected=v(vertex).multiplyScalar(diceLayout.scale).applyQuaternion(q(draw.quaternion)).add(v(draw.position)).project(camera);
      maxFrame=Math.max(maxFrame,Math.abs(projected.x),Math.abs(projected.y));
      check(Math.abs(projected.x)<=.98&&Math.abs(projected.y)<=.98&&Math.abs(projected.z)<1,'Die outside cinematic camera',{p,width,height,ndc:projected.toArray()});
    }
  }
  for(const boundary of [.12,.25,.29,.55,.67,.9,.98]){
    const a=diceCameraPresentation(diceDealerMotion({value:6},boundary-1e-8,true,false,support));
    const b=diceCameraPresentation(diceDealerMotion({value:6},boundary+1e-8,true,false,support));
    check(v(a.position).distanceTo(v(b.position))<1e-5&&v(a.target).distanceTo(v(b.target))<1e-5,'Cinematic camera jumps at transition',{boundary});
    close(a.width,b.width,'Cinematic frame width pop',1e-5);close(a.height,b.height,'Cinematic frame height pop',1e-5);
  }
  const finalCamera=diceCameraPresentation(diceDealerMotion({value:1},1,true,false,support));
  check(v(finalCamera.position).sub(v(finalCamera.target)).normalize().y>.70,'Accepted top face is not readable from landing camera',{finalCamera});

  for(const game of ['dice','roulette']){
    const group=new THREE.Group(),add=(parent,name,position=[0,0,0],rotation=[0,0,0])=>{
      const node=new THREE.Group();node.name=name;node.position.set(...position);node.rotation.set(...rotation);parent.add(node);return node;
    };
    const hip=add(group,'coin-dealer-hip'),waist=add(hip,'coin-dealer-waist'),head=add(waist,'coin-dealer-neck',[0,12/16,0]),bones={body:waist,head};add(group,'coin-dealer-chair');
    for(const side of ['left','right']){
      const suffix=side==='left'?'Left':'Right',shoulder=add(waist,'shoulder-'+side),elbow=add(shoulder,'elbow-'+side),wrist=add(elbow,'wrist-'+side);bones['upper'+suffix]=shoulder;bones['fore'+suffix]=elbow;bones['hand'+suffix]=wrist;
      const thigh=add(hip,'thigh-'+side,[(side==='left'?1:-1)*1.9/16,0,-.1/16],[-Math.acos(1/6),0,0]);
      const shin=add(thigh,'shin-'+side,[0,-6/16,0],[Math.acos(1/6),0,0]),foot=add(shin,'foot-'+side,[0,-4/16,0]);bones['thigh'+suffix]=thigh;bones['shin'+suffix]=shin;bones['foot'+suffix]=foot;
    }
    const fixtures=[];
    for(const [name,spec] of Object.entries(parts))for(const outer of [false,true])for(const cover of [null,...(spec.up?['up']:[]),...(spec.down?['down']:[])]){
      const shape=makeCoinDealerSkinGeometry(name,outer,cover);shape.computeBoundingBox();geometries.push(shape);fixtures.push({name:name+'/'+outer+'/'+cover,bone:bones[name],box:shape.boundingBox});
    }
    for(let tick=0;tick<=1000;tick++){
      const p=tick/1000,host=classicHostPresentation(game,p,true);applyClassicHostPose(group,host);
      hip.position.fromArray(host.dealer.position);waist.quaternion.fromArray(host.dealer.quaternion);head.quaternion.fromArray(host.dealer.head);
      for(const side of ['left','right']){
        const suffix=side==='left'?'Left':'Right',arm=host.dealer[side];bones['upper'+suffix].position.fromArray(arm.shoulder);bones['upper'+suffix].quaternion.fromArray(arm.upper);bones['fore'+suffix].position.fromArray(arm.elbow);bones['fore'+suffix].quaternion.fromArray(arm.lower);bones['hand'+suffix].position.fromArray(arm.wrist);bones['hand'+suffix].quaternion.fromArray(arm.hand);
      }
      group.updateMatrixWorld(true);
      const draw=game==='dice'?diceDealerMotion({value:6},p,true,false,support):rouletteDealerMotion({pocketIndex:36},p,true);
      for(const fixture of fixtures){
        const skin=new OBB().fromBox3(fixture.box).applyMatrix4(fixture.bone.matrixWorld);skin.center.copy(fixture.box.getCenter(new THREE.Vector3())).applyMatrix4(fixture.bone.matrixWorld);
        if(game==='dice'){
          const body=new OBB(v(draw.position),new THREE.Vector3().setScalar(.3306-1e-6),new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q(draw.quaternion))));
          check(!skin.intersectsOBB(body),'Flying die intersects complete skin',{p,part:fixture.name,position:draw.position});
        }else{
          const clearance=skin.clampPoint(v(draw.position),new THREE.Vector3()).distanceTo(v(draw.position))-.083;minBallClearance=Math.min(minBallClearance,clearance);
          check(clearance>=-1e-7,'Flying roulette ball intersects complete skin',{p,part:fixture.name,position:draw.position,clearance});
        }
      }
      if(game==='dice'&&p===0)for(const [width,height] of [[300,272],[960,600]]){
        const pose=diceCameraPresentation({...draw,phase:'idle'}),camera=new THREE.OrthographicCamera(-width/2,width/2,height/2,-height/2,.1,60);
        camera.position.fromArray(pose.position);camera.lookAt(...pose.target);camera.zoom=Math.max(1,Math.min(width/pose.width,height/pose.height)*.94);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
        for(const fixture of fixtures.filter(item=>item.name.startsWith('head'))){
          const box=fixture.box;
          for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
            const ndc=new THREE.Vector3(x,y,z).applyMatrix4(fixture.bone.matrixWorld).project(camera);
            check(Math.abs(ndc.x)<.98&&Math.abs(ndc.y)<.98,'Idle host head outside initial camera',{width,height,ndc:ndc.toArray()});
          }
        }
      }
    }
  }
  for(const path of ['dice-dealer-motion.js','roulette-dealer-motion.js']){
    const source=(await readFile(new URL('../src/'+path,import.meta.url),'utf8')).replace(/\/\/[^\n]*/g,'');
    check(!/Math\.random|Date\.now|performance\.now|setTimeout|setInterval|requestAnimationFrame|session\.complete/.test(source),'Throw adds RNG, wallet or clock',{path});
  }
}finally{geometries.forEach(shape=>shape.dispose());await server.close();}
console.log(JSON.stringify({passed:failures===0,checks,failures,minFloor,minBallClearance,maxFrame,findings:Object.fromEntries(findings)}));
assert.equal(failures,0,'Dealer throw geometry/privacy/camera findings: '+JSON.stringify(Object.fromEntries(findings)));
