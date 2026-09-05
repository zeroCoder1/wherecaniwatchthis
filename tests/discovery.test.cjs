const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('js/script.js', 'utf8');
const context = vm.createContext({URL});
vm.runInContext(source.slice(source.indexOf('function safeURL('),source.indexOf('function cancel(')) + source.slice(source.indexOf('function selectDiscoveryTitles('),source.indexOf('function renderDiscovery(')) + ';this.selectTitles=selectDiscoveryTitles;',context);
const titles = Array.from({length:8},(_,i)=>({id:'title-'+i,title:'API title '+i,poster_url:'https://example.test/'+i+'.jpg'}));
test('discovery uses API titles and rotates to a new batch',()=>{
  assert.deepEqual(Array.from(context.selectTitles(titles),item=>item.id),titles.slice(0,4).map(item=>item.id));
  assert.deepEqual(Array.from(context.selectTitles(titles,4),item=>item.id),titles.slice(4).map(item=>item.id));
});
test('discovery removes duplicates and unusable API records',()=>{
  const result=context.selectTitles([{},titles[0],titles[0],{id:'invalid',title:'Invalid',poster_url:'javascript:alert(1)'},titles[1]]);
  assert.deepEqual(Array.from(result,item=>item.id),['title-0','title-1']);
});
test('empty discovery data yields an empty list, not hardcoded titles',()=>{
  assert.equal(context.selectTitles([]).length,0);
});
test('country change synchronizes both selectors and preserves the open season',()=>{
  const elements={
    '#country-selector':{}, '#detail-country-selector':{}, '#input':{value:'Rick and Morty'}, '#myModal':{open:true}
  };
  const calls=[];
  const h=vm.createContext({$:selector=>elements[selector],localStorage:{setItem:(...args)=>calls.push(['saved',...args])},loadDiscovery:()=>calls.push(['discovery']),search:()=>calls.push(['search']),loadDetails:(...args)=>calls.push(['details',...args])});
  vm.runInContext("const countries={IN:'India',US:'United States'};let country='IN',discoveryItems=[{}],currentId='ts20233',activeSeasonId='tss506444';"+source.slice(source.indexOf('function changeCountry('),source.indexOf('function resetSearch('))+";changeCountry('US');",h);
  assert.equal(elements['#country-selector'].value,'US');
  assert.equal(elements['#detail-country-selector'].value,'US');
  assert.deepEqual(calls,[['saved','selectedCountry','US'],['discovery'],['search'],['details','tss506444',true]]);
});
