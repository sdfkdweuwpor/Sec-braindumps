import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shuffle, buildPool, selectQuestions, selectWeighted, isCorrect, scoreQuiz,
  scaledScore, orderedChoices, emptyPoolReason,
} from '../js/quizEngine.js';

/** Deterministic rng so shuffles are reproducible. */
function rngFrom(seed) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

function q(id, domain, objective, correct = ['A'], choiceKeys = ['A', 'B', 'C', 'D']) {
  return {
    id, domain, objective,
    type: correct.length > 1 ? 'multi' : 'single',
    question: `question ${id}`,
    choices: choiceKeys.map((k) => ({ key: k, text: `choice ${k}` })),
    correct,
  };
}

const BANK = [
  q('q1', 1, '1.1'), q('q2', 1, '1.2'), q('q3', 2, '2.1'),
  q('q4', 2, '2.2'), q('q5', 3, '3.1'), q('q6', 4, '4.1'),
  q('q7', 4, '4.2'), q('q8', 5, '5.1'),
];

const ctx = (over = {}) => ({
  questions: BANK, missedIds: [], flaggedIds: [], correctCount: () => 0, ...over,
});

/* ------------------------------------------------------ pool filtering */

test('pool: all returns the whole bank', () => {
  assert.equal(buildPool({ source: 'all' }, ctx()).length, 8);
});

test('pool: by domain filters, and multiple domains merge', () => {
  assert.deepEqual(buildPool({ source: 'domain', domains: [1] }, ctx()).map((x) => x.id),
    ['q1', 'q2']);
  assert.equal(buildPool({ source: 'domain', domains: [1, 4] }, ctx()).length, 4);
});

test('pool: by domain with nothing selected is empty, not everything', () => {
  assert.equal(buildPool({ source: 'domain', domains: [] }, ctx()).length, 0);
});

test('pool: by objective filters to exact objectives', () => {
  assert.deepEqual(
    buildPool({ source: 'objective', objectives: ['1.2', '4.2'] }, ctx()).map((x) => x.id),
    ['q2', 'q7']);
});

test('pool: missed uses attempt history', () => {
  const c = ctx({ missedIds: ['q3', 'q6'] });
  assert.deepEqual(buildPool({ source: 'missed' }, c).map((x) => x.id), ['q3', 'q6']);
});

test('pool: missed scoped by domain', () => {
  const c = ctx({ missedIds: ['q3', 'q6', 'q7'] });
  assert.deepEqual(
    buildPool({ source: 'missed', scope: 'domain', domains: [4] }, c).map((x) => x.id),
    ['q6', 'q7']);
});

test('pool: missed scoped by objective', () => {
  const c = ctx({ missedIds: ['q3', 'q6', 'q7'] });
  assert.deepEqual(
    buildPool({ source: 'missed', scope: 'objective', objectives: ['4.2'] }, c).map((x) => x.id),
    ['q7']);
});

test('pool: flagged, and flagged scoped by domain', () => {
  const c = ctx({ flaggedIds: ['q1', 'q5', 'q8'] });
  assert.equal(buildPool({ source: 'flagged' }, c).length, 3);
  assert.deepEqual(
    buildPool({ source: 'flagged', scope: 'domain', domains: [3] }, c).map((x) => x.id),
    ['q5']);
});

test('pool: excludeCorrectCount drops questions already known', () => {
  const known = { q1: 3, q2: 1, q3: 0 };
  const c = ctx({ correctCount: (id) => known[id] || 0 });
  const ids = buildPool({ source: 'all', excludeCorrectCount: 2 }, c).map((x) => x.id);
  assert.ok(!ids.includes('q1'), 'q1 answered right 3x should be excluded');
  assert.ok(ids.includes('q2'), 'q2 answered right once should remain at threshold 2');
});

/* ---------------------------------------------------- count behaviour */

test('count: clamps to pool size, never pads', () => {
  assert.equal(selectQuestions(BANK, 100).length, 8);
  assert.equal(selectQuestions(BANK, 3).length, 3);
});

test('count: "all" takes the whole pool', () => {
  assert.equal(selectQuestions(BANK, 'all').length, 8);
});

test('count: zero and negative requests yield nothing', () => {
  assert.equal(selectQuestions(BANK, 0).length, 0);
  assert.equal(selectQuestions(BANK, -5).length, 0);
});

test('no duplicate questions within one quiz', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const picked = selectQuestions(BANK, 8, { rng: rngFrom(seed) });
    assert.equal(new Set(picked.map((x) => x.id)).size, picked.length);
  }
});

test('shuffle keeps every element exactly once', () => {
  const out = shuffle(BANK, rngFrom(99));
  assert.deepEqual(out.map((x) => x.id).sort(), BANK.map((x) => x.id).sort());
});

test('shuffleQuestions:false preserves pool order', () => {
  assert.deepEqual(selectQuestions(BANK, 4, { shuffleQuestions: false }).map((x) => x.id),
    ['q1', 'q2', 'q3', 'q4']);
});

/* ------------------------------------------------------------ scoring */

test('single answer: exact match only', () => {
  const s = q('s', 1, '1.1', ['C']);
  assert.ok(isCorrect(s, ['C']));
  assert.ok(!isCorrect(s, ['A']));
  assert.ok(!isCorrect(s, []));
});

test('multi answer is all-or-nothing: partial credit counts as wrong', () => {
  const m = q('m', 1, '1.1', ['B', 'D']);
  assert.ok(isCorrect(m, ['B', 'D']), 'both correct');
  assert.ok(isCorrect(m, ['D', 'B']), 'order must not matter');
  assert.ok(!isCorrect(m, ['B']), 'one of two is wrong, not half right');
  assert.ok(!isCorrect(m, ['B', 'D', 'A']), 'a superset is wrong');
  assert.ok(!isCorrect(m, ['A', 'C']), 'both wrong');
});

test('multi answer ignores duplicate selections', () => {
  const m = q('m', 1, '1.1', ['B', 'D']);
  assert.ok(isCorrect(m, ['B', 'D', 'B']));
});

test('scoreQuiz counts only fully correct answers', () => {
  const qs = [q('a', 1, '1.1', ['A']), q('b', 1, '1.1', ['B', 'C'])];
  assert.deepEqual(scoreQuiz(qs, { a: ['A'], b: ['B'] }),
    { correct: 1, total: 2, percent: 50 });
});

test('scoreQuiz on an empty quiz does not divide by zero', () => {
  assert.deepEqual(scoreQuiz([], {}), { correct: 0, total: 0, percent: 0 });
});

/* ------------------------------------------------------ scaled score */

test('scaled score maps 0-100% onto 100-900 and clamps', () => {
  assert.equal(scaledScore(0), 100);
  assert.equal(scaledScore(100), 900);
  assert.equal(scaledScore(50), 500);
  assert.equal(scaledScore(-10), 100);
  assert.equal(scaledScore(150), 900);
});

/* --------------------------------------------------- mock exam weights */

test('weighted draw hits the requested total and respects exam weights', () => {
  const big = [];
  for (let d = 1; d <= 5; d++) for (let i = 0; i < 100; i++) big.push(q(`d${d}-${i}`, d, `${d}.1`));
  const { questions, shortfall } = selectWeighted(big, 90, { rng: rngFrom(3) });
  assert.equal(questions.length, 90);
  assert.equal(shortfall.length, 0);
  const per = {};
  for (const x of questions) per[x.domain] = (per[x.domain] || 0) + 1;
  assert.deepEqual(per, { 1: 11, 2: 20, 3: 16, 4: 25, 5: 18 });
  assert.equal(new Set(questions.map((x) => x.id)).size, 90, 'no repeats');
});

test('weighted draw backfills rather than shipping a short exam', () => {
  const thin = [];
  for (let i = 0; i < 100; i++) thin.push(q(`a${i}`, 1, '1.1'));
  for (let i = 0; i < 2; i++) thin.push(q(`e${i}`, 5, '5.1'));
  const { questions, shortfall } = selectWeighted(thin, 50, { rng: rngFrom(5) });
  assert.equal(questions.length, 50);
  assert.ok(shortfall.length > 0, 'the thin domain is reported');
  assert.equal(new Set(questions.map((x) => x.id)).size, 50);
});

/* ------------------------------------------------------- choice order */

test('orderedChoices keeps every choice, and can preserve source order', () => {
  const x = q('x', 1, '1.1');
  assert.deepEqual(orderedChoices(x, { shuffleChoices: false }).map((c) => c.key),
    ['A', 'B', 'C', 'D']);
  assert.deepEqual(orderedChoices(x, { rng: rngFrom(2) }).map((c) => c.key).sort(),
    ['A', 'B', 'C', 'D']);
});

/* ---------------------------------------------------- empty-pool copy */

test('empty pool reasons name the filter that emptied it', () => {
  assert.match(emptyPoolReason({ source: 'missed' }, ctx()), /No missed questions yet/);
  assert.match(
    emptyPoolReason({ source: 'missed', scope: 'domain', domains: [3] }, ctx({ missedIds: ['q1'] })),
    /No missed questions in Domain 3/);
  assert.match(emptyPoolReason({ source: 'flagged' }, ctx()), /Nothing saved yet/);
  assert.match(emptyPoolReason({ source: 'domain', domains: [] }, ctx()), /at least one domain/);
});

/* ---------------------------------------------------------- display letters */
test('letters follow position, so the top choice always reads A', async () => {
  const { letterMap } = await import('../js/quizEngine.js');
  assert.deepEqual(letterMap(['C', 'A', 'D', 'B']), { C: 'A', A: 'B', D: 'C', B: 'D' });
  assert.deepEqual(letterMap(['F', 'E', 'D', 'C', 'B', 'A']).A, 'F');
});

/* -------------------------------------------------------- similar questions */
test('similar questions come from the bank, on topic, without repeats', async () => {
  const { similarQuestions, ALL_QUESTIONS, QUESTIONS_BY_ID } = await import('../js/quizEngine.js');
  if (!ALL_QUESTIONS.length) return;          // template: no bank loaded
  const sms = ALL_QUESTIONS.find((q) => /text message/i.test(q.question)
    && q.choices.some((c) => q.correct.includes(c.key) && /smishing/i.test(c.text)));
  assert.ok(sms, 'fixture: a smishing question exists');
  const exclude = ALL_QUESTIONS.slice(0, 20).map((q) => q.id).filter((id) => id !== sms.id);
  const picks = similarQuestions(sms, { exclude, limit: 10 });

  assert.equal(picks.length, 10);
  for (const q of picks) assert.equal(QUESTIONS_BY_ID.get(q.id), q, 'every pick is a real bank question');
  assert.ok(!picks.some((q) => q.id === sms.id), 'never the question itself');
  assert.ok(!picks.some((q) => exclude.includes(q.id)), 'never a question from the current quiz');
  const stems = picks.map((q) => `${q.question}|${q.choices.map((c) => c.text).sort().join('|')}`.toLowerCase());
  assert.equal(new Set(stems).size, stems.length, 'no exact duplicates among the picks');
  const onTopic = picks.filter((q) => /smish|text message|sms/i.test(q.question + q.choices.map((c) => c.text).join(' ')));
  assert.ok(onTopic.length >= 6, `only ${onTopic.length} of 10 picks are about text-message phishing`);
});
