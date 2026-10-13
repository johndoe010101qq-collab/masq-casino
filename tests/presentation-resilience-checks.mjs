// Read-only audit draft. Copy into indictus-site/tests unchanged if accepted.
// Uses current production modules; money assertions are independent ledger equations.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const rootSite = new URL('indictus-site/', import.meta.url);
const site = existsSync(new URL('src/RoundPlayback.js', rootSite)) ? rootSite : new URL('../', import.meta.url);
const { GameAudio } = await import(new URL('src/audio/GameAudio.js', site));
const { createRoundPlayback } = await import(new URL('src/RoundPlayback.js', site));
const { HallSession } = await import(new URL('src/hall-session.js', site));
const { default: GameMath } = await import(new URL('src/game-math.js', site));
let checks = 0;
const eq = (actual, expected, message) => { checks++; assert.deepEqual(actual, expected, message); };
const ok = (value, message) => { checks++; assert.ok(value, message); };

class ProbeAudio extends GameAudio {
  score = []; musicStarts = 0; closeCount = 0;
  createContext() {
    if (this.context) return this.context;
    this.context = { state: 'running', currentTime: 0,
      resume: async () => { this.context.state = 'running'; },
      suspend: async () => { this.context.state = 'suspended'; },
      close: async () => { this.closeCount++; } };
    return this.context;
  }
  updateGains() {}
  startMusic() { this.musicStarts++; }
  stopMusic() { this.musicTimer = null; }
  loop(...args) { if (this.canPlay()) this.score.push({ method: 'loop', name: args[0] }); }
  tone(...args) { this.score.push({ method: 'tone', frequency: args[0], ...args[3] }); }
  noise(...args) { this.score.push({ method: 'noise', ...args[4] }); }
  impact(...args) { this.score.push({ method: 'impact', tag: args[2] }); }
  mechanicalTick(...args) { this.score.push({ method: 'tick', tag: args[3] }); }
  bell(...args) { this.score.push({ method: 'bell', tag: args[3] }); }
}
function delayedAudio() {
  const audio = new ProbeAudio(); audio.createContext();
  audio.context.state = 'suspended';
  audio.setPreferences({ sfx: true, music: false });
  let resolve;
  audio.unlockPromise = new Promise(done => { resolve = done; });
  return { audio, async unlock() {
    if (audio.context) audio.context.state = 'running';
    resolve(true); await Promise.resolve(); await Promise.resolve();
  } };
}
for (const cue of ['payout', 'celebrate', 'resolve', 'receipt', 'loss']) {
  const { audio, unlock } = delayedAudio();
  audio.play(cue, { positive: true });
  audio.stopPayout(); await unlock();
  eq(audio.score, [], `${cue}: result close invalidates deferred unlock cue`);
  audio.dispose();
}
for (const cue of ['cascade', 'scatter', 'bonus', 'fall', 'multiplier']) {
  const { audio, unlock } = delayedAudio();
  audio.play(cue); audio.endRound(); await unlock();
  eq(audio.score, [], `${cue}: skip invalidates deferred round cue`);
  audio.dispose();
}
for (const cue of ['celebrate', 'cascade']) {
  const { audio, unlock } = delayedAudio();
  audio.play(cue); audio.dispose(); await unlock();
  eq(audio.score, [], `${cue}: unmount suppresses deferred sources`);
  eq(audio.closeCount, 1);
}
{
  const { audio, unlock } = delayedAudio();
  audio.beginRound('maskhouse'); audio.endRound(); await unlock();
  eq(audio.score, [], 'Skipped reel cannot start after delayed unlock'); audio.dispose();
}
{
  const { audio, unlock } = delayedAudio();
  audio.play('celebrate'); await unlock();
  eq(audio.score.filter(note => note.to === 1568 || note.to === 2093).length, 2,
    'A current pending result still gets both whistle notes'); audio.dispose();
}
{
  const { audio, unlock } = delayedAudio();
  audio.play('celebrate'); audio.setPreferences({ sfx: false, music: false }); await unlock();
  eq(audio.score, [], 'Muting while unlock is pending suppresses the fanfare'); audio.dispose();
}
{
  const { audio, unlock } = delayedAudio();
  audio.finishCountup({ positive: true }); audio.stopPayout(); await unlock();
  eq(audio.score, [], 'Closing countup suppresses a pending resolve chord'); audio.dispose();
}

function frameClock() {
  let id = 0; const pending = new Map();
  return { pending,
    request: callback => { const next = ++id; pending.set(next, callback); return next; },
    cancel: key => pending.delete(key),
    fire(now) { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(now)); } };
}
function randomCounter(seed = 1729) {
  let state = seed >>> 0, draws = 0;
  return { randomInt(maximum) {
    draws++; state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) % maximum;
  }, get draws() { return draws; } };
}
const profiles = [
  ['coinflip', 'heads'], ['dice', 1], ['plinko', 'standard'],
  ['roulette', 'red'], ['upgrader', 2], ['slots', 'bonanza'],
  ['maskhouse', 'maskhouse'], ['lecipher', 'lecipher'],
  ['slots', 'bonanza', 'buy'], ['maskhouse', 'maskhouse', 'buy', 'sticky'],
  ['lecipher', 'lecipher', 'buy', 'luck'], ['lecipher', 'lecipher', 'buy', 'gold'],
];
let scenarios = 0;
for (const [game, choice, mode = 'paid', bonusTier] of profiles) {
  for (const action of ['visual-throw', 'error-callback-throw', 'skip', 'reduced', 'finish-inside-progress']) {
    const rng = randomCounter(1729 + scenarios++), initialWallet = 2000000, initialBank = 5000000;
    const session = new HallSession(GameMath, maximum => rng.randomInt(maximum),
      { initialBalanceCents: initialWallet, houseCapitalCents: initialBank });
    const round = session.begin(game, choice, 5, { mode, bonusTier });
    const drawsAtStart = rng.draws, clock = frameClock();
    let completions = 0, errors = 0, accepted = 0, shown = null, runner;
    runner = createRoundPlayback({ duration: 1000, requestFrame: clock.request, cancelFrame: clock.cancel,
      isHidden: () => false,
      onProgress() {
        if (action === 'visual-throw' || action === 'error-callback-throw') throw new Error('render failed');
        if (action === 'finish-inside-progress') runner.finish();
      },
      onError() { errors++; if (action === 'error-callback-throw') throw new Error('error banner failed'); },
      onComplete(show) { completions++; shown = show; accepted += Number(session.complete(round.id)); },
    });
    if (action === 'reduced') runner.finish();
    else {
      runner.start();
      if (action === 'skip') runner.finish(false);
      else if (action === 'error-callback-throw') { checks++; assert.throws(() => clock.fire(0), /error banner failed/); }
      else clock.fire(0);
    }
    eq(completions, 1, `${game}/${mode}/${action}: completes once`);
    eq(accepted, 1);
    eq(shown, !['visual-throw', 'error-callback-throw', 'skip'].includes(action));
    eq(errors, ['visual-throw', 'error-callback-throw'].includes(action) ? 1 : 0);
    eq(clock.pending.size, 0, 'Terminal callback cannot resurrect RAF');
    eq(session.getSnapshot().busy, false);
    eq(session.getReserveSnapshot().reservedCents, 0);
    eq(session.balanceCents, initialWallet - round.chargeCents + round.payoutCents);
    eq(session.getReserveSnapshot().bankCents, initialBank + round.chargeCents - round.payoutCents);
    eq(rng.draws, drawsAtStart, 'Presentation recovery cannot reroll RNG');
    eq(runner.finish(false), false); eq(session.complete(round.id), false);
    eq(completions, 1); eq(accepted, 1);
    eq(session.balanceCents, initialWallet - round.chargeCents + round.payoutCents);
  }
}

// Execute the actual PayoutScene mount effect with a tiny DOM/hooks harness.
// The harness records effects only; it makes no claims about browser layout.
const previousGlobals = Object.fromEntries(['document', 'HTMLElement', 'requestAnimationFrame',
  'cancelAnimationFrame', 'matchMedia', '__v10AuditHooks'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
let effectQueue = [], nodes = [], rafs = new Map(), nextRaf = 0;
class FixtureElement {
  constructor(type = 'button') { this.type = type; this.open = false; this.isConnected = true; this.listeners = new Map(); }
  showModal() { this.open = true; } close() { this.open = false; }
  setAttribute(name) { if (name === 'open') this.open = true; }
  focus() { document.activeElement = this; }
  matches() { return false; }
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  removeEventListener(type) { this.listeners.delete(type); }
  querySelectorAll() { return nodes.filter(node => node.type === 'button'); }
}
try {
  globalThis.HTMLElement = FixtureElement;
  globalThis.document = { hidden: false, activeElement: new FixtureElement(), addEventListener() {}, removeEventListener() {} };
  globalThis.matchMedia = undefined;
  globalThis.requestAnimationFrame = callback => { const id = ++nextRaf; rafs.set(id, callback); return id; };
  globalThis.cancelAnimationFrame = id => rafs.delete(id);
  const React = { createElement(type, props, ...children) {
    if (typeof type === 'string') {
      const node = new FixtureElement(type); node.props = props; nodes.push(node);
      if (props?.ref) props.ref.current = node;
    }
    return { type, props: { ...props, children } };
  } };
  globalThis.__v10AuditHooks = { React, Component: class {}, Suspense: 'suspense', lazy: () => () => null,
    useCallback: fn => fn, useMemo: fn => fn(), useRef: current => ({ current }),
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: callback => effectQueue.push(callback), };
  const { transformWithOxc } = await import(new URL('node_modules/vite/dist/node/index.js', site));
  // data: modules cannot resolve a relative JSX import. Compile the actual
  // identity component with the same fixture React, rather than mocking or
  // removing the production dependency.
  const identitySource = readFileSync(new URL('src/MasqIdentity.jsx', site), 'utf8')
    .replace(/import React from ['"]react['"];?/,
      'const { React } = globalThis.__v10AuditHooks;')
    .replaceAll('import.meta.env.BASE_URL', '"/"');
  const identityCode = (await transformWithOxc(identitySource, 'MasqIdentity.jsx', { jsx: { runtime: 'classic' } })).code;
  const identityModule = 'data:text/javascript;base64,' + Buffer.from(identityCode).toString('base64');
  const { MasqMark } = await import(identityModule);
  const actualMark = MasqMark({ flat: true });
  eq(actualMark.type, 'span', 'Real identity JSX runs through the fixture React');
  eq(actualMark.props.className, 'masq-mark masq-mark-flat');
  eq(actualMark.props.children.length, 3, 'Real identity retains all three cube faces');
  const payoutSource = readFileSync(new URL('src/PayoutScene.jsx', site), 'utf8');
  const payoutModule = payoutSource
    .replace(/import React,[\s\S]*?from "react";/,
      'const { React, Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } = globalThis.__v10AuditHooks;')
    .replace(/^import "[^"\n]+\.css";\s*/gm, '')
    .replace(/from ['"]\.\/MasqIdentity\.jsx['"]/g, 'from ' + JSON.stringify(identityModule))
    .replaceAll('import.meta.env.BASE_URL', '"/"');
  const transformed = (await transformWithOxc(payoutModule, 'PayoutScene.jsx', { jsx: { runtime: 'classic' } })).code;
  const { default: PayoutScene, describeRound } = await import('data:text/javascript;base64,' + Buffer.from(transformed).toString('base64'));
  for (const sfx of [true, false]) for (const reducedMotion of [false, true]) {
    effectQueue = []; nodes = []; rafs = new Map();
    const audio = new ProbeAudio(); audio.createContext(); audio.setPreferences({ music: false, sfx });
    const round = { id: 1, game: 'lecipher', mode: 'paid', stakeCents: 500, chargeCents: 500, payoutCents: 100 };
    const facts = describeRound(round);
    eq(facts.payoutCents, 100); eq(facts.netCents, -400);
    eq(facts.celebrated, true); eq(facts.fxTier, 1);
    PayoutScene({ round, audio, reducedMotion, onClose() {} });
    const cleanups = effectQueue.map(callback => callback()).filter(callback => typeof callback === 'function');
    eq(audio.score.filter(note => note.to === 1568 || note.to === 2093).length, sfx ? 2 : 0,
      `Actual 1 AR result mount: sfx=${sfx}, reduced=${reducedMotion}`);
    eq(audio.score.some(note => note.method === 'loop' && note.name === 'count'), sfx && !reducedMotion);
    cleanups.forEach(cleanup => cleanup());
    eq(rafs.size, 0); eq(audio.payoutGeneration, 1);
    audio.dispose();
  }
  {
    effectQueue = []; nodes = []; rafs = new Map();
    const { audio, unlock } = delayedAudio(); let closes = 0;
    PayoutScene({ round: { id: 2, game: 'lecipher', mode: 'paid', stakeCents: 500,
      chargeCents: 500, payoutCents: 100 }, audio, onClose() { closes++; } });
    const cleanups = effectQueue.map(callback => callback()).filter(callback => typeof callback === 'function');
    const closeButton = nodes.find(node => node.props?.['aria-label'] === 'Закрыть результат');
    ok(closeButton, 'Actual payout close button is wired');
    closeButton.props.onClick(); closeButton.props.onClick();
    eq(closes, 1, 'Double click closes result once');
    cleanups.forEach(cleanup => cleanup()); await unlock();
    eq(audio.score, [], 'Actual result close + effect cleanup cancels delayed 1 AR fanfare');
    eq(rafs.size, 0); audio.dispose();
  }
  eq(describeRound({ preview: true, chargeCents: 500, payoutCents: 100 }).celebrated, false);
  eq(describeRound({ chargeCents: 500, payoutCents: 0 }).celebrated, false);
  ok(nodes.length > 0, 'Actual JSX created modal controls in the harness');
} finally {
  for (const [key, descriptor] of Object.entries(previousGlobals)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
}
const hashes = Object.fromEntries(['src/RoundPlayback.js', 'src/audio/GameAudio.js', 'src/hall-session.js', 'src/PayoutScene.jsx', 'src/MasqIdentity.jsx']
  .map(name => [name, createHash('sha256').update(readFileSync(new URL(name, site))).digest('hex')]));
console.log(JSON.stringify({ passed: true, checks, fundedRoundLifecycleScenarios: scenarios,
  scope: 'Delayed unlock cancellation; real Hall once-only settlement after presentation errors/skip/reduced; actual tiny payout mount cue and mute', sourceSHA256: hashes }, null, 2));
