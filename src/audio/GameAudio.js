const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const midi = note => 440 * 2 ** ((note - 69) / 12);
export const MUSIC_PROFILES = Object.freeze({
  hall: { bpm:86, chords:[[57,60,64,67],[53,57,60,64],[48,55,60,64],[55,59,62,67]], melody:[0,2,1,3], beats:[2,5], voice:'sine', swing:0, pulse:0.55 },
  coinflip: { bpm:92, chords:[[53,57,60,64],[50,53,57,60],[55,59,62,65],[48,52,55,59]], melody:[0,2,3,1], beats:[1,4,6], voice:'triangle', swing:.10, pulse:.9 },
  dice: { bpm:108, chords:[[48,52,55],[53,57,60],[55,59,62],[48,55,64]], melody:[0,0,2,1], beats:[0,3,5,7], voice:'triangle', swing:0, pulse:1.15 },
  plinko: { bpm:128, chords:[[55,59,62,67],[52,55,59,62],[60,64,67,71],[50,57,62,66]], melody:[0,2,3,1,2,0,3,2], beats:[0,1,3,4,6,7], voice:'sine', swing:0, pulse:.75 },
  roulette: { bpm:96, chords:[[51,55,58,62],[56,60,63,67],[53,56,60,63],[58,62,65,68]], melody:[2,1,3,0], beats:[2,5], voice:'triangle', swing:.16, pulse:.45 },
  upgrader: { bpm:124, chords:[[45,52,57,60],[48,55,60,64],[41,48,53,57],[43,50,55,59]], melody:[0,1,2,3,2,1,0,3], beats:[0,1,2,3,4,5,6,7], voice:'triangle', swing:0, pulse:.8 },
  slots: { bpm:118, chords:[[50,53,57,62],[46,50,53,57],[48,52,55,60],[45,52,57,61]], melody:[0,2,1,3,2,0,3,1], beats:[0,2,3,5,6], voice:'sine', swing:.05, pulse:.85 },
  blackjack: { bpm:78, chords:[[50,53,57,60],[55,59,62,65],[48,52,55,59],[45,52,55,60]], melody:[2,1,3,0], beats:[3,6], voice:'triangle', swing:.19, pulse:.3 },
  maskhouse: { bpm:102, chords:[[48,51,55,60],[53,56,60,63],[46,50,53,58],[43,50,55,58]], melody:[0,3,2,1,0,2], beats:[0,2,5,7], voice:'triangle', swing:.12, pulse:.7 },
  lecipher: { bpm:132, chords:[[52,55,59,62],[57,60,64,67],[50,53,57,60],[55,59,62,65]], melody:[0,1,3,2,1,0,2,3], beats:[0,1,3,5,6], voice:'sine', swing:.08, pulse:.8 },
});

/**
 * Authored synthesised audio. No fetched recordings.
 * Constructor has no DOM, audio-context or timer side effects.
 * Create in a React effect, call attach(), dispose that same instance.
 */
export class GameAudio {
  constructor({ volume = 0.62, musicVolume = 0.27, sfxVolume = 1 } = {}) {
    this.volume = clamp(volume, 0, 1);
    this.musicVolume = clamp(musicVolume, 0, 1);
    this.sfxVolume = clamp(sfxVolume, 0, 1);
    this.sfxEnabled = false;
    this.musicEnabled = false;
    this.context = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.noiseBuffer = null;
    this.voices = new Set();
    this.loops = new Map();
    this.ducks = new Map();
    this.requests = { sfx: 0, music: 0 };
    this.musicStep = 0;
    this.musicNext = 0;
    this.musicTimer = null;
    this.musicMode = 'hall';
    this.serial = 0;
    this.attached = false;
    this.disposed = false;
    this.visibilityGeneration = 0;
    this.onVisibility = this.handleVisibility.bind(this);
    this.unlockPromise = null;
    this.roundGeneration = 0;
    this.payoutGeneration = 0;
    this.roundGame = null;
  }

  // Store intent without creating an AudioContext before a browser gesture.
  setMusicMode(mode) {
    const next = Object.hasOwn(MUSIC_PROFILES, mode) ? mode : 'hall';
    if (this.disposed || next === this.musicMode) return;
    this.musicMode = next;
    this.stopMusic();
    if (this.canPlay('music')) this.startMusic();
  }

  setPreferences({ music, sfx }) {
    if (this.disposed) return;
    const startMusic = !this.musicEnabled && Boolean(music);
    this.musicEnabled = Boolean(music);
    this.sfxEnabled = Boolean(sfx);
    if (!this.musicEnabled) this.stopMusic({ reset: false });
    if (!this.sfxEnabled) {
      for (const name of [...this.loops.keys()]) this.stopLoop(name);
      this.stopVoices(null, 'sfx');
      this.clearDucks();
    }
    this.updateGains();
    if (startMusic && this.canPlay('music') && this.musicTimer === null) this.startMusic({ resume: true });
  }

  unlock() {
    if (this.disposed || !this.enabled || (typeof document !== 'undefined' && document.hidden)) return Promise.resolve(false);
    if (this.unlockPromise) return this.unlockPromise;
    let context;
    try { context = this.createContext(); } catch { return Promise.resolve(false); }
    if (!context) return Promise.resolve(false);
    if (context.state === 'running') {
      this.updateGains();
      if (this.musicEnabled && this.musicTimer === null) this.startMusic({ resume: true });
      return Promise.resolve(true);
    }
    let request;
    try { request = context.resume(); } catch { return Promise.resolve(false); }
    this.unlockPromise = Promise.resolve(request).then(() => {
      if (this.disposed || document.hidden || context.state !== 'running') return false;
      this.updateGains();
      if (this.musicEnabled && this.musicTimer === null) this.startMusic({ resume: true });
      return true;
    }).catch(() => false).finally(() => { this.unlockPromise = null; });
    return this.unlockPromise;
  }

  get enabled() {
    return this.sfxEnabled || this.musicEnabled;
  }

  attach() {
    if (this.attached || this.disposed || typeof document === "undefined") return;
    this.attached = true;
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  async handleVisibility() {
    const context = this.context;
    const generation = ++this.visibilityGeneration;
    if (!context || this.disposed) return;
    if (document.hidden) {
      this.stopVoices();
      this.stopMusic({ reset: false });
      for (const loop of this.loops.values()) { clearTimeout(loop.timer); loop.timer = null; }
      for (const duck of this.ducks.values()) clearTimeout(duck.timer);
      try { await context.suspend(); } catch {}
      return;
    }
    if (!this.enabled) return;
    try { await context.resume(); } catch { return; }
    if (this.disposed || generation !== this.visibilityGeneration || document.hidden) return;
    this.updateGains();
    for (const [tag, duck] of this.ducks) this.armDuck(tag, duck);
    for (const loop of this.loops.values()) if (loop.timer === null) loop.tick?.();
    if (this.musicEnabled) this.startMusic({ resume: true });
  }

  createContext() {
    if (this.context) return this.context;
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) return null;

    const context = new Context({ latencyHint: "interactive" });
    const sfx = context.createGain();
    const music = context.createGain();
    const compressor = context.createDynamicsCompressor();
    const limiter = context.createDynamicsCompressor();
    const master = context.createGain();

    sfx.gain.value = 0;
    music.gain.value = 0;
    master.gain.value = 0;

    compressor.threshold.value = -19;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.16;
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;

    sfx.connect(compressor);
    music.connect(compressor);
    compressor.connect(limiter);
    limiter.connect(master);
    master.connect(context.destination);

    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 1.7), context.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 0x6d2b79f5;
    let brown = 0;
    for (let index = 0; index < samples.length; index += 1) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      const white = ((seed >>> 0) / 4294967296) * 2 - 1;
      brown = (brown + white * 0.02) / 1.02;
      samples[index] = white * 0.7 + brown * 1.8;
    }

    this.context = context;
    this.sfxBus = sfx;
    this.musicBus = music;
    this.master = master;
    this.noiseBuffer = buffer;
    this.graph = [sfx, music, compressor, limiter, master];
    return context;
  }

  updateGains() {
    if (!this.context) return;
    const now = this.context.currentTime;
    const target = (node, value, constant = 0.025) => {
      node.gain.cancelScheduledValues(now);
      node.gain.setTargetAtTime(value, now, constant);
    };
    target(this.master, this.enabled ? this.volume * 0.65 : 0);
    target(this.sfxBus, this.sfxEnabled ? 0.7 * this.sfxVolume : 0, 0.012);
    target(this.musicBus, this.musicEnabled ? this.musicVolume * (this.ducks.size ? 0.22 : 1) : 0, 0.12);
  }

  // Enabling must be called directly from a user gesture.
  async setChannel(channel, enabled) {
    if (channel !== "sfx" && channel !== "music") throw new Error("Unknown audio channel.");
    const request = ++this.requests[channel];
    const property = channel === "sfx" ? "sfxEnabled" : "musicEnabled";

    if (!enabled || this.disposed) {
      this[property] = false;
      if (channel === "music") {
        this.stopMusic();
      } else {
        for (const key of [...this.loops.keys()]) this.stopLoop(key);
        this.stopVoices(null, "sfx");
        this.clearDucks();
      }
      this.updateGains();
      return false;
    }

    const context = this.createContext();
    if (!context) return false;
    try { await context.resume(); } catch { return false; }
    if (request !== this.requests[channel] || this.disposed) return this[property];

    this[property] = true;
    this.updateGains();
    if (channel === "music") this.startMusic();
    else this.play("ui");
    return true;
  }

  setSfxEnabled(enabled) { return this.setChannel("sfx", enabled); }
  setMusicEnabled(enabled) { return this.setChannel("music", enabled); }

  // Compatibility only. Prefer the two independent toggles above.
  async setEnabled(enabled) {
    await Promise.all([this.setSfxEnabled(enabled), this.setMusicEnabled(enabled)]);
    return this.enabled;
  }

  setVolume(volume) {
    this.volume = clamp(volume, 0, 1);
    this.updateGains();
  }

  setSfxVolume(volume) {
    this.sfxVolume = clamp(volume, 0, 1);
    this.updateGains();
  }

  setMusicVolume(volume) {
    this.musicVolume = clamp(volume, 0, 1);
    this.updateGains();
  }

  canPlay(channel = "sfx") {
    return Boolean(
      !this.disposed &&
      this.context?.state === "running" &&
      (channel === "music" ? this.musicEnabled : this.sfxEnabled) &&
      !(typeof document !== "undefined" && document.hidden)
    );
  }

  track(source, nodes, tag, channel) {
    const voice = { source, nodes, tag, channel };
    this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice);
      for (const node of nodes) {
        try { node.disconnect(); } catch {}
      }
    };
    return source;
  }

  tone(frequency, duration = 0.1, level = 0.08, options = {}) {
    const {
      time = this.context?.currentTime || 0,
      type = "sine",
      to = frequency,
      tag = "ui",
      channel = "sfx",
      attack = 0.004,
      sustain = 0,
    } = options;
    if (!this.canPlay(channel)) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), time);
    if (to !== frequency) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), time + duration);
    }
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.linearRampToValueAtTime(level, time + Math.min(attack, duration * 0.25));
    if (sustain > 0) envelope.gain.setValueAtTime(level, time + duration * clamp(sustain, 0.1, 0.85));
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.012, duration));
    oscillator.connect(envelope);
    envelope.connect(channel === "music" ? this.musicBus : this.sfxBus);
    this.track(oscillator, [oscillator, envelope], tag, channel);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.025);
  }

  noise(duration = 0.08, level = 0.09, from = 1800, to = 600, options = {}) {
    const {
      time = this.context?.currentTime || 0,
      type = "bandpass",
      q = 0.7,
      tag = "ui",
      channel = "sfx",
    } = options;
    if (!this.canPlay(channel)) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(Math.max(30, from), time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, to), time + duration);
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.linearRampToValueAtTime(level, time + Math.min(0.006, duration * 0.25));
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(channel === "music" ? this.musicBus : this.sfxBus);
    this.track(source, [source, filter, envelope], tag, channel);
    source.start(time, (this.serial++ % 9) * 0.11);
    source.stop(time + duration + 0.025);
  }

  bell(frequency, time, level = 0.075, tag = "result") {
    this.tone(frequency, 0.38, level, { time, tag });
    this.tone(frequency * 2.006, 0.2, level * 0.24, { time, tag });
    this.tone(frequency * 3.01, 0.11, level * 0.08, { time, tag });
  }

  impact(time, strength = 1, tag = "round") {
    this.tone(126, 0.15, 0.16 * strength, { time, to: 43, tag });
    this.noise(0.055, 0.07 * strength, 1450, 420, { time, tag });
  }

  mechanicalTick(time, strength = 1, pitch = 2100, tag = "round") {
    this.noise(0.025, 0.065 * strength, pitch, pitch * 0.44, { time, q: 1.15, tag });
    this.tone(410, 0.035, 0.022 * strength, { time, type: "triangle", to: 230, tag });
  }

  diceContact(time, strength = 1) {
    // Broad body + crisp corner + short ceramic resonance. All three voices
    // use the shared authored noise buffer, without a pitched oscillator.
    this.noise(.055, .13 * strength, 1120, 540, { time, q: .65, tag: 'round' });
    this.noise(.014, .15 * strength, 5300, 2350, { time, q: .5, tag: 'round' });
    this.noise(.043, .038 * strength, 2100, 1740, { time, q: 1.8, tag: 'round' });
  }

  diceRollContact(time, strength = 1) {
    this.noise(.018, .032 * strength, 2550, 980, { time, q: .55, tag: 'round' });
    this.noise(.03, .014 * strength, 650, 360, { time, q: .6, tag: 'round' });
  }

  beginDiceFoley(durationMs) {
    const now = this.context.currentTime;
    this.noise(.12, .024, 650, 1600, {time: now, q: .4, tag: 'round'});
    // Match the actual scene's four bounce landmarks; the settling contacts
    // get quieter as the last edges roll to rest. This clock freezes with the
    // AudioContext, so hidden wall time cannot skip ahead through the plan.
    const plan = [
      {at: .16, strength: 1}, {at: .34, strength: .73},
      {at: .53, strength: .49}, {at: .72, strength: .30},
      {at: .79, strength: 1, roll: true}, {at: .82, strength: .74, roll: true},
      {at: .852, strength: .51, roll: true}, {at: .884, strength: .31, roll: true},
      {at: .918, strength: .15, roll: true}
    ];
    let next = 0;
    this.loop('round', durationMs, ({elapsed, time}) => {
      while (next < plan.length && elapsed + .5 >= plan[next].at * durationMs) {
        const contact = plan[next++];
        if (contact.roll) this.diceRollContact(time, contact.strength);
        else this.diceContact(time, contact.strength);
      }
      const due = next < plan.length ? plan[next].at * durationMs : durationMs;
      return Math.max(8, Math.min(80, due - elapsed));
    }, 8);
  }

  armDuck(tag, duck) {
    clearTimeout(duck.timer);
    if (!this.context || (typeof document !== "undefined" && document.hidden)) return;
    const remaining = Math.max(0, (duck.until - this.context.currentTime) * 1000);
    duck.timer = setTimeout(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      this.releaseMusic(tag);
    }, remaining);
  }

  duckMusic(tag, durationMs = 1000) {
    const prior = this.ducks.get(tag);
    if (prior) clearTimeout(prior.timer);
    const duck = { until: (this.context?.currentTime || 0) + durationMs / 1000, timer: null };
    this.ducks.set(tag, duck);
    this.armDuck(tag, duck);
    this.updateGains();
  }

  releaseMusic(tag) {
    const duck = this.ducks.get(tag);
    if (duck) clearTimeout(duck.timer);
    this.ducks.delete(tag);
    this.updateGains();
  }

  clearDucks() {
    for (const duck of this.ducks.values()) clearTimeout(duck.timer);
    this.ducks.clear();
    this.updateGains();
  }

  startMusic({ resume = false } = {}) {
    this.stopMusic({ reset: !resume });
    if (!this.canPlay("music")) return;
    if (resume) this.musicStep = Math.floor(this.musicStep / 8) * 8;
    this.musicNext = this.context.currentTime + 0.08;
    const eighth = 60 / MUSIC_PROFILES[this.musicMode].bpm / 2;

    const schedule = () => {
      if (!this.canPlay("music")) return;
      const horizon = this.context.currentTime + 0.22;
      while (this.musicNext < horizon) {
        this.musicBeat(this.musicStep++, this.musicNext);
        this.musicNext += eighth;
      }
      this.musicTimer = setTimeout(schedule, 50);
    };
    schedule();
  }

  // Each room owns its harmony, tempo, instrumentation and rhythmic pattern.
  musicBeat(step, time) {
    const profile = MUSIC_PROFILES[this.musicMode];
    const bar = Math.floor(step / 8) % profile.chords.length;
    const position = step % 8;
    const chord = profile.chords[bar].map(midi);
    const eighth = 60 / profile.bpm / 2;
    const playedAt = time + (position % 2 ? eighth * profile.swing : 0);

    if (position === 0) {
      chord.forEach((frequency, index) => {
        this.tone(frequency, eighth * 7.5, index === 0 ? 0.018 : 0.012, {
          time, attack: 0.1, sustain: 0.55, channel: "music", tag: "music", type:profile.voice,
        });
      });
      this.tone(chord[0] / 2, 0.9, 0.034, {
        time, channel: "music", tag: "music", attack: 0.035,
      });
    }

    if (profile.beats.includes(position)) {
      const note = chord[profile.melody[step % profile.melody.length] % chord.length] * 2;
      const short = ['dice','plinko','upgrader','slots'].includes(this.musicMode);
      this.tone(note, short ? .18 : .55, short ? .033 : .027, {
        time:playedAt, channel: "music", tag: "music", attack: 0.01, type:profile.voice,
      });
      this.tone(note * 2.005, 0.28, 0.004, {
        time:playedAt, channel: "music", tag: "music", attack: 0.006,
      });
    }

    if (position === 0 || position === 4) {
      this.tone(82, 0.11, 0.03 * profile.pulse, {
        time, to: 43, channel: "music", tag: "music",
      });
    }
    if (position % 2 === 1) {
      this.noise(0.038, 0.011 * profile.pulse, this.musicMode==='dice'?2200:4200, 2400, {
        time:playedAt, channel: "music", tag: "music", type: "highpass",
      });
    }
  }

  stopMusic({ reset = true } = {}) {
    clearTimeout(this.musicTimer);
    this.musicTimer = null;
    this.stopVoices("music", "music");
    if (reset) this.musicStep = 0;
  }

  loop(name, durationMs, step, minimumDelayMs = 25) {
    this.stopLoop(name);
    if (!this.canPlay()) return;
    const loop = { start: this.context.currentTime, index: 0, timer: null };
    this.loops.set(name, loop);

    const tick = () => {
      loop.timer = null;
      if (this.loops.get(name) !== loop || !this.sfxEnabled || this.disposed) return;
      if (!this.canPlay()) {
        // Visibility resume owns restarting this clock; hidden tabs do not poll.
        if (!(typeof document !== 'undefined' && document.hidden)) loop.timer = setTimeout(tick, 150);
        return;
      }
      const elapsed = (this.context.currentTime - loop.start) * 1000;
      if (elapsed >= durationMs) {
        this.loops.delete(name);
        return;
      }
      const delay = step({
        elapsed,
        progress: clamp(elapsed / durationMs, 0, 1),
        index: loop.index++,
        time: this.context.currentTime + 0.012,
      });
      loop.timer = setTimeout(tick, Math.max(minimumDelayMs, delay));
    };
    loop.tick = tick;
    tick();
  }

  stopLoop(name) {
    const loop = this.loops.get(name);
    if (loop) clearTimeout(loop.timer);
    this.loops.delete(name);
    this.stopVoices(name, "sfx");
  }

  stopVoices(tag, channel) {
    const stopAt = (this.context?.currentTime || 0) + 0.012;
    for (const voice of this.voices) {
      if (tag && voice.tag !== tag) continue;
      if (channel && voice.channel !== channel) continue;
      try { voice.source.stop(stopAt); } catch {}
    }
  }

  beginRound(game, { durationMs = 4000 } = {}) {
    const generation = ++this.roundGeneration;
    this.roundGame = game;
    if (!this.canPlay() && this.sfxEnabled && this.unlockPromise) {
      this.unlockPromise.then(ok => {
        if (ok && generation === this.roundGeneration && !this.disposed) this.beginRound(game, { durationMs });
      });
      return;
    }
    this.stopLoop("round");
    if (!this.canPlay()) return;
    const now = this.context.currentTime;
    const duration = Math.max(500, durationMs);
    this.duckMusic("spin-start", 800);

    if (game === "dice") {
      this.beginDiceFoley(duration);
      return;
    }

    if (game === "coinflip") {
      this.noise(0.55, 0.1, 350, 1900, { time: now, tag: "round" });
      this.tone(190, 0.45, 0.028, { time: now, type: "triangle", to: 430, tag: "round" });
      return;
    }
    if (game === "upgrader") {
      const seconds=duration/1000;
      this.noise(.15, .045, 700, 2800, {time:now,tag:"round"});
      this.tone(220, seconds*.18, .02, {time:now,type:"triangle",to:520,tag:"round"});
      this.loop("round",duration,({progress,index,time})=>{
        this.tone([440,660,880,550][index%4],.028,.014,{time,type:"square",tag:"round"});
        return progress<.72?105-progress*60:125+progress*45;
      });
      this.tone(350,seconds*.19,.025,{time:now+seconds*.72,type:"triangle",to:1050,tag:"round"});
      this.tone(880,.09,.024,{time:now+seconds*.92,type:"sine",tag:"round"});
      return;
    }

    this.noise(0.65, 0.09, 500, 1900, { time: now, tag: "round" });
    this.loop("round", duration, ({ progress, index, time }) => {
      const slot = ["slots","maskhouse","lecipher"].includes(game);
      const cadence = slot ? 82 + 100 * progress ** 2
        : 38 + 180 * progress ** 2;
      this.mechanicalTick(time, 0.68 - progress * 0.28, slot ? 1800 : 2600, "round");
      return cadence;
    });
  }

  endRound() {
    ++this.roundGeneration;
    const game = this.roundGame;
    this.roundGame = null;
    this.stopLoop("round");
    // Dice has already settled with a quiet roll, rather than a generic drum.
    if (game === 'upgrader' && this.canPlay()) this.tone(660,.065,.02,{type:'sine',tag:'round'});
    else if (game && game !== 'dice' && this.canPlay()) this.impact(this.context.currentTime, 0.65, "round");
  }

  beginCountup({ durationMs = 2000, tier = 1, positive = true } = {}) {
    this.loop("count", Math.max(100, durationMs), ({ progress, index, time }) => {
      const frequency = 330 * (1 + progress * 1.9);
      const level = positive ? 0.034 + tier * 0.003 : 0.025;
      this.tone(frequency, 0.052, level, { time, type: "triangle", tag: "count" });
      if (positive && index % 4 === 0) {
        this.tone(frequency * 2, 0.065, level * 0.18, { time, tag: "count" });
      }
      return 100 - progress * 55;
    });
  }

  stopCountup() { this.stopLoop("count"); }

  finishCountup({ tier = 1, positive = true } = {}) {
    this.stopCountup();
    this.play(positive ? "resolve" : "receipt", { tier });
  }

  stopPayout() {
    ++this.payoutGeneration;
    this.stopCountup();
    this.stopVoices("result", "sfx");
    this.releaseMusic("payout");
  }

  winWhistle(time, strength = 1) {
    const level = .055 + clamp(strength, 0, 4) * .007;
    this.tone(780, .25, level, { time, to:1568, attack:.025, type:'sine', tag:'result' });
    this.tone(1175, .31, level * .85, { time:time+.22, to:2093, attack:.035, type:'sine', tag:'result' });
    this.noise(.40, .016, 2400, 4400, { time, type:'bandpass', q:1.3, tag:'result' });
  }

  play(cue, { tier = 1, positive = true } = {}) {
    if (!this.canPlay() && this.sfxEnabled && this.unlockPromise) {
      const resultCue = ['payout','celebrate','resolve','receipt','loss'].includes(cue);
      const generation = resultCue ? this.payoutGeneration : this.roundGeneration;
      this.unlockPromise.then(ok => { if (ok && !this.disposed && generation === (resultCue ? this.payoutGeneration : this.roundGeneration)) this.play(cue, { tier, positive }); });
      return;
    }
    const duckDuration = { cascade: 1000, scatter: 700, bonus: 2400, payout: 6000, celebrate: 6000 }[cue];
    if (duckDuration && this.musicEnabled) this.duckMusic(cue === 'celebrate' ? 'payout' : cue, duckDuration);
    if (!this.canPlay()) return;
    const now = this.context.currentTime;
    const strength = clamp(tier, 0, 4);

    switch (cue) {
      case "ui":
        this.tone(690, 0.045, 0.025, { time: now });
        this.noise(0.024, 0.022, 2300, 1300, { time: now });
        break;
      case "pin":
        this.mechanicalTick(now, 0.48, 3100, "round");
        break;
      case "fall":
        this.mechanicalTick(now, 0.85, 1400, "round");
        this.impact(now + 0.035, 0.3, "round");
        break;
      case "cascade":
        this.noise(0.22, 0.085, 3000, 500, { time: now, tag: "round" });
        for (let index = 0; index < 3; index += 1) {
          this.mechanicalTick(now + index * 0.043, 0.52, 1700, "round");
        }
        break;
      case "scatter":
        [659.25, 830.61, 987.77].forEach((note, index) => {
          this.bell(note, now + index * 0.085, 0.065, "round");
        });
        break;
      case "multiplier":
        this.tone(440,.13,.04,{time:now,type:'triangle',tag:'round'});
        this.tone(660,.14,.03,{time:now+.09,type:'triangle',tag:'round'});
        this.tone(880,.18,.024,{time:now+.18,type:'sine',tag:'round'});
        break;
      case "bonus":
        this.impact(now, 0.85, "round");
        this.noise(0.65, 0.095, 280, 2400, { time: now, tag: "round" });
        [261.63, 329.63, 392, 523.25].forEach((note, index) => {
          this.bell(note, now + 0.08 + index * 0.12, 0.09, "round");
        });
        break;
      case "celebrate":
      case "payout":
        if (!positive) {
          this.noise(0.22, 0.045, 800, 1600, { time: now, tag: "result" });
          this.tone(330, 0.12, 0.035, { time: now, tag: "result" });
          break;
        }
        this.impact(now, 0.65 + strength * 0.1, "result");
        this.winWhistle(now + .055, strength);
        this.noise(0.46, 0.06 + strength * 0.014, 450, 2500, { time: now, tag: "result" });
        [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((note, index) => {
          this.bell(note, now + 0.035 + index * 0.075, 0.08, "result");
        });
        break;
      case "resolve":
        if (!positive) { this.play('receipt'); break; }
        this.impact(now, 0.48 + strength * 0.07, "result");
        this.tone(130.81, 0.6, 0.09, { time: now, tag: "result" });
        [261.63, 329.63, 392, 523.25, 659.25].forEach((note, index) => {
          this.bell(note, now + index * 0.026, 0.046 + strength * 0.006, "result");
        });
        break;
      case "receipt":
        this.tone(440, 0.12, 0.028, { time: now, tag: "result" });
        this.mechanicalTick(now + 0.055, 0.25, 1200, "result");
        break;
      case "loss":
        this.tone(155, 0.17, 0.045, { time: now, to: 115, tag: "result" });
        this.noise(0.09, 0.025, 600, 210, { time: now, tag: "result" });
        break;
      default:
        break;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    ++this.visibilityGeneration;
    ++this.requests.sfx;
    ++this.requests.music;
    this.sfxEnabled = false;
    this.musicEnabled = false;
    for (const loop of this.loops.values()) clearTimeout(loop.timer);
    this.loops.clear();
    this.stopMusic();
    this.clearDucks();
    this.stopVoices();
    if (this.attached && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibility);
    }
    for (const node of this.graph || []) {
      try { node.disconnect(); } catch {}
    }
    for (const voice of this.voices) {
      for (const node of voice.nodes) {
        try { node.disconnect(); } catch {}
      }
    }
    this.voices.clear();
    this.context?.close().catch(() => {});
    this.context = null;
    this.attached = false;
  }
}
