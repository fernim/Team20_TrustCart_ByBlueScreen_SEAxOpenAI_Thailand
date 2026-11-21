const {test,expect}=require('@playwright/test');
test.beforeEach(async({page,context})=>{
 const response=await page.request.post('/v1/auth/login',{data:{username:'reviewer',password:process.env.TRUSTCART_REVIEWER_PASSWORD}});
 expect(response.status()).toBe(200);
 const account=await response.json();await context.setExtraHTTPHeaders({'X-CSRF-Token':account.csrf_token});
});

test('workspace ignores a stale online transaction response after enabling an outage', async ({page}) => {
  let releaseOnline;
  const holdOnline = new Promise(resolve => { releaseOnline = resolve; });
  await page.route(/\/v1\/demo\/transactions(?:\?.*)?$/, async route => {
    if (!route.request().url().includes('offline=true')) await holdOnline;
    await route.continue();
  });
  await page.goto('/workspace');
  await page.locator('#registry').selectOption('true');
  try {
    await expect(page.locator('#metrics .metric').filter({hasText:'Unknown'}).locator('b')).toHaveText('20');
  } finally {
    const online = page.waitForResponse(response => response.url().includes('/v1/demo/transactions') && !response.url().includes('offline=true'));
    releaseOnline();
    await (await online).finished();
  }
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator('#metrics .metric').filter({hasText:'Unknown'}).locator('b')).toHaveText('20');
});

test('workspace cannot mutate a stale selected case after a product lookup failure', async ({page}) => {
  const request=page.request;
  const created = await request.post('/v1/products',{data:{title:'Synthetic lookup test',description:'Product details ผลิตภัณฑ์เสริมอาหาร',
    category:'supplement',registration_reference:'DEMO-001',product_name:'Demo Supplement',license_holder:'Demo Brand',price:'100',stock:1}});
  const product = await created.json();
  await page.goto(`/workspace?product=${product.id}`);
  await expect(page.locator('#selected-case')).toContainText(product.verification.id);
  await page.route(`**/v1/products/${product.id}`, route => route.fulfill({status:404,contentType:'application/json',body:'{"detail":"Product not found"}'}));
  await page.locator('#load-workspace-product').click();
  await expect(page.locator('#feedback')).toContainText('Product not found');
  await expect(page.locator('#workspace-product-link')).toBeHidden();
  await page.locator('#recheck').click();
  await expect(page.locator('#feedback')).toContainText('Submit or load a case first');
  const unchanged = await (await request.get(`/v1/verifications/${product.verification.id}`)).json();
  expect(unchanged.chain_hash).toBe(product.verification.chain_hash);
});

test('workspace report lookup switches the linked product form and reload target', async ({page}) => {
  const request=page.request;
  const data={description:'Product details ผลิตภัณฑ์เสริมอาหาร',category:'supplement',registration_reference:'DEMO-001',product_name:'Demo Supplement',license_holder:'Demo Brand',price:'100',stock:1};
  const first=await (await request.post('/v1/products',{data:{...data,title:'Synthetic linked first'}})).json();
  const second=await (await request.post('/v1/products',{data:{...data,title:'Synthetic linked second'}})).json();
  await page.goto(`/workspace?product=${first.id}`);
  await expect(page.locator('#title')).toHaveValue('Synthetic linked first');
  await page.getByRole('tab',{name:'Shopper',exact:true}).click();
  await page.locator('#lookup-id').fill(second.verification.id);
  await page.locator('#lookup').click();
  await expect(page.locator('#feedback')).toContainText('Report loaded');
  await expect(page.locator('#title')).toHaveValue('Synthetic linked second');
  await expect(page).toHaveURL(new RegExp(`product=${second.id}$`));
  await page.reload();
  await expect(page.locator('#selected-case')).toContainText(second.verification.id);
});
