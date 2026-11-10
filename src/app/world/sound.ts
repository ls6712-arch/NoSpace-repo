import type { MoodName } from "./moods";

/**
 * The room's sound, all made in the browser: a low room tone, the wheel's
 * hum, rain at night, birds in the morning, a slow four-chord loop, and small
 * effects (wet clay, a thud, a purr). No audio files.
 *
 * Nothing plays until `start()` is called, and that only happens from a tap
 * (browsers refuse sound before one). It goes quiet when the tab is hidden.
 */

export interface Sound {
  /** Call from a tap. Safe to call again. */
  start(): void;
  setSound(on: boolean): void;
  setMusic(on: boolean): void;
  setMood(mood: MoodName): void;
  /** Quiet while the tab is hidden or the world is paused. */
  suspend(paused: boolean): void;
  squish(pan: number, volume: number): void;
  thud(): void;
  purr(): void;
  dispose(): void;
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
const PENTA = [72, 74, 76, 79, 81, 84];

export function createSound(initial: { sound: boolean; music: boolean; mood: MoodName }): Sound {
  let ctx: AudioContext | null = null;
  let master: GainNode;
  let music: GainNode;
  let sfx: GainNode;
  let amb: GainNode;
  let rainG: GainNode;
  let delay: DelayNode;
  let white: AudioBuffer;
  let brown: AudioBuffer;
  let timer: number | undefined;
  let next = 0;
  let chord = 0;
  let nextBird = 0;
  let soundOn = initial.sound;
  let musicOn = initial.music;
  let mood = initial.mood;

  const noise = (c: AudioContext, sec: number, isBrown: boolean) => {
    const n = (c.sampleRate * sec) | 0;
    const b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        if (isBrown) {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        } else d[i] = w;
      }
    }
    return b;
  };
  const impulse = (c: AudioContext, sec: number, decay: number) => {
    const n = (c.sampleRate * sec) | 0;
    const b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return b;
  };
  const panTo = (c: AudioContext, node: AudioNode, p: number, dest: AudioNode) => {
    if (c.createStereoPanner) {
      const pn = c.createStereoPanner();
      pn.pan.value = p;
      node.connect(pn);
      pn.connect(dest);
    } else node.connect(dest);
  };
  const loopNoise = (c: AudioContext, buf: AudioBuffer, filters: [BiquadFilterType, number, number?][], gain: number, dest: AudioNode, pan = 0) => {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    let node: AudioNode = src;
    for (const [type, f, q] of filters) {
      const b = c.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      if (q) b.Q.value = q;
      node.connect(b);
      node = b;
    }
    const g = c.createGain();
    g.gain.value = gain;
    node.connect(g);
    panTo(c, g, pan, dest);
    src.start(0, Math.random() * buf.duration);
    return g;
  };
  const env = (g: GainNode, t: number, a: number, peak: number, d: number) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  };

  const pad = (c: AudioContext, f: number, t: number, d: number) => {
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = mood === "night" ? 800 : 1150;
    lp.connect(music);
    for (const [type, det] of [["triangle", 0], ["sine", 7]] as const) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = det;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.032, t + 1.4);
      g.gain.setValueAtTime(0.032, t + d - 0.4);
      g.gain.linearRampToValueAtTime(0, t + d + 1.2);
      o.connect(g);
      g.connect(lp);
      o.start(t);
      o.stop(t + d + 1.3);
    }
  };
  const bass = (c: AudioContext, f: number, t: number) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = f;
    env(g, t, 0.02, 0.13, 1.4);
    o.connect(g);
    g.connect(music);
    o.start(t);
    o.stop(t + 1.6);
  };
  const pluck = (c: AudioContext, f: number, t: number) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = f;
    env(g, t, 0.006, 0.05, 0.9);
    o.connect(g);
    g.connect(music);
    g.connect(delay);
    o.start(t);
    o.stop(t + 1);
  };
  const crackle = (c: AudioContext, t: number) => {
    for (let i = 0; i < 7; i++) {
      const s = c.createBufferSource();
      const g = c.createGain();
      const h = c.createBiquadFilter();
      s.buffer = white;
      h.type = "highpass";
      h.frequency.value = 2500;
      g.gain.value = 0.025 * Math.random();
      s.connect(h);
      h.connect(g);
      g.connect(music);
      s.start(t + Math.random() * 4, Math.random() * 2, 0.004);
    }
  };
  const bird = (c: AudioContext) => {
    const t = c.currentTime;
    const pan = -0.9 + Math.random() * 0.6;
    const n = (2 + Math.random() * 3) | 0;
    const f0 = 2300 + Math.random() * 1400;
    for (let i = 0; i < n; i++) {
      const o = c.createOscillator();
      const g = c.createGain();
      const st = t + i * 0.13;
      o.frequency.setValueAtTime(f0, st);
      o.frequency.exponentialRampToValueAtTime(f0 * 1.45, st + 0.06);
      o.frequency.exponentialRampToValueAtTime(f0 * 1.05, st + 0.1);
      env(g, st, 0.01, 0.035, 0.1);
      o.connect(g);
      panTo(c, g, pan, amb);
      o.start(st);
      o.stop(st + 0.15);
    }
  };
  const schedule = () => {
    const c = ctx;
    if (!c || c.state !== "running") return;
    while (next < c.currentTime + 1) {
      const t = next;
      const ch = CHORDS[chord % 4];
      if (musicOn) {
        for (const m of ch) pad(c, mtof(m), t, 4);
        bass(c, mtof(ch[0] - 12), t);
        bass(c, mtof(ch[0] - 12), t + 2.5);
        for (let b = 0; b < 8; b++) if (Math.random() < 0.3) pluck(c, mtof(PENTA[(Math.random() * PENTA.length) | 0]), t + b * 0.5);
        crackle(c, t);
      }
      chord++;
      next += 4;
    }
    if (mood === "morning" && c.currentTime > nextBird) {
      bird(c);
      nextBird = c.currentTime + 2 + Math.random() * 5;
    }
  };

  const squish = (pan: number, vol: number) => {
    const c = ctx;
    if (!c || c.state !== "running") return;
    const t = c.currentTime;
    const s = c.createBufferSource();
    const bp = c.createBiquadFilter();
    const g = c.createGain();
    s.buffer = white;
    bp.type = "bandpass";
    bp.Q.value = 2.2;
    bp.frequency.setValueAtTime(320, t);
    bp.frequency.linearRampToValueAtTime(1150, t + 0.24);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.035);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    s.connect(bp);
    bp.connect(g);
    panTo(c, g, pan, sfx);
    s.start(t, Math.random() * 2, 0.32);
  };

  return {
    start() {
      if (ctx) {
        if (soundOn) void ctx.resume();
        return;
      }
      if (!soundOn) return;
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const c = (ctx = new AC());
      master = c.createGain();
      master.gain.value = 0;
      master.connect(c.destination);
      master.gain.setTargetAtTime(0.9, c.currentTime, 1.5);
      const conv = c.createConvolver();
      conv.buffer = impulse(c, 3, 2.4);
      const rv = c.createGain();
      rv.gain.value = 0.45;
      conv.connect(rv);
      rv.connect(master);
      const bus = (g: number, send: number) => {
        const n = c.createGain();
        n.gain.value = g;
        n.connect(master);
        const s = c.createGain();
        s.gain.value = send;
        n.connect(s);
        s.connect(conv);
        return n;
      };
      music = bus(musicOn ? 0.3 : 0, 0.65);
      sfx = bus(0.9, 0.25);
      amb = bus(0.85, 0.12);
      white = noise(c, 3, false);
      brown = noise(c, 5, true);
      loopNoise(c, brown, [["lowpass", 360]], 0.22, amb);
      const hum = c.createOscillator();
      hum.type = "sawtooth";
      hum.frequency.value = 46;
      const hf = c.createBiquadFilter();
      hf.type = "lowpass";
      hf.frequency.value = 140;
      const hg = c.createGain();
      hg.gain.value = 0.045;
      hum.connect(hf);
      hf.connect(hg);
      panTo(c, hg, 0.35, amb);
      hum.start();
      const wob = c.createOscillator();
      wob.frequency.value = 0.5;
      const wg = c.createGain();
      wg.gain.value = 0.012;
      wob.connect(wg);
      wg.connect(hg.gain);
      wob.start();
      loopNoise(c, white, [["bandpass", 950, 0.9]], 0.01, amb, 0.35);
      rainG = loopNoise(c, white, [["highpass", 700], ["lowpass", 6000]], mood === "night" ? 0.18 : 0, amb, -0.5);
      delay = c.createDelay(1.5);
      delay.delayTime.value = 0.375;
      const fb = c.createGain();
      fb.gain.value = 0.35;
      const dlf = c.createBiquadFilter();
      dlf.type = "lowpass";
      dlf.frequency.value = 2200;
      delay.connect(dlf);
      dlf.connect(fb);
      fb.connect(delay);
      dlf.connect(music);
      next = c.currentTime + 0.4;
      timer = window.setInterval(schedule, 200);
    },
    setSound(on) {
      soundOn = on;
      if (ctx) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.3);
    },
    setMusic(on) {
      musicOn = on;
      if (ctx) music.gain.setTargetAtTime(on ? 0.3 : 0, ctx.currentTime, 0.4);
    },
    setMood(m) {
      mood = m;
      if (ctx) rainG.gain.setTargetAtTime(m === "night" ? 0.18 : 0, ctx.currentTime, 1.2);
    },
    suspend(paused) {
      if (!ctx) return;
      if (paused) void ctx.suspend();
      else if (soundOn) void ctx.resume();
    },
    squish,
    thud() {
      const c = ctx;
      if (!c || c.state !== "running") return;
      const t = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.3);
      env(g, t, 0.01, 0.4, 0.35);
      o.connect(g);
      panTo(c, g, 0.35, sfx);
      o.start(t);
      o.stop(t + 0.4);
      squish(0.35, 0.35);
    },
    purr() {
      const c = ctx;
      if (!c || c.state !== "running") return;
      const t = c.currentTime;
      const s = c.createBufferSource();
      const lp = c.createBiquadFilter();
      const g = c.createGain();
      const am = c.createGain();
      const lfo = c.createOscillator();
      const lg = c.createGain();
      s.buffer = brown;
      lp.type = "lowpass";
      lp.frequency.value = 200;
      lfo.frequency.value = 24;
      lg.gain.value = 0.5;
      am.gain.value = 0.5;
      lfo.connect(lg);
      lg.connect(am.gain);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.7, t + 0.3);
      g.gain.linearRampToValueAtTime(0, t + 1.8);
      s.connect(lp);
      lp.connect(am);
      am.connect(g);
      g.connect(sfx);
      s.start(t);
      s.stop(t + 2);
      lfo.start(t);
      lfo.stop(t + 2);
    },
    dispose() {
      if (timer) window.clearInterval(timer);
      if (ctx) void ctx.close();
      ctx = null;
    },
  };
}
