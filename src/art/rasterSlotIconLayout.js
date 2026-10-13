// Rectangles use native pixels: [left, top, right, bottom], excluding the
// right/bottom boundary. Draw sizes share one scale so artwork never stretches.
export function slotIconPlacement(rect,{sourceWidth,sourceHeight,tileSize=362,padding=.17}={}){
 if(!Array.isArray(rect)||rect.length!==4||!rect.every(Number.isFinite))throw new RangeError('An icon needs a complete source rectangle.');
 const [left,top,right,bottom]=rect,w=right-left,h=bottom-top;
 if(left<0||top<0||w<=0||h<=0||(sourceWidth!==undefined&&right>sourceWidth)||(sourceHeight!==undefined&&bottom>sourceHeight)||!Number.isFinite(tileSize)||tileSize<=0||!Number.isFinite(padding)||padding<0||padding>=.5)throw new RangeError('Invalid source rectangle or icon padding.');
 const scale=tileSize*(1-padding*2)/Math.max(w,h),drawWidth=w*scale,drawHeight=h*scale;
 return Object.freeze({sx:left,sy:top,sw:w,sh:h,dx:(tileSize-drawWidth)/2,dy:(tileSize-drawHeight)/2,dw:drawWidth,dh:drawHeight});
}

export function drawCanonicalSlotAtlas(image,rectangles,{tileSize=362,padding=.17}={}){
 if(!Array.isArray(rectangles)||rectangles.length!==12)throw new RangeError('A slot atlas needs exactly twelve isolated source objects.');
 const canvas=document.createElement('canvas');canvas.width=tileSize*4;canvas.height=tileSize*3;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Could not prepare slot artwork.');
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 const placements=rectangles.map(rect=>slotIconPlacement(rect,{sourceWidth:image.naturalWidth,sourceHeight:image.naturalHeight,tileSize,padding}));
 placements.forEach((p,index)=>ctx.drawImage(image,p.sx,p.sy,p.sw,p.sh,index%4*tileSize+p.dx,Math.floor(index/4)*tileSize+p.dy,p.dw,p.dh));
 return canvas;
}
