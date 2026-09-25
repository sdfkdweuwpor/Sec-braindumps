import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_QUESTIONS, QUESTIONS_BY_ID } from '../data/index.js';
import { DOMAINS, OBJECTIVES, OBJECTIVES_BY_DOMAIN } from '../data/domains.js';

/**
 * Guards the shipped bank, not the extractor. tools/validate.py is the
 * thorough check; this catches a bad regeneration before it reaches the app.
 *
 * The template ships with no questions, so every test that reads the bank is
 * skipped until tools/extract.py has produced one. The exam-metadata tests
 * below always run: they check tools/objectives.py, which is set up for
 * Security+ SY0-701 -- change those numbers along with it for another exam.
 */
const bank = {
  skip: ALL_QUESTIONS.length === 0 && 'no question bank loaded yet -- run tools/extract.py',
};

test('every id is unique', bank, () => {
  assert.equal(new Set(ALL_QUESTIONS.map((q) => q.id)).size, ALL_QUESTIONS.length);
  assert.equal(QUESTIONS_BY_ID.size, ALL_QUESTIONS.length);
});

test('domain metadata matches the published exam weights', () => {
  assert.deepEqual(Object.keys(DOMAINS), ['1', '2', '3', '4', '5']);
  assert.equal(Object.values(DOMAINS).reduce((s, d) => s + d.weight, 0), 100);
  assert.deepEqual(Object.values(DOMAINS).map((d) => d.weight), [12, 22, 18, 28, 20]);
});

test('the objective list is the full SY0-701 set', () => {
  assert.equal(Object.keys(OBJECTIVES).length, 28);
  assert.deepEqual(OBJECTIVES_BY_DOMAIN['1'].length, 4);
  assert.deepEqual(OBJECTIVES_BY_DOMAIN['2'].length, 5);
  assert.deepEqual(OBJECTIVES_BY_DOMAIN['3'].length, 4);
  assert.deepEqual(OBJECTIVES_BY_DOMAIN['4'].length, 9);
  assert.deepEqual(OBJECTIVES_BY_DOMAIN['5'].length, 6);
});

test('every question is structurally sound', bank, () => {
  for (const q of ALL_QUESTIONS) {
    const keys = q.choices.map((c) => c.key);
    assert.ok(q.question.trim().length > 0, `${q.id}: empty stem`);
    assert.ok(q.choices.length >= 2 && q.choices.length <= 8,
      `${q.id}: ${q.choices.length} choices`);
    assert.equal(new Set(keys).size, keys.length, `${q.id}: duplicate choice keys`);
    for (const c of q.choices) assert.ok(c.text.trim().length > 0, `${q.id}: empty choice ${c.key}`);

    assert.ok(Array.isArray(q.correct) && q.correct.length > 0, `${q.id}: no answer`);
    for (const k of q.correct) assert.ok(keys.includes(k), `${q.id}: answer ${k} not a choice`);

    assert.equal(q.type, q.correct.length > 1 ? 'multi' : 'single', `${q.id}: wrong type`);
    assert.ok([1, 2, 3, 4, 5].includes(q.domain), `${q.id}: bad domain ${q.domain}`);
    assert.ok(OBJECTIVES[q.objective], `${q.id}: unknown objective ${q.objective}`);
    assert.equal(OBJECTIVES[q.objective].domain, q.domain,
      `${q.id}: objective ${q.objective} does not sit in domain ${q.domain}`);
  }
});

test('no answer letter dominates, which would mean a misaligned key', bank, () => {
  const counts = {};
  let total = 0;
  for (const q of ALL_QUESTIONS) for (const k of q.correct) { counts[k] = (counts[k] || 0) + 1; total += 1; }
  for (const [k, n] of Object.entries(counts)) {
    assert.ok(n / total < 0.4, `answer ${k} is ${Math.round((n / total) * 100)}% of all keys`);
  }
});

test('domain files partition the bank with no overlap', bank, () => {
  const perDomain = {};
  for (const q of ALL_QUESTIONS) perDomain[q.domain] = (perDomain[q.domain] || 0) + 1;
  assert.equal(Object.values(perDomain).reduce((a, b) => a + b, 0), ALL_QUESTIONS.length);
  for (const d of Object.keys(DOMAINS)) assert.ok(perDomain[d] > 0, `domain ${d} has no questions`);
});

test('explanation provenance is consistent', bank, () => {
  for (const q of ALL_QUESTIONS) {
    if (q.explanation === null) {
      assert.equal(q.needsExplanation, true, `${q.id}: null explanation not flagged`);
      assert.equal(q.explanationSource, null, `${q.id}: source set with no explanation`);
    } else {
      assert.ok(['pdf', 'authored', 'pdf+authored'].includes(q.explanationSource),
        `${q.id}: bad explanationSource ${q.explanationSource}`);
    }
    assert.equal(typeof q.incorrectExplanations, 'object');
    for (const k of Object.keys(q.incorrectExplanations)) {
      assert.ok(q.choices.some((c) => c.key === k),
        `${q.id}: incorrectExplanations mentions choice ${k}, which does not exist`);
      assert.ok(!q.correct.includes(k),
        `${q.id}: ${k} is a correct answer but has a "why it is wrong" note`);
    }
  }
});
