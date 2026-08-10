'use strict';

const CACHE_VERSION = 'prh-pwa-shell-v1';
const SHELL_PATHS = Object.freeze([
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
]);
const PRIVATE_PATH_TOKENS = Object.freeze([
  '/api/',
  '/private/',
  '/finance/',
  '/dashboard/',
  '/transactions/',
  '/analytics/',
  '/home/',
  '/explorer/'
]);

function shellUrls() {
  return new Set(SHELL_PATHS.map((path) => new URL(path, self.registration.scope).href));
}

function isPrivateUrl(url) {
  const path = String(url.pathname || '').toLowerCase();
  return PRIVATE_PATH_TOKENS.some((token) => path.includes(token));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(SHELL_PATHS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith('prh-pwa-shell-') && name !== CACHE_VERSION)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!request || request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isPrivateUrl(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (!shellUrls().has(url.href)) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request, { cacheName: CACHE_VERSION });
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
