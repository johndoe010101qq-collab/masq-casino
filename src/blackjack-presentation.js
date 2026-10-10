import { blackjackPublicView, hitBlackjack, standBlackjack, revealBlackjack,
  dealerStepBlackjack, finishBlackjack } from './blackjack.js';

// A single explicit clock drives all cards. Browser RAF and money are injected
// by the room; this class has no timers and is tested without a browser.
export class BlackjackPresentation {
  constructor(hand, { onUpdate = () => {}, onResolved = () => {}, onCard = () => {}, transition, publicView = blackjackPublicView } = {}) {
    this.transition = transition || ((action, current) => ({ hit: hitBlackjack,
      stand: standBlackjack, reveal: revealBlackjack, dealer: dealerStepBlackjack,
      finish: finishBlackjack })[action](current));
    this.publicView = publicView;
    this.hand = hand; this.onUpdate = onUpdate; this.onResolved = onResolved; this.onCard = onCard;
    this.playerShown = 0; this.dealerShown = 0; this.shownReveal = false;
    this.status = 'dealing'; this.motion = null; this.step = null; this.closed = false; this.settled = false;
    this.queue = []; this.elapsed = 0;
  }
  snapshot() {
    return Object.freeze({ view: this.publicView(this.hand, { playerShown: this.playerShown,
      dealerShown: this.dealerShown, revealed: this.shownReveal, settled: this.settled }),
      status: this.status, motion: this.motion, canAct: this.status === 'player' && !this.step && !this.closed });
  }
  publish() { this.onUpdate(this.snapshot()); }
  enqueue(step) { this.queue.push(step); }
  next() {
    if (this.closed || this.step) return;
    const step = this.queue.shift();
    if (!step) { this.motion = null; this.publish(); return; }
    this.step = step; this.elapsed = 0; step.start?.();
    this.motion = step.kind ? { kind: step.kind, side: step.side, index: step.index, progress: 0 } : null;
    this.publish();
  }
  addCard(side, index, complete) {
    this.enqueue({ kind: 'deal', side, index, duration: side === 'dealer' ? (this.status === 'dealer' ? 650 : 480) : 400,
      start: () => { this[side === 'player' ? 'playerShown' : 'dealerShown'] = index + 1; this.onCard(); }, complete });
  }
  deal() {
    if (this.closed || this.step || this.playerShown || this.dealerShown) return false;
    this.addCard('player', 0); this.addCard('dealer', 0); this.addCard('player', 1);
    this.addCard('dealer', 1, () => this.afterPlayer()); this.next(); return true;
  }
  afterPlayer() {
    if (this.hand.phase === 'player') { this.status = 'player'; this.publish(); }
    else this.beginReveal();
  }
  hit() {
    if (!this.snapshot().canAct) return false;
    this.hand = this.transition('hit', this.hand); this.status = 'hitting';
    this.addCard('player', this.hand.player.length - 1, () => this.afterPlayer()); this.next(); return true;
  }
  stand() {
    if (!this.snapshot().canAct) return false;
    this.hand = this.transition('stand', this.hand); this.beginReveal(); this.next(); return true;
  }
  beginReveal() {
    this.status = 'revealing';
    this.enqueue({ kind: 'flip', duration: 760,
      complete: () => { this.shownReveal = true; this.hand = this.transition('reveal', this.hand); this.runDealer(); } });
  }
  runDealer() {
    if (this.hand.phase === 'resolved') {
      this.status = 'resolving';
      this.enqueue({ kind: 'result', duration: 600, complete: () => this.resolve() }); return;
    }
    this.status = 'dealer'; this.hand = this.transition('dealer', this.hand);
    this.addCard('dealer', this.hand.dealer.length - 1, () => this.runDealer());
  }
  advance(delta, { hidden = false } = {}) {
    if (hidden || this.closed || !this.step || !Number.isFinite(delta) || delta < 0) return;
    this.elapsed += Math.min(100, delta);
    const progress = Math.min(1, this.elapsed / this.step.duration);
    if (this.motion) this.motion = { ...this.motion, progress };
    if (this.motion?.kind === 'flip' && progress >= .5) this.shownReveal = true;
    this.publish();
    if (progress < 1) return;
    const completed = this.step; this.step = null; this.motion = null;
    completed.complete?.(); this.next();
  }
  flushTransitions() {
    // Reduced motion removes travel/flip time, while preserving player choices.
    let guard = 0;
    while (!this.closed && (this.step || this.queue.length) && guard++ < 100) {
      if (!this.step) this.next();
      if (this.step) { this.elapsed = this.step.duration; this.advance(0); }
    }
  }
  resolve() {
    if (this.closed) return false;
    this.closed = true; this.settled = true; this.status = 'resolved'; this.motion = null; this.step = null; this.queue = [];
    this.playerShown = this.hand.player.length; this.dealerShown = this.hand.dealer.length; this.shownReveal = true;
    this.publish(); this.onResolved(this.hand); return true;
  }
  finish() {
    if (this.closed) return false;
    this.hand = this.transition('finish', this.hand); return this.resolve();
  }
}
