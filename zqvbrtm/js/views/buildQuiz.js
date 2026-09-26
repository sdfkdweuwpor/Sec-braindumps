import { el, clear } from '../dom.js';
import * as store from '../store.js';
import {
  ALL_QUESTIONS, DOMAINS, OBJECTIVES, buildPool, selectQuestions,
  createSession, emptyPoolReason,
} from '../quizEngine.js';
import { takeMorph } from '../motion.js';

const COUNT_CHIPS = [10, 20, 25, 50, 100, 'all'];

/** Mutable builder state for this screen. */
function initialConfig(params) {
  // Stats hands over a prefilled config via sessionStorage rather than a long
  // URL; consumed once so a refresh does not silently re-apply it.
  if (params.get('prefill')) {
    try {
      const raw = window.sessionStorage.getItem(store.PREFILL_KEY);
      window.sessionStorage.removeItem(store.PREFILL_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return { source: p.source || 'all', domains: p.domains || [],
                 objectives: p.objectives || [], scope: p.scope || 'all',
                 excludeCorrectCount: 0, count: 25 };
      }
    } catch (err) {
      // A corrupt prefill is not worth failing the screen over.
    }
  }
  const source = params.get('source');
  const d = Number(params.get('d'));
  if (source === 'domain' && Number.isInteger(d) && d >= 1 && d <= 5) {
    return { source: 'domain', domains: [d], objectives: [], scope: 'all',
             excludeCorrectCount: 0, count: 25 };
  }
  return {
    source: ['all', 'domain', 'objective', 'missed', 'flagged'].includes(source) ? source : 'all',
    domains: [],
    objectives: [],
    scope: 'all',
    excludeCorrectCount: 0,
    count: 25,
  };
}

export async function renderBuildQuiz(view, { params, navigate }) {
  const cfg = initialConfig(params);
  const settings = store.getSettings();
  const opts = {
    shuffleQuestions: settings.shuffleQuestions,
    shuffleChoices: settings.shuffleChoices,
    feedbackMode: settings.feedbackMode,
  };

  const ctx = () => ({
    questions: ALL_QUESTIONS,
    missedIds: store.missedIds(),
    flaggedIds: store.getFlagged(),
    correctCount: store.correctCount,
  });

  /** Count for one slice, honouring the current source but not the count cap. */
  const countFor = (patch) => buildPool({ ...cfg, ...patch }, ctx()).length;

  view.append(el('h1', { text: 'Build your own' }));

  const poolCard = el('div', { class: 'card' });
  const countCard = el('div', { class: 'card' });
  const optsCard = el('div', { class: 'card' });
  const startBar = el('div', { class: 'startbar' });
  view.append(poolCard, countCard, optsCard, startBar);
  // Opened from a Study card: that card grows into the first one here.
  takeMorph(poolCard);

  /* ------------------------------------------------ pool selector ---- */

  function domainChecklist(selected, onChange, filterScope) {
    return el('div', {},
      Object.entries(DOMAINS).map(([id, meta]) => {
        const d = Number(id);
        const n = filterScope
          ? countFor({ scope: 'domain', domains: [d], objectives: [] })
          : countFor({ source: 'domain', domains: [d] });
        const box = el('input', {
          type: 'checkbox', checked: selected.includes(d),
          onchange: () => {
            const i = selected.indexOf(d);
            if (i === -1) selected.push(d); else selected.splice(i, 1);
            onChange();
          },
        });
        return el('label', { class: 'optrow' }, [
          box,
          el('span', { class: 'label' }, [
            el('b', { text: `Domain ${d} — ${meta.title}` }),
            el('span', { text: `${meta.weight}% of the exam` }),
          ]),
          el('span', { class: 'count', text: `(${n})` }),
        ]);
      }));
  }

  function objectiveTree(selected, onChange, filterScope) {
    const list = el('ul', { class: 'tree' });

    for (const [id, meta] of Object.entries(DOMAINS)) {
      const d = Number(id);
      const kids = Object.entries(OBJECTIVES)
        .filter(([, o]) => o.domain === d)
        .map(([oid, o]) => ({ id: oid, title: o.title }));

      const chosen = kids.filter((k) => selected.includes(k.id));
      const parentBox = el('input', {
        type: 'checkbox',
        checked: chosen.length === kids.length && kids.length > 0,
        onchange: (ev) => {
          const on = ev.currentTarget.checked;
          for (const k of kids) {
            const i = selected.indexOf(k.id);
            if (on && i === -1) selected.push(k.id);
            if (!on && i !== -1) selected.splice(i, 1);
          }
          onChange();
        },
      });
      // Partial selection shows the indeterminate dash, not a tick.
      parentBox.indeterminate = chosen.length > 0 && chosen.length < kids.length;

      const domainTotal = filterScope
        ? countFor({ scope: 'objective', objectives: kids.map((k) => k.id), domains: [] })
        : countFor({ source: 'objective', objectives: kids.map((k) => k.id) });

      const kidList = el('ul', { class: 'kids' }, kids.map((k) => {
        const n = filterScope
          ? countFor({ scope: 'objective', objectives: [k.id], domains: [] })
          : countFor({ source: 'objective', objectives: [k.id] });
        return el('li', {}, [
          el('label', { class: 'optrow' }, [
            el('input', {
              type: 'checkbox', checked: selected.includes(k.id),
              onchange: () => {
                const i = selected.indexOf(k.id);
                if (i === -1) selected.push(k.id); else selected.splice(i, 1);
                onChange();
              },
            }),
            el('span', { class: 'label' }, [el('b', { text: `${k.id} ${k.title}` })]),
            el('span', { class: 'count', text: `(${n})` }),
          ]),
        ]);
      }));

      list.append(el('li', {}, [
        el('details', { open: chosen.length > 0 }, [
          el('summary', {}, [
            el('span', { class: 'label' }, [
              el('b', { text: `Domain ${d} — ${meta.title}` }),
            ]),
            el('span', { class: 'count', text: `(${domainTotal})` }),
          ]),
          el('label', { class: 'optrow', style: 'margin-left:.2rem' }, [
            parentBox,
            el('span', { class: 'label' }, [el('span', { text: 'Select all in this domain' })]),
          ]),
          kidList,
        ]),
      ]));
    }
    return list;
  }

  function scopeToggle(onChange) {
    const wrap = el('div', { class: 'subpanel' });
    const rows = [
      ['all', 'All of them'],
      ['domain', 'By domain'],
      ['objective', 'By objective'],
    ];
    wrap.append(el('div', { class: 'chips', style: 'margin-bottom:.5rem' },
      rows.map(([key, label]) => el('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(cfg.scope === key),
        text: label,
        onchange: null,
        onclick: () => { cfg.scope = key; onChange(); },
      }))));
    if (cfg.scope === 'domain') wrap.append(domainChecklist(cfg.domains, onChange, true));
    if (cfg.scope === 'objective') wrap.append(objectiveTree(cfg.objectives, onChange, true));
    return wrap;
  }

  function drawPool() {
    clear(poolCard);
    poolCard.append(el('h2', { text: 'Question pool' }));

    const c = ctx();
    const sources = [
      { key: 'all', title: 'All questions', sub: 'The entire bank',
        count: ALL_QUESTIONS.length },
      { key: 'domain', title: 'By domain', sub: 'Pick one or more domains',
        count: null },
      { key: 'objective', title: 'By objective', sub: 'Drill into individual objectives',
        count: null },
      { key: 'missed', title: 'Missed questions', sub: 'Everything you have answered wrong',
        count: c.missedIds.length },
      { key: 'flagged', title: 'Saved / flagged questions', sub: 'Questions you bookmarked',
        count: c.flaggedIds.length },
    ];

    const group = el('fieldset', { class: 'optgroup' });
    for (const s of sources) {
      group.append(el('label', { class: 'optrow' }, [
        el('input', {
          type: 'radio', name: 'pool-source', checked: cfg.source === s.key,
          onchange: () => {
            cfg.source = s.key;
            cfg.scope = 'all';
            cfg.domains.length = 0;
            cfg.objectives.length = 0;
            redraw();
          },
        }),
        el('span', { class: 'label' }, [
          el('b', { text: s.title }),
          el('span', { text: s.sub }),
        ]),
        s.count !== null ? el('span', { class: 'count', text: `(${s.count})` }) : null,
      ]));

      if (cfg.source === s.key) {
        if (s.key === 'domain') group.append(el('div', { class: 'subpanel' },
          [domainChecklist(cfg.domains, redraw, false)]));
        if (s.key === 'objective') group.append(el('div', { class: 'subpanel' },
          [objectiveTree(cfg.objectives, redraw, false)]));
        if (s.key === 'missed' || s.key === 'flagged') group.append(scopeToggle(redraw));
      }
    }
    poolCard.append(group);
  }

  /* --------------------------------------------------- count control -- */

  function drawCount(available) {
    clear(countCard);
    countCard.append(el('h2', { text: 'How many questions' }));

    const input = el('input', {
      class: 'numinput', type: 'number', min: '1', inputmode: 'numeric',
      max: String(Math.max(1, available)),
      value: cfg.count === 'all' ? String(available) : String(cfg.count),
      'aria-label': 'Number of questions',
      oninput: (ev) => {
        const v = parseInt(ev.currentTarget.value, 10);
        cfg.count = Number.isFinite(v) && v > 0 ? v : 1;
        drawLive(available);
        drawStart(available);
        for (const ch of chips.children) {
          ch.setAttribute('aria-pressed', String(ch.dataset.k === String(cfg.count)));
        }
      },
    });

    const chips = el('div', { class: 'chips' }, COUNT_CHIPS.map((c) => el('button', {
      class: 'chip', type: 'button', 'data-k': String(c),
      'aria-pressed': String(cfg.count === c),
      text: c === 'all' ? 'All' : String(c),
      onclick: () => { cfg.count = c; redraw(); },
    })));

    countCard.append(el('div', { class: 'row', style: 'margin-bottom:.6rem' }, [input, chips]));
    countCard.append(liveText);
    drawLive(available);
  }

  const liveText = el('p', { class: 'muted', style: 'margin:0' });

  function resolvedCount(available) {
    if (cfg.count === 'all') return available;
    return Math.max(0, Math.min(cfg.count, available));
  }

  function drawLive(available) {
    clear(liveText);
    const n = resolvedCount(available);
    liveText.append(`Drawing ${n} of ${available} available question${available === 1 ? '' : 's'}`);
    if (cfg.count !== 'all' && cfg.count > available && available > 0) {
      liveText.append(el('span', { class: 'reason', style: 'display:block',
        text: `Only ${available} match these filters, so the quiz will be ${available} questions.` }));
    }
  }

  /* ------------------------------------------------------- options ---- */

  function drawOpts() {
    clear(optsCard);
    optsCard.append(el('h2', { text: 'Options' }));

    const toggle = (key, title, sub) => el('label', { class: 'optrow' }, [
      el('input', {
        type: 'checkbox', checked: opts[key],
        onchange: (ev) => {
          opts[key] = ev.currentTarget.checked;
          store.setSettings({ [key]: opts[key] });
        },
      }),
      el('span', { class: 'label' }, [el('b', { text: title }), el('span', { text: sub })]),
    ]);

    optsCard.append(toggle('shuffleQuestions', 'Shuffle questions', 'Random order each time'));
    optsCard.append(toggle('shuffleChoices', 'Shuffle answer choices', 'Stops you memorizing letters'));

    optsCard.append(el('label', { class: 'optrow' }, [
      el('span', { class: 'label' }, [
        el('b', { text: 'Skip what I already know' }),
        el('span', { text: 'Exclude questions answered correctly this many times' }),
      ]),
      el('select', {
        class: 'numinput', 'aria-label': 'Exclude questions answered correctly N or more times',
        onchange: (ev) => { cfg.excludeCorrectCount = Number(ev.currentTarget.value); redraw(); },
      }, [0, 1, 2, 3].map((n) => el('option', {
        value: String(n), selected: cfg.excludeCorrectCount === n,
        text: n === 0 ? 'Off' : `${n}+`,
      }))),
    ]));

    optsCard.append(el('div', { class: 'optrow' }, [
      el('span', { class: 'label' }, [
        el('b', { text: 'Feedback' }),
        el('span', { text: opts.feedbackMode === 'immediate'
          ? 'Explanation after each answer'
          : 'Everything at the end, like the real exam' }),
      ]),
      el('div', { class: 'chips' }, [
        ['immediate', 'Immediate'], ['end', 'End of quiz'],
      ].map(([k, label]) => el('button', {
        class: 'chip', type: 'button', text: label,
        'aria-pressed': String(opts.feedbackMode === k),
        onclick: () => { opts.feedbackMode = k; store.setSettings({ feedbackMode: k }); drawOpts(); },
      }))),
    ]));
  }

  /* --------------------------------------------------------- start ---- */

  function drawStart(available) {
    clear(startBar);
    const n = resolvedCount(available);
    const blocked = n === 0;

    startBar.append(el('button', {
      class: 'btn block', type: 'button', disabled: blocked,
      text: blocked ? 'Nothing to quiz' : `Start ${n}-question quiz`,
      onclick: () => {
        const pool = buildPool(cfg, ctx());
        const questions = selectQuestions(pool, cfg.count, {
          shuffleQuestions: opts.shuffleQuestions,
        });
        if (!questions.length) return;
        store.setActiveQuiz(createSession({
          questions,
          mode: 'custom',
          config: { ...cfg },
          feedbackMode: opts.feedbackMode,
          shuffleChoices: opts.shuffleChoices,
        }));
        navigate('#/quiz');
      },
    }));

    if (blocked) {
      startBar.append(el('p', { class: 'reason', role: 'status',
        text: emptyPoolReason(cfg, ctx()) }));
    }
  }

  function redraw() {
    const available = buildPool(cfg, ctx()).length;
    drawPool();
    drawCount(available);
    drawOpts();
    drawStart(available);
  }

  redraw();
}
