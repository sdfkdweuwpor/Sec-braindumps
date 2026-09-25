import { el, clear, renderQuestionText } from '../dom.js';
import * as store from '../store.js';
import { confirmDialog } from '../components.js';
import {
  QUESTIONS_BY_ID, DOMAINS, isCorrect, scoreQuiz, sessionQuestions, remainingMs,
  createSession, similarQuestions, letterMap,
} from '../quizEngine.js';
import { icon } from '../icons.js';
import {
  slideIn, cascade, rise, pop, shake, ring, burst, drawIcon, growBar,
} from '../motion.js';
import { play } from '../sound.js';
import { reviewState, STEPS } from '../srs.js';

const DRILL_SIZE = 10;

const NUM_WORD = { 1: 'ONE', 2: 'TWO', 3: 'THREE', 4: 'FOUR', 5: 'FIVE' };

let keyHandler = null;
let timerId = null;

function teardown() {
  if (keyHandler) { window.removeEventListener('keydown', keyHandler); keyHandler = null; }
  if (timerId) { clearInterval(timerId); timerId = null; }
}

function saveResult(session) {
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
    // Kept so the results screen shows the same letters the quiz showed.
    choiceOrder: session.choiceOrder,
  };
  store.saveQuizResult(result);
  return result;
}

function finish(session, navigate) {
  // The mock timer and a confirmation can both reach here; score once.
  if (session.finished) return;
  session.finished = true;
  const result = saveResult(session);
  store.clearActiveQuiz();
  if (session.mode === 'similar') store.resumePausedQuiz();
  teardown();
  navigate(`#/results?id=${encodeURIComponent(result.id)}`);
}

export async function renderQuiz(view, { navigate }) {
  teardown();
  const session = store.getActiveQuiz();
  if (session && session.mode !== 'similar' && store.getPausedQuiz()) store.clearPausedQuiz();

  if (!session) {
    view.append(el('div', { class: 'empty' }, [
      el('span', { class: 'ic' }, [icon('study', { size: 34 })]),
      el('h1', { text: 'No quiz in progress' }),
      el('p', { class: 'muted', text: 'Start one from the Study screen.' }),
      el('a', { class: 'btn', href: '#/home', text: 'Back to Study' }),
    ]));
    return;
  }

  const body = el('div', { class: 'quizbody' });
  view.append(body);

  // How the next draw should move: 'first' (the screen's own entrance runs),
  // 'next' / 'prev' (slide in from that side), or 'reveal' (answer checked).
  let motion = 'first';
  let lastPct = 0;

  const draw = () => {
    const how = motion;
    motion = 'next';
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
    const L = letterMap(order);            // original key -> letter shown
    const byShown = (a, b) => L[a].localeCompare(L[b]);
    const drill = session.mode === 'similar';
    // Smart review: the rung this question was on when the review started.
    const srsStep = session.mode === 'smart' && session.srs && Number.isInteger(session.srs[question.id])
      ? session.srs[question.id] : null;

    /* ---- header ---- */
    const flagBtn = el('button', {
      class: 'iconbtn', type: 'button',
      'aria-pressed': String(store.isFlagged(question.id)),
      'aria-label': 'Flag this question to review later',
      title: 'Flag (F)',
      onclick: () => {
        const on = store.toggleFlag(question.id);
        flagBtn.setAttribute('aria-pressed', String(on));
        if (on) { pop(flagBtn.firstChild, { scale: 1.35 }); ring(flagBtn, 'rgba(233,191,98,.55)'); play('flag'); }
      },
    }, [icon('flag')]);

    const timerEl = session.durationMs ? el('span', { class: 'pill' }) : null;

    if (drill && session.from) {
      body.append(el('div', { class: 'drill-banner' }, [
        icon('similar', { size: 22 }),
        el('div', {}, [
          el('b', { text: 'Similar questions' }),
          el('span', { text: `More practice on ${session.from.objective ? `${session.from.objective} ${session.from.objectiveTitle || ''}` : 'this topic'}, from question ${session.from.index} of your quiz. Your quiz is paused.` }),
        ]),
      ]));
    }

    body.append(el('div', { class: 'quizhead' }, [
      el('h1', { class: 'qcount' }, [
        el('span', { text: `Question ${n}` }), el('span', { class: 'qof', text: ` of ${total}` }),
      ]),
      el('div', { class: 'row' }, [
        timerEl,
        flagBtn,
        el('button', {
          class: 'btn secondary', type: 'button',
          onclick: () => (drill ? exitDrill() : endQuiz()),
        }, drill ? [icon('back', { size: 18 }), 'Back to my quiz'] : ['End quiz']),
      ]),
    ]));

    const pct = (n / total) * 100;
    const fill = el('span', { style: `width:${pct}%` });
    body.append(el('div', { class: 'progress qprogress', role: 'progressbar',
      'aria-valuenow': String(n), 'aria-valuemin': '1', 'aria-valuemax': String(total),
      style: 'margin:.6rem 0' }, [fill]));
    if (how !== 'reveal' && pct !== lastPct) growBar(fill, { from: `${lastPct}%`, duration: 520 });
    lastPct = pct;

    body.append(el('div', { class: 'qmeta' }, [
      el('span', { class: 'pill',
        text: `Domain ${question.domain} · ${DOMAINS[question.domain]?.title || ''}` }),
      question.objective
        ? el('span', { class: 'pill', text: `${question.objective} ${question.objectiveTitle || ''}` })
        : null,
      srsStep !== null
        ? el('span', { class: 'pill pill-srs' }, [icon('smart', { size: 14 }), `Smart review · ${STEPS[srsStep]}-day check`])
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
          mark.append(el('span', { class: 'statelabel' }, [icon('check', { size: 16 }), 'Correct']));
        } else if (st === 'wrong') {
          mark.append(el('span', { class: 'statelabel' }, [icon('x', { size: 16 }), 'Your answer']));
        } else if (st === 'selected') {
          mark.append(el('span', { class: 'statelabel', text: 'Selected' }));
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
        const right = isCorrect(question, picked);
        session.streak = right ? (session.streak || 0) + 1 : 0;
        store.setActiveQuiz(session);
        motion = 'reveal';
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
            if (i === -1) pop(btn.querySelector('.key'), { scale: 1.2 });
            play('select');
            submitBtn.disabled = picked.length === 0;
          } else {
            picked.length = 0;
            picked.push(key);
            if (session.feedbackMode !== 'immediate') {
              paint(); pop(btn.querySelector('.key'), { scale: 1.2 }); play('select');
            }
            commit();
          }
        },
      }, [
        el('span', { class: 'key', 'aria-hidden': 'true', text: L[key] }),
        el('span', { class: 'body' }, [renderQuestionText(choice.text)]),
        el('span', { class: 'mark' }),
      ]);
      buttons.set(key, btn);
      group.append(btn);
    }
    body.append(group);
    paint();
    if (how === 'next' || how === 'prev' || how === 'first') {
      if (how !== 'first') slideIn(body, how === 'prev' ? -1 : 1);
      rise(qtext, { delay: how === 'first' ? 80 : 40, distance: 10 });
      cascade(group.children, { start: how === 'first' ? 160 : 110, step: 50 });
    }

    /* ---- submit / next ---- */
    if (multi && !revealed) {
      body.append(el('div', { style: 'margin-top:.9rem' }, [submitBtn]));
    }

    /* ---- feedback ---- */
    if (revealed) {
      const correctKeys = question.correct;
      const got = isCorrect(question, picked);
      const shownCorrect = [...correctKeys].sort(byShown);
      const correctText = shownCorrect
        .map((k) => question.choices.find((c) => c.key === k))
        .filter(Boolean)
        .map((c) => `${L[c.key]}. ${c.text}`)
        .join('  |  ');

      // Smart review outcome: where this answer moved the question.
      let srsChip = null;
      let masteredNow = false;
      if (srsStep !== null) {
        const after = reviewState(store.attemptsFor(question.id));
        const chip = (ic, text, cls = '') => el('span', { class: `srs-chip ${cls}` }, [icon(ic, { size: 15 }), text]);
        if (got && !after.state && after.mastered) {
          masteredNow = true;
          srsChip = chip('trophy', 'Mastered', 'is-mastered');
        } else if (got && after.state && after.state.step > srsStep) {
          srsChip = chip('clock', `Next check in ${STEPS[after.state.step]} days`);
        } else if (!got) {
          srsChip = chip('clock', srsStep === 0 ? 'Check again tomorrow' : 'Back to the 1-day check', 'is-reset');
        }
      }

      const panel = el('div', { class: `explain ${got ? 'is-right' : 'is-wrong'}` }, [
        el('div', { class: 'explain-head' }, [
          el('span', { class: 'verdict' }, [
            icon(got ? 'check' : 'x', { size: 20 }), got ? 'Correct' : 'Incorrect',
            got && how === 'reveal' && (session.streak || 0) >= 3
              ? el('span', { class: 'streak' }, [icon('flame', { size: 15 }), `${session.streak} in a row`])
              : null,
            srsChip,
          ]),
          el('div', { class: 'explain-tools' }, [
            session.feedbackMode === 'immediate' && !drill
              ? el('button', {
                class: 'similar-btn', type: 'button',
                title: `Practise ${DRILL_SIZE} more questions from the bank on this topic`,
                onclick: () => startSimilar(question),
              }, [icon('similar', { size: 17 }), 'Similar questions?'])
              : null,
            el('span', { class: 'explain-key', text: `Answer: ${shownCorrect.map((k) => L[k]).join(', ')}` }),
          ]),
        ]),
      ]);

      // Pocket Prep's pattern: the explanation opens by itself when you got it
      // wrong, and sits one tap away when you got it right.
      const details = el('details', { class: 'explain-more', open: got ? null : '' }, [
        el('summary', {}, [
          icon('bulb', { size: 18 }),
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
        .filter(([k]) => !correctKeys.includes(k) && L[k])
        .sort(([a], [b]) => byShown(a, b));
      if (wrongs.length) {
        inner.append(el('h3', { text: 'Why the others are wrong' }));
        inner.append(el('ul', { class: 'wrongs' },
          wrongs.map(([k, why]) => el('li', {}, [el('span', { class: 'wkey', text: L[k] }), el('span', { text: why })]))));
      }
      details.append(inner);
      panel.append(details);
      body.append(panel);

      if (how === 'reveal') {
        const shownRight = [...buttons].filter(([k]) => correctKeys.includes(k)).map(([, b]) => b);
        const shownWrong = [...buttons].filter(([k]) => picked.includes(k) && !correctKeys.includes(k)).map(([, b]) => b);
        shownWrong.forEach((b) => shake(b));
        shownRight.forEach((b, i) => {
          pop(b, { scale: 1.015, duration: 520 });
          pop(b.querySelector('.key'), { scale: 1.25 });
          ring(b, 'rgba(10,125,79,.28)');
          drawIcon(b.querySelector('.mark .icon'), { delay: 120 + i * 80 });
        });
        rise(panel, { delay: 140, distance: 16, duration: 480 });
        drawIcon(panel.querySelector('.verdict .icon'), { delay: 260, duration: 480 });
        const chip = panel.querySelector('.streak');
        if (chip) pop(chip, { scale: 1.25, duration: 600 });
        const srsEl = panel.querySelector('.srs-chip');
        if (srsEl) pop(srsEl, { scale: masteredNow ? 1.3 : 1.15, duration: 620 });
        if (got && shownRight[0]) burst(shownRight[0].querySelector('.key'), { count: masteredNow ? 40 : 22 });

        const streak = session.streak || 0;
        if (masteredNow) play('mastered');
        else if (got) play(streak >= 3 && (streak === 3 || streak % 5 === 0) ? 'streak' : 'correct');
        else play('wrong');
      }
    }

    /* ---- previous / next ---- */
    const last = session.index >= total - 1;
    body.append(el('div', { class: 'qnav' }, [
      el('button', {
        class: 'btn secondary navbtn', type: 'button',
        disabled: session.index === 0, onclick: () => goTo(session.index - 1),
        'aria-keyshortcuts': 'ArrowLeft',
      }, [icon('left', { size: 20 }), 'Previous']),
      last
        ? el('button', { class: 'btn navbtn', type: 'button', onclick: () => submitAll() },
          [drill ? 'Finish' : 'Finish quiz', icon('check', { size: 20 })])
        : el('button', {
          class: revealed || picked.length ? 'btn navbtn' : 'btn secondary navbtn', type: 'button',
          onclick: () => goTo(session.index + 1), 'aria-keyshortcuts': 'ArrowRight',
        }, [revealed || picked.length ? 'Next question' : 'Skip', icon('right', { size: 20 })]),
    ]));

    body.append(el('p', { class: 'kbd-hint' }, [
      icon('keyboard', { size: 18 }),
      'Keys: 1–6 pick an answer · Enter submit or next · ← → move · F flag · Esc end',
    ]));

    /* ---- keyboard ---- */
    keyHandler = (ev) => {
      // Left the quiz screen: this handler belongs to a quiz no longer shown.
      if (!body.isConnected) { teardown(); return; }
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (document.querySelector('.modal-backdrop')) return;
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
        if (session.mode === 'similar') exitDrill(); else endQuiz();
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
    motion = i < session.index ? 'prev' : 'next';
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

  const answeredCount = () =>
    session.questionIds.filter((id) => (session.answers[id] || []).length).length;

  // Pause this quiz and run a short quiz of the most similar bank questions.
  function startSimilar(question) {
    const picks = similarQuestions(question, { exclude: session.questionIds, limit: DRILL_SIZE });
    if (!picks.length) return;
    const drillSession = createSession({
      questions: picks, mode: 'similar', feedbackMode: 'immediate',
      config: { source: 'similar', from: question.id },
      shuffleChoices: store.getSettings().shuffleChoices,
    });
    drillSession.from = {
      id: question.id, index: session.index + 1,
      objective: question.objective, objectiveTitle: question.objectiveTitle,
    };
    store.setActiveQuiz(session);
    store.pauseQuiz(session);
    store.setActiveQuiz(drillSession);
    teardown();
    window.dispatchEvent(new Event('app:refresh'));
  }

  // Leave a drill early: keep what was answered, then return to the quiz.
  function exitDrill() {
    if (answeredCount() && !session.finished) {
      session.finished = true;
      saveResult(session);
    }
    store.clearActiveQuiz();
    store.resumePausedQuiz();
    teardown();
    window.dispatchEvent(new Event('app:refresh'));
  }

  // One path for the End quiz button and the Escape key.
  async function endQuiz() {
    const total = session.questionIds.length;
    const answered = answeredCount();
    if (!answered) {
      const ok = await confirmDialog({
        title: 'End this quiz?',
        message: 'Nothing has been answered yet, so the quiz will be discarded.',
        confirmText: 'Discard quiz', cancelText: 'Keep going', danger: true,
      });
      if (ok) { store.clearActiveQuiz(); teardown(); navigate('#/home'); }
      return;
    }
    const all = answered === total;
    const ok = await confirmDialog({
      title: all ? 'Submit this quiz?' : 'End this quiz now?',
      message: all
        ? 'Every question is answered. Your score is worked out when you submit.'
        : `${answered} of ${total} answered. The other ${total - answered} will count as wrong.`,
      confirmText: all ? 'Submit' : 'End and score', cancelText: 'Keep going',
    });
    if (ok) finish(session, navigate);
  }

  async function submitAll() {
    const total = session.questionIds.length;
    const answered = answeredCount();
    if (!answered) { endQuiz(); return; }
    if (answered < total) {
      const left = total - answered;
      const ok = await confirmDialog({
        title: `${left} question${left === 1 ? '' : 's'} unanswered`,
        message: `Unanswered questions count as wrong. Submit now, or go back and answer ${left === 1 ? 'it' : 'them'}?`,
        confirmText: 'Submit anyway', cancelText: 'Keep going',
      });
      if (!ok) return;
    }
    finish(session, navigate);
  }

  draw();
}
