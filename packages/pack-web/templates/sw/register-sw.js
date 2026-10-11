// @ts-check

const SW_URL = {{url}};

/** @returns {Promise<void>} */
async function register() {
  const registration = await navigator.serviceWorker.register(SW_URL);
  /** @param {ServiceWorker} worker */
  const announce = (worker) => {
    window.dispatchEvent(new CustomEvent('sw-update', { detail: { apply: () => worker.postMessage('skip-waiting') } }));
  };
  if (registration.waiting && navigator.serviceWorker.controller) announce(registration.waiting);
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) announce(worker);
    });
  });

  // Reload once the new version takes over – but not when the first one does.
  if (!navigator.serviceWorker.controller) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

if ({{when}}) {
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', () => register(), { once: true });
}
