const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const path = require("node:path");
const report = {
  id: "7aba58f0-1e89-4ba6-89af-3b86b469c819",
  status: "APPROVED",
  reason: "registration_identity_and_category_matched",
  confidence: 1,
  human_review_required: false,
  registry_source: "synthetic",
  chain_hash: "final-chain",
  trace: [
    {
      step: "R-01",
      outcome: "matched",
      at: "2026-11-21T03:00:00Z",
      previous_hash: null,
      chain_hash: "identity-chain",
    },
  ],
};
function reviewer(t, fetch, setup = () => {}, url = "http://localhost/reviewer") {
  const dom = new JSDOM(
    fs.readFileSync(
      path.join(__dirname, "../../frontend/reviewer.html"),
      "utf8",
    ),
    { url, runScripts: "outside-only" },
  );
  dom.window.fetch = fetch;
  setup(dom.window);
  dom.window.eval(
    fs.readFileSync(
      path.join(__dirname, "../../frontend/verification-view.js"),
      "utf8",
    ),
  );
  dom.window.eval(
    fs.readFileSync(path.join(__dirname, "../../frontend/reviewer.js"), "utf8"),
  );
  t.after(() => dom.window.close());
  const $ = (selector) => dom.window.document.querySelector(selector);
  return {
    dom,
    $,
    async load(id = report.id) {
      $("#report-id").value = id;
      $("#report-lookup").dispatchEvent(
        new dom.window.Event("submit", { cancelable: true }),
      );
      await new Promise((resolve) => setImmediate(resolve));
    },
  };
}
test("reviewer retrieves stored report with reason, rule results and hash chain", async (t) => {
  const p = reviewer(t, async (url) => {
    assert.equal(url, `/v1/verifications/${report.id}`);
    return { ok: true, json: async () => report };
  });
  await p.load();
  assert.match(p.$("#reviewer-report").textContent, /APPROVED/);
  assert.match(
    p.$("#reviewer-report").textContent,
    /registration_identity_and_category_matched/,
  );
  assert.match(p.$("#reviewer-report").textContent, /R-01/);
  assert.match(p.$("#reviewer-report").textContent, /identity-chain/);
  assert.match(p.$("#reviewer-report").textContent, /final-chain/);
});
test("failed lookup clears previous report and never presents it as current", async (t) => {
  let count = 0;
  const p = reviewer(t, async () =>
    ++count === 1
      ? { ok: true, json: async () => report }
      : { ok: false, status: 404 },
  );
  await p.load();
  await p.load();
  assert.equal(p.$("#reviewer-report").textContent, "");
  assert.match(p.$("#reviewer-error").textContent, /ไม่พบ/);
});
test("reviewer renders unknown status and untrusted reason as plain text", async (t) => {
  const p = reviewer(t, async () => ({
    ok: true,
    json: async () => ({
      ...report,
      status: "UNKNOWN",
      confidence: 0,
      human_review_required: true,
      reason: "<img src=x onerror=alert(1)>",
    }),
  }));
  await p.load();
  assert.match(p.$("#reviewer-report").textContent, /UNKNOWN/);
  assert.match(p.$("#reviewer-report").textContent, /<img src=x/);
  assert.equal(p.$("#reviewer-report img"), null);
});

test("invalid report ID does not send a request", async (t) => {
  const p = reviewer(t, async () =>
    assert.fail("invalid UUID must not be requested"),
  );
  await p.load("../unrelated");
  assert.match(p.$("#reviewer-error").textContent, /UUID/);
  assert.equal(p.$("#reviewer-report").textContent, "");
});

test("late response cannot replace a newer reviewer lookup", async (t) => {
  const nextId = "7aba58f0-1e89-4ba6-89af-3b86b469c820";
  let finishFirst;
  const p = reviewer(t, (url) =>
    url.endsWith(report.id)
      ? new Promise((resolve) => {
          finishFirst = resolve;
        })
      : Promise.resolve({
          ok: true,
          json: async () => ({ ...report, id: nextId, status: "UNKNOWN" }),
        }),
  );
  await p.load();
  await p.load(nextId);
  finishFirst({ ok: true, json: async () => report });
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(p.$("#reviewer-report").textContent, /UNKNOWN/);
  assert.equal(p.$("#reviewer-report").textContent.includes(report.id), false);
});

test("reviewer shows literal overclaim evidence and specific denial reason", async (t) => {
  const p = reviewer(t, async () => ({
    ok: true,
    json: async () => ({
      ...report,
      status: "DENIED",
      reason: "advertising_overclaim",
      listing_title: "NovaLeaf Vitamin C",
      claim_findings: [
        {
          rule_id: "R-03",
          code: "instant_effect",
          source: "title",
          phrase: "ผิวกระจ่างใสทันที 100%",
          reason_th: "อ้างผลลัพธ์ทันทีจากผลิตภัณฑ์เสริมอาหาร",
          reason_en: "Promises an immediate effect from a supplement.",
        },
      ],
    }),
  }));
  await p.load();
  const text = p.$("#reviewer-report").textContent;
  assert.match(text, /DENIED/);
  assert.match(text, /NovaLeaf Vitamin C/);
  assert.match(text, /ผิวกระจ่างใสทันที 100%/);
  assert.match(text, /อ้างผลลัพธ์ทันที/);
  assert.match(text, /R-03/);
});

test("stepper explains blockers and never invents a passed check", async (t) => {
  const p = reviewer(t, async () => ({
    ok: true,
    json: async () => ({
      ...report,
      status: "DENIED",
      reason: "advertising_overclaim",
      trace: [
        { step: "R-01", outcome: "failed" },
        { step: "R-02", outcome: "matched" },
        { step: "R-03", outcome: '{"code":"instant_effect"}' },
      ],
      claim_findings: [
        {
          rule_id: "R-03",
          code: "instant_effect",
          phrase: "ผิวกระจ่างใสทันที",
          reason_th: "อ้างผลลัพธ์ทันที",
        },
      ],
    }),
  }));
  await p.load();
  assert.equal(p.$('.review-step[data-rule="R-01"]').dataset.state, "blocked");
  assert.equal(p.$('.review-step[data-rule="R-02"]').dataset.state, "passed");
  assert.equal(p.$('.review-step[data-rule="R-03"]').dataset.state, "blocked");
  assert.match(p.$(".review-next-action").textContent, /แก้ไข/);
});

for (const failure of ['offline', 'server', 'invalid-json', 'wrong-id', 'null']) {
  test(`reviewer clears previous results and loading state for ${failure}`, async (t) => {
    let count = 0;
    const p = reviewer(t, async () => {
      if (++count === 1) return { ok: true, json: async () => report };
      if (failure === 'offline') throw Error('offline');
      if (failure === 'server') return { ok: false, status: 500 };
      return { ok: true, json: async () => {
        if (failure === 'invalid-json') throw Error('invalid JSON');
        return failure === 'null' ? null : { ...report, id: 'wrong' };
      } };
    });
    await p.load();
    assert.match(p.$('#reviewer-report').textContent, /APPROVED/);
    await p.load();
    assert.equal(p.$('#reviewer-report').textContent, '');
    assert.equal(p.$('#reviewer-loading').hidden, true);
    assert.equal(p.$('#reviewer-error').hidden, false);
    assert.ok(p.$('#reviewer-error').textContent);
  });
}

test('reviewer loads query-string report automatically', async (t) => {
  const requested = [];
  const p = reviewer(t, async (url) => {
    requested.push(url);
    return { ok: true, json: async () => report };
  }, () => {}, `http://localhost/reviewer?id=${report.id}`);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(requested, [`/v1/verifications/${report.id}`]);
  assert.equal(p.$('#report-id').value, report.id);
  assert.match(p.$('#reviewer-report').textContent, /APPROVED/);
});

test('reviewer selects session reports and renders option labels as text', async (t) => {
  const p = reviewer(t, async () => ({ ok: true, json: async () => report }), (window) => {
    window.sessionStorage.setItem('trustcart-demo-reports', JSON.stringify([
      null, {}, { id: report.id, title: '<img src=x>', status: 'UNKNOWN' },
    ]));
  });
  assert.equal(p.$('#demo-reports').hidden, false);
  assert.equal(p.$('#demo-report-select img'), null);
  const select = p.$('#demo-report-select');
  select.value = report.id;
  select.dispatchEvent(new p.dom.window.Event('change'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(p.$('#report-id').value, report.id);
  assert.match(p.$('#reviewer-report').textContent, /APPROVED/);
});

for (const saved of ['{broken', '{}']) {
  test(`reviewer manual lookup survives invalid session data ${saved}`, async (t) => {
    const p = reviewer(t, async () => ({ ok: true, json: async () => report }), (window) => {
      window.sessionStorage.setItem('trustcart-demo-reports', saved);
    });
    await p.load();
    assert.match(p.$('#reviewer-report').textContent, /APPROVED/);
  });
}

test('reviewer loading indicator lasts until the active request finishes', async (t) => {
  let finish;
  const p = reviewer(t, () => new Promise((resolve) => { finish = resolve; }));
  await p.load();
  assert.equal(p.$('#reviewer-loading').hidden, false);
  assert.equal(p.$('#reviewer-report').textContent, '');
  finish({ ok: true, json: async () => report });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(p.$('#reviewer-loading').hidden, true);
  assert.equal(p.$('#reviewer-error').hidden, true);
});

test('reviewer ignores a late failure after a newer successful lookup', async (t) => {
  let rejectFirst;
  let calls = 0;
  const p = reviewer(t, () => ++calls === 1
    ? new Promise((resolve, reject) => { rejectFirst = reject; })
    : Promise.resolve({ ok: true, json: async () => report }));
  await p.load();
  await p.load();
  rejectFirst(Error('late outage'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(p.$('#reviewer-report').textContent, /APPROVED/);
  assert.equal(p.$('#reviewer-error').hidden, true);
});
