const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

function page(t, setup = () => {}) {
  const dom = new JSDOM(
    fs.readFileSync(path.join(__dirname, "../../frontend/index.html"), "utf8"),
    {
      runScripts: "outside-only",
      url: "http://localhost/",
      pretendToBeVisual: true,
    },
  );
  dom.window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  dom.window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  setup(dom.window);
  dom.window.eval(
    fs.readFileSync(path.join(__dirname, "../../frontend/app.js"), "utf8"),
  );
  t.after(() => dom.window.close());
  const document = dom.window.document;
  return {
    window: dom.window,
    document,
    $: (selector) => document.querySelector(selector),
    $$: (selector) => [...document.querySelectorAll(selector)],
  };
}
function submit(p, value) {
  p.$("#search").value = value;
  p.$("#search-form").dispatchEvent(
    new p.window.Event("submit", { bubbles: true, cancelable: true }),
  );
}

test("search finds matching demo products, handles no matches, and can reset", (t) => {
  const p = page(t);
  assert.equal(p.$$(".product-card").length, 12);
  submit(p, "หูฟัง");
  assert.equal(p.$$(".product-card").length, 1);
  assert.match(p.$(".product-name").textContent, /หูฟัง/);
  assert.equal(p.$("#clear-filters").hidden, false);
  submit(p, "<img src=x onerror=alert(1)>");
  assert.equal(p.$$(".product-card").length, 0);
  assert.equal(p.$("#empty-state").hidden, false);
  assert.equal(p.$("#results-summary img"), null);
  p.$("#reset-search").click();
  assert.equal(p.$$(".product-card").length, 12);
  assert.equal(p.$("#empty-state").hidden, true);
});

test("category selection combines with search and all-categories clears the selection", (t) => {
  const p = page(t);
  assert.equal(p.$$(".category").length, 24);
  p.$('[data-category="10"]').click();
  assert.equal(
    p.$('[data-category="10"]').getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(p.$$(".product-card").length, 1);
  submit(p, "ไม่ตรงกับสินค้า");
  assert.equal(p.$("#empty-state").hidden, false);
  p.$("#all-categories").click();
  assert.equal(p.$("#search").value, "");
  assert.equal(p.$$(".product-card").length, 12);
});

test("catalog sorting and load-more show prices in the chosen order", (t) => {
  const p = page(t);
  p.$("#load-more").click();
  assert.equal(p.$$(".product-card").length, 24);
  assert.equal(p.$("#load-more").hidden, false);
  p.$("#load-more").click();
  assert.equal(p.$$(".product-card").length, 27);
  assert.equal(p.$("#load-more").hidden, true);
  p.$("#sort").value = "price-low";
  p.$("#sort").dispatchEvent(new p.window.Event("change"));
  assert.equal(p.$(".price").textContent, "฿49");
  p.$("#sort").value = "price-high";
  p.$("#sort").dispatchEvent(new p.window.Event("change"));
  assert.equal(p.$(".price").textContent, "฿12,990");
});

test("promotions cycle in both directions and a demo coupon can be claimed", (t) => {
  const p = page(t);
  assert.equal(p.$$(".shortcut").length, 7);
  assert.match(p.$("#hero-image").src, /hero.webp$/);
  p.$("#next-slide").click();
  assert.match(p.$("#hero-image").src, /trendy.webp$/);
  assert.equal(p.$$('.carousel-dots [aria-current="true"]').length, 1);
  p.$("#previous-slide").click();
  assert.match(p.$("#hero-image").src, /hero.webp$/);
  p.$("#previous-slide").click();
  assert.match(p.$("#hero-image").src, /home.webp$/);
  p.$(".new-user-banner").click();
  assert.equal(p.$("#promo-dialog").open, true);
  p.$("#claim-coupon").click();
  assert.equal(p.$("#claim-coupon").disabled, true);
  assert.match(p.$("#claim-coupon").textContent, /เก็บแล้ว/);
  assert.equal(p.$("#toast").hidden, false);
});

test("flash deals open the full catalog and countdown never becomes negative", (t) => {
  let now = 1000000;
  let tick;
  const p = page(t, (window) => {
    window.Date.now = () => now;
    window.setInterval = (callback) => {
      tick = callback;
      return 0;
    };
  });
  assert.equal(p.$$(".flash-card").length, 6);
  assert.match(p.$("#countdown").textContent, /^\d{2} : \d{2} : \d{2}$/);
  p.$("#all-deals").click();
  assert.equal(p.$$(".product-card").length, 27);
  now += 3600000;
  tick();
  assert.equal(p.$("#countdown").textContent, "00 : 00 : 00");
});

test("product details add chosen quantity, merge repeated items, total correctly, and remove", (t) => {
  const p = page(t);
  p.$(".product-card").click();
  assert.equal(p.$("#product-dialog").open, true);
  assert.match(p.$("#product-title").textContent, /หูฟัง/);
  p.$("#quantity").value = "2";
  p.$("#add-to-cart").click();
  assert.equal(p.$("#cart-count").textContent, "2");
  p.$(".product-card").click();
  p.$("#add-to-cart").click();
  p.$("#open-cart").click();
  assert.equal(p.$("#cart-dialog").open, true);
  assert.equal(p.$$(".cart-item").length, 1);
  assert.match(p.$("#cart-total").textContent, /1,287/);
  p.$("[data-remove]").click();
  assert.equal(p.$$(".cart-item").length, 0);
  assert.equal(p.$("#cart-count").hidden, true);
  assert.match(p.$("#cart-items").textContent, /ยังไม่มีสินค้า/);
});

test("invalid quantities cannot be added to the cart", (t) => {
  const p = page(t);
  p.$(".product-card").click();
  for (const invalid of ["0", "-1", "1.5", "100", ""]) {
    p.$("#quantity").value = invalid;
    p.$("#add-to-cart").click();
    assert.equal(p.$("#cart-count").hidden, true);
    assert.equal(p.$("#product-dialog").open, true);
  }
});

test("utility actions explain demo limitations without collecting credentials", (t) => {
  const p = page(t);
  p.$('[data-info="account"]').click();
  assert.equal(p.$("#info-dialog").open, true);
  assert.match(p.$("#info-body").textContent, /บัญชี/);
  assert.equal(p.$('input[type="password"]'), null);
  p.$("#info-dialog [data-close]").click();
  assert.equal(p.$("#info-dialog").open, false);
});

test("language changes update navigation, search hints, categories, product details and cart", (t) => {
  const p = page(t);
  p.$("#language").value = "en";
  p.$("#language").dispatchEvent(new p.window.Event("change"));
  assert.equal(p.document.documentElement.lang, "en");
  assert.equal(p.$("#catalog-title").textContent, "Daily discovery");
  assert.match(p.$("#search").placeholder, /New here/);
  assert.equal(p.$('[data-category="10"]').textContent, "Electronics");
  p.$("[data-query]").click();
  assert.match(p.$(".product-name").textContent, /headphones/);
  p.$(".product-card").click();
  assert.match(p.$("#product-title").textContent, /headphones/);
  assert.equal(p.$("#add-to-cart").textContent, "Add to cart");
  p.$("#add-to-cart").click();
  p.$("#open-cart").click();
  assert.match(p.$("#cart-items").textContent, /headphones/);
  assert.match(p.$("#cart-total").textContent, /Demo total: ฿429/);
  p.$("#cart-dialog [data-close]").click();
  p.$("#language").value = "th";
  p.$("#language").dispatchEvent(new p.window.Event("change"));
  assert.equal(p.document.documentElement.lang, "th");
  assert.equal(p.$("#catalog-title").textContent, "สินค้าแนะนำประจำวัน");
});

test("product checkmark uses the backend result and never marks an account", async (t) => {
  const p = page(t, (window) => {
    window.fetch = async (url, options) => {
      assert.equal(url, "/v1/verifications");
      assert.equal(JSON.parse(options.body).registration_reference, "DEMO-001");
      return {
        ok: true,
        json: async () => ({
          status: "APPROVED",
          confidence: 1,
          human_review_required: false,
          registry_source: "synthetic",
          chain_hash: "demo-chain",
        }),
      };
    };
  });
  await new Promise((resolve) => setImmediate(resolve));
  p.$('[data-category="1"]').click();
  assert.equal(p.$$(".product-card .product-verified").length, 1);
  assert.equal(p.$(".utility .product-verified"), null);
  p.$(".product-card").click();
  assert.equal(p.$("#explain-verification"), null);
  assert.equal(p.$("#product-title .product-verified").tagName, "SPAN");
});

for (const result of [
  { status: "UNKNOWN", confidence: 0 },
  { status: "PENDING", confidence: 0.9 },
  { status: "DENIED", confidence: 1 },
  { status: "APPROVED", confidence: 0.74 },
  { status: "APPROVED", confidence: 1, human_review_required: true },
]) {
  test(`no product checkmark for ${JSON.stringify(result)}`, async (t) => {
    const p = page(t, (window) => {
      window.fetch = async () => ({
        ok: true,
        json: async () => ({
          human_review_required: false,
          registry_source: "synthetic",
          chain_hash: "demo-chain",
          ...result,
        }),
      });
    });
    await new Promise((resolve) => setImmediate(resolve));
    p.$("#load-more").click();
    assert.equal(p.$$(".product-verified").length, 0);
  });
}

for (const failure of ["network", "http"]) {
  test(`no product checkmark on ${failure} failure`, async (t) => {
    const p = page(t, (window) => {
      window.fetch = async () => {
        if (failure === "network") throw new Error("offline");
        return { ok: false };
      };
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(p.$$(".product-verified").length, 0);
  });
}

const reportFixture = {
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
    {
      step: "R-02",
      outcome: "matched",
      at: "2026-11-21T03:00:01Z",
      previous_hash: "identity-chain",
      chain_hash: "final-chain",
    },
  ],
};

test("customer sees only a product badge, never a report or status popup", async (t) => {
  const p = page(t, (window) => {
    window.fetch = async () => ({ ok: true, json: async () => reportFixture });
  });
  await new Promise((resolve) => setImmediate(resolve));
  const badge = p.$(".product-card .product-verified");
  assert.equal(badge.tagName, "SPAN");
  assert.equal(badge.getAttribute("aria-haspopup"), null);
  p.$('[data-product="14"]').click();
  assert.equal(p.$("#verification-dialog"), null);
  assert.equal(p.$("#verification-report"), null);
  assert.equal(p.$("#explain-verification"), null);
  for (const technical of [
    "APPROVED",
    "R-01",
    "identity-chain",
    "final-chain",
    reportFixture.id,
  ]) {
    assert.equal(p.$("#product-detail").textContent.includes(technical), false);
  }
});

test("three fictional-brand supplement examples have overclaim titles and descriptions but no badge", (t) => {
  const p = page(t);
  p.$('[data-category="1"]').click();
  assert.equal(p.$$(".product-card").length, 4);
  assert.equal(p.$$(".overclaim-example").length, 3);
  for (const card of p.$$(".overclaim-example")) {
    assert.equal(card.querySelector(".product-verified"), null);
    card.click();
    assert.match(
      p.$("#product-detail").textContent,
      /ตัวอย่างคำกล่าวอ้างเกินจริง/,
    );
    assert.match(p.$("#product-detail").textContent, /แบรนด์สมมติ/);
    assert.ok(p.$(".product-description").textContent.length > 40);
    p.$("#product-dialog [data-close]").click();
  }
});
