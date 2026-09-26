import { el, clear } from '../dom.js';
import * as store from '../store.js';
import * as st from '../stats.js';
import {
  ALL_QUESTIONS, DOMAINS, OBJECTIVES, createSession, selectQuestions,
} from '../quizEngine.js';
import { questionList } from '../components.js';
import { art } from '../art.js';

export async function renderReview(view, { navigate }) {
  const attempts = store.getAttempts();
  const all = st.missedHistory(ALL_QUESTIONS, attempts);

  view.append(el('h1', { text: 'Review' }));

  if (!all.length) {
    view.append(el('div', { class: 'empty' }, [
      el('span', { class: 'ic has-art' }, [art('missed', { size: 60 })]),
      el('h2', { text: 'Nothing missed yet' }),
      el('p', { class: 'muted',
        text: 'Every question you answer incorrectly collects here, so you can come back to it.' }),
      el('a', { class: 'btn', href: '#/home', text: 'Start a quiz' }),
    ]));
    return;
  }

  const filters = { domain: null, objective: null, state: 'all' };
  const card = el('div', { class: 'card' });
  const listHost = el('div');
  view.append(card, listHost);

  const apply = () => all.filter((r) => {
    if (filters.domain !== null && r.question.domain !== filters.domain) return false;
    if (filters.objective && r.question.objective !== filters.objective) return false;
    if (filters.state === 'still' && r.recovered) return false;
    if (filters.state === 'recovered' && !r.recovered) return false;
    return true;
  });

  function drawList() {
    clear(listHost);
    const rows = apply();
    const { node } = questionList(rows, {
      emptyMessage: 'Nothing matches these filters.',
      showMissCount: true,
      onChange: () => {},
    });
    listHost.append(el('div', { class: 'card' }, [node]));

    clear(actions);
    actions.append(el('button', {
      class: 'btn', type: 'button', disabled: !rows.length,
      text: `Quiz these ${rows.length}`,
      onclick: () => {
        const s = store.getSettings();
        store.setActiveQuiz(createSession({
          questions: selectQuestions(rows.map((r) => r.question), 'all',
            { shuffleQuestions: s.shuffleQuestions }),
          mode: 'review', config: { source: 'missed' },
          feedbackMode: s.feedbackMode, shuffleChoices: s.shuffleChoices,
        }));
        navigate('#/quiz');
      },
    }));
  }

  const actions = el('div', { style: 'margin-top:.8rem' });

  function drawFilters() {
    clear(card);
    card.append(el('h2', { text: `${all.length} missed question${all.length === 1 ? '' : 's'}` }));

    const stateChips = el('div', { class: 'chips', style: 'margin-bottom:.6rem' },
      [['all', 'All'], ['still', 'Still missed'], ['recovered', 'Recovered']].map(([k, label]) =>
        el('button', {
          class: 'chip', type: 'button', text: label,
          'aria-pressed': String(filters.state === k),
          onclick: () => { filters.state = k; drawFilters(); drawList(); },
        })));

    const domSel = el('select', {
      class: 'numinput', 'aria-label': 'Filter by domain',
      onchange: (ev) => {
        filters.domain = ev.currentTarget.value ? Number(ev.currentTarget.value) : null;
        filters.objective = null;
        drawFilters(); drawList();
      },
    }, [
      el('option', { value: '', text: 'All domains', selected: filters.domain === null }),
      ...Object.entries(DOMAINS).map(([id, m]) => el('option', {
        value: id, selected: filters.domain === Number(id),
        text: `Domain ${id} — ${m.title}`,
      })),
    ]);

    const objOptions = Object.entries(OBJECTIVES)
      .filter(([, o]) => filters.domain === null || o.domain === filters.domain);
    const objSel = el('select', {
      class: 'numinput', 'aria-label': 'Filter by objective',
      onchange: (ev) => { filters.objective = ev.currentTarget.value || null; drawList(); },
    }, [
      el('option', { value: '', text: 'All objectives', selected: !filters.objective }),
      ...objOptions.map(([id, o]) => el('option', {
        value: id, selected: filters.objective === id, text: `${id} ${o.title}`,
      })),
    ]);

    card.append(stateChips, el('div', { class: 'row' }, [domSel, objSel]), actions);
  }

  drawFilters();
  drawList();
}
