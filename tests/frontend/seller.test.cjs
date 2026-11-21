const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
function seller(t, fetch, setup = () => {}) {
  const dom = new JSDOM(
    fs.readFileSync(path.join(__dirname, "../../frontend/seller.html"), "utf8"),
    { url: "http://localhost/seller", runScripts: "outside-only" },
  );
  dom.window.fetch = fetch;
  setup(dom.window);
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
    if (url === "/v1/products" && !options?.body)
      return { ok: true, json: async () => [] };
    assert.equal(url, "/v1/products");
    const body = JSON.parse(options.body);
    assert.equal(body.title, "ผิวกระจ่างใสทันที 100%");
    return {
      ok: true,
      json: async () => ({
        id: "seller-1",
        version: 1,
        listing: body,
        verification: { ...result, listing: body },
      }),
    };
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

test("seller edits the same product ID with its current version", async (t) => {
  let revision = 0;
  const requests = [];
  const p = seller(t, async (url, options) => {
    if (!options?.body) return { ok: true, json: async () => [] };
    requests.push({
      url,
      method: options.method,
      body: JSON.parse(options.body),
    });
    const listing = JSON.parse(options.body);
    revision++;
    return {
      ok: true,
      json: async () => ({
        id: "seller-1",
        version: revision,
        listing,
        verification: { ...result, id: `report-${revision}`, listing },
      }),
    };
  });
  await p.submit();
  p.$("#listing-title").value = "Edited seller title";
  await p.submit();
  assert.equal(requests[0].method, "POST");
  assert.equal(requests[1].method, "PUT");
  assert.equal(requests[1].url, "/v1/products/seller-1");
  assert.equal(requests[1].body.expected_version, 1);
  assert.equal(
    p.dom.window.document.querySelectorAll(".seller-product-row").length,
    1,
  );
});

const settle = () => new Promise((resolve) => setImmediate(resolve));
const listingFixture = {
  title: 'Saved title', description: 'Saved description', category: 'cosmetic',
  registration_reference: 'DEMO-001', product_name: 'Saved name', license_holder: 'Saved holder',
};
const productFixture = { id: 'seller-1', version: 3, listing: listingFixture,
  verification: { ...result, listing: listingFixture } };

for (const field of ['listing-title', 'registration-reference', 'registered-name', 'license-holder']) {
  test(`seller requires ${field} before submitting`, async (t) => {
    let submissions = 0;
    const p = seller(t, async (url, options) => {
      if (options?.body) submissions++;
      return { ok: true, json: async () => [] };
    });
    p.$(`#${field}`).value = '';
    await p.submit();
    assert.equal(submissions, 0);
    assert.equal(p.$('#seller-form').checkValidity(), false);
  });
}

test('seller restores all draft fields and requires a new check', (t) => {
  const p = seller(t, async () => ({ ok: true, json: async () => [] }), (window) => {
    window.localStorage.setItem('trustcart-seller-draft', JSON.stringify(listingFixture));
  });
  for (const [id, key] of Object.entries({ 'listing-title': 'title', 'listing-description': 'description',
    'listing-category': 'category', 'registration-reference': 'registration_reference',
    'registered-name': 'product_name', 'license-holder': 'license_holder' })) {
    assert.equal(p.$(`#${id}`).value, listingFixture[key]);
  }
  assert.equal(p.$('#seller-result').textContent, '');
  assert.match(p.$('#seller-feedback').textContent, /ต้องส่งตรวจใหม่/);
});

test('seller handles broken draft storage without losing form access', (t) => {
  const p = seller(t, async () => ({ ok: true, json: async () => [] }), (window) => {
    window.localStorage.setItem('trustcart-seller-draft', '{broken');
    window.Storage.prototype.setItem = () => { throw Error('quota'); };
  });
  assert.equal(p.$('#submit-listing').disabled, false);
  p.$('#save-draft').click();
  assert.match(p.$('#seller-feedback').textContent, /ไม่สามารถบันทึก/);
});

for (const failure of [409, 500, 'malformed']) {
  test(`seller recovers controls and clears status after ${failure} response`, async (t) => {
    const p = seller(t, async (url, options) => {
      if (!options?.body) return { ok: true, json: async () => [] };
      return failure === 'malformed'
        ? { ok: true, json: async () => ({}) }
        : { ok: false, status: failure };
    });
    await p.submit();
    assert.equal(p.$('#seller-result').textContent, '');
    assert.match(p.$('#seller-feedback').textContent, failure === 409 ? /โหลดรายการล่าสุด/ : /ไม่สามารถ/);
    for (const control of p.dom.window.document.querySelectorAll('#seller-form input,#seller-form textarea,#seller-form select,#submit-listing,#save-draft,#new-product')) {
      assert.equal(control.disabled, false);
    }
    assert.equal(p.dom.window.sessionStorage.getItem('trustcart-demo-reports'), null);
  });
}

test('seller disables editing while submitting and restores it on completion', async (t) => {
  let finish;
  const p = seller(t, (url, options) => options?.body
    ? new Promise((resolve) => { finish = resolve; })
    : Promise.resolve({ ok: true, json: async () => [] }));
  await p.submit();
  assert.equal(p.$('#submit-listing').disabled, true);
  assert.equal(p.$('#listing-title').disabled, true);
  assert.equal(p.$('#new-product').disabled, true);
  finish({ ok: true, json: async () => productFixture });
  await settle();
  assert.equal(p.$('#listing-title').disabled, false);
  assert.match(p.$('#seller-result').textContent, /DENIED/);
  assert.equal(JSON.parse(p.dom.window.sessionStorage.getItem('trustcart-demo-reports'))[0].productId, 'seller-1');
  assert.ok(p.dom.window.localStorage.getItem('trustcart-products-updated'));
});

test('seller can cancel switching a dirty form, then load the saved product version', async (t) => {
  const calls = [];
  const p = seller(t, async (url) => {
    calls.push(url);
    return { ok: true, json: async () => url === '/v1/products' ? [productFixture] : productFixture };
  });
  await settle();
  p.$('#listing-title').value = 'Unsaved';
  p.$('#listing-title').dispatchEvent(new p.dom.window.Event('input', { bubbles: true }));
  p.dom.window.confirm = () => false;
  p.$('.seller-product-row').click();
  await settle();
  assert.equal(p.$('#listing-title').value, 'Unsaved');
  assert.deepEqual(calls, ['/v1/products']);
  p.dom.window.confirm = () => true;
  p.$('.seller-product-row').click();
  await settle();
  assert.equal(calls.at(-1), '/v1/products/seller-1');
  assert.equal(p.$('#listing-title').value, 'Saved title');
  assert.match(p.$('#seller-result').textContent, /DENIED/);
});

test('seller new-product confirmation preserves or resets unsaved fields', (t) => {
  const p = seller(t, async () => ({ ok: true, json: async () => [] }));
  const initial = p.$('#listing-title').value;
  p.$('#listing-title').value = 'Unsaved';
  p.$('#listing-title').dispatchEvent(new p.dom.window.Event('input', { bubbles: true }));
  p.dom.window.confirm = () => false;
  p.$('#new-product').click();
  assert.equal(p.$('#listing-title').value, 'Unsaved');
  p.dom.window.confirm = () => true;
  p.$('#new-product').click();
  assert.equal(p.$('#listing-title').value, initial);
  assert.equal(p.$('#seller-result').textContent, '');
});

test('seller ignores a late submitted report after the form changes', async (t) => {
  let finish;
  const p = seller(t, (url, options) => options?.body
    ? new Promise((resolve) => { finish = resolve; })
    : Promise.resolve({ ok: true, json: async () => [] }));
  await p.submit();
  p.$('#listing-title').dispatchEvent(new p.dom.window.Event('input', { bubbles: true }));
  finish({ ok: true, json: async () => productFixture });
  await settle();
  assert.equal(p.$('#seller-result').textContent, '');
  assert.match(p.$('#seller-feedback').textContent, /ต้องส่งตรวจใหม่/);
});

test('seller saves images price and stock and restores them for editing', async (t) => {
  let saved;
  const p = seller(t, async (url, options) => {
    if (!options?.body) return {ok:true, json:async()=>[]};
    saved = JSON.parse(options.body);
    return {ok:true,json:async()=>({id:'media-product',version:1,listing:saved,verification:{...result,listing:saved}})};
  });
  p.$('#listing-price').value = '299.50';
  p.$('#listing-stock').value = '7';
  const file = new p.dom.window.File(['local image'], 'product.png', {type:'image/png'});
  Object.defineProperty(p.$('#listing-images'), 'files', {value:[file]});
  p.$('#listing-images').dispatchEvent(new p.dom.window.Event('change', {bubbles:true}));
  await new Promise(r=>setTimeout(r,30));
  assert.equal(p.$('#image-previews img').src, 'data:image/png;base64,bG9jYWwgaW1hZ2U=');
  await p.submit();
  assert.equal(saved.price,'299.50');
  assert.equal(saved.stock,7);
  assert.equal(saved.images.length,1);
  p.$('#image-previews button').click();
  assert.equal(p.$('#image-previews img'),null);
  assert.equal(p.$('#seller-result').textContent,'');
  await p.submit();
  assert.deepEqual(saved.images,[]);
});

test('seller restores media draft and rejects unsupported files without losing images', async (t) => {
  let writes=0;
  const original='data:image/png;base64,bG9jYWwgaW1hZ2U=';
  const p=seller(t,async(url,options)=>{ if(options?.body) writes++; return {ok:true,json:async()=>[]}; },w=>{
    w.localStorage.setItem('trustcart-seller-draft',JSON.stringify({images:[original],price:'120.50',stock:4}));
  });
  assert.equal(p.$('#listing-price').value,'120.50');
  assert.equal(p.$('#listing-stock').value,'4');
  assert.equal(p.$('#image-previews img').getAttribute('src'),original);
  Object.defineProperty(p.$('#listing-images'),'files',{value:[new p.dom.window.File(['<svg/>'],'bad.svg',{type:'image/svg+xml'})]});
  p.$('#listing-images').dispatchEvent(new p.dom.window.Event('change',{bubbles:true}));
  await new Promise(r=>setImmediate(r));
  assert.equal(p.$('#image-previews img').getAttribute('src'),original);
  assert.match(p.$('#seller-feedback').textContent,/PNG/);
  assert.equal(p.$('#submit-listing').disabled,false);
  assert.equal(writes,0);
  p.$('#save-draft').click();
  assert.deepEqual(JSON.parse(p.dom.window.localStorage.getItem('trustcart-seller-draft')).images,[original]);
});

test('seller View product links use the saved product ID and remain tied to the published revision', async(t)=>{
  const p=seller(t,async(url,options)=> {
    if(!options?.body) return {ok:true,json:async()=>[]};
    const listing=JSON.parse(options.body);
    return {ok:true,json:async()=>({id:'saved-product',version:1,listing,verification:{...result,listing}})};
  });
  assert.equal(p.$('#view-product').hidden,true);
  assert.equal(p.$('#view-product').hasAttribute('href'),false);
  await p.submit();
  const view=p.$('#view-product');
  assert.equal(view.hidden,false);
  assert.equal(view.getAttribute('href'),'/products/saved-product');
  assert.equal(view.target,'_blank');
  assert.match(view.rel,/noopener/);
  assert.equal(p.$('.seller-view-product').getAttribute('href'),'/products/saved-product');
  p.$('#listing-price').value='700';
  p.$('#listing-price').dispatchEvent(new p.dom.window.Event('input',{bubbles:true}));
  assert.equal(view.getAttribute('href'),'/products/saved-product');
  p.dom.window.confirm=()=>true;
  p.$('#new-product').click();
  assert.equal(view.hidden,true);
  assert.equal(view.hasAttribute('href'),false);
});

test('seller product list exposes customer links only for stable products, not historical verification reports',async(t)=>{
  const p=seller(t,async(url)=>({ok:true,json:async()=>url==='/v1/products'?[productFixture]:productFixture}),w=>{
    w.sessionStorage.setItem('trustcart-demo-reports',JSON.stringify([{id:'legacy-verification',title:'Historical report',status:'DENIED'}]));
  });
  await settle();
  assert.equal(p.dom.window.document.querySelectorAll('.seller-view-product').length,1);
  assert.equal(p.$('.seller-view-product').getAttribute('href'),'/products/seller-1');
  p.$('.seller-product-row').click();
  await settle();
  assert.equal(p.$('#view-product').getAttribute('href'),'/products/seller-1');
});
