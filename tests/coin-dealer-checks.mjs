import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import * as THREE from 'three';
import {coinDealerPresentation,coinDealerCoinSupport,coinDealerFlightTime,COIN_DEALER_STAGE as stage} from '../src/coin-dealer-presentation.js';

let checks=0,minSleeveClearance=Infinity,minCoinClearance=Infinity;
const close=(a,b,message,tolerance=1e-9)=>{assert.ok(Math.abs(a-b)<tolerance,message+`: ${a} / ${b}`);checks++;};
const v=value=>new THREE.Vector3(...value),q=value=>new THREE.Quaternion(...value);
const matrix=(position,quaternion)=>new THREE.Matrix4().compose(v(position),q(quaternion),new THREE.Vector3(1,1,1));
const poison=()=>{throw new Error('A private outcome was read');};
for(let tick=0;tick<900;tick++) {
  const progress=tick/1000,privateRound={get face(){return poison();}};
  for(const key of ['won','payout','stake','netCents'])Object.defineProperty(privateRound,key,{get:poison});
  const common=coinDealerPresentation(privateRound,progress,true);
  assert.equal(common.reveal,false,'Common motion cannot label a result before the public boundary');checks++;
  assert.deepEqual(coinDealerPresentation({face:'heads'},progress,true),coinDealerPresentation({face:'tails'},progress,true),'Dealer, hand, coin and flight are identical for either private outcome');checks++;
  if(progress<stage.release){assert.deepEqual(common.coin.position,common.handSocket,'Held coin remains on the actual moving hand socket');checks++;}
}
for(const face of ['heads','tails']) {
  const result=coinDealerPresentation({face},1,false),reduced=coinDealerPresentation({face},.1,true,true);
  close(v([0,0,1]).applyQuaternion(q(result.coin.quaternion)).y,face==='heads'?1:-1,'Accepted side lies face up on the real felt');
  close(v([0,1,0]).applyQuaternion(q(result.coin.quaternion)).z,-1,'Both accepted faces read upright from the front of the table');
  assert.deepEqual(reduced.coin,result.coin,'Reduced/skip uses the same accepted physical endpoint');checks++;
  assert.equal(result.attached,false);checks++;
  close(result.coin.position[1]-coinDealerCoinSupport(q(result.coin.quaternion)),-1.1975,'Settled coin rests on the exact drawn table height');
}
for(const progress of [NaN,Infinity,-1]) {
  const pose=coinDealerPresentation({get face(){return poison();}},progress,true);
  assert.equal(pose.progress,0);checks++;
  assert.deepEqual(pose.coin,coinDealerPresentation({face:'heads'},0,true).coin);checks++;
}
const before=coinDealerPresentation({get face(){return poison();}},stage.release-1e-7,true);
const at=coinDealerPresentation({get face(){return poison();}},stage.release,true);
const after=coinDealerPresentation({get face(){return poison();}},stage.release+1e-7,true);
close(v(at.coin.position).distanceTo(v(at.handSocket)),0,'The physical handoff shares one exact world socket');
assert.ok(v(before.coin.position).distanceTo(v(after.coin.position))<2e-6,'Position stays continuous across release');checks++;
assert.ok(q(before.coin.quaternion).angleTo(q(after.coin.quaternion))<.00002,'Orientation stays continuous across release');checks++;
const velocityBefore=v(at.coin.position).sub(v(before.coin.position)).multiplyScalar(1e7);
const velocityAfter=v(after.coin.position).sub(v(at.coin.position)).multiplyScalar(1e7);
assert.ok(velocityBefore.distanceTo(velocityAfter)<.0001,'Release velocity matches the hand motion and ballistic flight');checks++;
for(const face of ['heads','tails'])for(const boundary of [stage.reveal,stage.landing]) {
  const a=coinDealerPresentation({face},boundary-1e-7,true),b=coinDealerPresentation({face},boundary+1e-7,true);
  assert.ok(v(a.coin.position).distanceTo(v(b.coin.position))<2e-6,'Reveal and landing do not jump the coin center');checks++;
  assert.ok(q(a.coin.quaternion).angleTo(q(b.coin.quaternion))<.0001,'Reveal and landing have continuous orientation');checks++;
}
// The flight stays monotone and uses one progress source. Slow motion changes
// spatial speed, while the private coin keeps visibly flipping up to disclosure.
let previousFlight=0;
for(let tick=0;tick<=1000;tick++) {
  const progress=stage.release+(stage.landing-stage.release)*tick/1000,time=coinDealerFlightTime(progress);
  assert.ok(Number.isFinite(time.progress)&&Number.isFinite(time.velocity)&&time.progress>=previousFlight-1e-12&&time.progress<=1,'Retimed flight cannot rewind, jump or leave the original arc');checks++;
  if(tick<1000){assert.ok(time.velocity>0,'A cinematic apex never freezes into a fake settled face');checks++;}
  previousFlight=time.progress;
  const actual=coinDealerPresentation({face:'heads'},progress,true);
  close(actual.flightProgress,time.progress,'Camera tracking receives the same physical time used by the actual coin');
}
for(const progress of [NaN,Infinity,-1])assert.deepEqual(coinDealerFlightTime(progress),{progress:0,velocity:0});checks+=3;
const speedBetween=(start,end)=>(coinDealerFlightTime(end).progress-coinDealerFlightTime(start).progress)/(end-start);
const burstSpeed=speedBetween(.29,.33),apexSpeed=speedBetween(.46,.54),finalDescentSpeed=speedBetween(.90,.96);
assert.ok(burstSpeed>apexSpeed*2,'The release rises quickly before lingering around the apex');checks++;
assert.ok(finalDescentSpeed<burstSpeed*.15,'The final descent uses controlled slow motion');checks++;
const angularSpeed=progress=>q(coinDealerPresentation({face:'heads'},progress-.0001,true).coin.quaternion).angleTo(q(coinDealerPresentation({face:'heads'},progress+.0001,true).coin.quaternion))/.0002;
for(const progress of [.86,.88,.895]){assert.ok(angularSpeed(progress)>4,'The unrevealed coin keeps visibly flipping close to the public boundary');checks++;}
const edgeNormal=v([0,0,1]).applyQuaternion(q(coinDealerPresentation({face:'heads'},stage.reveal,true).coin.quaternion));
assert.ok(Math.abs(edgeNormal.y)<.01,'Common motion arrives edge-on instead of nearly landing on a provisional heads result');checks++;
for(const face of ['heads','tails']) {
  const boundary=stage.reveal,step=1e-7;
  const a=coinDealerPresentation({face},boundary-step,true).coin.quaternion,b=coinDealerPresentation({face},boundary,true).coin.quaternion,c=coinDealerPresentation({face},boundary+step,true).coin.quaternion;
  const derivativeGap=Math.hypot(...a.map((value,index)=>(b[index]-value)/step-(c[index]-b[index])/step));
  assert.ok(derivativeGap<.001,'The public face turn continues the actual angular velocity without a reveal pop');checks++;
  const landed=coinDealerPresentation({face},stage.landing,true),finished=coinDealerPresentation({face},1,true);
  assert.deepEqual(landed.coin,finished.coin,'Accepted face remains still and readable after the final contact');checks++;
  close(landed.coin.position[1]-coinDealerCoinSupport(q(landed.coin.quaternion)),stage.feltTop,'Final cinematic contact preserves exact felt support');
}
const idle=coinDealerPresentation(null,0,false),returned=coinDealerPresentation({face:'heads'},1,false);
assert.deepEqual(idle.dealer,returned.dealer,'Whole seated actor returns to the same neutral pose');checks++;
const skinBytes=await readFile(new URL('../public/masq-dealer-skin-v36.png',import.meta.url));
assert.equal(createHash('sha256').update(skinBytes).digest('hex'),'15f78c57554093f495f291cd19b75f7d5bbd93472b0acc09d943c14ef5d5b358','Approved skin is used unchanged');checks++;

const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
const geometry=[];
try {
  const {makeCoinDealerSkinGeometry,COIN_DEALER_SKIN_PARTS:parts,COIN_DEALER_SKIN}=await server.ssrLoadModule('/src/CoinDealer.jsx');
  assert.equal(COIN_DEALER_SKIN,'/masq-dealer-skin-v36.png');checks++;
  const limbGeometry={};
  for(const [name,part] of Object.entries(parts)) {
    for(const outer of [false,true])for(const cover of [null,...(part.up?['up']:[]),...(part.down?['down']:[])]) {
      const shape=makeCoinDealerSkinGeometry(name,outer,cover);geometry.push(shape);
      const uv=shape.attributes.uv.array;
      assert.ok([...uv].every(value=>Number.isFinite(value)&&value>=0&&value<=1),'Every face samples inside the original 64x64 atlas');checks++;
      const [atlasX,atlasY]=outer?part.outer:part.uv,[width,,depth]=part.box,[r0,r1]=shape.userData.rows;
      const front=[...uv.slice(32,40)],frontU=front.filter((_,index)=>index%2===0),frontV=front.filter((_,index)=>index%2===1);
      close(Math.min(...frontU),(atlasX+depth)/64,'The front face keeps its exact original source columns');
      close(Math.max(...frontU),(atlasX+depth+width)/64,'Skin faces are never widened by resizing the atlas');
      close(Math.min(...frontV),1-(atlasY+depth+r1)/64,'Lower limb row samples preserve the exact source seam');
      close(Math.max(...frontV),1-(atlasY+depth+r0)/64,'Upper limb row samples preserve the exact source seam');
      if(name.startsWith('upper')||name.startsWith('fore')||name.startsWith('hand')) {
        assert.equal(shape.userData.sourceBox[0],3,'Both arms retain the supplied slim three-pixel width');checks++;
        (limbGeometry[name]??=[]).push(shape);
      }
    }
  }
  // Rebuild the exact renderer's joint hierarchy independently and transform
  // the real segmented sleeve vertices, including both outer joint covers.
  for(let tick=0;tick<=1000;tick+=2) {
    const pose=coinDealerPresentation({face:'heads'},tick/1000,true),root=matrix(pose.dealer.position,pose.dealer.quaternion);
    for(const side of ['right','left']) {
      const arm=pose.dealer[side],upper=root.clone().multiply(matrix(arm.shoulder,arm.upper));
      const lower=upper.clone().multiply(matrix(arm.elbow,arm.lower));
      const hand=lower.clone().multiply(matrix(arm.wrist,arm.hand));
      const socket=v(arm.socketLocal).applyMatrix4(hand);
      close(socket.distanceTo(v(arm.socketWorld)),0,'Actual shoulder/elbow/wrist hierarchy reaches the returned coin socket');
      assert.equal(arm.reached,true,'The gesture never stretches a limb to reach an impossible target');checks++;
      close(v(arm.shoulderWorld).distanceTo(v(arm.elbowWorld)),stage.upperArm,'Upper arm length stays fixed');
      close(v(arm.elbowWorld).distanceTo(v(arm.wristWorld)),stage.forearm,'Forearm length stays fixed');
      const suffix=side==='right'?'Right':'Left';
      for(const [prefix,transform] of [['upper',upper],['fore',lower],['hand',hand]])for(const shape of limbGeometry[prefix+suffix]) {
        const positions=shape.attributes.position;
        for(let index=0;index<positions.count;index++) {
          const point=new THREE.Vector3().fromBufferAttribute(positions,index).applyMatrix4(transform);
          if(point.z>=-2.4&&Math.abs(point.x)<=4) {
            minSleeveClearance=Math.min(minSleeveClearance,point.y-stage.feltTop);
            assert.ok(point.y>=stage.feltTop-1e-9,`Whole sleeve clears felt (p=${tick/1000}, ${side}/${prefix}, ${shape.userData.cover}, outer=${shape.userData.outer}, point=${point.toArray()})`);checks++;
          }
        }
      }
    }
  }
  // Independently sample the rotated cylinder's entire physical envelope, not
  // just its center. Both accepted faces must stay on/above felt throughout.
  for(const face of ['heads','tails'])for(let tick=0;tick<=1000;tick++) {
    const pose=coinDealerPresentation({face},tick/1000,true),rotation=q(pose.coin.quaternion),center=v(pose.coin.position);
    for(const end of [-1,1])for(let angle=0;angle<64;angle++) {
      const point=new THREE.Vector3(Math.cos(angle*Math.PI/32)*stage.coinRadius*stage.coinScale,Math.sin(angle*Math.PI/32)*stage.coinRadius*stage.coinScale,end*stage.coinHalfThickness*stage.coinScale).applyQuaternion(rotation).add(center);
      minCoinClearance=Math.min(minCoinClearance,point.y-stage.feltTop);
      assert.ok(point.y>=stage.feltTop-1e-9,'Coin rim and minted relief cannot cut through the real felt');checks++;
    }
  }
} finally {
  geometry.forEach(shape=>shape.dispose());await server.close();
}
const renderer=await readFile(new URL('../src/CoinDealer.jsx',import.meta.url),'utf8'),motion=await readFile(new URL('../src/coin-dealer-presentation.js',import.meta.url),'utf8');
for(const source of [renderer,motion]) {
  assert.ok(!/Math\.random|Date\.now|performance\.now|requestAnimationFrame|setTimeout|setInterval|session\.complete/.test(source),'Dealer uses the existing paid progress only and never settles money');checks++;
}
console.log(JSON.stringify({passed:true,checks,minSleeveClearance,minCoinClearance,scope:'Exact skin UV rows and FK, private outcome gate, continuous retimed handoff, ongoing private flips, slow descent, upright accepted faces, and actual sleeve/coin felt envelopes'}));
