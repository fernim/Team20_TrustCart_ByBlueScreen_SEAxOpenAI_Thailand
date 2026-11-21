const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
const { JSDOM } = require("jsdom");
const docs = ["label", "certificate", "permit"].map((kind) => ({
  id: kind,
  kind,
  filename: kind + ".pdf",
}));
const submission = {
  id: "submission",
  chain_hash: "a".repeat(64),
  status: "PENDING",
  stage: "WAITING_DOCUMENTS",
  listing_title: "Saved",
  revision: 1,
  documents: docs,
  required_documents: docs.map((d) => d.kind),
  rule_results: [],
};
async function seller(t) {
  const dom = new JSDOM(fs.readFileSync("frontend/seller.html", "utf8"), {
    url: "http://localhost/seller",
    runScripts: "outside-only",
  });
  t.after(() => dom.window.close());
  let record = {
    id: "product",
    version: 1,
    listing: { title: "Saved", price: "199", stock: 1, images: [] },
    verification: submission,
    workflow: { stage: submission.stage },
  };
  const calls = [];
  dom.window.TrustCartSession = {
    ready: Promise.resolve({ role: "seller", id: "seller1", shop_id: "shop1" }),
    api: async (url) => ({
      json: async () =>
        url.endsWith("/demo-cases")
          ? {}
          : url.endsWith("/subscription")
            ? { active: true, active_until: "2026-12-01" }
            : url === "/v1/seller/products"
              ? [record]
              : record,
    }),
    json: async (url, body) => {
      calls.push({ url, body });
      const checked = {
        ...submission,
        status: "PENDING",
        stage: "REVIEWER_REQUIRED",
        document_check: { state: "completed", result: "pass" },
        claim_check: { state: "completed", result: "pass", claims: [] },
      };
      record = { ...record, verification: checked };
      return checked;
    },
  };
  for (const file of [
    "checklist-view.js",
    "workflow.js",
    "seller-connected.js",
  ])
    await dom.window.eval(fs.readFileSync("frontend/" + file, "utf8"));
  const $ = (s) => dom.window.document.querySelector(s);
  await $(".seller-product-row").onclick();
  return { dom, $, calls };
}
test("Submit for review automatically calls the live review endpoint and shows its checklist", async (t) => {
  const p = await seller(t);
  assert.equal(p.$("#run-check").disabled, false);
  await p.$("#run-check").onclick();
  assert.equal(p.calls.length, 1);
  assert.equal(
    p.calls[0].url,
    "/v1/seller/submissions/submission/submit-review",
  );
  assert.deepEqual(Object.keys(p.calls[0].body), ["chain_hash"]);
  assert.equal(p.calls[0].body.chain_hash, submission.chain_hash);
  assert.match(p.$("#seller-result").textContent, /PENDING/);
  assert.equal(
    p.$("#seller-result .automated-checklist").querySelectorAll("li").length,
    2,
  );
  assert.equal(p.$("#run-check").disabled, true);
});
test("dirty listing copy cannot be submitted for review against an old saved snapshot", async (t) => {
  const p = await seller(t);
  p.$("#listing-title").value = "Unsaved";
  p.$("#listing-title").dispatchEvent(
    new p.dom.window.Event("input", { bubbles: true }),
  );
  await p.$("#run-check").onclick();
  assert.equal(p.calls.length, 0);
  assert.match(p.$("#seller-feedback").textContent, /Save edited listing/);
});
