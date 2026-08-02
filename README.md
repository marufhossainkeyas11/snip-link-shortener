# Snip — Link Shortener

A fast, no-login link shortener. Paste a long URL, get a short one instantly.
Deploys as a static site on GitHub Pages, and installs as a full PWA on
desktop and mobile straight from the browser — no app store needed.

History is kept in `localStorage` only. Nothing is sent anywhere except
the URL you're shortening, to the shortening API itself.

## Project structure

```
.
├── index.html      # App entry point
├── style.css
├── app.js
├── manifest.json    # PWA manifest
├── sw.js            # Service worker (offline shell caching)
└── icons/            # PWA icons (192/512, incl. maskable) + favicons
```

## Running locally

No build step — it's plain HTML/CSS/JS. Serve the folder with any static
server, e.g.:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Open `http://localhost:8000`. Note: the API call and service worker
registration both require `http(s)://`, so opening `index.html` directly
via `file://` won't fully work.

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. Repo **Settings → Pages** → Source: `Deploy from a branch` → Branch:
   `main` (or `master`) / root.
3. Live at `https://<username>.github.io/<repo>/`.

Everything uses relative paths (`./manifest.json`, `./sw.js`, etc.), so it
works correctly whether served from a domain root or a sub-path like
GitHub Pages' `/repo-name/`. No path rewriting needed, and renaming the
repo later requires no code changes.

## Installing as a PWA

Once deployed (must be HTTPS — GitHub Pages is), visiting the site on:

- **Chrome/Edge desktop**: an install icon appears in the address bar, or
  use the in-page "Install app" button once the browser fires
  `beforeinstallprompt`.
- **Android Chrome**: "Add to Home screen" from the browser menu.
- **iOS Safari**: Share → "Add to Home Screen" (iOS doesn't support the
  `beforeinstallprompt` event, so the in-page install button won't show —
  a platform limitation, not a bug).

## Configuring a different shortener API

Set near the top of `app.js`:

```js
const SHORTEN_API = 'https://round-bonus-4d76.marufhossainkeyas.workers.dev/';
```

Contract expected: `GET {SHORTEN_API}?url=<encoded-url>` → plain-text
response starting with `http` (the short link).

## Notes

- `sw.js` caches only the static shell — the shortening API call always
  goes live to the network, never cached.
- Bump `CACHE_VERSION` in `sw.js` on any deploy that changes cached files,
  or returning visitors may keep seeing a stale shell.
- History is capped at 100 entries (see `HISTORY_MAX` in `app.js`).
