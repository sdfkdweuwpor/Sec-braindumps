import test from 'node:test';
import assert from 'node:assert/strict';
import { lookup, findAcronyms } from '../js/acronyms.js';
import { flameHue, flameTier } from '../js/flame.js';

test('acronym lookup handles plurals, versions and pairs', () => {
  assert.deepEqual(lookup('VPNs'), ['VPN']);
  assert.deepEqual(lookup('AES-256'), ['AES']);
  assert.deepEqual(lookup('SNMPv3'), ['SNMP']);
  assert.deepEqual(lookup('IDS/IPS'), ['IDS', 'IPS']);
  assert.deepEqual(lookup('SD-WAN'), ['SD-WAN']);
  assert.deepEqual(lookup('Pass'), []);
  assert.deepEqual(lookup('802.1X'), []);
});

test('findAcronyms lists each acronym once, in order of appearance', () => {
  const got = findAcronyms(['The CISO wants MFA and a VPN.', 'VPN', 'FDE']).map((a) => a.acr);
  assert.deepEqual(got, ['CISO', 'MFA', 'VPN', 'FDE']);
});

test('the streak flame follows the agreed stages', () => {
  assert.equal(flameTier(3), 'spark');
  assert.equal(flameTier(5), 'glow');
  assert.equal(flameTier(10), 'fire');
  assert.equal(flameTier(15), 'red');
  assert.equal(flameTier(20), 'shift');
  assert.equal(flameTier(25), 'blue');
  assert.equal(flameHue(15), 358);
  assert.equal(flameHue(25), 215);
  // 16-24 moves steadily from red toward blue
  for (let n = 16; n < 25; n += 1) assert.ok(flameHue(n) < flameHue(n - 1) || n === 16);
  assert.ok(flameHue(24) > 215 && flameHue(16) < 358);
});
