import { el, clear } from '../dom.js';
import * as store from '../store.js';
import * as st from '../stats.js';
import { ALL_QUESTIONS, DOMAINS } from '../quizEngine.js';
import { readinessCard, accuracyBar, sparkline, confirmDialog } from '../components.js';
import { art } from '../art.js';
import { levelCard } from '../levels.js';

function pct(v) { return v === null ? '—' : `${Math.round(v * 100)}%`; }

export async function renderStats(view, { navigate }) {
  const attempts = store.getAttempts();
  const quizzes = store.getQuizzes();
  const o = st.overall(ALL_QUESTIONS, attempts);

  view.append(el('h1', { text: 'Stats' }));

  if (!o.answered) {
    view.append(el('div', { class: 'empty' }, [
      el('span', { class: 'ic has-art' }, [art('stats', { size: 60 })]),
      el('h2', { text: 'Nothing to measure yet' }),
      el('p', { class: 'muted',
        text: `${o.total} questions are loaded. Answer some and this fills in.` }),
      el('a', { class: 'btn', href: '#/home', text: 'Start a quiz' }),
    ]));
    return;
  }

  /* ---- level and XP ---- */
  view.append(levelCard());

  /* ---- overall ---- */
  view.append(el('div', { class: 'card' }, [
    el('h2', { text: 'Overall' }),
    el('div', { class: 'statrow' }, [
      el('div', { class: 'head' }, [
        el('span', { text: 'Questions seen' }),
        el('span', { class: 'nums', text: `${o.seen} of ${o.total} · ${Math.round(o.coverage * 100)}%` }),
      ]),
      accuracyBar(o.coverage),
    ]),
    el('div', { class: 'statrow' }, [
      el('div', { class: 'head' }, [
        el('span', { text: 'Lifetime accuracy' }),
        el('span', { class: 'nums', text: `${o.correct} of ${o.answered} answers · ${pct(o.accuracy)}` }),
      ]),
      accuracyBar(o.accuracy),
    ]),
  ]));

  /* ---- readiness ---- */
  view.append(readinessCard(st.readiness(ALL_QUESTIONS, attempts), { navigate }));

  /* ---- per domain, expandable to objectives ---- */
  const domCard = el('div', { class: 'card' }, [el('h2', { text: 'By domain' })]);
  for (const d of st.byDomain(ALL_QUESTIONS, attempts)) {
    const objs = st.byObjective(ALL_QUESTIONS, attempts, d.domain);
    domCard.append(el('details', { class: 'statrow' }, [
      el('summary', {}, [
        el('span', { class: 'stem' }, [
          el('div', { class: 'head' }, [
            el('span', { text: `D${d.domain} ${d.title}` }),
            el('span', { class: 'nums',
              text: `${d.seen}/${d.total} seen · ${pct(d.accuracy)} · ${d.weight}% of exam` }),
          ]),
          accuracyBar(d.accuracy),
        ]),
      ]),
      el('div', { style: 'padding:.4rem 0 .2rem 1rem' },
        objs.map((ob) => el('div', { class: 'statrow' }, [
          el('div', { class: 'head' }, [
            el('span', { style: 'font-size:.9rem', text: `${ob.objective} ${ob.title}` }),
            el('span', { class: 'nums', text: `${ob.seen}/${ob.total} · ${pct(ob.accuracy)}` }),
          ]),
          accuracyBar(ob.accuracy),
        ]))),
    ]));
  }
  view.append(domCard);

  /* ---- trend ---- */
  view.append(el('div', { class: 'card' }, [
    el('h2', { text: 'Accuracy over time' }),
    sparkline(st.accuracyOverTime(quizzes, 20)),
    el('p', { class: 'faint', text: `Last ${Math.min(quizzes.length, 20)} quiz${quizzes.length === 1 ? '' : 'zes'}.` }),
  ]));

  /* ---- weakest ---- */
  const weak = st.weakestObjectives(ALL_QUESTIONS, attempts, { limit: 5, minAttempts: 5 });
  const weakCard = el('div', { class: 'card' }, [el('h2', { text: 'Weakest objectives' })]);
  if (!weak.length) {
    weakCard.append(el('p', { class: 'muted',
      text: 'An objective needs at least 5 answered questions before it can be ranked. '
          + 'Keep going and the weak spots will show up here.' }));
  } else {
    for (const w of weak) {
      weakCard.append(el('div', { class: 'statrow' }, [
        el('div', { class: 'head' }, [
          el('span', { text: `${w.objective} ${w.title}` }),
          el('span', { class: 'nums', text: `${pct(w.accuracy)} over ${w.answered} answers` }),
        ]),
        accuracyBar(w.accuracy),
      ]));
    }
    weakCard.append(el('button', {
      class: 'btn', type: 'button', style: 'margin-top:.8rem',
      text: 'Practice these',
      onclick: () => {
        window.sessionStorage.setItem(store.PREFILL_KEY,
          JSON.stringify({ source: 'objective', objectives: weak.map((w) => w.objective) }));
        navigate('#/build?prefill=1');
      },
    }));
  }
  view.append(weakCard);

  /* ---- settings / data ---- */
  const dataCard = el('div', { class: 'card' }, [el('h2', { text: 'Your data' })]);
  dataCard.append(el('p', { class: 'muted',
    text: 'Progress lives in this browser only. To move it to another device, export it here and import it there.' }));
  const panel = el('div', { class: 'datapanel' });
  const refresh = () => window.dispatchEvent(new Event('app:refresh'));

  // Errors go under whatever is in the panel, so a bad paste can be fixed in place.
  const showError = (text) => {
    let p = panel.querySelector('.reason');
    if (!p) { p = el('p', { class: 'reason', role: 'alert' }); panel.append(p); }
    p.textContent = text;
  };

  const importText = async (raw) => {
    panel.querySelector('.reason')?.remove();
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      showError('That is not exported progress. Paste the whole text from Export progress, including the braces.');
      return;
    }
    const ok = await confirmDialog({
      title: 'Replace your progress?',
      message: 'Importing replaces every answer, flag and quiz stored in this browser.',
      confirmText: 'Replace', danger: true,
    });
    if (!ok) return;
    try {
      store.importProgress(payload);
      refresh();
    } catch (err) {
      showError(`Could not import that progress. ${err.message}`);
    }
  };

  const exportProgress = () => {
    const json = JSON.stringify(store.exportProgress(), null, 2);
    // Some embedded viewers block downloads, so the same text is always
    // shown for copying as well.
    try {
      const a = el('a', {
        href: URL.createObjectURL(new Blob([json], { type: 'application/json' })),
        download: `${store.APP_ID}-progress-${new Date().toISOString().slice(0, 10)}.json`,
      });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch { /* the copy box below still works */ }
    clear(panel);
    const box = el('textarea', {
      id: 'export-text', class: 'codebox', rows: '6', readonly: '',
      'aria-label': 'Exported progress',
    });
    box.value = json;
    const copyBtn = el('button', {
      class: 'btn secondary', type: 'button', text: 'Copy to clipboard',
      onclick: async () => {
        try {
          await navigator.clipboard.writeText(json);
          copyBtn.textContent = 'Copied';
        } catch {
          box.focus(); box.select();
          copyBtn.textContent = 'Selected — copy with Ctrl+C or ⌘C';
        }
      },
    });
    panel.append(
      el('p', { class: 'faint',
        text: 'If no file downloaded, copy this text and use Paste progress on the other device.' }),
      box, el('div', { class: 'row' }, [copyBtn]),
    );
  };

  const pasteProgress = () => {
    clear(panel);
    const box = el('textarea', {
      id: 'import-text', class: 'codebox', rows: '6',
      placeholder: 'Paste exported progress here', 'aria-label': 'Paste exported progress',
    });
    panel.append(box, el('div', { class: 'row' }, [
      el('button', { class: 'btn', type: 'button', text: 'Import pasted progress',
        onclick: () => importText(box.value) }),
    ]));
    box.focus();
  };

  dataCard.append(el('div', { class: 'row' }, [
    el('button', { class: 'btn secondary', type: 'button', text: 'Export progress', onclick: exportProgress }),
    el('label', { class: 'btn secondary', style: 'cursor:pointer' }, [
      'Import file',
      el('input', {
        id: 'import-file', type: 'file', accept: 'application/json,.json', style: 'display:none',
        onchange: async (ev) => {
          const file = ev.currentTarget.files[0];
          ev.currentTarget.value = '';
          if (file) importText(await file.text());
        },
      }),
    ]),
    el('button', { class: 'btn secondary', type: 'button', text: 'Paste progress', onclick: pasteProgress }),
  ]));
  dataCard.append(panel);

  const resetWrap = el('div', { style: 'margin-top:1rem' });
  resetWrap.append(el('button', {
    class: 'btn danger', type: 'button', text: 'Reset all progress',
    onclick: () => {
      clear(resetWrap);
      const field = el('input', {
        class: 'numinput', type: 'text', style: 'width:12rem',
        placeholder: 'RESET', 'aria-label': 'Type RESET to confirm',
      });
      resetWrap.append(
        el('p', { class: 'reason',
          text: 'This deletes every answer, flag and quiz on this device. Type RESET to confirm.' }),
        el('div', { class: 'row' }, [
          field,
          el('button', {
            class: 'btn danger', type: 'button', text: 'Confirm reset',
            onclick: () => {
              if (field.value.trim() !== 'RESET') {
                field.focus();
                return;
              }
              store.resetProgress();
              refresh();
            },
          }),
          el('button', {
            class: 'btn secondary', type: 'button', text: 'Cancel',
            onclick: () => { clear(resetWrap); renderStats(clear(view), { navigate }); },
          }),
        ]));
      field.focus();
    },
  }));
  dataCard.append(resetWrap);
  view.append(dataCard);
}
