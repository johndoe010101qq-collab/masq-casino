import {SLOT_PLAYBACK_SPEEDS} from './slot-playback-controller.js';

// A visual timeline copy only. Financial rounds, grids, wins and final amounts
// retain their original objects. Call once with the speed captured on acceptance.
export function scaleSlotPresentation(timeline,speed=1) {
  if(!SLOT_PLAYBACK_SPEEDS.includes(speed))throw new RangeError('Invalid visual speed.');
  if(!Array.isArray(timeline?.steps))throw new TypeError('A visual timeline is required.');
  if(speed===1)return timeline;
  const steps=timeline.steps.map(step=>{
    const scaled={...step};
    for(const key of ['ms','duration','reelDurationMs','reelDelayMs'])
      if(Number.isFinite(step[key]))scaled[key]=step[key]/speed;
    return Object.freeze(scaled);
  });
  return Object.freeze({...timeline,steps:Object.freeze(steps),
    ...(Number.isFinite(timeline.duration)?{duration:timeline.duration/speed}: {})});
}
