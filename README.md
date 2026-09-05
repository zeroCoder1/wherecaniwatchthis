# Where Can I Watch This?

A brutalist movie and TV streaming finder. Built with static HTML, CSS, vanilla JavaScript and progressive GSAP motion; no build step required.

## Run locally

```sh
python3 -m http.server 4173
```

Open http://localhost:4173.

## Features

- Debounced title search, movie/TV filters and live API discovery tiles with an Explore more control.
- Synchronized homepage and dialog country selectors preserve the active season.
- Region-specific streaming, rental and purchase links for India, US, UK and Canada.
- Shareable title URLs, season browsing, trailers and related searches.
- Native accessible dialog with Escape dismissal, focus restoration and background scroll locking.
- Immediate skeletons, reserved media dimensions, retained results while refreshing, request cancellation and stale-response guards.
- Country-keyed five-minute in-memory cache, upstream/browser HTTP cache bypass, 15-second timeouts and in-place retries.
- Responsive layouts and reduced-motion support. Core functionality works without GSAP.

## Files

- `index.html`: page and dialog shell.
- `css/style.css`: responsive design and loading/motion styles.
- `js/script.js`: API, rendering, request lifecycle and navigation.
- `css/input.css` and `css/modal.css`: legacy styles, no longer loaded.

Availability uses the existing Supr API. Availability checks the selected country first, then other supported countries if no providers are listed. Alternate-country providers are clearly labeled, including for individual seasons. Failed regional checks are distinguished from confirmed empty results. Fonts, images and optional GSAP scripts load from external services. Discovery uses the API’s empty-query catalog response for the selected country. Titles, posters and release years are supplied by the API; Explore more refreshes that response and rotates through unique titles. Tiles open details directly and do not claim local streaming availability.

## Verification

```sh
node --test tests/*.test.cjs
node --check js/script.js
git diff --check
```

Browser checks cover live title search, details, rental tabs, related titles, season loading and mobile layout. The regional regression was reproduced and verified with Rick and Morty Season 9: no India providers, US fallback providers, and a switch to US that preserves Season 9. Discovery refresh and homepage country changes were also verified. Upstream provider accuracy remains dependent on the API.
