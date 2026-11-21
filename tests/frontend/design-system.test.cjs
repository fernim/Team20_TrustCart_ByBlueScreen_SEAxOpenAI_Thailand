const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
for (const page of ['index', 'seller', 'reviewer']) {
  test(`${page} exposes consistent navigation and local shared design tokens`, () => {
    const document = new JSDOM(fs.readFileSync(`frontend/${page}.html`, 'utf8')).window.document;
    assert.ok(document.querySelector('link[href="/static/tokens.css"]'));
    assert.equal(document.querySelectorAll('.demo-views [aria-current="page"]').length, 1);
    assert.ok(document.querySelector('.skip-link'));
    for (const link of document.querySelectorAll('.demo-views a')) {
      assert.ok(['/', '/seller', '/reviewer', '/agency'].includes(link.getAttribute('href')));
    }
  });
}
