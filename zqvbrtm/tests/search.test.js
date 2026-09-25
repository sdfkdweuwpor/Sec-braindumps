import test from 'node:test';
import assert from 'node:assert/strict';
import { searchQuestions, queryTerms, termPattern, highlightPattern } from '../js/search.js';

const bank = [
  { id: 'q0001', question: 'Which protocol provides SSO with an identity provider?',
    choices: [{ key: 'A', text: 'SAML' }, { key: 'B', text: 'SNMP' }],
    explanation: 'SAML carries assertions from the IdP.', objective: '4.6', objectiveTitle: 'Identity and access management' },
  { id: 'q0002', question: 'A company ships laptops overseas. What protects the data?',
    choices: [{ key: 'A', text: 'Full disk encryption' }, { key: 'B', text: 'A tabletop exercise' }],
    explanation: 'Encryption protects data at rest.', objective: '3.3', objectiveTitle: 'Protecting data' },
  { id: 'q0062', question: 'Which IP address range is private?',
    choices: [{ key: 'A', text: '10.0.0.0/8' }, { key: 'B', text: '8.8.8.8' }],
    explanation: 'RFC 1918 reserves 10.0.0.0/8.', objective: '3.1', objectiveTitle: 'Architecture' },
];
const ids = (rows) => rows.map((r) => r.question.id);

test('an empty query finds nothing', () => {
  assert.deepEqual(searchQuestions('', bank), []);
  assert.deepEqual(searchQuestions('   ', bank), []);
});

test('matching is case-insensitive and covers answers and explanations', () => {
  const rows = searchQuestions('saml', bank);
  assert.deepEqual(ids(rows), ['q0001']);
  assert.equal(rows[0].where, 'answers');
  assert.deepEqual(ids(searchQuestions('rest', bank)), ['q0002']);
});

test('every word must match somewhere', () => {
  assert.deepEqual(ids(searchQuestions('encryption laptops', bank)), ['q0002']);
  assert.deepEqual(ids(searchQuestions('encryption saml', bank)), []);
});

test('short words match whole words only', () => {
  // "IP" is in q0062 and inside "ships" / "provider" elsewhere.
  assert.deepEqual(ids(searchQuestions('ip', bank)), ['q0062']);
  assert.ok(termPattern('ip').test('an IP address'));
  assert.ok(!termPattern('ip').test('ships'));
  assert.ok(termPattern('encrypt').test('encryption'));
});

test('a number finds that question first', () => {
  for (const q of ['62', '#62', 'Q62', 'q0062', 'question 62']) {
    assert.equal(searchQuestions(q, bank)[0].question.id, 'q0062', q);
    assert.equal(searchQuestions(q, bank)[0].where, 'number');
  }
});

test('question-text matches rank above answer-only matches', () => {
  const rows = searchQuestions('data', bank);
  assert.equal(rows[0].question.id, 'q0002');
});

test('query words are cleaned and de-duplicated', () => {
  assert.deepEqual(queryTerms('  SAML, saml!  "zero" '), ['saml', 'zero']);
  assert.deepEqual(queryTerms('802.1X c++'), ['802.1x', 'c++']);
});

test('the highlight pattern marks every term', () => {
  const re = highlightPattern(['saml', 'ip']);
  assert.deepEqual('SAML over IP, not ships'.match(re), ['SAML', 'IP']);
  assert.equal(highlightPattern([]), null);
});
