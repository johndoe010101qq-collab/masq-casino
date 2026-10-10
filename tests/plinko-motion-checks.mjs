import assert from 'node:assert/strict';
import { plinkoBallPose } from '../src/plinko-motion.js';

const pegs=[];
for(let row=0;row<8;row++) for(let col=0;col<=row;col++) pegs.push([(col-row/2)*.56,1.75-row*.45]);
let samples=0, minimum=Infinity;
for(let ticket=0;ticket<256;ticket++) {
  const path=[0];
  for(let bit=0;bit<8;bit++) path.push(path.at(-1)+((ticket>>bit)&1?1:-1));
  assert.deepEqual(plinkoBallPose(path,0),[0,2.18,.24]);
  const final=plinkoBallPose(path,1);
  assert.ok(Math.abs(final[0]-path[8]*.28)<1e-10);
  assert.ok(Math.abs(final[1]+1.79)<1e-10);
  for(let contact=1;contact<=8;contact++) {
    const point=plinkoBallPose(path,contact/9);
    assert.ok(Math.abs(point[0]-path[contact-1]*.28)<1e-10);
    assert.ok(Math.abs(point[1]-(1.91-(contact-1)*.45))<1e-10);
    const before=plinkoBallPose(path,contact/9-1e-8), after=plinkoBallPose(path,contact/9+1e-8);
    assert.ok(Math.hypot(after[0]-before[0],after[1]-before[1])<1e-6,'Continuous contact');
  }
  for(let step=0;step<=1800;step++) {
    const [x,y,z]=plinkoBallPose(path,step/1800);
    assert.ok(Number.isFinite(x+y+z));
    for(const [px,py] of pegs) {
      const distance=Math.hypot(x-px,y-py);
      minimum=Math.min(minimum,distance);
      assert.ok(distance>=.16-1e-10,`Ball overlaps a peg: ${ticket}/${step}`);
    }
    samples++;
  }
}
console.log(`Plinko motion: ${samples} positions across all 256 paths, no peg penetration; minimum ${minimum.toFixed(4)}.`);
