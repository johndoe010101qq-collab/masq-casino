import {slotRasterArt} from '../slot-raster-art.js';
import {drawCanonicalSlotMascot} from './rasterSlotMascotLayout.js';
const pending=new Map(),base=import.meta.env.BASE_URL||'/';

function loadImage(url){return new Promise((resolve,reject)=>{
 const image=new Image(),timeout=setTimeout(()=>finish(new Error('Не удалось загрузить персонажа слота.')),10000);
 function finish(error){clearTimeout(timeout);image.onload=image.onerror=null;error?reject(error):resolve(image);}
 image.onload=()=>finish(image.naturalWidth>0&&image.naturalHeight>0?null:new Error('Invalid mascot image dimensions.'));
 image.onerror=()=>finish(new Error('Не удалось загрузить персонажа слота.'));image.src=url;
});}

async function load(game){
 const art=slotRasterArt(game),image=await loadImage(base+art.mascot),frames=drawCanonicalSlotMascot(image,art.mascotLayout);
 return Object.freeze({url:frames.canvas.toDataURL('image/png'),width:frames.canvas.width,height:frames.canvas.height,columns:4,rows:2,tileWidth:frames.tileWidth,tileHeight:frames.tileHeight,scale:frames.scale,groundY:frames.groundY,sourceUrl:base+art.mascot});
}

export function getMinecraftSlotMascot(game='slots'){
 if(!['slots','maskhouse','lecipher'].includes(game))return Promise.reject(new Error('Unknown slot host.'));
 if(!pending.has(game))pending.set(game,load(game).catch(error=>{pending.delete(game);throw error;}));
 return pending.get(game);
}
