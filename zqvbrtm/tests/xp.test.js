import test from 'node:test';
import assert from 'node:assert/strict';
import { XP_RULES, LEVELS, levelFor, computeXP, xpGain } from '../js/xp.js';

const at = (d, h = 12, m = 0, s = 0) => new Date(2026, 0, d, h, m, s).getTime();
const ans = (ts, correct, quizId = 'quiz-1') => ({ ts, correct, selected: ['A'], quizId });
const log = (map) => Object.fromEntries(Object.entries(map).map(([id, attempts]) => [id, { attempts }]));

test('levels climb from Recruit, each needing more XP than the last', () => {
  assert.equal(LEVELS[0].xp, 0);
  assert.equal(LEVELS[0].title, 'Recruit');
  for (let i = 2; i < LEVELS.length; i += 1) {
    assert.ok(LEVELS[i].xp - LEVELS[i - 1].xp >= LEVELS[i - 1].xp - LEVELS[i - 2].xp,
      `gap before level ${i + 1} should not shrink`);
  }
  assert.equal(new Set(LEVELS.map((l) => l.title)).size, LEVELS.length);
});

test('levelFor places a total and measures the way to the next level', () => {
  assert.equal(levelFor(0).level, 1);
  assert.equal(levelFor(149).level, 1);
  const two = levelFor(150);
  assert.equal(two.level, 2);
  assert.equal(two.title, 'Help Desk Hero');
  assert.equal(two.nextTitle, 'Patch Tuesday Regular');
  assert.equal(two.toNext, 250);
  assert.equal(two.progress, 0);
  assert.equal(levelFor(275).progress, 0.5);
  const top = levelFor(1e6);
  assert.equal(top.level, LEVELS.length);
  assert.equal(top.next, null);
  assert.equal(top.progress, 1);
  assert.equal(levelFor(-5).level, 1);
});

test('right answers earn 10, wrong ones 3', () => {
  const x = computeXP(log({ q1: [ans(at(1), true)], q2: [ans(at(1, 13), false)] }));
  assert.equal(x.counts.right, 1);
  assert.equal(x.counts.wrong, 1);
  assert.equal(x.total, XP_RULES.right + XP_RULES.wrong);
});

test('every 5 right in a row within a quiz earns a streak bonus', () => {
  const ids = Array.from({ length: 11 }, (_, i) => `q${i}`);
  const map = {};
  ids.forEach((id, i) => { map[id] = [ans(at(1, 10, i), i !== 5)]; });   // the 6th is wrong
  const x = computeXP(log(map));
  // run of 5 (bonus), miss, run of 5 (bonus)
  assert.equal(x.counts.streaks, 2);
  assert.equal(x.total, 10 * XP_RULES.right + XP_RULES.wrong + 2 * XP_RULES.streakBonus);
});

test('runs do not carry across quizzes', () => {
  const map = {};
  for (let i = 0; i < 4; i += 1) map[`a${i}`] = [ans(at(1, 10, i), true, 'quiz-a')];
  for (let i = 0; i < 4; i += 1) map[`b${i}`] = [ans(at(1, 11, i), true, 'quiz-b')];
  assert.equal(computeXP(log(map)).counts.streaks, 0);
});

test('a mock exam recorded in one instant still counts runs in question order', () => {
  const t = at(2);
  const quiz = { id: 'mock-1', mode: 'mock', total: 6, questionIds: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'] };
  // Stored out of order: m6 (wrong) was first answered long ago in another quiz.
  const map = { m6: [ans(at(1), true, 'old'), ans(t, false, 'mock-1')] };
  for (const id of ['m1', 'm2', 'm3', 'm4', 'm5']) map[id] = [ans(t, true, 'mock-1')];
  const x = computeXP(log(map), [quiz]);
  assert.equal(x.counts.streaks, 1);        // m1-m5 in a row; m6 wrong comes after
  assert.equal(x.counts.mocks, 1);
});

test('Smart review checks passed and questions mastered earn XP', () => {
  const x = computeXP(log({ q1: [
    ans(at(1), false),          // added to review (no bonus)
    ans(at(2, 9), true),        // 1-day check passed
    ans(at(5, 9), true),        // 3-day check passed
    ans(at(12, 9), true),       // 7-day check passed: mastered
  ] }));
  assert.equal(x.counts.reviewUps, 2);
  assert.equal(x.counts.mastered, 1);
  assert.equal(x.total, XP_RULES.wrong + 3 * XP_RULES.right + 2 * XP_RULES.reviewUp + XP_RULES.mastered);
});

test('finished quizzes earn a bonus; mock exams earn more; short quizzes none', () => {
  const quizzes = [
    { id: 'a', mode: 'custom', total: 20 },
    { id: 'b', mode: 'custom', total: 5 },
    { id: 'c', mode: 'mock', total: 90 },
  ];
  const x = computeXP({}, quizzes);
  assert.equal(x.counts.quizzes, 1);
  assert.equal(x.counts.mocks, 1);
  assert.equal(x.total, XP_RULES.quiz + XP_RULES.mock);
  assert.equal(x.byQuiz.get('a'), XP_RULES.quiz);
  assert.equal(x.byQuiz.get('b'), undefined);
});

test('XP is credited to the quiz that earned it', () => {
  const map = {
    q1: [ans(at(1), true, 'first'), ans(at(3), false, 'second')],
    q2: [ans(at(3, 13), true, 'second')],
  };
  const x = computeXP(log(map), [{ id: 'second', mode: 'custom', total: 12 }]);
  assert.equal(x.byQuiz.get('first'), XP_RULES.right);
  assert.equal(x.byQuiz.get('second'), XP_RULES.wrong + XP_RULES.right + XP_RULES.quiz);
});

test('xpGain splits a step into its parts and spots a level up', () => {
  const before = computeXP(log({ a: [ans(at(1, 10, 0), true)], b: [ans(at(1, 10, 1), true)],
    c: [ans(at(1, 10, 2), true)], d: [ans(at(1, 10, 3), true)] }));
  const after = computeXP(log({ a: [ans(at(1, 10, 0), true)], b: [ans(at(1, 10, 1), true)],
    c: [ans(at(1, 10, 2), true)], d: [ans(at(1, 10, 3), true)], e: [ans(at(1, 10, 4), true)] }));
  const g = xpGain(before, after);
  assert.equal(g.xp, XP_RULES.right + XP_RULES.streakBonus);
  assert.deepEqual(g.parts, [{ label: 'XP', xp: XP_RULES.right }, { label: 'streak bonus', xp: XP_RULES.streakBonus }]);
  assert.equal(g.levelUp, false);

  const big = xpGain({ total: 140, counts: {} }, { total: 160, counts: { right: 2 } });
  assert.equal(big.levelUp, true);
  assert.equal(big.to.title, 'Help Desk Hero');
});
