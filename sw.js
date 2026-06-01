/**
 * Service Worker for Lawrence Anaesthesia PWA
 *
 * Strategy:
 *  - App shell (HTML, CSS, JS, icons) → Cache-first (fast loads, works offline)
 *  - Google Apps Script API calls     → Network-first (always fresh data)
 *  - Offline fallback                 → Show offline.html if network & cache both miss
 */

const CACHE_NAME = 'lawrence-anaesthesia-v79';

const APP_SHELL = [
  './portal.html',
  './snapshot.html',
  './timekeeper.html',
  './css/style.css',
  './js/api.js',
  './config.js',
  './snoozle.png',
  './snoozle_maskable.png',
  './snoozle_yellow.png',
  './manifest_portal.json',
  './manifest_snapshot.json',
  './manifest_timekeeper.json',
  './offline.html',
  'https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap'
];


// ── Install: pre-cache the app shell, bypassing browser HTTP cache ─────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log('Pre-caching app shell with cache-busting...');
      const promises = APP_SHELL.map(async url => {
        try {
          const requestOptions = url.startsWith('http') ? {} : { cache: 'reload' };
          const response = await fetch(new Request(url, requestOptions));
          if (!response.ok) {
            throw new Error(`Request failed for ${url} with status ${response.status}`);
          }
          await cache.put(url, response);
        } catch (err) {
          console.warn(`Failed to fetch ${url} with cache:reload, falling back to cache.add:`, err);
          await cache.add(url);
        }
      });
      await Promise.all(promises);
    })
  );
  self.skipWaiting();
});

// ── Activate: remove old caches ────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: route requests by strategy ─────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass service worker for non-GET requests (e.g., POST API calls)
  if (request.method !== 'GET') {
    return;
  }

  // Always go network-first for the GAS API or Cloudflare API relay
  if (url.hostname === 'script.google.com' || url.hostname === 'anesthesia-api-relay.scott-roberts-crna.workers.dev') {
    event.respondWith(networkFirst(request));
    return;
  }

  // For Google Fonts (non-critical) — stale-while-revalidate
  if (url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Everything else (app shell) → cache-first with offline fallback
  event.respondWith(cacheFirst(request));
});

// ── Strategy helpers ───────────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline fallback for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('./offline.html');
    }
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ success: false, error: 'You are offline.' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 503
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}
