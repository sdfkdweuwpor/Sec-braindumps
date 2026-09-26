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
export function slideIn(elm, dir = 1, { distance = 34, duration = 380 } = {}) {
  return run(elm, [
    { opacity: 0, transform: `translateX(${dir * distance}px)` },
    { opacity: 1, transform: 'none' },
  ], { duration, easing: EASE });
}

/**
 * Odometer: each digit rolls through a column of 0-9 to its value. The
 * element's text (and aria-label) is the final number throughout; the
 * rolling columns are swapped back to plain text when they settle.
 */
export function odometer(elm, to, { from = 0, delay = 0, duration = 1100 } = {}) {
  if (!elm) return;
  const final = String(to);
  elm.textContent = final;
  if (reduced() || typeof elm.animate !== 'function') return;
  const start = String(from).padStart(final.length, ' ').slice(-final.length);
  elm.setAttribute('aria-label', final);
  const wrap = document.createElement('span');
  wrap.className = 'odo';
  wrap.setAttribute('aria-hidden', 'true');
  const anims = [];
  [...final].forEach((ch, i) => {
    if (!/\d/.test(ch)) { wrap.append(document.createTextNode(ch)); return; }
    const col = document.createElement('span');
    col.className = 'odo-col';
    const strip = document.createElement('span');
    strip.className = 'odo-strip';
    for (let d = 0; d <= 9; d += 1) {
      const cell = document.createElement('span');
      cell.textContent = String(d);
      strip.append(cell);
    }
    col.append(strip);
    wrap.append(col);
    const fromDigit = /\d/.test(start[i]) ? Number(start[i]) : 0;
    const toDigit = Number(ch);
    strip.style.transform = `translateY(${-toDigit}em)`;
    anims.push(strip.animate(
      [{ transform: `translateY(${-fromDigit}em)` }, { transform: `translateY(${-toDigit}em)` }],
      { duration: duration + i * 140, delay, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'backwards' }));
  });
  elm.replaceChildren(wrap);
  Promise.all(anims.map((a) => a.finished)).then(() => {
    if (elm.contains(wrap)) elm.textContent = final;
  }, () => { elm.textContent = final; });
}

/**
 * Cards that tilt slightly toward the pointer, with a soft glow that follows
 * it. Desktop pointers only; cards keep their own entrance animation.
 */
export function interactiveCards(root) {
  if (reduced()) return;
  let fine = false;
  try { fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { /* no */ }
  if (!fine) return;
  root.querySelectorAll('.mode-grid > .card, .srs-card').forEach((card) => {
    if (card.dataset.tilt) return;
    card.dataset.tilt = '1';
    card.classList.add('tilt');
    // Plain cards get their glow from the app-wide pointer glow (CSS
    // ::before/::after); the gradient hero cards use their own pseudo-
    // elements for decoration, so their glow is a span.
    if (card.classList.contains('hero') && !card.querySelector(':scope > .card-glow')) {
      card.prepend(Object.assign(document.createElement('span'), { className: 'card-glow' }));
    }
    // The entrance animation holds transform while it runs; release it once
    // the card's own animation (not a child's, which bubble) has finished.
    const settle = (ev) => {
      if (ev.target !== card) return;
      card.style.animation = 'none';
      card.removeEventListener('animationend', settle);
    };
    card.addEventListener('animationend', settle);
    const strength = card.classList.contains('srs-card') ? 1.2 : 4;
    card.addEventListener('pointermove', (ev) => {
      const r = card.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width;
      const y = (ev.clientY - r.top) / r.height;
      card.style.transform = `perspective(900px) rotateX(${((0.5 - y) * strength).toFixed(2)}deg) rotateY(${((x - 0.5) * strength).toFixed(2)}deg) translateY(-3px)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
}

/** What the pointer glow lights up (see the matching rules in app.css). */
const GLOW = '.card, .qtext, .choice, .explain, .qnav, .acro-list, .drill-banner';

/**
 * The pointer glow, app-wide. Whatever card, question, answer or
 * explanation the mouse is over gets a soft light that follows it, and its
 * edge lights up nearest the pointer (CSS reads --mx/--my, in px). A faint
 * spotlight also follows the pointer across the page background. Mouse and
 * trackpad only: touch screens have no hover to follow.
 */
export function installPointerGlow() {
  if (installPointerGlow.done) return;
  let fine = false;
  try { fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { /* no */ }
  if (!fine) return;
  installPointerGlow.done = true;
  document.documentElement.classList.add('has-glow');
  const spot = document.createElement('div');
  spot.className = 'page-spot';
  spot.setAttribute('aria-hidden', 'true');
  document.body.prepend(spot);

  let pending = null;
  const apply = () => {
    const ev = pending;
    pending = null;
    if (!ev) return;
    spot.style.setProperty('--px', `${ev.clientX}px`);
    spot.style.setProperty('--py', `${ev.clientY}px`);
    spot.classList.add('is-on');
    let node = ev.target instanceof Element ? ev.target.closest(GLOW) : null;
    while (node) {
      const r = node.getBoundingClientRect();
      node.style.setProperty('--mx', `${Math.round(ev.clientX - r.left)}px`);
      node.style.setProperty('--my', `${Math.round(ev.clientY - r.top)}px`);
      node = node.parentElement ? node.parentElement.closest(GLOW) : null;
    }
  };
  document.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'touch') return;
    if (!pending) requestAnimationFrame(apply);
    pending = ev;
  }, { passive: true });
  // The pointer left the window: let the spotlight fade.
  document.addEventListener('mouseout', (ev) => { if (!ev.relatedTarget) spot.classList.remove('is-on'); });
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

/**
 * Bring an icon in as if it were being drawn: a quick left-to-right wipe
 * with a small overshoot. (The icons are filled shapes, not strokes, so
 * there is no line to trace.)
 */
export function drawIcon(iconSpan, { delay = 0, duration = 420 } = {}) {
  if (!iconSpan || reduced()) return;
  const svg = iconSpan.querySelector('svg');
  if (!svg) return;
  run(svg, [
    { clipPath: 'inset(0 100% 0 0)', transform: 'scale(.7)' },
    { clipPath: 'inset(0 0% 0 0)', transform: 'scale(1.18)', offset: 0.7 },
    { clipPath: 'inset(0 0% 0 0)', transform: 'scale(1)' },
  ], { duration, delay, easing: EASE, fill: 'backwards' });
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
  root.querySelectorAll('.bar > span, .progress:not(.qprogress) > span, .rmeter-fill').forEach((s, i) => {
    growBar(s, { delay: 120 + Math.min(i, 12) * 45 });
  });
  root.querySelectorAll('.sparkline .line').forEach((p) => drawLine(p, { delay: 200 }));
  root.querySelectorAll('.sparkline .dot').forEach((d, i) => {
    run(d, [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1)' }],
      { duration: 300, delay: 400 + i * 50, easing: SPRING, fill: 'backwards' });
  });
  root.querySelectorAll('[data-countup], .readiness .score, .srs-n, .score-big > span:first-child').forEach((s, i) => {
    const n = Number(s.dataset.countup ?? s.textContent);
    if (Number.isFinite(n)) odometer(s, n, { delay: 180 + Math.min(i, 8) * 60 });
  });
  interactiveCards(root);
}
