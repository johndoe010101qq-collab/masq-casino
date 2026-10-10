import {playMaskSlot as playCoreMaskSlot} from './mask-slots.js';
import {playProfiledMaskRound} from './profiled-mask-core.js';
import {getMaskProfileSnapshot} from './rtp-profiles.js';
export {MASK_RTP_PROFILES,getMaskProfileSnapshot} from './rtp-profiles.js';
const allowed=new Set(['game','stakeCents','mode','bonusTier','randomInt','maxSpins','maxCascades','maxCollections','featureMode','rtpProfile']);
export function playProfiledMaskSlot(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!allowed.has(key)))throw new TypeError('Unsupported profiled-round parameter.');
 const{rtpProfile='rtp50',...options}=input;
 const pinned=getMaskProfileSnapshot(rtpProfile,options);
 // Baseline consumes exactly the original RNG stream and returns the original object.
 if(pinned.id==='rtp50')return playCoreMaskSlot(options);
 return playProfiledMaskRound(options,pinned);
}
export default playProfiledMaskSlot;
