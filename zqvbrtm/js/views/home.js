import { el } from '../dom.js';
import * as store from '../store.js';
import * as stats from '../stats.js';
import { readinessCard, confirmDialog } from '../components.js';
import { icon } from '../icons.js';
import { smartReviewCard } from '../smartReview.js';
import {
  ALL_QUESTIONS, buildPool, selectQuestions, selectWeighted,
  createSession,
} from '../quizEngine.js';

const MOCK_COUNT = 90;
const MOCK_MINUTES = 90;

function startSession(session, navigate) {
  store.setActiveQuiz(session);
  navigate('#/quiz');
}

const MODE_ICON = { 'Build your own': 'build', 'Missed questions': 'missed', 'Weakest subject': 'target', 'Mock exam': 'timer' };

function modeCard({ title, blurb, cta, disabled, note, onStart }) {
  return el('div', { class: 'card mode-card' }, [
    el('div', { class: 'mode-head' }, [
      el('span', { class: 'mode-ic' }, [icon(MODE_ICON[title] || 'study', { size: 24 })]),
      el('div', {}, [
        el('h2', { text: title }),
        el('p', { class: 'muted', text: blurb, style: 'margin:0' }),
      ]),
    ]),
    note ? el('p', { class: 'faint', text: note, style: 'margin:.6rem 0 0' }) : null,
    el('div', { style: 'margin-top:.8rem' }, [
      el('button', {
        class: 'btn block', type: 'button', disabled: disabled || false, onclick: onStart,
      }, cta),
    ]),
  ]);
}

export async function renderHome(view, { navigate }) {
  const attempts = store.getAttempts();
  const settings = store.getSettings();
  const o = stats.overall(ALL_QUESTIONS, attempts);
  const active = store.getActiveQuiz();

  view.append(el('h1', { text: 'Study' }));

  if (active) {
    const done = Object.keys(active.answers || {}).length;
    view.append(el('div', { class: 'card' }, [
      el('h2', { text: 'Quiz in progress' }),
      el('p', { class: 'muted', text: `${done} of ${active.questionIds.length} answered.` }),
      el('div', { class: 'row' }, [
        el('a', { class: 'btn', href: '#/quiz', text: 'Resume quiz' }),
        el('button', {
          class: 'btn danger', type: 'button', text: 'Discard',
          onclick: async () => {
            const ok = await confirmDialog({
              title: 'Discard this quiz?',
              message: 'The quiz in progress closes. Answers you already checked stay in your history.',
              confirmText: 'Discard', danger: true,
            });
            if (!ok) return;
            store.clearActiveQuiz();
            window.dispatchEvent(new Event('app:refresh'));
          },
        }),
      ]),
    ]));
  }

  // The daily habit sits first: whatever Smart review says is due today.
  view.append(smartReviewCard(navigate));

  view.append(el('p', { class: 'muted' }, [
    o.answered
      ? `${o.answered} answered · ${Math.round(o.accuracy * 100)}% lifetime accuracy · ${o.unseen} of ${o.total} still unseen`
      : `${o.total} questions in the bank. Nothing answered yet — start anywhere.`,
  ]));

  if (o.answered) {
    view.append(readinessCard(stats.readiness(ALL_QUESTIONS, attempts), { compact: true }));
  }

  // --- Build your own -------------------------------------------------
  const grid = el('div', { class: 'mode-grid' });
  view.append(grid);
  grid.append(modeCard({
    title: 'Build your own',
    blurb: 'Pick domains, objectives, missed or saved questions, and a length.',
    cta: 'Open builder',
    onStart: () => navigate('#/build'),
  }));

  // --- Missed ---------------------------------------------------------
  const missed = store.missedIds();
  grid.append(modeCard({
    title: 'Missed questions',
    blurb: 'Everything you have answered incorrectly.',
    cta: missed.length ? `Practise ${missed.length} missed` : 'Nothing missed yet',
    disabled: !missed.length,
    note: missed.length ? null : 'Answer some questions first and anything you miss collects here.',
    onStart: () => navigate('#/build?source=missed'),
  }));

  // --- Weakest subject ------------------------------------------------
  const weak = stats.weakestObjectives(ALL_QUESTIONS, attempts, { limit: 3, minAttempts: 5 });
  if (weak.length) {
    const objectives = weak.map((w) => w.objective);
    const pool = buildPool({ source: 'objective', objectives }, {
      questions: ALL_QUESTIONS,
      missedIds: missed,
      flaggedIds: store.getFlagged(),
      correctCount: store.correctCount,
    });
    grid.append(modeCard({
      title: 'Weakest subject',
      blurb: `20 questions from your three weakest objectives: ${objectives.join(', ')}.`,
      cta: `Start ${Math.min(20, pool.length)}-question quiz`,
      disabled: !pool.length,
      onStart: () => {
        const questions = selectQuestions(pool, 20, { shuffleQuestions: settings.shuffleQuestions });
        startSession(createSession({
          questions, mode: 'weakest',
          config: { source: 'objective', objectives },
          feedbackMode: settings.feedbackMode,
          shuffleChoices: settings.shuffleChoices,
        }), navigate);
      },
    }));
  } else {
    grid.append(modeCard({
      title: 'Weakest subject',
      blurb: 'Targets the three objectives you score lowest on.',
      cta: 'Not enough data yet',
      disabled: true,
      note: 'An objective needs at least 5 answered questions before it can be '
          + 'called weak, so this stays off until there is enough history to mean anything.',
      onStart: () => {},
    }));
  }

  // --- Mock exam ------------------------------------------------------
  grid.append(modeCard({
    title: 'Mock exam',
    blurb: `${MOCK_COUNT} questions weighted to the official domain percentages, `
         + `${MOCK_MINUTES}-minute timer, no feedback until you submit.`,
    cta: ALL_QUESTIONS.length ? `Start ${MOCK_COUNT}-question mock exam` : 'No questions loaded',
    // An empty bank would otherwise save a 0/0 "result" to history.
    disabled: !ALL_QUESTIONS.length,
    onStart: () => {
      const { questions } = selectWeighted(ALL_QUESTIONS, MOCK_COUNT);
      startSession(createSession({
        questions, mode: 'mock', config: { source: 'all' },
        feedbackMode: 'end',
        shuffleChoices: settings.shuffleChoices,
        durationMs: MOCK_MINUTES * 60 * 1000,
      }), navigate);
    },
  }));
}
