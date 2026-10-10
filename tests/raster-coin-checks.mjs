import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformWithOxc} from 'vite';
import {rules,settle} from '../src/game-math.js';
import {rasterCoinPose} from '../src/raster-coin-motion.js';
let checks=0;
const source=readFileSync(new URL('../src/RasterCoinflip.jsx',import.meta.url),'utf8').replace(/import ['"]\.\/[^'"\n]+\.css['"];?\n/g,'').replace(/from ['"]react['"]/g,'from '+JSON.stringify(new URL('../node_modules/react/index.js',import.meta.url).href)).replace(/from ['"]\.\/raster-coin-motion\.js['"]/g,'from '+JSON.stringify(new URL('../src/raster-coin-motion.js',import.meta.url).href)).replaceAll('import.meta.env.BASE_URL',JSON.stringify('/'));
const {default:Coin}=await import('data:text/javascript;base64,'+Buffer.from((await transformWithOxc(source,'Coin.jsx',{jsx:{runtime:'classic'}})).code).toString('base64'));
const html=props=>renderToStaticMarkup(React.createElement(Coin,props));
for(let step=0;step<90;step++) {
 const props={progress:step/100,playing:true};
 assert.equal(html({...props,round:{face:'heads'}}),html({...props,round:{face:'tails'}}));checks++;
 assert.doesNotThrow(()=>html({...props,round:{get face(){throw Error('Early face read');}}}));checks++;
}
for(const choice of ['heads','tails']) for(let ticket=0;ticket<rules('coinflip',choice).sampleSize;ticket++) {
 const round=settle('coinflip',choice,5,1000,ticket),pose=rasterCoinPose(1,round.face);
 assert.equal(pose.turnDegrees%360,round.face==='heads'?0:180);checks++;
 assert.equal(pose.reveal,true);checks++;
 assert.ok(Math.abs(pose.flight)<1e-8);checks++;
 assert.ok(html({round,progress:1,playing:false}).includes(`rotateY(${pose.turnDegrees}deg)`));checks++;
}
console.log(`Raster Coinflip: ${checks} checks, both actual ticket maps and identical unrevealed motion.`);
