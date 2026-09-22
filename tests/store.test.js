import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * store.js probes window.localStorage when it loads, so each test installs a
 * fake first and imports a fresh copy (the query string defeats the module
 * cache).
 */
let loadCount = 0;
function fakeStorage(initial = {}, { throwOnWrite = false, throwOnRead = false } = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem(k) {
      if (throwOnRead) throw new DOMException('denied', 'SecurityError');
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      if (throwOnWrite) throw new DOMException('quota', 'QuotaExceededError');
      map.set(k, String(v));
    },
    removeItem(k) { map.delete(k); },
  };
}

async function loadStore(storage) {
  globalThis.window = storage === null ? undefined : { localStorage: storage };
  loadCount += 1;
  return import(`../js/store.js?n=${loadCount}`);
}

/* ------------------------------------------------------------ schema */

test('init seeds schema v1 on a fresh install', async () => {
  const ls = fakeStorage();
  const store = await loadStore(ls);
  assert.equal(store.init(), 1);
  assert.equal(ls.map.get('secplus.version'), '1');
  assert.deepEqual(JSON.parse(ls.map.get('secplus.attempts')), {});
  assert.deepEqual(JSON.parse(ls.map.get('secplus.flagged')), []);
  assert.equal(JSON.parse(ls.map.get('secplus.settings')).theme, 'dark');
});

test('migrate from 0 preserves history that is already present', async () => {
  const existing = {
    'secplus.attempts': JSON.stringify({
      q0001: { attempts: [{ ts: 1, correct: true, selected: ['A'], quizId: 'q' }] },
    }),
    'secplus.flagged': JSON.stringify(['q0002']),
  };
  const ls = fakeStorage(existing);
  const store = await loadStore(ls);
  assert.equal(store.migrate(0), 1);
  assert.deepEqual(Object.keys(store.getAttempts()), ['q0001'],
    'existing attempts must survive the migration');
  assert.deepEqual(store.getFlagged(), ['q0002']);
});

test('migrate is idempotent', async () => {
  const ls = fakeStorage();
  const store = await loadStore(ls);
  store.init();
  store.recordAttempt('q0001', { correct: true, selected: ['A'], quizId: 'q' });
  assert.equal(store.migrate(1), 1);
  assert.equal(store.migrate(1), 1);
  assert.equal(store.attemptsFor('q0001').length, 1, 'migrating again must not duplicate or wipe');
});

test('init on an already-migrated store is a no-op', async () => {
  const ls = fakeStorage({ 'secplus.version': '1' });
  const store = await loadStore(ls);
  store.recordAttempt('q0009', { correct: false, selected: ['B'], quizId: 'q' });
  assert.equal(store.init(), 1);
  assert.equal(store.attemptsFor('q0009').length, 1);
});

/* ----------------------------------------------------------- attempts */

test('attempts are keyed by question id and append in order', async () => {
  const store = await loadStore(fakeStorage());
  store.init();
  store.recordAttempt('q0100', { correct: false, selected: ['A'], quizId: 'q1', ts: 10 });
  store.recordAttempt('q0100', { correct: true, selected: ['C'], quizId: 'q2', ts: 20 });
  const list = store.attemptsFor('q0100');
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((a) => a.correct), [false, true]);
  assert.deepEqual(list[1].selected, ['C']);
});

test('multi-answer selections are stored sorted so order never matters', async () => {
  const store = await loadStore(fakeStorage());
  store.init();
  store.recordAttempt('q1', { correct: true, selected: ['D', 'B'], quizId: 'q' });
  assert.deepEqual(store.attemptsFor('q1')[0].selected, ['B', 'D']);
});

test('missedIds: ever-wrong vs still-wrong', async () => {
  const store = await loadStore(fakeStorage());
  store.init();
  store.recordAttempt('wrongOnce', { correct: false, selected: ['A'], quizId: 'q' });
  store.recordAttempt('recovered', { correct: false, selected: ['A'], quizId: 'q' });
  store.recordAttempt('recovered', { correct: true, selected: ['B'], quizId: 'q' });
  store.recordAttempt('alwaysRight', { correct: true, selected: ['B'], quizId: 'q' });

  assert.deepEqual(store.missedIds().sort(), ['recovered', 'wrongOnce']);
  assert.deepEqual(store.missedIds({ stillMissedOnly: true }), ['wrongOnce']);
});

test('correctCount counts only correct attempts', async () => {
  const store = await loadStore(fakeStorage());
  store.init();
  for (const c of [true, false, true, true]) {
    store.recordAttempt('q1', { correct: c, selected: ['A'], quizId: 'q' });
  }
  assert.equal(store.correctCount('q1'), 3);
  assert.equal(store.correctCount('never-seen'), 0);
});

/* ------------------------------------------------------------ flagged */

test('toggleFlag flips and reports the new state', async () => {
  const store = await loadStore(fakeStorage());
  store.init();
  assert.equal(store.toggleFlag('q1'), true);
  assert.ok(store.isFlagged('q1'));
  assert.equal(store.toggleFlag('q1'), false);
  assert.ok(!store.isFlagged('q1'));
});

test('setFlag is idempotent in both directions', async () => {
  const store = await loadStore(fakeStorage());
  store.init();
  store.setFlag('q1', true);
  store.setFlag('q1', true);
  assert.deepEqual(store.getFlagged(), ['q1']);
  store.setFlag('q1', false);
  store.setFlag('q1', false);
  assert.deepEqual(store.getFlagged(), []);
});

/* ---------------------------------------------------- export / import */

test('export then import round-trips progress', async () => {
  const a = await loadStore(fakeStorage());
  a.init();
  a.recordAttempt('q0007', { correct: true, selected: ['B'], quizId: 'q1' });
  a.setFlag('q0008', true);
  a.saveQuizResult({ id: 'q1', ts: 1, mode: 'custom', config: {}, questionIds: ['q0007'],
                     score: 1, total: 1, durationMs: 5 });
  const payload = a.exportProgress();

  const b = await loadStore(fakeStorage());
  b.init();
  b.importProgress(payload);
  assert.equal(b.attemptsFor('q0007').length, 1);
  assert.deepEqual(b.getFlagged(), ['q0008']);
  assert.equal(b.getQuizzes().length, 1);
});

test('import rejects junk with a readable message instead of corrupting state', async () => {
  const store = await loadStore(fakeStorage());
  store.init();
  store.recordAttempt('keepme', { correct: true, selected: ['A'], quizId: 'q' });

  assert.throws(() => store.importProgress(null), /not a progress export/);
  assert.throws(() => store.importProgress({}), /schema version/);
  assert.throws(() => store.importProgress({ schema: 99 }), /newer version/);
  assert.equal(store.attemptsFor('keepme').length, 1, 'a failed import must not wipe history');
});

test('resetProgress clears history but leaves settings alone', async () => {
  const store = await loadStore(fakeStorage());
  store.init();
  store.setSettings({ theme: 'light' });
  store.recordAttempt('q1', { correct: true, selected: ['A'], quizId: 'q' });
  store.setFlag('q2', true);
  store.resetProgress();
  assert.deepEqual(store.getAttempts(), {});
  assert.deepEqual(store.getFlagged(), []);
  assert.equal(store.getSettings().theme, 'light', 'theme is a preference, not progress');
});

/* -------------------------------------------------- storage failures */

test('unavailable storage degrades to memory and reports it', async () => {
  const store = await loadStore(null);          // no window at all
  assert.equal(store.storageFailed(), true);
  store.init();
  store.recordAttempt('q1', { correct: true, selected: ['A'], quizId: 'q' });
  assert.equal(store.attemptsFor('q1').length, 1, 'the session still works in memory');
});

test('storage that throws on write degrades without losing the value', async () => {
  const store = await loadStore(fakeStorage({}, { throwOnWrite: true }));
  assert.equal(store.storageFailed(), true);
  store.init();
  store.setFlag('q1', true);
  assert.deepEqual(store.getFlagged(), ['q1']);
});

test('a corrupt stored value is replaced rather than throwing on every read', async () => {
  const ls = fakeStorage({ 'secplus.version': '1', 'secplus.flagged': '{not json' });
  const store = await loadStore(ls);
  assert.deepEqual(store.getFlagged(), []);
  assert.deepEqual(JSON.parse(ls.map.get('secplus.flagged')), [], 'the bad value is overwritten');
});

test('settings always come back with defaults filled in', async () => {
  const ls = fakeStorage({ 'secplus.version': '1', 'secplus.settings': '{"theme":"light"}' });
  const store = await loadStore(ls);
  const s = store.getSettings();
  assert.equal(s.theme, 'light');
  assert.equal(s.shuffleQuestions, true, 'missing keys fall back to defaults');
  assert.equal(s.feedbackMode, 'immediate');
});
