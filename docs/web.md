---
layout: doc
permalink: /web.html
title: jen — web pack recipes
description: "Every jen command in @codejen/pack-web: a contrast-checked palette with dark mode, a CUBE CSS starter with fluid type and space, layout compositions, utilities, buttons and cards – with live previews."
eyebrow: "@codejen/pack-web"
mega: styles
lede: Every generator, with the command, the output it prints, and the CSS it makes – running live, in light and dark mode.
sub: Plain HTML and CSS on the web platform. WCAG AAA contrast by default, checked before anything is written.
cta: { text: "Three ways to install ↓", url: "#install" }
toc:
  - title: Install
    links:
      - { title: Globally, id: install-global }
      - { title: Locally, id: install-local }
      - { title: Not at all, id: install-npx }
  - title: Where files go
    links:
      - { title: The entry point, id: where }
  - title: Starter
    links:
      - { title: "web:cube", id: web-cube }
  - title: Tokens
    links:
      - { title: "web:palette", id: web-palette }
      - { title: Role tokens, id: roles }
      - { title: Large text, id: large }
      - { title: "web:fluid", id: web-fluid }
  - title: CUBE CSS
    links:
      - { title: "web:base", id: web-base }
      - { title: "web:compositions", id: web-compositions }
      - { title: "web:utilities", id: web-utilities }
  - title: Blocks
    links:
      - { title: "web:button", id: web-button }
      - { title: "web:card", id: web-card }
      - { title: "web:avatars", id: web-avatars }
  - title: Pages and platform
    links:
      - { title: "web:page", id: web-page }
      - { title: "web:manifest", id: web-manifest }
      - { title: "web:sw", id: web-sw }
      - { title: "web:dialog", id: web-dialog }
      - { title: "web:popover", id: web-popover }
      - { title: "web:scroll", id: web-scroll }
      - { title: "web:transitions", id: web-transitions }
  - title: Tailwind
    links:
      - { title: "web:tailwind", id: web-tailwind }
  - title: Finally
    links:
      - { title: Credits, id: credits }
---

## Install {#install}

Same three ways as every jen pack. The pack only writes CSS files: no build step, no runtime, nothing to install in your project.

### Globally {#install-global}

{% include terminal.html id="web_install_global" %}

### Locally {#install-local}

{% include terminal.html id="web_install_local" %}

### Not at all {#install-npx}

Ask for a `web:` generator without the pack installed and jen fetches `@codejen/pack-web` into a throwaway directory, runs it once and removes it again (first-party `@codejen` scope only; `JEN_NO_FETCH=1` turns it off).

{% include terminal.html id="web_install_npx" %}

## Where files go {#where}

Generators write into the folder you run them in, or `--dir`. Everything meets in one entry point: `styles.css`, made by `web:base` or `web:cube`. It declares the cascade layers in CUBE CSS order – `reset, tokens, base, compositions, utilities, blocks, exceptions` – so a later layer wins over an earlier one whatever the selectors' specificity, and it ends with a `/* jen:imports */` marker. Every other generator adds its `@import` above that marker, with the path relative to the entry point, so running one from a subfolder still wires it in right.

Link `styles.css` from your page, or `import './css/styles.css'` in a Vite project. The [home page]({{ '/#where' | relative_url }}) has the general rules.

The boilerplate the generators write lives as plain `.css`, `.html` and `.js` files in the pack's [`templates/`](https://github.com/learosema/jen/tree/main/packages/pack-web/templates) folder, so it's easy to read and adapt; a few have `{% raw %}{{placeholders}}{% endraw %}` for the parts the generators fill in. Palettes, fluid scales and utilities are computed, so they're made in code.

## Starter {#starter}

### `web:cube` {#web-cube}

The whole starter at once: [`web:base`](#web-base), [`web:fluid`](#web-fluid), [`web:compositions`](#web-compositions) and [`web:utilities`](#web-utilities), plus [`web:palette`](#web-palette) and [`web:button`](#web-button) when you pass `--primary`. It takes every flag of `web:palette` and `web:fluid`.

{% include terminal.html id="web_cube" %}

{% include params.html generator="web:cube" %}

## Tokens {#tokens}

### `web:palette` {#web-palette}

Six shades per color, from your colors, as custom properties: `--color-primary-1` (lightest) to `--color-primary-6` (darkest). The shades aren't copied from your input but placed by luminance, so every color's shade 3 is equally light – and contrast depends only on how many shades apart two colors are, across colors too:

- **2 apart**: at least 3:1 – borders, icons, large text
- **3 apart**: at least 4.5:1 – WCAG AA for text
- **4 apart**: at least 7:1 – WCAG AAA for text

So `--color-primary-5` text on `--color-danger-1` is AAA, without looking anything up. Besides your colors you get a neutral gray tinted toward the primary hue, and success, warning, danger and info.

Colors take any CSS color – `deeppink`, `#f37`, `rgb(255 51 119)`, `hsl(340deg, 100%, 60%)`, `oklch(0.65 0.24 5)`, `lab()`, `lch()`, `hwb()`, `color(display-p3 …)` – or a bare hue in degrees like `264`. Alpha is ignored: palette colors are opaque.

{% include terminal.html id="web_palette" %}

{% include web-preview.html src="palette.html" title="The palette" height="32rem" dual=true caption="<code>--primary=#5b5bd6 --secondary=330</code>: labels sit at least 3 shades away from their swatch" %}

{% include params.html generator="web:palette" %}

### Role tokens and dark mode {#roles}

On top of the shades come role tokens that switch between light and dark mode with `light-dark()`, following `color-scheme`. Browsers without `light-dark()` get the same through `prefers-color-scheme`, and `data-theme="light"` or `"dark"` on `<html>` forces a mode.

- **Neutral**: `--color-surface`, `--color-surface-2` (cards, sidebars), `--color-text`, `--color-text-muted`, `--color-border`, `--color-focus`
- **Per color** (shown for primary): `--color-primary`, `--color-primary-strong` (hover, and colored text on tints), `--color-primary-subtle` (tinted background), `--color-on-primary` (text on the color), `--color-primary-large` (large text only)

`--color-surface-2` and the `-subtle` tints sit between shades, so they stand out from the page while text on them keeps the full level. By default every text pair is AAA. Before the file is written, each pair is measured on the final hex values in both modes; if one ever missed, the generator would fail rather than write it.

{% include web-preview.html src="roles.html" title="Role tokens" height="27rem" dual=true %}

### Large text {#large}

Large text – at least 1.5rem, or 1.1667rem bold – needs less contrast for the same level: 4.5:1 is AAA. The `-large` roles use that and sit one shade closer to the background, so headings and heroes can be more colorful and still be AAA:

<div class="terminal">
  <div class="chrome"><span></span><span></span><span></span><span class="title">src/css/hero.css</span></div>
  <pre>h1 {
  color: var(--color-primary-large);
}

.hero {
  background: var(--color-primary-large);
  color: var(--color-on-primary);
  font-size: 2.5rem;
}</pre>
</div>

### `web:fluid` {#web-fluid}

Fluid type and space in the style of [Utopia](https://utopia.fyi): every size grows from its value at `--minWidth` to its value at `--maxWidth` with `clamp()`. Type steps run from `--step--2` to `--step-5`; space from `--space-3xs` to `--space-3xl`, plus one-up pairs like `--space-s-m` that grow more. All lengths are rem, and the rem part of each formula keeps text zoomable.

{% include terminal.html id="web_fluid" %}

{% include web-preview.html src="fluid.html" title="The type scale" height="27rem" caption="The type scale at this frame's width; resize the window to watch it change" %}

A size that would grow more than 2.5× across the range is refused: browser zoom couldn't reach 200% text size anymore (WCAG 1.4.4).

{% include terminal.html id="web_fluid_zoom" %}

{% include params.html generator="web:fluid" %}

## CUBE CSS {#cube}

### `web:base` {#web-base}

The entry point, a modern reset and base styles for plain elements: a stable scrollbar gutter, balanced headings and pretty paragraphs, a visible focus ring, transition tokens that drop to zero under `prefers-reduced-motion`, visited links, `<li data-icon="✅">` list markers, and `#` heading anchors with a highlight when you jump to them. Colors fall back to system colors until there's a palette; font sizes use the fluid steps when they exist.

{% include terminal.html id="web_base" %}

{% include web-preview.html src="base.html" title="Base styles" height="27rem" dual=true %}

### `web:compositions` {#web-compositions}

Layout primitives after [Every Layout](https://every-layout.dev) and [SmolCSS](https://smolcss.dev), in the `compositions` layer. Each is tuned with custom properties that fall back to the fluid space tokens, then to fixed values. `--only=flow,cluster` picks some.

{% include terminal.html id="web_compositions" %}

#### `.grid` and `.wrapper`

`.grid` fits as many columns as there's room for, each at least `--grid-min-item-size`; a few items stretch to fill the row. `.wrapper` is a centered column up to `--wrapper-max-width` that never touches the viewport edges.

{% include web-preview.html src="compositions-grid.html" title=".grid" height="12rem" %}
{% include web-preview.html src="compositions-wrapper.html" title=".wrapper" height="7rem" %}

#### `.flow`, `.cluster` and `.repel`

`.flow` puts `--flow-space` between siblings. `.cluster` wraps items as a group, like tags or nav links. `.repel` pushes two groups to either end.

{% include web-preview.html src="compositions-flow.html" title=".flow" height="13rem" %}
{% include web-preview.html src="compositions-cluster.html" title=".cluster" height="10rem" %}
{% include web-preview.html src="compositions-repel.html" title=".repel" height="5rem" %}

#### `.sidebar` and `.switcher`

`.sidebar` puts its first child beside the content, and stacks once the content would get narrower than `--sidebar-content-min`; `data-direction="end"` puts the sidebar last. `.switcher` lays its children side by side above `--switcher-threshold` and stacks them below.

{% include web-preview.html src="compositions-sidebar.html" title=".sidebar" height="7rem" %}
{% include web-preview.html src="compositions-switcher.html" title=".switcher" height="5rem" %}

#### `.breakout`

A text column (`--breakout-max-width`) whose children can break out with `data-breakout="wide"` or `data-breakout="full"`.

{% include web-preview.html src="compositions-breakout.html" title=".breakout" height="19.5rem" %}

#### `.center`, `.overlay`, `.reel` and `.gallery`

`.center` centers in both directions. `.overlay` layers its children in one grid cell, like text over a picture. `.reel` is a scrolling row that snaps to its items. `.gallery` crops media to `--gallery-ratio` in wrapping rows.

{% include web-preview.html src="compositions-overlay.html" title=".overlay" height="20rem" %}
{% include web-preview.html src="compositions-reel.html" title=".reel" height="6rem" %}
{% include web-preview.html src="compositions-gallery.html" title=".gallery" height="11rem" %}

{% include params.html generator="web:compositions" %}

### `web:utilities` {#web-utilities}

Utility classes from your tokens, in the `utilities` layer: `.color-*` and `.bg-*` for every role token – not the raw shades, so you stay on checked pairs – `.step-*` font sizes, `.flow-space-*` and `.gutter-*` for every space size, `.pad-fluid`, `.unbreakable` and `.visually-hidden`. Run it after the tokens, and again with `--force` when they change.

{% include terminal.html id="web_utilities" %}

## Blocks {#blocks}

### `web:button` {#web-button}

A `.button` block with BEM modifiers: `--secondary`, `--tertiary` and `--danger` for the colors the palette has, `--outline`, `--ghost`, `--pill`, `--small` and `--large`. Text on its fill, on its hover fill and on the tinted hover of `--outline`, the fill against the page, and the focus ring all keep the palette's checked contrast. Your own variant sets the `--button-*` properties in a modifier.

{% include terminal.html id="web_button" %}

{% include web-preview.html src="buttons.html" title="Buttons" height="14rem" dual=true %}

It needs a palette, and says so:

{% include terminal.html id="web_button_missing" %}

### `web:card` {#web-card}

A composable `.card` after [SmolCSS](https://smolcss.dev): any children get its padding, media first or last goes edge to edge, and the last child sits at the bottom, so footers line up across a row of cards.

{% include terminal.html id="web_card" %}

{% include web-preview.html src="card.html" title="Cards" height="37rem" dual=true %}

### `web:avatars` {#web-avatars}

Overlapping round avatars that move apart on hover or focus. Each step is at least 2.75rem wide, the WCAG AAA target size, for avatars that are links.

{% include terminal.html id="web_avatars" %}

{% include web-preview.html src="avatars.html" title="Avatars" height="6rem" caption="Hover or tab through them" %}

## Pages and platform features {#platform}

Modern HTML and CSS that used to need JavaScript, each as progressive enhancement: where a browser lacks a feature, the page still works – it just doesn't animate or anchor. Generators that come with markup take `--into=<page.html>` and put it in before `</body>` – or before the line `--line` names: a number like `--line=8`, or text on that line like `--line="</nav>"` to put a menu inside the nav. Either way the page needs no marker, the markup is indented to fit, and running a generator twice duplicates nothing. Script tags they need still go before `</body>`.

### `web:page` {#web-page}

A new page after [Manuel Matuzović's HTML boilerplate](https://matuzo.at/blog/html-boilerplate/): `lang`, a `no-js`/`js` class switched by a module script, the viewport, a title of the form "Page – Site", description and Open Graph tags. On top, it fits the page to your project: the stylesheet link points at the entry point, relative to the page; `theme-color` follows the palette's page colors in light and dark mode; and icons and the manifest are linked only if those files exist, at the root or in `public/`. Canonical, `og:url` and `og:image` need your site's address, so they come with `--url`.

{% include terminal.html id="web_page" %}

{% include params.html generator="web:page" %}

### `web:manifest` {#web-manifest}

Makes the site installable with a `manifest.webmanifest`. It goes into `public/` in a Vite project or any project with that folder, else where you run jen. The colors come from the palette – `theme_color` from `primary`, `background_color` from `surface` – or from `--themeColor` and `--backgroundColor` (any CSS color, or a hue), and white without either. They're written as hex, which every browser reads. The manifest lists only the icons that exist, at the root or in `public/`. Next to a `favicon.svg`, it also writes `icon-maskable.svg`: the same icon on the background color, shrunk into the safe zone that round and rounded-square icon masks leave alone. `--into=<page.html>` links the manifest and adds `theme-color` to the page's head, one per color scheme when there's a palette. Pages you make later with `web:page` link the manifest by themselves.

{% include terminal.html id="web_manifest" %}

{% include terminal.html id="web_manifest_file" %}

Some browsers, and iOS for the home screen, still want PNGs. `--png` renders `icon-192.png`, `icon-512.png` and `apple-touch-icon.png` from `favicon.svg` and lists them. The apple-touch icon goes on the background color with some room around it, because iOS fills transparent corners with black. jen bundles no image library: `--png` uses `rsvg-convert` (librsvg) or ImageMagick, whichever is installed, and stops with a message if neither is.

{% include terminal.html id="web_manifest_png" %}

{% include params.html generator="web:manifest" %}

### `web:sw` {#web-sw}

A service worker without dependencies, short enough to read and own, with the caching strategies of Jake Archibald's [Offline Cookbook](https://web.dev/articles/offline-cookbook). Pages go network first: fresh when online, from the cache when not, and the offline page for anything never visited. Everything else is cache first, or stale-while-revalidate with `--strategy=swr`: served from the cache right away, and refreshed in the background for next time. On install, it caches the pages next to it and the entry stylesheet with everything it imports, or what `--precache=app.css,logo.svg` lists. `--offline` adds an `offline.html`, made from `web:page`'s template. The cache name carries a version: bump `VERSION` in `sw.js` and activating the new worker removes the old caches.

`register-sw.js` registers the worker. Like pack-js, it comes in the project's style: TypeScript, JavaScript with JSDoc types, or plain JavaScript, by `--types` or else the nearest `tsconfig.json` or `jsconfig.json`. The service worker itself is always plain JavaScript, since browsers load it as it is. When a new version is waiting, `sw-update` fires on `window`, and `event.detail.apply()` switches to it and reloads the page – ask first, or apply it right away. In a Vite project, `sw.js` goes into `public/` and registers at Vite's base URL, and only in production builds, so the dev server's modules never end up in a cache. There, Vite builds the stylesheets, so they're cached as they load rather than on install.

{% include terminal.html id="web_sw" %}

A live preview is no use for a service worker, so here's the start of the file it writes:

{% include terminal.html id="web_sw_file" %}

{% include params.html generator="web:sw" %}

### `web:dialog` {#web-dialog}

A modal `.dialog` that fades and rises in and out (`@starting-style`) above a dimmed backdrop. The markup opens it with the command API – `<button commandfor="confirm" command="show-modal">` – so no JavaScript is needed; `commands.js` stands in for browsers that don't have the command API yet. `closedby="any"` lets a click outside close it.

{% include terminal.html id="web_dialog" %}

{% include web-preview.html src="dialog.html" title="A dialog" height="18rem" dual=true caption="Press the button" %}

{% include params.html generator="web:dialog" %}

### `web:popover` {#web-popover}

A `.popover` anchored below its trigger with CSS anchor positioning, flipping above or to the other side when there's no room. Without anchor positioning it opens centered, like any popover. The markup uses `popovertarget` and ties trigger and popover together with an anchor name.

{% include terminal.html id="web_popover" %}

{% include web-preview.html src="popover.html" title="A popover" height="11rem" dual=true caption="Press the button" %}

{% include params.html generator="web:popover" %}

### `web:scroll` {#web-scroll}

Scroll-driven animations, no JavaScript: a `.reading-progress` bar that follows the page's scroll position, `.reveal` for elements that fade in as they scroll into view, and `.parallax`, shifted by `--parallax-shift`. Without support or with reduced motion, nothing is hidden and nothing moves.

{% include terminal.html id="web_scroll" %}

{% include web-preview.html src="scroll.html" title="Scroll-driven animations" height="18rem" caption="Scroll inside the frame" %}

{% include params.html generator="web:scroll" %}

### `web:transitions` {#web-transitions}

Cross-document view transitions between the pages of a site, as the browser's crossfade or `--style=slide` – off with reduced motion, and simply absent where unsupported. `--spa` adds `view-transition.js` for same-document transitions: `transition(() => updateTheDom())`, a plain update where unsupported.

{% include terminal.html id="web_transitions" %}

{% include web-preview.html src="transitions-a.html" title="View transitions" height="12rem" caption="Follow the link inside the frame" %}

{% include params.html generator="web:transitions" %}

## Tailwind v4 {#tailwind}

### `web:tailwind` {#web-tailwind}

Sets up the entry point for Tailwind: `@import "tailwindcss"`, with Tailwind's layers fitted into the CUBE CSS order. From then on, `web:palette` writes its tokens into `@theme` under the same names – so Tailwind makes `bg-surface`, `text-on-primary`, `bg-primary-subtle`, `border-border` – and drops Tailwind's own colors, leaving only checked ones. `web:fluid` maps its scales to `text-step-1`, `p-s-m` and friends, and `web:cube` leaves the utilities to Tailwind. jen doesn't install anything: add `tailwindcss` and its build integration (e.g. `@tailwindcss/vite`) yourself.

{% include terminal.html id="web_tailwind" %}

## Credits {#credits}

Every file credits the work it builds on, in a comment at the top of the part it's about:

- **[CUBE CSS](https://cube.fyi)** by Andy Bell: the layer order, and the Repel composition
- **[Every Layout](https://every-layout.dev)** by Heydon Pickering and Andy Bell: the flow (Stack), cluster, sidebar, switcher and reel compositions
- **[SmolCSS](https://smolcss.dev)** by Stephanie Eckles: the grid, wrapper (intrinsic container), center, overlay, breakout, reel (scroll snap) and gallery compositions, the card and avatar list, `.pad-fluid` and `.unbreakable`, and the transition tokens, visited links, heading anchors and list markers in the base styles
- **[A (more) Modern CSS Reset](https://piccalil.li/blog/a-more-modern-css-reset/)** by Andy Bell and **[a modern CSS reset](https://www.joshwcomeau.com/css/custom-css-reset/)** by Josh W. Comeau: the reset
- **[Utopia](https://utopia.fyi)** by James Gilyead and Trys Mudford: the fluid type and space scales
- **[Reasonable Colors](https://www.reasonable.work/colors/)** by Matthew Howell: the idea of shade distances that guarantee contrast
- **[OKLab](https://bottosson.github.io/posts/oklab/)** by Björn Ottosson: the color math behind the shades
- **[CSS Color Module Level 4](https://www.w3.org/TR/css-color-4/)** by the W3C CSS Working Group: the named colors and the conversion matrices for reading `lab()`, `lch()` and `color()`
- **[HTML boilerplate](https://matuzo.at/blog/html-boilerplate/)** by Manuel Matuzović: `web:page`
- **[How to Favicon in 2021](https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs)** by Andrey Sitnik (Evil Martians): the icon set `web:page` links and `web:manifest` lists
- **[Web app manifest](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest)** reference by MDN: `web:manifest`
- **[The Offline Cookbook](https://web.dev/articles/offline-cookbook)** by Jake Archibald: the caching strategies in `web:sw`

The code is written fresh for this pack, not copied. The pack is ISC licensed.
