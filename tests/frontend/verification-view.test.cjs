const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const passed = {
  id: 'demo-report', status: 'APPROVED', confidence: 0.75, human_review_required: false,
  trace: ['R-01', 'R-02', 'R-03'].map((step) => ({ step, outcome: 'passed' })),
};
function render(t, overrides = {}, options = {}) {
  const dom = new JSDOM('<article id="report"></article>', { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  dom.window.eval(fs.readFileSync(path.join(__dirname, '../../frontend/verification-view.js'), 'utf8'));
  const report = dom.window.document.querySelector('#report');
  dom.window.TrustCartVerification.render(report, { ...passed, ...overrides }, options);
  return report;
}
test('verification confirms only fully recorded passes at the confidence threshold', (t) => {
  const report = render(t);
  assert.equal(report.querySelectorAll('.review-step[data-state="passed"]').length, 4);
});
for (const [name, overrides] of [
  ['low confidence', { confidence: 0.749 }],
  ['human review', { human_review_required: true }],
  ['missing review flag', { human_review_required: undefined }],
  ['pending', { status: 'PENDING' }],
  ['denied', { status: 'DENIED' }],
  ['unknown', { status: 'UNKNOWN' }],
  ['missing trace', { trace: undefined }],
  ['missing rule', { trace: passed.trace.slice(0, 2) }],
  ['conflicting rule', { trace: [...passed.trace, { step: 'R-01', outcome: 'failed' }] }],
]) {
  test(`verification blocks final confirmation for ${name}`, (t) => {
    const report = render(t, overrides);
    assert.equal(report.querySelector('.review-step:last-child').dataset.state, 'blocked');
  });
}
test('verification renders untrusted evidence and hashes as plain text', (t) => {
  const injected = '<img src=x onerror=alert(1)>';
  const report = render(t, {
    listing_title: injected, reason: injected, registry_source: injected, chain_hash: injected,
    claim_findings: [{ rule_id: 'R-03', code: injected, phrase: injected, reason_th: injected, source: 'description' }],
    trace: [{ step: 'R-03', outcome: injected, chain_hash: injected }],
  });
  assert.equal(report.querySelector('img'), null);
  assert.equal(report.querySelector('blockquote').textContent, injected);
  assert.equal(report.querySelector('.reviewer-trace details code:last-child').textContent, injected);
});
test('seller rendering hides audit hashes while keeping rule findings', (t) => {
  const report = render(t, { chain_hash: 'private-hash', claim_findings: [
    { rule_id: 'R-03', code: 'instant_effect', phrase: 'literal evidence', source: 'title', reason_th: 'reason' },
  ] }, { audit: false });
  assert.equal(report.querySelector('.reviewer-trace'), null);
  assert.equal(report.querySelector('code'), null);
  assert.equal(report.textContent.includes('private-hash'), false);
  assert.equal(report.querySelector('blockquote').textContent, 'literal evidence');
});
test('unknown status and absent confidence are displayed conservatively', (t) => {
  const report = render(t, { status: 'unexpected', confidence: undefined, trace: [] });
  assert.match(report.textContent, /UNKNOWN/);
  assert.equal(report.querySelectorAll('[data-state="not_checked"]').length, 3);
  assert.equal(report.querySelector('.review-step:last-child').dataset.state, 'blocked');
});
