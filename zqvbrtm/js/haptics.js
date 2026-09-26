/**
 * Haptics: a short buzz under the thumb for the moments that also make a
 * sound (right, wrong, the streak fire, a level up). Separate from sound, so
 * someone studying with the sound off still feels the answer land.
 *
 * Android browsers have the Vibration API. iPhones do not, but Safari on
 * iOS 18 and later gives a haptic tick when a switch control is toggled,
 * so an invisible one is toggled instead (the same trick the ios-haptics
 * package uses). That tick is fixed, so a pattern becomes that many ticks.
 * Anywhere else this does nothing.
 *
 * On by default on touch screens; the button in the top bar turns it off.
 * The mock exam only ever triggers the neutral tap, like its sounds.
 */

import * as store from './store.js';

// Milliseconds on, off, on... for the Vibration API.
const PATTERNS = {
  tap: [8],
  correct: [16],
  wrong: [24, 70, 24],
  streak: [12, 45, 12, 45, 12],
  glow: [14, 40, 20],
  fire: [18, 40, 22, 40, 70],
  fizzle: [40],
  mastered: [14, 45, 14, 45, 34],
  milestone: [20, 60, 20],
  levelUp: [22, 50, 22, 50, 22, 50, 90],
};

// iPhone ticks are all the same length; this far apart they feel separate.
const IOS_GAP = 120;

// Which pattern each sound effect gets. Sounds not listed stay silent here.
const FOR_SOUND = {
  select: 'tap',
  flag: 'tap',
  tick: 'tap',
  correct: 'correct',
  wrong: 'wrong',
  streak: 'streak',
  glowUp: 'glow',
  flare: 'glow',
  goldFlare: 'glow',
  blaze: 'fire',
  inferno: 'fire',
  blueInferno: 'fire',
  mythic: 'fire',
  fizzle: 'fizzle',
  mastered: 'mastered',
  milestone: 'milestone',
  levelUp: 'levelUp',
};

export const HAPTIC_PATTERNS = Object.keys(PATTERNS);
export const HAPTIC_FOR_SOUND = FOR_SOUND;

function touchScreen() {
  try { return window.matchMedia('(pointer: coarse)').matches; } catch { return false; }
}

/** Whether this device can buzz at all (worth showing the toggle). */
export function supported() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return touchScreen() && (typeof navigator.vibrate === 'function' || /iP(hone|ad|od)/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
}

export function enabled() {
  return store.getSettings().haptics !== false;
}

let switchLabel = null;

// One iOS haptic tick: toggle a hidden switch through its label.
function iosTick() {
  try {
    if (!switchLabel) {
      switchLabel = document.createElement('label');
      switchLabel.setAttribute('aria-hidden', 'true');
      switchLabel.style.display = 'none';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      switchLabel.append(input);
      document.body.append(switchLabel);
    }
    switchLabel.click();
  } catch { /* nothing to do: no haptics here */ }
}

// Browsers refuse to vibrate until the page has had a tap (and complain in
// the console), e.g. the Study card's hops right after a reload.
function activated() {
  try { return !navigator.userActivation || navigator.userActivation.hasBeenActive; } catch { return true; }
}

/** Buzz a named pattern. Silent when turned off or unsupported. */
export function buzz(name) {
  const pattern = PATTERNS[name];
  if (!pattern || !enabled() || !supported() || !activated()) return;
  try {
    if (typeof navigator.vibrate === 'function') { navigator.vibrate(pattern); return; }
  } catch { return; }
  // iOS: one tick per "on" segment, far enough apart to feel separately.
  const ticks = Math.ceil(pattern.length / 2);
  iosTick();
  for (let k = 1; k < ticks; k += 1) setTimeout(iosTick, k * IOS_GAP);
}

/** The buzz that goes with a sound effect, if it has one. */
export function forSound(name) {
  const p = FOR_SOUND[name];
  if (p) buzz(p);
}
