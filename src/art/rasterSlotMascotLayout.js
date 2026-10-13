// Every pose uses the character's measured column centre and shared row ground.
// One scale fits all eight complete poses; gestures never resize the body.
export function slotMascotPlacements(layout,{tileWidth=320,tileHeight=640,padding=12,groundInset=24}={}){
 const sourceWidth=layout?.sourceSize?.[0],sourceHeight=layout?.sourceSize?.[1],poses=layout?.poses;
 if(!Number.isFinite(sourceWidth)||!Number.isFinite(sourceHeight)||sourceWidth<=0||sourceHeight<=0||!Array.isArray(poses)||poses.length!==8)throw new RangeError('A mascot needs eight measured poses.');
 if(![tileWidth,tileHeight,padding,groundInset].every(Number.isFinite)||tileWidth<=0||tileHeight<=0||padding<0||padding>=tileWidth/2||groundInset<=padding||groundInset>=tileHeight-padding)throw new RangeError('Invalid mascot frame bounds.');
 const anchorX=tileWidth/2,groundY=tileHeight-groundInset;
 let left=0,right=0,above=0,below=0;
 poses.forEach(pose=>{
  const rect=pose?.rect;
  if(!Array.isArray(rect)||rect.length!==4||!rect.every(Number.isFinite)||!Number.isFinite(pose.centerX)||!Number.isFinite(pose.footY))throw new RangeError('A mascot needs a complete source rectangle and anchor.');
  const [x,y,w,h]=rect;
  if(x<0||y<0||w<=0||h<=0||x+w>sourceWidth||y+h>sourceHeight||pose.centerX<0||pose.centerX>sourceWidth||pose.footY<0||pose.footY>sourceHeight)throw new RangeError('A mascot rectangle is outside its source.');
  left=Math.max(left,pose.centerX-x);right=Math.max(right,x+w-pose.centerX);above=Math.max(above,pose.footY-y);below=Math.max(below,y+h-pose.footY);
 });
 const scale=Math.min((anchorX-padding)/left,(tileWidth-anchorX-padding)/right,(groundY-padding)/above,below>0?(tileHeight-padding-groundY)/below:Infinity);
 if(!Number.isFinite(scale)||scale<=0)throw new RangeError('The measured mascot does not fit a frame.');
 const placements=poses.map((pose,index)=>{
  const [sx,sy,sw,sh]=pose.rect;
  return Object.freeze({index,sx,sy,sw,sh,dx:anchorX+(sx-pose.centerX)*scale,dy:groundY+(sy-pose.footY)*scale,dw:sw*scale,dh:sh*scale,scale,anchorX,groundY});
 });
 return Object.freeze({tileWidth,tileHeight,scale,anchorX,groundY,placements:Object.freeze(placements)});
}

export function drawCanonicalSlotMascot(image,layout,options){
 if(image.naturalWidth!==layout.sourceSize[0]||image.naturalHeight!==layout.sourceSize[1])throw new RangeError('Mascot source dimensions differ from the inspected artwork.');
 const frames=slotMascotPlacements(layout,options),canvas=document.createElement('canvas');
 canvas.width=frames.tileWidth*4;canvas.height=frames.tileHeight*2;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Could not prepare the slot host.');
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 frames.placements.forEach(p=>ctx.drawImage(image,p.sx,p.sy,p.sw,p.sh,p.index%4*frames.tileWidth+p.dx,Math.floor(p.index/4)*frames.tileHeight+p.dy,p.dw,p.dh));
 return Object.freeze({canvas,...frames});
}
