import { el, clear, renderQuestionText, fmtDuration } from '../dom.js';
import * as store from '../store.js';
import {
  QUESTIONS_BY_ID, DOMAINS, isCorrect, scaledScore,
  PASSING_SCALED, PRACTICE_THRESHOLD, createSession, selectQuestions, letterMap,
} from '../quizEngine.js';
import { icon } from '../icons.js';
import { countUp, reduced, EASE, burst } from '../motion.js';
import { play } from '../sound.js';
import { reviewChanges } from '../srs.js';
import { currentSummary, startSmartReview, reviewButtonLabel } from '../smartReview.js';
import { verifyRow } from '../verify.js';

const SVGNS = 'http://www.w3.org/2000/svg';

// Score ring: the arc sweeps round to the percentage while the number counts up.
function scoreRing(pct, passed, fresh) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 128 128');
  svg.setAttribute('class', 'ring-svg');
  svg.setAttribute('aria-hidden', 'true');
  const mk = (cls) => {
    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('cx', '64'); c.setAttribute('cy', '64'); c.setAttribute('r', String(R));
    c.setAttribute('class', cls);
    return c;
  };
  const track = mk('ring-track');
  const arc = mk(`ring-arc ${passed ? 'is-pass' : 'is-fail'}`);
  arc.setAttribute('stroke-dasharray', `${C}`);
  arc.setAttribute('stroke-dashoffset', `${C * (1 - pct / 100)}`);
  svg.append(track, arc);
  const num = el('span', { class: 'ring-num', text: `${pct}%` });
  const wrap = el('div', { class: 'ring' }, [svg, num]);
  const still = reduced();
  if (!still && pct > 0) {
    arc.animate([{ strokeDashoffset: C }, { strokeDashoffset: C * (1 - pct / 100) }],
      { duration: 1200, delay: 200, easing: EASE, fill: 'backwards' });
    countUp(num, pct, { duration: 1200, delay: 200, format: (n) => `${n}%` });
  }
  // Celebrate only a result that was just finished, not one reopened later.
  if (fresh) {
    setTimeout(() => {
      if (!wrap.isConnected) return;
      if (passed) burst(wrap, { count: 28 });
      play(passed ? 'finish' : 'done');
    }, still || pct === 0 ? 150 : 1250);
  }
  return wrap;
}

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

// How this quiz moved questions through Smart review, and a way to keep going.
function srsCard(result, isSmart, navigate) {
  const c = reviewChanges(store.getAttempts(), result.questionIds, result.id);
  const due = currentSummary().due.length;
  const plural = (n) => (n === 1 ? '' : 's');
  const items = [
    c.mastered && { cls: 'is-mastered', ic: 'trophy', text: `${c.mastered} mastered` },
    c.up && { cls: 'is-up', ic: 'right', text: `${c.up} moved up` },
    c.reset && { cls: 'is-reset', ic: 'review', text: `${c.reset} back to 1 day` },
    c.added && { cls: 'is-added', ic: 'smart', text: `${c.added} new question${plural(c.added)} to review, first check tomorrow` },
  ].filter(Boolean);
  if (!items.length && !(isSmart && due)) return null;
  return el('div', { class: 'card srs-result' }, [
    el('div', { class: 'srs-result-head' }, [
      el('span', { class: 'mode-ic' }, [icon('smart', { size: 22 })]),
      el('h2', { text: 'Smart review' }),
    ]),
    items.length
      ? el('ul', { class: 'srs-moves' }, items.map((it) => el('li', { class: it.cls }, [icon(it.ic, { size: 16 }), it.text])))
      : null,
    isSmart && due
      ? el('button', { class: 'btn', type: 'button', onclick: () => startSmartReview(navigate) },
        [icon('smart', { size: 18 }), `Keep going: ${reviewButtonLabel(due).replace(/^Review/, 'review')}`])
      : null,
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
      el('span', { class: 'ic' }, [icon('stats', { size: 34 })]),
      el('h1', { text: 'No results yet' }),
      el('a', { class: 'btn', href: '#/home', text: 'Back to Study' }),
    ]));
    return;
  }

  const questions = result.questionIds.map((id) => QUESTIONS_BY_ID.get(id)).filter(Boolean);
  const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
  const isMock = result.mode === 'mock';
  const isDrill = result.mode === 'similar';
  const resumable = isDrill ? store.getActiveQuiz() : null;

  const isSmart = result.mode === 'smart';
  view.append(el('h1', { text: isMock ? 'Mock exam results' : isDrill ? 'Similar questions'
    : isSmart ? 'Smart review' : 'Results' }));

  if (resumable) {
    const at = (resumable.index || 0) + 1;
    view.append(el('div', { class: 'card resume-card' }, [
      el('div', {}, [
        el('h2', { text: 'Your quiz is waiting' }),
        el('p', { class: 'muted', text: `Pick up where you left off: question ${at} of ${resumable.questionIds.length}.` }),
      ]),
      el('a', { class: 'btn', href: '#/quiz' }, [icon('back', { size: 18 }), 'Back to my quiz']),
    ]));
  }

  const passedHere = isMock
    ? scaledScore(pct) >= PASSING_SCALED
    : pct >= PRACTICE_THRESHOLD;
  const head = el('div', { class: 'card' }, [
    el('div', { class: 'score-head' }, [
      scoreRing(pct, passedHere, Date.now() - (result.ts || 0) < 20000),
      el('div', {}, [
        el('div', { class: 'score-big' }, [
          el('span', { text: String(result.score) }),
          el('span', { class: 'qof', text: ` / ${result.total}` }),
        ]),
        el('p', { class: 'muted', style: 'margin:0', text: 'questions correct' }),
      ]),
    ]),
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

  const moves = srsCard(result, isSmart, navigate);
  if (moves) view.append(moves);

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
      // Same letters the quiz showed: A on top, in the order the choices appeared.
      const order = (result.choiceOrder && result.choiceOrder[q.id]) || q.choices.map((c) => c.key);
      const L = letterMap(order);
      const shown = (keys) => keys.filter((k) => L[k]).map((k) => L[k]).sort().join(', ');
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
      inner.append(el('ul', { class: 'result-choices' }, order.map((k) => {
        const c = q.choices.find((x) => x.key === k);
        if (!c) return null;
        const isRight = q.correct.includes(k);
        const mine = picked.includes(k);
        return el('li', { 'data-state': isRight ? 'correct' : mine ? 'wrong' : '' }, [
          el('span', { class: 'wkey', text: L[k] }),
          el('span', { text: c.text }),
          isRight ? el('span', { class: 'statelabel', text: 'Correct' })
            : mine ? el('span', { class: 'statelabel', text: 'Your answer' }) : null,
        ]);
      })));
      inner.append(el('p', { class: 'muted', style: 'margin-top:.5rem',
        text: `Your answer: ${shown(picked) || '(none)'} · Correct: ${shown(q.correct)}` }));
      if (q.explanation) inner.append(el('p', { text: q.explanation }));
      else inner.append(el('p', { class: 'faint', text: 'No explanation available for this question yet.' }));
      const wrongs = Object.entries(q.incorrectExplanations || {})
        .filter(([k]) => !q.correct.includes(k) && L[k])
        .sort(([a], [b]) => L[a].localeCompare(L[b]));
      if (wrongs.length) {
        inner.append(el('h3', { text: 'Why the others are wrong' }));
        inner.append(el('ul', { class: 'wrongs' },
          wrongs.map(([k, why]) => el('li', {}, [el('span', { class: 'wkey', text: L[k] }), el('span', { text: why })]))));
      }
      inner.append(verifyRow(q, { order }));
      inner.append(el('button', {
        class: 'iconbtn', type: 'button',
        'aria-pressed': String(store.isFlagged(q.id)),
        'aria-label': 'Flag this question',
        onclick: (ev) => {
          const on = store.toggleFlag(q.id);
          ev.currentTarget.setAttribute('aria-pressed', String(on));
        },
      }, [icon('flag')]));
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
  if (resumable) return;   // the waiting quiz is the next step, not a new one
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
