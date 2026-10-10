import {simulateBonanzaRound as nativeRound} from './bonanza.js';
import {simulateBonanzaRound as profileRound} from './bonanza-profile-engine.js';
import {getBonanzaProfileSnapshot,BONANZA_RTP_PROFILES} from './bonanza-rtp-profiles.js';
export {getBonanzaProfileSnapshot,BONANZA_RTP_PROFILES};
export function simulateProfiledBonanzaRound(stakeCents,{rtpProfile=50,...options}={}) {
  const offer=options.mode??(options.preview?'preview':'paid');
  const snapshot=getBonanzaProfileSnapshot(rtpProfile,offer);
  // Native50 consumes the original RNG and returns exactly the native result shape.
  if(snapshot.id==='rtp50') return nativeRound(stakeCents,options);
  const round=profileRound(stakeCents,{...options,probabilityWeights:snapshot.probabilityWeights});
  return Object.freeze({...round,mathNotice:snapshot.notice,
    profile:Object.freeze({...snapshot,ticket:null,ticketMatched:false,offeredExtraFreeSpins:0,extraFreeSpins:0})});
}
