import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {Quaternion,Vector3} from 'three';
import {DICE_FILM,diceFilmAcceptedValue,diceFilmPresentation} from '../src/dice-film-presentation.js';
import {classicFilmTime} from '../src/classic-film-playback.js';
const root=new URL('../public/classic-films-v49/dice/',import.meta.url);
const calibration=JSON.parse(await fs.readFile(new URL('source-calibration.json',root),'utf8'));
const manifest=JSON.parse(await fs.readFile(new URL('media-manifest.json',root),'utf8'));
const normals={'+x':[1,0,0],'-x':[-1,0,0],'+y':[0,1,0],'-y':[0,-1,0],'+z':[0,0,1],'-z':[0,0,-1]};
for(let value=1;value<=6;value++){
  const accepted={id:value,dieValue:value,get won(){throw Error('Presentation read won');},get payout(){throw Error('Presentation read payout');}};
  assert.equal(diceFilmAcceptedValue(accepted),value);
  assert.equal(diceFilmAcceptedValue({value}),value);
  const proof=calibration.variants[value],q=new Quaternion(...proof.last.quat).normalize();
  const up=Object.entries(normals).map(([face,n])=>({value:proof.faces[face],up:new Vector3(...n).applyQuaternion(q).y})).sort((a,b)=>b.up-a.up)[0];
  assert.equal(up.value,value,'The actual filmed rest quaternion must put the named face on top');
  assert.ok(up.up>.9999);
  assert.equal(DICE_FILM.settled[value],proof.settled);
  assert.equal(DICE_FILM.holdEnd[value],proof.holdEnd);
  assert.equal(diceFilmPresentation(value,0,true).clip,`roll_${value}`);
  assert.equal(diceFilmPresentation(value,(42-1e-5)/138,true).clip,`roll_${value}`);
  const cut=diceFilmPresentation(value,42/138,true);
  assert.equal(cut.clip,`roll_${value}_close`);
  assert.equal(cut.progress,42/138,'The camera cut must not restart the film from frame zero');
  for(let frame=0;frame<=138;frame++){
    const draw=diceFilmPresentation(value,frame/138,true);
    assert.equal(draw.value,value);
    assert.equal(draw.settled,frame>=proof.settled);
    assert.ok(draw.clip.startsWith(`roll_${value}`),'Footage never changes its accepted face midway');
  }
  for(const draw of [diceFilmPresentation(value,0,true,true),diceFilmPresentation(value,.2,false),diceFilmPresentation(value,1,true)]){
    assert.equal(draw.progress,1);assert.equal(draw.clip,`roll_${value}_close`);assert.equal(draw.phase,'result');
  }
}
for(const value of [null,undefined,NaN,0,-1,7,1.5,'1']){
  assert.equal(diceFilmAcceptedValue({dieValue:value}),null);
  assert.equal(diceFilmPresentation(value,1,true).clip,'idle','Missing/malformed accepted result never fabricates face1');
}
for(const p of [undefined,NaN,Infinity,-Infinity,-1])assert.equal(diceFilmPresentation(2,p,true).progress,0);
assert.ok(Math.abs(classicFilmTime(139/30,1)-4.6)<1e-12,'Completion seeks the last decoded frame, not past the endpoint');
assert.equal(manifest.files.length,26);
for(const file of manifest.files){
  const bytes=await fs.readFile(new URL(file.path,root));
  assert.equal(bytes.length,file.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256);
  const stsz=bytes.indexOf(Buffer.from('stsz')),stsd=bytes.indexOf(Buffer.from('stsd'));
  assert.ok(stsz>0&&stsd>0);
  const expected=file.path.endsWith('/idle.mp4')?270:139;
  assert.equal(bytes.readUInt32BE(stsz+12),expected);
  const avc=bytes.indexOf(Buffer.from('avc1'),stsd);
  assert.ok(avc>0);assert.equal(bytes.readUInt16BE(avc+28),file.path.startsWith('desktop/')?1920:720);
  assert.equal(bytes.readUInt16BE(avc+30),file.path.startsWith('desktop/')?1080:960);
  assert.ok(bytes.indexOf(Buffer.from('moov'))<bytes.indexOf(Buffer.from('mdat')),'Fast-start metadata must precede video data');
}
for(const path of ['desktop/poster.webp','mobile/poster.webp','cover.webp']){
  const image=await fs.readFile(new URL(path,root));assert.equal(image.subarray(0,4).toString(),'RIFF');assert.equal(image.subarray(8,12).toString(),'WEBP');
}
console.log('PASS Dice films: all6 accepted faces, physical rest quaternions, camera handoff, skip/reduced/hold and26 verified native videos');
