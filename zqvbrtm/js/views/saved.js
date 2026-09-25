import { el, clear } from '../dom.js';
import * as store from '../store.js';
import {
  ALL_QUESTIONS, QUESTIONS_BY_ID, DOMAINS, createSession, selectQuestions,
} from '../quizEngine.js';
import { questionList } from '../components.js';

export async function renderSaved(view, { navigate }) {
  view.append(el('h1', { text: 'Saved' }));

  const card = el('div', { class: 'card' });
  const listHost = el('div');
  view.append(card, listHost);

  let domainFilter = null;

  function current() {
    return store.getFlagged()
      .map((id) => QUESTIONS_BY_ID.get(id))
      .filter(Boolean)
      .filter((q) => domainFilter === null || q.domain === domainFilter);
  }

  function draw() {
    const flagged = store.getFlagged();
    clear(card);
    clear(listHost);

    if (!flagged.length) {
      clear(card);
      view.querySelectorAll('.card').forEach((n) => n.remove());
      listHost.append(el('div', { class: 'empty' }, [
        el('span', { class: 'ic', 'aria-hidden': 'true', text: '⚑' }),
        el('h2', { text: 'Nothing saved yet' }),
        el('p', { class: 'muted',
          text: 'Tap the flag on any question during a quiz and it lands here.' }),
        el('a', { class: 'btn', href: '#/home', text: 'Start a quiz' }),
      ]));
      return;
    }

    const rows = current();
    card.append(el('h2', { text: `${flagged.length} saved question${flagged.length === 1 ? '' : 's'}` }));
    card.append(el('div', { class: 'row' }, [
      el('select', {
        class: 'numinput', 'aria-label': 'Filter by domain',
        onchange: (ev) => {
          domainFilter = ev.currentTarget.value ? Number(ev.currentTarget.value) : null;
          draw();
        },
      }, [
        el('option', { value: '', text: 'All domains', selected: domainFilter === null }),
        ...Object.entries(DOMAINS).map(([id, m]) => el('option', {
          value: id, selected: domainFilter === Number(id),
          text: `Domain ${id} — ${m.title}`,
        })),
      ]),
      el('button', {
        class: 'btn', type: 'button', disabled: !rows.length,
        text: `Quiz my ${rows.length} saved`,
        onclick: () => {
          const s = store.getSettings();
          store.setActiveQuiz(createSession({
            questions: selectQuestions(rows, 'all', { shuffleQuestions: s.shuffleQuestions }),
            mode: 'saved', config: { source: 'flagged' },
            feedbackMode: s.feedbackMode, shuffleChoices: s.shuffleChoices,
          }));
          navigate('#/quiz');
        },
      }),
    ]));

    const { node } = questionList(rows.map((q) => ({ question: q })), {
      emptyMessage: 'Nothing saved in this domain.',
      onChange: draw,          // unflagging inline removes the row
    });
    listHost.append(el('div', { class: 'card' }, [node]));
  }

  draw();
}
