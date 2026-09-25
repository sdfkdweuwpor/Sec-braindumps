/**
 * Sound effects, synthesised with the Web Audio API: no audio files, no
 * network. Each effect is a few short sine or triangle notes with a soft
 * attack and decay, through one master gain and a gentle low-pass so nothing
 * is shrill.
 *
 * Browsers only start audio after the viewer interacts, so the context is
 * created or resumed on the first tap or key press (see unlock). On by
 * default; the speaker button in the top bar turns it off.
 */

import * as store from './store.js';

let ctx = null;
let out = null;

function audio() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    ctx = new AC();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5200;
    out = ctx.createGain();
    out.gain.value = 0.9;
    out.connect(lp).connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

export function enabled() {
  return store.getSettings().sound !== false;
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

// Note frequencies (Hz).
const C5 = 523.25, E5 = 659.25, G5 = 783.99, A5 = 880,
  C6 = 1046.5, E6 = 1318.5, G6 = 1568, C7 = 2093;

const EFFECTS = {
  // A light tap: picking an answer when the result is not shown yet.
  select: (c) => note(c, { freq: 1250, dur: 0.05, type: 'triangle', gain: 0.05, glide: 0.7, partial: 0 }),
  // Rising major third.
  correct: (c) => {
    note(c, { freq: C6, dur: 0.32, gain: 0.12 });
    note(c, { freq: E6, at: 0.085, dur: 0.42, gain: 0.12 });
  },
  // Two soft, low, falling notes. Clear, not harsh.
  wrong: (c) => {
    note(c, { freq: 311, dur: 0.2, type: 'triangle', gain: 0.13, partial: 0 });
    note(c, { freq: 233, at: 0.13, dur: 0.3, type: 'triangle', gain: 0.13, glide: 0.94, partial: 0 });
  },
  // Three in a row and more: a quick arpeggio.
  streak: (c) => {
    [C6, E6, G6].forEach((f, i) => note(c, { freq: f, at: i * 0.07, dur: 0.34, gain: 0.11 }));
    note(c, { freq: C7, at: 0.21, dur: 0.5, gain: 0.07 });
  },
  // A question leaves Smart review: arpeggio with a shimmering top note.
  mastered: (c) => {
    [C6, E6, G6, C7].forEach((f, i) => note(c, { freq: f, at: i * 0.075, dur: 0.4, gain: 0.11 }));
    [0, 0.09, 0.18].forEach((d) => note(c, { freq: C7 * 1.5, at: 0.34 + d, dur: 0.18, gain: 0.03, partial: 0 }));
  },
  // Passing score on the results screen.
  finish: (c) => {
    [G5, C6, E6].forEach((f, i) => note(c, { freq: f, at: i * 0.1, dur: 0.3, gain: 0.11 }));
    [C6, E6, G6].forEach((f) => note(c, { freq: f, at: 0.32, dur: 0.9, gain: 0.07 }));
  },
  // Quiz done, below the line: a calm, neutral chord.
  done: (c) => {
    [C5, G5].forEach((f) => note(c, { freq: f, dur: 0.7, gain: 0.08 }));
  },
  flag: (c) => note(c, { freq: A5, dur: 0.12, type: 'triangle', gain: 0.07, glide: 1.5, partial: 0 }),
  // Sounds switched back on.
  on: (c) => {
    note(c, { freq: E5, dur: 0.18, gain: 0.08 });
    note(c, { freq: A5, at: 0.07, dur: 0.26, gain: 0.08 });
  },
};

/** Play a named effect. Silent when sounds are off or audio is unavailable. */
export function play(name) {
  if (!enabled()) return;
  const c = audio();
  const fx = EFFECTS[name];
  if (!c || !fx) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  try { fx(c); } catch { /* a failed sound must never break the quiz */ }
}
