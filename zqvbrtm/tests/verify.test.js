import test from 'node:test';
import assert from 'node:assert/strict';
import { googleUrl, claudePrompt, claudeUrl, topicTerms, messerUrl } from '../js/verify.js';
import { QUESTIONS_BY_ID, ALL_QUESTIONS } from '../js/quizEngine.js';

const q = {
  id: 'q9999',
  question: 'A company wants to stop users installing apps from outside the official store.\n```text\nlog line one\n```\nWhich of the following describes this risk?',
  choices: [
    { key: 'A', text: 'Jailbreaking' }, { key: 'B', text: 'Side loading' },
    { key: 'C', text: 'Rooting' }, { key: 'D', text: 'Using an unapproved app store' },
  ],
  correct: ['B'],
  objectiveTitle: 'Explain mobile vulnerabilities',
};

test('Google gets the question, without exhibits, capped at 32 words', () => {
  const u = new URL(googleUrl(q));
  assert.equal(u.hostname, 'www.google.com');
  const text = u.searchParams.get('q');
  assert.ok(text.startsWith('A company wants to stop users installing apps'));
  assert.ok(!text.includes('log line one') && !text.includes('```'));
  const long = { ...q, question: Array.from({ length: 80 }, (_, i) => `w${i}`).join(' ') };
  assert.equal(new URL(googleUrl(long)).searchParams.get('q').split(' ').length, 32);
});

test('the Claude prompt uses the letters as shown and names the marked answer', () => {
  const shown = ['D', 'B', 'A', 'C'];          // B was shown second
  const p = claudePrompt(q, shown);
  assert.match(p, /\nA\. Using an unapproved app store\nB\. Side loading\nC\. Jailbreaking\nD\. Rooting\n/);
  assert.match(p, /Marked answer: B\. Side loading$/);
  assert.ok(p.includes('log line one'), 'exhibit text is kept for Claude');
  assert.ok(!p.includes('```'));
  const u = new URL(claudeUrl(p));
  assert.equal(u.hostname, 'claude.ai');
  assert.equal(u.searchParams.get('q'), p);
});

test('multi-answer questions list every marked answer', () => {
  const m = { ...q, correct: ['A', 'C'] };
  assert.match(claudePrompt(m), /Marked answers: A\. Jailbreaking; C\. Rooting$/);
});

test('topic terms drop filler words and fall back to the objective', () => {
  assert.equal(topicTerms(q), 'Side loading');
  assert.equal(topicTerms({ ...q, correct: ['D'] }), 'unapproved app store');
  const none = { ...q, choices: [{ key: 'A', text: 'All of the above' }], correct: ['A'] };
  assert.equal(topicTerms(none), 'Explain mobile vulnerabilities');
  assert.equal(new URL(messerUrl(q)).searchParams.get('s'), 'Side loading');
});

test('every question in the bank builds working Verify links', () => {
  for (const item of ALL_QUESTIONS) {
    assert.ok(new URL(googleUrl(item)).searchParams.get('q').length > 10, item.id);
    const p = claudePrompt(item);
    assert.ok(p.length <= 6000 && /Marked answers?: \S/.test(p), item.id);
    assert.ok(topicTerms(item).length > 1, item.id);
  }
  assert.ok(QUESTIONS_BY_ID.size > 1000);
});
