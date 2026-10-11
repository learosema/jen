// Caching strategies after Jake Archibald's Offline Cookbook: https://web.dev/articles/offline-cookbook

// Bump the version to start over: activate removes the caches of older versions.
const VERSION = 1;
const PREFIX = '{{cache}}-';
const CACHE = `${PREFIX}v${VERSION}`;
const OFFLINE_PAGE = {{offline}};

const PRECACHE = [
  {{precache}}
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// register-sw posts this when the page applies an update.
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(request.mode === 'navigate' ? fromNetwork(request) : fromCache(event));
});

async function store(request, response) {
  if (response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response);
  }
}

// Pages: network first, then the cache, then the offline page.
async function fromNetwork(request) {
  try {
    const response = await fetch(request);
    await store(request, response.clone());
    return response;
  } catch (error) {
    const cached = (await caches.match(request)) ?? (OFFLINE_PAGE && (await caches.match(OFFLINE_PAGE)));
    if (cached) return cached;
    throw error;
  }
}

{{assets}}
