import { el, clear } from '../dom.js';
import { reduced, EASE } from '../motion.js';
import * as store from '../store.js';
import { icon } from '../icons.js';
import { questionList } from '../components.js';
import { ALL_QUESTIONS, createSession, selectQuestions } from '../quizEngine.js';
import { searchQuestions, queryTerms, highlightPattern } from '../search.js';

/** Most questions one quiz from search results takes. */
const QUIZ_CAP = 50;

/** Starter topics, each checked to match a useful number of questions. */
export const SUGGESTIONS = ['SAML', 'Tabletop', 'Zero trust', 'Ransomware', 'SOAR', 'SIEM', '802.1X', 'Phishing'];

/**
 * Example searches take turns in an empty search box: each word slides up
 * and out as the next slides in, every few seconds. The hint is decoration
 * (the box keeps its aria-label) and hides as soon as anything is typed.
 */
export function rotatePlaceholder(input, words, { lead = 'Try ', every = 3200 } = {}) {
  if (!input || !words.length) return;
  const word = el('b', { text: words[0] });
  const hint = el('span', { class: 'ph-rot', 'aria-hidden': 'true' }, [lead, word]);
  const wrap = el('span', { class: 'ph-wrap' });
  input.replaceWith(wrap);
  wrap.append(input, hint);
  input.placeholder = '';
  const sync = () => wrap.classList.toggle('has-text', !!input.value);
  input.addEventListener('input', sync);
  sync();
  if (reduced() || words.length < 2) return;
  let i = 0;
  const timer = setInterval(() => {
    if (!wrap.isConnected) { clearInterval(timer); return; }
    if (input.value || document.hidden) return;
    i = (i + 1) % words.length;
    const out = word.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-70%)', opacity: 0 }],
      { duration: 240, easing: 'ease-in', fill: 'forwards' });
    out.finished.then(() => {
      word.textContent = words[i];
      out.cancel();
      word.animate([{ transform: 'translateY(70%)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 380, easing: EASE });
    }, () => {});
  }, every);
}

function statusOf(id, attempts) {
  const list = (attempts[id] && attempts[id].attempts) || [];
  if (!list.length) return { key: 'unseen', text: 'Not seen' };
  return list[list.length - 1].correct
    ? { key: 'right', text: 'Last: right' }
    : { key: 'missed', text: 'Last: missed' };
}

export async function renderSearch(view, { params, navigate }) {
  const initial = params.get('q') || '';
  view.append(el('h1', { text: 'Search questions' }));

  const input = el('input', {
    id: 'search-q', class: 'search-input', type: 'search', value: initial,
    placeholder: 'Try SAML, tabletop or 802.1X', autocomplete: 'off',
    'aria-label': 'Search the question bank', enterkeyhint: 'search',
  });
  const form = el('form', { class: 'search-form', role: 'search' }, [
    el('span', { class: 'search-ic', 'aria-hidden': 'true' }, [icon('search', { size: 20 })]),
    input,
  ]);
  rotatePlaceholder(input, SUGGESTIONS);
  const summary = el('p', { class: 'search-summary', 'aria-live': 'polite' });
  const quizBtn = el('button', { class: 'btn', type: 'button', hidden: true });
  const chips = el('div', { class: 'chips search-chips' });
  const listHost = el('div');
  const card = el('div', { class: 'card search-card-page' }, [
    form,
    el('div', { class: 'search-bar' }, [summary, quizBtn]),
    chips,
  ]);
  view.append(card, el('div', { class: 'card' }, [listHost]));

  let rows = [];

  const run = () => {
    const query = input.value.trim();
    const attempts = store.getAttempts();
    rows = searchQuestions(query, ALL_QUESTIONS)
      .map((r) => ({ ...r, status: statusOf(r.question.id, attempts) }));

    clear(chips);
    chips.hidden = !!query;
    if (!query) {
      chips.append(el('span', { class: 'faint', text: 'Popular topics:' }));
      for (const s of SUGGESTIONS) {
        chips.append(el('button', { class: 'chip', type: 'button', text: s,
          onclick: () => { input.value = s; input.dispatchEvent(new Event('input')); clearTimeout(timer); run(); } }));
      }
    }

    summary.textContent = !query
      ? `Search all ${ALL_QUESTIONS.length.toLocaleString()} questions: the question, the answers and the explanations.`
      : rows.length
        ? `${rows.length} question${rows.length === 1 ? '' : 's'} match “${query}”`
        : `Nothing matches “${query}”. Check the spelling, or try a shorter word.`;

    quizBtn.hidden = !rows.length;
    const n = Math.min(rows.length, QUIZ_CAP);
    clear(quizBtn);
    quizBtn.append(icon('study', { size: 18 }),
      rows.length > QUIZ_CAP ? `Quiz me on ${QUIZ_CAP} of these` : `Quiz me on ${n === 1 ? 'this one' : `these ${n}`}`);

    clear(listHost);
    listHost.parentElement.hidden = !query;
    if (query) {
      listHost.append(questionList(rows, {
        pageSize: 20, showNumber: true,
        highlight: highlightPattern(queryTerms(query)),
        emptyMessage: 'No questions to show.',
      }).node);
    }
  };

  quizBtn.addEventListener('click', () => {
    if (!rows.length) return;
    const s = store.getSettings();
    store.setActiveQuiz(createSession({
      questions: selectQuestions(rows.map((r) => r.question), QUIZ_CAP, { shuffleQuestions: s.shuffleQuestions }),
      mode: 'search', config: { source: 'search', query: input.value.trim() },
      feedbackMode: s.feedbackMode, shuffleChoices: s.shuffleChoices,
    }));
    navigate('#/quiz');
  });

  let timer = null;
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 140); });
  form.addEventListener('submit', (ev) => { ev.preventDefault(); clearTimeout(timer); run(); input.blur(); });

  run();
  // The router focuses the page after rendering; take focus back when there
  // is nothing typed yet so the viewer can start typing straight away.
  if (!initial) requestAnimationFrame(() => input.focus({ preventScroll: true }));
}
