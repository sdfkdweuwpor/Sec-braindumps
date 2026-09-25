/**
 * The only module that touches localStorage. Everything else goes through
 * these functions.
 *
 * If storage is unavailable (private browsing, blocked site data) every read
 * and write falls back to an in-memory object for the life of the page and
 * `storageFailed` flips true so the UI can say progress will not persist.
 */

import { STORAGE_NAMESPACE as NS } from './config.js';

/** Which app a progress export belongs to, e.g. 'template'. */
export const APP_ID = NS.replace(/\W+$/, '');
/** One-shot sessionStorage handoff from Stats to the quiz builder. */
export const PREFILL_KEY = NS + 'prefill';
export const SCHEMA_VERSION = 1;

const KEYS = {
  version: NS + 'version',
  attempts: NS + 'attempts',
  flagged: NS + 'flagged',
  quizzes: NS + 'quizzes',
  activeQuiz: NS + 'activeQuiz',
  settings: NS + 'settings',
};

export const DEFAULT_SETTINGS = {
  theme: 'light',
  shuffleQuestions: true,
  shuffleChoices: true,
  feedbackMode: 'immediate',
};

const memory = new Map();
let usingMemory = false;

export function storageFailed() {
  return usingMemory;
}

function probe() {
  try {
    const k = NS + '__probe';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch (err) {
    // Private browsing, disabled site data, or a full quota. Not recoverable
    // here -- degrade to memory and let the UI say so.
    usingMemory = true;
    return false;
  }
}

probe();

function readRaw(key) {
  if (usingMemory) return memory.has(key) ? memory.get(key) : null;
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    usingMemory = true;
    return memory.has(key) ? memory.get(key) : null;
  }
}

function writeRaw(key, value) {
  if (usingMemory) { memory.set(key, value); return; }
  try {
    window.localStorage.setItem(key, value);
  } catch (err) {
    // Quota exceeded mid-session, or storage revoked. Keep the value so the
    // session stays usable, and surface the downgrade.
    usingMemory = true;
    memory.set(key, value);
  }
}

function read(key, fallback) {
  const raw = readRaw(key);
  if (raw === null || raw === undefined) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed === null ? fallback : parsed;
  } catch (err) {
    // Corrupt value: replace it rather than letting every later read throw.
    writeRaw(key, JSON.stringify(fallback));
    return fallback;
  }
}

function write(key, value) {
  writeRaw(key, JSON.stringify(value));
}

/* ---------------------------------------------------------------- schema */

/**
 * Bring stored data forward to SCHEMA_VERSION.
 *
 * v1 is the only version today, but the path exists now so that adding
 * questions or fields later never means discarding history. Each step is
 * `from -> from + 1` and must be safe to run twice.
 */
export function migrate(fromVersion) {
  let v = Number.isInteger(fromVersion) ? fromVersion : 0;

  if (v === 0) {
    // Fresh install, or storage predating versioning. Seed defaults without
    // clobbering anything that already happens to be there.
    if (readRaw(KEYS.attempts) === null) write(KEYS.attempts, {});
    if (readRaw(KEYS.flagged) === null) write(KEYS.flagged, []);
    if (readRaw(KEYS.quizzes) === null) write(KEYS.quizzes, []);
    if (readRaw(KEYS.activeQuiz) === null) write(KEYS.activeQuiz, null);
    if (readRaw(KEYS.settings) === null) write(KEYS.settings, DEFAULT_SETTINGS);
    v = 1;
  }

  // Future steps go here:
  // if (v === 1) { ...; v = 2; }

  write(KEYS.version, v);
  return v;
}

export function init() {
  return migrate(read(KEYS.version, 0));
}

/* -------------------------------------------------------------- settings */

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) };
}

export function setSettings(patch) {
  const next = { ...getSettings(), ...patch };
  write(KEYS.settings, next);
  return next;
}

/* -------------------------------------------------------------- attempts */

export function getAttempts() {
  return read(KEYS.attempts, {});
}

/** Append one answer. Progress is keyed by question id, never by index. */
export function recordAttempt(questionId, { correct, selected, quizId, ts }) {
  const all = getAttempts();
  const entry = all[questionId] || { attempts: [] };
  entry.attempts.push({
    ts: ts || Date.now(),
    correct: !!correct,
    selected: [...selected].sort(),
    quizId: quizId || null,
  });
  all[questionId] = entry;
  write(KEYS.attempts, all);
  return entry;
}

export function attemptsFor(questionId) {
  return (getAttempts()[questionId] || { attempts: [] }).attempts;
}

/** Ids whose most recent attempt was wrong, or that were ever wrong. */
export function missedIds({ stillMissedOnly = false } = {}) {
  const all = getAttempts();
  const out = [];
  for (const [id, entry] of Object.entries(all)) {
    const list = entry.attempts || [];
    if (!list.length) continue;
    const everWrong = list.some((a) => !a.correct);
    if (!everWrong) continue;
    if (stillMissedOnly && list[list.length - 1].correct) continue;
    out.push(id);
  }
  return out;
}

/** How many times this question has been answered correctly. */
export function correctCount(questionId) {
  return attemptsFor(questionId).filter((a) => a.correct).length;
}

export function seenIds() {
  return Object.keys(getAttempts()).filter(
    (id) => (getAttempts()[id].attempts || []).length > 0,
  );
}

/* --------------------------------------------------------------- flagged */

export function getFlagged() {
  return read(KEYS.flagged, []);
}

export function isFlagged(id) {
  return getFlagged().includes(id);
}

export function toggleFlag(id) {
  const list = getFlagged();
  const i = list.indexOf(id);
  if (i === -1) list.push(id); else list.splice(i, 1);
  write(KEYS.flagged, list);
  return i === -1;
}

export function setFlag(id, on) {
  const list = getFlagged();
  const has = list.includes(id);
  if (on && !has) list.push(id);
  if (!on && has) list.splice(list.indexOf(id), 1);
  write(KEYS.flagged, list);
  return on;
}

/* --------------------------------------------------------------- quizzes */

export function getQuizzes() {
  return read(KEYS.quizzes, []);
}

export function saveQuizResult(result) {
  const list = getQuizzes();
  list.push(result);
  write(KEYS.quizzes, list);
  return result;
}

/* ----------------------------------------------------------- active quiz */

export function getActiveQuiz() {
  return read(KEYS.activeQuiz, null);
}

export function setActiveQuiz(session) {
  write(KEYS.activeQuiz, session);
}

export function clearActiveQuiz() {
  write(KEYS.activeQuiz, null);
}

/* ------------------------------------------------------- export / import */

export function exportProgress() {
  return {
    app: APP_ID,
    schema: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    attempts: getAttempts(),
    flagged: getFlagged(),
    quizzes: getQuizzes(),
    settings: getSettings(),
  };
}

/**
 * Replace stored progress with an exported payload.
 * Throws with a readable message rather than failing silently.
 */
export function importProgress(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('That file is not a progress export.');
  }
  // Import replaces everything, and every bank numbers its questions from
  // q0001, so another app's export would quietly rewrite this app's history.
  if (payload.app !== APP_ID) {
    throw new Error(payload.app
      ? `That export is from a different app (${payload.app}), not this one (${APP_ID}).`
      : 'That export does not say which app it came from, so it is not from this one.');
  }
  if (!Number.isInteger(payload.schema)) {
    throw new Error('That export is missing its schema version.');
  }
  if (payload.schema > SCHEMA_VERSION) {
    throw new Error(
      `That export is from a newer version (schema ${payload.schema}); this app reads up to ${SCHEMA_VERSION}.`,
    );
  }
  write(KEYS.attempts, payload.attempts || {});
  write(KEYS.flagged, payload.flagged || []);
  write(KEYS.quizzes, payload.quizzes || []);
  write(KEYS.settings, { ...DEFAULT_SETTINGS, ...(payload.settings || {}) });
  migrate(payload.schema);
  return true;
}

export function resetProgress() {
  write(KEYS.attempts, {});
  write(KEYS.flagged, []);
  write(KEYS.quizzes, []);
  write(KEYS.activeQuiz, null);
}

export const __testing = { KEYS, read, write };
