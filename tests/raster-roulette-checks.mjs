import assert from 'node:assert/strict';
import {rules,settle,ROULETTE_NUMBERS} from '../src/game-math.js';
import {rasterRoulettePose} from '../src/raster-roulette-motion.js';

// Check the actual selected-bet engine against the terminal visual position.
// A pocket must end at the same sector for every ticket, including zero.
let checks=0;
for(const choice of ['red','black','green',...ROULETTE_NUMBERS]) {
 const config=rules('roulette',choice);
 for(let ticket=0;ticket<config.sampleSize;ticket++) {
  const result=settle('roulette',choice,5,1000,ticket);
  const pose=rasterRoulettePose(result.pocketIndex,1);
  const angle=Math.atan2(pose.ballX-50,50-pose.ballY);
  const index=(Math.round(angle*37/(Math.PI*2))+37)%37;
  assert.equal(ROULETTE_NUMBERS[index],result.number);
  assert.ok(Math.abs(Math.hypot(pose.ballX-50,pose.ballY-50)-31)<1e-8);
  assert.equal(pose.wheelDegrees%360,0);
  checks+=3;
 }
}
for(let index=0;index<37;index++) for(let step=0;step<=100;step++) {
 const pose=rasterRoulettePose(index,step/100);
 assert.ok([pose.ballX,pose.ballY,pose.wheelDegrees].every(Number.isFinite));
 assert.ok(Math.hypot(pose.ballX-50,pose.ballY-50)<=43+1e-8);
 checks+=2;
}
assert.deepEqual(rasterRoulettePose(0,NaN),rasterRoulettePose(0,0));
assert.deepEqual(rasterRoulettePose(-1,2),rasterRoulettePose(0,1));
console.log(`Raster Roulette: ${checks+2} checks; every ticket lands on its actual numbered sector.`);
