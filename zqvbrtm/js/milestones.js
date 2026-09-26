/**
 * Milestone banners: a banner slides down when the viewer passes a number
 * of questions answered, or moves up a readiness band. Each milestone shows
 * once. The first time this runs for a viewer, their current position is
 * recorded quietly, so existing history does not set off a pile of banners.
 */

import { el } from './dom.js';
import * as store from './store.js';
import * as stats from './stats.js';
import { ALL_QUESTIONS } from './quizEngine.js';
import { icon } from './icons.js';
import { burst, reduced, SPRING, EASE } from './motion.js';
import { play } from './sound.js';

const BANDS = ['Not ready', 'Building', 'Approaching', 'Exam ready'];

function thresholds() {
  const total = ALL_QUESTIONS.length;
  return [50, 100, 250, 500, 750, 1000, total].filter((t, i, a) => t <= total && a.indexOf(t) === i);
}

function position() {
  const attempts = store.getAttempts();
  const answered = stats.overall(ALL_QUESTIONS, attempts).answered;
  const r = answered ? stats.readiness(ALL_QUESTIONS, attempts) : { band: 'Not ready', score: 0 };
  return { answered, bandRank: Math.max(0, BANDS.indexOf(r.band)), band: r.band, score: r.score };
}

/** Record where the viewer is now, without celebrating it. */
export function initMilestones() {
  const s = store.getSettings();
  if (s.milestones) return;
  const p = position();
  const passed = thresholds().filter((t) => p.answered >= t);
  store.setSettings({ milestones: { answered: passed.length ? passed[passed.length - 1] : 0, band: p.bandRank } });
}

/** Look for milestones crossed since last time; show the newest one. */
export function checkMilestones() {
  const s = store.getSettings();
  const seen = s.milestones || { answered: 0, band: 0 };
  const p = position();
  const events = [];

  const crossed = thresholds().filter((t) => t > seen.answered && p.answered >= t);
  if (crossed.length) {
    const t = crossed[crossed.length - 1];
    const next = thresholds().find((x) => x > t);
    events.push({
      kind: 'answered',
      title: t === ALL_QUESTIONS.length ? 'Every question answered' : `${t.toLocaleString()} questions answered`,
      text: t === ALL_QUESTIONS.length
        ? `You have been through the whole bank of ${t.toLocaleString()}. Smart review keeps the misses coming back.`
        : `${(next - p.answered).toLocaleString()} more to reach ${next.toLocaleString()}.`,
      ic: 'target',
    });
  }
  if (p.bandRank > seen.band) {
    events.push({
      kind: 'band',
      title: p.band === 'Exam ready' ? 'Exam ready' : `Readiness: ${p.band}`,
      text: p.band === 'Exam ready'
        ? `Your readiness score is ${p.score}. Keep it there with Smart review and a mock exam.`
        : `Your readiness score is ${p.score}. Exam ready starts at 85.`,
      ic: 'trophy',
    });
  }
  store.setSettings({ milestones: {
    answered: Math.max(seen.answered, ...thresholds().filter((t) => p.answered >= t), 0),
    band: Math.max(seen.band, p.bandRank),
  } });
  if (events.length) showBanner(events[events.length - 1], events.length > 1 ? events[0] : null);
}

let current = null;

function showBanner(evt, also) {
  if (current) current.remove();
  const close = el('button', { class: 'iconbtn ms-close', type: 'button', 'aria-label': 'Dismiss' }, [icon('x', { size: 18 })]);
  const banner = el('div', { class: `milestone ms-${evt.kind}`, role: 'status', 'aria-live': 'polite' }, [
    el('span', { class: 'ms-ic' }, [icon(evt.ic, { size: 26 })]),
    el('div', { class: 'ms-body' }, [
      el('span', { class: 'ms-eyebrow', text: 'Milestone' }),
      el('b', { class: 'ms-title', text: evt.title }),
      el('span', { class: 'ms-text', text: also ? `${evt.text} Also: ${also.title}.` : evt.text }),
    ]),
    close,
  ]);
  document.body.append(banner);
  current = banner;
  play('milestone');

  let timer = null;
  const hide = () => {
    clearTimeout(timer);
    if (!banner.isConnected) return;
    if (reduced()) { banner.remove(); return; }
    banner.animate([{ transform: 'translate(-50%, 0)', opacity: 1 }, { transform: 'translate(-50%, -140%)', opacity: 0 }],
      { duration: 380, easing: EASE, fill: 'forwards' }).finished.then(() => banner.remove(), () => banner.remove());
    if (current === banner) current = null;
  };
  close.addEventListener('click', hide);
  timer = setTimeout(hide, 6000);
  banner.addEventListener('pointerenter', () => clearTimeout(timer));
  banner.addEventListener('pointerleave', () => { timer = setTimeout(hide, 2500); });

  if (!reduced()) {
    banner.animate([
      { transform: 'translate(-50%, -140%) scale(.96)', opacity: 0 },
      { transform: 'translate(-50%, 0) scale(1)', opacity: 1 },
    ], { duration: 620, easing: SPRING });
    banner.querySelector('.ms-ic').animate([
      { transform: 'scale(.4) rotate(-30deg)' }, { transform: 'scale(1.25) rotate(8deg)', offset: 0.6 }, { transform: 'none' },
    ], { duration: 800, delay: 160, easing: EASE, fill: 'backwards' });
    setTimeout(() => { if (banner.isConnected) burst(banner.querySelector('.ms-ic'), { count: 30 }); }, 380);
  }
}
