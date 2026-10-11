// Everything else: cache first, from the network (and into the cache) when it's not there yet.
async function fromCache({ request }) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  await store(request, response.clone());
  return response;
}
