import {bonusPurchaseFloorSnapshot} from './bonus-purchase-floor.js';
import { getBonanzaProfileSnapshot } from './bonanza-rtp-profiles.js';
import { getMaskProfileSnapshot } from './profiled-mask-slots.js';
import {isDemoRtp} from './rtp-range.js';
import {getUniversalSlotProfileSnapshot,isLegacySlotProfile} from './universal-slot-profiles.js';

export const SLOT_PROFILE_GAMES = Object.freeze(['slots', 'maskhouse', 'lecipher']);
export const DEFAULT_SLOT_PROFILES = Object.freeze({slots:50, maskhouse:50, lecipher:50});
export function validateSlotProfiles(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== SLOT_PROFILE_GAMES.length
    || SLOT_PROFILE_GAMES.some(game => !Object.hasOwn(value,game) || !isDemoRtp(value[game])))
    throw new RangeError('Выберите целый общий ориентир RTP от 50 до 95% для каждого слота.');
  return Object.freeze(Object.fromEntries(SLOT_PROFILE_GAMES.map(game => [game,value[game]])));
}
export function slotProfileSnapshot(game,value,selection={}) {
  if (!SLOT_PROFILE_GAMES.includes(game)) throw new RangeError('У этой игры нет профилей слота.');
  const mode=selection.mode??'paid';
  const profile=!isLegacySlotProfile(value)?getUniversalSlotProfileSnapshot(game,value,selection):game === 'slots'
    ? getBonanzaProfileSnapshot(value,selection.mode ?? 'paid')
    : getMaskProfileSnapshot(value,{game,mode:selection.mode ?? 'paid',bonusTier:selection.bonusTier,featureMode:selection.featureMode});
  return Object.freeze({...profile,bonusPurchaseFloor:bonusPurchaseFloorSnapshot(mode)});
}
