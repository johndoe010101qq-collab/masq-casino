export const PLINKO_RATES = Object.freeze([1300,300,130,70,40,70,130,300,1300]);
export const ROULETTE_ORDER = Object.freeze([0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]);
const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const CHOICES = Object.freeze({coinflip:['mask','number'],dice:[1,2,3,4,5,6],plinko:['normal'],roulette:['red','black','zero'],upgrader:[1.5,2,4,8]});
const SAMPLES = Object.freeze({coinflip:2,dice:6,plinko:256,roulette:37,upgrader:10000});
export const GAME_META = Object.freeze([
  {id:'coinflip',name:'Coinflip',description:'Маска или число',caption:'Две стороны. Один выбор.',tag:'×2',duration:1.6},
  {id:'dice',name:'Dice',description:'Выбери грань',caption:'Шесть граней. Один бросок.',tag:'×6',duration:1.6},
  {id:'plinko',name:'Plinko',description:'Найди свой маршрут',caption:'Восемь уровней до результата.',tag:'до ×13',duration:1.8},
  {id:'roulette',name:'Roulette',description:'Красное, чёрное, зеро',caption:'37 секторов европейского колеса.',tag:'до ×36',duration:3.4},
  {id:'upgrader',name:'Upgrader',description:'Выбери множитель',caption:'Больше множитель — меньше шанс.',tag:'до ×8',duration:1.8},
  {id:'slots',name:'Bonanza',description:'Маска открывает бонус',caption:'Каскады и свободные вращения.',tag:'6 × 5',duration:0}
]);
export function rules(game,choice) {
  if (!CHOICES[game]?.includes(choice)) throw new RangeError('Выбери доступный вариант.');
  return {sampleSize:SAMPLES[game]};
}
export function settle(game,choice,stake,balance,ticket) {
  const config=rules(game,choice);
  if (!Number.isSafeInteger(ticket) || ticket<0 || ticket>=config.sampleSize) throw new RangeError('Некорректный результат.');
  const stakeCents=Math.round(stake*100);
  if (!Number.isSafeInteger(stakeCents) || stakeCents<=0 || stake>balance) throw new RangeError('Некорректная ставка.');
  let rate=0, data={ticket};
  if (game==='coinflip') {data.result=ticket;data.label=ticket===0?'Маска':'Число';rate=((choice==='mask')===(ticket===0))?200:0;}
  if (game==='dice') {data.face=ticket+1;data.label='Грань '+data.face;rate=data.face===choice?600:0;}
  if (game==='plinko') {data.path=Object.freeze(Array.from({length:8},(_,row)=>(ticket>>row)&1));data.bucket=data.path.reduce((sum,bit)=>sum+bit,0);rate=PLINKO_RATES[data.bucket];data.label='×'+(rate/100).toLocaleString('ru-RU');}
  if (game==='roulette') {data.number=ticket;data.color=ticket===0?'zero':RED.has(ticket)?'red':'black';data.label=ticket+' · '+({red:'красное',black:'чёрное',zero:'зеро'}[data.color]);rate=data.color===choice?(choice==='zero'?3600:200):0;}
  if (game==='upgrader') {data.chance=.96/choice;data.percentile=ticket/10000;data.label=(ticket/100).toLocaleString('ru-RU',{maximumFractionDigits:2})+'%';rate=ticket<Math.floor(data.chance*10000)?Math.round(choice*100):0;}
  const payoutCents=Number(BigInt(stakeCents)*BigInt(rate)/100n);
  return Object.freeze({...data,multiplier:rate/100,payoutCents,payout:payoutCents/100});
}
export const demoMath = Object.freeze({rules,settle});
