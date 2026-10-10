import { MAX_PLINKO_ACTIVE } from './hall-session.js';

export const PLINKO_DURATION_MS = 3800;
export const PLINKO_LANDING_MS = 950;

// One presentation clock for the entire board. Outcomes stay private until the
// corresponding flight has actually reached the bin in this clock.
export class PlinkoFlightController {
  constructor(session, { requestFrame = callback => requestAnimationFrame(callback),
    cancelFrame = id => cancelAnimationFrame(id), onLand = () => {},
    onSound = () => {}, onChange = () => {}, durationMs = PLINKO_DURATION_MS } = {}) {
    this.session = session;
    this.requestFrame = requestFrame;
    this.cancelFrame = cancelFrame;
    this.onLand = onLand;
    this.onSound = onSound;
    this.onChange = onChange;
    this.durationMs = durationMs;
    this.flights = new Map();
    this.effects = [];
    this.clockMs = 0;
    this.previous = null;
    this.raf = null;
    this.visible = true;
    this.attached = false;
    this.renderer = null;
    this.lastSound = -Infinity;
    this.tick = now => {
      this.raf = null;
      if (!this.attached || !this.visible) { this.previous = null; return; }
      this.advance(now);
      this.schedule();
    };
  }
  attach() { this.attached = true; this.previous = null; this.schedule(); }
  detach() {
    this.attached = false;
    this.cancel();
    this.finishAll(false);
    this.effects = [];
    // The Canvas is a separate Fiber root. A parent StrictMode effect replay
    // must not remove its render callback; the scene owns callback cleanup.
  }
  cancel() {
    if (this.raf !== null) this.cancelFrame(this.raf);
    this.raf = null;
    this.previous = null;
  }
  schedule() {
    if (this.attached && this.visible && this.raf === null &&
        (this.flights.size || this.effects.length)) this.raf = this.requestFrame(this.tick);
  }
  setVisible(visible) {
    this.visible = Boolean(visible);
    this.cancel();
    if (this.visible) this.schedule();
  }
  setRenderer(renderer) {
    this.renderer = renderer;
    if (renderer) renderer(this.clockMs);
    this.schedule();
  }
  sound(cue, options) {
    // A chord/bounce per frame group avoids 100 simultaneous audio schedules.
    if (this.clockMs - this.lastSound < 80) return;
    this.lastSound = this.clockMs;
    this.onSound(cue, options);
  }
  launch(stake) {
    if (!this.attached) return null;
    const round = this.session.begin('plinko', 'standard', stake);
    if (!round) return null;
    this.flights.set(round.id, { round, startedAt: this.clockMs, progress: 0, row: -1 });
    this.sound('ui');
    this.onChange();
    this.schedule();
    return round.id;
  }
  getPresentation() {
    return Array.from(this.flights.values(), ({ round, progress }) =>
      Object.freeze({ id: round.id, stake: round.stake, path: round.path, progress }));
  }
  getEffects() {
    return this.effects.map(effect => ({ ...effect,
      progress: Math.min(1, (this.clockMs - effect.at) / PLINKO_LANDING_MS) }));
  }
  land(flight, show = true) {
    const { round } = flight;
    if (!this.flights.delete(round.id)) return false;
    if (!this.session.complete(round.id)) return false;
    if (show) {
      this.effects.push({ id: round.id, bin: round.bin, won: round.netCents > 0, at: this.clockMs });
      this.effects = this.effects.slice(-20);
      const completed = this.session.getSnapshot().result;
      this.onLand(completed);
      this.sound(round.netCents > 0 ? 'resolve' : 'receipt', { positive: round.netCents > 0 });
    }
    return true;
  }
  advance(now) {
    if (!this.visible) { this.previous = null; return; }
    if (this.previous !== null) this.clockMs += Math.max(0, now - this.previous);
    this.previous = now;
    let changed = false, bounce = false;
    for (const flight of [...this.flights.values()]) {
      flight.progress = Math.min(1, (this.clockMs - flight.startedAt) / this.durationMs);
      const row = Math.min(8, Math.floor(flight.progress * 9));
      if (row > flight.row) { bounce = true; flight.row = row; }
      if (flight.progress === 1) changed = this.land(flight) || changed;
    }
    const oldLength = this.effects.length;
    this.effects = this.effects.filter(effect => this.clockMs - effect.at < PLINKO_LANDING_MS);
    changed = changed || oldLength !== this.effects.length;
    if (bounce && !changed) this.sound('pin');
    this.renderer?.(this.clockMs);
    if (changed) this.onChange();
  }
  finishAll(show = true) {
    let count = 0;
    for (const flight of [...this.flights.values()]) if (this.land(flight, show)) count++;
    if (count && show) { this.renderer?.(this.clockMs); this.onChange(); }
    this.schedule();
    return count;
  }
  get activeCount() { return this.flights.size; }
  get full() { return this.flights.size >= MAX_PLINKO_ACTIVE; }
}
