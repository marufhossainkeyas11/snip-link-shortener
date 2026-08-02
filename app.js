/* ═══════════════════════════════════════════════════════
   SNIP — app.js
   Talks to the shortening API, keeps history in localStorage,
   handles PWA install prompt + copy/share UX.
   ═══════════════════════════════════════════════════════ */

const SHORTEN_API = 'https://round-bonus-4d76.marufhossainkeyas.workers.dev/';
const HISTORY_KEY = 'snip_history_v1';
const HISTORY_MAX = 100;

/* ── DOM refs ── */
const $ = id => document.getElementById(id);
const form = $('shortenForm');
const urlInput = $('urlInput');
const shortenBtn = $('shortenBtn');
const btnLabel = shortenBtn.querySelector('.btn-label');
const btnSpinner = shortenBtn.querySelector('.btn-spinner');
const formError = $('formError');

const resultCard = $('resultCard');
const resultBase = $('resultBase');
const resultHash = $('resultHash');
const resultSource = $('resultSource');
const copyBtn = $('copyBtn');
const openBtn = $('openBtn');

const historyList = $('historyList');
const historyEmpty = $('historyEmpty');
const clearHistoryBtn = $('clearHistory');

const toastEl = $('toast');

/* ═══════════════════════════════════════════════════════
   HISTORY (localStorage)
   ═══════════════════════════════════════════════════════ */
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveHistory(list) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
  } catch (e) {
    // Storage full or unavailable (private mode) — fail silently,
    // shortening itself still works without history.
    console.warn('[snip] Could not save history:', e.message);
  }
}

function addToHistory(entry) {
  const list = loadHistory();
  list.unshift(entry);
  saveHistory(list);
  renderHistory();
}

function removeFromHistory(id) {
  const list = loadHistory().filter(e => e.id !== id);
  saveHistory(list);
  renderHistory();
}

function clearAllHistory() {
  saveHistory([]);
  renderHistory();
}

/* ═══════════════════════════════════════════════════════
   SHORTEN — talk to the Worker API
   ═══════════════════════════════════════════════════════ */
function normalizeUrl(raw) {
  let v = raw.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try {
    const u = new URL(v);
    if (!u.hostname.includes('.')) return null;
    return u.href;
  } catch {
    return null;
  }
}

async function shortenUrl(longUrl) {
  const res = await fetch(`${SHORTEN_API}?url=${encodeURIComponent(longUrl)}`);
  if (!res.ok) throw new Error(`API responded ${res.status}`);
  const text = (await res.text()).trim();
  if (!text.startsWith('http')) throw new Error('API did not return a valid short link');
  return text;
}

function splitShortUrl(shortUrl) {
  // Style the last path segment as the "hash" — the compressed part —
  // and everything before it as the muted base. Falls back gracefully
  // if the short URL has no path segment to split on.
  try {
    const u = new URL(shortUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return { base: u.origin + '/', hash: '' };
    const last = parts.pop();
    const base = u.origin + (parts.length ? '/' + parts.join('/') + '/' : '/');
    return { base, hash: last };
  } catch {
    return { base: shortUrl, hash: '' };
  }
}

function setLoading(isLoading) {
  shortenBtn.disabled = isLoading;
  btnLabel.hidden = isLoading;
  btnSpinner.hidden = !isLoading;
}

function showFormError(msg) {
  formError.textContent = msg;
  formError.hidden = !msg;
}

async function handleSubmit(e) {
  e.preventDefault();
  showFormError('');

  const longUrl = normalizeUrl(urlInput.value);
  if (!longUrl) {
    showFormError('That doesn\u2019t look like a valid URL.');
    urlInput.focus();
    return;
  }

  setLoading(true);
  resultCard.hidden = true;

  try {
    const shortUrl = await shortenUrl(longUrl);
    const { base, hash } = splitShortUrl(shortUrl);

    resultBase.textContent = base;
    resultHash.textContent = hash;
    resultSource.textContent = longUrl;
    openBtn.href = shortUrl;
    resultCard.hidden = false;
    copyBtn.classList.remove('copied');
    copyBtn.textContent = 'Copy';

    addToHistory({
      id: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
      short: shortUrl,
      original: longUrl,
      ts: Date.now(),
    });

    urlInput.value = '';
  } catch (err) {
    console.error('[snip] Shorten failed:', err);
    showFormError('Could not shorten that link right now. Try again in a moment.');
  } finally {
    setLoading(false);
  }
}

form.addEventListener('submit', handleSubmit);

/* ═══════════════════════════════════════════════════════
   COPY / SHARE
   ═══════════════════════════════════════════════════════ */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older/insecure contexts
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

function showToast(msg, duration = 2200) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove('show'), duration);
}

copyBtn.addEventListener('click', async () => {
  const full = resultBase.textContent + resultHash.textContent;
  const ok = await copyText(full);
  if (ok) {
    copyBtn.textContent = 'Copied';
    copyBtn.classList.add('copied');
    showToast('Link copied to clipboard');
    setTimeout(() => {
      copyBtn.textContent = 'Copy';
      copyBtn.classList.remove('copied');
    }, 1600);
  } else {
    showToast('Could not copy — long-press to copy manually');
  }
});

/* ═══════════════════════════════════════════════════════
   HISTORY RENDERING
   ═══════════════════════════════════════════════════════ */
function fmtRelativeTime(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderHistory() {
  const list = loadHistory();
  historyList.querySelectorAll('.history-item').forEach(el => el.remove());
  clearHistoryBtn.hidden = list.length === 0;
  historyEmpty.hidden = list.length > 0;

  list.forEach(entry => {
    const { base, hash } = splitShortUrl(entry.short);
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <div class="history-item-main">
        <div class="history-short">${escHtml(base)}<span class="hash">${escHtml(hash)}</span></div>
        <div class="history-original">${escHtml(entry.original)}</div>
      </div>
      <div class="history-meta">${fmtRelativeTime(entry.ts)}</div>
      <div class="history-actions">
        <button class="icon-btn copy-item" title="Copy short link" aria-label="Copy short link">⧉</button>
        <a class="icon-btn" href="${escHtml(entry.short)}" target="_blank" rel="noopener" title="Open" aria-label="Open">↗</a>
        <button class="icon-btn danger delete-item" title="Remove" aria-label="Remove">✕</button>
      </div>
    `;
    item.querySelector('.copy-item').addEventListener('click', async () => {
      const ok = await copyText(entry.short);
      showToast(ok ? 'Link copied to clipboard' : 'Could not copy');
    });
    item.querySelector('.delete-item').addEventListener('click', () => {
      removeFromHistory(entry.id);
    });
    historyList.appendChild(item);
  });
}

clearHistoryBtn.addEventListener('click', () => {
  if (confirm('Clear all shortened link history? This only affects this browser.')) {
    clearAllHistory();
    showToast('History cleared');
  }
});

/* ═══════════════════════════════════════════════════════
   PWA — INSTALL PROMPT
   ═══════════════════════════════════════════════════════ */
let deferredInstallPrompt = null;
const installBtn = $('installBtn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  installBtn.hidden = false;
});

installBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  installBtn.hidden = true;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome !== 'accepted') installBtn.hidden = false;
  deferredInstallPrompt = null;
});

window.addEventListener('appinstalled', () => {
  installBtn.hidden = true;
  deferredInstallPrompt = null;
});

/* ═══════════════════════════════════════════════════════
   SERVICE WORKER REGISTRATION
   ═══════════════════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('[snip] Service worker registration failed:', err.message);
    });
  });
}

/* ═══════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════ */
renderHistory();
urlInput.focus();
