// Form contract only. The HallSession remains the authority for admission and
// profile validation. This module does not generate outcomes or change balances.
import {DEMO_RTP_VALUES} from './rtp-range.js';
export const ADMIN_GAMES = Object.freeze([
  {id:'slots',name:'Bonanza',group:'slots',maxStake:100,profiles:DEMO_RTP_VALUES,defaultProfile:55},
  {id:'maskhouse',name:'Mask Hou$e',group:'slots',maxStake:250,profiles:DEMO_RTP_VALUES,defaultProfile:55},
  {id:'lecipher',name:'LeXof',group:'slots',maxStake:250,profiles:DEMO_RTP_VALUES,defaultProfile:55},
  {id:'coinflip',name:'Coinflip',group:'classic',maxStake:250,profiles:DEMO_RTP_VALUES,defaultProfile:70},
  {id:'dice',name:'Dice',group:'classic',maxStake:250,profiles:DEMO_RTP_VALUES,defaultProfile:70},
  {id:'plinko',name:'Plinko',group:'classic',maxStake:250,profiles:DEMO_RTP_VALUES,defaultProfile:70},
  {id:'roulette',name:'Roulette',group:'classic',maxStake:250,profiles:DEMO_RTP_VALUES,defaultProfile:70},
  {id:'upgrader',name:'Upgrader',group:'classic',maxStake:250,profiles:DEMO_RTP_VALUES,defaultProfile:70},
  {id:'blackjack',name:'Blackjack',group:'classic',maxStake:250,profiles:DEMO_RTP_VALUES,defaultProfile:70},
]);
export const ADMIN_DEFAULTS = Object.freeze({
  rtpProfiles:Object.freeze({slots:55,maskhouse:55,lecipher:55}),
  classicRtpProfiles:Object.freeze(Object.fromEntries(ADMIN_GAMES.filter(game=>game.group==='classic').map(game=>[game.id,70]))),
  stakeLimits:Object.freeze(Object.fromEntries(ADMIN_GAMES.map(game=>[game.id,Object.freeze({min:5,max:game.maxStake,step:5})]))),
  presentation:Object.freeze({speed:1,sfxVolume:100,musicVolume:100}),
});
export function settingsFromSnapshot(snapshot={}) {
  return {
    rtpProfiles:{...ADMIN_DEFAULTS.rtpProfiles,...snapshot.rtpProfiles},
    classicRtpProfiles:{...ADMIN_DEFAULTS.classicRtpProfiles,...snapshot.classicRtpProfiles},
    stakeLimits:Object.fromEntries(ADMIN_GAMES.map(game=>[game.id,{...ADMIN_DEFAULTS.stakeLimits[game.id],...snapshot.stakeLimits?.[game.id]}])),
    presentation:{...ADMIN_DEFAULTS.presentation,...snapshot.presentation},
  };
}
export function validateAdminDraft(draft) {
  const result={rtpProfiles:{},classicRtpProfiles:{},stakeLimits:{},presentation:{}};
  for(const game of ADMIN_GAMES) {
    const key=game.group==='slots'?'rtpProfiles':'classicRtpProfiles',profile=Number(draft[key]?.[game.id]);
    if(!game.profiles.includes(profile))throw new RangeError(`${game.name}: выберите один из опубликованных профилей.`);
    result[key][game.id]=profile;
    const min=Number(draft.stakeLimits?.[game.id]?.min),max=Number(draft.stakeLimits?.[game.id]?.max);
    if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min<5||max>game.maxStake||min>max||min%5||max%5)
      throw new RangeError(`${game.name}: ставки от 5 до ${game.maxStake} АР, шаг 5; минимум не выше максимума.`);
    result.stakeLimits[game.id]={min,max,step:5};
  }
  const {speed,sfxVolume,musicVolume}=draft.presentation||{};
  if(![1,1.5,2].includes(Number(speed)))throw new RangeError('Выберите скорость 1, 1,5 или 2.');
  result.presentation.speed=Number(speed);
  for(const [key,value] of Object.entries({sfxVolume,musicVolume})) {
    const number=Number(value);
    if(value===''||!Number.isInteger(number)||number<0||number>100)throw new RangeError('Громкость — целое число от 0 до 100.');
    result.presentation[key]=number;
  }
  return result;
}
export function draftChanges(active,draft,capabilities) {
  const changes=[];
  for(const game of ADMIN_GAMES) {
    const key=game.group==='slots'?'rtpProfiles':'classicRtpProfiles';
    if(capabilities[key]&&Number(draft[key][game.id])!==active[key][game.id])changes.push(`${game.name}: профиль ${active[key][game.id]} → ${draft[key][game.id]}%`);
    if(capabilities.stakeLimits) {
      const a=active.stakeLimits[game.id],b=draft.stakeLimits[game.id];
      if(Number(b.min)!==a.min||Number(b.max)!==a.max)changes.push(`${game.name}: ставка ${a.min}–${a.max} → ${b.min||'…'}–${b.max||'…'} АР`);
    }
  }
  if(capabilities.presentation)for(const [key,title,suffix] of [['speed','Скорость','×'],['sfxVolume','Эффекты','%'],['musicVolume','Музыка','%']])
    if(Number(draft.presentation[key])!==active.presentation[key])changes.push(`${title}: ${active.presentation[key]}${suffix} → ${draft.presentation[key]}${suffix}`);
  return changes;
}
