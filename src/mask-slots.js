// Original Indictus demo mechanics. Inspired by genres, not provider mathematics.
// All money is integer cents; no balance/history input and no Math.random().
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

export const MASK_REGULAR_KINDS = freeze([
  'hood', 'suit', 'glove', 'laptop', 'usb', 'lock', 'key', 'radio', 'flag'
]);
const regular = new Set(MASK_REGULAR_KINDS);
export const MASKHOUSE_LINES = freeze([
  [1,1,1,1,1], [0,0,0,0,0], [2,2,2,2,2], [0,1,2,1,0], [2,1,0,1,2],
  [0,0,1,2,2], [2,2,1,0,0], [1,0,0,0,1], [1,2,2,2,1], [0,1,1,1,0],
  [2,1,1,1,2], [1,0,1,2,1], [1,2,1,0,1], [0,1,0,1,0], [2,1,2,1,2],
  [1,1,0,1,1], [1,1,2,1,1], [0,0,2,0,0], [2,2,0,2,2], [0,2,2,2,0]
]);

// Percentages of TOTAL stake per winning line, not stake divided by 20.
const HOUSE_PAYS = {
  hood:[261,653,1958], suit:[209,522,1567], glove:[170,424,1306],
  laptop:[137,359,1110], usb:[111,294,914], lock:[91,235,718],
  key:[72,182,555], radio:[56,144,424], flag:[42,117,326]
};
// Cluster tiers 5–6 / 7–9 / 10–14 / 15+; percentages of total stake.
const CIPHER_PAYS = {
  hood:[145,361,940,2313], suit:[123,318,795,2024], glove:[101,261,651,1662],
  laptop:[87,217,550,1373], usb:[72,188,462,1156], lock:[61,159,390,983],
  key:[51,130,318,795], radio:[41,109,261,651], flag:[32,87,217,550]
};
const scaledPays = (pays, basisPoints) => Object.fromEntries(Object.entries(pays).map(([kind, tiers]) => [kind, tiers.map(percent => percent*basisPoints/10000)]));
const HOUSE_PAY_SCALE_BP=17500;
const HOUSE_NO_WILD_PAY_SCALE_BP=500;
const HOUSE_FREE_NO_WILD_PAY_SCALE_BP=500;
const HOUSE_FREE_PAY_SCALE_BP=60000;
const HOUSE_BUY_SCALE_BP=HOUSE_FREE_PAY_SCALE_BP;
const CIPHER_PAY_SCALE_BP=3700;
const CIPHER_LUCK_FREE_SCALE_BP=150000;
const CIPHER_GOLD_FREE_SCALE_BP=4825;
const CIPHER_BUY_SCALE_BP=CIPHER_LUCK_FREE_SCALE_BP;
const CIPHER_GOLD_BUY_SCALE_BP=CIPHER_GOLD_FREE_SCALE_BP;
const CIPHER_COIN_WEIGHTS=[[14,30],[29,28],[51,22],[72,14],[109,9],[145,5],[289,2],[723,1]];

export const LEXOF_FEATURE_RULES = freeze({
  hunt:{id:'hunt',multiplier:3,scatterWeight:3700,drawWeightScale:1000,payScaleBasisPoints:13200,guaranteedActivation:false},
  rainbow:{id:'rainbow',multiplier:10,scatterWeight:2000,drawWeightScale:1000,payScaleBasisPoints:60000,guaranteedActivation:true}
});
function featureFor(game,mode,featureMode) {
  if(featureMode==null)return null;
  if(game!=='lecipher'||mode!=='paid'||!Object.hasOwn(LEXOF_FEATURE_RULES,featureMode))fail('FEATURE','Unknown or incompatible feature mode.');
  return LEXOF_FEATURE_RULES[featureMode];
}

export const MASK_SLOT_RULES = freeze({
  version:'indictus-mask-slots-original-v10-features', minimumStake:5, maximumStake:250,
  stakeStep:5, winCapMultiplier:40, winCapOffsetCents:100, purchaseAvailable:true,
  bonusMinimumReturnBasisPoints:500, bonusMinimumNotice:'A whole round with a bonus returns at least 5% of the equivalent bonus purchase price. The paid launch payout of a natural bonus counts toward this minimum. Any shortfall is a real separate bonus-payment frame, never an invented line/coin win.',
  notice:'Original Indictus rules inspired by documented bonus mechanics. Own prices and weights, disclosed whole-round cap of 40x base stake minus 1 AR; no provider mathematics or provider RTP claim. Free-spin payout tables are shared by natural and purchased bonuses for the same active tier. Paid tables are published separately. Each line, group or collected coin is rounded down to cents before the cap. Results never depend on balance or history.',
  maskhouse:{
    columns:5, rows:3, lines:MASKHOUSE_LINES, lineMatchMinimum:3,
    baseRegularWeights:[40,50,65,80,95,110,125,140,155],
    freeRegularWeights:[40,50,65,80,95,110,125,140,155],
    baseScatterWeight:60, freeScatterWeight:0,
    baseRegularWeightScaleByReel:[1,100,1,100,1], freeRegularWeightScaleByReel:[1,100,1,100,1],
    baseWildWeightsByReel:[0,1,40,1,0], freeWildWeightsByReel:[0,1,40,1,0],
    ordinaryRoundCapMultiplier:25, ordinaryFreeSpinCapPercent:260,
    legendaryCondition:{type:'five-symbol-line',kind:'hood',middleKinds:['wild','wild','wild'],minimumCount:5,award:'whole-round hard cap'},
    legendaryNotice:'Only a real paying line hood / WILD / WILD / WILD / hood can exceed the ordinary whole-round 25x budget or the ordinary free-spin 2.6x budget. That line awards the remaining amount up to 40x base stake minus 1 AR. Every other line is limited by both shared budgets.',
    wildMultipliers:[[2,3],[3,1]],
    pays:scaledPays(HOUSE_PAYS,HOUSE_PAY_SCALE_BP), payScaleBasisPoints:HOUSE_PAY_SCALE_BP,
    freePayScaleBasisPoints:HOUSE_FREE_PAY_SCALE_BP,
    noWildPayScaleBasisPoints:HOUSE_NO_WILD_PAY_SCALE_BP, freeNoWildPayScaleBasisPoints:HOUSE_FREE_NO_WILD_PAY_SCALE_BP,
    noWildPays:scaledPays(HOUSE_PAYS,HOUSE_NO_WILD_PAY_SCALE_BP), freeNoWildPays:scaledPays(HOUSE_PAYS,HOUSE_FREE_NO_WILD_PAY_SCALE_BP),
    freePays:scaledPays(HOUSE_PAYS,HOUSE_FREE_PAY_SCALE_BP),
    boughtFreePayScaleBasisPoints:HOUSE_BUY_SCALE_BP,
    boughtFreePays:scaledPays(HOUSE_PAYS,HOUSE_BUY_SCALE_BP),
    initialFreeSpins:null, retriggerFreeSpins:0, bonusBuyMultiplier:20,
    bonusAwardWeights:[[1,72],[2,26],[3,2]],
    bonusSelection:{columns:3,rows:3,values:[[1,72],[2,26],[3,2]],minimum:9,maximum:27},
    triggerPayoutMultiplier:5, scatterColumns:[0,2,4], triggerRequiresEveryScatterReel:true,
    bonusBuys:[{id:'sticky',name:'Sticky Masks',multiplier:20,initialFreeSpins:null,payScaleBasisPoints:HOUSE_FREE_PAY_SCALE_BP}],
    wildNotice:'Wilds land only on reels 2–4. They substitute regular symbols and have ×2 or ×3. On paid spins all wilds on one reel share the first landed wild multiplier. Multipliers of wilds in one paid line are added; no wild means ×1. Wilds stay in their cells during free spins. A bonus requires a BONUS on each of reels 1, 3 and 5.'
  },
  lecipher:{
    columns:6, rows:5, clusterMatchMinimum:5,
    baseRegularWeights:[5,6,8,10,14,17,20,26,34],
    freeRegularWeights:[5,6,8,10,14,17,20,26,34],
    baseScatterWeight:2, freeScatterWeight:1,
    baseTokenWeight:2, freeTokenWeight:3, maximumVisibleActivationTokens:1,
    activationTokenNotice:'At most one visible activation token. Initial cells are generated column-major from top to bottom. Before a token appears, regular/scatter/token weights apply. Once a retained or newly generated token exists, token weight is excluded from all remaining initial/refill draws; no ticket is rerolled. Collection reward cells are not activation tokens. A new free spin starts a new grid.',
    activationTokenMultiplier:1,
    pays:scaledPays(CIPHER_PAYS,CIPHER_PAY_SCALE_BP),payScaleBasisPoints:CIPHER_PAY_SCALE_BP,
    freePayScaleBasisPointsByTier:{luck:CIPHER_LUCK_FREE_SCALE_BP,gold:CIPHER_GOLD_FREE_SCALE_BP,treasure:CIPHER_GOLD_FREE_SCALE_BP},
    freePaysByTier:{luck:scaledPays(CIPHER_PAYS,CIPHER_LUCK_FREE_SCALE_BP),gold:scaledPays(CIPHER_PAYS,CIPHER_GOLD_FREE_SCALE_BP),treasure:scaledPays(CIPHER_PAYS,CIPHER_GOLD_FREE_SCALE_BP)},
    freeCoinPercentWeightsByTier:{luck:CIPHER_COIN_WEIGHTS.map(([percent,weight])=>[percent*CIPHER_LUCK_FREE_SCALE_BP/10000,weight]),gold:CIPHER_COIN_WEIGHTS.map(([percent,weight])=>[percent*CIPHER_GOLD_FREE_SCALE_BP/10000,weight]),treasure:CIPHER_COIN_WEIGHTS.filter(([percent])=>percent>=109).map(([percent,weight])=>[percent*CIPHER_GOLD_FREE_SCALE_BP/10000,weight])},
    boughtFreePayScaleBasisPoints:CIPHER_BUY_SCALE_BP,
    boughtFreePays:scaledPays(CIPHER_PAYS,CIPHER_BUY_SCALE_BP),
    coinBasePercentWeights:CIPHER_COIN_WEIGHTS,
    coinPercentWeights:CIPHER_COIN_WEIGHTS.map(([percent,weight])=>[percent*CIPHER_PAY_SCALE_BP/10000,weight]),
    boughtFreeCoinPercentWeights:CIPHER_COIN_WEIGHTS.map(([percent,weight])=>[percent*CIPHER_BUY_SCALE_BP/10000,weight]),
    boughtFreeCoinPercentWeightsByTier:{luck:CIPHER_COIN_WEIGHTS.map(([percent,weight])=>[percent*CIPHER_BUY_SCALE_BP/10000,weight]),gold:CIPHER_COIN_WEIGHTS.map(([percent,weight])=>[percent*CIPHER_GOLD_BUY_SCALE_BP/10000,weight])},
    initialFreeSpins:8,retriggerFreeSpins:2,bonusBuyMultiplier:20,
    bonusTiers:{luck:{initialFreeSpins:8,permanentGold:false,guaranteedToken:false},gold:{initialFreeSpins:12,permanentGold:true,guaranteedToken:false},treasure:{initialFreeSpins:12,permanentGold:true,guaranteedToken:true,buyable:false}},
    bonusBuys:[{id:'luck',name:'Luck',multiplier:20,initialFreeSpins:8,payScaleBasisPoints:CIPHER_LUCK_FREE_SCALE_BP},{id:'gold',name:'Gold',multiplier:25,initialFreeSpins:12,payScaleBasisPoints:CIPHER_GOLD_FREE_SCALE_BP}],
    boughtFreePaysByTier:{luck:scaledPays(CIPHER_PAYS,CIPHER_BUY_SCALE_BP),gold:scaledPays(CIPHER_PAYS,CIPHER_GOLD_BUY_SCALE_BP)},
    collectionTypeWeights:[['coin',90],['clover',7],['pot',3]],
    cloverMultiplierWeights:[[2,320],[3,240],[4,2],[5,2],[10,1]],
    ordinaryRoundCapMultiplier:30, ordinaryFreeSpinCapPercent:300, ordinaryFreeSpinCapPercentByTier:{luck:350,gold:300,treasure:300},
    bonusMinimumEquivalentPurchaseMultipliers:{luck:20,gold:25,treasure:25},
    legendaryCondition:{type:'fresh-booster-square',columns:2,rows:2,multiplier:10,award:'whole-round hard cap'},
    legendaryNotice:'Only four freshly drawn x10 clovers occupying one 2x2 square in a single collection can exceed the ordinary whole-round 30x budget or the ordinary free-spin budget (Luck 3.5x; Gold/Treasure 3x). Retained pots cannot satisfy the condition. The visible square awards the remaining amount up to 40x base stake minus 1 AR. No hidden jackpot ticket is drawn.',
    treasureCoinBasePercentWeights:CIPHER_COIN_WEIGHTS.filter(([percent])=>percent>=109),
    retriggerAwards:[[2,2],[3,4]],
    goldenNotice:'Luck keeps gold until collection; Gold and Treasure keep gold throughout the bonus. Treasure guarantees an activation token every spin and cannot be bought. Clovers multiply orthogonally adjacent coins/pots; pots collect all other coin/pot values top-to-bottom then left-to-right. A pot restarts the gold reveal. All tables and the whole-round cap are Indictus rules.'
  }
});

export class MaskSlotLimitError extends Error {
  constructor(code, message) { super(message); this.name='MaskSlotLimitError'; this.code=code; }
}
const fail = (code, text) => { const error=new RangeError(text); error.code=code; throw error; };
function validateStake(stakeCents) {
  if (!Number.isSafeInteger(stakeCents) || stakeCents<500 || stakeCents>25000 || stakeCents%500) {
    fail('STAKE','Stake must be 5–250 AR in steps of 5 AR, supplied as integer cents.');
  }
}
function checkedInteger(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value<minimum || value>maximum) fail('INPUT',`${label} out of range.`);
  return value;
}
function configFor(game) {
  if (game!=='maskhouse' && game!=='lecipher') fail('GAME','Unknown mask slot.');
  return MASK_SLOT_RULES[game];
}
function scaleForSpin(game,config,freeSpin,bonusTier) {
  if(!freeSpin)return config.payScaleBasisPoints;
  if(game==='maskhouse')return config.freePayScaleBasisPoints;
  const scale=config.freePayScaleBasisPointsByTier[bonusTier];
  if(!Number.isSafeInteger(scale))fail('MODE','Unknown active free-spin tier.');
  return scale;
}
function makeContext(game, randomInt, maxCascades=50,maxCollections=20) {
  if (typeof randomInt!=='function') throw new TypeError('An unbiased randomInt(maximum) function is required.');
  return {game,config:configFor(game),randomInt,nextId:0,maxCascades:checkedInteger(maxCascades,1,100,'maxCascades'),maxCollections:checkedInteger(maxCollections,1,50,'maxCollections')};
}
function draw(context, maximum) {
  const ticket=context.randomInt(maximum);
  if (!Number.isSafeInteger(ticket) || ticket<0 || ticket>=maximum) fail('RNG','randomInt returned an invalid ticket.');
  return ticket;
}
function pick(context, entries) {
  let ticket=draw(context,entries.reduce((sum,entry)=>sum+entry[1],0));
  for (const [value,weight] of entries) { if(ticket<weight)return value;ticket-=weight; }
  throw new Error('Invalid weight table.');
}
function newCell(context,kind,extra={}) {
  if(!regular.has(kind) && !['scatter','wild','bomb'].includes(kind)) fail('CELL','Invalid kind.');
  return Object.freeze({id:`${context.game}-${++context.nextId}`,kind,...extra});
}
function sampleCell(context,column,freeSpin,{allowToken=true}={}) {
  const config=context.config;
  const regularScale=context.game==='maskhouse'?(freeSpin?config.freeRegularWeightScaleByReel:config.baseRegularWeightScaleByReel)[column]:1;
  const entries=MASK_REGULAR_KINDS.map((kind,i)=>[kind,(freeSpin?config.freeRegularWeights:config.baseRegularWeights)[i]*regularScale]);
  if(context.game==='lecipher'||(!freeSpin&&config.scatterColumns.includes(column)))entries.push(['scatter',freeSpin?config.freeScatterWeight:config.baseScatterWeight]);
  if(context.game==='maskhouse' && column>0 && column<4) entries.push(['wild',(freeSpin?config.freeWildWeightsByReel:config.baseWildWeightsByReel)[column]]);
  if(context.game==='lecipher'&&allowToken) entries.push(['bomb',freeSpin?config.freeTokenWeight:config.baseTokenWeight]);
  if(context.game==='lecipher'&&!freeSpin&&context.feature){
    for(const entry of entries)entry[1]=entry[0]==='scatter'?context.feature.scatterWeight:entry[1]*context.feature.drawWeightScale;
  }
  const kind=pick(context,entries);
  if(kind==='wild') return newCell(context,kind,{value:pick(context,config.wildMultipliers)});
  if(kind==='bomb') return newCell(context,kind,{value:1,token:true,activation:true});
  return newCell(context,kind);
}
const position=(column,row)=>({column,row});
const keyOf=(column,row)=>column+':'+row;
const positions = set => [...set].map(key=>{const [column,row]=key.split(':').map(Number);return position(column,row);});
const amount = (stakeCents,percent,scaleBasisPoints=10000) => Math.floor(stakeCents*percent*scaleBasisPoints/1000000);
function gridFrom(context,freeSpin,initialGrid,stickyWilds=new Map()) {
  const {columns,rows}=context.config;
  if(initialGrid && (!Array.isArray(initialGrid) || initialGrid.length!==columns || initialGrid.some(col=>!Array.isArray(col)||col.length!==rows))) fail('GRID','Wrong grid dimensions.');
  if(context.game==='lecipher'&&initialGrid&&initialGrid.flat().filter(cell=>(typeof cell==='string'?cell:cell?.kind)==='bomb').length>context.config.maximumVisibleActivationTokens)fail('GRID','Only one visible activation token is allowed.');
  let hasToken=false;
  return Array.from({length:columns},(_,column)=>Array.from({length:rows},(_,row)=>{
    const sticky=stickyWilds.get(keyOf(column,row));
    if(sticky) return sticky;
    if(!initialGrid){const cell=sampleCell(context,column,freeSpin,{allowToken:!hasToken});if(cell.activation)hasToken=true;return cell;}
    const input=initialGrid[column][row],kind=typeof input==='string'?input:input?.kind;
    if(kind==='scatter'&&context.game==='maskhouse'&&(freeSpin||!context.config.scatterColumns.includes(column)))fail('GRID','Mask House BONUS appears only on paid reels 1, 3 and 5.');
    if(kind==='wild') {
      if(context.game!=='maskhouse' || column===0 || column===4) fail('GRID','Wild can only appear on middle MaskHouse reels.');
      const value=input?.value??2;
      if(![2,3].includes(value)) fail('GRID','Invalid wild multiplier.');
      return newCell(context,kind,{value});
    }
    if(kind==='bomb') {
      if(context.game!=='lecipher') fail('GRID','Tokens are LeCipher symbols.');
      return newCell(context,kind,{value:1,token:true,activation:true});
    }
    return newCell(context,kind);
  }));
}
function clippedWins(wins,capBudget) {
  let remaining=capBudget;
  return wins.map(win=>{
    const payoutCents=Math.min(remaining,win.payoutCents);
    remaining-=payoutCents;
    return {...win,rawPayoutCents:win.payoutCents,payoutCents};
  }).filter(win=>win.payoutCents>0);
}

export function evaluateMaskHouseLines(grid,stakeCents,scaleBasisPoints=HOUSE_PAY_SCALE_BP,noWildScaleBasisPoints=HOUSE_NO_WILD_PAY_SCALE_BP) {
  const wins=[];
  for(let line=0;line<MASKHOUSE_LINES.length;line++) {
    const rows=MASKHOUSE_LINES[line],kind=grid[0][rows[0]].kind;
    if(!regular.has(kind)) continue;
    const cells=[position(0,rows[0])]; let multiplier=0;
    for(let column=1;column<5;column++) {
      const cell=grid[column][rows[column]];
      if(cell.kind!==kind && cell.kind!=='wild') break;
      cells.push(position(column,rows[column]));
      if(cell.kind==='wild')multiplier+=cell.value;
    }
    if(cells.length<3)continue;
    const hasWild=multiplier>0;
    multiplier=Math.max(1,multiplier);
    wins.push({kind,cells,line,count:cells.length,multiplier,
      hasWild,payoutCents:amount(stakeCents,HOUSE_PAYS[kind][cells.length-3]*multiplier,hasWild?scaleBasisPoints:noWildScaleBasisPoints)});
  }
  return wins;
}
export function findMaskHouseLegendaryLine(grid) {
  for(let line=0;line<MASKHOUSE_LINES.length;line++) {
    const cells=MASKHOUSE_LINES[line].map((row,column)=>position(column,row));
    if(cells.every(({column,row})=>grid[column][row].kind===(column===0||column===4?'hood':'wild')))return {line,cells};
  }
  return null;
}
export function findLeCipherLegendarySquare(rewards) {
  const fresh=new Set(rewards.filter(reward=>reward.fresh&&reward.type==='clover'&&reward.value===10).map(({column,row})=>keyOf(column,row)));
  for(let column=0;column<5;column++)for(let row=0;row<4;row++) {
    const cells=[position(column,row),position(column+1,row),position(column,row+1),position(column+1,row+1)];
    if(cells.every(({column,row})=>fresh.has(keyOf(column,row))))return cells;
  }
  return null;
}
function houseSpin(context,stakeCents,{freeSpin=false,capBudget,ordinaryCapBudget=capBudget,initialGrid,stickyWilds=new Map(),allowLegendary=true}={}) {
  let grid=gridFrom(context,freeSpin,initialGrid,stickyWilds);
  // A paid reel shares one multiplier. Every free-spin sticky wild instead
  // keeps the multiplier that was revealed when that individual wild landed.
  if(!freeSpin)grid=grid.map(column=>{
    const firstWild=column.find(cell=>cell.kind==='wild');
    return firstWild?column.map(cell=>cell.kind==='wild'&&cell.value!==firstWild.value?newCell(context,'wild',{value:firstWild.value}):cell):column;
  });
  if(freeSpin)for(let column=1;column<4;column++)for(let row=0;row<3;row++){
    if(grid[column][row].kind==='wild')stickyWilds.set(keyOf(column,row),grid[column][row]);
  }
  const scatters=grid.flat().filter(cell=>cell.kind==='scatter').length;
  const bonusSelection=!freeSpin&&context.config.scatterColumns.every(column=>grid[column].some(cell=>cell.kind==='scatter'))?Array.from({length:9},()=>pick(context,context.config.bonusSelection.values)):[];
  const awardedSpins=bonusSelection.reduce((sum,value)=>sum+value,0);
  const rawWins=evaluateMaskHouseLines(grid,stakeCents,context.payoutScaleBasisPoints??context.config.payScaleBasisPoints,freeSpin?context.config.freeNoWildPayScaleBasisPoints:context.config.noWildPayScaleBasisPoints);
  const legendaryLine=allowLegendary?findMaskHouseLegendaryLine(grid):null;
  if(legendaryLine)rawWins.unshift({kind:'hood',...legendaryLine,count:5,multiplier:1,legendary:true,payoutCents:capBudget});
  if(awardedSpins)rawWins.unshift({kind:'scatter',cells:grid.flatMap((col,column)=>col.flatMap((cell,row)=>cell.kind==='scatter'?[position(column,row)]:[])),trigger:true,payoutCents:stakeCents*context.config.triggerPayoutMultiplier});
  const wins=clippedWins(rawWins,legendaryLine?capBudget:ordinaryCapBudget),payoutCents=wins.reduce((sum,win)=>sum+win.payoutCents,0);
  return {initial:grid,frames:[{phase:'lines',before:grid,after:grid,wins,removed:[],refill:[],goldenCells:[],payoutCents}],
    terminal:grid,freeSpin,legendary:!!legendaryLine,payoutCents,awardedSpins,bonusSelection,bonusTier:freeSpin?'sticky':null,awardedTier:awardedSpins?'sticky':null,scatterCount:scatters,stickyWildCells:positions(new Set(stickyWilds.keys())),goldenCells:[]};
}

export function findLeCipherClusters(grid) {
  const columns=grid.length,rows=grid[0].length,visited=new Set(),wins=[];
  for(let column=0;column<columns;column++)for(let row=0;row<rows;row++) {
    const key=keyOf(column,row),kind=grid[column][row].kind;
    if(visited.has(key)||!regular.has(kind))continue;
    visited.add(key);const cells=[],queue=[position(column,row)];
    for(let cursor=0;cursor<queue.length;cursor++) {
      const current=queue[cursor];cells.push(current);
      for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const c=current.column+dc,r=current.row+dr,k=keyOf(c,r);
        if(c<0||c>=columns||r<0||r>=rows||visited.has(k)||grid[c][r].kind!==kind)continue;
        visited.add(k);queue.push(position(c,r));
      }
    }
    if(cells.length>=5)wins.push({kind,cells,count:cells.length});
  }
  return wins;
}
const clusterTier = n=>n<7?0:n<10?1:n<15?2:3;
function fall(context,before,kinds,freeSpin) {
  const removed=[],refill=[];
  // Count all retained activation tokens before any refill is generated, even
  // when the retained token is on a later reel in column-major draw order.
  const survivors=before.map((column,c)=>column.filter((cell,row)=>{
    if(kinds.has(cell.kind)){removed.push({column:c,row,cell});return false;}return true;
  }));
  let hasToken=survivors.flat().some(cell=>cell.activation&&cell.token);
  const after=survivors.map((surviving,c)=>{
    const vacancies=context.config.rows-surviving.length;
    const incoming=Array.from({length:vacancies},(_,row)=>{
      const cell=sampleCell(context,c,freeSpin,{allowToken:!hasToken});
      if(cell.activation)hasToken=true;
      refill.push({column:c,row,cell});return cell;
    });
    return [...incoming,...surviving];
  });
  return {after,removed,refill};
}

function cipherSpin(context,stakeCents,{freeSpin=false,capBudget,ordinaryCapBudget=capBudget,initialGrid,golden=new Set(),bonusTier=null}={}) {
  let initial=gridFrom(context,freeSpin,initialGrid),guaranteedToken=null;
  if(((freeSpin&&bonusTier==='treasure')||(!freeSpin&&context.feature?.guaranteedActivation))&&!initial.flat().some(cell=>cell.token)){
    const candidates=initial.flatMap((col,column)=>col.flatMap((cell,row)=>regular.has(cell.kind)?[position(column,row)]:[]));
    const spot=candidates.length?candidates[draw(context,candidates.length)]:position(draw(context,6),draw(context,5));
    const after=initial.map(col=>[...col]);after[spot.column][spot.row]=newCell(context,'bomb',{value:1,token:true,activation:true,guaranteed:true});initial=after;guaranteedToken=spot;
  }
  let grid=initial,payoutCents=0,legendary=false;
  const frames=[],scatterSeen=new Set();let maxScatterCount=0;
  const rememberScatters=()=>{const cells=grid.flat().filter(cell=>cell.kind==='scatter');maxScatterCount=Math.max(maxScatterCount,cells.length);cells.forEach(cell=>scatterSeen.add(cell.id));};
  rememberScatters();
  for(let cascade=0;;cascade++) {
    const clusters=findLeCipherClusters(grid);
    if(!clusters.length)break;
    if(cascade>=context.maxCascades)throw new MaskSlotLimitError('CASCADE_LIMIT','Cascade safety limit reached; no round may be charged.');
    const rawWins=clusters.map(cluster=>({...cluster,payoutCents:amount(stakeCents,CIPHER_PAYS[cluster.kind][clusterTier(cluster.count)],context.payoutScaleBasisPoints??context.config.payScaleBasisPoints)}));
    const wins=clippedWins(rawWins,ordinaryCapBudget-payoutCents);
    const framePayout=wins.reduce((sum,win)=>sum+win.payoutCents,0);
    payoutCents+=framePayout;
    // Gold follows board coordinates, never cell IDs or falling symbol positions.
    clusters.forEach(cluster=>cluster.cells.forEach(({column,row})=>golden.add(keyOf(column,row))));
    if(payoutCents>=ordinaryCapBudget) {
      frames.push({phase:'clusters',before:grid,after:grid,wins,removed:[],refill:[],goldenCells:positions(golden),payoutCents:framePayout});
      break;
    }
    const before=grid,{after,removed,refill}=fall(context,before,new Set(clusters.map(win=>win.kind)),freeSpin);
    grid=after;rememberScatters();
    frames.push({phase:'cascade',before,after,wins,removed,refill,goldenCells:positions(golden),payoutCents:framePayout});
  }
  const tokens=[];
  grid.forEach((column,c)=>column.forEach((cell,row)=>{if(cell.kind==='bomb'&&cell.token)tokens.push({column:c,row,value:cell.value});}));
  if(payoutCents<ordinaryCapBudget && golden.size && tokens.length) {
    const goldPositions=positions(golden);let repeated=true,fixedPots=[];
    for(let collection=0;repeated&&payoutCents<ordinaryCapBudget;collection++){
      if(collection>=context.maxCollections)throw new MaskSlotLimitError('COLLECTION_LIMIT','Collection safety limit reached; no round may be charged.');
      const before=grid,after=grid.map(column=>[...column]),scale=context.payoutScaleBasisPoints??context.config.payScaleBasisPoints;
      const open=goldPositions.filter(spot=>!fixedPots.some(pot=>pot.column===spot.column&&pot.row===spot.row));
      const rewards=[...fixedPots.map(pot=>({...pot,boost:1})),...open.map(spot=>{
        const type=pick(context,context.config.collectionTypeWeights);
        const values=freeSpin&&bonusTier==='treasure'?context.config.treasureCoinBasePercentWeights:context.config.coinBasePercentWeights;
        return {...spot,type,fresh:true,coinPercent:type==='coin'?pick(context,values):0,
          value:type==='clover'?pick(context,context.config.cloverMultiplierWeights):0,boost:1,rawCents:0n};
      })];
      const legendaryCells=findLeCipherLegendarySquare(rewards);
      if(legendaryCells)legendary=true;
      const clovers=rewards.filter(reward=>reward.type==='clover');
      for(const reward of rewards)if(reward.type!=='clover'){
        reward.boost=clovers.filter(clover=>Math.abs(clover.column-reward.column)+Math.abs(clover.row-reward.row)===1).reduce((factor,clover)=>factor*clover.value,1);
        if(reward.type==='coin')reward.rawCents=BigInt(stakeCents)*BigInt(reward.coinPercent)*BigInt(reward.boost)*BigInt(scale)/1000000n;
      }
      const pots=rewards.filter(reward=>reward.type==='pot').sort((a,b)=>a.row-b.row||a.column-b.column);
      for(const pot of pots)pot.rawCents=(pot.rawCents+rewards.filter(reward=>reward!==pot&&reward.type!=='clover').reduce((sum,reward)=>sum+reward.rawCents,0n))*BigInt(pot.boost);
      const rawWins=[];
      for(const reward of rewards){
        const value=reward.type==='clover'?reward.value:Number(reward.rawCents)/stakeCents;
        const collectionType=reward.type==='clover'?'booster':reward.type==='pot'?'collector':'coin';
        const extra={coin:true,collectionType,value,multiplier:reward.type==='clover'?reward.value:reward.boost,...(reward.type==='clover'?{clover:true}:reward.type==='pot'?{pot:true}:{})};
        after[reward.column][reward.row]=newCell(context,'bomb',extra);
        if(reward.type!=='clover'&&reward.rawCents>0n){
          const exact=reward.rawCents.toString(),safe=reward.rawCents>BigInt(Number.MAX_SAFE_INTEGER)?Number.MAX_SAFE_INTEGER:Number(reward.rawCents);
          rawWins.push({kind:'bomb',cells:[position(reward.column,reward.row)],collectionType,coinValue:value,multiplier:reward.boost,payoutCents:safe,rawPayoutCentsExact:exact});
        }
      }
      if(legendaryCells)rawWins.unshift({kind:'bomb',cells:legendaryCells,collectionType:'legendary',legendary:true,payoutCents:capBudget-payoutCents});
      const priorCount=fixedPots.length;fixedPots=pots.map(pot=>({...pot,fresh:false}));
      repeated=pots.length>priorCount&&pots.length<goldPositions.length;
      const currentBudget=legendaryCells?capBudget:ordinaryCapBudget;
      const capNow=rawWins.reduce((sum,win)=>sum+win.payoutCents,0)>=currentBudget-payoutCents;
      const wins=repeated&&!capNow?[]:clippedWins(rawWins,currentBudget-payoutCents),framePayout=wins.reduce((sum,win)=>sum+win.payoutCents,0);
      payoutCents+=framePayout;grid=after;
      frames.push({phase:'collect',collectionIndex:collection,legendaryCells,before,after,wins,removed:[],refill:[],goldenCells:goldPositions,tokens,
        clovers:clovers.map(({column,row,value})=>({column,row,value})),pots:pots.map(({column,row,boost,rawCents})=>({column,row,multiplier:boost,collectedCentsExact:rawCents.toString()})),repeatCollection:repeated,payoutCents:framePayout});
    }
    const upgradedNow=freeSpin&&bonusTier==='luck'&&maxScatterCount>=4;
    if(!(freeSpin&&(['gold','treasure'].includes(bonusTier)||upgradedNow)))golden.clear();
  }
  if(!frames.length)frames.push({phase:'reveal',before:grid,after:grid,wins:[],removed:[],refill:[],goldenCells:positions(golden),payoutCents:0});
  const scatterCount=maxScatterCount;
  let awardedTier=null,awardedSpins=0;
  if(!freeSpin&&scatterCount>=3){awardedTier=scatterCount>=5?'treasure':scatterCount===4?'gold':'luck';awardedSpins=context.config.bonusTiers[awardedTier].initialFreeSpins;}
  else if(freeSpin){
    if(bonusTier==='luck'&&scatterCount>=4){awardedTier='gold';awardedSpins=4;}
    else if(scatterCount>=3)awardedSpins=4;
    else if(scatterCount===2)awardedSpins=2;
  }
  return {initial,frames,terminal:grid,freeSpin,legendary,bonusTier,awardedTier,payoutCents,awardedSpins,scatterCount,seenScatterCount:scatterSeen.size,guaranteedToken,goldenCells:positions(golden)};
}

// The helper is for deterministic engine/renderer fixtures; its optional grid
// never appears in playMaskSlot(), so the live API has no outcome override.
export function playMaskSpin({game,stakeCents,randomInt,freeSpin=false,mode='paid',bonusTier=game==='lecipher'?'luck':'sticky',initialGrid,
  stickyWilds=[],goldenCells=[],maxCascades=50,maxCollections=20,capCents,featureMode=null}={}) {
  validateStake(stakeCents);
  const context=makeContext(game,randomInt,maxCascades,maxCollections);
  const feature=featureFor(game,mode,featureMode);if(freeSpin&&feature)fail('FEATURE','Features apply only to the charged launch spin.');context.feature=feature;
  if(!['paid','buy'].includes(mode))fail('MODE','Choose a paid spin or a disclosed-price bonus purchase.');
  if(mode==='buy'&&!freeSpin)fail('MODE','Bought-bonus fixtures must be free spins.');
  const purchase=mode==='buy'?context.config.bonusBuys.find(item=>item.id===bonusTier):null;
  if(mode==='buy'&&!purchase)fail('MODE','This bonus tier cannot be bought.');
  context.payoutScaleBasisPoints=feature?.payScaleBasisPoints??scaleForSpin(game,context.config,freeSpin,bonusTier);
  const maximumCap=stakeCents*MASK_SLOT_RULES.winCapMultiplier-MASK_SLOT_RULES.winCapOffsetCents;
  const capBudget=capCents??maximumCap;
  checkedInteger(capBudget,1,maximumCap,'capCents');
  const sticky=new Map(stickyWilds.map(({column,row,value=2})=>{
    checkedInteger(column,1,3,'sticky column');checkedInteger(row,0,2,'sticky row');
    if(![2,3].includes(value))fail('GRID','Bad sticky wild value.');
    return [keyOf(column,row),newCell(context,'wild',{value})];
  }));
  const golden=new Set(goldenCells.map(({column,row})=>{
    checkedInteger(column,0,5,'golden column');checkedInteger(row,0,4,'golden row');return keyOf(column,row);
  }));
  const ordinaryCapBudget=Math.min(capBudget,stakeCents*context.config.ordinaryRoundCapMultiplier,freeSpin?Math.floor(stakeCents*(context.config.ordinaryFreeSpinCapPercentByTier?.[bonusTier]??context.config.ordinaryFreeSpinCapPercent)/100):Infinity);
  const spin=game==='maskhouse'?houseSpin(context,stakeCents,{freeSpin,capBudget,ordinaryCapBudget,initialGrid,stickyWilds:sticky}):cipherSpin(context,stakeCents,{freeSpin,capBudget,ordinaryCapBudget,initialGrid,golden,bonusTier:freeSpin?bonusTier:null});
  return freeze({...spin,game,mode,featureMode,stakeCents,payoutScaleBasisPoints:context.payoutScaleBasisPoints,ordinaryCapCents:ordinaryCapBudget,capCents:capBudget,capReached:spin.payoutCents===capBudget});
}

export function playMaskSlot({game,stakeCents,mode='paid',bonusTier=game==='lecipher'?'luck':'sticky',randomInt,maxSpins=200,maxCascades=50,maxCollections=20,featureMode=null}={}) {
  validateStake(stakeCents);const config=configFor(game),feature=featureFor(game,mode,featureMode);
  if(!['paid','buy'].includes(mode))fail('MODE','Choose a paid spin or a disclosed-price bonus purchase.');
  checkedInteger(maxSpins,1,200,'maxSpins');
  const context=makeContext(game,randomInt,maxCascades,maxCollections),capCents=stakeCents*MASK_SLOT_RULES.winCapMultiplier-MASK_SLOT_RULES.winCapOffsetCents;
  const purchase=mode==='buy'?config.bonusBuys.find(item=>item.id===bonusTier):null;
  if(mode==='buy'&&!purchase)fail('MODE','This bonus tier cannot be bought.');
  const ordinaryCapCents=stakeCents*config.ordinaryRoundCapMultiplier;
  const initialPayoutScaleBasisPoints=feature?.payScaleBasisPoints??scaleForSpin(game,config,mode==='buy',bonusTier);
  const spins=[],stickyWilds=new Map(),golden=new Set();
  const bonusBought=mode==='buy',chargeCents=stakeCents*(bonusBought?purchase.multiplier:(feature?.multiplier??1));
  let bonusSelection=bonusBought&&game==='maskhouse'?Array.from({length:9},()=>pick(context,config.bonusSelection.values)):[];
  const initialFreeSpins=bonusBought?(game==='maskhouse'?bonusSelection.reduce((sum,value)=>sum+value,0):purchase.initialFreeSpins):0;
  let activeTier=bonusBought?purchase.id:null,pendingFree=initialFreeSpins,payoutCents=0,freeSpinsPlayed=0,freeSpinsAwarded=pendingFree;
  do {
    if(spins.length>=maxSpins)throw new MaskSlotLimitError('SPIN_LIMIT','Spin safety limit reached; no round may be charged.');
    const freeSpin=bonusBought||spins.length>0;
    if(freeSpin){pendingFree--;freeSpinsPlayed++;}
    context.feature=freeSpin?null:feature;context.payoutScaleBasisPoints=(!freeSpin?feature?.payScaleBasisPoints:null)??scaleForSpin(game,config,freeSpin,activeTier);
    const options={freeSpin,capBudget:capCents-payoutCents,ordinaryCapBudget:Math.min(Math.max(0,ordinaryCapCents-payoutCents),freeSpin?Math.floor(stakeCents*(config.ordinaryFreeSpinCapPercentByTier?.[activeTier]??config.ordinaryFreeSpinCapPercent)/100):Infinity),stickyWilds,golden,bonusTier:activeTier,allowLegendary:game!=='maskhouse'||payoutCents<ordinaryCapCents};
    const spin=game==='maskhouse'?houseSpin(context,stakeCents,options):cipherSpin(context,stakeCents,options);
    payoutCents+=spin.payoutCents;pendingFree+=spin.awardedSpins;freeSpinsAwarded+=spin.awardedSpins;
    if(spin.awardedTier)activeTier=spin.awardedTier;
    if(spin.bonusSelection?.length)bonusSelection=spin.bonusSelection;
    spins.push({...spin,payoutScaleBasisPoints:context.payoutScaleBasisPoints,index:spins.length,chargeCents:spins.length===0?chargeCents:0,
      freeSpinsRemaining:pendingFree,totalPayoutCents:payoutCents,capReached:payoutCents===capCents});
    // House plays every awarded spin. Once its ordinary budget is exhausted,
    // later boards cannot add a legendary payout that the legacy engine never sampled.
    if(payoutCents>=capCents||(game!=='maskhouse'&&payoutCents>=ordinaryCapCents))break;
  } while(pendingFree>0);
  const hasBonus=bonusBought||freeSpinsAwarded>0;
  const equivalentPurchaseMultiplier=game==='maskhouse'?config.bonusBuyMultiplier:(purchase?.multiplier??config.bonusMinimumEquivalentPurchaseMultipliers[activeTier]??20);
  const bonusMinimumCents=hasBonus?Math.floor(stakeCents*equivalentPurchaseMultiplier*MASK_SLOT_RULES.bonusMinimumReturnBasisPoints/10000):0;
  const bonusPaymentCents=Math.max(0,bonusMinimumCents-payoutCents);
  if(bonusPaymentCents) {
    const last=spins[spins.length-1],grid=last.terminal;
    last.frames.push({phase:'bonus-payment',before:grid,after:grid,wins:[{kind:'bonus-payment',cells:[],bonusPayment:true,payoutCents:bonusPaymentCents}],removed:[],refill:[],goldenCells:last.goldenCells,payoutCents:bonusPaymentCents});
    last.payoutCents+=bonusPaymentCents;payoutCents+=bonusPaymentCents;last.totalPayoutCents=payoutCents;
  }
  return freeze({game,mode,featureMode,featureChargeMultiplier:feature?.multiplier??1,bonusBought,bonusTier:activeTier,bonusPurchaseTier:purchase?.id??null,bonusSelection,payoutScaleBasisPoints:initialPayoutScaleBasisPoints,initialFreeSpins,rulesVersion:MASK_SLOT_RULES.version,stakeCents,chargeCents,
    payoutCents,capCents,ordinaryCapCents,ordinaryCapReached:payoutCents>=ordinaryCapCents,legendary:spins.some(spin=>spin.legendary),bonusMinimumCents,bonusPaymentCents,spins,capReached:payoutCents===capCents,freeSpinsPlayed,freeSpinsAwarded,
    unplayedFreeSpins:pendingFree,ledger:{chargeCents,creditCents:payoutCents},
    notice:MASK_SLOT_RULES.notice});
}

export default playMaskSlot;
