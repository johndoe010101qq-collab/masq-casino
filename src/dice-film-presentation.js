const clamp=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
export const DICE_FILM=Object.freeze({fps:30,frames:139,lastFrame:138,releaseFrame:42,cutFrame:42,
  settled:Object.freeze({1:72,2:66,3:66,4:72,5:70,6:71}),
  holdEnd:Object.freeze({1:111,2:105,3:105,4:111,5:109,6:110})});

// This selects footage for the already accepted result. It never generates a
// result, reads a payout or retries a throw. Missing results stay at idle.
export function diceFilmAcceptedValue(round){
  if(!round)return null;
  const value=round.dieValue??round.value;
  return Number.isInteger(value)&&value>=1&&value<=6?value:null;
}

export function diceFilmPresentation(value,progress,playing,reduced=false){
  const accepted=Number.isInteger(value)&&value>=1&&value<=6;
  const p=accepted?(reduced||!playing?1:clamp(progress)):0,frame=p*DICE_FILM.lastFrame;
  const settled=accepted&&frame>=DICE_FILM.settled[value];
  return Object.freeze({value:accepted?value:null,progress:p,frame,settled,
    phase:!accepted?'idle':settled?'result':frame<DICE_FILM.releaseFrame?'held':'throw',
    // A deliberate camera cut at the release keeps absolute film time. The
    // close-up is filmed footage, including the real face and its shadow.
    clip:!accepted?'idle':`roll_${value}${frame>=DICE_FILM.cutFrame?'_close':''}`});
}
