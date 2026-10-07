/**
 * `web:base`: the stylesheet entry point plus a modern reset and base styles.
 *
 * `styles.css` declares the cascade layers in CUBE CSS order – reset, tokens,
 * base, compositions, utilities, blocks, exceptions – and imports the other
 * files; later generators (web:palette, web:button, …) add their `@import`
 * above its `jen:imports` marker. If the project already has an entry with
 * that marker, reset.css and base.css are wired into it instead.
 *
 * The base styles use the palette's role tokens with system-color fallbacks
 * (Canvas, CanvasText, …), so they work before web:palette has run.
 *
 *   jen web:base [--dir=src/css]
 */
import type { Generator } from '@codejen/jen';
import { IMPORTS_MARKER, findEntry, importActions, importLine } from './entry.ts';

export const LAYERS = ['reset', 'tokens', 'base', 'compositions', 'utilities', 'blocks', 'exceptions'];

export const ENTRY = 'styles.css';

const entryCss = (files: string[]) => `/*
 * Stylesheet entry point, cascade layers in CUBE CSS order (later layers win).
 * jen generators add their @import lines above the marker at the end.
 */
@layer ${LAYERS.join(', ')};

${files.map(importLine).join('\n')}
/* ${IMPORTS_MARKER} */
`;

export const RESET = `/* Modern reset: border-box sizing, no default margins, sensible media and form defaults. */
@layer reset {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  * {
    margin: 0;
  }

  html {
    -webkit-text-size-adjust: none;
    text-size-adjust: none;
  }

  body {
    min-block-size: 100dvh;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  img,
  picture,
  video,
  canvas,
  svg {
    display: block;
    max-inline-size: 100%;
  }

  input,
  button,
  textarea,
  select {
    font: inherit;
    letter-spacing: inherit;
  }

  p,
  li,
  figcaption {
    text-wrap: pretty;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    line-height: 1.1;
    text-wrap: balance;
  }

  p,
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    overflow-wrap: break-word;
  }

  /* Lists with role="list" are layout, not content: no bullets. */
  :where(ul, ol)[role="list"] {
    list-style: none;
    padding: 0;
  }

  textarea:not([rows]) {
    min-block-size: 10em;
  }

  :target {
    scroll-margin-block: 5ex;
  }

  [hidden]:not([hidden="until-found"]) {
    display: none !important;
  }

  @media (prefers-reduced-motion: no-preference) {
    html {
      interpolate-size: allow-keywords;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
`;

export const BASE = `/* Base styles for plain elements: palette role tokens, system colors as fallbacks. */
@layer base {
  html {
    /* No layout shift when a page starts or stops scrolling. */
    scrollbar-gutter: stable;
    hanging-punctuation: first last;
    accent-color: var(--color-primary, AccentColor);
  }

  @media (prefers-reduced-motion: no-preference) {
    html:focus-within {
      scroll-behavior: smooth;
    }
  }

  body {
    background: var(--color-surface, Canvas);
    color: var(--color-text, CanvasText);
    font-family: system-ui, sans-serif;
  }

  a {
    color: var(--color-primary, LinkText);
    text-decoration-thickness: from-font;
    text-underline-offset: 0.15em;
  }

  a:hover {
    text-decoration-thickness: 0.125em;
  }

  :focus-visible {
    outline: 0.125rem solid var(--color-focus, Highlight);
    outline-offset: 0.125rem;
  }

  ::selection {
    background: var(--color-primary, Highlight);
    color: var(--color-on-primary, HighlightText);
  }

  hr {
    border: none;
    border-block-start: thin solid var(--color-border, GrayText);
  }

  code,
  kbd,
  pre,
  samp {
    font-family: ui-monospace, monospace;
    font-size: 1em;
  }

  table {
    border-collapse: collapse;
  }
}
`;

const baseGenerator: Generator = {
  description: 'create the stylesheet entry point (CUBE CSS layers), a modern reset and base styles',
  actions: (_answers, _helpers, ctx) => {
    const files = ['reset.css', 'base.css'];
    const own = [
      { add: 'reset.css', template: RESET },
      { add: 'base.css', template: BASE },
    ];
    return findEntry(ctx) ? [...own, ...importActions(ctx, files)] : [{ add: ENTRY, template: entryCss(files) }, ...own];
  },
};

export default baseGenerator;
