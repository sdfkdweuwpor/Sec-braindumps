import test from 'node:test';
import assert from 'node:assert/strict';
import { lookup, findAcronyms } from '../js/acronyms.js';

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
