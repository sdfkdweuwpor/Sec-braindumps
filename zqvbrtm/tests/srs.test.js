import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STEPS, reviewState, reviewSummary, reviewChanges, addDays, startOfDay, daysUntil,
} from '../js/srs.js';

// Local-time timestamps, so day boundaries match what the app sees.
const at = (d, h = 12, m = 0) => new Date(2026, 0, d, h, m).getTime();
const wrong = (ts, quizId = 'q') => ({ ts, correct: false, selected: ['A'], quizId });
const right = (ts, quizId = 'q') => ({ ts, correct: true, selected: ['B'], quizId });

test('the ladder is 1, 3, then 7 days', () => {
  assert.deepEqual(STEPS, [1, 3, 7]);
});

test('a question never missed is not in review', () => {
  assert.deepEqual(reviewState([right(at(1)), right(at(5))]), { state: null, mastered: false });
  assert.deepEqual(reviewState([]), { state: null, mastered: false });
});

test('a miss schedules the first check for the next calendar day', () => {
  const { state } = reviewState([wrong(at(10, 23, 30))]);
  assert.equal(state.step, 0);
  assert.equal(state.due, startOfDay(at(11)));   // midnight, not 23:30 the next night
});

test('right at each check climbs 1 -> 3 -> 7 days, then mastered', () => {
  const log = [wrong(at(1))];
  log.push(right(at(2, 9)));
  let r = reviewState(log);
  assert.equal(r.state.step, 1);
  assert.equal(r.state.due, addDays(at(2), 3));

  log.push(right(at(5, 9)));
  r = reviewState(log);
  assert.equal(r.state.step, 2);
  assert.equal(r.state.due, addDays(at(5), 7));

  log.push(right(at(12, 9)));
  r = reviewState(log);
  assert.equal(r.state, null);
  assert.equal(r.mastered, true);
});

test('a right answer before the check is due does not move it', () => {
  const r = reviewState([wrong(at(1)), right(at(1, 18)), right(at(1, 20))]);
  assert.equal(r.state.step, 0);
  assert.equal(r.state.due, startOfDay(at(2)));
});

test('a miss at any rung sends it back to the 1-day check', () => {
  const r = reviewState([wrong(at(1)), right(at(2)), right(at(5)), wrong(at(8))]);
  assert.equal(r.state.step, 0);
  assert.equal(r.state.due, startOfDay(at(9)));
});

test('a mastered question missed again goes back on the ladder', () => {
  const r = reviewState([wrong(at(1)), right(at(2)), right(at(5)), right(at(12)), wrong(at(20))]);
  assert.equal(r.mastered, false);
  assert.equal(r.state.step, 0);
});

test('attempts are read in time order whatever order they are stored in', () => {
  const r = reviewState([right(at(2)), wrong(at(1))]);
  assert.equal(r.state.step, 1);
});

test('summary splits due from upcoming, most overdue first', () => {
  const attempts = {
    q1: { attempts: [wrong(at(1))] },                     // due Jan 2
    q2: { attempts: [wrong(at(3))] },                     // due Jan 4
    q3: { attempts: [wrong(at(1)), right(at(2))] },       // step 1, due Jan 5
    q4: { attempts: [right(at(1))] },                     // never missed
    q5: { attempts: [wrong(at(1)), right(at(2)), right(at(5)), right(at(12))] }, // mastered
    gone: { attempts: [wrong(at(1))] },                   // not in the bank any more
  };
  const s = reviewSummary(attempts, { now: at(4, 8), isKnown: (id) => id !== 'gone' });
  assert.deepEqual(s.due.map((d) => d.id), ['q1', 'q2']);
  assert.deepEqual(s.upcoming.map((d) => d.id), ['q3']);
  assert.deepEqual(s.counts, [2, 1, 0]);
  assert.equal(s.mastered, 1);
  assert.equal(s.inReview, 3);
  assert.equal(s.nextDue, addDays(at(2), 3));
  assert.equal(s.nextDueCount, 1);
});

test('daysUntil counts calendar days', () => {
  assert.equal(daysUntil(startOfDay(at(5)), at(4, 23, 59)), 1);
  assert.equal(daysUntil(startOfDay(at(11)), at(4, 0, 1)), 7);
});

test('reviewChanges reports what one quiz did to the ladder', () => {
  const attempts = {
    added: { attempts: [wrong(at(3), 'now')] },
    up: { attempts: [wrong(at(1), 'old'), right(at(3), 'now')] },
    done: { attempts: [wrong(at(1), 'old'), right(at(2), 'old'), right(at(5), 'old'), right(at(12), 'now')] },
    reset: { attempts: [wrong(at(1), 'old'), right(at(2), 'old'), wrong(at(5), 'now')] },
    early: { attempts: [wrong(at(3), 'old'), right(at(3, 18), 'now')] },
    other: { attempts: [wrong(at(1), 'old')] },
  };
  const ids = ['added', 'up', 'done', 'reset', 'early', 'other'];
  assert.deepEqual(reviewChanges(attempts, ids, 'now'), { added: 1, up: 1, mastered: 1, reset: 1 });
});
