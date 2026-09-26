import test from 'node:test';
import assert from 'node:assert/strict';
import { flameHue, flameTier, streakMoment } from '../js/flame.js';
import { SOUNDS } from '../js/sound.js';

test('the streak flame follows the agreed stages', () => {
  const tiers = [[3, 'spark'], [5, 'glow'], [10, 'fire'], [15, 'red'], [20, 'shift'], [25, 'blue'],
    [26, 'aurora'], [39, 'aurora'], [40, 'gold'], [49, 'gold'], [50, 'rainbow'], [120, 'rainbow']];
  for (const [n, tier] of tiers) assert.equal(flameTier(n), tier, `streak ${n}`);
  assert.equal(flameHue(15), 358);
  assert.equal(flameHue(25), 215);
  assert.equal(flameHue(40), 45);
});

test('16-24 moves from red toward blue, 26-39 from blue toward gold', () => {
  for (let n = 17; n <= 25; n += 1) assert.ok(flameHue(n) < flameHue(n - 1), `streak ${n}`);
  for (let n = 26; n <= 40; n += 1) assert.ok(flameHue(n) < flameHue(n - 1), `streak ${n}`);
  assert.ok(flameHue(24) > 215 && flameHue(16) < 358);
  assert.ok(flameHue(39) > 45 && flameHue(26) < 215);
});

test('full-screen fire at 3, 10, 25, 50 and every 25 after that', () => {
  const big = [];
  for (let n = 1; n <= 200; n += 1) if (streakMoment(n)?.big) big.push(n);
  assert.deepEqual(big, [3, 10, 25, 50, 75, 100, 125, 150, 175, 200]);
  assert.ok(streakMoment(50).rainbow && streakMoment(75).rainbow);
  assert.ok(!streakMoment(25).rainbow);
});

test('small moments at 5, 15 and 40 are chimes, not fire', () => {
  for (const n of [5, 15, 40]) {
    const m = streakMoment(n);
    assert.ok(m && !m.big, `streak ${n}`);
  }
  assert.equal(streakMoment(4), null);
  assert.equal(streakMoment(11), null);
});

test('every streak moment names a sound that exists', () => {
  for (let n = 1; n <= 200; n += 1) {
    const m = streakMoment(n);
    if (m) assert.ok(SOUNDS.includes(m.sound), `streak ${n}: ${m.sound}`);
  }
  for (const name of ['fizzle', 'swoosh', 'open', 'close', 'tick', 'tab', 'start', 'streak', 'wrong', 'correct']) {
    assert.ok(SOUNDS.includes(name), name);
  }
});
