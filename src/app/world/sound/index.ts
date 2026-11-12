import type { SoundBed } from "../config";
import type { MoodName } from "../core/moods";

/**
 * The room's sound, all made in the browser: a low room tone, rain at night, birds in the morning, a slow
 * four-chord loop, small effects (wet clay, a thud, a purr, a trowel, a page, dice), and the background beds
 * a Corner's config asks for (the wheel's hum, birds, wind, a fire, a clock, a café). No audio files.
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
  /** A trowel in soil. */
  dig(pan: number): void;
  /** A page turning. */
  page(pan: number): void;
  /** Dice landing on a table. */
  dice(pan: number): void;
  /** A game piece put down. */
  clack(pan: number): void;
  /** Water pouring from a can, on or off. */
  pour(on: boolean): void;
  dispose(): void;
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
const PENTA = [72, 74, 76, 79, 81, 84];

export function createSound(initial: { sound: boolean; music: boolean; mood: MoodName; beds: readonly SoundBed[] }): Sound {
  let ctx: AudioContext | null = null;
  let master: GainNode;
  let music: GainNode;
  let sfx: GainNode;
  let amb: GainNode;
  let rainG: GainNode;
  let pourG: GainNode | undefined;
  const beds = initial.beds;
  let nextCrack = 0;
  let nextTick = 0;
  let nextClink = 0;
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
  /** A short burst of filtered noise: the body of most small effects. */
  const hit = (c: AudioContext, t: number, dest: AudioNode, type: BiquadFilterType, f: number, q: number, peak: number, dur: number, pan = 0) => {
    const src = c.createBufferSource();
    const b = c.createBiquadFilter();
    const g = c.createGain();
    src.buffer = white;
    b.type = type;
    b.frequency.value = f;
    if (q) b.Q.value = q;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(b);
    b.connect(g);
    panTo(c, g, pan, dest);
    src.start(t, Math.random() * 2, dur + 0.02);
    return b;
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
    const now = c.currentTime;
    // Birds sing in the morning everywhere, and all day (never at night) where the config asks for them.
    const birds = beds.includes("birds");
    if ((birds ? mood !== "night" : mood === "morning") && now > nextBird) {
      bird(c);
      nextBird = now + (birds ? 1.5 + Math.random() * 4 : 2 + Math.random() * 5);
    }
    if (beds.includes("fire") && now > nextCrack) {
      for (let i = 0; i < 1 + Math.random() * 3; i++) hit(c, now + Math.random() * 0.3, amb, "bandpass", 1800 + Math.random() * 2500, 2, 0.05 + Math.random() * 0.08, 0.02 + Math.random() * 0.03, 0.6);
      nextCrack = now + 0.2 + Math.random() * 0.9;
    }
    if (beds.includes("clock") && now > nextTick) {
      const t = Math.ceil(now);
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.value = t % 2 ? 2200 : 1900;
      env(g, t, 0.002, 0.012, 0.04);
      o.connect(g);
      panTo(c, g, -0.3, amb);
      o.start(t);
      o.stop(t + 0.06);
      nextTick = t + 0.5;
    }
    if (beds.includes("cafe") && now > nextClink) {
      const t = now + 0.05;
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.value = 2600 + Math.random() * 900;
      env(g, t, 0.002, 0.03, 0.35);
      o.connect(g);
      panTo(c, g, Math.random() - 0.5, amb);
      o.start(t);
      o.stop(t + 0.4);
      nextClink = now + 4 + Math.random() * 6;
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
      // The wheel bed: a low hum that wobbles, and a little grit.
      if (initial.beds.includes("wheel")) {
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
      }
      const lfo = (param: AudioParam, rate: number, depth: number) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.frequency.value = rate;
        g.gain.value = depth;
        o.connect(g);
        g.connect(param);
        o.start();
      };
      // Wind: a soft band of noise that rises and falls.
      if (beds.includes("wind")) lfo(loopNoise(c, brown, [["bandpass", 520, 0.6]], 0.06, amb, -0.6).gain, 0.07, 0.04);
      // Fire: a low roar. The crackles are scheduled.
      if (beds.includes("fire")) loopNoise(c, brown, [["lowpass", 140]], 0.16, amb, 0.6);
      // Café: a murmur and a little clatter. The clinks are scheduled.
      if (beds.includes("cafe")) {
        lfo(loopNoise(c, brown, [["bandpass", 620, 0.8]], 0.09, amb).gain, 0.23, 0.035);
        lfo(loopNoise(c, white, [["bandpass", 1400, 1.4]], 0.006, amb, 0.3).gain, 0.37, 0.004);
      }
      // Pouring water: silent until a watering can is tipped.
      pourG = loopNoise(c, white, [["bandpass", 1300, 0.7], ["lowpass", 3500]], 0, sfx, 0.45);
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
    dig(pan) {
      const c = ctx;
      if (!c || c.state !== "running") return;
      const t = c.currentTime;
      hit(c, t, sfx, "bandpass", 1500, 0.8, 0.22, 0.16, pan);
      hit(c, t + 0.05, sfx, "lowpass", 900, 0, 0.15, 0.2, pan);
    },
    page(pan) {
      const c = ctx;
      if (!c || c.state !== "running") return;
      const t = c.currentTime;
      const b = hit(c, t, sfx, "bandpass", 5000, 1.2, 0.09, 0.38, pan);
      b.frequency.setValueAtTime(5200, t);
      b.frequency.exponentialRampToValueAtTime(1600, t + 0.35);
    },
    dice(pan) {
      const c = ctx;
      if (!c || c.state !== "running") return;
      const t = c.currentTime;
      [0, 0.07, 0.13, 0.2, 0.27, 0.38, 0.46].forEach((d, i) => hit(c, t + d, sfx, "bandpass", 2600 + Math.random() * 900, 3, 0.28 * Math.pow(0.72, i), 0.02, pan));
    },
    clack(pan) {
      const c = ctx;
      if (!c || c.state !== "running") return;
      const t = c.currentTime;
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.value = 720;
      env(g, t, 0.002, 0.12, 0.09);
      o.connect(g);
      panTo(c, g, pan, sfx);
      o.start(t);
      o.stop(t + 0.12);
      hit(c, t, sfx, "bandpass", 3000, 2, 0.1, 0.02, pan);
    },
    pour(on) {
      if (ctx && pourG) pourG.gain.setTargetAtTime(on ? 0.13 : 0, ctx.currentTime, 0.15);
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
