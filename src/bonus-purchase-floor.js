// Public post-engine purchase rule. It consumes no RNG and changes no symbols,
// awards, prices, paytables, or maximum liability. Natural bonuses are unchanged.
export const BONUS_PURCHASE_FLOOR_REVISION='indictus-public-bonus-purchase-floor-v13';
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const integer=(value,name)=>{if(!Number.isSafeInteger(value)||value<0)throw new RangeError(name+' must be nonnegative integer cents.');return value;};
export function bonusPurchaseFloorSnapshot(mode='paid') {
 if(!['paid','buy','preview'].includes(mode))throw new RangeError('Invalid bonus floor mode.');
 return freeze({revision:BONUS_PURCHASE_FLOOR_REVISION,mode,applies:mode==='buy',minimumReturnBasisPoints:mode==='buy'?1000:0,
  basis:'entire charged bonus purchase price',rounding:'ceil to whole cents',additionalRng:false,
  notice:mode==='buy'?'Минимальная полная выплата купленного бонуса — 10% всей цены покупки. Недостающая сумма начисляется отдельной выплатой бонуса; символы, вращения и таблицы выплат не меняются.':'Правило покупки не применяется к обычному спину или просмотру; естественные бонусы сохраняют свои правила.'});
}
export function bonusPurchaseMinimumCents(chargeCents,mode='buy') {
 integer(chargeCents,'chargeCents');const rule=bonusPurchaseFloorSnapshot(mode);
 const amount=(BigInt(chargeCents)*BigInt(rule.minimumReturnBasisPoints)+9999n)/10000n;
 return integer(Number(amount),'minimum payout');
}
export function applyBonusPurchaseFloor(result,{game=result?.game??'slots',mode=result?.mode,chargeCents=result?.chargeCents,profileRules}={}) {
 if(!result||typeof result!=='object')throw new TypeError('A complete precomputed round is required.');
 if(mode!=='buy')return result;
 if(!['slots','maskhouse','lecipher'].includes(game)||result.mode!=='buy'||result.preview)throw new RangeError('The minimum applies only to paid slot bonus purchases.');
 integer(chargeCents,'chargeCents');if(chargeCents!==result.chargeCents||chargeCents===0)throw new RangeError('Purchase charge mismatch.');
 const rule=profileRules?.bonusPurchaseFloor??bonusPurchaseFloorSnapshot(mode),expected=bonusPurchaseFloorSnapshot(mode);
 if(rule.revision!==expected.revision||rule.minimumReturnBasisPoints!==1000||rule.mode!=='buy'||!rule.applies)throw new RangeError('Purchase floor rule mismatch.');
 const minimum=bonusPurchaseMinimumCents(chargeCents),payout=integer(result.payoutCents,'payoutCents'),cap=integer(result.winCapCents??result.capCents,'capCents');
 if(minimum>cap||payout>cap)throw new RangeError('The purchase minimum must fit the published round cap.');
 if(!Array.isArray(result.spins)||!result.spins.length||result.spins.reduce((sum,spin)=>sum+integer(spin.payoutCents,'spin payout'),0)!==payout)throw new RangeError('Spin payouts must reconcile with the complete round.');
 if(result.bonusPurchaseFloorApplied){
  if(result.bonusPurchaseFloor?.revision!==rule.revision||result.bonusMinimumCents!==minimum||payout<minimum
   ||integer(result.enginePayoutCents,'engine payout')+integer(result.bonusPurchaseFloorPaymentCents,'purchase payment')!==payout)throw new RangeError('Invalid already-applied purchase rule.');
  return result;
 }
 const payment=Math.max(0,minimum-payout),existingPayment=integer(result.bonusPaymentCents??0,'existing bonus payment');
 const spins=payment?result.spins.map((spin,index)=>{
  if(index!==result.spins.length-1)return spin;
  const before=spin.terminal??spin.frames.at(-1)?.after;if(!before)throw new TypeError('Terminal grid is required.');
  const frame={phase:'bonus-payment',index:spin.frames.length,terminal:true,before,after:before,
   wins:[{kind:'bonus-payment',cells:[],bonusPayment:true,payoutCents:payment,creditedPayoutCents:payment}],
   removed:[],refill:[],goldenCells:spin.goldenCells??[],payoutCents:payment,creditedPayoutCents:payment,
   bonusPurchaseFloor:true,bonusMinimumCents:minimum,bonusPurchaseCostCents:chargeCents};
  return {...spin,frames:[...spin.frames,frame],payoutCents:spin.payoutCents+payment,
   ...(Object.hasOwn(spin,'totalPayoutCents')?{totalPayoutCents:payout+payment}:{}),
   bonusPurchaseFloorPaymentCents:payment,creditedBonusPaymentCents:payment,
   bonusPaymentCents:(spin.bonusPaymentCents??existingPayment)+payment};
 }):result.spins;
 const final=payout+payment,ledger={...result.ledger,creditCents:final,
  ...(Object.hasOwn(result.ledger??{},'deltaCents')?{deltaCents:final-chargeCents}:{})};
 return freeze({...result,spins,payoutCents:final,ledger,enginePayoutCents:payout,
  bonusPurchaseFloor:rule,bonusPurchaseFloorApplied:true,bonusMinimumCents:minimum,
  bonusPurchaseFloorPaymentCents:payment,bonusPaymentCents:existingPayment+payment});
}
