/**
 * Sound effects, synthesized with the Web Audio API: no audio files, no
 * network. Each effect is a few short sine or triangle notes with a soft
 * attack and decay, through one master gain, a compressor and a gentle
 * low-pass so they are clearly audible without being shrill. Notes stay above
 * about 300 Hz because laptop and phone speakers barely play anything lower.
 *
 * Browsers only start audio after the viewer interacts, so the context is
 * created or resumed on the first tap or key press (see unlock). On by
 * default; the speaker button in the top bar turns it off.
 */

import * as store from './store.js';
import { forSound } from './haptics.js';

let ctx = null;
let out = null;

function audio() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    ctx = new AC();
    // Loud but never clipped: a compressor catches the peaks when notes of
    // a chord overlap, then a gentle low-pass takes the edge off.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -8;
    comp.knee.value = 6;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 6500;
    out = ctx.createGain();
    out.gain.value = 1.6;
    out.connect(comp).connect(lp).connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

export function enabled() {
  return store.getSettings().sound !== false;
}

// Audio cannot start before the page has had a tap or key press; trying
// only earns a console warning (the Study card's hops can run on load).
function activated() {
  try { return typeof navigator === 'undefined' || !navigator.userActivation || navigator.userActivation.hasBeenActive; } catch { return true; }
}

/** Call from a user gesture. Creates or wakes the audio context. */
export function unlock() {
  if (!enabled()) return;
  const c = audio();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

/** One note: a fundamental plus a quiet octave partial for a bell-like tone. */
function note(c, { freq, at = 0, dur = 0.3, type = 'sine', gain = 0.14, glide = null, partial = 0.22 }) {
  const t0 = c.currentTime + 0.01 + at;
  const voices = partial ? [[freq, gain, type], [freq * 2, gain * partial, 'sine']] : [[freq, gain, type]];
  for (const [f, g, t] of voices) {
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = t;
    osc.frequency.setValueAtTime(f, t0);
    if (glide) osc.frequency.exponentialRampToValueAtTime(f * glide, t0 + dur);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(g, t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(env).connect(out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }
}

// White and brown noise, made once per audio context and shared by every
// effect that needs air, hiss or fire.
let noiseFor = null;
let noiseBufs = null;
function noises(c) {
  if (noiseFor === c) return noiseBufs;
  const len = Math.ceil(c.sampleRate * 2);
  const white = c.createBuffer(1, len, c.sampleRate);
  const brown = c.createBuffer(1, len, c.sampleRate);
  const w = white.getChannelData(0);
  const b = brown.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i += 1) {
    const x = Math.random() * 2 - 1;
    w[i] = x;
    last = (last + 0.02 * x) / 1.02;
    b[i] = last * 3.5;
  }
  noiseFor = c;
  noiseBufs = { white, brown };
  return noiseBufs;
}

/** Filtered noise that sweeps from one pitch to another: air, a rush, a hiss. */
function whoosh(c, { at = 0, dur = 0.6, from = 400, to = 3200, gain = 0.3, peakAt = 0.35, q = 0.9 } = {}) {
  const t0 = c.currentTime + 0.01 + at;
  const src = c.createBufferSource();
  src.buffer = noises(c).white;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = q;
  bp.frequency.setValueAtTime(from, t0);
  bp.frequency.exponentialRampToValueAtTime(to, t0 + dur * 0.8);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + Math.max(0.01, dur * peakAt));
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp).connect(env).connect(out);
  src.start(t0, Math.random() * 1.2);
  src.stop(t0 + dur + 0.05);
}

/**
 * The roar of a fire: brown noise for the body and white noise for the
 * hiss, through a low-pass that opens as the flame catches and closes as
 * it dies down, with a quick flutter so it breathes rather than drones.
 */
function roar(c, { at = 0, dur = 1.2, from = 300, peak = 2600, to = 500, gain = 0.5, attack = 0.07 } = {}) {
  const t0 = c.currentTime + 0.01 + at;
  const { white, brown } = noises(c);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.8;
  lp.frequency.setValueAtTime(from, t0);
  lp.frequency.exponentialRampToValueAtTime(peak, t0 + dur * 0.22);
  lp.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const flutter = c.createGain();
  flutter.gain.value = 0.78;
  const lfo = c.createOscillator();
  lfo.frequency.value = 7 + Math.random() * 4;
  const depth = c.createGain();
  depth.gain.value = 0.22;
  lfo.connect(depth).connect(flutter.gain);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  env.gain.exponentialRampToValueAtTime(gain * 0.55, t0 + dur * 0.45);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  lp.connect(flutter).connect(env).connect(out);
  for (const [buf, level] of [[brown, 1], [white, 0.5]]) {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = c.createGain();
    g.gain.value = level;
    src.connect(g).connect(lp);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + dur + 0.05);
  }
  lfo.start(t0);
  lfo.stop(t0 + dur + 0.05);
}

/** Crackle: a scatter of tiny, bright noise clicks, like wood popping in a fire. */
function crackle(c, { at = 0, dur = 1, count = 20, gain = 0.32 } = {}) {
  const { white } = noises(c);
  for (let i = 0; i < count; i += 1) {
    const t = c.currentTime + 0.01 + at + Math.random() * dur;
    const len = 0.004 + Math.random() * 0.02;
    const src = c.createBufferSource();
    src.buffer = white;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400 + Math.random() * 3600;
    bp.Q.value = 1.4;
    const g = c.createGain();
    // Louder near the start, the way a fire pops hardest as it catches.
    const peakGain = gain * (0.35 + Math.random() * 0.65) * (1 - 0.5 * ((t - c.currentTime) / (dur + at + 0.01)));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, peakGain), t + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(bp).connect(g).connect(out);
    src.start(t, Math.random() * 1.8);
    src.stop(t + len + 0.01);
  }
}

/** A low thud with an octave on top, so small speakers still hear it. */
function thump(c, { at = 0, freq = 150, gain = 0.45 } = {}) {
  note(c, { freq, at, dur: 0.42, gain, glide: 0.4, partial: 0.6 });
}

/** A few quick, very high twinkles. */
function sparkle(c, { at = 0, count = 6, gain = 0.05 } = {}) {
  for (let i = 0; i < count; i += 1) {
    note(c, { freq: 2600 + Math.random() * 1900, at: at + i * 0.055 + Math.random() * 0.03, dur: 0.14, gain, partial: 0 });
  }
}

// Note frequencies (Hz).
const E5 = 659.25, G5 = 783.99, A5 = 880,
  C6 = 1046.5, D6 = 1174.66, E6 = 1318.5, G6 = 1568, A6 = 1760, B6 = 1975.5,
  C7 = 2093, E7 = 2637;
const C5 = 523.25, GS6 = 1661.2;

const EFFECTS = {
  // A light tap: picking an answer when the result is not shown yet.
  select: (c) => note(c, { freq: 1250, dur: 0.06, type: 'triangle', gain: 0.16, glide: 0.7, partial: 0 }),
  // Rising major third.
  correct: (c) => {
    note(c, { freq: C6, dur: 0.34, gain: 0.3 });
    note(c, { freq: E6, at: 0.085, dur: 0.46, gain: 0.3 });
  },
  // Two falling notes with a buzzy edge: clear on small speakers, not harsh.
  wrong: (c) => {
    note(c, { freq: 392, dur: 0.2, type: 'triangle', gain: 0.34, partial: 0.3 });
    note(c, { freq: 294, at: 0.13, dur: 0.34, type: 'triangle', gain: 0.34, glide: 0.94, partial: 0.3 });
  },
  // Every fifth answer in a run that has no moment of its own: a quick arpeggio.
  streak: (c) => {
    [C6, E6, G6].forEach((f, i) => note(c, { freq: f, at: i * 0.07, dur: 0.36, gain: 0.26 }));
    note(c, { freq: C7, at: 0.21, dur: 0.55, gain: 0.17 });
  },

  /* ---- the big streak moments: these are the only sounds with fire in them ---- */

  // 3 in a row: the flame lights. A whoomp as it catches, a short roar with
  // crackle, and a bright rising arpeggio.
  blaze: (c) => {
    whoosh(c, { dur: 0.45, from: 250, to: 2800, gain: 0.3 });
    roar(c, { at: 0.04, dur: 1.0, from: 350, peak: 2600, to: 600, gain: 0.46 });
    crackle(c, { at: 0.1, dur: 0.9, count: 18, gain: 0.3 });
    [C6, E6, G6].forEach((f, i) => note(c, { freq: f, at: 0.14 + i * 0.07, dur: 0.42, gain: 0.2 }));
  },
  // 10: on fire. A bigger, longer roar with a thud underneath.
  inferno: (c) => {
    thump(c, { gain: 0.5 });
    whoosh(c, { dur: 0.55, from: 200, to: 3200, gain: 0.34 });
    roar(c, { at: 0.04, dur: 1.4, from: 300, peak: 3000, to: 500, gain: 0.56 });
    crackle(c, { at: 0.08, dur: 1.3, count: 32, gain: 0.34 });
    [C6, E6, G6, C7].forEach((f, i) => note(c, { freq: f, at: 0.16 + i * 0.065, dur: 0.48, gain: 0.2 }));
  },
  // 25: blue fire. Hotter and brighter: the roar opens further and a
  // shimmer rides on top.
  blueInferno: (c) => {
    thump(c, { freq: 165, gain: 0.5 });
    whoosh(c, { dur: 0.6, from: 500, to: 5200, gain: 0.34 });
    roar(c, { at: 0.04, dur: 1.5, from: 500, peak: 4200, to: 800, gain: 0.54 });
    crackle(c, { at: 0.08, dur: 1.35, count: 36, gain: 0.3 });
    [E6, GS6, B6, E7].forEach((f, i) => note(c, { freq: f, at: 0.18 + i * 0.065, dur: 0.52, gain: 0.2 }));
    sparkle(c, { at: 0.5, count: 7 });
  },
  // 50, 75, 100...: rainbow fire. The longest roar, a sweep up through the
  // scale and a ringing chord.
  mythic: (c) => {
    thump(c, { freq: 175, gain: 0.55 });
    whoosh(c, { dur: 0.7, from: 300, to: 5600, gain: 0.36 });
    roar(c, { at: 0.04, dur: 1.75, from: 400, peak: 4000, to: 700, gain: 0.56 });
    crackle(c, { at: 0.08, dur: 1.6, count: 46, gain: 0.3 });
    [C6, D6, E6, G6, A6, C7, E7].forEach((f, i) => note(c, { freq: f, at: 0.14 + i * 0.05, dur: 0.34, gain: 0.17 }));
    [C6, E6, G6, C7].forEach((f) => note(c, { freq: f, at: 0.52, dur: 1.2, gain: 0.13 }));
    sparkle(c, { at: 0.6, count: 10 });
  },

  /* ---- the small streak moments: chimes only ---- */

  // 5 in a row: the flame starts to glow.
  glowUp: (c) => {
    [G5, C6, E6, G6].forEach((f, i) => note(c, { freq: f, at: i * 0.06, dur: 0.4, gain: 0.22 }));
  },
  // 15: it flares a brighter red.
  flare: (c) => {
    [C6, E6, G6].forEach((f, i) => note(c, { freq: f, at: i * 0.055, dur: 0.36, gain: 0.24 }));
    note(c, { freq: C7, at: 0.17, dur: 0.75, gain: 0.2, glide: 1.03 });
  },
  // 40: the flame turns gold. A bright bell chord with a twinkle.
  goldFlare: (c) => {
    [C6, E6, G6, C7, E7].forEach((f, i) => note(c, { freq: f, at: i * 0.06, dur: 0.55, gain: 0.2 }));
    sparkle(c, { at: 0.32, count: 5 });
  },
  // A run of 3 or more ends: the flame hisses out.
  fizzle: (c) => {
    whoosh(c, { dur: 0.6, from: 5200, to: 900, gain: 0.15, peakAt: 0.06, q: 0.7 });
    note(c, { freq: C5, dur: 0.42, type: 'triangle', gain: 0.1, glide: 0.62, partial: 0 });
  },

  /* ---- moving around ---- */

  // Next or previous question: a soft rush of air.
  swoosh: (c) => whoosh(c, { dur: 0.22, from: 700, to: 2400, gain: 0.07, peakAt: 0.3, q: 0.6 }),
  // Explanation opened / closed.
  open: (c) => {
    note(c, { freq: G5, dur: 0.12, gain: 0.13, partial: 0 });
    note(c, { freq: C6, at: 0.06, dur: 0.2, gain: 0.13, partial: 0 });
  },
  close: (c) => {
    note(c, { freq: C6, dur: 0.1, gain: 0.1, partial: 0 });
    note(c, { freq: G5, at: 0.05, dur: 0.16, gain: 0.1, partial: 0 });
  },
  // Acronyms shown or hidden.
  tick: (c) => note(c, { freq: 1700, dur: 0.045, type: 'triangle', gain: 0.12, glide: 1.2, partial: 0 }),
  // Switching tabs in the side bar.
  tab: (c) => note(c, { freq: 880, dur: 0.08, type: 'triangle', gain: 0.11, glide: 1.25, partial: 0 }),
  // A quiz begins.
  start: (c) => {
    [E5, A5, E6].forEach((f, i) => note(c, { freq: f, at: i * 0.08, dur: 0.32, gain: 0.2 }));
  },

  // A question leaves Smart review: arpeggio with a shimmering top note.
  mastered: (c) => {
    [C6, E6, G6, C7].forEach((f, i) => note(c, { freq: f, at: i * 0.075, dur: 0.42, gain: 0.26 }));
    [0, 0.09, 0.18].forEach((d) => note(c, { freq: C7 * 1.5, at: 0.34 + d, dur: 0.2, gain: 0.08, partial: 0 }));
  },
  // Passing score on the results screen.
  finish: (c) => {
    [G5, C6, E6].forEach((f, i) => note(c, { freq: f, at: i * 0.1, dur: 0.32, gain: 0.26 }));
    [C6, E6, G6].forEach((f) => note(c, { freq: f, at: 0.32, dur: 0.95, gain: 0.16 }));
  },
  // Quiz done, below the line: a calm, neutral chord.
  done: (c) => {
    [C5, G5].forEach((f) => note(c, { freq: f, dur: 0.75, gain: 0.2 }));
  },
  // A new level: a rising fanfare that lands on a bright, ringing chord.
  levelUp: (c) => {
    [C5, E5, G5, C6, E6].forEach((f, i) => note(c, { freq: f, at: i * 0.075, dur: 0.26, gain: 0.2 }));
    [C6, E6, G6, C7].forEach((f) => note(c, { freq: f, at: 0.4, dur: 1.3, gain: 0.14 }));
    note(c, { freq: E7, at: 0.52, dur: 0.9, gain: 0.07, partial: 0 });
    sparkle(c, { at: 0.45, count: 8 });
  },
  // A milestone banner.
  milestone: (c) => {
    [C5, E5, G5, C6].forEach((f, i) => note(c, { freq: f, at: i * 0.09, dur: 0.3, gain: 0.22 }));
    [C6, E6, G6].forEach((f) => note(c, { freq: f, at: 0.38, dur: 1.1, gain: 0.13 }));
  },
  flag: (c) => note(c, { freq: A5, dur: 0.14, type: 'triangle', gain: 0.18, glide: 1.5, partial: 0 }),
  // Sounds switched back on.
  on: (c) => {
    note(c, { freq: E5, dur: 0.2, gain: 0.2 });
    note(c, { freq: A5, at: 0.07, dur: 0.28, gain: 0.2 });
  },
};

/** The names play() accepts. */
export const SOUNDS = Object.keys(EFFECTS);

/**
 * Play a named effect. Silent when sounds are off or audio is unavailable.
 * The matching buzz (js/haptics.js) goes either way: it has its own switch.
 */
export function play(name) {
  forSound(name);
  if (!enabled() || !activated()) return;
  const c = audio();
  const fx = EFFECTS[name];
  if (!c || !fx) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  try { fx(c); } catch { /* a failed sound must never break the quiz */ }
}
