/** Tiny DOM helpers. Keeps the views readable without a framework. */

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/**
 * Render question text with code/log/config snippets in monospace.
 *
 * Runs of lines that look like a log excerpt, command or firewall rule are
 * grouped into a <pre>; bullet lists and prose stay as text.
 */
const CODEY = /^(?:[\w.-]*[$#>]\s|\s{2,}\S|\d{1,3}(?:\.\d{1,3}){3}\b|(?:permit|deny|allow|drop)\b|<\w+|[A-Z]+\s+\/\S|\{|\}|SELECT\s|GET\s|POST\s)/i;

export function renderQuestionText(text) {
  const frag = document.createDocumentFragment();
  const lines = String(text).split('\n');
  let buf = [];
  let codeBuf = [];

  const flushProse = () => {
    if (!buf.length) return;
    frag.append(el('span', { class: 'bullets', text: buf.join('\n') }));
    buf = [];
  };
  const flushCode = () => {
    if (!codeBuf.length) return;
    frag.append(el('pre', { text: codeBuf.join('\n') }));
    codeBuf = [];
  };

  // Exhibits transcribed from the PDF's pictures arrive fenced: ```text for
  // logs and command output, ```table for rows of " | "-separated cells.
  let fence = null;
  let fenceBuf = [];
  const flushFence = () => {
    if (fence === 'table') {
      const rows = fenceBuf.filter((r) => r.trim()).map((r) => r.split(' | ').map((c) => c.trim()));
      const [head, ...body] = rows;
      const scroller = el('div', { class: 'exhibit-table-scroll' }, [
        el('table', { class: 'exhibit-table' }, [
          el('thead', {}, [el('tr', {}, head.map((c) => el('th', { scope: 'col', text: c })))]),
          el('tbody', {}, body.map((r) => el('tr', {}, r.map((c) => el('td', { text: c }))))),
        ]),
      ]);
      const box = el('div', { class: 'exhibit exhibit-table-wrap' }, [scroller]);
      // A wide log table scrolls sideways on a phone; fade the edge that has
      // more to show so it is obvious there is more to swipe to.
      const edges = () => {
        const max = scroller.scrollWidth - scroller.clientWidth;
        box.classList.toggle('more-left', scroller.scrollLeft > 2);
        box.classList.toggle('more-right', scroller.scrollLeft < max - 2);
      };
      scroller.addEventListener('scroll', edges, { passive: true });
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(edges);
      if (typeof ResizeObserver === 'function') new ResizeObserver(edges).observe(scroller);
      frag.append(box);
    } else {
      frag.append(el('pre', { class: 'exhibit exhibit-text', text: fenceBuf.join('\n') }));
    }
    fence = null;
    fenceBuf = [];
  };

  for (const line of lines) {
    const open = !fence && line.match(/^```(\w*)\s*$/);
    if (open) { flushProse(); flushCode(); fence = open[1] || 'text'; continue; }
    if (fence) {
      if (/^```\s*$/.test(line)) flushFence(); else fenceBuf.push(line);
      continue;
    }
    if (CODEY.test(line) && line.trim()) {
      flushProse();
      codeBuf.push(line);
    } else {
      flushCode();
      buf.push(line);
    }
  }
  if (fence) flushFence();
  flushProse();
  flushCode();
  return frag;
}

/** Question text for one-line previews: exhibits dropped, whitespace collapsed. */
export function plainStem(text) {
  return String(text).replace(/```\w*\n[\s\S]*?\n```/g, ' … ').replace(/\s+/g, ' ').trim();
}

export function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function fmtDuration(ms) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/**
 * Wrap every match of `re` (a global regex) inside `root` in <mark>. Walks
 * text nodes only, so it is safe on any rendered content and never parses
 * user text as HTML. Skips buttons and existing marks.
 */
export function highlightIn(root, re) {
  if (!root || !re) return root;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement && n.parentElement.closest('button, mark')
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue;
    re.lastIndex = 0;
    if (!re.test(text)) continue;
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const m of text.matchAll(re)) {
      if (!m[0]) continue;
      if (m.index > last) frag.append(text.slice(last, m.index));
      frag.append(el('mark', { text: m[0] }));
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.append(text.slice(last));
    node.replaceWith(frag);
  }
  return root;
}
