/** Smart review in the UI: the Study-screen card and starting a session. */

import { el } from './dom.js';
import * as store from './store.js';
import { icon } from './icons.js';
import { QUESTIONS_BY_ID, createSession, selectQuestions } from './quizEngine.js';
import { reviewSummary, daysUntil, ladderMovesSince, STEPS, SESSION_SIZE } from './srs.js';
import { art } from './art.js';
import { armMorph, reduced, pop, burst } from './motion.js';
import { play } from './sound.js';

const isKnown = (id) => QUESTIONS_BY_ID.has(id);

export function currentSummary(now = Date.now()) {
  return reviewSummary(store.getAttempts(), { now, isKnown });
}

/** Start a review of what is due, most overdue first. False if nothing is due. */
export function startSmartReview(navigate) {
  const due = currentSummary().due.slice(0, SESSION_SIZE);
  const picks = due.map((d) => QUESTIONS_BY_ID.get(d.id)).filter(Boolean);
  if (!picks.length) return false;
  const settings = store.getSettings();
  const session = createSession({
    questions: selectQuestions(picks, 'all', { shuffleQuestions: settings.shuffleQuestions }),
    mode: 'smart',
    config: { source: 'smart' },
    feedbackMode: 'immediate',   // a review is pointless without the answer
    shuffleChoices: settings.shuffleChoices,
  });
  // The rung each question was on when the session started, for the
  // "3-day check" label and the outcome shown after answering.
  session.srs = Object.fromEntries(due.map((d) => [d.id, d.step]));
  store.setActiveQuiz(session);
  navigate('#/quiz');
  return true;
}

export function reviewButtonLabel(dueCount) {
  if (dueCount > SESSION_SIZE) return `Review ${SESSION_SIZE} of ${dueCount}`;
  return `Review ${dueCount} question${dueCount === 1 ? '' : 's'}`;
}

function whenText(ts) {
  const d = daysUntil(ts);
  if (d <= 0) return 'today';
  if (d === 1) return 'tomorrow';
  return `in ${d} days`;
}

/**
 * The ladder: one node per check, then Mastered. `counts` has one number
 * per node (questions on each rung, then mastered).
 */
function ladder(counts, { hop = false } = {}) {
  const labels = [...STEPS.map((days) => (days === 1 ? '1 day' : `${days} days`)), 'Mastered'];
  return el('ol', {
    class: 'srs-ladder', 'aria-label': 'Questions at each check',
    // Counts that are about to hop do not also roll up from zero.
    ...(hop ? { 'data-no-count': '' } : {}),
  }, labels.map((label, i) => el('li', {
    class: `srs-step ${i === STEPS.length ? 'is-mastered' : ''} ${counts[i] ? '' : 'is-empty'}`,
  }, [
    el('span', { class: 'srs-n', text: String(counts[i]) }),
    el('span', { class: 'srs-l', text: label }),
  ])));
}

/** What kind of move a ladder move is: 'new', 'up', 'mastered' or 'back'. */
function moveKind(m) {
  if (m.from === -1) return 'new';
  if (m.to === STEPS.length) return 'mastered';
  return m.to > m.from ? 'up' : 'back';
}

// The line under the ladder once the hops land, in the Results screen's chips.
function sinceNote(moves) {
  const n = { mastered: 0, up: 0, back: 0, new: 0 };
  for (const m of moves) n[moveKind(m)] += m.count;
  const items = [
    n.mastered && { cls: 'is-mastered', ic: 'trophy', text: `${n.mastered} mastered` },
    n.up && { cls: 'is-up', ic: 'right', text: `${n.up} moved up` },
    n.back && { cls: 'is-reset', ic: 'review', text: `${n.back} back to 1 day` },
    n.new && { cls: 'is-added', ic: 'smart', text: `${n.new} new` },
  ].filter(Boolean);
  return el('div', { class: 'srs-since' }, [
    el('span', { class: 'srs-since-l', text: 'Since you were last here' }),
    el('ul', { class: 'srs-moves' }, items.map((it) => el('li', { class: it.cls }, [icon(it.ic, { size: 15 }), it.text]))),
  ]);
}

/**
 * The questions that moved since the ladder was last on screen hop from
 * rung to rung: a dot per question (a few per kind of move), each count
 * ticking as its dot leaves or lands. New questions drop in from above;
 * mastered ones land with a burst.
 */
function playHops(ol, before, after, moves) {
  const nodes = [...ol.querySelectorAll('.srs-n')];
  const shown = [...before];
  const paint = (i) => {
    nodes[i].textContent = String(shown[i]);
    nodes[i].closest('.srs-step').classList.toggle('is-empty', !shown[i]);
  };
  // Assistive tech reads where things ended up, not the replay.
  nodes.forEach((n, i) => n.setAttribute('aria-label', String(after[i])));
  // At most three dots per kind of move; the last one carries the rest.
  const hops = [];
  for (const m of moves) {
    const n = Math.min(m.count, 3);
    for (let k = 0; k < n; k += 1) hops.push({ ...m, weight: k === n - 1 ? m.count - (n - 1) : 1 });
  }
  const curve = (() => { try { return CSS.supports('offset-path', 'path("M0 0 L1 1")'); } catch { return false; } })();
  // Page coordinates, so a dot stays with the card if the page scrolls.
  const layer = el('div', { class: 'srs-hop-layer', 'aria-hidden': 'true' });
  let left = hops.length;
  const center = (node) => {
    const r = node.getBoundingClientRect();
    return [r.left + window.scrollX + r.width / 2, r.top + window.scrollY + r.height / 2, r.height];
  };

  const hop = (h) => {
    if (!ol.isConnected) { if (!--left) layer.remove(); return; }
    if (!layer.isConnected) document.body.append(layer);
    const [x1, y1, size] = center(nodes[h.to]);
    let x0 = x1;
    let y0 = y1 - size / 2 - 64;
    if (h.from >= 0) {
      [x0, y0] = center(nodes[h.from]);
      shown[h.from] -= h.weight;
      paint(h.from);
      pop(nodes[h.from], { scale: 0.88, duration: 360 });
    }
    const dot = el('span', { class: `srs-hop is-${moveKind(h)}` });
    layer.append(dot);
    // Moves arc over the rungs between; new questions fall straight in.
    const lift = h.from === -1 ? 0 : Math.max(46, Math.abs(x1 - x0) * 0.22);
    const cx = (x0 + x1) / 2;
    const cy = Math.min(y0, y1) - lift;
    let a;
    if (curve) {
      dot.style.offsetPath = `path("M ${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1}")`;
      a = dot.animate([
        { offsetDistance: '0%', transform: 'scale(.4)', opacity: 0 },
        { offsetDistance: '12%', transform: 'scale(1.1)', opacity: 1, offset: 0.12 },
        { offsetDistance: '100%', transform: 'scale(.7)', opacity: 1 },
      ], { duration: 680, easing: 'cubic-bezier(.35, .1, .25, 1)' });
    } else {
      // No motion paths: an arc through the curve's peak instead.
      const at = (x, y, k) => `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${k})`;
      a = dot.animate([
        { transform: at(x0, y0, 0.4), opacity: 0 },
        { transform: at(cx, (y0 + y1) / 2 - lift / 2, 1.1), opacity: 1, offset: 0.5 },
        { transform: at(x1, y1, 0.7), opacity: 1 },
      ], { duration: 680, easing: 'ease-in-out' });
    }
    const land = () => {
      dot.remove();
      shown[h.to] += h.weight;
      paint(h.to);
      pop(nodes[h.to], { scale: 1.28, duration: 520 });
      if (h.to === STEPS.length) burst(nodes[h.to], { count: 14 });
      play('tick');
      if (!--left) {
        layer.remove();
        // Say in words what just moved, under the ladder.
        const note = sinceNote(moves);
        ol.after(note);
        note.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }],
          { duration: 420, easing: 'ease-out' });
      }
    };
    a.finished.then(land, land);
  };
  const go = (wait) => hops.forEach((h, i) => setTimeout(() => hop(h), wait + i * 240));

  // Play once the ladder is on screen (after the page has settled in), so
  // a ladder below the fold replays when it is scrolled to.
  const t0 = performance.now();
  if (typeof IntersectionObserver !== 'function') { go(750); return; }
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    go(Math.max(300, 750 - (performance.now() - t0)));
  }, { threshold: 0.6 });
  io.observe(ol);
  window.addEventListener('hashchange', () => io.disconnect(), { once: true });
}

export function smartReviewCard(navigate) {
  const s = currentSummary();
  const due = s.due.length;

  // What moved on the ladder since it was last on screen (a quiz, a mock
  // exam, a review), to replay as hops. The first time, just note the time.
  const seenAt = store.getSettings().srsSeenAt;
  const moves = seenAt
    ? ladderMovesSince(store.getAttempts(), seenAt, { isKnown }).filter((m) => m.to >= 0)
    : [];
  store.setSettings({ srsSeenAt: Date.now() });
  const after = [...s.counts, s.mastered];
  const before = [...after];
  for (const m of moves) {
    if (m.to >= 0) before[m.to] -= m.count;
    if (m.from >= 0) before[m.from] += m.count;
  }
  const hopping = moves.length > 0 && !reduced() && before.every((n) => n >= 0);
  const steps = ladder(hopping ? before : after, { hop: hopping });

  const status = due
    ? el('div', { class: 'srs-due' }, [
      el('span', { class: 'srs-due-n', 'data-countup': String(due), text: String(due) }),
      el('span', { class: 'srs-due-l', text: 'due today' }),
    ])
    : el('div', { class: 'srs-due is-clear' }, [
      icon('check', { size: 22 }),
      el('span', { class: 'srs-due-l', text: s.inReview || s.mastered ? 'All caught up' : 'Nothing yet' }),
    ]);

  let foot;
  if (due) {
    foot = el('button', {
      class: 'btn', type: 'button',
      // The card grows into the review's first question (see armMorph).
      onclick: (ev) => { armMorph(ev.currentTarget.closest('.srs-card')); startSmartReview(navigate); },
    }, [icon('smart', { size: 18 }), reviewButtonLabel(due)]);
  } else if (s.nextDue !== null) {
    foot = el('p', { class: 'srs-next' }, [
      icon('clock', { size: 17 }),
      `Next: ${s.nextDueCount} question${s.nextDueCount === 1 ? '' : 's'} ${whenText(s.nextDue)}`,
    ]);
  } else {
    foot = null;
  }

  const card = el('section', { class: 'card srs-card', 'aria-labelledby': 'srs-title' }, [
    el('div', { class: 'srs-head' }, [
      el('span', { class: 'mode-ic has-art' }, [art('smart', { size: 48 })]),
      el('div', { class: 'srs-title' }, [
        el('h2', { id: 'srs-title', text: 'Smart review' }),
        el('p', { class: 'muted', text: s.inReview || s.mastered
          ? 'Missed questions come back until you know them.'
          : 'Questions you miss come back here after 1 day, then 3, then 7.' }),
      ]),
      status,
    ]),
    steps,
    el('div', { class: 'srs-foot' }, [
      foot,
      el('p', { class: 'faint srs-rule',
        text: 'Right at a check moves a question along. A miss sends it back to 1 day.' }),
    ]),
  ]);
  if (hopping) playHops(steps, before, after, moves);
  return card;
}
