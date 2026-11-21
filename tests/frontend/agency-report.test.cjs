const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
const { JSDOM } = require("jsdom");
const result = {
  id: "case-1",
  product_id: "product-1",
  revision: 1,
  listing_title: "Test <script>",
  listing: {
    title: "Listing",
    registration_reference: "DEMO-001",
    product_name: "Sample",
    license_holder: "Demo",
    description: "Plain copy",
  },
  shop_name: "Demo",
  marketplace: "shopee",
  stage: "REVIEWER_REQUIRED",
  status: "PENDING",
  is_current: true,
  audit: { valid: true },
  confidence: 0.6,
  documents: [{ id: "doc-1", filename: "<label>.pdf", kind: "label" }],
  required_documents: ["label", "certificate"],
  rule_results: [],
  assessment: null,
  trace: [],
  chain_hash: "a".repeat(64),
  created_at: "2026-11-21T00:00:00Z",
};
async function mount(t, options = {}) {
  const dom = new JSDOM(
    fs.readFileSync("frontend/agency-report.html", "utf8"),
    {
      url: "http://localhost/agency/submissions/case-1?marketplace=shopee&work_queue=to_review",
      runScripts: "outside-only",
    },
  );
  t.after(() => dom.window.close());
  let current = { ...result, ...options.result };
  const requests = [];
  dom.window.TrustCartSession = {
    ready: Promise.resolve({ role: "reviewer", id: "reviewer" }),
    api: async (url) => ({
      json: async () => (url.endsWith("/history") ? [] : current),
    }),
    json: async (url, payload) => {
      requests.push({ url, payload });
      if (options.fail) throw Object.assign(Error("conflict"), { status: 409 });
      current = { ...current, stage: "IN_REVIEW", chain_hash: "b".repeat(64) };
      return current;
    },
  };
  for (const file of ["agency-common.js", "agency-report.js"])
    dom.window.eval(fs.readFileSync("frontend/" + file, "utf8"));
  await dom.window.TrustCartAgencyReport.ready;
  return { dom, $: (s) => dom.window.document.querySelector(s), requests };
}
test("Agency report starts staff review, preserves filters and edits across language changes", async (t) => {
  const p = await mount(t);
  assert.equal(p.$("#case-title").textContent, "Test <script>");
  assert.equal(p.$("#case-title script"), null);
  assert.match(p.$("#back-to-queue").href, /marketplace=shopee/);
  assert.equal(p.$("#start-review").hidden, false);
  assert.equal(p.$("#decision-form").hidden, true);
  await p.dom.window.TrustCartAgencyReport.start();
  assert.equal(p.requests[0].payload.chain_hash, result.chain_hash);
  assert.equal(p.$("#decision-form").hidden, false);
  p.$("#review-note").value = "Keep this note";
  p.$("#confirm-documents input").checked = true;
  p.$("#agency-language").value = "en";
  p.$("#agency-language").dispatchEvent(new p.dom.window.Event("change"));
  assert.equal(p.$("#review-note").value, "Keep this note");
  assert.equal(p.$("#confirm-documents input").checked, true);
  assert.equal(p.$("#case-content script"), null);
});
test("Agency report stale action blocks further writes until explicit reload", async (t) => {
  const p = await mount(t, { fail: true });
  await p.dom.window.TrustCartAgencyReport.start();
  assert.equal(p.$("#start-review").disabled, true);
  assert.equal(p.$("#report-error").hidden, false);
});
test("Historical or invalid audit reports have no enabled decision actions", async (t) => {
  for (const value of [{ is_current: false }, { audit: { valid: false } }]) {
    const p = await mount(t, { result: { stage: "IN_REVIEW", ...value } });
    assert.equal(p.$("#decision-form").hidden, true);
    assert.equal(p.$("#start-review").hidden, true);
  }
});
