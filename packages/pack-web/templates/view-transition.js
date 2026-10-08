// Same-document view transitions; without support or with reduced motion, the update just happens.
export function transition(update) {
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return Promise.resolve(update());
  }
  return document.startViewTransition(update).finished;
}
