const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const flush = () => new Promise(resolve => setImmediate(resolve));

async function seller(t) {
 const dom = new JSDOM(fs.readFileSync('frontend/seller.html', 'utf8'), {url:'http://localhost/seller',runScripts:'outside-only',pretendToBeVisual:true});
 t.after(()=>dom.window.close());
 const calls=[],timers=[];
 let record={id:'saved-product',version:1,listing:{title:'Saved listing',description:'Plain product copy',price:'199',stock:4,images:[]},verification:null,workflow:{stage:'NOT_REQUESTED'}};
 dom.window.setInterval=callback=>{timers.push(callback);return timers.length;};
 dom.window.TrustCartSession={ready:Promise.resolve({role:'seller',id:'seller1',shop_id:'shop1'}),api:async url=>{
  calls.push(url);
  return {json:async()=>url.endsWith('/demo-cases')?{}:url.endsWith('/subscription')?{active:false}:url==='/v1/seller/products'?[record]:record};
 }};
 dom.window.eval(fs.readFileSync('frontend/workflow.js','utf8'));
 await dom.window.eval(fs.readFileSync('frontend/seller-connected.js','utf8'));
 return {dom,calls,timers,$:s=>dom.window.document.querySelector(s),setRecord:value=>{record=value;},getRecord:()=>record};
}

test('seller idle time and window focus do not repeatedly fetch products or replace focused rows',async t=>{
 const p=await seller(t);
 const edit=p.$('.seller-product-row');edit.focus();
 for(const tick of p.timers){tick();await flush();}
 p.dom.window.dispatchEvent(new p.dom.window.Event('focus'));await flush();
 assert.equal(p.calls.filter(url=>url==='/v1/seller/products').length,1);
 assert.equal(p.dom.window.document.activeElement,edit);
 assert.equal(p.$('#listing-title').disabled,false);
});

test('seller explicitly refreshes saved products without discarding unsaved listing copy',async t=>{
 const p=await seller(t);
 const input=p.$('#listing-title');input.value='Unsaved title';input.dispatchEvent(new p.dom.window.Event('input',{bubbles:true}));
 p.setRecord({...p.getRecord(),listing:{...p.getRecord().listing,price:'249'}});
 const refresh=p.$('#refresh-seller-products');assert.ok(refresh,'Seller must have an explicit refresh action');
 refresh.click();await flush();
 assert.equal(p.calls.filter(url=>url==='/v1/seller/products').length,2);
 assert.equal(input.value,'Unsaved title');assert.match(p.$('#seller-product-list').textContent,/249/);
 assert.equal(refresh.disabled,false);
});

test('seller manual refresh displays current uncertainty without inventing approval',async t=>{
 const p=await seller(t);await p.$('.seller-product-row').onclick();
 const current=p.getRecord();p.setRecord({...current,workflow:{stage:'UNAVAILABLE'},verification:{listing_title:current.listing.title,status:'UNKNOWN',stage:'UNAVAILABLE',confidence:0,human_review_required:true,revision:1,documents:[],rule_results:[],trace:[],chain_hash:'latest'}});
 p.$('#refresh-seller-products').click();await flush();
 assert.match(p.$('#seller-result').textContent,/UNKNOWN/);assert.doesNotMatch(p.$('#seller-result').textContent,/APPROVED/);
});
