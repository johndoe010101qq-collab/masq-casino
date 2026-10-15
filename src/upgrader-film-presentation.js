import {minecraftTerminalState} from './minecraft-classic-motion.js';
export const UPGRADER_FILM=Object.freeze({frames:112,lastFrame:111,activateFrame:21,
 desktop:[[129.9851808,0,1204.76],[74.499643,186.11,270.07],[-.04948927,0,1]],
 mobile:[[85.61996316,0,471.54],[31.15606736,108.39,405.56],[-.0493773,0,1]]});
export function upgraderFilmMatrix(mobile=false,size=240){
 const h=UPGRADER_FILM[mobile?'mobile':'desktop'];
 return [h[0][0]/size,h[1][0]/size,0,h[2][0]/size,h[0][1]/size,h[1][1]/size,0,h[2][1]/size,0,0,1,0,h[0][2],h[1][2],0,1];
}
export function upgraderFilmPresentation(round,progress,playing,targetChoice=2,reduced=false){
 const p=round?(reduced||!playing?1:Math.max(0,Math.min(1,Number(progress)||0))):0;
 const state=minecraftTerminalState(round,p,Boolean(round),targetChoice,reduced);
 const activated=Boolean(round)&&p>=21/111;
 return {...state,progress:p,clip:round?'activate':'idle',activated,
  screenLabel:state.reveal?(state.outcome==='success'?'GRANTED':'DENIED'):activated?'CHECK':'READY',
  fill:activated?Math.min(1,(p-21/111)/(.92-21/111)):0};
}
