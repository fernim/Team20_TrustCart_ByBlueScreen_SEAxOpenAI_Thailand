const {test,expect}=require('@playwright/test');
test('public catalog is browsable while private APIs require a role session',async({request})=>{
 for(const path of ['/','/products/0','/static/app.js','/v1/catalog/products'])expect((await request.get(path)).status()).toBe(200);
 for(const path of ['/v1/seller/products','/v1/reviewer/submissions','/v1/products'])expect((await request.get(path)).status()).toBe(401);
 expect((await request.get('/seller',{maxRedirects:0})).status()).toBe(303);
});
