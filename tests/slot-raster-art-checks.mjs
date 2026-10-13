import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {slotRasterArt,slotRasterStyle,SLOT_RASTER_KINDS,SLOT_RASTER_POSE_FRAMES} from '../src/slot-raster-art.js';
import {minecraftSlotReaction} from '../src/minecraft-slot-presentation.js';
import postcss from 'postcss';
import {slotIconPlacement} from '../src/art/rasterSlotIconLayout.js';
import {slotMascotPlacements,drawCanonicalSlotMascot} from '../src/art/rasterSlotMascotLayout.js';

let checks=0;const same=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
const size=file=>{const b=fs.readFileSync(new URL('../public/'+file,import.meta.url));assert.equal(b.subarray(1,4).toString(),'PNG');checks++;return[b.readUInt32BE(16),b.readUInt32BE(20)];};
const nativeRects={slots:[448,142,1412,685],maskhouse:[444,148,1404,680],lecipher:[440,143,1454,702]};
const iconProof=JSON.parse(fs.readFileSync(new URL('../docs/art/slot-source-rects-v40.json',import.meta.url),'utf8'));
const mascotProof=JSON.parse(fs.readFileSync(new URL('../docs/art/slot-mascot-source-rects-v41.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
for(const game of ['slots','maskhouse','lecipher']){
 const art=slotRasterArt(game),rect=nativeRects[game],f=art.field;
 same(size(art.background),[art.width,art.height],'The native background keeps its actual source ratio.');
 same([f.left*art.width,f.top*art.height,(1-f.right)*art.width,(1-f.bottom)*art.height].map(Math.round),[rect[0]+4,rect[1]+4,rect[2]-4,rect[3]-4],'All icons remain inside the inspected felt, with a four-pixel gutter.');
 same(size(art.atlas),[1448,1086]);
 const proof=iconProof.assets[game==='slots'?'bonanza':game==='lecipher'?'lexof':game];
 same(createHash('sha256').update(fs.readFileSync(new URL('../public/'+art.atlas,import.meta.url))).digest('hex'),proof.sha256,'The source PNG remains identical to the audited original.');
 same(art.atlasRects.length,12);
 art.atlasRects.forEach((rect,index)=>{
  const expanded=proof.symbols[index].expandedRect8;same(rect,[expanded[0],expanded[1],expanded[0]+expanded[2],expanded[1]+expanded[3]],'The remap uses the whole isolated object, including the safe eight-pixel border.');
  same(proof.symbols[index].foreign_alpha32_pixels_in_expanded_rect8,0);
  const p=slotIconPlacement(rect,{sourceWidth:1448,sourceHeight:1086,tileSize:362,padding:.08});
  assert(Math.abs(p.dw/p.dh-p.sw/p.sh)<1e-12);checks++;
  assert(p.dx>=362*.08-1e-10&&p.dy>=362*.08-1e-10&&p.dx+p.dw<=362*.92+1e-10&&p.dy+p.dh<=362*.92+1e-10);checks++;
  assert(Math.abs(Math.max(p.dw,p.dh)/362-.84)<1e-12);checks++;
 });
 const mascot=mascotProof.assets[game==='slots'?'bonanza':game==='lecipher'?'lexof':game],layout=art.mascotLayout,frames=slotMascotPlacements(layout);
 same(art.ready.mascot,true);same(art.mascot,mascot.file);same(size(art.mascot),[1254,1254]);same(layout.sourceSize,[1254,1254]);
 same(createHash('sha256').update(fs.readFileSync(new URL('../public/'+art.mascot,import.meta.url))).digest('hex'),mascot.sha256,'The whole-body mascot source remains unchanged.');
 same(frames.placements.length,8);same(frames.tileWidth/frames.tileHeight,.5);
 layout.poses.forEach((pose,index)=>{
  const receipt=mascot.poses[index],p=frames.placements[index];
  same(pose.rect,receipt.expandedRect8);same(pose.centerX,receipt.columnCenterGlobalX);same(pose.footY,receipt.groundAnchorGlobal[1]);same(receipt.foreignAlpha32PixelsInExpandedRect8,0);same(receipt.wholeBodyVisualCheck,true);
  same(p.scale,frames.scale,'A gesture never changes the scale of the actor.');
  assert(Math.abs(p.dw/p.dh-p.sw/p.sh)<1e-12);checks++;
  assert(Math.abs(p.dx+(pose.centerX-p.sx)*p.scale-frames.anchorX)<1e-12);checks++;
  assert(Math.abs(p.dy+(pose.footY-p.sy)*p.scale-frames.groundY)<1e-12);checks++;
  assert(p.dx>=12-1e-8&&p.dy>=12-1e-8&&p.dx+p.dw<=frames.tileWidth-12+1e-8&&p.dy+p.dh<=frames.tileHeight-12+1e-8);checks++;
 });
 // The real canvas draw receives the complete measured objects, not guessed
 // 313/320-pixel source cells. A slim hand crossing a nominal cell stays intact.
 const calls=[],fakeCanvas={getContext:()=>({drawImage:(...args)=>calls.push(args)})},previousDocument=globalThis.document;
 try{
  globalThis.document={createElement:()=>fakeCanvas};
  const image={naturalWidth:1254,naturalHeight:1254},drawn=drawCanonicalSlotMascot(image,layout);
  same([drawn.canvas.width,drawn.canvas.height],[1280,1280]);same(calls.length,8);
  calls.forEach((args,index)=>{const p=frames.placements[index];same(args,[image,p.sx,p.sy,p.sw,p.sh,index%4*320+p.dx,Math.floor(index/4)*640+p.dy,p.dw,p.dh]);});
 }finally{globalThis.document=previousDocument;}
 const style=slotRasterStyle(game);
 for(const width of [320,354,390,428,760]){
  const scale=parseFloat(style['--mc-mobile-image-width'])/100,left=parseFloat(style['--mc-mobile-image-left'])/100,top=parseFloat(style['--mc-mobile-image-top'])/100,ratio=art.width/art.height,mobileHeight=Number(style['--mc-mobile-aspect'].split('/')[1]);
  const h=width*mobileHeight,drawW=width*scale,drawH=drawW/ratio;
  assert(Math.abs(left*width+f.left*drawW-.065*width)<1e-8);checks++;
  assert(Math.abs(left*width+(1-f.right)*drawW-.935*width)<1e-8);checks++;
  assert(Math.abs(top*h+f.top*drawH-.315*h)<1e-8);checks++;
  assert(Math.abs(top*h+(1-f.bottom)*drawH-.81*h)<1e-8);checks++;
  assert(Math.abs(drawW/drawH-art.width/art.height)<1e-12);checks++;
 }
 for(const visual of [{phase:'win',wins:[{payoutCents:10000,creditedPayoutCents:0}],creditedCascadePayoutCents:0,cascadePayoutCents:10000},{phase:'settled',totalPayoutCents:10000,creditedTotalPayoutCents:0},{phase:'reel',totalPayoutCents:10000},{phase:'deal',totalPayoutCents:10000}])assert.notEqual(minecraftSlotReaction(visual,game).pose,'win');checks+=4;
 const settled=Object.freeze({phase:'settled',totalPayoutCents:150});same(minecraftSlotReaction(settled,game).pose,'win');same(minecraftSlotReaction(settled,game,settled).pose,'idle');
 const lost=Object.freeze({phase:'settled',creditedTotalPayoutCents:0});same(minecraftSlotReaction(lost,game).pose,'loss');same(minecraftSlotReaction(lost,game,lost).pose,'idle');
 const current={...settled,serial:101};same(minecraftSlotReaction(current,game,settled).pose,'win','A late prior outcome cannot expire the next visual.');
 const paid=game==='slots'?{phase:'win',creditedCascadePayoutCents:300}:{phase:'win',creditedPayoutCents:300};same(minecraftSlotReaction(paid,game).pose,'win');same(minecraftSlotReaction(paid,game,paid).pose,'idle','Payment gestures also end once.');
}
same(new Set(SLOT_RASTER_KINDS).size,12);same(SLOT_RASTER_KINDS[9],'scatter');same(SLOT_RASTER_KINDS[10],'wild');same(SLOT_RASTER_KINDS[11],'bomb');
same([...new Set(Object.values(SLOT_RASTER_POSE_FRAMES))].sort(),[0,1,2,3,4,5,6,7]);
const css=postcss.parse(fs.readFileSync(new URL('../src/MinecraftSlotScene.css',import.meta.url),'utf8'));
const mobileCss=css.nodes.find(node=>node.type==='atrule'&&node.name==='media'&&node.params==='(max-width:760px)'),declarations=rule=>Object.fromEntries(rule.nodes.filter(node=>node.type==='decl').map(node=>[node.prop,node.value]));
const header=declarations(mobileCss.nodes.find(node=>node.type==='rule'&&node.selector==='.mc-slot-header-crop')),mascotDefault=declarations(mobileCss.nodes.find(node=>node.type==='rule'&&node.selector==='.mc-slot-mascot'));
same(header['background-size'],'360% auto');same(header['background-position'],'56% top');
for(const game of ['slots','maskhouse','lecipher']){
 const art=slotRasterArt(game),style=slotRasterStyle(game),ratio=art.width/art.height,mobileHeight=Number(style['--mc-mobile-aspect'].split('/')[1]),headerHeight=parseFloat(header.height)/100,sourceBottom=headerHeight*mobileHeight/(parseFloat(header['background-size'])/100/ratio)*art.height;
 assert(sourceBottom<art.field.top*art.height-4,'The top illustration crop cannot show a second empty board.');checks++;
 const override=mobileCss.nodes.find(node=>node.type==='rule'&&node.selector===`.mc-slot-scene[data-world='${game}'] .mc-slot-mascot`),layout={...mascotDefault,...(override?declarations(override):{})},top=parseFloat(layout.top)/100,height=parseFloat(layout.height)/100,frames=slotMascotPlacements(art.mascotLayout),receipt=mascotProof.assets[game==='slots'?'bonanza':game==='lecipher'?'lexof':game];
 assert(Math.abs(top+height*frames.groundY/frames.tileHeight-.315)<1e-12,'The actor stands above the real board, independent of pose.');checks++;
 receipt.poses.forEach((pose,index)=>{
  const [x,y,w,h]=pose.sourceRect,source=art.mascotLayout.poses[index],head=top+height*(frames.groundY+(y-source.footY)*frames.scale)/frames.tileHeight,foot=top+height*(frames.groundY+(y+h-source.footY)*frames.scale)/frames.tileHeight;
  assert(head>=0&&foot<=.315+1e-10,'All whole poses fit the mobile header without clipped heads or feet.');checks++;
  assert((foot-head)*315*mobileHeight>=70,'The body remains readable in the measured 315-pixel cabinet.');checks++;
 });
}
css.walkRules(rule=>{if(rule.selector.includes('mc-slot-mascot'))rule.walkDecls(decl=>{if(decl.prop.startsWith('animation')){assert(!decl.value.includes('--slot-speed'));checks++;}});});
const scene=fs.readFileSync(new URL('../src/MinecraftSlotScene.jsx',import.meta.url),'utf8');assert(!/WebGL|createMinecraftSlotStudio|<canvas|requestAnimationFrame|Math\.random|session\./.test(scene));checks++;
assert(scene.includes('getMinecraftSlotMascot')&&!scene.includes("base+art.mascot"));checks++;
const artSource=fs.readFileSync(new URL('../src/slot-raster-art.js',import.meta.url),'utf8');assert(!/v38|slot-studio-|slot-mascot-[^'"]+-v(?:39|40)\.png/.test(artSource));checks++;
const outcomeAnimations=[];css.walkRules(rule=>{if(/data-pose='(?:win|loss)'/.test(rule.selector))rule.walkDecls('animation',decl=>outcomeAnimations.push(decl.value));});same(outcomeAnimations.length,2);assert(outcomeAnimations.every(value=>value.includes('2.8s')&&!value.includes('infinite')));checks++;
const cells=css.nodes.find(node=>node.type==='rule'&&node.selector.endsWith(':is(.mask-slot-cell,.slot-cell)'));assert(cells.nodes.some(node=>node.prop==='container-type'&&node.value==='size')&&cells.nodes.some(node=>node.prop==='padding'&&node.value==='0'));checks++;
console.log(JSON.stringify({passed:true,checks,scope:'Three distinct raster cabinets; all 36 isolated symbols at 84% cell extent; 24 complete host poses with fixed scale and ground, finite credited reactions, independent mascot pace, five phone sizes and no slot WebGL.'}));
