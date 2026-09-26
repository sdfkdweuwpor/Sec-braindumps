import test from 'node:test';
import assert from 'node:assert/strict';
import { HAPTIC_PATTERNS, HAPTIC_FOR_SOUND, supported, buzz } from '../js/haptics.js';
import { SOUNDS } from '../js/sound.js';

test('every buzz is tied to a real sound effect and a real pattern', () => {
  for (const [sound, pattern] of Object.entries(HAPTIC_FOR_SOUND)) {
    assert.ok(SOUNDS.includes(sound), `${sound} is not a sound effect`);
    assert.ok(HAPTIC_PATTERNS.includes(pattern), `${pattern} is not a pattern`);
  }
});

test('the answer moments and the fire all buzz; moving around does not', () => {
  for (const s of ['correct', 'wrong', 'blaze', 'inferno', 'blueInferno', 'mythic', 'fizzle', 'levelUp']) {
    assert.ok(HAPTIC_FOR_SOUND[s], `${s} should buzz`);
  }
  for (const s of ['swoosh', 'tab', 'open', 'close', 'start']) {
    assert.equal(HAPTIC_FOR_SOUND[s], undefined, `${s} should not buzz`);
  }
});

test('without a browser there is nothing to buzz, and buzz is harmless', () => {
  assert.equal(supported(), false);
  assert.doesNotThrow(() => buzz('correct'));
  assert.doesNotThrow(() => buzz('no-such-pattern'));
});
