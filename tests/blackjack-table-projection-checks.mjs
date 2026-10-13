import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BLACKJACK_TABLE_SCENE as scene, projectBlackjackTablePoint as project,
  blackjackTableHand as hand, blackjackTableCardFlight as flight,
  blackjackTableCardExtraction as extraction, blackjackTableCardTurn as turn,
  blackjackTableCardShadow as shadow } from '../src/blackjack-table-projection.js';

let checks = 0;
const ok = (condition, message) => { assert.ok(condition, message); checks++; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const near = (actual, expected, tolerance = 1e-8, message) => ok(Math.abs(actual - expected) <= tolerance,
  message ?? `${actual} should be within ${tolerance} of ${expected}`);
const rejects = callback => { assert.throws(callback); checks++; };
const transform = (matrix, x, y) => {
  const w = matrix[3] * x + matrix[7] * y + matrix[15];
  return { x: (matrix[0] * x + matrix[4] * y + matrix[12]) / w,
    y: (matrix[1] * x + matrix[5] * y + matrix[13]) / w };
};

// Pinned metadata makes accidental camera/video divergence visible even when
// mathematical round-trip checks would pass with a consistently wrong camera.
equal(scene.camera, { fov:24, target:[0,16.5,14], dir:[0,.38,1], distance:94 });
equal(scene.table, {
  top:12.4, back:5, halfWidth:44, frontCenter:33, frontEdge:20,
  shoe:{pos:[11,12.4,9.8],yaw:.45,mouth:[8.7,14.4,11.1]},
  areas:{dealer:[0,12.4,13],player:[0,12.4,25]},
});
equal(scene.shoe, {x:1187,y:564});
equal(scene.mobileCrop, [656,1264]);
equal([scene.width,scene.height], [1920,1080]);
equal(scene.card, {width:200,height:300,worldWidth:4.4,worldHeight:6.6});
equal(scene.areas.dealer, [[754,607],[1166,607],[1176,658],[744,658]]);
equal(scene.areas.player, [[700,733],[1220,733],[1238,812],[682,812]]);

// Optional direct comparison to the supplied preview package on the integration
// workstation; the fixture above remains portable in a checkout/CI build.
try {
  const supplied = JSON.parse(await readFile(new URL('../../work/dealer-preview-review-v1-20261013/indictus-dealer-preview-v1/scene-layout.json', import.meta.url), 'utf8'));
  equal(scene.camera, supplied.camera);
  equal(scene.table, supplied.table);
  equal(scene.shoe, {x:supplied.shoeMouth[0],y:supplied.shoeMouth[1]});
  equal(scene.areas, {dealer:supplied.dealerArea,player:supplied.playerArea});
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

for (const side of ['dealer','player']) {
  const center = project({x:0,y:12.4,z:side === 'dealer' ? 13 : 25});
  near(center.x, scene.centers[side][0]);
  near(center.y, scene.centers[side][1], .5);
}
const mouth = project({x:8.7,y:14.4,z:11.1});
near(mouth.x,1187,.5);
near(mouth.y,564,.5);
near(project({x:0,y:16.5,z:14}).x,960);
near(project({x:0,y:16.5,z:14}).y,540);

// Independently rounded source-guide corners also pin foreshortening away
// from the central axis, where a wrong FOV could still preserve both anchors.
for (const [side,half,back,front] of [['dealer',8,10.5,15.5],['player',9,22,28]]) {
  [[-half,back],[half,back],[half,front],[-half,front]].forEach(([x,z],index) => {
    const projected = project({x,y:12.4,z});
    near(projected.x,scene.areas[side][index][0],.5);
    near(projected.y,scene.areas[side][index][1],.5);
  });
}

for (const side of ['dealer','player']) for (let count = 0; count <= 21; count++) {
  const cards = hand(side,count);
  equal(cards.length,count);
  ok(Object.isFrozen(cards));
  const bounds = scene.renderBounds[side];
  cards.forEach((card,index) => {
    equal(card.index,index);
    equal(card.side,side);
    equal(card.rect,{width:200,height:300});
    ok(Object.isFrozen(card) && Object.isFrozen(card.corners) && Object.isFrozen(card.worldCenter));
    ok(card.cssTransform.startsWith('matrix3d(') && !card.cssTransform.includes('NaN'));
    ok(card.matrix3d.length === 16 && card.matrix3d.every(Number.isFinite));
    for (const point of card.worldCorners) {
      near(point.y,12.4);
      ok(point.x >= bounds.left && point.x <= bounds.right, 'Card width stays in its felt lane.');
      ok(point.z >= bounds.back && point.z <= bounds.front, 'Card depth stays in its felt lane.');
    }
    for (const point of card.corners) {
      ok(point.x >= 656 && point.x <= 1264, 'Every long-hand corner survives the approved mobile crop.');
      ok(point.y >= 0 && point.y <= 1080 && point.depth > 0);
    }
    [[0,0],[200,0],[200,300],[0,300]].forEach(([x,y],corner) => {
      const mapped = transform(card.matrix3d,x,y);
      near(mapped.x,card.corners[corner].x);
      near(mapped.y,card.corners[corner].y);
    });
    const center = transform(card.matrix3d,100,150);
    near(center.x,card.center.x);
    near(center.y,card.center.y);
    // The same homography maps interior points too, not just four corners.
    const cos = Math.cos(card.angle), sin = Math.sin(card.angle);
    for (const [u,v] of [[.1,.2],[.3,.7],[.8,.9]]) {
      const x = (u-.5)*4.4, z = (v-.5)*6.6;
      const physical = project({x:card.worldCenter.x+cos*x+sin*z,y:12.4,
        z:card.worldCenter.z-sin*x+cos*z});
      const mapped = transform(card.matrix3d,200*u,300*v);
      near(mapped.x,physical.x);
      near(mapped.y,physical.y);
    }
    if (index) ok(card.worldCenter.x > cards[index-1].worldCenter.x, 'Fan preserves every actual card in order.');
  });
}

// The approved visual scale is intentionally larger than the reference guide.
for (const side of ['dealer','player']) {
  const card = hand(side,1)[0];
  const width = Math.max(...card.corners.map(p=>p.x))-Math.min(...card.corners.map(p=>p.x));
  const height = Math.max(...card.corners.map(p=>p.y))-Math.min(...card.corners.map(p=>p.y));
  ok(width >= 119 && width <= 150);
  ok(height >= 60 && height <= 95);
  if (side === 'dealer') near(height,68,3);
  else near(height,90,5);
}

for (const side of ['dealer','player']) for (const count of [1,2,7,21]) {
  for (const card of hand(side,count)) {
    const resting = JSON.stringify(card);
    const start = flight(card,0);
    near(start.center.x,1187);
    near(start.center.y,564);
    equal(flight(card,1),card);
    equal(flight(card,2),card);
    equal(flight(card,-1),start);
    equal(flight(card,NaN),start);
    for (const progress of [0,.05,.25,.5,.75,.95,1]) {
      equal(flight(card,progress,{reducedMotion:true}),card);
      const current = flight(card,progress);
      ok(current.matrix3d.every(Number.isFinite));
      ok(current.corners.every(point => Number.isFinite(point.x) && Number.isFinite(point.y) && point.depth > 0));
      const center = transform(current.matrix3d,100,150);
      near(center.x,current.center.x);
      near(center.y,current.center.y);
    }
    const halfway = flight(card,.5);
    near(halfway.worldCenter.y,16.4);
    ok(halfway.worldCenter.y > card.worldCenter.y, 'Flight lifts above the felt.');
    const almost = flight(card,.999999);
    near(almost.center.x,card.center.x,.0001);
    near(almost.center.y,card.center.y,.0002);
    equal(JSON.stringify(card),resting,'Flight never mutates its resting geometry.');
    const custom = flight(card,0,{origin:{x:1000,y:560}});
    near(custom.center.x,1000);
    near(custom.center.y,560);
  }
}

for (const count of [-1,22,1.5,NaN,undefined]) rejects(()=>hand('dealer',count));
for (const side of ['other',undefined,'__proto__']) rejects(()=>hand(side,2));
for (const point of [{x:NaN,y:0,z:0},{x:0,y:Infinity,z:0},{x:0,y:0,z:1000},
  {x:1e308,y:12.4,z:13},null]) rejects(()=>project(point));
rejects(()=>flight(null,0));
rejects(()=>flight(hand('player',1)[0],0,{origin:{x:Infinity,y:564}}));
equal(Object.isFrozen(scene) && Object.isFrozen(scene.camera.target) && Object.isFrozen(scene.areas.dealer[0]),true);

const area = corners => Math.abs(corners.reduce((sum, point, index) => {
  const next = corners[(index + 1) % corners.length];
  return sum + point.x * next.y - next.x * point.y;
}, 0)) / 2;
for (const side of ['dealer','player']) for (const count of [1,2,7,21]) for (const card of hand(side,count)) {
  const saved = JSON.stringify(card), origin = {x:1113,y:544};
  const inside = extraction(card,0,origin);
  const leading = transform(inside.matrix3d,100,0);
  near(leading.x,scene.shoe.x); near(leading.y,scene.shoe.y);
  const carried = extraction(card,1,origin), held = flight(card,0,{origin,lift:0});
  carried.corners.forEach((point,index)=>{
    near(point.x,held.corners[index].x); near(point.y,held.corners[index].y);
  });
  equal(turn(card,0),card); equal(turn(card,1),card);
  equal(turn(card,.5,{reducedMotion:true}),card);
  for (let step=0;step<=100;step++) {
    const p=step/100, pulled=extraction(card,p,origin), turned=turn(card,p);
    for (const geometry of [pulled,turned]) {
      ok(geometry.matrix3d.every(Number.isFinite),'Shoe pull/edge-on flip never creates a singular CSS matrix.');
      [[0,0],[200,0],[200,300],[0,300]].forEach(([x,y],index)=>{
        const point=transform(geometry.matrix3d,x,y);
        near(point.x,geometry.corners[index].x,1e-5);
        near(point.y,geometry.corners[index].y,1e-5);
      });
    }
    ok(turned.worldCorners.every(point=>point.y>=card.worldCenter.y-1e-9),'Lifted edges cannot cut through the felt.');
    const grounded=shadow(turned);
    grounded.worldCorners.forEach(point=>near(point.y,scene.table.top+.003));
  }
  ok(area(turn(card,.5).corners)<area(card.corners)*.002,'At disclosure the card visibly crosses its physical edge.');
  ok(turn(card,.5).worldCenter.y>card.worldCenter.y+2,'Flip visibly lifts above the felt.');
  equal(JSON.stringify(card),saved,'Extraction/turn never mutates resting hand geometry.');
}
rejects(()=>extraction(null,.5)); rejects(()=>turn(null,.5)); rejects(()=>shadow(null));
console.log(`Blackjack table projection: ${checks} checks passed.`);
