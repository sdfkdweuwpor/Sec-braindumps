/**
 * XP in the interface: the level badge in the top bar, the "+10 XP" that
 * flies to it after an answer, the level-up moment, the level card on the
 * Stats screen and the XP line on a quiz's results. The numbers themselves
 * come from js/xp.js.
 */

import { el } from './dom.js';
import * as store from './store.js';
import { computeXP, levelFor, XP_RULES, LEVELS } from './xp.js';
import { icon } from './icons.js';
import { art } from './art.js';
import { reduced, EASE, pop, burst, countUp } from './motion.js';
import { showLevelUp } from './milestones.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const RING_R = 16;
const RING_C = 2 * Math.PI * RING_R;

const fmt = (n) => Number(n).toLocaleString('en-US');

/** XP from everything stored right now. */
export function xpNow() {
  return computeXP(store.getAttempts(), store.getQuizzes());
}

function ring() {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 40 40');
  svg.setAttribute('class', 'lvl-svg');
  svg.setAttribute('aria-hidden', 'true');
  const mk = (cls) => {
    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('cx', '20'); c.setAttribute('cy', '20'); c.setAttribute('r', String(RING_R));
    c.setAttribute('class', cls);
    return c;
  };
  const arc = mk('lvl-arc');
  arc.setAttribute('stroke-dasharray', String(RING_C));
  arc.setAttribute('stroke-dashoffset', String(RING_C));
  svg.append(mk('lvl-track'), arc);
  return svg;
}

/** The badge for the top bar: level ring, title and XP. Opens Stats. */
export function levelBadge() {
  return el('a', { class: 'lvl-badge', id: 'lvl-badge', href: '#/stats' }, [
    el('span', { class: 'lvl-ring' }, [ring(), el('span', { class: 'lvl-n' })]),
    el('span', { class: 'lvl-text' }, [
      el('b', { class: 'lvl-title' }),
      el('small', { class: 'lvl-xp' }),
    ]),
  ]);
}

let shownTotal = null;

/**
 * Show an XP total on the badge. `animate` moves the ring from what it
 * showed before; across a level it fills up, empties and fills to the new
 * level's progress in one motion.
 */
export function paintBadge(total = xpNow().total, { animate = false } = {}) {
  const badge = document.getElementById('lvl-badge');
  if (!badge) return;
  const info = levelFor(total);
  const prev = shownTotal === null ? null : levelFor(shownTotal);
  shownTotal = total;
  badge.querySelector('.lvl-n').textContent = String(info.level);
  badge.querySelector('.lvl-title').textContent = info.title;
  badge.querySelector('.lvl-xp').textContent = info.next
    ? `${fmt(info.xp)} / ${fmt(info.next)} XP` : `${fmt(info.xp)} XP`;
  const label = `Level ${info.level}, ${info.title}. ${fmt(info.xp)} XP`
    + (info.next ? `, ${fmt(info.toNext)} to ${info.nextTitle}` : '') + '. Open Stats.';
  badge.setAttribute('aria-label', label);
  badge.title = label.replace(/\. Open Stats\.$/, '');

  const arc = badge.querySelector('.lvl-arc');
  const target = RING_C * (1 - info.progress);
  const from = prev ? RING_C * (1 - prev.progress) : RING_C;
  arc.setAttribute('stroke-dashoffset', String(target));
  if (!animate || reduced() || typeof arc.animate !== 'function') return;
  const frames = prev && info.level > prev.level
    ? [{ strokeDashoffset: from, offset: 0 }, { strokeDashoffset: 0, offset: 0.45 },
       { strokeDashoffset: RING_C, offset: 0.46 }, { strokeDashoffset: target, offset: 1 }]
    : [{ strokeDashoffset: from }, { strokeDashoffset: target }];
  arc.animate(frames, { duration: prev && info.level > prev.level ? 1100 : 650, easing: EASE });
  pop(badge.querySelector('.lvl-ring'), { scale: 1.18, duration: 520 });
}

/** A new level: the badge flares and the level-up banner comes down. */
function celebrate(to) {
  const badge = document.getElementById('lvl-badge');
  if (badge && !reduced()) {
    badge.classList.remove('is-leveling');
    void badge.offsetWidth;
    badge.classList.add('is-leveling');
    setTimeout(() => badge.classList.remove('is-leveling'), 1800);
    burst(badge.querySelector('.lvl-ring'), { count: 26 });
  }
  showLevelUp(to);
}

/** Put a gain on the badge (no flying chip), celebrating a new level. */
export function settleXP(gain) {
  if (!gain || gain.xp <= 0) return;
  paintBadge(gain.to.xp, { animate: true });
  if (gain.levelUp) celebrate(gain.to);
}

/**
 * "+10 XP" pops up by the answer, then flies to the level badge; the badge
 * fills when it lands. Bonuses show underneath (streak, mastered, ...).
 */
export function flyXP(origin, gain) {
  if (!gain || gain.xp <= 0) return;
  const badge = document.getElementById('lvl-badge');
  const target = badge && badge.getClientRects().length ? badge.querySelector('.lvl-ring') : null;
  if (reduced() || !origin || !origin.isConnected || !target || typeof document.body.animate !== 'function') {
    settleXP(gain);
    return;
  }
  const extras = gain.parts.filter((p) => p.label !== 'XP');
  const chip = el('div', { class: 'xp-float', 'aria-hidden': 'true' }, [
    el('span', { class: 'xp-main' }, [icon('xp', { size: 16 }), `+${gain.xp} XP`]),
    extras.length ? el('span', { class: 'xp-extra', text: extras.map((p) => `${p.label} +${p.xp}`).join(' · ') }) : null,
  ]);
  document.body.append(chip);
  const o = origin.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  // Just left of the answer's Correct / Your answer label, on its row.
  const x0 = Math.max(o.left + 70, Math.min(o.right - 170, window.innerWidth - 90));
  const y0 = o.top + o.height / 2;
  chip.style.left = `${x0}px`;
  chip.style.top = `${y0}px`;
  const dx = t.left + t.width / 2 - x0;
  const dy = t.top + t.height / 2 - y0;
  const anim = chip.animate([
    { transform: 'translate(-50%, -50%) scale(.4)', opacity: 0, offset: 0 },
    { transform: 'translate(-50%, -62%) scale(1.12)', opacity: 1, offset: 0.2 },
    { transform: 'translate(-50%, -72%) scale(1)', opacity: 1, offset: 0.52 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.3)`, opacity: 0.15, offset: 1 },
  ], { duration: 1350, easing: 'cubic-bezier(.45, 0, .2, 1)' });
  const land = () => { chip.remove(); settleXP(gain); };
  anim.finished.then(land, land);
}

/** The Stats card: level, title, progress, and where the XP came from. */
export function levelCard() {
  const x = xpNow();
  const info = levelFor(x.total);
  const R = XP_RULES;
  const c = x.counts;
  const rows = [
    ['Right answers', c.right, R.right],
    ['Wrong answers (effort counts)', c.wrong, R.wrong],
    [`Every ${R.streakEvery} right in a row`, c.streaks, R.streakBonus],
    ['Smart review checks passed', c.reviewUps, R.reviewUp],
    ['Questions mastered', c.mastered, R.mastered],
    [`Quizzes of ${R.quizMin}+ finished`, c.quizzes, R.quiz],
    ['Mock exams finished', c.mocks, R.mock],
  ];
  const pct = Math.round(info.progress * 100);
  const total = el('span', { class: 'lvl-total', text: fmt(x.total) });
  countUp(total, x.total, { duration: 1100, delay: 200, format: fmt });
  return el('section', { class: 'card lvl-card', 'aria-labelledby': 'lvl-card-title' }, [
    el('div', { class: 'lvl-card-head' }, [
      el('span', { class: 'mode-ic has-art lvl-art' }, [art('star', { size: 52 })]),
      el('div', { class: 'lvl-card-title' }, [
        el('span', { class: 'lvl-eyebrow', text: `Level ${info.level} of ${LEVELS.length}` }),
        el('h2', { id: 'lvl-card-title', text: info.title }),
      ]),
      el('div', { class: 'lvl-card-xp' }, [total, el('span', { class: 'lvl-unit', text: 'XP' })]),
    ]),
    el('div', { class: 'progress lvl-progress', role: 'progressbar',
      'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct),
      'aria-label': 'Progress to the next level' }, [el('span', { style: `width:${Math.max(pct, 1)}%` })]),
    el('p', { class: 'lvl-next' }, info.next
      ? [el('b', { text: `${fmt(info.toNext)} XP` }), ` to Level ${info.level + 1}: ${info.nextTitle}`]
      : ['Top level reached. Nothing left to unlock but the exam itself.']),
    el('details', { class: 'lvl-how' }, [
      el('summary', { text: 'How you earned it' }),
      el('table', { class: 'lvl-table' }, [
        el('tbody', {}, rows.map(([label, n, each]) => el('tr', { class: n ? '' : 'is-zero' }, [
          el('td', { text: label }),
          el('td', { class: 'num', text: `${fmt(n)} × ${each}` }),
          el('td', { class: 'num', text: fmt(n * each) }),
        ]))),
      ]),
    ]),
    el('details', { class: 'lvl-how' }, [
      el('summary', { text: `All ${LEVELS.length} levels` }),
      el('ol', { class: 'lvl-road' }, LEVELS.map((l, i) => el('li', {
        class: i + 1 < info.level ? 'is-done' : i + 1 === info.level ? 'is-here' : 'is-locked',
      }, [
        el('span', { class: 'lvl-road-n', text: String(i + 1) }),
        el('span', { class: 'lvl-road-t', text: l.title }),
        el('span', { class: 'lvl-road-x', text: `${fmt(l.xp)} XP` }),
      ]))),
    ]),
  ]);
}

/** "+230 XP" for one quiz, for its results screen. Null if it earned none. */
export function xpEarnedLine(quizId) {
  const x = xpNow();
  const got = x.byQuiz.get(quizId) || 0;
  if (!got) return null;
  const info = levelFor(x.total);
  const n = el('b', { class: 'xp-got', text: `+${fmt(got)} XP` });
  countUp(n, got, { duration: 900, delay: 500, format: (v) => `+${fmt(v)} XP` });
  return el('p', { class: 'xp-earned' }, [
    icon('xp', { size: 18 }), n,
    el('span', { class: 'muted', text: ` · Level ${info.level} ${info.title}` }),
  ]);
}

