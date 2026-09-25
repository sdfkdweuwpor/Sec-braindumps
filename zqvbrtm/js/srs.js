/**
 * Smart review: spaced repetition worked out from the answer history alone.
 *
 * A miss puts a question on a ladder of checks 1, 3 and 7 days out. Getting
 * it right at a check moves it up a step; right at the 7-day check and it is
 * mastered and leaves the ladder. A miss at any point, in any quiz, drops it
 * back to the 1-day check. A correct answer before a check is due changes
 * nothing, so answering one question over and over cannot rush it through.
 *
 * Days are calendar days in the viewer's time zone: a question missed at
 * 11pm is due the next morning, not at 11pm the next night.
 *
 * Nothing extra is stored. The schedule is rebuilt from the attempt log, so
 * it travels with an exported progress file and covers history recorded
 * before this feature existed. No DOM and no storage access, so it tests
 * under plain Node.
 */

/** Days from an answer to the next check, one entry per rung. */
export const STEPS = [1, 3, 7];

/** Most questions one review session takes, most overdue first. */
export const SESSION_SIZE = 20;

export function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Midnight `n` calendar days after `ts`. setDate keeps this right across DST. */
export function addDays(ts, n) {
  const d = new Date(startOfDay(ts));
  d.setDate(d.getDate() + n);
  return d.getTime();
}

function byTime(attempts) {
  return [...(attempts || [])].sort((a, b) => a.ts - b.ts);
}

/**
 * Where one question stands, from its attempts.
 * `state` is null when the question is not on the ladder; otherwise
 * `{ step, due }` with `step` indexing STEPS. `mastered` is true when the
 * question climbed off the top and has not been missed since.
 */
export function reviewState(attempts) {
  let state = null;
  let mastered = false;
  for (const a of byTime(attempts)) {
    if (!a.correct) {
      state = { step: 0, due: addDays(a.ts, STEPS[0]) };
      mastered = false;
    } else if (state && a.ts >= state.due) {
      const next = state.step + 1;
      if (next >= STEPS.length) {
        state = null;
        mastered = true;
      } else {
        state = { step: next, due: addDays(a.ts, STEPS[next]) };
      }
    }
  }
  return { state, mastered };
}

/**
 * The whole ladder at a glance.
 * `attemptsById` is store.getAttempts(): { [id]: { attempts: [...] } }.
 * `isKnown(id)` drops history for questions no longer in the bank.
 */
export function reviewSummary(attemptsById, { now = Date.now(), isKnown = () => true } = {}) {
  const due = [];
  const upcoming = [];
  const counts = STEPS.map(() => 0);
  let mastered = 0;

  for (const [id, entry] of Object.entries(attemptsById || {})) {
    if (!isKnown(id)) continue;
    const { state, mastered: m } = reviewState(entry && entry.attempts);
    if (m) mastered += 1;
    if (!state) continue;
    counts[state.step] += 1;
    (state.due <= now ? due : upcoming).push({ id, ...state });
  }

  // Most overdue first; among equals, the lower rung (the shakier question).
  due.sort((a, b) => a.due - b.due || a.step - b.step || a.id.localeCompare(b.id));
  upcoming.sort((a, b) => a.due - b.due || a.id.localeCompare(b.id));

  const nextDue = upcoming.length ? upcoming[0].due : null;
  const nextDueCount = nextDue === null ? 0
    : upcoming.filter((u) => u.due === nextDue).length;

  return {
    due,
    upcoming,
    counts,
    mastered,
    inReview: due.length + upcoming.length,
    nextDue,
    nextDueCount,
  };
}

/** Calendar days from `now` until `ts` (0 = today, 1 = tomorrow). */
export function daysUntil(ts, now = Date.now()) {
  return Math.round((startOfDay(ts) - startOfDay(now)) / 86400000);
}

/**
 * How one quiz moved questions on the ladder, for its results screen.
 * Compares each question's state without this quiz's answers against its
 * state with them.
 */
export function reviewChanges(attemptsById, questionIds, quizId) {
  const out = { added: 0, up: 0, mastered: 0, reset: 0 };
  for (const id of questionIds) {
    const all = (attemptsById[id] && attemptsById[id].attempts) || [];
    const mine = all.filter((a) => a.quizId === quizId);
    if (!mine.length) continue;
    const before = reviewState(all.filter((a) => a.quizId !== quizId));
    const after = reviewState(all);
    if (mine.some((a) => !a.correct)) {
      if (before.state) out.reset += 1; else out.added += 1;
    } else if (before.state && !after.state && after.mastered) {
      out.mastered += 1;
    } else if (before.state && after.state && after.state.step > before.state.step) {
      out.up += 1;
    }
  }
  return out;
}
