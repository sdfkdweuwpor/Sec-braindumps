/**
 * Question search. Pure: takes the bank as an argument, no DOM.
 *
 * Every word in the query must appear somewhere in the question: its text,
 * its answer choices, its explanations or its objective. Short words (three
 * letters or fewer, which is most Security+ acronyms: WAF, MFA, IP) must
 * match as whole words, so "IP" does not find "ship". A query that is just a
 * number, like "62", "#62" or "Q62", also finds question 62 itself.
 */

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Split a query into lower-case words, dropping duplicates and stray punctuation. */
export function queryTerms(query) {
  const words = String(query || '').toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^[^\w#]+|[^\w+#]+$/g, ''))
    .filter(Boolean);
  return [...new Set(words)];
}

/** One regex per term: whole-word for short terms, substring otherwise. */
export function termPattern(term) {
  const body = escapeRe(term);
  return term.length <= 3
    ? new RegExp(`(?<![a-z0-9])${body}(?![a-z0-9])`, 'i')
    : new RegExp(body, 'i');
}

/** A global regex matching any of the terms, for highlighting. */
export function highlightPattern(terms) {
  if (!terms.length) return null;
  const parts = [...terms].sort((a, b) => b.length - a.length).map((t) => {
    const body = escapeRe(t);
    return t.length <= 3 ? `(?<![a-z0-9])${body}(?![a-z0-9])` : body;
  });
  return new RegExp(parts.join('|'), 'gi');
}

function numberQuery(query) {
  const m = String(query || '').trim().match(/^(?:q|#|question\s*)?\s*0*(\d{1,4})$/i);
  return m ? `q${m[1].padStart(4, '0')}` : null;
}

/**
 * Search the bank. Returns rows `{ question, score, where }`, best first,
 * where `where` says which part matched: 'question', 'answers',
 * 'explanation' or 'number'.
 */
export function searchQuestions(query, questions) {
  const terms = queryTerms(query);
  const byNumber = numberQuery(query);
  if (!terms.length) return [];
  const patterns = terms.map(termPattern);
  const phrase = terms.length > 1 ? String(query).trim().toLowerCase().replace(/\s+/g, ' ') : null;

  const rows = [];
  for (const q of questions) {
    if (byNumber && q.id === byNumber) {
      rows.push({ question: q, score: 1000, where: 'number' });
      continue;
    }
    const stem = q.question || '';
    const answers = (q.choices || []).map((c) => c.text).join('\n');
    const explain = [q.explanation || '', ...Object.values(q.incorrectExplanations || {})].join('\n');
    const objective = `${q.objective || ''} ${q.objectiveTitle || ''}`;

    let score = 0;
    let inStem = 0;
    let inAnswers = 0;
    let all = true;
    for (const re of patterns) {
      const s = re.test(stem);
      const a = re.test(answers);
      const e = re.test(explain);
      const o = re.test(objective);
      if (!s && !a && !e && !o) { all = false; break; }
      score += (s ? 3 : 0) + (a ? 2 : 0) + (e ? 1 : 0) + (o ? 1 : 0);
      inStem += s ? 1 : 0;
      inAnswers += a ? 1 : 0;
    }
    if (!all) continue;
    if (phrase && stem.toLowerCase().includes(phrase)) score += 4;
    const where = inStem === patterns.length ? 'question'
      : inStem + inAnswers >= patterns.length || inAnswers ? 'answers' : 'explanation';
    rows.push({ question: q, score, where });
  }
  rows.sort((a, b) => b.score - a.score || a.question.id.localeCompare(b.question.id));
  return rows;
}
