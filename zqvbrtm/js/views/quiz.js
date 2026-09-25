import { el, clear, renderQuestionText } from '../dom.js';
import * as store from '../store.js';
import {
  QUESTIONS_BY_ID, DOMAINS, isCorrect, scoreQuiz, sessionQuestions, remainingMs,
} from '../quizEngine.js';

const NUM_WORD = { 1: 'ONE', 2: 'TWO', 3: 'THREE', 4: 'FOUR', 5: 'FIVE' };

let keyHandler = null;
let timerId = null;

function teardown() {
  if (keyHandler) { window.removeEventListener('keydown', keyHandler); keyHandler = null; }
  if (timerId) { clearInterval(timerId); timerId = null; }
}

function finish(session, navigate) {
  const questions = sessionQuestions(session);
  if (session.feedbackMode === 'end') {
    // Answers stay editable until submission, so they are only recorded now;
    // recording on every pick would log a changed answer twice.
    for (const q of questions) {
      const picked = session.answers[q.id];
      if (picked && picked.length) {
        store.recordAttempt(q.id, { correct: isCorrect(q, picked), selected: picked, quizId: session.id });
      }
    }
  }
  const { correct, total } = scoreQuiz(questions, session.answers);
  const result = {
    id: session.id,
    ts: Date.now(),
    mode: session.mode,
    config: session.config,
    questionIds: session.questionIds,
    answers: session.answers,
    score: correct,
    total,
    durationMs: Date.now() - session.startedAt,
  };
  store.saveQuizResult(result);
  store.clearActiveQuiz();
  teardown();
  navigate(`#/results?id=${encodeURIComponent(result.id)}`);
}

export async function renderQuiz(view, { navigate }) {
  teardown();
  const session = store.getActiveQuiz();

  if (!session) {
    view.append(el('div', { class: 'empty' }, [
      el('span', { class: 'ic', 'aria-hidden': 'true', text: '◇' }),
      el('h1', { text: 'No quiz in progress' }),
      el('p', { class: 'muted', text: 'Start one from the Study screen.' }),
      el('a', { class: 'btn', href: '#/home', text: 'Back to Study' }),
    ]));
    return;
  }

  const body = el('div');
  view.append(body);

  const draw = () => {
    // Each draw registers a fresh keydown handler, so drop the previous one
    // first. Without this they accumulate and every shortcut fires twice --
    // which made F toggle the flag on and straight back off.
    if (keyHandler) { window.removeEventListener('keydown', keyHandler); keyHandler = null; }
    clear(body);
    const question = QUESTIONS_BY_ID.get(session.questionIds[session.index]);
    if (!question) { finish(session, navigate); return; }

    const total = session.questionIds.length;
    const n = session.index + 1;
    const multi = question.correct.length > 1;
    const revealed = !!session.revealed[question.id];
    const picked = session.answers[question.id] || [];
    const order = session.choiceOrder[question.id]
      || question.choices.map((c) => c.key);

    /* ---- header ---- */
    const flagBtn = el('button', {
      class: 'iconbtn', type: 'button',
      'aria-pressed': String(store.isFlagged(question.id)),
      'aria-label': 'Flag this question to review later',
      title: 'Flag (F)',
      text: '⚑',
      onclick: () => {
        const on = store.toggleFlag(question.id);
        flagBtn.setAttribute('aria-pressed', String(on));
      },
    });

    const timerEl = session.durationMs ? el('span', { class: 'pill' }) : null;

    body.append(el('div', { class: 'spread' }, [
      el('h1', { style: 'font-size:1.15rem;margin:0', text: `Question ${n} of ${total}` }),
      el('div', { class: 'row' }, [
        timerEl,
        flagBtn,
        el('button', {
          class: 'btn secondary', type: 'button', text: 'End quiz',
          onclick: () => {
            const answered = Object.keys(session.answers).length;
            const msg = answered === total
              ? 'Submit this quiz now?'
              : answered
              ? `End this quiz now? ${answered} of ${total} answered — the rest count as unanswered.`
              : 'End this quiz? Nothing has been answered yet, so it will be discarded.';
            if (!window.confirm(msg)) return;
            if (!answered) { store.clearActiveQuiz(); teardown(); navigate('#/home'); return; }
            finish(session, navigate);
          },
        }),
      ]),
    ]));

    body.append(el('div', { class: 'progress', role: 'progressbar',
      'aria-valuenow': String(n), 'aria-valuemin': '1', 'aria-valuemax': String(total),
      style: 'margin:.6rem 0' }, [
      el('span', { style: `width:${(n / total) * 100}%` }),
    ]));

    body.append(el('div', { class: 'qmeta' }, [
      el('span', { class: 'pill',
        text: `Domain ${question.domain} · ${DOMAINS[question.domain]?.title || ''}` }),
      question.objective
        ? el('span', { class: 'pill', text: `${question.objective} ${question.objectiveTitle || ''}` })
        : null,
    ]));

    /* ---- question ---- */
    const qtext = el('div', { class: 'qtext' });
    qtext.append(renderQuestionText(question.question));
    body.append(qtext);

    if (multi) {
      body.append(el('p', { class: 'faint',
        text: `Select ${NUM_WORD[question.correct.length] || question.correct.length}.` }));
    }

    /* ---- choices ---- */
    const group = el('fieldset', { class: 'choices' });
    const buttons = new Map();

    // Declared before the choice loop, which references it from a handler.
    const submitBtn = el('button', {
      class: 'btn', type: 'button', text: 'Submit answer',
      disabled: picked.length === 0, onclick: () => commit(),
    });

    const stateFor = (key) => {
      if (!revealed) return picked.includes(key) ? 'selected' : '';
      if (question.correct.includes(key)) return 'correct';
      if (picked.includes(key)) return 'wrong';
      return '';
    };

    const paint = () => {
      for (const [key, btn] of buttons) {
        const st = stateFor(key);
        btn.dataset.state = st;
        btn.setAttribute('aria-pressed', String(picked.includes(key)));
        const mark = btn.querySelector('.mark');
        clear(mark);
        if (st === 'correct') {
          mark.append(el('span', { class: 'statelabel', text: '✓ Correct' }));
        } else if (st === 'wrong') {
          mark.append(el('span', { class: 'statelabel', text: '✗ Your answer' }));
        } else if (st === 'selected') {
          mark.append(el('span', { class: 'statelabel', text: '● Selected' }));
        }
      }
    };

    const commit = () => {
      if (session.revealed[question.id]) return;
      session.answers[question.id] = [...picked];
      if (session.feedbackMode === 'immediate') {
        store.recordAttempt(question.id, {
          correct: isCorrect(question, picked), selected: picked, quizId: session.id,
        });
        session.revealed[question.id] = true;
        store.setActiveQuiz(session);
        draw();
      } else {
        store.setActiveQuiz(session);
        advance();
      }
    };

    for (const key of order) {
      const choice = question.choices.find((c) => c.key === key);
      if (!choice) continue;
      const btn = el('button', {
        class: 'choice', type: 'button', disabled: revealed,
        'aria-pressed': 'false',
        onclick: () => {
          if (revealed) return;
          if (multi) {
            const i = picked.indexOf(key);
            if (i === -1) picked.push(key); else picked.splice(i, 1);
            session.answers[question.id] = [...picked];
            store.setActiveQuiz(session);
            paint();
            submitBtn.disabled = picked.length === 0;
          } else {
            picked.length = 0;
            picked.push(key);
            commit();
          }
        },
      }, [
        el('span', { class: 'key', 'aria-hidden': 'true', text: key }),
        el('span', { class: 'body' }, [renderQuestionText(choice.text)]),
        el('span', { class: 'mark' }),
      ]);
      buttons.set(key, btn);
      group.append(btn);
    }
    body.append(group);
    paint();

    /* ---- submit / next ---- */
    if (multi && !revealed) {
      body.append(el('div', { style: 'margin-top:.9rem' }, [submitBtn]));
    }

    /* ---- feedback ---- */
    if (revealed) {
      const correctKeys = question.correct;
      const got = isCorrect(question, picked);
      const correctText = correctKeys
        .map((k) => question.choices.find((c) => c.key === k))
        .filter(Boolean)
        .map((c) => `${c.key}. ${c.text}`)
        .join('  |  ');

      const panel = el('div', { class: `explain ${got ? 'is-right' : 'is-wrong'}` }, [
        el('div', { class: 'explain-head' }, [
          el('span', { class: 'verdict', text: got ? '✓ Correct' : '✗ Incorrect' }),
          el('span', { class: 'explain-key', text: `Answer: ${correctKeys.join(', ')}` }),
        ]),
      ]);

      // Pocket Prep's pattern: the explanation opens by itself when you got it
      // wrong, and sits one tap away when you got it right.
      const details = el('details', { class: 'explain-more', open: got ? null : '' }, [
        el('summary', {}, [
          el('span', { class: 'when-closed', text: 'Show explanation' }),
          el('span', { class: 'when-open', text: 'Hide explanation' }),
        ]),
      ]);
      const inner = el('div', { class: 'explain-body' }, [
        el('p', { class: 'explain-correct' }, [el('b', { text: 'Correct: ' }), correctText]),
      ]);
      if (question.explanation) {
        inner.append(el('p', { text: question.explanation }));
      } else {
        inner.append(el('p', { class: 'faint',
          text: 'No explanation available for this question yet.' }));
      }
      const wrongs = Object.entries(question.incorrectExplanations || {})
        .filter(([k]) => !correctKeys.includes(k));
      if (wrongs.length) {
        inner.append(el('h3', { text: 'Why the others are wrong' }));
        inner.append(el('ul', { class: 'wrongs' },
          wrongs.map(([k, why]) => el('li', {}, [el('span', { class: 'wkey', text: k }), el('span', { text: why })]))));
      }
      details.append(inner);
      panel.append(details);
      body.append(panel);
    }

    /* ---- previous / next ---- */
    const last = session.index >= total - 1;
    const answeredCount = session.questionIds.filter((id) => (session.answers[id] || []).length).length;
    body.append(el('div', { class: 'qnav' }, [
      el('button', {
        class: 'btn secondary', type: 'button', text: '← Previous',
        disabled: session.index === 0, onclick: () => goTo(session.index - 1),
        'aria-keyshortcuts': 'ArrowLeft',
      }),
      el('span', { class: 'faint qnav-count', text: `${answeredCount}/${total} answered` }),
      last
        ? el('button', { class: 'btn', type: 'button', text: 'Finish quiz', onclick: () => submitAll() })
        : el('button', {
          class: revealed || picked.length ? 'btn' : 'btn secondary', type: 'button',
          text: revealed || picked.length ? 'Next question →' : 'Skip →',
          onclick: () => goTo(session.index + 1), 'aria-keyshortcuts': 'ArrowRight',
        }),
    ]));

    /* ---- question map: jump anywhere, see what is answered and flagged ---- */
    const map = el('div', { class: 'qmap', role: 'list' });
    session.questionIds.forEach((id, i) => {
      const ans = (session.answers[id] || []).length > 0;
      const q = QUESTIONS_BY_ID.get(id);
      let st = ans ? 'answered' : '';
      if (ans && session.revealed[id] && q) st = isCorrect(q, session.answers[id]) ? 'right' : 'wrong';
      map.append(el('button', {
        type: 'button', role: 'listitem', class: 'qmap-cell', text: String(i + 1),
        'data-state': st, 'data-flag': String(store.isFlagged(id)),
        'aria-current': i === session.index ? 'step' : null,
        'aria-label': `Question ${i + 1}${ans ? ', answered' : ''}${store.isFlagged(id) ? ', flagged' : ''}`,
        onclick: () => goTo(i),
      }));
    });
    body.append(el('details', { class: 'card qmap-wrap', open: total <= 30 ? '' : null }, [
      el('summary', { text: 'All questions' }),
      map,
    ]));

    /* ---- shortcut legend ---- */
    body.append(el('details', { class: 'card', style: 'margin-top:1.2rem' }, [
      el('summary', { class: 'faint', text: '? Keyboard shortcuts' }),
      el('p', { class: 'faint', style: 'margin:.5rem 0 0',
        text: '1–8 select a choice · Enter submit or next · ← → previous / next · F flag · Esc end quiz' }),
    ]));

    /* ---- keyboard ---- */
    keyHandler = (ev) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const tag = (ev.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (/^[1-8]$/.test(ev.key)) {
        const idx = Number(ev.key) - 1;
        const key = order[idx];
        if (key && buttons.has(key)) { ev.preventDefault(); buttons.get(key).click(); }
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        if (revealed) advance();
        else if (picked.length) commit();
      } else if (ev.key === 'ArrowLeft' && session.index > 0) {
        ev.preventDefault(); goTo(session.index - 1);
      } else if (ev.key === 'ArrowRight' && session.index < total - 1) {
        ev.preventDefault(); goTo(session.index + 1);
      } else if (ev.key.toLowerCase() === 'f') {
        ev.preventDefault(); flagBtn.click();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        if (window.confirm('End this quiz?')) {
          if (Object.keys(session.answers).length) finish(session, navigate);
          else { store.clearActiveQuiz(); teardown(); navigate('#/home'); }
        }
      }
    };
    window.addEventListener('keydown', keyHandler);

    /* ---- mock exam timer ---- */
    if (timerEl) {
      const tick = () => {
        const left = remainingMs(session);
        if (left === null) return;
        const m = Math.floor(left / 60000);
        const s = Math.floor((left % 60000) / 1000);
        timerEl.textContent = `⏱ ${m}:${String(s).padStart(2, '0')}`;
        if (left <= 0) { clearInterval(timerId); timerId = null; finish(session, navigate); }
      };
      tick();
      timerId = setInterval(tick, 1000);
    }
  };

  function goTo(i) {
    if (i < 0 || i >= session.questionIds.length) return;
    session.index = i;
    store.setActiveQuiz(session);
    draw();
    window.scrollTo(0, 0);
  }

  // After answering, move to the next question still unanswered, wrapping
  // round, so skipped questions come back instead of being lost.
  function advance() {
    const ids = session.questionIds;
    for (let step = 1; step < ids.length; step += 1) {
      const i = (session.index + step) % ids.length;
      if (!(session.answers[ids[i]] || []).length) { goTo(i); return; }
    }
    // Everything is answered. Practice quizzes are done; a mock exam stays
    // open so answers can be reviewed and changed before submitting.
    if (session.feedbackMode === 'end') goTo(Math.min(session.index + 1, ids.length - 1));
    else submitAll();
  }

  function submitAll() {
    const total = session.questionIds.length;
    const answered = session.questionIds.filter((id) => (session.answers[id] || []).length).length;
    if (!answered) {
      if (window.confirm('Nothing has been answered yet, so this quiz will be discarded. End it?')) {
        store.clearActiveQuiz(); teardown(); navigate('#/home');
      }
      return;
    }
    if (answered < total && !window.confirm(
      `${total - answered} question${total - answered === 1 ? ' is' : 's are'} still unanswered and will count as wrong. Submit anyway?`)) return;
    finish(session, navigate);
  }

  draw();
}
