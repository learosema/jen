// Everything else: stale-while-revalidate – from the cache right away, updated from the network for next time.
async function fromCache(event) {
  const cached = await caches.match(event.request);
  const fresh = fetch(event.request).then(async (response) => {
    await store(event.request, response.clone());
    return response;
  });
  if (!cached) return fresh;
  event.waitUntil(fresh.catch(() => {}));
  return cached;
}
