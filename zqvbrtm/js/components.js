/** Shared UI pieces used by more than one view. */

import { el, clear, renderQuestionText, fmtDate } from './dom.js';
import * as store from './store.js';
import { icon } from './icons.js';
import { DOMAINS, COVERAGE_TARGET } from './quizEngine.js';

const BAND_CLASS = {
  'Exam ready': 'band--ready',
  Approaching: 'band--approaching',
  Building: 'band--building',
  'Not ready': 'band--notready',
};

/**
 * Readiness card. `compact` drops the per-domain detail for the Study screen.
 *
 * The formula line is deliberately on screen rather than in the README: a
 * score you cannot interrogate is a score you cannot act on.
 */
export function readinessCard(r, { compact = false, navigate = null } = {}) {
  const card = el('div', { class: 'card hero' }, [
    el('h2', { text: 'Exam readiness' }),
    el('div', { class: 'readiness' }, [
      el('span', { class: 'score', text: String(r.score) }),
      el('span', { class: `band ${BAND_CLASS[r.band]}`, text: r.band }),
      el('span', { class: 'faint',
        text: 'Not ready <60 · Building 60–74 · Approaching 75–84 · Exam ready 85+' }),
    ]),
  ]);

  if (r.drags.length && r.score < 100) {
    card.append(el('ul', { class: 'drags' }, [
      el('li', {}, [el('b', { text: 'Holding you back: ' }),
        r.drags.map((d) => d.text).join(' · ')]),
    ]));
  }

  card.append(el('p', { class: 'formula' },
    `How this is worked out: for each domain, your accuracy × its official exam `
    + `weight, then scaled by how much of that domain you have actually seen `
    + `(full credit at ${Math.round(COVERAGE_TARGET * 100)}% of its questions). `
    + `A high score on a handful of questions will not read as ready.`));

  if (!compact && navigate) {
    const worst = r.drags[0];
    if (worst) {
      card.append(el('div', { style: 'margin-top:.7rem' }, [
        el('button', {
          class: 'btn secondary', type: 'button',
          text: `Practise Domain ${worst.domain}`,
          onclick: () => navigate(`#/build?source=domain&d=${worst.domain}`),
        }),
      ]));
    }
  }
  return card;
}

export function accuracyBar(accuracy) {
  const pct = accuracy === null ? 0 : Math.round(accuracy * 100);
  const cls = accuracy === null ? '' : pct >= 80 ? 'high' : pct >= 60 ? 'mid' : 'low';
  return el('div', { class: `bar ${cls}` }, [el('span', { style: `width:${pct}%` })]);
}

/** Hand-rolled SVG line chart. No charting library. */
export function sparkline(points, { label = 'Accuracy over time' } = {}) {
  if (points.length < 2) {
    return el('p', { class: 'faint',
      text: 'Take at least two quizzes and your accuracy trend shows up here.' });
  }
  const W = 320;
  const H = 90;
  const pad = { l: 22, r: 6, t: 8, b: 16 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i) => pad.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v) => pad.t + ih - (v / 100) * ih;

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'sparkline');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label',
    `${label}: ${points.map((p) => `${p.percent}%`).join(', ')}`);

  const mk = (tag, attrs) => {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    return n;
  };
  for (const v of [0, 50, 100]) {
    svg.append(mk('line', { class: 'axis', x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v) }));
    const t = mk('text', { class: 'lbl', x: 2, y: y(v) + 3 });
    t.textContent = `${v}`;
    svg.append(t);
  }
  svg.append(mk('polyline', {
    class: 'line',
    points: points.map((p, i) => `${x(i)},${y(p.percent)}`).join(' '),
  }));
  points.forEach((p, i) => svg.append(mk('circle', { class: 'dot', cx: x(i), cy: y(p.percent), r: 2.5 })));
  return svg;
}

/**
 * Paginated question list, shared by Review and Saved.
 *
 * Pages rather than renders everything: the bank is ~1000 questions and a
 * full render puts thousands of nodes in the document for no benefit.
 */
/* Rows are always `{ question, ...meta }`. An earlier version accepted a bare
   question too, via `row.question || row` -- which silently broke, because a
   question object has its own `.question` string property. */
export function questionList(rows, { pageSize = 25, emptyMessage, onChange, showMissCount = false }) {
  const wrap = el('div');
  let page = 0;

  const draw = () => {
    clear(wrap);
    if (!rows.length) {
      wrap.append(el('p', { class: 'muted', text: emptyMessage }));
      return;
    }
    const pages = Math.ceil(rows.length / pageSize);
    page = Math.min(page, pages - 1);
    const slice = rows.slice(page * pageSize, (page + 1) * pageSize);

    for (const row of slice) {
      const q = row.question;
      const det = el('details', { class: 'qrow' }, [
        el('summary', {}, [
          el('span', { class: 'stem' }, [
            el('span', { text: q.question.split('\n')[0].slice(0, 95) }),
            el('span', { class: 'tags' }, [
              el('span', { class: 'pill', text: `D${q.domain}` }),
              q.objective ? el('span', { class: 'pill', text: q.objective }) : null,
              showMissCount && row.missedCount
                ? el('span', { class: 'pill',
                    text: `Missed ${row.missedCount}× · ${fmtDate(row.lastSeen)}` })
                : null,
              showMissCount && row.recovered
                ? el('span', { class: 'pill', text: '✓ Recovered' })
                : null,
            ]),
          ]),
        ]),
      ]);

      const inner = el('div', { style: 'padding:.3rem 0 .8rem' });
      inner.append(renderQuestionText(q.question));
      inner.append(el('ul', { class: 'wrongs', style: 'margin-top:.5rem' },
        q.choices.map((c) => el('li', {}, [
          el('b', { text: `${c.key}. ` }), c.text,
          q.correct.includes(c.key)
            ? el('span', { class: 'statelabel', style: 'color:var(--correct);margin-left:.4rem',
                text: '✓ Correct' })
            : null,
        ]))));
      if (q.explanation) inner.append(el('p', { style: 'margin-top:.6rem', text: q.explanation }));
      else inner.append(el('p', { class: 'faint', style: 'margin-top:.6rem',
        text: 'No explanation available for this question yet.' }));

      const wrongs = Object.entries(q.incorrectExplanations || {})
        .filter(([k]) => !q.correct.includes(k));
      if (wrongs.length) {
        inner.append(el('h3', { text: 'Why the others are wrong', style: 'margin-top:.6rem' }));
        inner.append(el('ul', { class: 'wrongs' },
          wrongs.map(([k, why]) => el('li', {}, [el('b', { text: `${k}. ` }), why]))));
      }

      inner.append(el('button', {
        class: 'iconbtn', type: 'button',
        style: 'margin-top:.6rem',
        'aria-pressed': String(store.isFlagged(q.id)),
        'aria-label': store.isFlagged(q.id) ? 'Remove from saved' : 'Save this question',
        onclick: (ev) => {
          const on = store.toggleFlag(q.id);
          ev.currentTarget.setAttribute('aria-pressed', String(on));
          if (onChange) onChange();
        },
      }, [icon('flag')]));
      det.append(inner);
      wrap.append(det);
    }

    if (pages > 1) {
      wrap.append(el('div', { class: 'pager' }, [
        el('button', {
          class: 'btn secondary', type: 'button', text: '← Prev', disabled: page === 0,
          onclick: () => { page -= 1; draw(); wrap.scrollIntoView({ block: 'start' }); },
        }),
        el('span', { class: 'faint', text: `Page ${page + 1} of ${pages} · ${rows.length} questions` }),
        el('button', {
          class: 'btn secondary', type: 'button', text: 'Next →', disabled: page >= pages - 1,
          onclick: () => { page += 1; draw(); wrap.scrollIntoView({ block: 'start' }); },
        }),
      ]));
    }
  };

  draw();
  return { node: wrap, redraw: draw };
}

/**
 * In-page confirmation, used instead of window.confirm(). Some embedded
 * viewers never show browser dialogs (confirm() returns false at once), and
 * the native box cannot be styled. Resolves true on confirm; false on
 * cancel, Escape or a click on the backdrop. While open it swallows key
 * presses so quiz shortcuts underneath do not fire.
 */
export function confirmDialog({ title, message = '', confirmText = 'OK', cancelText = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const returnFocus = document.activeElement;
    const titleId = `dlg-${Date.now().toString(36)}`;
    let done = false;
    const okBtn = el('button', {
      class: danger ? 'btn danger-solid' : 'btn', type: 'button', text: confirmText,
      onclick: () => close(true),
    });
    const cancelBtn = el('button', {
      class: 'btn secondary', type: 'button', text: cancelText, onclick: () => close(false),
    });
    const backdrop = el('div', { class: 'modal-backdrop' }, [
      el('div', { class: 'modal', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': titleId }, [
        el('h2', { id: titleId, text: title }),
        message ? el('p', { class: 'muted', text: message }) : null,
        el('div', { class: 'modal-actions' }, [cancelBtn, okBtn]),
      ]),
    ]);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(false); });

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation(); close(false);
      } else if (e.key === 'Tab') {
        // Keep focus on the two buttons while the panel is open.
        e.preventDefault(); e.stopPropagation();
        (document.activeElement === okBtn ? cancelBtn : okBtn).focus();
      } else {
        e.stopPropagation();   // Enter/Space still activate the focused button
      }
    }
    function close(result) {
      if (done) return;
      done = true;
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
      resolve(result);
    }

    document.addEventListener('keydown', onKey, true);
    document.body.append(backdrop);
    okBtn.focus();
  });
}
