/**
 * XP and levels, worked out from the answer history alone, the same way
 * Smart review is. Nothing extra is stored, so XP covers answers given
 * before it existed, and it travels with an exported progress file. No DOM
 * and no storage access, so it tests under plain Node.
 */

import { reviewWalk } from './srs.js';

export const XP_RULES = {
  right: 10,          // each correct answer
  wrong: 3,           // a wrong answer still counts for the effort
  streakEvery: 5,     // every 5 right in a row within one quiz...
  streakBonus: 15,    // ...earns this on top
  reviewUp: 5,        // passing a Smart review check
  mastered: 25,       // passing the last check: mastered
  quizMin: 10,        // a finished quiz of at least this many questions...
  quiz: 20,           // ...earns this
  mock: 100,          // a finished mock exam (instead of the quiz bonus)
};

/** Level n starts at LEVELS[n - 1].xp. */
export const LEVELS = [
  { xp: 0, title: 'Recruit' },
  { xp: 150, title: 'Help Desk Hero' },
  { xp: 400, title: 'Patch Tuesday Regular' },
  { xp: 750, title: 'Phish Spotter' },
  { xp: 1200, title: 'Log Reader' },
  { xp: 1800, title: 'Firewall Tamer' },
  { xp: 2600, title: 'Packet Sniffer' },
  { xp: 3600, title: 'SOC Analyst' },
  { xp: 4800, title: 'Threat Hunter' },
  { xp: 6300, title: 'Incident Responder' },
  { xp: 8000, title: 'Pen Tester' },
  { xp: 10000, title: 'Red Teamer' },
  { xp: 12500, title: 'Blue Team Lead' },
  { xp: 15500, title: 'Security Architect' },
  { xp: 19000, title: 'Zero Trust Master' },
  { xp: 23000, title: 'CISO' },
  { xp: 28000, title: 'Security+ Legend' },
];

/** The level for an XP total, and how far it is to the next one. */
export function levelFor(xp) {
  const total = Math.max(0, Math.floor(xp || 0));
  let i = 0;
  while (i + 1 < LEVELS.length && total >= LEVELS[i + 1].xp) i += 1;
  const cur = LEVELS[i];
  const next = LEVELS[i + 1] || null;
  return {
    level: i + 1,
    title: cur.title,
    xp: total,
    floor: cur.xp,
    next: next ? next.xp : null,
    nextTitle: next ? next.title : null,
    toNext: next ? next.xp - total : 0,
    progress: next ? (total - cur.xp) / (next.xp - cur.xp) : 1,
  };
}

/**
 * All the XP in a history. `attemptsById` is store.getAttempts(), `quizzes`
 * store.getQuizzes(). Returns the total, the counts behind it, and `byQuiz`
 * (quiz id -> XP earned in that quiz) for the results screen.
 */
export function computeXP(attemptsById, quizzes = []) {
  const R = XP_RULES;
  const counts = { right: 0, wrong: 0, streaks: 0, reviewUps: 0, mastered: 0, quizzes: 0, mocks: 0 };
  const byQuiz = new Map();
  const credit = (quizId, n) => {
    if (!quizId) return;
    byQuiz.set(quizId, (byQuiz.get(quizId) || 0) + n);
  };

  // Answers, gathered per quiz for the runs, and Smart review moves.
  const perQuiz = new Map();
  for (const [id, entry] of Object.entries(attemptsById || {})) {
    const list = (entry && entry.attempts) || [];
    for (const a of list) {
      if (a.correct) { counts.right += 1; credit(a.quizId, R.right); }
      else { counts.wrong += 1; credit(a.quizId, R.wrong); }
      if (!a.quizId) continue;
      if (!perQuiz.has(a.quizId)) perQuiz.set(a.quizId, []);
      perQuiz.get(a.quizId).push({ id, a });
    }
    reviewWalk(list, ({ kind, attempt }) => {
      if (kind === 'up') { counts.reviewUps += 1; credit(attempt.quizId, R.reviewUp); }
      if (kind === 'mastered') { counts.mastered += 1; credit(attempt.quizId, R.mastered); }
    });
  }

  // Runs: answers within one quiz in the order they were given. A mock
  // exam records every answer at submit, often in the same millisecond, so
  // ties fall back to the quiz's own question order.
  const order = new Map((quizzes || []).map((q) => [q.id, q.questionIds || []]));
  for (const [quizId, list] of perQuiz) {
    const ids = order.get(quizId) || [];
    const pos = (id) => { const i = ids.indexOf(id); return i === -1 ? ids.length : i; };
    list.sort((x, y) => x.a.ts - y.a.ts || pos(x.id) - pos(y.id));
    let run = 0;
    for (const { a } of list) {
      run = a.correct ? run + 1 : 0;
      if (run && run % R.streakEvery === 0) { counts.streaks += 1; credit(quizId, R.streakBonus); }
    }
  }

  for (const q of quizzes || []) {
    if (q.mode === 'mock') { counts.mocks += 1; credit(q.id, R.mock); }
    else if ((q.total || 0) >= R.quizMin) { counts.quizzes += 1; credit(q.id, R.quiz); }
  }

  const total = counts.right * R.right + counts.wrong * R.wrong
    + counts.streaks * R.streakBonus + counts.reviewUps * R.reviewUp
    + counts.mastered * R.mastered + counts.quizzes * R.quiz + counts.mocks * R.mock;
  return { total, counts, byQuiz };
}

/**
 * What one step earned, from the history before and after it: the XP
 * gained and its parts, for the "+10 XP" that floats up after an answer.
 */
export function xpGain(before, after) {
  const R = XP_RULES;
  const d = (k) => (after.counts[k] || 0) - (before.counts[k] || 0);
  const parts = [];
  const base = d('right') * R.right + d('wrong') * R.wrong;
  if (base) parts.push({ label: 'XP', xp: base });
  if (d('streaks') > 0) parts.push({ label: 'streak bonus', xp: d('streaks') * R.streakBonus });
  if (d('mastered') > 0) parts.push({ label: 'mastered', xp: d('mastered') * R.mastered });
  if (d('reviewUps') > 0) parts.push({ label: 'review check', xp: d('reviewUps') * R.reviewUp });
  if (d('mocks') > 0) parts.push({ label: 'mock exam', xp: d('mocks') * R.mock });
  if (d('quizzes') > 0) parts.push({ label: 'quiz finished', xp: d('quizzes') * R.quiz });
  const from = levelFor(before.total);
  const to = levelFor(after.total);
  return { xp: after.total - before.total, parts, from, to, levelUp: to.level > from.level };
}
