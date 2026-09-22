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
      el('h2', { text: 'No quiz in progress' }),
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
      el('strong', { text: `Question ${n} of ${total}` }),
      el('div', { class: 'row' }, [
        timerEl,
        flagBtn,
        el('button', {
          class: 'btn secondary', type: 'button', text: 'End quiz',
          onclick: () => {
            const answered = Object.keys(session.answers).length;
            const msg = answered
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
      const correct = isCorrect(question, picked);
      session.answers[question.id] = [...picked];
      store.recordAttempt(question.id, {
        correct, selected: picked, quizId: session.id,
      });
      if (session.feedbackMode === 'immediate') {
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

      const panel = el('div', { class: 'explain' }, [
        el('div', { class: 'row', style: 'margin-bottom:.4rem' }, [
          el('span', {
            class: 'statelabel',
            style: `color:var(--${got ? 'correct' : 'incorrect'})`,
            text: got ? '✓ Correct' : '✗ Incorrect',
          }),
        ]),
        el('h3', { text: `Correct answer: ${correctKeys.join(', ')}` }),
        el('p', { text: correctText }),
      ]);

      if (question.explanation) {
        panel.append(el('p', { text: question.explanation }));
      } else {
        panel.append(el('p', { class: 'faint',
          text: 'No explanation available for this question yet.' }));
      }

      const wrongs = Object.entries(question.incorrectExplanations || {})
        .filter(([k]) => !correctKeys.includes(k));
      if (wrongs.length) {
        panel.append(el('h3', { text: 'Why the others are wrong',
          style: 'margin-top:.8rem' }));
        panel.append(el('ul', { class: 'wrongs' },
          wrongs.map(([k, why]) => el('li', {}, [el('b', { text: `${k}. ` }), why]))));
      }

      const last = session.index >= total - 1;
      panel.append(el('div', { style: 'margin-top:.9rem' }, [
        el('button', {
          class: 'btn', type: 'button',
          text: last ? 'Finish quiz' : 'Next question',
          onclick: advance,
        }),
      ]));
      body.append(panel);
    }

    /* ---- shortcut legend ---- */
    body.append(el('details', { class: 'card', style: 'margin-top:1.2rem' }, [
      el('summary', { class: 'faint', text: '? Keyboard shortcuts' }),
      el('p', { class: 'faint', style: 'margin:.5rem 0 0',
        text: '1–8 select a choice · Enter submit or next · F flag · Esc end quiz' }),
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

  function advance() {
    if (keyHandler) { window.removeEventListener('keydown', keyHandler); keyHandler = null; }
    if (session.index >= session.questionIds.length - 1) { finish(session, navigate); return; }
    session.index += 1;
    store.setActiveQuiz(session);
    draw();
    window.scrollTo(0, 0);
  }

  draw();
}
