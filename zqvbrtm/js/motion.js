/**
 * Motion helpers. Everything here uses the Web Animations API so an effect
 * can be started from code at the exact moment it means something (an answer
 * revealed, a score shown) instead of whenever a class happens to change.
 *
 * Every helper is a no-op when the viewer asks for reduced motion, and the
 * element is always left in its final, fully visible state.
 */

export const EASE = 'cubic-bezier(.2, .7, .2, 1)';
export const SPRING = 'cubic-bezier(.34, 1.56, .64, 1)';

export function reduced() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

function run(elm, frames, opts) {
  if (!elm || reduced() || typeof elm.animate !== 'function') return null;
  try { return elm.animate(frames, opts); } catch { return null; }
}

/** Slide a block in from one side: dir 1 = came from the right, -1 = left. */
export function slideIn(elm, dir = 1) {
  return run(elm, [
    { opacity: 0, transform: `translateX(${dir * 34}px)` },
    { opacity: 1, transform: 'none' },
  ], { duration: 380, easing: EASE });
}

/** Rise and fade in, optionally after a delay. */
export function rise(elm, { delay = 0, distance = 12, duration = 420 } = {}) {
  return run(elm, [
    { opacity: 0, transform: `translateY(${distance}px)` },
    { opacity: 1, transform: 'none' },
  ], { duration, delay, easing: EASE, fill: 'backwards' });
}

/** Cascade a list of elements in, one after another. */
export function cascade(elms, { step = 55, start = 60, distance = 14 } = {}) {
  [...elms].forEach((elm, i) => rise(elm, { delay: start + i * step, distance }));
}

/** A springy scale pop. */
export function pop(elm, { scale = 1.06, duration = 460 } = {}) {
  return run(elm, [
    { transform: 'scale(1)' },
    { transform: `scale(${scale})`, offset: 0.35 },
    { transform: 'scale(1)' },
  ], { duration, easing: SPRING });
}

/** Horizontal shake for a wrong answer. */
export function shake(elm) {
  return run(elm, [
    { transform: 'translateX(0)' },
    { transform: 'translateX(-7px)' },
    { transform: 'translateX(6px)' },
    { transform: 'translateX(-4px)' },
    { transform: 'translateX(3px)' },
    { transform: 'translateX(0)' },
  ], { duration: 420, easing: 'ease-out' });
}

/** Expanding ring that pulses out from an element, in its current colour. */
export function ring(elm, color) {
  return run(elm, [
    { boxShadow: `0 0 0 0 ${color}` },
    { boxShadow: `0 0 0 14px transparent` },
  ], { duration: 700, easing: 'ease-out' });
}

/** Draw the strokes of an inline SVG icon, like a pen. */
export function drawIcon(iconSpan, { delay = 0, duration = 420 } = {}) {
  if (!iconSpan || reduced()) return;
  const shapes = iconSpan.querySelectorAll('path, circle, rect, line, polyline');
  shapes.forEach((s, i) => {
    let len = 40;
    try { len = Math.ceil(s.getTotalLength()) + 1; } catch { /* keep default */ }
    s.style.strokeDasharray = String(len);
    const a = run(s, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
      { duration, delay: delay + i * 120, easing: EASE, fill: 'backwards' });
    const clean = () => { s.style.strokeDasharray = ''; };
    if (a) a.finished.then(clean, clean); else clean();
  });
}

/** Grow a bar from `from` (a CSS width) to the width it already has. */
export function growBar(span, { from = '0%', delay = 0, duration = 800 } = {}) {
  return run(span, [{ width: from }, { width: span.style.width || getComputedStyle(span).width }],
    { duration, delay, easing: EASE, fill: 'backwards' });
}

/** Draw an SVG line along its length. */
export function drawLine(path, { delay = 0, duration = 1100 } = {}) {
  if (!path || reduced()) return;
  let len = 0;
  try { len = Math.ceil(path.getTotalLength()); } catch { return; }
  if (!len) return;
  path.style.strokeDasharray = String(len);
  const a = run(path, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
    { duration, delay, easing: EASE, fill: 'backwards' });
  const clean = () => { path.style.strokeDasharray = ''; };
  if (a) a.finished.then(clean, clean); else clean();
}

/**
 * Count a number up to its final value. The element's text is the final
 * value throughout for anything that reads it; only the painted digits move.
 */
export function countUp(elm, to, { duration = 1000, delay = 0, format = (n) => String(n) } = {}) {
  if (!elm) return;
  elm.textContent = format(to);
  if (reduced() || !Number.isFinite(to) || to === 0) return;
  const t0 = performance.now() + delay;
  elm.textContent = format(0);
  const tick = (now) => {
    const t = Math.min(1, Math.max(0, (now - t0) / duration));
    const eased = 1 - (1 - t) ** 3;
    elm.textContent = format(Math.round(to * eased));
    if (t < 1 && elm.isConnected) requestAnimationFrame(tick);
    else elm.textContent = format(to);
  };
  requestAnimationFrame(tick);
}

/**
 * A small burst of confetti from the centre of an element. Plain DOM nodes
 * in a fixed overlay; they remove themselves when they land.
 */
export function burst(origin, { count = 22, colors } = {}) {
  if (!origin || reduced()) return;
  const r = origin.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const css = getComputedStyle(document.documentElement);
  const palette = colors || ['--correct', '--accent', '--flag', '--secondary']
    .map((v) => css.getPropertyValue(v).trim() || '#4b4dfa');

  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);

  let left = count;
  for (let i = 0; i < count; i += 1) {
    const p = document.createElement('span');
    p.className = 'fx-bit';
    const size = 5 + Math.random() * 5;
    p.style.width = `${size}px`;
    p.style.height = `${Math.random() < 0.5 ? size : size * 0.45}px`;
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    p.style.background = palette[i % palette.length];
    if (Math.random() < 0.35) p.style.borderRadius = '50%';
    layer.append(p);

    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 60 + Math.random() * 70;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 30;
    const spin = (Math.random() - 0.5) * 540;
    const a = p.animate([
      { transform: 'translate(-50%, -50%) scale(.4) rotate(0deg)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${dy + 70}px)) scale(.8) rotate(${spin}deg)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 350, easing: 'cubic-bezier(.15, .6, .3, 1)', fill: 'forwards' });
    const done = () => { left -= 1; if (!left) layer.remove(); };
    a.finished.then(done, done);
  }
}

/**
 * Swap the theme with a circular reveal that grows from the toggle button.
 * Falls back to an instant swap where view transitions are not supported.
 */
export function themeReveal(fromEl, apply) {
  if (reduced() || typeof document.startViewTransition !== 'function' || !fromEl) { apply(); return; }
  const r = fromEl.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const end = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  let t;
  try { t = document.startViewTransition(apply); } catch { apply(); return; }
  t.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
      { duration: 560, easing: EASE, pseudoElement: '::view-transition-new(root)' },
    );
  }).catch(() => {});
}

/**
 * Entrance motion for whatever a screen just rendered: bars grow, lines draw,
 * big numbers count up. Called once per route render.
 */
export function animateScreen(root) {
  if (!root || reduced()) return;
  root.querySelectorAll('.bar > span, .progress:not(.qprogress) > span').forEach((s, i) => {
    growBar(s, { delay: 120 + Math.min(i, 12) * 45 });
  });
  root.querySelectorAll('.sparkline .line').forEach((p) => drawLine(p, { delay: 200 }));
  root.querySelectorAll('.sparkline .dot').forEach((d, i) => {
    run(d, [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1)' }],
      { duration: 300, delay: 400 + i * 50, easing: SPRING, fill: 'backwards' });
  });
  root.querySelectorAll('.readiness .score').forEach((s) => {
    const n = Number(s.textContent);
    if (Number.isFinite(n)) countUp(s, n, { duration: 1100, delay: 150 });
  });
}
