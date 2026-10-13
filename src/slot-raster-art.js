import {SLOT_SOURCE_RECTS_V40} from './slot-raster-source-rects-v40.js';
import {SLOT_MASCOT_LAYOUT_V41} from './slot-mascot-source-rects-v41.js';
const freeze=Object.freeze;

// Sources retain their native pixels. Runtime remaps use inspected whole-object
// rectangles, so neither symbols nor mascot gestures include their neighbours.
export const SLOT_RASTER_READY=freeze({slots:freeze({background:true,atlas:true,mascot:true}),maskhouse:freeze({background:true,atlas:true,mascot:true}),lecipher:freeze({background:true,atlas:true,mascot:true})});
export const SLOT_RASTER_ICON_RECTS=freeze(Object.fromEntries(Object.entries(SLOT_SOURCE_RECTS_V40).map(([game,rects])=>[game,freeze(rects.map(rect=>freeze([...rect])))])));
export const SLOT_RASTER_CANDIDATES=freeze({
 slots:freeze({background:'slot-scene-bonanza-v39.png',atlas:'slot-symbols-bonanza-v40.png',mascot:'slot-mascot-bonanza-v41.png',width:1586,height:992,field:freeze({left:452/1586,right:178/1586,top:146/992,bottom:311/992}),title:freeze({left:.47,right:.30,top:.04})}),
 maskhouse:freeze({background:'slot-scene-maskhouse-v39.png',atlas:'slot-symbols-maskhouse-v40.png',mascot:'slot-mascot-maskhouse-v41.png',width:1585,height:992,field:freeze({left:448/1585,right:185/1585,top:152/992,bottom:316/992}),title:freeze({left:.47,right:.30,top:.04})}),
 lecipher:freeze({background:'slot-scene-lexof-v39.png',atlas:'slot-symbols-lexof-v40.png',mascot:'slot-mascot-lexof-v41.png',width:1586,height:992,field:freeze({left:444/1586,right:136/1586,top:147/992,bottom:294/992}),title:freeze({left:.47,right:.30,top:.04})})
});
export const SLOT_RASTER_KINDS=freeze(['hood','suit','glove','laptop','usb','lock','key','radio','flag','scatter','wild','bomb']);
export const SLOT_RASTER_POSE_FRAMES=freeze({idle:0,blink:1,watch:2,bonus:3,win:4,winSecond:5,loss:6,laugh:7});
export function slotRasterArt(game='slots'){
 const ready=SLOT_RASTER_READY[game],candidate=SLOT_RASTER_CANDIDATES[game];if(!ready)throw new Error('Unknown slot artwork.');
 return freeze({...candidate,atlasRects:SLOT_RASTER_ICON_RECTS[game],mascotLayout:SLOT_MASCOT_LAYOUT_V41[game],ready});
}
export function slotRasterStyle(game='slots'){
 const art=slotRasterArt(game),f=art.field,fw=1-f.left-f.right,fh=1-f.top-f.bottom,ratio=art.width/art.height,scale=.87/fw,mobileHeight=(fh/ratio*scale)/.495;
 return {'--mc-stage-aspect':`${art.width} / ${art.height}`,'--mc-board-left':`${f.left*100}%`,'--mc-board-right':`${f.right*100}%`,'--mc-board-top':`${f.top*100}%`,'--mc-board-bottom':`${f.bottom*100}%`,'--mc-title-left':`${art.title.left*100}%`,'--mc-title-right':`${art.title.right*100}%`,'--mc-title-top':`${art.title.top*100}%`,'--mc-mobile-aspect':`1 / ${mobileHeight}`,'--mc-mobile-image-width':`${scale*100}%`,'--mc-mobile-image-left':`${(.065-f.left*scale)*100}%`,'--mc-mobile-image-top':`${(.315-f.top/ratio*scale/mobileHeight)*100}%`};
}
