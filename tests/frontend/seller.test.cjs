const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
function seller(t, fetch) {
  const dom = new JSDOM(
    fs.readFileSync(path.join(__dirname, "../../frontend/seller.html"), "utf8"),
    { url: "http://localhost/seller", runScripts: "outside-only" },
  );
  dom.window.fetch = fetch;
  for (const file of ["verification-view.js", "seller.js"])
    dom.window.eval(
      fs.readFileSync(path.join(__dirname, "../../frontend", file), "utf8"),
    );
  t.after(() => dom.window.close());
  const $ = (s) => dom.window.document.querySelector(s);
  return {
    dom,
    $,
    async submit() {
      $("#seller-form").dispatchEvent(
        new dom.window.Event("submit", { cancelable: true }),
      );
      await new Promise((r) => setImmediate(r));
    },
  };
}
const result = {
  id: "7aba58f0-1e89-4ba6-89af-3b86b469c819",
  status: "DENIED",
  reason: "advertising_overclaim",
  confidence: 1,
  human_review_required: false,
  trace: [
    { step: "R-01", outcome: "matched" },
    { step: "R-02", outcome: "matched" },
    { step: "R-03", outcome: "failed" },
  ],
  claim_findings: [],
  chain_hash: "chain",
};
test("seller submits listing copy and sees backend status and blockers", async (t) => {
  const p = seller(t, async (url, options) => {
    assert.equal(url, "/v1/verifications");
    const body = JSON.parse(options.body);
    assert.equal(body.title, "ผิวกระจ่างใสทันที 100%");
    return { ok: true, json: async () => ({ ...result, listing: body }) };
  });
  p.$("#listing-title").value = "ผิวกระจ่างใสทันที 100%";
  await p.submit();
  assert.match(p.$("#seller-result").textContent, /DENIED/);
  assert.equal(p.$("#seller-result .reviewer-trace"), null);
  assert.equal(p.$("#seller-result code"), null);
  assert.ok(p.$('.review-step[data-state="blocked"]'));
  p.$("#listing-title").value = "Corrected copy";
  p.$("#listing-title").dispatchEvent(
    new p.dom.window.Event("input", { bubbles: true }),
  );
  assert.equal(p.$("#seller-result").textContent, "");
  assert.match(p.$("#seller-feedback").textContent, /ตรวจใหม่/);
});
test("seller network failure clears result and does not show approval", async (t) => {
  const p = seller(t, async () => {
    throw Error("offline");
  });
  await p.submit();
  assert.equal(p.$("#seller-result").textContent, "");
  assert.match(p.$("#seller-feedback").textContent, /ไม่สามารถ/);
});
test("seller can save a draft without sending a verification request", (t) => {
  const p = seller(t, () => assert.fail("draft must be local"));
  p.$("#save-draft").click();
  assert.ok(p.dom.window.localStorage.getItem("trustcart-seller-draft"));
});
