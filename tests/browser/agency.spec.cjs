const { test, expect } = require("@playwright/test");
async function login(page, role = "reviewer") {
  await page.goto("/login");
  await page.locator("#username").selectOption(role);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(
    role === "reviewer" ? /\/(agency|reviewer)$/ : /\/seller$/,
  );
}
test("Agency dashboard filters, languages and mobile layout", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.goto("/agency");
  await expect(page.locator("#queue-loading")).toBeHidden();
  await page.locator("#agency-language").selectOption("en");
  await expect(page.locator("h1")).toHaveText("Marketplace verification");
  await page.locator('[data-marketplace="lazada"]').click();
  await expect(page.locator("#queue-empty")).toBeVisible();
  await expect(page.locator("#queue-empty")).toContainText(
    "No Lazada submissions",
  );
  await page.locator('[data-queue="completed"]').click();
  await expect(page).toHaveURL(/work_queue=completed/);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator('[data-marketplace="lazada"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator("#clear-filters").click();
  await expect(page.locator('[data-queue="all"]')).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.locator("#agency-language").selectOption("th");
  await expect(page.locator("h1")).toContainText("การตรวจสอบ");
  await page.locator("#agency-language").focus();
  await expect(page.locator("#agency-language")).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("agency-dashboard.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

async function createCase(page, kind = "uncertain") {
  await login(page, "seller1");
  const account = await (await page.request.get("/v1/auth/me")).json();
  const headers = { "X-CSRF-Token": account.csrf_token };
  await page.request.post("/v1/seller/subscription/activate", { headers });
  const cases = await (await page.request.get("/v1/seller/demo-cases")).json();
  const product = await (
    await page.request.post("/v1/seller/products", {
      headers,
      data: cases[kind].listing,
    })
  ).json();
  let result = await (
    await page.request.post(
      "/v1/seller/products/" + product.id + "/submissions",
      { headers, data: { expected_version: 1 } },
    )
  ).json();
  for (const kindName of ["label", "certificate", "permit"]) {
    const response = await page.request.get(
      `/v1/seller/demo-cases/${kind}/${kindName}`,
    );
    result = await (
      await page.request.post(`/v1/seller/submissions/${result.id}/documents`, {
        headers,
        multipart: {
          kind: kindName,
          chain_hash: result.chain_hash,
          file: {
            name: kindName + ".pdf",
            mimeType: "application/pdf",
            buffer: await response.body(),
          },
        },
      })
    ).json();
  }
  result = await (
    await page.request.post(`/v1/seller/submissions/${result.id}/run`, {
      headers,
      data: { chain_hash: result.chain_hash, mode: "replay" },
    })
  ).json();
  return { product, result };
}

test("Agency report approves inspected evidence and synchronizes seller and shopper", async ({
  page,
}) => {
  const { product, result } = await createCase(page);
  await login(page);
  await page.goto("/agency?marketplace=shopee&work_queue=to_review");
  await page.locator("#agency-language").selectOption("en");
  await page.locator(`tr[data-submission="${result.id}"] .case-title`).click();
  await expect(page).toHaveURL(new RegExp("/agency/submissions/" + result.id));
  await expect(page.locator("#case-overview")).toContainText("Pending");
  await page.locator("#start-review").click();
  await expect(page.locator("#decision-form")).toBeVisible();
  const original = page.locator("#case-documents a").first();
  const [documentPage] = await Promise.all([
    page.waitForEvent("popup"),
    original.click(),
  ]);
  const originalResponse = await page.request.get(
    await original.getAttribute("href"),
  );
  expect(originalResponse.status()).toBe(200);
  expect(originalResponse.headers()["content-type"]).toContain(
    "application/pdf",
  );
  await documentPage.close();
  await page.locator("#review-note").fill("Inspected the original documents");
  await page.locator("#agency-language").selectOption("th");
  await expect(page.locator("#review-note")).toHaveValue(
    "Inspected the original documents",
  );
  await page.locator("#agency-language").selectOption("en");
  for (const key of [
    "product_name",
    "registration_reference",
    "license_holder",
  ])
    await page.locator("#confirm-" + key).fill(product.listing[key]);
  for (const check of await page.locator("#confirm-documents input").all())
    await check.check();
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.dismiss();
  });
  await page.locator("#refresh-report").click();
  await expect(page.locator("#review-note")).toHaveValue(
    "Inspected the original documents",
  );
  await page.screenshot({
    path: test.info().outputPath("agency-report.png"),
    fullPage: true,
  });
  await page.locator("button[value=approve]").click();
  await expect(page.locator("#report-feedback")).toContainText("Saved");
  await expect(page.locator("#case-overview")).toContainText("Approved");
  await expect(page.locator("#decision-replay-detail")).toContainText("Reviewer approved");
  await page.locator("#decision-replay-steps").getByRole("button", { name: "Listing submitted" }).click();
  await expect(page.locator("#decision-replay-detail")).toContainText("Listing submitted");
  await expect(page.locator("#decision-form")).toBeHidden();
  await page.locator("#back-to-queue").click();
  await expect(page).toHaveURL(/marketplace=shopee/);
  await expect(page.locator('[data-queue="to_review"]')).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.locator('[data-queue="completed"]').click();
  await expect(
    page.locator(`tr[data-submission="${result.id}"]`),
  ).toContainText("Approved");
  await page.screenshot({
    path: test.info().outputPath("agency-populated.png"),
    fullPage: true,
  });
  await page.goto("/products/" + product.id);
  await expect(page.locator("#product-detail .product-verified")).toBeVisible();
  await login(page, "seller1");
  const saved = await (
    await page.request.get("/v1/seller/products/" + product.id)
  ).json();
  expect(saved.verification.status).toBe("APPROVED");
  expect(
    (await page.request.get("/agency/submissions/" + result.id)).status(),
  ).toBe(403);
});

test("Agency deep link returns after sign in and stale review requires reload", async ({
  page,
  context,
}) => {
  const { result } = await createCase(page);
  await context.clearCookies();
  await page.goto(
    `/agency/submissions/${result.id}?marketplace=shopee&work_queue=to_review`,
  );
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.locator("#username").selectOption("reviewer");
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(new RegExp("/agency/submissions/" + result.id));
  await page.locator("#agency-language").selectOption("en");
  await expect(page.locator("#start-review")).toBeVisible();
  const account = await (await page.request.get("/v1/auth/me")).json();
  expect(
    (
      await page.request.post(
        `/v1/reviewer/submissions/${result.id}/start-review`,
        {
          headers: { "X-CSRF-Token": account.csrf_token },
          data: { chain_hash: result.chain_hash },
        },
      )
    ).status(),
  ).toBe(200);
  await page.locator("#start-review").click();
  await expect(page.locator("#report-error")).toContainText(
    "Refresh the report",
  );
  await expect(page.locator("#start-review")).toBeDisabled();
  await page.locator("#refresh-report").click();
  await expect(page.locator("#decision-form")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('Agency stays unchanged until manual Refresh', async ({page})=>{
 await page.clock.install();
 let requests=0;
 page.on('request',request=>{if(request.url().includes('/v1/reviewer/queue?'))requests++;});
 await login(page);
 await expect(page.locator('#queue-loading')).toBeHidden();
 await expect.poll(()=>requests).toBe(1);
 await page.clock.fastForward(31000);
 expect(requests).toBe(1);
 await page.locator('#refresh-queue').click();
 await expect.poll(()=>requests).toBe(2);
});
