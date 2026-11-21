const { test, expect } = require("@playwright/test");
async function login(page, role) {
  await page.goto("/login");
  await page.locator("#username").selectOption(role);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(role === "reviewer" ? /\/agency$/ : /\/seller$/);
}
test("seller Submit for review runs both checks and Agency retains final approval", async ({
  page,
}) => {
  await login(page, "seller1");
  await expect(page.locator("#plan-status")).not.toHaveText("");
  if (await page.locator("#activate-plan").isEnabled()) {
    await page.locator("#verification-plan summary").click();
    await page.locator("#activate-plan").click();
    await expect(page.locator("#activate-plan")).toBeDisabled();
  }
  await page.locator("#demo-case").selectOption("clean");
  await page.locator("#load-demo").click();
  await page.locator("#submit-listing").click();
  await expect(page.locator("#view-product")).toBeVisible();
  const productURL = await page.locator("#view-product").getAttribute("href");
  await page.locator("#request-verification").click();
  await expect(page.locator("#run-check")).toBeDisabled();
  await page.locator("#demo-documents").click();
  await expect(page.locator("#run-check")).toBeEnabled();
  const requestPromise = page.waitForRequest((request) =>
    request.url().endsWith("/submit-review"),
  );
  await page.locator("#run-check").click();
  const request = await requestPromise;
  expect(request.postDataJSON()).toHaveProperty("chain_hash");
  expect(request.postDataJSON()).not.toHaveProperty("mode");
  await expect(page.locator("#seller-result")).toContainText("PENDING");
  await expect(page.locator("#seller-result")).toContainText(
    "Reviewer required",
  );
  await expect(
    page.locator('#seller-result .automated-checklist li[data-state="pass"]'),
  ).toHaveCount(2);
  await expect(page.locator("#seller-feedback")).toContainText(
    "sent to Agency",
  );
  await expect(page.locator("#run-check")).toBeDisabled();
  const record = await (
    await page.request.get("/v1/seller/products/" + productURL.split("/").pop())
  ).json();
  expect(record.verification.mode).toBe("live");
  expect(record.badge_eligible).toBe(false);
  await page.screenshot({
    path: test.info().outputPath("seller-submitted-checklist.png"),
    fullPage: true,
  });
  await page.goto(productURL);
  await expect(page.locator("#product-detail .product-verified")).toHaveCount(
    0,
  );
  await login(page, "reviewer");
  await page.locator("#agency-language").selectOption("en");
  await page
    .locator(`tr[data-submission="${record.verification.id}"] .case-title`)
    .click();
  await expect(
    page.locator('#case-checks .automated-checklist li[data-state="pass"]'),
  ).toHaveCount(2);
  await page.locator("#start-review").click();
  await expect(page.locator("#decision-form")).toBeVisible();
  for (const checkbox of await page.locator("#confirm-documents input").all())
    await checkbox.check();
  for (const key of [
    "product_name",
    "registration_reference",
    "license_holder",
  ])
    await page.locator("#confirm-" + key).fill(record.listing[key]);
  await page
    .locator("#review-note")
    .fill("Inspected original documents and checklist");
  await page.locator("button[value=approve]").click();
  await expect(page.locator("#case-overview")).toContainText("Approved");
  await page.goto(productURL);
  await expect(page.locator("#product-detail .product-verified")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
