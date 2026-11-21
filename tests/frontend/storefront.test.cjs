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
  assert.match(p.$("#claim-coupon").textContent, /เก็บโค้ดแล้ว/);
  assert.equal(p.$("#toast").hidden, false);
});

test("flash deals open the full catalog and countdown never becomes negative", (t) => {
  let now = 1000000;
  let tick;
  const p = page(t, (window) => {
    window.Date.now = () => now;
    window.setInterval = (callback, milliseconds) => {
      if (milliseconds === 1000) tick = callback;
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
  assert.match(p.$("#cart-total").textContent, /Total: ฿429/);
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
  assert.equal(p.$("#product-title .product-verified").tagName, "BUTTON");
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

test("customer badge opens a short status without exposing the reviewer report", async (t) => {
  const p = page(t, (window) => {
    window.fetch = async () => ({ ok: true, json: async () => reportFixture });
  });
  await new Promise((resolve) => setImmediate(resolve));
  const badge = p.$(".product-card .product-verified");
  assert.equal(badge.tagName, "BUTTON");
  assert.equal(badge.getAttribute("aria-haspopup"), "dialog");
  badge.click();
  assert.equal(p.$("#product-status-dialog").open, true);
  assert.equal(p.$("#product-dialog").open, false);
  p.$("#product-status-dialog [data-close]").click();
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

test("overclaim product copy has no fictional-brand remarks and no verified badge", (t) => {
  const p = page(t);
  p.$('[data-category="1"]').click();
  assert.equal(p.$$(".product-card").length, 6);
  assert.equal(p.$$(".overclaim-example").length, 3);
  for (const card of p.$$(".overclaim-example")) {
    assert.equal(card.querySelector(".product-verified"), null);
    card.click();
    assert.ok(p.$("#product-title").textContent.length > 10);
    assert.equal(
      p.$("#product-detail").textContent.includes("แบรนด์สมมติ"),
      false,
    );
    assert.ok(p.$(".product-description").textContent.length > 40);
    p.$("#product-dialog [data-close]").click();
  }
});

test("overclaim listings submit their actual copy and never show a customer status badge", async (t) => {
  const submitted = [];
  const p = page(t, (window) => {
    window.fetch = async (url, options) => {
      const listing = JSON.parse(options.body);
      submitted.push(listing);
      const denied = listing.title.includes("—");
      return {
        ok: true,
        json: async () => ({
          ...reportFixture,
          id: `7aba58f0-1e89-4ba6-89af-3b86b469c8${submitted.length + 10}`,
          status: denied ? "DENIED" : "APPROVED",
          reason: denied
            ? "advertising_overclaim"
            : "registration_identity_and_category_matched",
          listing_title: listing.title,
        }),
      };
    };
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(submitted.length, 4);
  assert.equal(
    submitted.filter(
      (item) =>
        item.description.includes("ทันที") ||
        item.description.includes("เห็นผลแน่นอน"),
    ).length,
    3,
  );
  p.$('[data-category="1"]').click();
  for (const card of p.$$(".overclaim-example")) {
    assert.equal(card.querySelector(".product-verified"), null);
    assert.equal(card.querySelector(".product-status"), null);
  }
  assert.equal(
    JSON.parse(p.window.sessionStorage.getItem("trustcart-demo-reports"))
      .length,
    4,
  );
});

test("storefront product language contains no simulation or fictional-brand remarks", (t) => {
  const p = page(t);
  p.$('[data-category="1"]').click();
  for (const card of p.$$(".product-card")) {
    card.click();
    assert.doesNotMatch(
      p.$("#product-detail").textContent,
      /จำลอง|แบรนด์สมมติ/,
    );
    p.$("#product-dialog [data-close]").click();
  }
  assert.match(p.document.body.textContent, /Synthetic/);
});

test("customer catalog keeps one seller product with its newest content and removes stale approval", async (t) => {
  let status = "APPROVED";
  let title = "Created seller listing";
  let fail = false;
  const p = page(t, (window) => {
    window.fetch = async (url) => {
      if (url === "/v1/products") {
        if (fail) throw Error("offline");
        return {
          ok: true,
          json: async () => [
            {
              id: "seller-1",
              version: status === "APPROVED" ? 1 : 2,
              listing: {
                title,
                description: "Seller description",
                category: "supplement",
              },
              verification: { ...reportFixture, status },
            },
          ],
        };
      }
      return { ok: false };
    };
  });
  await new Promise((r) => setImmediate(r));
  assert.equal(p.$$('[data-product="seller-1"]').length, 1);
  assert.ok(p.$('[data-product="seller-1"] .product-verified'));
  status = "DENIED";
  title = "Edited seller listing";
  p.window.dispatchEvent(new p.window.Event("focus"));
  await new Promise((r) => setImmediate(r));
  assert.equal(p.$$('[data-product="seller-1"]').length, 1);
  assert.match(
    p.$('[data-product="seller-1"]').textContent,
    /Edited seller listing/,
  );
  assert.equal(p.$('[data-product="seller-1"] .product-status'), null);
  fail = true;
  p.window.dispatchEvent(new p.window.Event("focus"));
  await new Promise((r) => setImmediate(r));
  assert.equal(p.$('[data-product="seller-1"] .product-status'), null);
});

for (const key of ['download', 'social', 'notifications', 'help', 'account', 'about']) {
  test(`utility ${key} opens an informative dialog`, (t) => {
    const p = page(t);
    p.$(`[data-info="${key}"]`).click();
    assert.equal(p.$('#info-dialog').open, true);
    assert.ok(p.$('#info-title').textContent);
    assert.ok(p.$('#info-body').textContent);
    assert.equal(p.$('#info-dialog input'), null);
    p.$('#info-dialog [data-close]').click();
    assert.equal(p.$('#info-dialog').open, false);
  });
}

test('all shortcut and banner controls open promotions; coupon remains claimed', (t) => {
  const p = page(t);
  for (const control of [...p.$$('.shortcut'), ...p.$$('[data-promo]')]) {
    control.click();
    assert.equal(p.$('#promo-dialog').open, true);
    assert.ok(p.$('#promo-title').textContent);
    p.$('#promo-dialog [data-close]').click();
  }
  p.$('.shortcut').click();
  p.$('#claim-coupon').click();
  p.$('#promo-dialog [data-close]').click();
  p.$('.shortcut').click();
  assert.equal(p.$('#claim-coupon').disabled, true);
});

test('carousel dots select every slide and keep one active indicator', (t) => {
  const p = page(t);
  for (const [index, image] of ['hero', 'trendy', 'home'].entries()) {
    p.$$('#carousel-dots button')[index].click();
    assert.ok(p.$('#hero-image').src.endsWith(`${image}.webp`));
    assert.equal(p.$$('#carousel-dots [aria-current="true"]').length, 1);
    assert.equal(p.$$('#carousel-dots button')[index].getAttribute('aria-current'), 'true');
  }
});

test('each category can be selected and reset using all categories or clear filters', (t) => {
  const p = page(t);
  for (let index = 0; index < 24; index++) {
    p.$(`[data-category="${index}"]`).click();
    assert.equal(p.$(`[data-category="${index}"]`).getAttribute('aria-pressed'), 'true');
    p.$('#all-categories').click();
    assert.equal(p.$(`[data-category="${index}"]`).getAttribute('aria-pressed'), 'false');
  }
  submit(p, 'headphones');
  p.$('#clear-filters').click();
  assert.equal(p.$('#search').value, '');
  assert.equal(p.$$('.product-card').length, 12);
});

test('flash product opens matching details; cart rejects cumulative quantity over 99', (t) => {
  const p = page(t);
  const id = p.$('.flash-card').dataset.product;
  p.$('.flash-card').click();
  const title = p.$('#product-title').textContent;
  p.$('#quantity').value = '99';
  p.$('#add-to-cart').click();
  assert.equal(p.$('#cart-count').textContent, '99');
  p.$(`[data-product="${id}"]`).click();
  assert.equal(p.$('#product-title').textContent, title);
  p.$('#add-to-cart').click();
  assert.equal(p.$('#cart-count').textContent, '99');
  assert.equal(p.$('#product-dialog').open, true);
  assert.equal(p.document.activeElement, p.$('#quantity'));
});

test('cart handles multiple products and restores focus after removing each', (t) => {
  const p = page(t);
  for (const id of p.$$('.product-card').slice(0, 2).map((card) => card.dataset.product)) {
    p.$(`[data-product="${id}"]`).click();
    p.$('#add-to-cart').click();
  }
  p.$('[data-info="cart"]').click();
  assert.equal(p.$('#cart-dialog').open, true);
  assert.equal(p.$$('.cart-item').length, 2);
  p.$('[data-remove]').click();
  assert.equal(p.$$('.cart-item').length, 1);
  assert.equal(p.document.activeElement, p.$('[data-remove]'));
  p.$('[data-remove]').click();
  assert.equal(p.document.activeElement, p.$('#cart-dialog [data-close]'));
  assert.match(p.$('#cart-total').textContent, /฿0/);
});

test('dialog backdrop closes only for a click outside its bounds', (t) => {
  const p = page(t);
  p.$('#open-cart').click();
  const dialog = p.$('#cart-dialog');
  dialog.getBoundingClientRect = () => ({ left: 10, right: 100, top: 10, bottom: 100 });
  dialog.dispatchEvent(new p.window.MouseEvent('click', { clientX: 50, clientY: 50 }));
  assert.equal(dialog.open, true);
  dialog.dispatchEvent(new p.window.MouseEvent('click', { clientX: 0, clientY: 0 }));
  assert.equal(dialog.open, false);
});

test('seller catalog storage refresh removes deleted listings and closes their dialog', async (t) => {
  let records = [{ id: 'seller-storage', listing: { title: '<img src=x>', description: '<script>bad</script>',
    category: 'cosmetic' }, verification: reportFixture }];
  const p = page(t, (window) => {
    window.fetch = async (url) => url === '/v1/products'
      ? { ok: true, json: async () => records } : { ok: false };
  });
  await new Promise((resolve) => setImmediate(resolve));
  const card = p.$('[data-product="seller-storage"]');
  assert.ok(card);
  assert.equal(card.querySelector('img[src="x"]'), null);
  card.click();
  assert.equal(p.$('#product-title').textContent.includes('<img src=x>'), true);
  assert.equal(p.$('#product-detail script'), null);
  assert.equal(p.$('#add-to-cart').disabled, true);
  records = [];
  p.window.dispatchEvent(new p.window.StorageEvent('storage', { key: 'trustcart-products-updated' }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(p.$('[data-product="seller-storage"]'), null);
  assert.equal(p.$('#product-dialog').open, false);
});

test('customer sees seller images price and stock, caps cart and refreshes edited stock', async (t) => {
  const images=['data:image/png;base64,aA==','data:image/png;base64,aQ=='];
  const listing={title:'Media product',description:'Tablets',category:'supplement',images,price:'299.50',stock:2};
  const p=page(t,w=>{w.fetch=async()=>({ok:true,json:async()=>[{id:'media',listing,verification:{status:'DENIED'}}]});});
  await new Promise(r=>setImmediate(r));
  submit(p,'Media product');
  assert.equal(p.$('[data-product="media"] img').getAttribute('src'),images[0]);
  p.$('[data-product="media"] .product-open').click();
  assert.match(p.$('#product-detail').textContent,/299.5/);
  assert.match(p.$('#product-stock').textContent,/2/);
  assert.equal(p.$('#quantity').max,'2');
  p.$('.product-gallery button:last-child').click();
  assert.equal(p.$('.product-gallery > img').getAttribute('src'),images[1]);
  p.$('#quantity').value='3'; p.$('#add-to-cart').click();
  assert.equal(p.$('#cart-count').textContent,'0');
  p.$('#quantity').value='2'; p.$('#add-to-cart').click();
  assert.equal(p.$('#cart-count').textContent,'2');
  listing.stock=0; listing.price='199.00'; listing.images=[];
  p.window.dispatchEvent(new p.window.Event('focus'));
  await new Promise(r=>setImmediate(r));
  assert.equal(p.$('#cart-count').textContent,'0');
  p.$('[data-product="media"] .product-open').click();
  assert.equal(p.$('#add-to-cart').disabled,true);
  assert.match(p.$('#product-stock').textContent,/หมด|Out of stock/);
});

test('unchanged catalog refresh preserves customer quantity and selected gallery image', async (t) => {
  const listing={title:'Gallery product',category:'supplement',price:'10',stock:5,images:['data:image/png;base64,aA==','data:image/png;base64,aQ==']};
  const p=page(t,w=>{w.fetch=async()=>({ok:true,json:async()=>[{id:'gallery',listing,verification:{status:'DENIED'}}]});});
  await new Promise(r=>setImmediate(r));
  submit(p,'Gallery product');
  p.$('[data-product="gallery"] .product-open').click();
  p.$('.product-thumbnails button:last-child').click();
  p.$('#quantity').value='3';
  p.window.dispatchEvent(new p.window.Event('focus'));
  await new Promise(r=>setImmediate(r));
  assert.equal(p.$('#quantity').value,'3');
  assert.equal(p.$('.product-gallery > img').getAttribute('src'),listing.images[1]);
});

test('reference brand section uses local artwork and explicit external shop links without verification badges', (t) => {
  const p=page(t);
  assert.equal(p.$$('#brand-shops .brand-shop').length,8);
  for(const link of p.$$('#brand-shops .brand-shop')) {
    assert.ok(link.getAttribute('href').startsWith('https://shopee.co.th/'));
    assert.equal(link.target,'_blank');
    assert.match(link.rel,/noopener/);
    assert.ok(link.querySelector('img').getAttribute('src').startsWith('/static/assets/brand-'));
    const asset = link.querySelector('img').getAttribute('src').replace('/static/', '');
    assert.ok(fs.statSync(path.join(__dirname, '../../frontend', asset)).size > 0);
    assert.ok(link.querySelector('img').alt);
    assert.equal(link.querySelector('.product-verified'),null);
  }
  assert.ok(p.$('footer .demo-views a[href="/seller"]'));
  assert.equal(p.$('body > .demo-views'),null);
});

test('popular product rail opens real local product details and updates language', (t) => {
  const p=page(t);
  assert.equal(p.$$('#popular-products .popular-product').length,6);
  const first=p.$('#popular-products .popular-product');
  first.click();
  assert.equal(p.$('#product-dialog').open,true);
  assert.ok(p.$('#product-title').textContent.length>0);
  p.$('#product-dialog [data-close]').click();
  p.$('#language').value='en';
  p.$('#language').dispatchEvent(new p.window.Event('change'));
  assert.equal(p.$('#popular-title').textContent,'Popular products');
  assert.match(p.$('#popular-products').textContent,/sold/);
  assert.equal(p.$$('#brand-shops .brand-shop').length,8);
});

test('Shopee-style detail separates gallery purchase and description with bounded quantity controls', async (t) => {
  const listing={title:'Detail product',description:'First line\nSecond line <script>text</script>',category:'supplement',price:'249.50',stock:3,images:['data:image/png;base64,aA==','data:image/png;base64,aQ==']};
  const p=page(t,w=>{w.fetch=async()=>({ok:true,json:async()=>[{id:'detail',listing,verification:reportFixture}]});});
  await new Promise(r=>setImmediate(r));
  submit(p,'Detail product');
  p.$('[data-product="detail"] .product-open').click();
  assert.ok(p.$('.product-purchase .detail-price'));
  assert.equal(p.$('.product-purchase .product-description'),null);
  assert.match(p.$('.product-description-section').textContent,/First line/);
  assert.equal(p.$('.product-description-section script'),null);
  assert.equal(p.$('#decrease-quantity').disabled,true);
  p.$('#increase-quantity').click(); p.$('#increase-quantity').click();
  assert.equal(p.$('#quantity').value,'3');
  assert.equal(p.$('#increase-quantity').disabled,true);
  p.$('#decrease-quantity').click();
  assert.equal(p.$('#quantity').value,'2');
  p.$('.product-thumbnails button:last-child').click();
  assert.match(p.$('#gallery-position').textContent,/2.*2/);
  p.$('#product-title .product-verified').click();
  assert.equal(p.$('#product-status-dialog').open,true);
  assert.equal(p.$('#product-status-dialog .reviewer-trace'),null);
});

test('approved product results never certify brand-shop references across languages', async (t) => {
  const p = page(t, (window) => {
    window.fetch = async (url) => url === '/v1/products'
      ? { ok: true, json: async () => [] }
      : { ok: true, json: async () => reportFixture };
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(p.$('.product-card .product-verified'));
  const originalLinks = p.$$('#brand-shops a').map((link) => link.href);
  for (const language of ['en', 'th']) {
    p.$('#language').value = language;
    p.$('#language').dispatchEvent(new p.window.Event('change'));
    assert.equal(p.$$('#brand-shops .brand-shop').length, 8);
    assert.deepEqual(p.$$('#brand-shops a').map((link) => link.href), originalLinks);
    assert.equal(p.$('#brand-shops .product-verified'), null);
    assert.equal(p.$('#brand-shops .product-status'), null);
    assert.match(p.$('#brand-shops a').getAttribute('aria-label'), language === 'en' ? /View on Shopee/ : /ดูบน Shopee/);
  }
});
