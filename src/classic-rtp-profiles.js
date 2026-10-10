import GameMath, { PLINKO_MULTIPLIERS, ROULETTE_NUMBERS, rouletteColor, DIE_TOP_ROTATIONS } from './game-math.js';
import { CANDIDATE_RULES } from './blackjack.js';
import { permittedStake } from './stake-limits.js';
import {DEMO_RTP_VALUES} from './rtp-range.js';
import blackjackProfiles from './blackjack-rtp-profile-table.js';

// Public global DEMO presets. A preset is committed before drawing a ticket.
// There are no player IDs, history, bankroll, timer, or after-result adjustments.
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
export const CLASSIC_PROFILE_GAMES = freeze(['coinflip','dice','plinko','roulette','upgrader','blackjack']);
export const CLASSIC_EXACT_PROFILE_VALUES = DEMO_RTP_VALUES;
export const BLACKJACK_PROFILE_VALUES = DEMO_RTP_VALUES;
export const DEFAULT_CLASSIC_PROFILES = freeze(Object.fromEntries(CLASSIC_PROFILE_GAMES.map(game => [game,70])));
export const CLASSIC_PROFILE_REVISION = 'indictus-public-classic-profiles-50-95-v1';
export function classicProfileValues(game) {
  if (!CLASSIC_PROFILE_GAMES.includes(game)) throw new RangeError('Неизвестная классическая игра.');
  return game === 'blackjack' ? BLACKJACK_PROFILE_VALUES : CLASSIC_EXACT_PROFILE_VALUES;
}
function validateProfile(game,value) {
  if (!classicProfileValues(game).includes(value)) throw new RangeError('Недоступный открытый профиль игры.');
  return value;
}
export function validateClassicProfiles(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== CLASSIC_PROFILE_GAMES.length
    || CLASSIC_PROFILE_GAMES.some(game => !Object.hasOwn(value,game)))
    throw new RangeError('Нужен общий профиль для каждой из шести классических игр.');
  return freeze(Object.fromEntries(CLASSIC_PROFILE_GAMES.map(game => [game,validateProfile(game,value[game])])));
}
const gcd = (a,b) => b ? gcd(b,a%b) : a;
const rightTurns = path => {
  let count=0; for(let row=0;row<8;row++) count+=(path>>row)&1; return count;
};
const plinkoDistributions = new Map();
function plinkoDistribution(value) {
  if (plinkoDistributions.has(value)) return plinkoDistributions.get(value);
  // Uniform 256-path return = 317/320; center return = 1/5.
  // a/(a+b)=(R-1/5)/(317/320-1/5), with R=value/100.
  const a=16*(value-20), b=1265-a, divisor=gcd(70*a,256*b);
  const baselineTicketsPerPath=70*a/divisor, centerExtraTicketsPerPath=256*b/divisor;
  const pathWeights=Array.from({length:256},(_,path)=>baselineTicketsPerPath+(rightTurns(path)===4?centerExtraTicketsPerPath:0));
  const ticketStarts=pathWeights.reduce((starts,weight)=>{starts.push(starts.at(-1)+weight);return starts;},[0]);
  const binTicketCounts=Array(9).fill(0);
  pathWeights.forEach((weight,path)=>{binTicketCounts[rightTurns(path)]+=weight;});
  const sampleSize=ticketStarts.at(-1);
  const result=freeze({version:CLASSIC_PROFILE_REVISION+'-plinko-'+value,rows:8,sampleSize,
    baselineTicketsPerPath,centerExtraTicketsPerPath,pathWeights,ticketStarts,binTicketCounts,
    binProbabilities:binTicketCounts.map(weight=>weight/sampleSize),
    notice:`Открытый вариант Plinko: каждый из 256 физических путей имеет ${baselineTicketsPerPath} билетов; каждый из 70 центральных путей — ещё ${centerExtraTicketsPerPath}. Всего ${sampleSize} равновероятных билетов. Веса фиксируются до RNG; выплаты по лункам не меняются.`});
  plinkoDistributions.set(value,result);return result;
}

// These are complete exact ticket maps, rather than a claimed chance that is
// unrelated to the generated face, physical roulette pocket, or Plinko path.
export function classicRules(game,choice,value=70,math=GameMath) {
  validateProfile(game,value);
  if(game==='blackjack')throw new RangeError('Blackjack использует раздачу карт, а не один билет.');
  const native=math.rules(game,choice); // All choices validate before RNG.
  if(value===70)return native; // Preserve every legacy ticket and RNG bound.
  const common={...native,expectedGrossReturn:value/100,variant:CLASSIC_PROFILE_REVISION};
  if(game==='coinflip')return freeze({...common,sampleSize:200,chance:value,chanceFraction:value/200,
    distribution:`Выбранная сторона ${value}/200; другая сторона ${200-value}/200. Выбор и профиль фиксируются до RNG.`});
  if(game==='dice')return freeze({...common,sampleSize:3000,chance:5*value,chanceFraction:value/600,
    losingTicketsPerOtherFace:600-value,distribution:`Выбранная грань ${5*value}/3000; каждая из пяти других ${(600-value)}/3000. Выбор и профиль фиксируются до RNG.`});
  if(game==='roulette'){
    const colorChoice=choice==='red'||choice==='black';
    const selectedTicketsPerPocket=colorChoice?19*value:36*value;
    const otherTicketsPerPocket=colorChoice?18*(200-value):3600-value;
    const sampleSize=colorChoice?68400:129600, chance=colorChoice?18*selectedTicketsPerPocket:selectedTicketsPerPocket;
    return freeze({...common,sampleSize,chance,chanceFraction:chance/sampleSize,selectedTicketsPerPocket,otherTicketsPerPocket,
      distribution:colorChoice
        ?`Каждая из 18 выбранных лунок: ${selectedTicketsPerPocket}/${sampleSize}; каждая из 19 других, включая 0: ${otherTicketsPerPocket}/${sampleSize}.`
        :`Выбранный номер: ${selectedTicketsPerPocket}/${sampleSize}; каждая из 36 других лунок: ${otherTicketsPerPocket}/${sampleSize}.`});
  }
  if(game==='plinko'){
    const distribution=plinkoDistribution(value);
    return freeze({...common,sampleSize:distribution.sampleSize,distribution});
  }
  if(game==='upgrader'){
    // 24,000 makes every supported return/multiplier ratio an integer ticket
    // count, including 1.5x. Native70 deliberately retains the old floor grid.
    const sampleSize=24000,chance=value*(240/choice);
    return freeze({...common,sampleSize,chance,chanceFraction:chance/sampleSize,chancePercent:chance/sampleSize*100,
      distribution:`Успех: ${chance}/${sampleSize}; выплата ×${choice}.`});
  }
  throw new RangeError('Неизвестная классическая игра.');
}
const defaultChoice=game=>({coinflip:'heads',dice:1,plinko:'standard',roulette:'red',upgrader:2}[game]);
export function classicProfileSnapshot(game,value=70,{choice}={}) {
  validateProfile(game,value);
  const common={id:'rtp'+value,game,revision:CLASSIC_PROFILE_REVISION,targetReturnPercent:value,
    global:true,committedBeforeRng:true,payoutsUnchanged:true};
  if(game==='blackjack'){
    const preset=blackjackProfiles.profiles['rtp'+value];
    if(!preset)throw new RangeError('Для этого профиля Blackjack нет опубликованных параметров.');
    const {dealerBoostTickets,playerUnfavorableTickets}=preset;
    const p=playerUnfavorableTickets/10000,q=dealerBoostTickets/10000;
    const n=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:4}).format(value);
    return freeze({...common,revision:blackjackProfiles.version,kind:'approximate',decks:6,dealerStandsSoft17:true,ticketCount:10000,
      dealerBoostTickets,playerUnfavorableTickets,
      engineSourceSHA256:blackjackProfiles.engineSHA256,parametersSHA256:blackjackProfiles.paramsSHA256,
      payouts:CANDIDATE_RULES.payouts,
      rule:value===70?CANDIDATE_RULES.rule
        :`Шесть колод, 312 разных физических карт без возвращения, равномерная начальная раздача. На доборе игрока ${playerUnfavorableTickets} из 10 000 билетов выбирают равномерно карту с перебором; если таких нет — с минимальной новой суммой. Остальные билеты выбирают любую оставшуюся карту равномерно. На доборе дилера ${dealerBoostTickets} из 10 000 билетов выбирают равномерно карту с лучшей безопасной суммой; остальные выбирают любую оставшуюся карту равномерно. Если безопасных карт нет, весь добор дилера равномерный. Дилер стоит на мягкой 17. Выплаты ×2, ×2,5 за Blackjack и ×1 за ничью. Профиль фиксируется до перемешивания и не зависит от игрока, ставки, баланса или истории. RTP около ${value}% откалиброван для базовой стратегии Hit / Stand и зависит от решений игрока.`,
      probabilityFormula:`Игрок: (1 − p)/N + p/K для карт с перебором (иначе с минимальной новой суммой), (1 − p)/N для остальных, p = ${n(p)}. Дилер: (1 − q)/N + q/K для лучших безопасных карт, (1 − q)/N для остальных, q = ${n(q)}; если безопасных карт нет — 1/N.`,
      measurements:preset.measurements??(value===70?{source:'blackjack-dual-bias-v10 independent holdout',handsPerStrategy:1000000,
        basic_hit_stand:{returnPercent:70.95245,return95CI_Percent:[70.76653,71.13837]},
        hit_below_17:{returnPercent:69.26605,return95CI_Percent:[69.08119,69.45092]},
        adapted_hit_stand:{returnPercent:70.95165,return95CI_Percent:[70.76634,71.13697]}}:null),
      note:value===70?'Нативные доли добора 15% / 32% сохраняются; прежняя независимая оценка базовой стратегии — 70,95245%, а не ровно 70%. Возврат зависит от стратегии.'
        :'Возврат зависит от стратегии игрока. Значение настройки — приблизительная цель калибровки, не обещание результата серии.'});
  }
  const config=classicRules(game,choice??defaultChoice(game),value);
  return freeze({...common,kind:'exact',choice:config.choice,expectedGrossReturn:config.expectedGrossReturn,
    actualReturnPercent:config.expectedGrossReturn*100,sampleSize:config.sampleSize,
    ...(config.chanceFraction===undefined?{}:{chanceFraction:config.chanceFraction,chancePercent:config.chanceFraction*100,
      winningTickets:config.chance,grossMultiplier:config.grossMultiplier}),
    ...(game==='plinko'?{distribution:config.distribution,multipliers:config.multipliers}:{}),
    rule:typeof config.distribution==='string'?config.distribution:config.distribution?.notice
      ??`Успех: ${config.chance}/${config.sampleSize}; выплата ×${config.grossMultiplier}. Выбор и профиль фиксируются до RNG.`,
    note:game==='upgrader'&&value===70&&config.choice===1.5
      ?'Нативный профиль сохраняет 4 666/10 000 билетов: шанс 46,66%, фактический RTP 69,99%.':'Профиль меняет только опубликованные вероятности. Стоимость, множители и максимальная выплата сохраняются.'});
}
export const getClassicProfileSnapshot=classicProfileSnapshot;
export function blackjackProfileOptions(value=70) {
  const profile=classicProfileSnapshot('blackjack',value);
  return freeze({dealerBoostTickets:profile.dealerBoostTickets,playerUnfavorableTickets:profile.playerUnfavorableTickets});
}
function pathForTicket(ticket,starts) {
  let low=0,high=256;
  while(low+1<high){const middle=(low+high)>>1;if(ticket<starts[middle])high=middle;else low=middle;}return low;
}
export function settleClassic(game,choice,stake,openingBalance,ticket,value=70,math=GameMath) {
  const config=classicRules(game,choice,value,math);
  if(value===70)return math.settle(game,choice,stake,openingBalance,ticket);
  if(!permittedStake(stake))throw new RangeError('Ставка — от 5 до 250 АР с шагом 5.');
  if(!Number.isSafeInteger(ticket)||ticket<0||ticket>=config.sampleSize)throw new RangeError('Некорректный билет результата.');
  void openingBalance;
  const stakeCents=stake*100;let outcome,payoutCents=0;
  if(game==='coinflip'){
    const face=ticket<config.chance?choice:(choice==='heads'?'tails':'heads'),won=face===choice;
    payoutCents=won?stakeCents*2:0;outcome={face,won,label:face==='heads'?'Маска':'Знак I',multiplier:won?2:0};
  }else if(game==='dice'){
    const others=[1,2,3,4,5,6].filter(face=>face!==choice);
    const value=ticket<config.chance?choice:others[Math.floor((ticket-config.chance)/config.losingTicketsPerOtherFace)],won=value===choice;
    payoutCents=won?stakeCents*6:0;outcome={value,dieValue:value,dieRotation:DIE_TOP_ROTATIONS[value],won,label:'Грань '+value,multiplier:won?6:0};
  }else if(game==='roulette'){
    const colorChoice=choice==='red'||choice==='black';
    const selected=colorChoice?ROULETTE_NUMBERS.filter(number=>rouletteColor(number)===choice):[choice==='green'?0:choice];
    const others=ROULETTE_NUMBERS.filter(number=>!selected.includes(number));
    const number=ticket<config.chance?selected[Math.floor(ticket/config.selectedTicketsPerPocket)]:others[Math.floor((ticket-config.chance)/config.otherTicketsPerPocket)];
    const pocketIndex=ROULETTE_NUMBERS.indexOf(number),color=rouletteColor(number),won=typeof choice==='number'?number===choice:color===choice;
    payoutCents=won?stakeCents*config.grossMultiplier:0;
    outcome={number,pocketIndex,color,won,label:number+' · '+({red:'красное',black:'чёрное',green:'зелёное'}[color]),multiplier:won?config.grossMultiplier:0};
  }else if(game==='plinko'){
    const pathIndex=pathForTicket(ticket,config.distribution.ticketStarts);
    const steps=Array.from({length:8},(_,row)=>(pathIndex>>(7-row))&1?1:-1),path=[0];let bin=0;
    for(const step of steps){if(step===1)bin++;path.push(path.at(-1)+step);}
    const multiplier=PLINKO_MULTIPLIERS[bin];payoutCents=Number(BigInt(stakeCents)*BigInt(Math.round(multiplier*100))/100n);
    outcome={steps,path,offsets:path,pathIndex,bin,multiplier,won:payoutCents>stakeCents,label:'Ячейка '+(bin+1)+' · ×'+multiplier};
  }else if(game==='upgrader'){
    const won=ticket<config.chance;payoutCents=won?Number(BigInt(stakeCents)*BigInt(Math.round(choice*100))/100n):0;
    outcome={won,chance:config.chance,chanceFraction:config.chanceFraction,chancePercent:config.chancePercent,targetMultiplier:choice,
      multiplier:won?choice:0,label:won?'Улучшение ×'+choice:'Улучшение не выпало'};
  }
  return freeze({...outcome,game,choice,ticket,sampleSize:config.sampleSize,stake,stakeCents,payoutCents,payout:payoutCents/100,
    netCents:payoutCents-stakeCents,net:(payoutCents-stakeCents)/100,expectedGrossReturn:config.expectedGrossReturn,outcome});
}
export const ClassicGameMath=freeze({rules:classicRules,settle:settleClassic});
