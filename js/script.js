'use strict';
const $ = selector => document.querySelector(selector);
const API = 'https://s.prod.supr.ninja/sw/v2/title';
const countries = {IN:'India',US:'United States',GB:'United Kingdom',CA:'Canada'};
let country = 'IN';
try { const saved = localStorage.getItem('selectedCountry'); if (countries[saved]) country = saved; } catch {}
$('#country-selector').value = country;
const cache = new Map();
const requests = {};
let searchVersion = 0, detailVersion = 0, searchTimer, items = [], filter = 'ALL', currentId = null, showDetails = null, activeSeasonId = null, lastFocus;
let discoveryVersion = 0, discoveryItems = [], discoveryOffset = 0;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function safeURL(value) { try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
function cancel(channel) { requests[channel]?.abort(); delete requests[channel]; }
async function request(path, channel, region = country, refresh = false) {
  cancel(channel);
  const key = region + path;
  const cached = cache.get(key);
  if (!refresh && cached && Date.now() - cached.savedAt < 300000) return cached.data;
  const controller = new AbortController(); requests[channel] = controller;
  const timeout = setTimeout(() => controller.abort(new Error('The request timed out. Please try again.')), 15000);
  try {
    // The upstream cache does not vary on X-country. Preserve the original
    // no-cache header and bypass the browser HTTP cache for regional requests.
    const response = await fetch(API + path, {
      headers: {'X-language':'en', 'X-country':region, 'Cache-Control':'no-cache'},
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) throw new Error('Could not reach the catalog. Please try again.');
    const data = await response.json();
    if (!data || typeof data !== 'object') throw new Error('The catalog returned an unexpected response.');
    if (cache.size > 80) cache.delete(cache.keys().next().value);
    cache.set(key, {data, savedAt: Date.now()}); return data;
  } finally { clearTimeout(timeout); if (requests[channel] === controller) delete requests[channel]; }
}
function hasProviders(details) {
  return ['flatrate', 'rent', 'buy', 'free', 'ads'].some(type => Array.isArray(details.providers?.[type]) && details.providers[type].length > 0);
}
async function findAvailability(id, selectedRegion, isCurrent, onProgress = () => {}) {
  const regions = [selectedRegion, ...Object.keys(countries).filter(region => region !== selectedRegion)];
  let firstDetails, selectedFailed = false;
  const failedRegions = [];
  for (const region of regions) {
    if (!isCurrent()) return null;
    onProgress(region);
    let details;
    try {
      details = await request('/' + encodeURIComponent(id) + '/detail', 'details', region);
      if (!details.title_content) throw new Error('Title details are unavailable. Please try again.');
    } catch (error) {
      if (!isCurrent() || error.name === 'AbortError') return null;
      failedRegions.push(region);
      if (region === selectedRegion) selectedFailed = true;
      continue;
    }
    if (!isCurrent()) return null;
    firstDetails ||= details;
    if (hasProviders(details)) return {...details, sourceCountry: region, selectedRegion, selectedFailed, failedRegions};
  }
  if (!firstDetails) throw new Error('Could not check availability. Please try again.');
  return {...firstDetails, sourceCountry: selectedRegion, selectedRegion, selectedFailed, failedRegions, noRegionalProviders: true};
}
function availabilityMessage(details) {
  const selected = countries[details.selectedRegion || country];
  const source = countries[details.sourceCountry || country];
  if (details.noRegionalProviders) return details.failedRegions?.length
    ? `No options found in the regions checked. Could not check ${details.failedRegions.map(region => countries[region]).join(', ')}. Please retry.`
    : 'No streaming, rental or purchase options listed in India, United States, United Kingdom or Canada.';
  if (details.sourceCountry && details.sourceCountry !== (details.selectedRegion || country)) return details.selectedFailed
    ? `Could not check ${selected}. Available in ${source}. These providers are for ${source}.`
    : `Not available in ${selected}. Available in ${source}. These providers are for ${source}.`;
  return `Availability in ${source}`;
}
function skeletons(count = 5) { return Array.from({length:count}, () => '<li aria-hidden="true"><div class="poster skeleton"></div><div class="skeleton skeleton-line"></div></li>').join(''); }
function tile(item) {
  return `<li><button class="title-card" data-id="${esc(item.id)}" data-title="${esc(item.title)}"><span class="poster">${safeURL(item.poster_url) ? `<img src="${esc(safeURL(item.poster_url))}" alt="${esc(item.title)}" loading="lazy" width="300" height="450">` : ''}</span><strong>${esc(item.title || 'Untitled')}</strong><small>${esc(item.release_year || 'Year unavailable')} / ${item.object_type === 'SHOW' ? 'TV SERIES' : 'FILM'} ↗</small></button></li>`;
}
function renderResults() {
  const visible = items.filter(item => filter === 'ALL' || item.object_type === filter);
  $('#dataList').innerHTML = visible.map(tile).join('');
  $('#result-status').textContent = `${visible.length} ${visible.length === 1 ? 'TITLE' : 'TITLES'} / ${countries[country].toUpperCase()}`;
  $('#result-notice').textContent = visible.length ? '' : 'No titles found. Try another title or a shorter search.';
}
async function search() {
  clearTimeout(searchTimer);
  const query = $('#input').value.trim();
  const version = ++searchVersion;
  cancel('search');
  if (!query) { resetSearch(); return; }
  $('#discovery').hidden = true; $('#search-results').hidden = false;
  $('#catalog-label').textContent = 'YOUR SEARCH'; $('#results-heading').textContent = `Results for “${query}”`;
  $('#result-status').textContent = 'SEARCHING THE CATALOG…'; $('#result-notice').textContent = '';
  $('#dataList').style.minHeight = Math.max(340, $('#dataList').offsetHeight) + 'px';
  if (!items.length) $('#dataList').innerHTML = skeletons();
  $('#dataList').setAttribute('aria-busy','true'); $('#search-form').classList.add('loading-bar');
  try {
    const data = await request('?q=' + encodeURIComponent(query), 'search');
    if (version !== searchVersion) return;
    if (!Array.isArray(data)) throw new Error('The catalog returned an unexpected response.');
    items = data; renderResults();
  } catch (error) {
    if (version !== searchVersion || error.name === 'AbortError') return;
    if (!items.length) $('#dataList').innerHTML = '';
    $('#result-status').textContent = 'CONNECTION INTERRUPTED';
    $('#result-notice').innerHTML = `${esc(error.message)} <button class="retry" id="retry-search">Try again</button>`;
  } finally {
    if (version === searchVersion) { $('#dataList').setAttribute('aria-busy','false'); $('#search-form').classList.remove('loading-bar'); }
  }
}
function selectDiscoveryTitles(data, offset = 0) {
  const seen = new Set();
  const unique = data.filter(item => {
    if (!item.id || !item.title || !safeURL(item.poster_url) || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  if (!unique.length) return [];
  const start = offset % unique.length;
  return [...unique.slice(start), ...unique.slice(0, start)].slice(0, 4);
}
function renderDiscovery() {
  const titles = selectDiscoveryTitles(discoveryItems, discoveryOffset);
  $('#discovery-grid').innerHTML = titles.map(item => `
    <button class="discovery-card" data-id="${esc(item.id)}" data-title="${esc(item.title)}">
      <img src="${esc(safeURL(item.poster_url))}" alt="" width="780" height="1170">
      <span class="card-top">${item.object_type === 'SHOW' ? 'TV SERIES' : 'FILM'} <b>↗</b></span>
      <span class="card-bottom"><small>${esc(item.release_year || 'EXPLORE THE CATALOG')}</small>
        <strong>${esc(item.title)}</strong><span>Find where to watch ↗</span></span>
    </button>`).join('');
  $('#discovery-status').textContent = titles.length
    ? `From the ${countries[country]} catalog. Select a title to check availability.`
    : `No discovery titles returned for ${countries[country]}. Try a search above.`;
  window.ScrollTrigger?.refresh();
}
async function loadDiscovery(refresh = false) {
  const version = ++discoveryVersion;
  const region = country;
  $('#discovery-status').textContent = `Finding titles in the ${countries[region]} catalog…`;
  $('#discovery-grid').setAttribute('aria-busy', 'true');
  $('#refresh-discovery').disabled = true;
  if (!discoveryItems.length) {
    $('#discovery-grid').innerHTML = Array.from({length:4}, () => '<div class="discovery-card skeleton" aria-hidden="true"></div>').join('');
  }
  try {
    const data = await request('?q=', 'discovery', region, refresh);
    if (version !== discoveryVersion) return;
    if (!Array.isArray(data)) throw new Error('The catalog returned an unexpected response.');
    discoveryOffset = refresh ? discoveryOffset + 4 : 0;
    discoveryItems = data;
    renderDiscovery();
  } catch (error) {
    if (version !== discoveryVersion || error.name === 'AbortError') return;
    if (!discoveryItems.length) $('#discovery-grid').innerHTML = '';
    $('#discovery-status').innerHTML = `Could not refresh the ${countries[region]} catalog. <button id="retry-discovery" class="retry">Try again</button>`;
  } finally {
    if (version === discoveryVersion) {
      $('#discovery-grid').setAttribute('aria-busy', 'false');
      $('#refresh-discovery').disabled = false;
    }
  }
}
function changeCountry(nextCountry) {
  if (!countries[nextCountry] || nextCountry === country) return;
  country = nextCountry;
  $('#country-selector').value = country;
  $('#detail-country-selector').value = country;
  try { localStorage.setItem('selectedCountry', country); } catch {}
  // Never leave discovery cards from the previous region labeled as the new one.
  discoveryItems = [];
  loadDiscovery();
  if ($('#input').value.trim()) search();
  if ($('#myModal').open && currentId) {
    loadDetails(activeSeasonId || currentId, Boolean(activeSeasonId));
  }
}
function resetSearch() {
  clearTimeout(searchTimer); ++searchVersion; cancel('search'); items = []; $('#input').value = '';
  $('#search-results').hidden = true; $('#discovery').hidden = false;
  $('#catalog-label').textContent = 'BREAK THE BROWSING LOOP'; $('#results-heading').textContent = 'Follow your curiosity.';
  $('#result-status').textContent = 'PICK A STARTING POINT ↙'; $('#search-form').classList.remove('loading-bar');
  window.ScrollTrigger?.refresh();
}
function detailSkeleton() { return '<div class="detail-header"><div class="detail-poster skeleton"></div><div><h2 id="modal-title">Finding your watch.</h2><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></div></div><div class="availability skeleton"></div>'; }
function openDialog() {
  if (!$('#myModal').open) { lastFocus = document.activeElement; $('#myModal').showModal(); document.body.style.overflow = 'hidden'; }
}
async function loadDetails(id, season = false) {
  const focusSeason = season && document.activeElement?.id !== 'detail-country-selector';
  const version = ++detailVersion; cancel('details'); cancel('related');
  openDialog();
  activeSeasonId = season ? id : null;
  if (!season) { currentId = id; showDetails = null; $('#detail-content').style.minHeight = ''; $('#detail-content').innerHTML = detailSkeleton(); $('#myModal').scrollTop = 0; $('#close-modal').focus(); }
  $('#detail-content').style.minHeight = Math.max(440, $('#detail-content').offsetHeight) + 'px'; $('#detail-content').setAttribute('aria-busy','true'); $('#detail-status').textContent = season ? 'Updating season availability…' : 'Checking availability in ' + countries[country] + '…';
  $('#detail-status').classList.add('loading-bar');
  try {
    const details = await findAvailability(id, country, () => version === detailVersion, region => {
      $('#detail-status').textContent = region === country
        ? 'Checking availability in ' + countries[region] + '…'
        : 'Checking other countries: ' + countries[region] + '…';
    });
    if (version !== detailVersion || !details) return;
    if (!details.title_content) throw new Error('Title details are unavailable. Please try again.');
    if (!season) showDetails = details;
    renderDetails(details, season, id);
    if (focusSeason) [...document.querySelectorAll('[data-season]')].find(button => button.dataset.season === String(id))?.focus({preventScroll:true});
    $('#detail-status').textContent = availabilityMessage(details);
    loadRelated(showDetails || details, version);
  } catch (error) {
    if (version !== detailVersion || error.name === 'AbortError') return;
    $('#detail-status').textContent = error.message;
    if (!season) $('#detail-content').innerHTML = `<div class="error-panel"><h2 id="modal-title">A brief intermission.</h2><p>We couldn’t load this title. Check your connection and try again.</p><button class="retry" data-retry="${esc(id)}">Try again</button></div>`;
    else $('#detail-status').innerHTML = `${esc(error.message)} <button class="retry" data-season="${esc(id)}">Retry season</button>`;
  } finally { if (version === detailVersion) { $('#detail-content').setAttribute('aria-busy','false'); $('#detail-status').classList.remove('loading-bar'); } }
}
let displayedProviders = {};
function renderDetails(details, season, id) {
  const title = details.title_content?.title || 'Untitled';
  const fullTitle = season ? `${showDetails.title_content.title} / ${title}` : title;
  document.title = fullTitle + ' — Where Can I Watch This?';
  const poster = safeURL(details.poster_url || details.title_content?.poster_url || showDetails?.poster_url || showDetails?.title_content?.poster_url);
  const seasons = [...(showDetails?.seasons || [])].sort((a,b) => a.season_number - b.season_number);
  displayedProviders = {};
  for (const type of ['flatrate','rent','buy','free','ads']) {
    const seen = new Set();
    displayedProviders[type] = (Array.isArray(details.providers?.[type]) ? details.providers[type] : []).filter(p => { if (seen.has(p.package_name)) return false; seen.add(p.package_name); return true; });
  }
  const types = Object.keys(displayedProviders).filter(key => displayedProviders[key].length);
  const clips = (details.clips || []).filter(c => /^[\w-]{6,20}$/.test(c.external_id)).slice(0,3);
  $('#detail-content').innerHTML = `<div class="detail-header">${poster ? `<img class="detail-poster" src="${esc(poster)}" alt="${esc(title)}" width="160" height="240">` : '<div class="detail-poster" aria-hidden="true"></div>'}<div><h2 id="modal-title">${esc(fullTitle)}</h2><p class="scores">IMDb ${esc(details.scores?.imdbScore ?? '—')} &nbsp; / &nbsp; TMDb ${esc(details.scores?.tmdbScore ?? '—')}</p><p class="summary">${esc(details.summary || 'No synopsis available for this title.')}</p></div></div>
  ${seasons.length ? `<div class="season-browser" aria-label="Choose season"><button class="season-chip ${season ? '' : 'active'}" data-show="true" aria-pressed="${!season}">Full show</button>${seasons.map(s => `<button class="season-chip ${season && String(s.id) === String(id) ? 'active' : ''}" data-season="${esc(s.id)}" aria-pressed="${season && String(s.id) === String(id)}">Season ${esc(s.season_number)}</button>`).join('')}</div>` : ''}
  <section class="availability"><h3>Here's where to watch.</h3><p class="region-note ${details.sourceCountry !== country || details.noRegionalProviders ? 'region-fallback' : ''}">${esc(availabilityMessage(details))}</p>${types.length ? `<p class="region-note">Options for ${countries[details.sourceCountry || country]}. Availability and prices may change.</p>` : ''}<div class="provider-tabs">${types.map((type,i) => `<button class="${i ? '' : 'active'}" data-provider="${type}" aria-pressed="${!i}">${{flatrate:'Stream',rent:'Rent',buy:'Buy',free:'Free',ads:'With ads'}[type]}</button>`).join('')}</div><div class="providers" id="providers">${types.length ? '' : '<p>No streaming, rental or purchase options listed in this region.</p>'}</div></section>
  ${clips.length ? `<h3>Before you press play.</h3><div class="trailers">${clips.map(c => `<a class="trailer" href="https://www.youtube.com/watch?v=${esc(c.external_id)}" target="_blank" rel="noopener noreferrer"><img src="https://img.youtube.com/vi/${esc(c.external_id)}/hqdefault.jpg" alt="${esc(c.name || 'Trailer')}" loading="lazy"><p>${esc(c.name || 'Watch trailer')} ↗</p></a>`).join('')}</div>` : ''}<section id="related-section" hidden><h3>Keep exploring.</h3><ul id="related-list" class="results-grid related"></ul></section>`;
  if (types.length) renderProviders(types[0]);
}
function renderProviders(type) {
  $('#providers').innerHTML = displayedProviders[type].map(p => { const link = safeURL(p.redirect_link); return `<${link ? 'a' : 'span'} class="provider" ${link ? `href="${esc(link)}" target="_blank" rel="noopener noreferrer"` : ''}>${safeURL(p.package_icon) ? `<img src="${esc(safeURL(p.package_icon))}" alt="" width="42" height="42">` : ''}<span>${esc(p.package_name || 'Streaming provider')} ${link ? '↗' : ''}</span></${link ? 'a' : 'span'}>`; }).join('');
  document.querySelectorAll('[data-provider]').forEach(b => { const active = b.dataset.provider === type; b.classList.toggle('active',active); b.setAttribute('aria-pressed',active); });
}
async function loadRelated(details, version) {
  try {
    const data = await request('?q=' + encodeURIComponent(details.title_content.title),'related');
    if (version !== detailVersion || !$('#myModal').open || !Array.isArray(data)) return;
    const related = data.filter(item => String(item.id) !== String(currentId)).slice(0,4);
    $('#related-list').innerHTML = related.map(tile).join(''); $('#related-section').hidden = !related.length;
  } catch { /* Related titles are optional; the main title stays available. */ }
}
function closeDetails(updateURL = true) {
  ++detailVersion; cancel('details'); cancel('related'); $('#myModal').close(); document.body.style.overflow = '';
  document.title = 'Where Can I Watch This?';
  if (updateURL && location.hash.startsWith('#movie/')) history.pushState({},'',location.pathname + location.search);
  lastFocus?.focus();
}
function navigateTitle(id,title) {
  history.pushState({},'', '#movie/' + encodeURIComponent(id) + '/' + encodeURIComponent((title || '').toLowerCase().replace(/\s+/g,'-'))); loadDetails(id);
}
function route() { const match = location.hash.match(/^#movie\/([^/]+)/); if (match) { try { loadDetails(decodeURIComponent(match[1])); } catch { closeDetails(); } } else if ($('#myModal').open) closeDetails(false); }
$('#search-form').addEventListener('submit', e => { e.preventDefault(); search(); });
$('#input').addEventListener('input', () => { clearTimeout(searchTimer); ++searchVersion; cancel('search'); if (!$('#input').value.trim()) resetSearch(); else searchTimer = setTimeout(search,350); });
$('#country-selector').addEventListener('change', event => changeCountry(event.target.value));
$('#detail-country-selector').value = country;
$('#detail-country-selector').addEventListener('change', event => changeCountry(event.target.value));
$('#reset-search').addEventListener('click',resetSearch);
$('#close-modal').addEventListener('click',() => closeDetails());
$('#myModal').addEventListener('cancel',e => { e.preventDefault(); closeDetails(); });
$('#myModal').addEventListener('click',e => { if(e.target === $('#myModal')) { const r = e.target.getBoundingClientRect(); if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDetails(); } });
document.addEventListener('click',e => {
  const button = e.target.closest('button'); if (!button) return;
  if (button.dataset.query) { $('#input').value = button.dataset.query; search(); }
  if (button.dataset.id) navigateTitle(button.dataset.id,button.dataset.title);
  if (button.dataset.filter) { filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('active',b === button); b.setAttribute('aria-pressed',b === button); }); renderResults(); }
  if (button.id === 'retry-search') search();
  if (button.id === 'refresh-discovery' || button.id === 'retry-discovery') loadDiscovery(true);
  if (button.dataset.retry) loadDetails(button.dataset.retry);
  if (button.dataset.season) loadDetails(button.dataset.season,true);
  if (button.dataset.show) loadDetails(currentId);
  if (button.dataset.provider) renderProviders(button.dataset.provider);
});
document.addEventListener('error', e => { if (e.target.tagName === 'IMG') { e.target.style.visibility = 'hidden'; } },true);
window.addEventListener('popstate',route);
window.addEventListener('hashchange',() => { if (location.hash.startsWith('#movie/') && !$('#myModal').open) route(); });
if (window.gsap && window.ScrollTrigger && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  gsap.registerPlugin(ScrollTrigger);
  gsap.from('.hero-title h1',{y:24,opacity:0,duration:.7,ease:'power3.out'});
  gsap.fromTo('.reveal-copy',{opacity:.15},{opacity:1,scrollTrigger:{trigger:'.manifesto',start:'top 85%',end:'center 70%',scrub:true}});
  gsap.fromTo('.film-window',{scale:.8},{scale:1,scrollTrigger:{trigger:'.manifesto-bottom',start:'top 95%',end:'top 65%',scrub:true}});
  gsap.to('.film-window',{opacity:.2,scrollTrigger:{trigger:'.manifesto-bottom',start:'top 30%',end:'bottom top',scrub:true}});
}
route();
loadDiscovery();
