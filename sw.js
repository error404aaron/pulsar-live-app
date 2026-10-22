// PULSAR LIVE service worker: keeps the application shell available offline.
//
// - Caches only the files in SHELL, all from this site, in a cache named for
//   this build. Nothing else is cached, and storage (saved scenes and
//   preferences) is never touched.
// - BUILD is a hash of the SHELL files, written by `node tools/sw-stamp.mjs`.
//   Any change to them changes this file, so browsers install the new version.
// - A new version waits. The page offers an Update button and sends
//   SKIP_WAITING only when the person presses it, so nothing reloads mid-session.
// - Activating deletes this app's caches from older builds.
// - GET_BUILD (with a MessagePort) answers with BUILD, shown in Settings.
'use strict';
const BUILD = '0cc8ccc5fbece8';
const PREFIX = 'pulsar-live-shell-';
const CACHE = PREFIX + BUILD;
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  // 'reload' skips the HTTP cache, so a new build never stores stale copies.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  // The page shows which build it runs, so an update or rollback can be confirmed.
  else if (event.data && event.data.type === 'GET_BUILD' && event.ports && event.ports[0]) event.ports[0].postMessage({ build: BUILD });
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope);
  const path = url.pathname;
  // The page itself: always this build's copy, so the page and its cache match.
  if (req.mode === 'navigate' && (path === scope.pathname || path === scope.pathname + 'index.html')) {
    event.respondWith(caches.open(CACHE).then((cache) => cache.match('./index.html')).then((hit) => hit || fetch(req)));
    return;
  }
  // Other shell files from this build's cache; everything else goes to the network.
  if (SHELL.some((u) => new URL(u, scope).pathname === path)) {
    event.respondWith(caches.open(CACHE).then((cache) => cache.match(req, { ignoreSearch: true })).then((hit) => hit || fetch(req)));
  }
});
