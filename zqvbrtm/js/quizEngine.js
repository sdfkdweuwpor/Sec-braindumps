/**
 * Question selection, session state and scoring.
 *
 * Everything here is pure apart from the session helpers, so the filtering
 * and scoring rules can be unit-tested without a DOM or localStorage.
 */

import { ALL_QUESTIONS, QUESTIONS_BY_ID } from '../data/index.js';
import { DOMAINS, OBJECTIVES } from '../data/domains.js';

/** Fisher-Yates. `rng` is injectable so tests can be deterministic. */
export function shuffle(items, rng = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Resolve a builder config down to the questions it covers, before any
 * count limit is applied.
 *
 * config = {
 *   source: 'all' | 'domain' | 'objective' | 'missed' | 'flagged',
 *   domains: [4, 2],            // for source 'domain', or a scope sub-filter
 *   objectives: ['4.1', '2.3'], // for source 'objective', or a scope sub-filter
 *   scope: 'all' | 'domain' | 'objective',   // sub-toggle for missed/flagged
 *   excludeCorrectCount: 0 | 1 | 2 | 3,
 * }
 */
export function buildPool(config, ctx) {
  const {
    source = 'all',
    domains = [],
    objectives = [],
    scope = 'all',
    excludeCorrectCount = 0,
  } = config || {};

  const all = ctx.questions || ALL_QUESTIONS;
  let pool = all;

  const inDomains = (q) => domains.length === 0 || domains.includes(q.domain);
  const inObjectives = (q) => objectives.length === 0 || objectives.includes(q.objective);

  if (source === 'domain') {
    pool = pool.filter((q) => domains.includes(q.domain));
  } else if (source === 'objective') {
    pool = pool.filter((q) => objectives.includes(q.objective));
  } else if (source === 'missed' || source === 'flagged') {
    const ids = new Set(source === 'missed' ? ctx.missedIds : ctx.flaggedIds);
    pool = pool.filter((q) => ids.has(q.id));
    if (scope === 'domain') pool = pool.filter(inDomains);
    if (scope === 'objective') pool = pool.filter(inObjectives);
  }

  if (excludeCorrectCount > 0) {
    pool = pool.filter(
      (q) => (ctx.correctCount ? ctx.correctCount(q.id) : 0) < excludeCorrectCount,
    );
  }

  return pool;
}

/**
 * Pick the questions for a quiz.
 *
 * `count` is clamped to the pool size -- never pads, never repeats a question
 * within one quiz. `count === 'all'` takes the whole pool.
 */
export function selectQuestions(pool, count, { shuffleQuestions = true, rng = Math.random } = {}) {
  const ordered = shuffleQuestions ? shuffle(pool, rng) : [...pool];
  if (count === 'all' || count === null || count === undefined) return ordered;
  const n = Math.max(0, Math.min(Math.floor(count), ordered.length));
  return ordered.slice(0, n);
}

/** Domain-weighted draw for Mock Exam, using the official exam percentages. */
export function selectWeighted(pool, total, { rng = Math.random } = {}) {
  const byDomain = new Map();
  for (const q of pool) {
    if (!byDomain.has(q.domain)) byDomain.set(q.domain, []);
    byDomain.get(q.domain).push(q);
  }

  // Largest-remainder apportionment, so the parts sum to `total` exactly.
  const want = [];
  for (const [id, meta] of Object.entries(DOMAINS)) {
    const exact = (total * meta.weight) / 100;
    want.push({ domain: Number(id), exact, base: Math.floor(exact) });
  }
  let assigned = want.reduce((s, w) => s + w.base, 0);
  want.sort((a, b) => (b.exact - b.base) - (a.exact - a.base));
  for (let i = 0; assigned < total && i < want.length * 4; i++) {
    want[i % want.length].base += 1;
    assigned += 1;
  }

  const picked = [];
  const shortfall = [];
  for (const w of want) {
    const avail = shuffle(byDomain.get(w.domain) || [], rng);
    picked.push(...avail.slice(0, w.base));
    if (avail.length < w.base) shortfall.push({ domain: w.domain, missing: w.base - avail.length });
  }

  // A thin domain must not shrink the exam -- backfill from whatever is left.
  if (picked.length < total) {
    const used = new Set(picked.map((q) => q.id));
    const rest = shuffle(pool.filter((q) => !used.has(q.id)), rng);
    picked.push(...rest.slice(0, total - picked.length));
  }

  return { questions: shuffle(picked, rng).slice(0, total), shortfall };
}

/** Choice order for presentation. Data keeps the PDF's original order. */
export function orderedChoices(question, { shuffleChoices = true, rng = Math.random } = {}) {
  return shuffleChoices ? shuffle(question.choices, rng) : [...question.choices];
}

/** Multi-answer is all-or-nothing: partial credit counts as wrong. */
export function isCorrect(question, selected) {
  const want = [...question.correct].sort();
  const got = [...new Set(selected)].sort();
  return want.length === got.length && want.every((k, i) => k === got[i]);
}

export function scoreQuiz(questions, answers) {
  let correct = 0;
  for (const q of questions) {
    if (isCorrect(q, answers[q.id] || [])) correct += 1;
  }
  return { correct, total: questions.length,
           percent: questions.length ? Math.round((correct / questions.length) * 100) : 0 };
}

/**
 * Raw percentage -> the 100-900 scale CompTIA reports.
 *
 * A linear map, and an estimate only: CompTIA does not publish its scaling,
 * and the real exam includes unscored items. Labelled as unofficial wherever
 * it is shown.
 */
export function scaledScore(percent) {
  return Math.round(100 + (Math.max(0, Math.min(100, percent)) / 100) * 800);
}

export const PASSING_SCALED = 750;
export const PRACTICE_THRESHOLD = 75;

/* ---------------------------------------------------------------- session */

let sessionCounter = 0;

export function newQuizId() {
  sessionCounter += 1;
  return `quiz_${Date.now().toString(36)}_${sessionCounter}`;
}

export function createSession({ questions, config, mode = 'custom', feedbackMode = 'immediate',
                                shuffleChoices = true, durationMs = null, rng = Math.random }) {
  return {
    id: newQuizId(),
    mode,
    config: config || {},
    feedbackMode,
    startedAt: Date.now(),
    durationMs,
    index: 0,
    questionIds: questions.map((q) => q.id),
    // Frozen at session creation so a refresh re-renders identical choices.
    choiceOrder: Object.fromEntries(
      questions.map((q) => [q.id, orderedChoices(q, { shuffleChoices, rng }).map((c) => c.key)]),
    ),
    answers: {},
    revealed: {},
  };
}

export function sessionQuestions(session) {
  return session.questionIds.map((id) => QUESTIONS_BY_ID.get(id)).filter(Boolean);
}

export function currentQuestion(session) {
  return QUESTIONS_BY_ID.get(session.questionIds[session.index]) || null;
}

export function remainingMs(session) {
  if (!session.durationMs) return null;
  return Math.max(0, session.startedAt + session.durationMs - Date.now());
}

export function describePool(config, ctx) {
  const pool = buildPool(config, ctx);
  return { pool, count: pool.length };
}

/** Human-readable reason a pool came back empty, for the disabled Start button. */
export function emptyPoolReason(config, ctx) {
  const { source = 'all', domains = [], objectives = [], scope = 'all',
          excludeCorrectCount = 0 } = config || {};
  const names = domains.map((d) => `Domain ${d}`).join(', ');
  const objNames = objectives.join(', ');

  if (source === 'missed') {
    if (!ctx.missedIds.length) return 'No missed questions yet - take a quiz first.';
    if (scope === 'domain' && domains.length) return `No missed questions in ${names} yet.`;
    if (scope === 'objective' && objectives.length) return `No missed questions in ${objNames} yet.`;
  }
  if (source === 'flagged') {
    if (!ctx.flaggedIds.length) return 'Nothing saved yet - flag a question during a quiz.';
    if (scope === 'domain' && domains.length) return `No saved questions in ${names}.`;
    if (scope === 'objective' && objectives.length) return `No saved questions in ${objNames}.`;
  }
  if (source === 'domain' && !domains.length) return 'Pick at least one domain.';
  if (source === 'objective' && !objectives.length) return 'Pick at least one objective.';
  if (excludeCorrectCount > 0) {
    return `Nothing left once questions answered correctly ${excludeCorrectCount}+ time(s) are excluded.`;
  }
  return 'No questions match these filters.';
}

export { COVERAGE_TARGET } from './stats.js';
export { DOMAINS, OBJECTIVES, ALL_QUESTIONS, QUESTIONS_BY_ID };
