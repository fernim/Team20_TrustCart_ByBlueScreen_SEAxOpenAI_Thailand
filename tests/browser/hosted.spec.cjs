const { test, expect } = require('@playwright/test');

test('hosted pages, assets and APIs require the demo login', async ({ playwright, baseURL }) => {
  const anonymous = await playwright.request.newContext({ baseURL, httpCredentials: undefined });
  try {
    for (const route of ['/', '/seller', '/reviewer', '/workspace', '/static/app.js', '/docs', '/v1/products', '/openapi.json']) {
      expect((await anonymous.get(route)).status()).toBe(401);
    }
  } finally { await anonymous.dispose(); }
});

test('hosted evidence, recheck, review and audit workflow', async ({ page, request }) => {
  await page.goto('/workspace');
  await page.locator('#scenario').selectOption('L1');
  await page.getByRole('button', { name: 'Verify listing', exact: true }).click();
  await expect(page.locator('#feedback')).toContainText('PENDING');
  const initial = JSON.parse(await page.locator('#selected-case').textContent());
  await page.getByRole('button', { name: 'Use synthetic sample files' }).click();
  await expect(page.locator('#feedback')).toContainText('Evidence hashes saved');
  const evidence = JSON.parse(await page.locator('#selected-case').textContent());
  expect(evidence.evidence).toHaveLength(2);
  await page.getByRole('button', { name: 'Recheck selected case' }).click();
  await expect(page.locator('#feedback')).toContainText('Recheck appended');
  const stale = await request.post('/v1/verifications/' + initial.id + '/review', {
    data: { chain_hash: evidence.chain_hash, decision: 'deny', note: 'Synthetic stale revision test' },
  });
  expect(stale.status()).toBe(409);
  await page.getByRole('tab', { name: 'Reviewer', exact: true }).click();
  await page.locator('#review-note').fill('Synthetic mismatch confirmed in hosted browser test');
  await page.locator('#deny').click();
  await expect(page.locator('#feedback')).toContainText('Human decision recorded');
  await expect(page.locator('#selected-summary')).toContainText('DENIED');
  await page.locator('#audit').click();
  await expect(page.locator('#feedback')).toHaveText('Audit chain valid.');
  await page.getByRole('tab', { name: 'Shopper', exact: true }).click();
  await page.locator('#lookup').click();
  await expect(page.locator('#feedback')).toContainText('Report loaded');
  await page.getByRole('tab', { name: 'Agency', exact: true }).click();
  await page.locator('#refresh-agency').click();
  await expect(page.locator('#agency-summary')).toContainText('"silent_passes": 0');
});

test('hosted outage, copy correction and authenticated docs', async ({ page }) => {
  await page.goto('/workspace');
  await page.locator('#registry').selectOption('true');
  await expect(page.locator('#metrics')).toContainText('Unknown20');
  await page.locator('#registry').selectOption('');
  await page.locator('#scenario').selectOption('L4');
  await page.getByRole('button', { name: 'Verify listing', exact: true }).click();
  await expect(page.locator('#feedback')).toContainText('DENIED');
  await page.locator('#suggest-copy').click();
  await expect(page.locator('#feedback')).toContainText('Screened template applied');
  await page.getByRole('button', { name: 'Verify listing', exact: true }).click();
  await expect(page.locator('#feedback')).toContainText('APPROVED');
  await page.goto('/docs');
  await expect(page.locator('.swagger-ui')).toBeVisible();
});
