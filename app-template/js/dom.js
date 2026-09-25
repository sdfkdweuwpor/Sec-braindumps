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

  for (const line of lines) {
    if (CODEY.test(line) && line.trim()) {
      flushProse();
      codeBuf.push(line);
    } else {
      flushCode();
      buf.push(line);
    }
  }
  flushProse();
  flushCode();
  return frag;
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
