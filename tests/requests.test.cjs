const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('js/script.js','utf8');
function harness(fetch) {
  const context = vm.createContext({fetch, AbortController, URL, setTimeout, clearTimeout, Map, Error});
  vm.runInContext("const countries={IN:'India',US:'United States',GB:'United Kingdom',CA:'Canada'};const API='https://example.test'; let country='IN'; const cache=new Map(); const requests={};" + source.slice(source.indexOf('function cancel('),source.indexOf('function skeletons(')) + ';this.findAvailability=findAvailability;this.availabilityMessage=availabilityMessage;this.request=request;this.setCountry=value=>country=value;',context);
  return context;
}
test('requests reuse cached responses and isolate countries',async()=>{
  let calls=0; const h=harness(async()=>({ok:true,json:async()=>({call:++calls})}));
  assert.equal((await h.request('/a','details')).call,1);
  assert.equal((await h.request('/a','details')).call,1);
  h.setCountry('US'); assert.equal((await h.request('/a','details')).call,2);
});
test('new request cancels only the superseded channel',async()=>{
  const pending=[]; const h=harness((url,{signal})=>new Promise((resolve,reject)=>{
    signal.addEventListener('abort',()=>reject(signal.reason)); pending.push({signal,resolve});
  }));
  const first=h.request('/old','search'); const rejection=assert.rejects(first,{name:'AbortError'});
  const detail=h.request('/detail','details'); const latest=h.request('/new','search');
  assert.equal(pending[0].signal.aborted,true); assert.equal(pending[1].signal.aborted,false);
  pending[1].resolve({ok:true,json:async()=>({title:'detail'})}); pending[2].resolve({ok:true,json:async()=>[]});
  await Promise.all([rejection,detail,latest]);
});
test('HTTP failures are recoverable and never cached',async()=>{
  let calls=0; const h=harness(async()=>({ok:++calls>1,json:async()=>[]}));
  await assert.rejects(h.request('/a','search'),/Could not reach/);
  await h.request('/a','search'); assert.equal(calls,2);
});
const detail = (available = false) => ({title_content:{title:'Example'},providers:available ? {flatrate:[{package_name:'Example provider'}]} : {}});
test('selected-country providers avoid unnecessary fallback requests', async () => {
  const visited=[];
  const h=harness(async(_url,{headers})=>{visited.push(headers['X-country']);return {ok:true,json:async()=>detail(true)};});
  const result=await h.findAvailability('show','GB',()=>true);
  assert.deepEqual(visited,['GB']); assert.equal(result.sourceCountry,'GB');
});
test('missing selected-country providers fall back with explicit country attribution', async () => {
  const visited=[];
  const h=harness(async(_url,{headers})=>{const region=headers['X-country'];visited.push(region);return {ok:true,json:async()=>detail(region==='US')};});
  const result=await h.findAvailability('season','IN',()=>true);
  assert.deepEqual(visited,['IN','US']); assert.equal(result.sourceCountry,'US');
  assert.match(h.availabilityMessage(result),/Not available in India. Available in United States/);
});
test('all regions empty preserve the title and explain the scope checked',async()=>{
  const h=harness(async()=>({ok:true,json:async()=>detail()}));
  const result=await h.findAvailability('show','CA',()=>true);
  assert.equal(result.title_content.title,'Example'); assert.equal(result.noRegionalProviders,true);
  assert.match(h.availabilityMessage(result),/India, United States, United Kingdom or Canada/);
});
test('network failure is not described as regional unavailability',async()=>{
  const h=harness(async(_url,{headers})=>({ok:headers['X-country']!=='IN',json:async()=>detail(true)}));
  const result=await h.findAvailability('show','IN',()=>true);
  assert.match(h.availabilityMessage(result),/Could not check India. Available in United States/);
});
test('stale fallback does not continue checking countries',async()=>{
  let current=true,calls=0;
  const h=harness(async()=>{calls++;current=false;return {ok:true,json:async()=>detail()};});
  assert.equal(await h.findAvailability('show','IN',()=>current),null); assert.equal(calls,1);
});
test('regional fetches bypass the upstream cache that ignores X-country', async () => {
  const options=[];
  const h=harness(async(_url,init)=>{
    options.push(init);
    // Models the observed failure: the shared cached response contains US providers.
    const region=init.headers['Cache-Control']==='no-cache' ? init.headers['X-country'] : 'US';
    return {ok:true,json:async()=>detail(region==='US')};
  });
  const result=await h.findAvailability('tss506444','IN',()=>true);
  assert.equal(options.length,2);
  assert.equal(result.sourceCountry,'US');
  for (const option of options) {
    assert.equal(option.cache,'no-store');
    assert.equal(option.headers['Cache-Control'],'no-cache');
  }
  assert.match(h.availabilityMessage(result),/Not available in India/);
});
test('forced refresh bypasses only the app cache for its region', async () => {
  let calls=0;
  const h=harness(async()=>({ok:true,json:async()=>({call:++calls})}));
  await h.request('?q=','discovery','IN');
  assert.equal((await h.request('?q=','discovery','IN',true)).call,2);
  assert.equal((await h.request('?q=','discovery','IN')).call,2);
  assert.equal((await h.request('?q=','discovery','US')).call,3);
});
test('free and ad-supported availability is not incorrectly treated as unavailable', async () => {
  for (const type of ['free','ads']) {
    let calls=0;
    const h=harness(async()=>{calls++;return {ok:true,json:async()=>({title_content:{title:'Example'},providers:{[type]:[{package_name:'Example'}]}})};});
    const result=await h.findAvailability('show','IN',()=>true);
    assert.equal(calls,1);assert.equal(result.sourceCountry,'IN');
  }
});
