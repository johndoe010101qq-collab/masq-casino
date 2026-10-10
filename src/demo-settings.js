import { SLOT_PROFILE_GAMES,DEFAULT_SLOT_PROFILES,validateSlotProfiles } from './slot-rtp-profiles.js';
import { CLASSIC_PROFILE_GAMES,DEFAULT_CLASSIC_PROFILES,validateClassicProfiles } from './classic-rtp-profiles.js';
import { stakeLimits } from './stake-limits.js';
export const DEMO_SETTINGS_GAMES=Object.freeze([...SLOT_PROFILE_GAMES,...CLASSIC_PROFILE_GAMES]);
export const DEFAULT_DEMO_STAKE_LIMITS=Object.freeze(Object.fromEntries(DEMO_SETTINGS_GAMES.map(game=>[game,stakeLimits(game)])));
export const DEFAULT_DEMO_PRESENTATION=Object.freeze({speed:1,sfxVolume:100,musicVolume:100});
function keys(value,expected,message){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==expected.length||expected.some(key=>!Object.hasOwn(value,key)))throw new RangeError(message);
}
export function validateDemoStakeLimits(value){
  keys(value,DEMO_SETTINGS_GAMES,'Нужны лимиты ставки для каждой из девяти игр.');
  return Object.freeze(Object.fromEntries(DEMO_SETTINGS_GAMES.map(game=>{
    const limits=value[game],hard=stakeLimits(game);
    keys(limits,['min','max','step'],'Лимит ставки содержит только min, max и step.');
    if(!Number.isSafeInteger(limits.min)||!Number.isSafeInteger(limits.max)||limits.step!==5||limits.min<hard.min||limits.max>hard.max||limits.min>limits.max||limits.min%5||limits.max%5)
      throw new RangeError(`Лимиты ${game}: целые значения с шагом 5 в диапазоне ${hard.min}–${hard.max} АР.`);
    return[game,Object.freeze({min:limits.min,max:limits.max,step:5})];
  })));
}
export function validateDemoPresentation(value){
  keys(value,['speed','sfxVolume','musicVolume'],'Нужны скорость, громкость эффектов и музыки.');
  if(![1,1.5,2].includes(value.speed)||['sfxVolume','musicVolume'].some(key=>!Number.isFinite(value[key])||value[key]<0||value[key]>100))
    throw new RangeError('Скорость: 1, 1.5 или 2; громкость: от 0 до 100.');
  return Object.freeze({speed:value.speed,sfxVolume:value.sfxVolume,musicVolume:value.musicVolume});
}
export function validateDemoSettings(value){
  keys(value,['rtpProfiles','classicRtpProfiles','stakeLimits','presentation'],'Нужен полный набор открытых демо-настроек.');
  // Validate every section before any owner commits a new revision.
  return Object.freeze({rtpProfiles:validateSlotProfiles(value.rtpProfiles),classicRtpProfiles:validateClassicProfiles(value.classicRtpProfiles),
    stakeLimits:validateDemoStakeLimits(value.stakeLimits),presentation:validateDemoPresentation(value.presentation)});
}
export const DEFAULT_DEMO_SETTINGS=Object.freeze({rtpProfiles:DEFAULT_SLOT_PROFILES,classicRtpProfiles:DEFAULT_CLASSIC_PROFILES,
  stakeLimits:DEFAULT_DEMO_STAKE_LIMITS,presentation:DEFAULT_DEMO_PRESENTATION});
