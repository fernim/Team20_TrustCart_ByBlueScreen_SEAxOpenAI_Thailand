const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
for(const role of ['guest','seller','reviewer']){
 test(`account menu omits demo home link and retains ${role} controls`,async t=>{
  const dom=new JSDOM('<nav class="integration-nav"></nav>',{url:'http://localhost',runScripts:'outside-only'});t.after(()=>dom.window.close());
  dom.window.fetch=async()=>({ok:true,json:async()=>({role,id:role,csrf_token:'test-csrf'})});
  dom.window.eval(fs.readFileSync('frontend/session.js','utf8'));await dom.window.TrustCartSession.ready;
  const nav=dom.window.document.querySelector('nav');
  assert.equal(nav.querySelector('a[href="/"]'),null);
  assert.doesNotMatch(nav.textContent,/Synthetic registry demo/);
  assert.ok(role==='guest'?nav.querySelector('a[href="/login"]'):nav.querySelector('button'));
  if(role==='seller')assert.ok(nav.querySelector('a[href="/seller"]'));
  if(role==='reviewer')assert.ok(nav.querySelector('a[href="/agency"]'));
 });
}
test('static page shells do not flash the removed demo menu link',()=>{
 for(const file of ['index','seller','reviewer'])assert.doesNotMatch(fs.readFileSync(`frontend/${file}.html`,'utf8'),/TrustCart · Synthetic registry demo/);
});
