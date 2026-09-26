/**
 * The streak flame. Its look follows the run of correct answers:
 *
 *    3      the flame lights: fire sweeps up the whole screen for a moment
 *    5-9    it glows
 *   10-14   on fire, with flicker and embers (full-screen fire again at 10)
 *   15      a brighter red
 *   16-24   red turning toward blue
 *   25      a blue flame (full-screen blue fire)
 *   26-39   blue brightening toward gold
 *   40+     golden fire that slowly cycles through every colour
 *   50      full-screen rainbow fire, and again every 25 after that
 *
 * Colour is one hue, --h, passed to CSS; the tier (data-tier) sets how hard
 * it glows, flickers and throws embers. The big moments also get the flame
 * sound; the small ones get a chime only.
 */

import { el } from './dom.js';
import { reduced, pop, EASE, SPRING } from './motion.js';
import { play } from './sound.js';

const NS = 'http://www.w3.org/2000/svg';

export function flameHue(n) {
  if (n >= 40) return 45;                                        // gold (then cycles, in CSS)
  if (n >= 25) return Math.round(215 - ((n - 25) / 15) * 170);   // blue -> cyan -> green -> gold
  if (n > 15) return Math.round(358 - ((n - 15) / 10) * 143);    // red -> magenta -> blue
  if (n === 15) return 358;
  if (n >= 10) return 18;
  if (n >= 5) return 30;
  return 40;
}

export function flameTier(n) {
  if (n >= 50) return 'rainbow';
  if (n >= 40) return 'gold';
  if (n > 25) return 'aurora';
  if (n === 25) return 'blue';
  if (n > 15) return 'shift';
  if (n === 15) return 'red';
  if (n >= 10) return 'fire';
  if (n >= 5) return 'glow';
  return 'spark';
}

/** What happens when the streak reaches n: null, or { sound, big, ... }. */
export function streakMoment(n) {
  if (n === 3) return { big: true, sound: 'blaze', title: 'Streak lit', power: 0.85 };
  if (n === 10) return { big: true, sound: 'inferno', title: 'On fire', power: 1 };
  if (n === 25) return { big: true, sound: 'blueInferno', title: 'Blue flame', power: 1.15 };
  if (n >= 50 && n % 25 === 0) {
    return { big: true, sound: 'mythic', title: n === 50 ? 'Legendary' : 'Unstoppable', power: 1.3, rainbow: true };
  }
  if (n === 5) return { sound: 'glowUp' };
  if (n === 15) return { sound: 'flare' };
  if (n === 40) return { sound: 'goldFlare' };
  return null;
}

function flameSvg() {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'flame-svg');
  svg.setAttribute('aria-hidden', 'true');
  const outer = document.createElementNS(NS, 'path');
  outer.setAttribute('class', 'flame-outer');
  outer.setAttribute('d', 'M12 2.2c.6 3.3 4.9 5.4 6.2 9.4 1.5 4.7-1.7 10.2-6.3 10.2S4.2 18.5 5.5 14c.6-2.2 2.3-3.4 2.6-5.6.9 1.2 1.3 2.5 1.2 3.9 1.6-2.3 3.4-5.8 2.7-10.1z');
  const inner = document.createElementNS(NS, 'path');
  inner.setAttribute('class', 'flame-inner');
  inner.setAttribute('d', 'M12.2 11.2c.4 2 2.9 3.2 3 5.6.1 2.3-1.6 4-3.3 4s-3.5-1.4-3.3-3.6c.1-1.4 1.1-2.2 1.4-3.5.6.6.9 1.4.8 2.2 1-1.3 1.9-3 1.4-4.7z');
  svg.append(outer, inner);
  return svg;
}

function paint(node, n) {
  node.style.setProperty('--h', String(flameHue(n)));
  node.dataset.tier = flameTier(n);
}

/** A flame chip: flame + "n in a row" (or just the number, compact). */
export function flameChip(n, { compact = false } = {}) {
  const num = el('span', { class: 'flame-n', text: String(n) });
  const chip = el('span', {
    class: `flame-chip${compact ? ' is-compact' : ''}`,
    title: `${n} correct in a row`,
    'aria-label': `${n} correct in a row`,
  }, [el('span', { class: 'flame-ic' }, [flameSvg(), el('span', { class: 'flame-embers', 'aria-hidden': 'true' })]),
    num, compact ? null : el('span', { class: 'flame-l', text: ' in a row' })]);
  paint(chip, n);
  return chip;
}

/** Rising embers from a point, in the flame's colour. */
export function embers(origin, hue, { count = 16, rainbow = false } = {}) {
  if (!origin || reduced()) return;
  const r = origin.getBoundingClientRect();
  const layer = el('div', { class: 'fx-layer', 'aria-hidden': 'true' });
  document.body.append(layer);
  let left = count;
  for (let i = 0; i < count; i += 1) {
    const h = rainbow ? Math.random() * 360 : hue + (Math.random() - 0.5) * 24;
    const size = 3 + Math.random() * 5;
    const p = el('span', { class: 'fx-ember' });
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${r.left + r.width / 2 + (Math.random() - 0.5) * r.width * 0.8}px`;
    p.style.top = `${r.top + r.height * 0.55}px`;
    p.style.background = `hsl(${h} 100% ${55 + Math.random() * 20}%)`;
    p.style.boxShadow = `0 0 ${6 + size}px hsl(${h} 100% 60% / .9)`;
    layer.append(p);
    const dx = (Math.random() - 0.5) * 70;
    const dy = -(60 + Math.random() * 90);
    const a = p.animate([
      { transform: 'translate(-50%, 0) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx * 0.5}px), ${dy * 0.55}px) scale(.9)`, opacity: 0.9, offset: 0.5 },
      { transform: `translate(calc(-50% + ${dx}px), ${dy}px) scale(.2)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 700, delay: Math.random() * 180, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'both' });
    const done = () => { left -= 1; if (!left) layer.remove(); };
    a.finished.then(done, done);
  }
}

/* ------------------------------------------------------------------ */
/* Full-screen fire                                                     */
/* ------------------------------------------------------------------ */

function sprite(h, s, l, size = 96) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, `hsla(${h}, ${s}%, ${l}%, 1)`);
  grd.addColorStop(0.35, `hsla(${h}, ${s}%, ${Math.round(l * 0.85)}%, .6)`);
  grd.addColorStop(1, `hsla(${h}, ${s}%, ${Math.round(l * 0.5)}%, 0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}

/**
 * A wall of fire rises from the bottom of the screen and burns out in about
 * a second, with the streak count flaring in the middle. Drawn on a canvas
 * with additive blending; never takes pointer input.
 */
export function fireStorm(n, { hue = flameHue(n), rainbow = false, power = 1, title = '' } = {}) {
  const label = el('div', { class: `fx-fire-label${rainbow ? ' is-rainbow' : ''}`, 'aria-hidden': 'true' }, [
    el('span', { class: 'fx-fire-flame' }, [flameSvg()]),
    el('span', { class: 'fx-fire-n', text: String(n) }),
    el('span', { class: 'fx-fire-t', text: title ? `${title} · ${n} in a row` : `${n} in a row` }),
  ]);
  label.style.setProperty('--h', String(hue));
  document.body.append(label);

  if (reduced()) {
    setTimeout(() => label.remove(), 1500);
    return;
  }

  label.animate([
    { opacity: 0, transform: 'translate(-50%, -50%) scale(.35)' },
    { opacity: 1, transform: 'translate(-50%, -50%) scale(1.12)', offset: 0.22 },
    { opacity: 1, transform: 'translate(-50%, -50%) scale(1)', offset: 0.36 },
    { opacity: 1, transform: 'translate(-50%, -52%) scale(1.02)', offset: 0.72 },
    { opacity: 0, transform: 'translate(-50%, -62%) scale(1.12)' },
  ], { duration: 1500 + power * 150, easing: EASE, fill: 'forwards' }).finished.then(() => label.remove(), () => label.remove());

  const W = window.innerWidth;
  const H = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
  const canvas = document.createElement('canvas');
  canvas.className = 'fx-fire';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  document.body.insertBefore(canvas, label);

  const hues = rainbow ? [0, 28, 48, 120, 180, 215, 270, 320] : [hue];
  const cool = (h) => h > 150 && h < 300;
  // Each flame is drawn from three sprites: a near-white core while it is
  // young and hot, then its own colour, then a darker tail as it dies.
  const sets = hues.map((h) => [sprite(h + (cool(h) ? -18 : 26), 100, 90), sprite(h, 100, 58), sprite(h - 12, 95, 40)]);
  const scale = Math.sqrt((W * H) / (1440 * 900));
  const EMIT = 0.42 + 0.22 * power;
  const END = EMIT + 1.1;
  const rate = 420 * power * Math.max(0.55, W / 1440);
  const parts = [];
  // The room darkens for a moment so the fire glows, on a light page too.
  const wash = rainbow ? '16, 6, 26' : cool(hue) ? '2, 8, 24' : '20, 8, 2';

  const spawn = () => {
    const spark = Math.random() < 0.12;
    return {
      spark,
      x: Math.random() * W,
      y: H + (spark ? 0 : 40 * scale),
      vx: (Math.random() - 0.5) * (spark ? 140 : 50),
      vy: -(H * (spark ? 1.3 + Math.random() * 0.9 : 0.75 + Math.random() * 0.8)),
      r: spark ? (3 + Math.random() * 4) * Math.max(1, scale) : (70 + Math.random() * 110) * scale,
      life: spark ? 0.8 + Math.random() * 0.7 : 0.5 + Math.random() * 0.55,
      age: 0,
      wob: 4 + Math.random() * 5,
      ph: Math.random() * 6.28,
      set: sets[Math.floor(Math.random() * sets.length)],
    };
  };

  // A short, heavy shake for the bigger moments.
  if (power >= 1.1) {
    document.getElementById('view')?.animate([
      { transform: 'translate(0, 0)' }, { transform: 'translate(-4px, 2px)' }, { transform: 'translate(4px, -2px)' },
      { transform: 'translate(-3px, -1px)' }, { transform: 'translate(2px, 1px)' }, { transform: 'translate(0, 0)' },
    ], { duration: 420, easing: 'ease-out' });
  }

  const t0 = performance.now();
  let last = t0;
  let carry = 0;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (now - t0) / 1000;
    const env = t < 0.16 ? t / 0.16 : Math.max(0, 1 - (t - EMIT) / (END - EMIT));

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = `rgba(${wash}, ${0.58 * env})`;
    ctx.fillRect(0, 0, W, H);
    // The flash as it catches.
    if (t < 0.2) {
      ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${((0.2 - t) / 0.2) * 0.22})`;
      ctx.fillRect(0, 0, W, H);
    }
    // Heat glow climbing from the bottom edge.
    const top = H * (1 - 0.85 * Math.min(1, t / 0.32));
    const gh = rainbow ? (t * 300) % 360 : hue;
    const g = ctx.createLinearGradient(0, H, 0, top);
    g.addColorStop(0, `hsla(${gh}, 100%, 55%, ${0.62 * env})`);
    g.addColorStop(0.45, `hsla(${gh}, 100%, 45%, ${0.22 * env})`);
    g.addColorStop(1, `hsla(${gh}, 100%, 45%, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, H - top);

    if (t < EMIT) {
      carry += rate * dt;
      while (carry >= 1) { carry -= 1; parts.push(spawn()); }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const p = parts[i];
      p.age += dt;
      if (p.age >= p.life) { parts.splice(i, 1); continue; }
      const f = p.age / p.life;
      p.vy *= 0.99;
      // Flames sway more the higher they climb.
      p.x += (p.vx + Math.sin(p.age * p.wob + p.ph) * 70 * f) * dt;
      p.y += p.vy * dt;
      if (p.spark) {
        const s = p.r * 4;
        ctx.globalAlpha = (1 - f) * 0.95;
        ctx.drawImage(p.set[0], p.x - s / 2, p.y - s / 2, s, s);
        continue;
      }
      // A tongue of flame: tall and narrow, shrinking as it rises.
      const img = p.set[f < 0.3 ? 0 : f < 0.65 ? 1 : 2];
      const size = p.r * (1.05 - f * 0.7);
      const w = size * 0.8;
      const h = size * 1.35;
      ctx.globalAlpha = Math.pow(1 - f, 1.15) * 0.9;
      ctx.drawImage(img, p.x - w / 2, p.y - h * 0.6, w, h);
    }
    if (t < END) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

/**
 * Called when a correct answer brings the streak to n. Plays the moment for
 * that streak (see streakMoment), otherwise a small pop. Returns the sound it
 * played, so the caller skips the ordinary correct chime.
 */
export function celebrate(chip, n) {
  if (!chip) return null;
  const m = streakMoment(n);
  if (!m) {
    pop(chip, { scale: 1.2, duration: 560 });
    return null;
  }
  const hue = flameHue(n);
  play(m.sound);
  if (!reduced()) {
    const ic = chip.querySelector('.flame-ic');
    ic.animate([
      { transform: 'scale(1)', filter: 'brightness(1)' },
      { transform: 'scale(2.1) translateY(-3px)', filter: 'brightness(1.6)', offset: 0.35 },
      { transform: 'scale(1)', filter: 'brightness(1)' },
    ], { duration: 900, easing: EASE });
    chip.animate([
      { boxShadow: `0 0 0 0 hsl(${hue} 100% 55% / .7)` },
      { boxShadow: `0 0 0 18px hsl(${hue} 100% 55% / 0)` },
    ], { duration: 900, easing: 'ease-out' });
    embers(ic, hue, { count: m.big ? 26 : 14, rainbow: m.rainbow });
  }
  if (m.big) fireStorm(n, { hue, rainbow: m.rainbow, power: m.power, title: m.title });
  return m.sound;
}

/** The flame goes out: it greys, shrinks and trails smoke. */
export function extinguish(chip) {
  if (!chip) return;
  chip.classList.add('is-out');
  if (reduced()) { chip.style.visibility = 'hidden'; return; }
  const ic = chip.querySelector('.flame-ic');
  const r = ic.getBoundingClientRect();
  const layer = el('div', { class: 'fx-layer', 'aria-hidden': 'true' });
  document.body.append(layer);
  for (let i = 0; i < 9; i += 1) {
    const s = 8 + Math.random() * 10;
    const puff = el('span', { class: 'fx-smoke' });
    puff.style.width = `${s}px`;
    puff.style.height = `${s}px`;
    puff.style.left = `${r.left + r.width / 2}px`;
    puff.style.top = `${r.top + r.height * 0.3}px`;
    layer.append(puff);
    puff.animate([
      { transform: 'translate(-50%, 0) scale(.4)', opacity: 0.7 },
      { transform: `translate(calc(-50% + ${(Math.random() - 0.5) * 40}px), ${-(30 + Math.random() * 40)}px) scale(${1.4 + Math.random()})`, opacity: 0 },
    ], { duration: 900 + Math.random() * 500, delay: 150 + i * 40, easing: 'ease-out', fill: 'both' });
  }
  setTimeout(() => layer.remove(), 2000);
  chip.animate([
    { filter: 'grayscale(0) brightness(1)', transform: 'scale(1)', opacity: 1 },
    { filter: 'grayscale(1) brightness(.8)', transform: 'scale(.92)', opacity: 1, offset: 0.35 },
    { filter: 'grayscale(1) brightness(.7)', transform: 'scale(.6)', opacity: 0 },
  ], { duration: 1100, delay: 120, easing: EASE, fill: 'forwards' });
}

export { SPRING };
