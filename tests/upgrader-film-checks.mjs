import assert from 'node:assert/strict';
import {upgraderFilmMatrix,upgraderFilmPresentation} from '../src/upgrader-film-presentation.js';
let checks=0;
const corners={desktop:[[1204.76,270.07],[1404.24,362.51],[1404.24,558.31],[1204.76,456.18]],mobile:[[471.54,405.56],[586.1,459.4],[586.1,573.42],[471.54,513.95]]};
for(const mobile of [false,true]){
 const m=upgraderFilmMatrix(mobile),expected=corners[mobile?'mobile':'desktop'];
 for(const [i,[x,y]] of [[0,[0,0]],[1,[240,0]],[2,[240,240]],[3,[0,240]]]){
  const w=m[3]*x+m[7]*y+m[15],px=(m[0]*x+m[4]*y+m[12])/w,py=(m[1]*x+m[5]*y+m[13])/w;
  assert.ok(Math.abs(px-expected[i][0])<.001);assert.ok(Math.abs(py-expected[i][1])<.001);checks+=2;
 }
}
const secret={id:9,targetMultiplier:4,get won(){throw Error('Premature outcome');}};
for(let frame=0;frame<920;frame++){
 const p=frame/1000,pose=upgraderFilmPresentation(secret,p,true,4);
 assert.equal(pose.outcome,'pending');assert.equal(pose.reveal,false);assert.ok(pose.fill>=0&&pose.fill<=1);
 assert.equal(pose.activated,p>=21/111);checks+=4;
}
for(const won of [false,true])for(const reduced of [false,true])for(const playing of [false,true]){
 const round={id:1,won,targetMultiplier:8},pose=upgraderFilmPresentation(round,1,playing,8,reduced);
 assert.equal(pose.outcome,won?'success':'denied');assert.equal(pose.multiplier,8);assert.equal(pose.fill,1);
 assert.equal(pose.progress,1);assert.equal(pose.clip,'activate');checks+=5;
}
const idle=upgraderFilmPresentation(null,0,false,1.5);assert.equal(idle.screenLabel,'READY');assert.equal(idle.multiplier,1.5);assert.equal(idle.clip,'idle');checks+=3;
console.log(`Upgrader film: ${checks} checks passed; screen calibration, activation, outcome gate, skip/reduced and selected multiplier.`);
