// One public numeric range for every game in the local DEMO settings.
export const DEMO_RTP_MIN=50;
export const DEMO_RTP_MAX=95;
export const DEMO_RTP_STEP=1;
export const DEMO_RTP_VALUES=Object.freeze(Array.from({length:DEMO_RTP_MAX-DEMO_RTP_MIN+1},(_,index)=>DEMO_RTP_MIN+index));
export const isDemoRtp=value=>Number.isInteger(value)&&value>=DEMO_RTP_MIN&&value<=DEMO_RTP_MAX;
