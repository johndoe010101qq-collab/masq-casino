import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {rules,settle} from '../src/game-math.js';
import {rasterCoinPose} from '../src/raster-coin-motion.js';
let checks=0;
const loader=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
const {default:Coin}=await loader.ssrLoadModule('/src/RasterCoinflip.jsx');
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
 assert.ok(html({round,progress:1,playing:false}).includes(`data-turn-degrees="${pose.turnDegrees}"`));checks++;
}
assert.ok(html({round:null,progress:0,playing:false}).includes('data-minecraft-game="coinflip"'));checks++;
await loader.close();
console.log(`Minecraft Coinflip: ${checks} checks, both actual ticket maps and identical unrevealed motion; GPU appearance checked in browser.`);
