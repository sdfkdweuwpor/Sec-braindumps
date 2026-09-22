import { el } from '../dom.js';

/** Placeholder until Checkpoint stats lands. */
export async function renderStats(view) {
  view.append(el('div', { class: 'empty' }, [
    el('span', { class: 'ic', 'aria-hidden': 'true', text: '\u{1F6A7}' }),
    el('h2', { text: 'Not built yet' }),
    el('p', { class: 'muted', text: 'This screen arrives in a later checkpoint.' }),
    el('a', { class: 'btn', href: '#/home', text: 'Back to Study' }),
  ]));
}
