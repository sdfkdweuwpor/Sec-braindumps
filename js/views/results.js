import { el, clear, renderQuestionText, fmtDuration } from '../dom.js';
import * as store from '../store.js';
import {
  QUESTIONS_BY_ID, DOMAINS, isCorrect, scaledScore,
  PASSING_SCALED, PRACTICE_THRESHOLD, createSession, selectQuestions,
} from '../quizEngine.js';

function domainBars(questions, answers) {
  const rows = [];
  for (const [id, meta] of Object.entries(DOMAINS)) {
    const d = Number(id);
    const qs = questions.filter((q) => q.domain === d);
    if (!qs.length) continue;
    const right = qs.filter((q) => isCorrect(q, answers[q.id] || [])).length;
    rows.push({ domain: d, title: meta.title, right, total: qs.length,
                pct: Math.round((right / qs.length) * 100) });
  }
  return el('div', { class: 'card' }, [
    el('h2', { text: 'By domain' }),
    ...rows.map((r) => el('div', { style: 'margin:.55rem 0' }, [
      el('div', { class: 'spread', style: 'font-size:.88rem' }, [
        el('span', { text: `D${r.domain} ${r.title}` }),
        el('span', { class: 'muted', text: `${r.right}/${r.total} · ${r.pct}%` }),
      ]),
      el('div', { class: 'progress', style: 'margin-top:.25rem' }, [
        el('span', { style: `width:${r.pct}%` }),
      ]),
    ])),
  ]);
}

export async function renderResults(view, { params, navigate }) {
  const wanted = params.get('id');
  const quizzes = store.getQuizzes();
  const result = wanted
    ? quizzes.find((q) => q.id === wanted)
    : quizzes[quizzes.length - 1];

  if (!result) {
    view.append(el('div', { class: 'empty' }, [
      el('span', { class: 'ic', 'aria-hidden': 'true', text: '○' }),
      el('h2', { text: 'No results yet' }),
      el('a', { class: 'btn', href: '#/home', text: 'Back to Study' }),
    ]));
    return;
  }

  const questions = result.questionIds.map((id) => QUESTIONS_BY_ID.get(id)).filter(Boolean);
  const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
  const isMock = result.mode === 'mock';

  view.append(el('h1', { text: isMock ? 'Mock exam results' : 'Results' }));

  const head = el('div', { class: 'card' }, [
    el('div', { style: 'font-size:2rem;font-weight:700' },
      `${result.score} / ${result.total} · ${pct}%`),
  ]);

  if (isMock) {
    const scaled = scaledScore(pct);
    const passed = scaled >= PASSING_SCALED;
    head.append(el('p', {}, [
      el('span', {
        class: 'statelabel',
        style: `color:var(--${passed ? 'correct' : 'incorrect'})`,
        text: passed ? `✓ ${scaled} — above 750` : `✗ ${scaled} — below 750`,
      }),
    ]));
    head.append(el('p', { class: 'faint',
      text: 'Unofficial estimate. Raw percentage mapped linearly onto the 100–900 '
          + 'scale; the real exam passes at 750/900 and CompTIA does not publish how it scales.' }));
  } else {
    const passed = pct >= PRACTICE_THRESHOLD;
    head.append(el('p', {}, [
      el('span', {
        class: 'statelabel',
        style: `color:var(--${passed ? 'correct' : 'incorrect'})`,
        text: passed ? `✓ At or above ${PRACTICE_THRESHOLD}%` : `✗ Below ${PRACTICE_THRESHOLD}%`,
      }),
    ]));
    head.append(el('p', { class: 'faint',
      text: `${PRACTICE_THRESHOLD}% is a practice heuristic, not a scaled score. `
          + 'Only the mock exam estimates the 100–900 scale.' }));
  }
  head.append(el('p', { class: 'muted', text: `Time taken: ${fmtDuration(result.durationMs)}` }));
  view.append(head);

  view.append(domainBars(questions, result.answers));

  /* ---- question list with filters ---- */
  const listCard = el('div', { class: 'card' });
  const list = el('div');
  let filter = 'all';

  const chips = el('div', { class: 'row', style: 'margin-bottom:.7rem' });
  const paintList = () => {
    clear(list);
    const rows = questions.filter((q) => {
      if (filter === 'missed') return !isCorrect(q, result.answers[q.id] || []);
      if (filter === 'flagged') return store.isFlagged(q.id);
      return true;
    });
    if (!rows.length) {
      list.append(el('p', { class: 'muted', text: 'Nothing here.' }));
      return;
    }
    for (const q of rows) {
      const picked = result.answers[q.id] || [];
      const right = isCorrect(q, picked);
      const det = el('details', { style: 'border-top:1px solid var(--border);padding:.5rem 0' }, [
        el('summary', {}, [
          el('span', {
            class: 'statelabel',
            style: `color:var(--${right ? 'correct' : 'incorrect'});margin-right:.5rem`,
            text: right ? '✓' : '✗',
          }),
          el('span', { text: q.question.split('\n')[0].slice(0, 90) }),
        ]),
      ]);
      const inner = el('div', { style: 'padding:.6rem 0 .2rem' });
      inner.append(renderQuestionText(q.question));
      inner.append(el('p', { class: 'muted', style: 'margin-top:.5rem',
        text: `Your answer: ${picked.join(', ') || '(none)'} · Correct: ${q.correct.join(', ')}` }));
      if (q.explanation) inner.append(el('p', { text: q.explanation }));
      else inner.append(el('p', { class: 'faint', text: 'No explanation available for this question yet.' }));
      const wrongs = Object.entries(q.incorrectExplanations || {})
        .filter(([k]) => !q.correct.includes(k));
      if (wrongs.length) {
        inner.append(el('ul', { class: 'wrongs' },
          wrongs.map(([k, why]) => el('li', {}, [el('b', { text: `${k}. ` }), why]))));
      }
      inner.append(el('button', {
        class: 'iconbtn', type: 'button', text: '⚑',
        'aria-pressed': String(store.isFlagged(q.id)),
        'aria-label': 'Flag this question',
        onclick: (ev) => {
          const on = store.toggleFlag(q.id);
          ev.currentTarget.setAttribute('aria-pressed', String(on));
        },
      }));
      det.append(inner);
      list.append(det);
    }
  };

  for (const [key, label] of [['all', 'All'], ['missed', 'Missed'], ['flagged', 'Flagged']]) {
    const b = el('button', {
      class: 'btn secondary', type: 'button', text: label,
      onclick: () => {
        filter = key;
        for (const c of chips.children) c.classList.add('secondary');
        b.classList.remove('secondary');
        paintList();
      },
    });
    if (key === 'all') b.classList.remove('secondary');
    chips.append(b);
  }
  listCard.append(el('h2', { text: 'Questions' }), chips, list);
  paintList();
  view.append(listCard);

  /* ---- actions ---- */
  const missedHere = questions.filter((q) => !isCorrect(q, result.answers[q.id] || []));
  view.append(el('div', { class: 'row' }, [
    el('button', {
      class: 'btn', type: 'button', disabled: !missedHere.length,
      text: `Retake ${missedHere.length} missed`,
      onclick: () => {
        const s = store.getSettings();
        store.setActiveQuiz(createSession({
          questions: selectQuestions(missedHere, 'all', { shuffleQuestions: s.shuffleQuestions }),
          mode: 'retake', config: { source: 'missed' },
          feedbackMode: s.feedbackMode, shuffleChoices: s.shuffleChoices,
        }));
        navigate('#/quiz');
      },
    }),
    el('a', { class: 'btn secondary', href: '#/build', text: 'New quiz' }),
    el('a', { class: 'btn secondary', href: '#/home', text: 'Back to Study' }),
  ]));
}
