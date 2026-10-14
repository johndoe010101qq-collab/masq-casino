const clamp=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
const smooth=value=>{const p=clamp(value);return p*p*p*(p*(p*6-15)+10);};
const freeze=values=>Object.freeze(values);
const blend=(from,to,phase)=>from.map((value,index)=>value+(to[index]-value)*phase);

export const COIN_WIDE_CAMERA=Object.freeze({
  at:freeze([.45,2.1,8.5]),target:freeze([0,-.38,-.9]),width:4.5,height:3.1,
});

// This camera follows only the rendered public pose. It never receives a round
// or reads a face; both possible outcomes have the same pre-reveal camera.
export function coinCameraPresentation(pose) {
  const p=clamp(pose.progress),active=pose.phase!=='idle';
  const push=active?smooth((p-.28)/.36):0;
  const overhead=active?smooth((p-.50)/.40):0;
  const target=blend(COIN_WIDE_CAMERA.target,pose.coin.position,push);
  const wideOffset=COIN_WIDE_CAMERA.at.map((value,index)=>value-COIN_WIDE_CAMERA.target[index]);
  const trackingOffset=blend([.18,3.5,8],[.12,6.4,3.5],overhead);
  const offset=blend(wideOffset,trackingOffset,push);
  return Object.freeze({
    position:freeze(target.map((value,index)=>value+offset[index])),target:freeze(target),
    width:COIN_WIDE_CAMERA.width*(.90/COIN_WIDE_CAMERA.width)**push,
    height:COIN_WIDE_CAMERA.height*(.74/COIN_WIDE_CAMERA.height)**push,
    push,overhead,
  });
}

export function coinCameraZoom(pose,width,height) {
  const w=Number.isFinite(width)&&width>0?width:1,h=Number.isFinite(height)&&height>0?height:1;
  return Math.max(1,Math.min(w/pose.width,h/pose.height)*.94);
}
