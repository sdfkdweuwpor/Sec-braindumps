/**
 * The streak flame. Its look follows the run of correct answers:
 *
 *    3-4   a small amber flame
 *    5-9   the flame glows (it lights at 5)
 *   10-14  it catches fire: flicker and rising embers (it flares at 10)
 *   15     it glows again, a brighter red (it flares at 15)
 *   16-24  it slowly turns from red towards blue
 *   25+    a blue flame (it flares again at 25)
 *
 * Colour is one hue, --h, passed to CSS; the tier sets how much it glows,
 * flickers and throws embers.
 */

import { el } from './dom.js';
import { reduced, pop, EASE } from './motion.js';
import { play } from './sound.js';

const NS = 'http://www.w3.org/2000/svg';

export function flameHue(n) {
  if (n >= 25) return 215;
  if (n > 15) return Math.round(358 - ((n - 15) / 10) * 143);   // red -> magenta -> blue
  if (n === 15) return 358;
  if (n >= 10) return 18;
  if (n >= 5) return 30;
  return 40;
}

export function flameTier(n) {
  if (n >= 25) return 'blue';
  if (n > 15) return 'shift';
  if (n === 15) return 'red';
  if (n >= 10) return 'fire';
  if (n >= 5) return 'glow';
  return 'spark';
}

/** The streak where something happens: [sound, flare]. */
const MOMENTS = { 5: 'glow', 10: 'ignite', 15: 'ignite', 25: 'blueFire' };

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
export function embers(origin, hue, { count = 16 } = {}) {
  if (!origin || reduced()) return;
  const r = origin.getBoundingClientRect();
  const layer = el('div', { class: 'fx-layer', 'aria-hidden': 'true' });
  document.body.append(layer);
  let left = count;
  for (let i = 0; i < count; i += 1) {
    const size = 3 + Math.random() * 5;
    const p = el('span', { class: 'fx-ember' });
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.left = `${r.left + r.width / 2 + (Math.random() - 0.5) * r.width * 0.8}px`;
    p.style.top = `${r.top + r.height * 0.55}px`;
    p.style.background = `hsl(${hue + (Math.random() - 0.5) * 24} 100% ${55 + Math.random() * 20}%)`;
    p.style.boxShadow = `0 0 ${6 + size}px hsl(${hue} 100% 60% / .9)`;
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

/**
 * Called when a correct answer brings the streak to n. Plays the moment for
 * 5, 10, 15 and 25; otherwise a small pop. Returns the sound name played,
 * so the caller does not also play the ordinary correct chime.
 */
export function celebrate(chip, n) {
  if (!chip) return null;
  const moment = MOMENTS[n];
  if (!moment) {
    pop(chip, { scale: 1.2, duration: 560 });
    return null;
  }
  const hue = flameHue(n);
  play(moment);
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
    embers(ic, hue, { count: moment === 'glow' ? 10 : 22 });
  }
  return moment;
}
