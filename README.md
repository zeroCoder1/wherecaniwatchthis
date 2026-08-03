# Where Can I Watch This?

A lightweight web app for searching a movie or TV show and seeing where it is available to stream in supported countries.

## What It Does

- Search for a title and view availability details.
- Switch between countries to see region-specific streaming results.
- Browse provider options, trailers, seasons, and related titles inside the modal.
- Share titles with URL-based routing.

## Tech Stack

- HTML
- CSS
- Vanilla JavaScript
- jQuery for DOM helpers and event delegation

## Running Locally

This is a static site, so you can open `index.html` directly in a browser.

For a better local workflow, serve the folder with any static file server, for example:

```bash
npx serve .
```

Then open the local URL printed in the terminal.

## Project Structure

- `index.html` - main page markup and script/style links
- `css/style.css` - base layout and page styles
- `css/input.css` - search and input styling
- `css/modal.css` - modal layout and detail view styles
- `js/script.js` - search, routing, modal rendering, and API calls

## Notes

- Country selection is persisted in `localStorage`.
- The app uses remote API data for title details, providers, trailers, and suggestions.
- Performance is better as a static site than by moving this code to a heavier framework unless the app grows much larger.

## Credits

Built for the Supr•Design project.
