import {slotRasterArt,SLOT_RASTER_KINDS} from '../slot-raster-art.js';
import {drawCanonicalSlotAtlas} from './rasterSlotIconLayout.js';
import {HUEVO_EDITION} from '../huevo-edition.js';
import {STUDIO_SLOT_NAMES} from '../studio-slot-names.js';
const pending=new Map(),base=import.meta.env.BASE_URL||'/';
const LEGACY_ART={slots:'bonanza-commercial-atlas-v13.webp',maskhouse:'maskhouse-symbols-packed-v13.webp',lecipher:'lexof-symbols-packed-v13.webp'};
const LEGACY_KINDS=['hood','suit','glove','laptop','usb','lock','key','radio','flag','scatter','bomb'];
const legacyBonanzaNames={hood:'Капюшон',suit:'Костюм',glove:'Перчатка',laptop:'Ноутбук',usb:'USB',lock:'Чип',key:'Шляпа',radio:'Рация',flag:'Флаг',scatter:'Маска',bomb:'Множитель'};
function loadImage(url){return new Promise((resolve,reject)=>{const image=new Image(),timeout=setTimeout(()=>finish(new Error('Не удалось загрузить изображения слота.')),10000);function finish(error){clearTimeout(timeout);image.onload=image.onerror=null;error?reject(error):resolve(image);}image.onload=()=>finish(image.naturalWidth>0&&image.naturalHeight>0?null:new Error('Invalid slot image dimensions.'));image.onerror=()=>finish(new Error('Не удалось загрузить изображения слота.'));image.src=url;});}
async function load(game){
 if(HUEVO_EDITION){
  const url=game==='maskhouse'?base+'doghouse-reference-v51/symbols.webp':base+'original-slots-v54/'+game+'-symbols.webp',image=await loadImage(url),w=image.naturalWidth/4,h=image.naturalHeight/3;
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
  const glyph=index=>{ctx.clearRect(0,0,w,h);ctx.drawImage(image,index%4*w,Math.floor(index/4)*h,w,h,0,0,w,h);return canvas.toDataURL('image/png');};
  return Object.freeze({url,atlasUrl:url,width:image.naturalWidth,height:image.naturalHeight,columns:4,rows:3,kinds:SLOT_RASTER_KINDS,
   indices:Object.freeze(Object.fromEntries(SLOT_RASTER_KINDS.map((kind,i)=>[kind,i]))),maskUrl:glyph(9),names:STUDIO_SLOT_NAMES[game],
   collectionGlyphs:Object.freeze(game==='lecipher'?{coin:base+'original-slots-v54/bandit-coin.webp',booster:base+'original-slots-v54/bandit-clover.webp',collector:base+'original-slots-v54/bandit-pot.webp'}:{booster:glyph(11),collector:glyph(5)}),raster:true,minecraft:false,reference:game==='maskhouse'});
 }
 const art=slotRasterArt(game),raw=await loadImage(base+art.atlas),prepared=art.ready.atlas&&Array.isArray(art.atlasRects),image=prepared?raw:await loadImage(base+LEGACY_ART[game]);
 const canonical=prepared?drawCanonicalSlotAtlas(raw,art.atlasRects,{tileSize:362,padding:.08}):null,url=canonical?canonical.toDataURL('image/png'):base+LEGACY_ART[game],source=canonical||image,width=canonical?.width||image.naturalWidth,height=canonical?.height||image.naturalHeight;
 const mask=base+'anonymous-mask-minimal.png';await loadImage(mask);
 let maskUrl=mask,collectionGlyphs={booster:base+'lexof-amplifier.png',collector:base+'lexof-archive.png'};
 if(prepared){const w=width/4,h=height/3,tile=document.createElement('canvas');tile.width=w;tile.height=h;const ctx=tile.getContext('2d');const glyph=kind=>{const index=SLOT_RASTER_KINDS.indexOf(kind);ctx.clearRect(0,0,w,h);ctx.drawImage(source,index%4*w,Math.floor(index/4)*h,w,h,0,0,w,h);return tile.toDataURL('image/png');};maskUrl=glyph('scatter');collectionGlyphs={booster:glyph('bomb'),collector:glyph('lock')};}
 return Object.freeze({url,atlasUrl:url,maskUrl,width,height,columns:4,rows:3,kinds:prepared?SLOT_RASTER_KINDS:LEGACY_KINDS,indices:Object.freeze(prepared?Object.fromEntries(SLOT_RASTER_KINDS.map((kind,index)=>[kind,index])):{...Object.fromEntries(LEGACY_KINDS.map((kind,index)=>[kind,index])),wild:10}),collectionGlyphs:Object.freeze(collectionGlyphs),names:game==='slots'&&!prepared?Object.freeze(legacyBonanzaNames):undefined,minecraft:true,raster:true,sourceUrl:base+art.atlas,sourceRects:prepared?art.atlasRects:null});
}
export function getMinecraftSlotAtlas(game='slots'){if(!Object.hasOwn(LEGACY_ART,game))return Promise.reject(new Error('Unknown slot artwork.'));if(!pending.has(game))pending.set(game,load(game).catch(error=>{pending.delete(game);throw error;}));return pending.get(game);}
