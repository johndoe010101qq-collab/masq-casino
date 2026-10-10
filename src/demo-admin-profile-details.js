import {bonusPurchaseFloorMeasurement} from './bonus-purchase-floor-measurement.js';
import {universalSlotProfileMeasurement} from './universal-slot-profiles.js';
const slotOffers=Object.freeze([
  {game:'slots',mode:'paid',name:'Обычный спин'},
  {game:'slots',mode:'buy',name:'Покупка бонуса'},
  {game:'maskhouse',mode:'paid',name:'Обычный спин'},
  {game:'maskhouse',mode:'buy',bonusTier:'sticky',name:'Маскарад'},
  {game:'lecipher',mode:'paid',name:'Обычный спин'},
  {game:'lecipher',mode:'buy',bonusTier:'luck',name:'Тайник'},
  {game:'lecipher',mode:'buy',bonusTier:'gold',name:'Золотой архив'},
  {game:'lecipher',mode:'paid',featureMode:'hunt',name:'Охота за бонусом'},
  {game:'lecipher',mode:'paid',featureMode:'rainbow',name:'Радужный спин'},
]);

// Connect the authoritative snapshots and their matching frozen statistics.
// Missing/mismatched sources produce an explicit unavailable measurement, never
// a fabricated RTP equal to the preset name. No outcomes are generated here.
export function createAdminProfileDetails({slotProfileSnapshot,classicProfileSnapshot,bonanzaStatistics,maskStatistics}) {
  return function getProfileDetails(game,value) {
    if(!['slots','maskhouse','lecipher'].includes(game)){
      const profile=classicProfileSnapshot?.(game,value);
      if(!profile)return null;
      const n=number=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(number);
      let rule=profile.rule;
      if(game==='coinflip')rule=`Шанс выбранной стороны: ${n(profile.chancePercent)}%. Выплата ×${n(profile.grossMultiplier)} ставки.`;
      if(game==='dice')rule=`Шанс выбранной грани: ${n(profile.chancePercent)}%. Выплата ×${n(profile.grossMultiplier)} ставки. Остальные грани равновероятны между собой.`;
      if(game==='roulette'){
        const zero=classicProfileSnapshot(game,value,{choice:'green'});
        rule=`Шанс выбранного цвета: ${n(profile.chancePercent)}% при выплате ×2. Для ставки на зеро: ${n(zero.chancePercent)}% при выплате ×36. Распределение фиксируется для выбранной ставки до начала раунда.`;
      }
      if(game==='upgrader')rule='Шансы успеха по цели: '+[1.5,2,4,8].map(choice=>{
        const spec=classicProfileSnapshot(game,value,{choice});return `×${n(choice)} — ${n(spec.chancePercent)}%`;
      }).join('; ')+'.';
      if(game==='plinko')rule='Профиль задаёт постоянные вероятности путей и лунок. Выплата соответствует настоящей конечной лунке; таблица множителей сохраняется. Полное распределение опубликовано в «Правилах шансов».';
      if(game==='blackjack')rule=`Шесть колод, 312 физических карт. При доборе игрока ${n(profile.playerUnfavorableTickets/profile.ticketCount*100)}% билетов выбирают неблагоприятную карту; у дилера ${n(profile.dealerBoostTickets/profile.ticketCount*100)}% — лучшую безопасную. Остальные билеты выбирают оставшиеся карты равномерно. Дилер стоит на мягкой 17. RTP измерен для базовой стратегии Hit / Stand и зависит от решений игрока.`;
      return {...profile,rule};
    }
    if(typeof slotProfileSnapshot!=='function')return null;
    const current=slotProfileSnapshot(game,value),offers=[];
    for(const offer of slotOffers.filter(row=>row.game===game)) {
      const profile=slotProfileSnapshot(game,value,offer);
      let row=null;
      if(profile.selectionMethod==='public-whole-candidate-weighting'){
        const measured=universalSlotProfileMeasurement(profile,offer,5000);
        offers.push({id:profile.offer,name:offer.name,meanPercent:measured?.meanPercent,
          ciPercent:measured?.ciPercent,samples:measured?.samples,
          calibrationSamples:measured?.calibrationSamples,evidenceKind:measured?.evidenceKind,
          note:measured?`${measured.stage}. Базовая ставка ${measured.baseStakeAR} АР; полное списание ${measured.chargeAR} АР.`
            :'Нет согласованной калибровки или независимой выборки этой версии.'});
        continue;
      }
      if(offer.mode==='buy'){
        const measured=bonusPurchaseFloorMeasurement(profile,offer,5000);
        offers.push({id:profile.offer,name:offer.name,meanPercent:measured?.meanPercent,
          ciPercent:measured?.ciPercent,samples:measured?.samples,
          note:measured?`Базовая ставка ${measured.baseStakeAR} АР; полное списание ${measured.chargeAR} АР. Возврат учитывает минимальную выплату купленного бонуса.`
            :'Нет согласованной выборки этой версии с минимальной выплатой купленного бонуса.'});
        continue; // Raw engine payouts are not evidence for the paid floor-aware round.
      }
      if(game==='slots') {
        const stats=bonanzaStatistics,sameSource=stats?.status==='passed'&&stats.version===profile.revision
          &&stats.sourceHashes?.['bonanza.js']===profile.baseSourceSHA256
          &&stats.sourceHashes?.['bonanza-profile-engine.js']===profile.profileEngineSourceSHA256;
        if(sameSource)row=stats.resultsByStake?.[`${profile.id}_${offer.mode}_5000`]
          ??stats.resultsByStake?.[`${profile.id}_${offer.mode}_500`]
          ??stats.results300k?.[`${profile.id}_${offer.mode}`]
          ??stats.results100k?.[`${profile.id}_${offer.mode}`];
        offers.push({id:profile.offer,name:offer.name,meanPercent:row?row.estimatedReturn*100:undefined,
          ciPercent:row?.estimatedReturn95CI?.map(v=>v*100),samples:row?.sampleRounds,
          note:row?`Базовая ставка ${row.stakeCents/100} АР; списание ${row.chargeCentsPerRound/100} АР`:'Нет согласованной выборки этой версии'});
      }else{
        const sameSource=maskStatistics?.baseSourceSHA256===profile.baseSourceSHA256
          &&(profile.id==='rtp50'||maskStatistics?.derivedSourceSHA256===profile.derivedSourceSHA256);
        if(sameSource)row=profile.measured?.find(sample=>sample.baseStakeAR===50)??profile.measured?.[0];
        offers.push({id:profile.offer,name:offer.name,meanPercent:row?.estimatedGrossReturnPercent,
          ciPercent:row?.meanGrossReturn95CI_Percent,samples:row?.samples,
          note:row?`Базовая ставка ${row.baseStakeAR} АР; списание ${row.chargeAR} АР`:'Нет согласованной выборки этой версии'});
      }
    }
    return {...current,kind:'approximate',rule:current.selectionMethod==='public-whole-candidate-weighting'
      ?current.notice:game==='slots'
      ?'Возврат показан по полным оплаченным раундам, со всеми обычными и бонусными вращениями. Цель профиля и измеренная оценка могут различаться.'
      :'Таблицы выплат и цены сохраняются. Профиль меняет открытое распределение бонусных вращений. Возврат учитывает полную цену каждого режима.',offers};
  };
}
