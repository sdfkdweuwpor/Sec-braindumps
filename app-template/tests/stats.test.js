import test from 'node:test';
import assert from 'node:assert/strict';
import {
  overall, byDomain, byObjective, weakestObjectives, readiness,
  accuracyOverTime, missedHistory, bandFor, COVERAGE_TARGET,
} from '../js/stats.js';

/** `n` questions in one domain, so coverage maths is easy to reason about. */
function bank(spec) {
  const out = [];
  for (const [domain, n] of Object.entries(spec)) {
    for (let i = 0; i < n; i++) {
      out.push({ id: `d${domain}q${i}`, domain: Number(domain), objective: `${domain}.1` });
    }
  }
  return out;
}

/** Mark the first `seen` questions of each domain, `rightRatio` of them correct. */
function history(questions, perDomain) {
  const at = {};
  for (const [domain, { seen, right }] of Object.entries(perDomain)) {
    const qs = questions.filter((q) => q.domain === Number(domain)).slice(0, seen);
    qs.forEach((q, i) => {
      at[q.id] = { attempts: [{ ts: 1000 + i, correct: i < right, selected: ['A'], quizId: 'z' }] };
    });
  }
  return at;
}

test('overall counts seen, answered and coverage', () => {
  const qs = bank({ 1: 10 });
  const at = history(qs, { 1: { seen: 4, right: 3 } });
  const o = overall(qs, at);
  assert.equal(o.total, 10);
  assert.equal(o.seen, 4);
  assert.equal(o.unseen, 6);
  assert.equal(o.answered, 4);
  assert.equal(o.correct, 3);
  assert.equal(o.accuracy, 0.75);
  assert.equal(o.coverage, 0.4);
});

test('overall with no history reports null accuracy, not NaN or zero', () => {
  const o = overall(bank({ 1: 5 }), {});
  assert.equal(o.accuracy, null);
  assert.equal(o.seen, 0);
});

test('repeat attempts on one question count once for coverage, twice for accuracy', () => {
  const qs = bank({ 1: 4 });
  const at = { d1q0: { attempts: [
    { ts: 1, correct: false, selected: ['A'], quizId: 'z' },
    { ts: 2, correct: true, selected: ['B'], quizId: 'z' },
  ] } };
  const o = overall(qs, at);
  assert.equal(o.seen, 1, 'one unique question seen');
  assert.equal(o.answered, 2, 'two answers given');
  assert.equal(o.accuracy, 0.5);
});

test('byDomain carries the official exam weight', () => {
  const rows = byDomain(bank({ 1: 2, 4: 2 }), {});
  assert.deepEqual(rows.map((r) => r.weight), [12, 22, 18, 28, 20]);
  assert.equal(rows.find((r) => r.domain === 4).total, 2);
});

test('byObjective skips objectives with no questions', () => {
  const rows = byObjective(bank({ 2: 3 }), {});
  assert.deepEqual(rows.map((r) => r.objective), ['2.1']);
});

test('weakestObjectives ignores objectives below the attempt floor', () => {
  const qs = [
    ...Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, domain: 1, objective: '1.1' })),
    ...Array.from({ length: 10 }, (_, i) => ({ id: `b${i}`, domain: 1, objective: '1.2' })),
  ];
  const at = {};
  // 1.1: 8 answers, 25% right (weak, and above the floor)
  for (let i = 0; i < 8; i++) at[`a${i}`] = { attempts: [{ ts: i, correct: i < 2, selected: [], quizId: 'z' }] };
  // 1.2: 2 answers, 0% right (worse, but below the 5-attempt floor)
  for (let i = 0; i < 2; i++) at[`b${i}`] = { attempts: [{ ts: i, correct: false, selected: [], quizId: 'z' }] };

  const weak = weakestObjectives(qs, at, { limit: 5, minAttempts: 5 });
  assert.deepEqual(weak.map((w) => w.objective), ['1.1'],
    '1.2 is worse but has too little data to call weak');
});

/* ------------------------------------------------------------ readiness */

test('readiness: perfect accuracy with full coverage scores 100', () => {
  const qs = bank({ 1: 10, 2: 10, 3: 10, 4: 10, 5: 10 });
  const at = {};
  for (const q of qs) at[q.id] = { attempts: [{ ts: 1, correct: true, selected: [], quizId: 'z' }] };
  assert.equal(readiness(qs, at).score, 100);
  assert.equal(readiness(qs, at).band, 'Exam ready');
});

test('readiness: no history scores 0 and is Not ready', () => {
  const r = readiness(bank({ 1: 10, 2: 10, 3: 10, 4: 10, 5: 10 }), {});
  assert.equal(r.score, 0);
  assert.equal(r.band, 'Not ready');
});

test('readiness: the coverage factor stops a tiny sample reading as ready', () => {
  const qs = bank({ 1: 100, 2: 100, 3: 100, 4: 100, 5: 100 });
  // 4 questions answered in one domain, all correct, nothing else touched.
  const at = {};
  for (let i = 0; i < 4; i++) {
    at[`d1q${i}`] = { attempts: [{ ts: i, correct: true, selected: [], quizId: 'z' }] };
  }
  const r = readiness(qs, at);
  // coverage factor = 4 / (0.6 * 100) = 0.0667; contribution = 1 * 0.0667 * 12
  assert.ok(r.score <= 1, `expected ~0-1, got ${r.score}`);
  assert.equal(r.band, 'Not ready');
});

test('readiness: coverage factor saturates at the target, not at 100% of the pool', () => {
  const qs = bank({ 1: 100, 2: 100, 3: 100, 4: 100, 5: 100 });
  const at = {};
  for (const q of qs) {
    const idx = Number(q.id.split('q')[1]);
    // exactly COVERAGE_TARGET of every domain, all correct
    if (idx < 100 * COVERAGE_TARGET) {
      at[q.id] = { attempts: [{ ts: idx, correct: true, selected: [], quizId: 'z' }] };
    }
  }
  assert.equal(readiness(qs, at).score, 100,
    'seeing 60% of every domain with perfect accuracy is full credit');
});

test('readiness: names the biggest drag and whether it is coverage or accuracy', () => {
  const qs = bank({ 1: 100, 2: 100, 3: 100, 4: 100, 5: 100 });
  const at = {};
  // Domains 1-4 fully covered and perfect; domain 5 barely touched.
  for (const q of qs) {
    const idx = Number(q.id.split('q')[1]);
    if (q.domain !== 5 && idx < 60) {
      at[q.id] = { attempts: [{ ts: idx, correct: true, selected: [], quizId: 'z' }] };
    }
  }
  const r = readiness(qs, at);
  assert.equal(r.drags[0].domain, 5);
  assert.equal(r.drags[0].cause, 'coverage');
  assert.match(r.drags[0].text, /Domain 5 coverage/);
});

test('readiness: a well-covered but inaccurate domain is reported as accuracy', () => {
  const qs = bank({ 1: 100, 2: 100, 3: 100, 4: 100, 5: 100 });
  const at = {};
  for (const q of qs) {
    const idx = Number(q.id.split('q')[1]);
    if (idx < 60) {
      const correct = q.domain === 4 ? idx < 6 : true;   // domain 4 at 10%
      at[q.id] = { attempts: [{ ts: idx, correct, selected: [], quizId: 'z' }] };
    }
  }
  const r = readiness(qs, at);
  assert.equal(r.drags[0].domain, 4);
  assert.equal(r.drags[0].cause, 'accuracy');
});

test('readiness bands map at their boundaries', () => {
  assert.equal(bandFor(85), 'Exam ready');
  assert.equal(bandFor(84), 'Approaching');
  assert.equal(bandFor(75), 'Approaching');
  assert.equal(bandFor(74), 'Building');
  assert.equal(bandFor(60), 'Building');
  assert.equal(bandFor(59), 'Not ready');
  assert.equal(bandFor(0), 'Not ready');
});

/* ------------------------------------------------------------- history */

test('accuracyOverTime takes the last N quizzes, oldest first', () => {
  const quizzes = Array.from({ length: 30 }, (_, i) => ({
    id: `q${i}`, ts: i, score: i % 11, total: 10,
  }));
  const pts = accuracyOverTime(quizzes, 5);
  assert.equal(pts.length, 5);
  assert.deepEqual(pts.map((p) => p.id), ['q25', 'q26', 'q27', 'q28', 'q29']);
});

test('accuracyOverTime handles a zero-length quiz without dividing by zero', () => {
  assert.deepEqual(accuracyOverTime([{ id: 'x', ts: 1, score: 0, total: 0 }]),
    [{ id: 'x', ts: 1, percent: 0 }]);
});

test('missedHistory separates still-missed from recovered', () => {
  const qs = bank({ 1: 3 });
  const at = {
    d1q0: { attempts: [{ ts: 1, correct: false, selected: [], quizId: 'z' }] },
    d1q1: { attempts: [
      { ts: 1, correct: false, selected: [], quizId: 'z' },
      { ts: 2, correct: true, selected: [], quizId: 'z' },
    ] },
    d1q2: { attempts: [{ ts: 3, correct: true, selected: [], quizId: 'z' }] },
  };
  const rows = missedHistory(qs, at);
  assert.equal(rows.length, 2, 'never-missed questions are not in Review');
  const byId = Object.fromEntries(rows.map((r) => [r.question.id, r]));
  assert.equal(byId.d1q0.recovered, false);
  assert.equal(byId.d1q1.recovered, true);
  assert.equal(byId.d1q1.missedCount, 1);
});

test('missedHistory drops attempts for questions no longer in the bank', () => {
  const rows = missedHistory(bank({ 1: 1 }), {
    ghost: { attempts: [{ ts: 1, correct: false, selected: [], quizId: 'z' }] },
  });
  assert.equal(rows.length, 0);
});

test('missedHistory sorts most recent first', () => {
  const qs = bank({ 1: 3 });
  const at = {
    d1q0: { attempts: [{ ts: 10, correct: false, selected: [], quizId: 'z' }] },
    d1q1: { attempts: [{ ts: 30, correct: false, selected: [], quizId: 'z' }] },
    d1q2: { attempts: [{ ts: 20, correct: false, selected: [], quizId: 'z' }] },
  };
  assert.deepEqual(missedHistory(qs, at).map((r) => r.question.id), ['d1q1', 'd1q2', 'd1q0']);
});
