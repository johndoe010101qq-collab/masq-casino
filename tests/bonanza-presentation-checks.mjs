// v9: base10 bought bonus costs500AR; cancellation never debits, confirmation debits500once.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BONANZA_SYMBOLS, BONANZA_DEMO_RULES} from '../src/bonanza.js';
import {HallSession} from '../src/hall-session.js';
import {BONANZA_PACE, buildBonanzaTimeline, createBonanzaPlayback, createBonusPurchaseController} from '../src/BonanzaPresentation.js';
import {layoutBonanzaPayouts} from '../src/slotCellPresentation.js';

let checks = 0;
const eq = (actual, expected) => {checks++; assert.equal(actual, expected);};
const ok = value => {checks++; assert.ok(value);};
const deep = (actual, expected) => {checks++; assert.deepEqual(actual, expected);};
const throws = (run, pattern) => {checks++; assert.throws(run, pattern);};

const cells = Array.from({length:30}, (_, index) => ({id:index + 1, column:Math.floor(index / 5), row:index % 5}));
const grid = cells.reduce((board, cell, index) => {
  board[cell.column][cell.row] = {...cell, kind:index < 8 ? 'hood' : index < 16 ? 'usb' : 'key'};
  return board;
}, Array.from({length:6}, () => []));
const wins = [{kind:'hood', count:8, cells:cells.slice(0,8), payoutCents:5000},
  {kind:'usb', count:8, cells:cells.slice(8,16), payoutCents:4000}];
const afterRemoval = grid.map(column => column.map(cell => cell.id <= 16 ? null : cell));
const after = grid.map(column => column.map(cell => ({...cell, id:cell.id + 30, kind:'lock'})));
const frame = {before:grid, afterRemoval, after, wins, removed:cells.slice(0,16), refill:[],
  payoutCents:9000, cumulativeSymbolWinCents:9000, multiplier:{factor:1}};
const terminalFrame = {before:after, after, wins:[], removed:[], refill:[], payoutCents:0,
  cumulativeSymbolWinCents:9000, multiplier:{factor:1}};
const spin = {frames:[frame, terminalFrame], payoutCents:9000, symbolWinCents:9000,
  scatterWinCents:0, multiplier:1, awardedSpins:0, isFreeSpin:false};
const round = {id:1, chargeCents:1000, payoutCents:9000, winCapCents:2500000, spins:[spin]};

const timeline = buildBonanzaTimeline(round);
deep(timeline.steps.map(step => step.visual.phase), ['deal','win','remove','payout','payout-out','fall','spin-summary']);
const groups = timeline.steps.find(step => step.visual.phase === 'payout').visual;
deep(groups.payoutGroups.map(group => group.payoutCents), wins.map(win => win.payoutCents));
eq(groups.grid, afterRemoval);
eq(groups.grid.flat().filter(Boolean).length, 14);
eq(new Set(groups.payoutGroups.flatMap(group => group.cells.map(cell => cell.id))).size, 16);
eq(timeline.terminal.totalPayoutCents, round.payoutCents);
eq(timeline.terminal.spinSummary.payoutCents, spin.payoutCents);
eq(timeline.terminal.payoutGroups.length, 0);

// Spatially mixed groups always retain their engine amounts and get disjoint
// labels within the board, each anchored in one of its own removed cells.
let seed = 5173;
for (let trial = 0; trial < 2500; trial++) {
  const shuffled = cells.slice();
  for (let index = shuffled.length - 1; index > 0; index--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const swap = seed % (index + 1);
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  const source = ['hood','usb','key'].map((kind, index) => ({kind, count:8,
    cells:shuffled.slice(index * 8, index * 8 + 8), payoutCents:1234 + index}));
  const labels = layoutBonanzaPayouts(source);
  for (let index = 0; index < labels.length; index++) {
    const label = labels[index];
    eq(label.payoutCents, source[index].payoutCents);
    ok(label.cells.some(cell => cell.id === label.anchorId));
    ok(label.x - label.width / 2 >= 0 && label.x + label.width / 2 <= 100);
    ok(label.y - label.height / 2 >= 0 && label.y + label.height / 2 <= 100);
    for (const other of labels.slice(0,index)) ok(Math.abs(other.x - label.x) >= label.width
      || Math.abs(other.y - label.y) >= label.height);
  }
}

const bonusSpin = {...spin, isFreeSpin:true, multiplier:8, payoutCents:25000, capped:true,
  uncappedPayoutCents:'72000', frames:[{...frame, multiplier:{factor:8}}, terminalFrame]};
const capped = buildBonanzaTimeline({...round, bonusBought:true, chargeCents:100000,
  payoutCents:25000, capped:true, spins:[bonusSpin]});
eq(capped.steps[0].visual.bonusAnnouncement.costCents, 100000);
eq(capped.terminal.totalPayoutCents, 25000);
eq(capped.terminal.bonusPayoutCents, 25000);
eq(capped.terminal.spinSummary.symbolWinCents, 9000);
eq(capped.terminal.spinSummary.multiplier, 8);
eq(capped.terminal.spinSummary.payoutCents, 25000);
eq(capped.terminal.spinSummary.capped, true);
eq(capped.steps.at(-1).visual.phase, 'bonus-summary');

let draws = 0, symbolIndex = 0;
const randomInt = maximum => {
  draws++;
  const kind = BONANZA_SYMBOLS[symbolIndex++ % BONANZA_SYMBOLS.length];
  let offset = 0;
  for (const [symbol, weight] of BONANZA_DEMO_RULES.freeWeights) {
    if (symbol === kind) {assert.ok(offset < maximum); return offset;}
    offset += weight;
  }
  throw new Error('Missing fixture symbol');
};
const session = new HallSession(undefined, randomInt);
const purchase = createBonusPurchaseController(session);
const opening = session.getSnapshot();
const cancelled = purchase.open(10);
eq(cancelled.cost, 500);
eq(cancelled.freeSpins, 10);
ok(Object.isFrozen(cancelled));
eq(session.getSnapshot(), opening);
eq(draws, 0);
eq(purchase.cancel(cancelled.id), true);
eq(purchase.confirm(cancelled.id), null);
eq(draws, 0);
const lowWallet = new HallSession(undefined, randomInt, {initialBalanceCents:9900});
const lowPurchase = createBonusPurchaseController(lowWallet);
const selected = lowPurchase.open(10);
eq(lowPurchase.open(100), null);
throws(() => lowPurchase.confirm(selected.id), /500|50×/);
eq(lowWallet.getSnapshot().balance, 99);
eq(draws, 0);
eq(lowPurchase.confirm(selected.id), null);
const approved = purchase.open(10);
const bought = purchase.confirm(approved.id);
eq(bought.stake, 10);
eq(bought.chargeCents, 50000);
eq(session.getSnapshot().balance, 500);
eq(purchase.confirm(approved.id), null);
eq(session.complete(bought.id), true);
eq(session.complete(bought.id), false);
const busyIntent = purchase.open(10);
// Another accepted round consumes the wallet lock after purchase review.
const competing = session.begin('slots', 'bonanza', 5);
const priorDraws = draws;
throws(() => purchase.confirm(busyIntent.id), /завершения/);
eq(draws, priorDraws);
eq(purchase.current, null);
eq(session.complete(competing.id), true);
throws(() => purchase.open(110), /5 до 100/);

function fakeEnvironment() {
  let time = 0, serial = 0;
  const timers = new Map(), listeners = new Set();
  const visibility = {hidden:false,
    addEventListener:(_type, listener) => listeners.add(listener),
    removeEventListener:(_type, listener) => listeners.delete(listener)};
  const clock = {now:() => time, set:(fn, ms) => {
    const id = ++serial; timers.set(id, {fn, at:time + ms}); return id;
  }, clear:id => timers.delete(id)};
  return {clock, visibility, timers, listeners,
    hide(value) {visibility.hidden = value; for (const listener of listeners) listener();},
    async advance(ms) {
      const end = time + ms;
      for (;;) {
        const next = [...timers].sort((a,b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        time = next[1].at; timers.delete(next[0]); next[1].fn();
        await Promise.resolve(); await Promise.resolve();
      }
      time = end;
    }};
}
{
  const env = fakeEnvironment();
  let visual, settled = 0;
  const playback = createBonanzaPlayback(round, {...env,
    onVisual:next => {visual = next;}, onFinish:result => {settled++; eq(result, round);}});
  const run = playback.start();
  eq(visual.phase, 'deal');
  await env.advance(400);
  env.hide(true);
  eq(env.timers.size, 0);
  await env.advance(100000);
  eq(visual.phase, 'deal');
  eq(settled, 0);
  env.hide(false);
  await env.advance(BONANZA_PACE.deal - 401);
  eq(visual.phase, 'deal');
  await env.advance(1);
  eq(visual.phase, 'win');
  eq(playback.skip(), true);
  eq(playback.skip(), false);
  eq(playback.dispose(), false);
  eq(settled, 1);
  eq(visual.totalPayoutCents, round.payoutCents);
  eq(env.timers.size, 0);
  eq(env.listeners.size, 0);
  await run;
}
for (const mode of ['natural','reduced','unmount']) {
  const env = fakeEnvironment();
  let settled = 0, visual;
  const playback = createBonanzaPlayback(round, {...env,
    onVisual:next => {visual = next;}, onFinish:() => {settled++;}});
  const run = playback.start({reducedMotion:mode === 'reduced'});
  if (mode === 'unmount') playback.dispose();
  else if (mode === 'natural') await env.advance(10000);
  await run;
  eq(settled, 1);
  eq(env.timers.size, 0);
  eq(env.listeners.size, 0);
  eq(playback.closed, true);
  if (mode !== 'unmount') eq(visual.totalPayoutCents, round.payoutCents);
}
{
  const env = fakeEnvironment();
  let settled = 0;
  const failure = new Error('render failure');
  const playback = createBonanzaPlayback(round, {...env,
    onVisual:() => {throw failure;}, onFinish:() => {settled++;}});
  await assert.rejects(playback.start(), /render failure/); checks++;
  eq(settled, 1);
  eq(env.timers.size, 0);
}

const totalCascade = BONANZA_PACE.win + BONANZA_PACE.remove + BONANZA_PACE.payout
  + BONANZA_PACE.payoutOut + BONANZA_PACE.fall;
ok(totalCascade >= 2500 && totalCascade <= 3200,'Winning groups remain readable before removal and refill.');
ok(BONANZA_PACE.win >= 600);
ok(BONANZA_PACE.deal <= 1800 * .85 && BONANZA_PACE.deal >= 1800 * .80);
const css = await readFile(new URL('../src/BonanzaPace.css', import.meta.url), 'utf8');
ok(css.includes('indictus-slot-deal calc(920ms / var(--slot-speed,1))'));
ok(920 + 5 * 90 + 4 * 12 <= BONANZA_PACE.deal);
ok(600 + 5 * 22 <= BONANZA_PACE.fall);
ok(180 <= BONANZA_PACE.remove);
console.log(JSON.stringify({status:'Bonanza presentation, purchase and lifecycle checks passed', checks,
  layoutFixtures:2500, dealMs:BONANZA_PACE.deal, cascadeMs:totalCascade}));
