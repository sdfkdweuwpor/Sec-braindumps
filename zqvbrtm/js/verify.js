/**
 * "Verify this answer": three places to double-check a question, each in a
 * new tab. The links carry the question and nothing else: no referrer, so
 * nothing about this site goes with them.
 *
 *   Google            the question itself, to find it discussed elsewhere
 *   Claude            a ready-made prompt with the question, the choices
 *                     and the marked answer, asking whether it is right
 *   Professor Messer  his free SY0-701 course, searched for the topic
 *
 * claude.ai has at times ignored a prompt passed in the link, so the Claude
 * button also copies the prompt: if the chat opens empty, paste it in.
 */

import { el } from './dom.js';
import { icon } from './icons.js';

/** Google reads only the first 32 words of a search. */
const GOOGLE_WORDS = 32;
/** Keep the Claude link comfortably inside URL length limits. */
const CLAUDE_MAX = 6000;

const LETTERS = 'ABCDEFGH';

/** Question text with exhibits kept as plain lines (no code fences). */
function questionText(q) {
  return String(q.question).replace(/```\w*\n([\s\S]*?)\n```/g, (_, body) => body.replace(/ \| /g, '  |  '))
    .replace(/\n{3,}/g, '\n\n').trim();
}

/** The stem with exhibits dropped, on one line. */
function stemLine(q) {
  return String(q.question).replace(/```\w*\n[\s\S]*?\n```/g, ' ').replace(/\s+/g, ' ').trim();
}

export function googleUrl(q) {
  const words = stemLine(q).split(' ').filter(Boolean).slice(0, GOOGLE_WORDS);
  return `https://www.google.com/search?q=${encodeURIComponent(words.join(' '))}`;
}

/**
 * The prompt for Claude. `order` is the original choice keys in the order
 * they were shown, so the letters match what the viewer saw.
 */
export function claudePrompt(q, order = q.choices.map((c) => c.key)) {
  const letterOf = Object.fromEntries(order.map((k, i) => [k, LETTERS[i]]));
  const choices = order
    .map((k) => q.choices.find((c) => c.key === k))
    .filter(Boolean)
    .map((c) => `${letterOf[c.key]}. ${c.text}`);
  const marked = q.correct.map((k) => letterOf[k]).filter(Boolean).sort();
  const markedText = marked
    .map((l) => choices.find((c) => c.startsWith(`${l}. `)))
    .filter(Boolean)
    .join('; ');
  let text = questionText(q);
  const head = 'Check this CompTIA Security+ (SY0-701) practice question. Is the marked answer correct? '
    + 'If it is not, say which answer is right. Explain why, and why each other choice is wrong.';
  const build = (body) => [
    head, '', 'Question:', body, '', 'Choices:', ...choices, '',
    `Marked answer${marked.length > 1 ? 's' : ''}: ${markedText}`,
  ].join('\n');
  let prompt = build(text);
  if (prompt.length > CLAUDE_MAX) {
    text = `${text.slice(0, Math.max(200, text.length - (prompt.length - CLAUDE_MAX) - 1))}…`;
    prompt = build(text);
  }
  return prompt;
}

export function claudeUrl(prompt) {
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
}

// Words that say nothing about the topic. Professor Messer's site search
// wants every word it is given, so the fewer and more specific the better.
const STOP = new Set(`a an the to of for and or in on with by from at as is are be been being it its
  that this these those which what who whom when where how why use using used implement implementing
  configure configuring enable enabling deploy deploying perform performing create creating set add
  adding apply applying install installing conduct conducting review reviewing require requiring
  ensure should would could can will all any each every only both more most other than then into
  over under via per not no do does done have has had make making run running provide providing
  update updating change changing new same one two three four five their them they our your his her
  after before during between within without against about up down out off above below none
  following`.split(/\s+/));

/** A few words naming the topic of a question, for a site search. */
export function topicTerms(q, max = 3) {
  const pick = (text) => String(text || '')
    .replace(/[()"“”‘’,;:!?]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[.\-/]+|[.\-/]+$/g, ''))
    .filter((w) => w.length > 1 && !STOP.has(w.toLowerCase()))
    .slice(0, max);
  const answer = q.choices.find((c) => c.key === q.correct[0]);
  let words = pick(answer && answer.text);
  if (!words.length) words = pick(q.objectiveTitle);
  return words.join(' ');
}

export function messerUrl(q) {
  return `https://www.professormesser.com/?s=${encodeURIComponent(topicTerms(q))}`;
}

/** Copy text to the clipboard; resolves true when it worked. */
async function copy(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to the old way */ }
  try {
    const ta = el('textarea', { style: 'position:fixed;top:-1000px;opacity:0', 'aria-hidden': 'true' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

let toastEl = null;
function toast(text) {
  if (toastEl) toastEl.remove();
  toastEl = el('div', { class: 'toast', role: 'status' }, [icon('check', { size: 18 }), text]);
  document.body.append(toastEl);
  const mine = toastEl;
  setTimeout(() => { mine.classList.add('is-out'); setTimeout(() => mine.remove(), 400); }, 4200);
}

function link(href, ic, label, title, onclick) {
  return el('a', {
    class: `verify-btn verify-${ic}`, href, target: '_blank', rel: 'noopener noreferrer',
    referrerpolicy: 'no-referrer', title, onclick,
  }, [icon(ic, { size: 17 }), el('span', { text: label })]);
}

/**
 * The Verify row. `order` is the choice keys as shown (for the letters in
 * the Claude prompt); defaults to the question's own order.
 */
export function verifyRow(q, { order } = {}) {
  const prompt = claudePrompt(q, order);
  return el('div', { class: 'verify' }, [
    el('span', { class: 'verify-l' }, [icon('verify', { size: 18 }), 'Verify this answer']),
    el('div', { class: 'verify-links' }, [
      link(googleUrl(q), 'globe', 'Google', 'Search Google for this question'),
      link(claudeUrl(prompt), 'sparkle', 'Claude', 'Ask Claude whether the marked answer is right (the question is copied too)',
        () => { copy(prompt).then((ok) => { if (ok) toast('Question copied. If Claude opens empty, paste it in.'); }); }),
      link(messerUrl(q), 'video', 'Professor Messer', `Look up “${topicTerms(q)}” in Professor Messer's free SY0-701 course`),
    ]),
  ]);
}
