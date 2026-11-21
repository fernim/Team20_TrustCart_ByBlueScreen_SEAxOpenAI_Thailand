const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
test("connected seller offers optional verification and private document workflow", () => {
  const doc = new JSDOM(fs.readFileSync("frontend/seller.html", "utf8")).window
    .document;
  for (const id of [
    "verify-on-save",
    "document-form",
    "activate-plan",
    "run-replay-check",
    "submission-history",
  ])
    assert.ok(doc.getElementById(id), id);
  assert.ok(doc.querySelector('script[src="/static/seller-connected.js"]'));
});
test("workflow renders untrusted findings as text and hides audit from sellers", () => {
  const dom = new JSDOM("<main></main>", { runScripts: "outside-only" });
  dom.window.eval(fs.readFileSync("frontend/workflow.js", "utf8"));
  const result = {
    listing_title: "<img src=x onerror=alert(1)>",
    status: "PENDING",
    stage: "WAITING_DOCUMENTS",
    revision: 1,
    documents: [],
    rule_results: [],
    trace: [{ secret: "audit" }],
  };
  const target = dom.window.document.querySelector("main");
  dom.window.TrustCartFlow.render(target, result);
  assert.equal(target.querySelector("img"), null);
  assert.equal(target.querySelector("pre"), null);
  assert.match(target.textContent, /Upload:/);
  dom.window.TrustCartFlow.render(target, result, { reviewer: true });
  assert.match(target.querySelector("pre").textContent, /audit/);
});
test("document workflow distinguishes the current blocked stage from rule checks", () => {
  const dom = new JSDOM("<main></main>", { runScripts: "outside-only" });
  dom.window.eval(fs.readFileSync("frontend/workflow.js", "utf8"));
  const result = {
    listing_title: "Example",
    status: "PENDING",
    stage: "REVIEWER_REQUIRED",
    revision: 1,
    documents: [],
    rule_results: [],
    trace: [],
  };
  const target = dom.window.document.querySelector("main");
  dom.window.TrustCartFlow.render(target, result);
  assert.equal(target.querySelectorAll(".submission-progress li").length, 5);
  assert.match(
    target.querySelector(".submission-progress [aria-current=step]")
      .textContent,
    /Reviewer/,
  );
});

test('seller plan offer is a header menu, hidden until subscription status is known',()=>{
 const doc=new JSDOM(fs.readFileSync('frontend/seller.html','utf8')).window.document;
 const menu=doc.querySelector('header #verification-plan');
 assert.ok(menu);assert.equal(menu.tagName,'DETAILS');assert.equal(menu.hidden,true);
 assert.match(menu.querySelector('summary').textContent,/299/);
 assert.equal(doc.querySelector('main #verification-plan'),null);
});
