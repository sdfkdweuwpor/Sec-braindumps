/**
 * Acronym lookup for the "Show acronyms" panel. The dictionary is generated
 * from tools/acronyms.py; this module finds which of its entries a piece of
 * text uses, including plurals (VPNs), versions (AES-256, SNMPv3, WPA2) and
 * pairs (IDS/IPS, SSL/TLS, EAP-TLS).
 */

import { ACRONYMS } from '../data/acronyms.js';

const TOKEN = /(?<![A-Za-z0-9&])[A-Za-z0-9][A-Za-z0-9/&+.-]*[A-Za-z0-9+&]|(?<![A-Za-z0-9])[A-Z]{2}(?![A-Za-z0-9])/g;

function upperCount(s) {
  let n = 0;
  for (const ch of s) if (ch >= 'A' && ch <= 'Z') n += 1;
  return n;
}

/** The dictionary keys one token stands for (usually one, two for "IDS/IPS"). */
export function lookup(token) {
  const tok = token.replace(/[.,;:]+$/, '');
  if (upperCount(tok) < 2) return [];
  if (ACRONYMS[tok]) return [tok];
  if (/s$/.test(tok) && ACRONYMS[tok.slice(0, -1)]) return [tok.slice(0, -1)];
  const bare = tok.replace(/(?:-?\d+(?:\.\d+)*|v\d+)$/, '');
  if (bare !== tok && ACRONYMS[bare]) return [bare];
  if (/[/-]/.test(tok)) {
    return [...new Set(tok.split(/[/-]/).flatMap((part) => (part.length > 1 ? lookup(part) : [])))];
  }
  return [];
}

/** Acronyms used across some texts, in order of first appearance. */
export function findAcronyms(texts) {
  const seen = new Set();
  const out = [];
  for (const text of texts) {
    for (const m of String(text || '').matchAll(TOKEN)) {
      for (const key of lookup(m[0])) {
        if (!seen.has(key)) { seen.add(key); out.push({ acr: key, full: ACRONYMS[key] }); }
      }
    }
  }
  return out;
}

/**
 * Wrap each acronym inside `root` in <abbr> with its expansion as a tooltip.
 * Walks text nodes only; skips exhibits, marks and existing abbrs.
 */
export function wrapAcronyms(root) {
  if (!root) return root;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement && n.parentElement.closest('pre, mark, abbr, .exhibit, .key, .wkey')
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue;
    const hits = [...text.matchAll(TOKEN)].filter((m) => lookup(m[0]).length);
    if (!hits.length) continue;
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const m of hits) {
      const word = m[0].replace(/[.,;:]+$/, '');
      if (m.index > last) frag.append(text.slice(last, m.index));
      const abbr = document.createElement('abbr');
      abbr.className = 'acro';
      abbr.title = lookup(word).map((k) => `${k}: ${ACRONYMS[k]}`).join(' · ');
      abbr.textContent = word;
      frag.append(abbr);
      last = m.index + word.length;
    }
    if (last < text.length) frag.append(text.slice(last));
    node.replaceWith(frag);
  }
  return root;
}
