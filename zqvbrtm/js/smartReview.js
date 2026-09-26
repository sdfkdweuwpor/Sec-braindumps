/** Smart review in the UI: the Study-screen card and starting a session. */

import { el } from './dom.js';
import * as store from './store.js';
import { icon } from './icons.js';
import { QUESTIONS_BY_ID, createSession, selectQuestions } from './quizEngine.js';
import { reviewSummary, daysUntil, STEPS, SESSION_SIZE } from './srs.js';
import { art } from './art.js';

export function currentSummary(now = Date.now()) {
  return reviewSummary(store.getAttempts(), { now, isKnown: (id) => QUESTIONS_BY_ID.has(id) });
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

/** The ladder: one node per check, then Mastered. Counts are questions on each rung. */
function ladder(summary) {
  const nodes = STEPS.map((days, i) => ({
    n: summary.counts[i],
    label: days === 1 ? '1 day' : `${days} days`,
    cls: '',
  }));
  nodes.push({ n: summary.mastered, label: 'Mastered', cls: 'is-mastered' });
  return el('ol', { class: 'srs-ladder', 'aria-label': 'Questions at each check' },
    nodes.map((node) => el('li', { class: `srs-step ${node.cls} ${node.n ? '' : 'is-empty'}` }, [
      el('span', { class: 'srs-n', text: String(node.n) }),
      el('span', { class: 'srs-l', text: node.label }),
    ])));
}

export function smartReviewCard(navigate) {
  const s = currentSummary();
  const due = s.due.length;

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
      onclick: () => startSmartReview(navigate),
    }, [icon('smart', { size: 18 }), reviewButtonLabel(due)]);
  } else if (s.nextDue !== null) {
    foot = el('p', { class: 'srs-next' }, [
      icon('clock', { size: 17 }),
      `Next: ${s.nextDueCount} question${s.nextDueCount === 1 ? '' : 's'} ${whenText(s.nextDue)}`,
    ]);
  } else {
    foot = null;
  }

  return el('section', { class: 'card srs-card', 'aria-labelledby': 'srs-title' }, [
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
    ladder(s),
    el('div', { class: 'srs-foot' }, [
      foot,
      el('p', { class: 'faint srs-rule',
        text: 'Right at a check moves a question along. A miss sends it back to 1 day.' }),
    ]),
  ]);
}
