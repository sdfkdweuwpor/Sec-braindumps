/**
 * Derived analytics. Pure functions over (questions, attempts) so they can be
 * tested directly; the views pass in what store.js gives them.
 */

import { DOMAINS, OBJECTIVES } from '../data/domains.js';

export const READINESS_BANDS = [
  { min: 85, label: 'Exam ready' },
  { min: 75, label: 'Approaching' },
  { min: 60, label: 'Building' },
  { min: 0, label: 'Not ready' },
];

export const COVERAGE_TARGET = 0.6;  // see readiness(), below

export function bandFor(score) {
  return READINESS_BANDS.find((b) => score >= b.min).label;
}

function tally(list) {
  let seen = 0;
  let answered = 0;
  let correct = 0;
  for (const attempts of list) {
    if (!attempts.length) continue;
    seen += 1;
    answered += attempts.length;
    correct += attempts.filter((a) => a.correct).length;
  }
  return { seen, answered, correct,
           accuracy: answered ? correct / answered : null };
}

/** Overall totals across the whole bank. */
export function overall(questions, attempts) {
  const t = tally(questions.map((q) => (attempts[q.id]?.attempts) || []));
  return {
    ...t,
    total: questions.length,
    unseen: questions.length - t.seen,
    coverage: questions.length ? t.seen / questions.length : 0,
  };
}

/** Per-domain rollup, including the official exam weight for context. */
export function byDomain(questions, attempts) {
  const out = [];
  for (const [id, meta] of Object.entries(DOMAINS)) {
    const d = Number(id);
    const qs = questions.filter((q) => q.domain === d);
    const t = tally(qs.map((q) => (attempts[q.id]?.attempts) || []));
    out.push({
      domain: d, title: meta.title, weight: meta.weight,
      total: qs.length, ...t,
      coverage: qs.length ? t.seen / qs.length : 0,
    });
  }
  return out;
}

/** Per-objective rollup, optionally limited to one domain. */
export function byObjective(questions, attempts, domain = null) {
  const out = [];
  for (const [id, meta] of Object.entries(OBJECTIVES)) {
    if (domain !== null && meta.domain !== domain) continue;
    const qs = questions.filter((q) => q.objective === id);
    if (!qs.length) continue;
    const t = tally(qs.map((q) => (attempts[q.id]?.attempts) || []));
    out.push({
      objective: id, title: meta.title, domain: meta.domain,
      total: qs.length, ...t,
      coverage: qs.length ? t.seen / qs.length : 0,
    });
  }
  return out;
}

/**
 * Weakest objectives by accuracy.
 *
 * `minAttempts` guards against calling something weak on one unlucky answer;
 * objectives below it are excluded rather than ranked.
 */
export function weakestObjectives(questions, attempts, { limit = 5, minAttempts = 5 } = {}) {
  return byObjective(questions, attempts)
    .filter((o) => o.answered >= minAttempts && o.accuracy !== null)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, limit);
}

/**
 * Readiness, 0-100.
 *
 * Each domain contributes (its accuracy x its official exam weight), then
 * that contribution is scaled by a coverage factor:
 *
 *     coverage factor = min(1, questions seen in domain / (0.6 x domain pool))
 *
 * The coverage factor is the point of the metric: without it, 4 lucky answers
 * in a domain would read as complete mastery of it. A domain with no answers
 * contributes nothing, which correctly drags the score down rather than
 * being silently skipped.
 */
export function readiness(questions, attempts) {
  const domains = byDomain(questions, attempts);
  let score = 0;
  const parts = [];

  for (const d of domains) {
    const acc = d.accuracy === null ? 0 : d.accuracy;
    const target = Math.max(1, d.total * COVERAGE_TARGET);
    const coverageFactor = Math.min(1, d.seen / target);
    const contribution = acc * coverageFactor * d.weight;
    score += contribution;
    parts.push({
      domain: d.domain, title: d.title, weight: d.weight,
      accuracy: d.accuracy, coverage: d.coverage, coverageFactor,
      contribution, lost: d.weight - contribution,
    });
  }

  const rounded = Math.round(score);

  // Name the two biggest drags, and say which of the two causes it is, so the
  // UI can point at something actionable rather than just a number.
  const drags = [...parts].sort((a, b) => b.lost - a.lost).slice(0, 2).map((p) => {
    const accGap = (1 - (p.accuracy ?? 0)) * p.coverageFactor;
    const covGap = 1 - p.coverageFactor;
    const cause = covGap > accGap ? 'coverage' : 'accuracy';
    return {
      ...p, cause,
      text: cause === 'coverage'
        ? `Domain ${p.domain} coverage (${Math.round(p.coverage * 100)}% of pool seen)`
        : `Domain ${p.domain} accuracy (${p.accuracy === null ? 'no data' : Math.round(p.accuracy * 100) + '%'})`,
    };
  });

  return { score: rounded, band: bandFor(rounded), parts, drags };
}

/** Rolling accuracy across the last N quizzes, oldest first. */
export function accuracyOverTime(quizzes, limit = 20) {
  return quizzes.slice(-limit).map((q) => ({
    id: q.id,
    ts: q.ts,
    percent: q.total ? Math.round((q.score / q.total) * 100) : 0,
  }));
}

/** Review-screen rows: everything ever answered wrong. */
export function missedHistory(questions, attempts) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const rows = [];
  for (const [id, entry] of Object.entries(attempts)) {
    const list = entry.attempts || [];
    if (!list.length) continue;
    const wrong = list.filter((a) => !a.correct);
    if (!wrong.length) continue;
    const q = byId.get(id);
    if (!q) continue;                  // question left the bank
    const last = list[list.length - 1];
    rows.push({
      question: q,
      missedCount: wrong.length,
      lastSeen: last.ts,
      recovered: last.correct,
    });
  }
  return rows.sort((a, b) => b.lastSeen - a.lastSeen);
}
