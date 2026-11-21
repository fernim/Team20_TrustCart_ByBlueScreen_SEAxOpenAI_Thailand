const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const row = {
  id: "case-1",
  product_id: "product-1",
  listing_title: "<img src=x onerror=alert(1)>",
  listing: { registration_reference: "DEMO-001", images: [] },
  shop_name: "Demo shop",
  marketplace: "shopee",
  stage: "REVIEWER_REQUIRED",
  status: "PENDING",
  reason: "review",
  updated_at: "2026-11-21T10:00:00Z",
};
async function mount(t, handler, url = "http://localhost/agency", setup = () => {}) {
  const dom = new JSDOM(fs.readFileSync("frontend/agency.html", "utf8"), {
    url,
    runScripts: "outside-only",
  });
  t.after(() => dom.window.close());
  dom.window.TrustCartSession = {
    ready: Promise.resolve({ role: "reviewer", id: "reviewer" }),
    api: handler,
  };
  setup(dom.window);
  for (const file of ["agency-common.js", "agency.js"])
    dom.window.eval(fs.readFileSync("frontend/" + file, "utf8"));
  await dom.window.TrustCartAgency.ready;
  return { dom, $: (s) => dom.window.document.querySelector(s) };
}
const response = (items) => ({
  json: async () => ({
    items,
    counts: {
      all: items.length,
      to_review: items.length,
      in_progress: 0,
      waiting_documents: 0,
      seller_correction: 0,
      completed: 0,
    },
  }),
});
test("Agency defaults to staff work, renders safe case links and bilingual navigation", async (t) => {
  const calls = [];
  const p = await mount(t, async (url) => {
    calls.push(url);
    return response([row]);
  });
  assert.match(calls[0], /work_queue=to_review/);
  assert.equal(p.$(".demo-views"), null);
  assert.equal(p.$("#queue-body img[onerror]"), null);
  assert.equal(p.$(".case-title").textContent, row.listing_title);
  assert.match(p.$(".case-title").href, /\/agency\/submissions\/case-1\?/);
  p.$("#agency-language").value = "en";
  p.$("#agency-language").dispatchEvent(new p.dom.window.Event("change"));
  assert.equal(p.$("html").lang, "en");
  assert.equal(p.$("h1").textContent, "Marketplace verification");
  assert.equal(
    p.dom.window.localStorage.getItem("trustcart-agency-language"),
    "en",
  );
});
test("Agency combines marketplace, work, result and search filters with empty state", async (t) => {
  const calls = [];
  const p = await mount(
    t,
    async (url) => {
      calls.push(url);
      return response([]);
    },
    "http://localhost/agency?marketplace=lazada&work_queue=completed&status=DENIED&q=reference",
  );
  const params = new URL(calls[0], "http://localhost").searchParams;
  assert.equal(params.get("marketplace"), "lazada");
  assert.equal(params.get("status"), "DENIED");
  assert.equal(params.get("q"), "reference");
  assert.equal(p.$("#queue-empty").hidden, false);
  assert.equal(
    p.$('[data-marketplace="lazada"]').getAttribute("aria-pressed"),
    "true",
  );
});
test("Agency failed refresh removes stale cases and offers retry", async (t) => {
  let failing = false;
  const p = await mount(t, async () => {
    if (failing) throw Error("offline");
    return response([row]);
  });
  failing = true;
  await p.dom.window.TrustCartAgency.load();
  assert.equal(p.$("#queue-body").children.length, 0);
  assert.equal(p.$("#queue-error").hidden, false);
  assert.equal(p.$("#queue-loading").hidden, true);
});


test("Agency loads once and refreshes only on explicit user action", async (t) => {
  let calls = 0;
  const timers = [];
  const p = await mount(t, async () => { calls++; return response([row]); }, "http://localhost/agency", window => {
    Object.defineProperty(window.document, "hidden", {value:false});
    window.setInterval = callback => { timers.push(callback); return timers.length; };
  });
  assert.equal(calls, 1);
  for (const callback of timers) await callback();
  p.dom.window.dispatchEvent(new p.dom.window.Event("focus"));
  p.dom.window.document.dispatchEvent(new p.dom.window.Event("visibilitychange"));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1, "background activity must not reload the queue");
  await p.$("#refresh-queue").onclick();
  assert.equal(calls, 2, "manual Refresh must still load the queue");
});
