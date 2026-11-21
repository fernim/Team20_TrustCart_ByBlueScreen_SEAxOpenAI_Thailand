const { test, expect, request: playwrightRequest } = require("@playwright/test");
async function login(page, role) {
  await page.goto("/login");
  await page.locator("#username").selectOption(role);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(
    role === "reviewer"
      ? /\/agency$/
      : role === "buyer"
        ? /\/$/
        : /\/seller$/,
  );
}
async function fixture(page, kind = "clean") {
  await login(page, "seller1");
  const activate = page.locator("#activate-plan");
  await expect(page.locator("#plan-status")).not.toHaveText("");
  if (await activate.isEnabled()) {
    await page.locator("#verification-plan summary").click();
    await activate.click();
  }
  await expect(activate).toBeDisabled();
  await page.locator("#demo-case").selectOption(kind);
  await page.locator("#load-demo").click();
  await page.locator("#submit-listing").click();
  await expect(page.locator("#view-product")).toBeVisible();
  const href = await page.locator("#view-product").getAttribute("href");
  await page.locator("#request-verification").click();
  await expect(page.locator("#document-form")).toBeVisible();
  await page.locator("#demo-documents").click();
  await expect(page.locator("#seller-feedback")).toContainText(
    "Synthetic sample documents uploaded",
  );
  await page.locator("details").filter({has: page.locator("#run-replay-check")}).locator("summary").click();
  await page.locator("#run-replay-check").click();
  await expect(page.locator("#seller-feedback")).toContainText(
    "Check complete",
  );
  if (kind === "clean") {
    // A badge fixture now requires an explicit decision by a separate reviewer session.
    const saved = await (await page.request.get("/v1/seller/products/" + href.split("/").pop())).json();
    const reviewer = await playwrightRequest.newContext({baseURL: new URL(page.url()).origin});
    try {
      const account = await (await reviewer.post("/v1/auth/login", {data: {username: "reviewer"}})).json();
      const headers = {"X-CSRF-Token": account.csrf_token};
      const started = await (await reviewer.post("/v1/reviewer/submissions/" + saved.verification.id + "/start-review", {headers, data: {chain_hash: saved.verification.chain_hash}})).json();
      const decision = await reviewer.post("/v1/reviewer/submissions/" + started.id + "/decision", {headers, data: {
        chain_hash: started.chain_hash, decision: "approve", note: "Inspected synthetic original documents",
        confirmed_documents: started.documents.map(doc => doc.id),
        confirmed_fields: Object.fromEntries(["product_name", "registration_reference", "license_holder"].map(key => [key, saved.listing[key]])),
      }});
      expect(decision.status()).toBe(200);
    } finally { await reviewer.dispose(); }
    await page.locator("#refresh-verification").click();
    await expect(page.locator("#seller-result")).toContainText("APPROVED");
  }
  return href;
}
test("seller publishes a normal listing without subscribing or uploading documents", async ({
  page,
}) => {
  await login(page, "seller2");
  await page.locator("#listing-title").fill("Ordinary product " + Date.now());
  await page.locator("#listing-price").fill("249");
  await page.locator("#listing-stock").fill("7");
  await page.locator("#submit-listing").click();
  await expect(page.locator("#seller-feedback")).toContainText("Product published");
  const href = await page.locator("#view-product").getAttribute("href");
  await page.goto(href);
  await expect(page.locator("#product-detail")).toBeVisible();
  await expect(page.locator("#product-detail .product-verified")).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
});
test("approved fixture has clickable badge; editing removes it", async ({
  page,
}) => {
  const href = await fixture(page);
  await expect(page.locator("#seller-result")).toContainText("APPROVED");
  await page.goto(href);
  await expect(page.locator("#product-detail")).toBeVisible();
  const badge = page.locator("#product-detail .product-verified");
  await expect(badge).toBeVisible();
  await badge.click();
  await expect(page.locator("#product-status-dialog")).toBeVisible();
  await expect(page.locator("#product-status-dialog")).not.toContainText(
    "chain_hash",
  );
  await page.goto("/seller");
  await page
    .locator(
      `.seller-product-entry[data-product="${href.split("/").pop()}"] button`,
    )
    .click();
  await page.locator("#listing-title").fill("Edited product");
  await page.locator("#submit-listing").click();
  await expect(page.locator("#seller-feedback")).toContainText("Product published");
  await page.goto(href);
  await expect(page.locator("#product-detail")).toBeVisible();
  await expect(page.locator("#product-detail .product-verified")).toHaveCount(
    0,
  );
});
test("uncertain documents reach reviewer, request returns to seller with retained history", async ({
  page,
}) => {
  const href = await fixture(page, "uncertain");
  await expect(page.locator("#seller-result")).toContainText(
    "Reviewer required",
  );
  await login(page, "reviewer");
  await page.locator("#agency-language").selectOption("en");
  // Resolve the exact product's active submission to avoid earlier test cases.
  const items = await (await page.request.get("/v1/reviewer/queue")).json();
  const submission = items.items.find(item => item.product_id === href.split("/").pop());
  await page.locator(`tr[data-submission="${submission.id}"] .case-title`).click();
  await expect(page.locator("#case-findings")).toContainText("Extraction confidence");
  await page.locator("#start-review").click();
  await expect(page.locator("#decision-form")).toBeVisible();
  await page.locator("#review-note").fill("Please upload a clearer label");
  await page.locator("button[value=request_documents]").click();
  await expect(page.locator("#case-overview")).toContainText("Awaiting seller correction");
  await login(page, "seller1");
  await page
    .locator(
      `.seller-product-entry[data-product="${href.split("/").pop()}"] button`,
    )
    .click();
  await expect(page.locator("#seller-result")).toContainText(
    "Please upload a clearer label",
  );
  await page.locator("#request-verification").click();
  await expect(page.locator("#document-form")).toBeVisible();
  await page.locator("#show-history").click();
  await expect(page.locator("#submission-history > details")).toHaveCount(2);
});
test("prohibited claim is denied without customer badge", async ({ page }) => {
  const href = await fixture(page, "overclaim");
  await expect(page.locator("#seller-result")).toContainText("DENIED");
  await page.goto(href);
  await expect(page.locator("#product-detail")).toBeVisible();
  await expect(page.locator("#product-detail .product-verified")).toHaveCount(
    0,
  );
});
test("role screens retain Shopee theme and fit the viewport", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const role of ["seller1", "reviewer"]) {
    await login(page, role);
    await expect(page.locator(role === "reviewer" ? "#agency-account" : ".integration-nav")).toContainText(role);
    await expect(page.getByRole("link", {name: "TrustCart · Synthetic registry demo", exact: true})).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--brand-primary")
          .trim(),
      ),
    ).toBe("#ee4d2d");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: test.info().outputPath(role + ".png"),
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
test("seller uploads images and edits price and stock on the same public page", async ({
  page,
}) => {
  await login(page, "seller2");
  const title = "Media listing " + Date.now();
  await page.locator("#listing-title").fill(title);
  await page.locator("#listing-price").fill("259.50");
  await page.locator("#listing-stock").fill("8");
  await page
    .locator("#listing-images")
    .setInputFiles(["frontend/assets/demo-supplement.png"]);
  await expect(page.locator("#image-previews img")).toHaveCount(1);
  await page.locator("#submit-listing").click();
  await expect(page.locator("#seller-feedback")).toContainText("Product published");
  const href = await page.locator("#view-product").getAttribute("href");
  await page.goto(href);
  await expect(page.locator("#product-title")).toHaveText(title);
  await expect(page.locator("#product-detail")).toContainText("259.5");
  await expect(page.locator("#product-detail img").first()).toBeVisible();
  await expect(page.locator("#detail-reviews")).toContainText("ยังไม่มี");
  await page.goto("/seller");
  await page
    .locator(
      `.seller-product-entry[data-product="${href.split("/").pop()}"] button`,
    )
    .click();
  await page.locator("#listing-stock").fill("0");
  await page.locator("#listing-price").fill("149");
  await page.locator("#submit-listing").click();
  await expect(page.locator("#seller-feedback")).toContainText("Product published");
  await page.goto(href);
  await expect(page.locator("#product-detail")).toContainText("149");
  await expect(page.locator("#add-to-cart")).toBeDisabled();
});

test('subscription offer lives top right and disappears for active sellers',async({page})=>{
 let active=false;
 await page.route('**/v1/seller/subscription',route=>route.fulfill({json:{active,active_until:active?'2026-12-21T00:00:00Z':null}}));
 await page.route('**/v1/seller/subscription/activate',route=>{active=true;return route.fulfill({json:{active:true}});});
 await login(page,'seller2');
 const menu=page.locator('header #verification-plan');await expect(menu).toBeVisible();await expect(page.locator('main #verification-plan')).toHaveCount(0);
 await menu.locator('summary').click();await expect(page.locator('#activate-plan')).toBeVisible();
 const panel=await page.locator('.seller-plan-panel').boundingBox();expect(panel.x).toBeGreaterThanOrEqual(0);expect(panel.x+panel.width).toBeLessThanOrEqual(page.viewportSize().width);
 await page.locator('#activate-plan').click();await expect(menu).toBeHidden();
 await page.reload();await expect(page.locator('#plan-status')).toContainText('Active until');await expect(menu).toBeHidden();
});

test('publish confirmation remains visible when optional verification waits for documents',async({page})=>{
 await login(page,'seller1');
 await expect(page.locator('#plan-status')).not.toHaveText('');
 if(await page.locator('#activate-plan').isEnabled()){await page.locator('#verification-plan summary').click();await page.locator('#activate-plan').click();await expect(page.locator('#activate-plan')).toBeDisabled();}
 await page.locator('#listing-title').fill('Published while awaiting documents');await page.locator('#listing-stock').fill('100');await page.locator('#verify-on-save').check();await page.locator('#submit-listing').click();
 await expect(page.locator('#seller-result')).toContainText('Waiting for documents');
 await expect(page.locator('#seller-feedback')).toContainText('Product published');
 const href=await page.locator('#view-product').getAttribute('href');await page.goto(href);await expect(page.locator('#product-title')).toHaveText('Published while awaiting documents');
});

test('a verification error does not hide successful publication',async({page})=>{
 await login(page,'seller2');await page.route('**/v1/seller/products/*/submissions',route=>route.fulfill({status:403,json:{detail:'Activate the demo verification plan first'}}));
 await page.locator('#listing-title').fill('Published without verification plan');await page.locator('#verify-on-save').check();await page.locator('#submit-listing').click();
 await expect(page.locator('#seller-feedback')).toContainText('Product published');await expect(page.locator('#seller-feedback')).toContainText('Verification could not start');
 const href=await page.locator('#view-product').getAttribute('href');await page.goto(href);await expect(page.locator('#product-title')).toHaveText('Published without verification plan');
});
