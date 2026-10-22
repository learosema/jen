---
layout: doc
permalink: /web.html
title: jen — web pack recipes
description: "Every jen command in @codejen/pack-web: a contrast-checked palette with dark mode, a CUBE CSS starter with fluid type and space, layout compositions, utilities, and blocks from buttons and cards to tables and form fields – with live previews."
eyebrow: "@codejen/pack-web"
mega: styles
lede: Every generator, with the command, the output it prints, and the CSS it makes – running live, in light and dark mode.
sub: Plain HTML and CSS. WCAG AAA contrast, checked before writing.
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
      - { title: One file for several, id: into }
      - { title: "Your own: web:import", id: web-import }
  - title: Starter
    links:
      - { title: "web:cube", id: web-cube }
  - title: Tokens
    links:
      - { title: "web:palette", id: web-palette }
      - { title: Role tokens, id: roles }
      - { title: Large text, id: large }
      - { title: "web:color", id: web-color }
      - { title: "web:fluid", id: web-fluid }
  - title: CUBE CSS
    links:
      - { title: "web:base", id: web-base }
      - { title: Compositions, id: web-compositions }
      - { title: Utilities, id: web-utilities }
  - title: Blocks
    links:
      - { title: "web:button", id: web-button }
      - { title: "web:card", id: web-card }
      - { title: "web:avatars", id: web-avatars }
      - { title: "web:nav", id: web-nav }
      - { title: "web:badge", id: web-badge }
      - { title: "web:stat", id: web-stat }
      - { title: "web:table", id: web-table }
      - { title: "web:list", id: web-list }
      - { title: "web:field", id: web-field }
  - title: Pages and platform
    links:
      - { title: "web:page", id: web-page }
      - { title: "web:manifest", id: web-manifest }
      - { title: "web:sw", id: web-sw }
      - { title: "web:dialog", id: web-dialog }
      - { title: "web:popover", id: web-popover }
      - { title: "web:theme-toggle", id: web-theme-toggle }
      - { title: "web:scroll", id: web-scroll }
      - { title: "web:transitions", id: web-transitions }
  - title: Tailwind
    links:
      - { title: "web:tailwind", id: web-tailwind }
  - title: Checking
    links:
      - { title: "web:check", id: web-check }
  - title: Recipes
    links:
      - { title: A dashboard, id: dashboard }
  - title: Finally
    links:
      - { title: Credits, id: credits }
---

## Install {#install}

It writes plain CSS and HTML: no build step, no runtime.

### Globally {#install-global}

{% include terminal.html id="web_install_global" %}

### Locally {#install-local}

{% include terminal.html id="web_install_local" %}

### Not at all {#install-npx}

Any `web:` generator without the pack fetches it for one run (`JEN_NO_FETCH=1` turns that off).

{% include terminal.html id="web_install_npx" %}

## Where files go {#where}

Into the current folder, or `--dir`. Everything is imported into one entry point, `styles.css`, made by `web:base` or `web:cube`. If that is in another folder, the plan says so – `info: styles.css is in css/ – pass --dir=css to put card.css next to it` – and if it already imports a file of the same name from elsewhere, it says that too. It declares the layers `reset, tokens, base, compositions, blocks, utilities, exceptions`, so later layers win regardless of specificity – `class="card bg-primary-subtle"` gets the tint. Generators add their `@import` above `/* jen:imports */`.

One generator, one file: `jen web:sidebar` writes `compositions/sidebar.css`, `jen web:color --name=pink` writes `colors/pink.css`. If your CSS already has a `.sidebar`, jen says where and adds nothing. `web:compositions`, `web:utilities` and `web:cube` make several at once.

### One file for several {#into}

`--into=<file.css>` appends to one stylesheet instead – created and imported if missing. It's a [path from where you run jen]({{ '/cli.html#paths' | relative_url }}). Works for every single-item generator and for `web:compositions` and `web:utilities`:

{% include terminal.html id="web_into" %}

### Your own stylesheet: `web:import` {#web-import}

Your own CSS goes in a file of its own, imported into the entry point like the generated ones. `web:import` adds the `@import`, and starts the file if it doesn't exist yet – it never overwrites one.

{% include terminal.html id="web_import" %}

{% include params.html generator="web:import" %}

Unlayered, so these rules beat everything layered. Reruns add nothing twice.

Link `styles.css` from your page, or `import './css/styles.css'` in Vite. Templates live in the pack's [`templates/`](https://github.com/learosema/jen/tree/main/packages/pack-web/templates) folder.

## Starter {#starter}

### `web:cube` {#web-cube}

Everything at once: [`web:base`](#web-base), [`web:fluid`](#web-fluid), all [compositions](#web-compositions) and fitting [utilities](#web-utilities), plus [`web:palette`](#web-palette) and [`web:button`](#web-button) with `--primary`. Takes the flags of `web:palette` and `web:fluid`.

{% include terminal.html id="web_cube" %}

`--into` writes it all, unlayered and in cascade order, into one file – even the entry point. Not for Tailwind projects.

{% include terminal.html id="web_cube_into" %}

{% include params.html generator="web:cube" %}

## Tokens {#tokens}

### `web:palette` {#web-palette}

Six shades per color, `--color-primary-1` (lightest) to `-6` (darkest), placed by luminance – so contrast depends only on the distance between shades, across colors too:

- **2 apart**: at least 3:1 – borders, icons, large text
- **3 apart**: at least 4.5:1 – WCAG AA for text
- **4 apart**: at least 7:1 – WCAG AAA for text

`--color-primary-5` on `--color-danger-1` is AAA. You also get a tinted neutral, success, warning, danger and info.

Colors: any CSS color (`deeppink`, `#f37`, `oklch(0.65 0.24 5)`, `color(display-p3 …)`, …) or a hue like `264`. Alpha is ignored.

Your color keeps its hue, but its lightness goes to whichever shade the contrast needs – a light teal can become a dark teal button. The plan then says which shade your color is closest to and which roles use it: `info: #0d9488 is closest to --color-primary-3 (--color-primary-large in dark mode); buttons and links use the darker -5 in light mode, -4 with --contrast=aa`.

{% include terminal.html id="web_palette" %}

{% include web-preview.html src="palette.html" title="The palette" height="32rem" dual=true caption="<code>--primary=#5b5bd6 --secondary=330</code>: labels sit at least 3 shades away from their swatch" %}

{% include params.html generator="web:palette" %}

### Role tokens and dark mode {#roles}

Role tokens switch with `light-dark()` (falling back to `prefers-color-scheme`). `data-theme="light"` or `"dark"` on `<html>` forces a mode.

- **Neutral**: `--color-surface`, `--color-surface-2` (cards, sidebars), `--color-text`, `--color-text-muted`, `--color-border`, `--color-border-subtle` (dividers that carry no meaning – not 3:1, so not for inputs), `--color-focus`
- **Per color** (shown for primary): `--color-primary`, `--color-primary-strong` (hover, and colored text on tints), `--color-primary-subtle` (tinted background), `--color-on-primary` (text on the color), `--color-primary-large` (large text only)

Every text pair is AAA, measured in both modes before writing – the generator fails rather than write a miss.

{% include web-preview.html src="roles.html" title="Role tokens" height="27rem" dual=true %}

### Large text {#large}

Large text (1.5rem, or 1.1667rem bold) is AAA at 4.5:1. The `-large` roles use that for more colorful headings:

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

### `web:color` {#web-color}

One color's six shades, with the same contrast rule as `web:palette`. No role tokens – the rest is up to you.

{% include terminal.html id="web_color" %}

<div class="terminal">
  <div class="chrome"><span></span><span></span><span></span><span class="title">src/css/colors/pink.css</span></div>
  <pre>@layer tokens {
  :root {
    --color-pink-1: #fff8fa;
    --color-pink-2: #ffa4c4;
    --color-pink-3: #ff409a;
    --color-pink-4: #c70071;
    --color-pink-5: #840049;
    --color-pink-6: #38001c;
  }
}</pre>
</div>

With Tailwind, the shades go into `@theme` (`bg-pink-1` …). Without, [`web:color-classes`](#web-utilities) makes `.bg-pink-1` and friends. [`web:button`](#web-button) ignores these colors.

{% include params.html generator="web:color" %}

### `web:fluid` {#web-fluid}

Fluid type and space after [Utopia](https://utopia.fyi), growing with `clamp()` between `--minWidth` and `--maxWidth`: `--step--2` to `--step-5`, `--space-3xs` to `--space-3xl`, and pairs like `--space-s-m`.

{% include terminal.html id="web_fluid" %}

{% include web-preview.html src="fluid.html" title="The type scale" height="27rem" caption="The type scale at this frame's width; resize the window to watch it change" %}

Growth over 2.5× is refused: it would break 200% zoom (WCAG 1.4.4).

{% include terminal.html id="web_fluid_zoom" %}

{% include params.html generator="web:fluid" %}

## CUBE CSS {#cube}

### `web:base` {#web-base}

The entry point, a reset and base styles: balanced headings, a visible focus ring, reduced-motion-aware transitions, `<li data-icon="✅">` markers, `#` heading anchors, text fields and selects on the palette's checked colors, and more. Uses the palette and fluid steps when present, system colors otherwise.

{% include terminal.html id="web_base" %}

{% include usage.html generator="web:base" %}

{% include web-preview.html src="base.html" title="Base styles" height="27rem" dual=true %}

### Compositions {#web-compositions}

Layout primitives after [Every Layout](https://every-layout.dev) and [SmolCSS](https://smolcss.dev): `web:flow`, `cluster`, `repel`, `sidebar`, `switcher`, `grid`, `wrapper`, `center`, `overlay`, `breakout`, `reel` and `gallery`. Each writes `compositions/<name>.css`, tuned by custom properties.

{% include terminal.html id="web_sidebar" %}

`web:compositions` writes all, or `--only=flow,cluster`:

{% include terminal.html id="web_compositions" %}

#### `.grid` and `.wrapper`

`.grid` fits as many columns of `--grid-min-item-size` as there's room for. `.wrapper` is a centered, padded column.

{% include web-preview.html src="compositions-grid.html" title=".grid" height="12rem" %}
{% include usage.html generator="web:grid" %}
{% include web-preview.html src="compositions-wrapper.html" title=".wrapper" height="7rem" %}
{% include usage.html generator="web:wrapper" %}

#### `.flow`, `.cluster` and `.repel`

`.flow` spaces siblings by `--flow-space`. `.cluster` wraps a group, like tags. `.repel` pushes two groups apart.

`--flow-space` is inherited: set it on the `.flow` or on one child (and a nested `.flow`'s children). [`.flow-space-*`](#web-utilities) does the same:

```html
<article class="flow"><h2>…</h2><p>…</p>
  <section class="flow flow-space-xl"><h3>…</h3><p>…</p></section></article>
```

The section and its children are `--space-xl` apart.

{% include web-preview.html src="compositions-flow.html" title=".flow" height="13rem" %}
{% include usage.html generator="web:flow" %}
{% include web-preview.html src="compositions-cluster.html" title=".cluster" height="10rem" %}
{% include usage.html generator="web:cluster" %}
{% include web-preview.html src="compositions-repel.html" title=".repel" height="5rem" %}
{% include usage.html generator="web:repel" %}

#### `.sidebar` and `.switcher`

`.sidebar` stacks when content gets narrower than `--sidebar-content-min`. `.switcher` stacks below `--switcher-threshold`.

{% include web-preview.html src="compositions-sidebar.html" title=".sidebar" height="7rem" %}
{% include usage.html generator="web:sidebar" %}
{% include web-preview.html src="compositions-switcher.html" title=".switcher" height="5rem" %}
{% include usage.html generator="web:switcher" %}

#### `.breakout`

A text column; children break out with `data-breakout="wide"` or `"full"`.

{% include web-preview.html src="compositions-breakout.html" title=".breakout" height="19.5rem" %}
{% include usage.html generator="web:breakout" %}

#### `.center`, `.overlay`, `.reel` and `.gallery`

`.center` centers. `.overlay` stacks children, like text on a picture. `.reel` is a snapping scroll row. `.gallery` crops media to `--gallery-ratio`.

{% include usage.html generator="web:center" %}
{% include web-preview.html src="compositions-overlay.html" title=".overlay" height="20rem" %}
{% include usage.html generator="web:overlay" %}
{% include web-preview.html src="compositions-reel.html" title=".reel" height="6rem" %}
{% include usage.html generator="web:reel" %}
{% include web-preview.html src="compositions-gallery.html" title=".gallery" height="11rem" %}
{% include usage.html generator="web:gallery" %}

{% include params.html generator="web:compositions" %}

### Utilities {#web-utilities}

One generator per file in `utilities/`. From your tokens (rerun with `--force` when they change):

- **`web:color-classes --name=<color>`**: `.color-*` and `.bg-*` – role tokens for a [palette](#web-palette) color (`.bg-primary-subtle`), page colors for `neutral`, shades for a [`web:color`](#web-color).
- **`web:step-classes`**: `.step-*` font sizes.
- **`web:space-classes`**: `.flow-space-*` and `.gutter-*`.

Fixed:

- **`web:visually-hidden`**: hidden on screen, not for screen readers.
- **`web:pad-fluid`**: padding that grows with the container.
- **`web:unbreakable`**: long words and URLs break instead of overflowing.

{% include terminal.html id="web_color_classes" %}

`web:utilities` writes all that fit:

{% include terminal.html id="web_utilities" %}

## Blocks {#blocks}

### `web:button` {#web-button}

A `.button` with `--secondary`, `--tertiary`, `--danger`, `--outline`, `--ghost`, `--pill`, `--small` and `--large`, all at the palette's checked contrast. Custom variants set `--button-*`.

{% include terminal.html id="web_button" %}

{% include web-preview.html src="buttons.html" title="Buttons" height="14rem" dual=true %}

{% include usage.html generator="web:button" %}

It needs a palette:

{% include terminal.html id="web_button_missing" %}

### `web:card` {#web-card}

A `.card` after [SmolCSS](https://smolcss.dev): edge-to-edge media, footers aligned across a row. Set `--card-padding` on the card or a parent.

{% include terminal.html id="web_card" %}

{% include web-preview.html src="card.html" title="Cards" height="37rem" dual=true %}

{% include usage.html generator="web:card" %}

### `web:avatars` {#web-avatars}

Overlapping avatars that spread on hover or focus, at AAA target size.

{% include terminal.html id="web_avatars" %}

{% include web-preview.html src="avatars.html" title="Avatars" height="6rem" caption="Hover or tab through them" %}

{% include usage.html generator="web:avatars" %}

### `web:nav` {#web-nav}

Links in a row, or a column with `data-direction="vertical"`. The current page is marked by `aria-current="page"`, so screen readers say it too. `--into=<page.html>` adds the markup, before `--line` or `</body>`.

{% include terminal.html id="web_nav" %}

{% include web-preview.html src="nav.html" title="Navigation" height="9rem" dual=true %}

{% include usage.html generator="web:nav" %}

{% include params.html generator="web:nav" %}

### `web:badge` {#web-badge}

A small label for a status, a count or a tag – one modifier per palette color, each its `-strong` on its `-subtle`, a pair the palette checks.

{% include terminal.html id="web_badge" %}

{% include web-preview.html src="badge.html" title="Badges" height="5rem" dual=true %}

{% include usage.html generator="web:badge" %}

### `web:stat` {#web-stat}

A metric: label, value, and a trend. `data-trend="up"`, `"down"` or `"flat"` colors the trend and adds an arrow, but the text says which way – color alone doesn't.

{% include terminal.html id="web_stat" %}

{% include web-preview.html src="stat.html" title="Stats" height="10rem" dual=true %}

{% include usage.html generator="web:stat" %}

### `web:table` {#web-table}

Readable data tables: numbers in `data-numeric` cells aligned at the end, `table--striped` for stripes. The table sits in a scroll region you can reach and scroll with the keyboard, after [Adrian Roselli's under-engineered responsive tables](https://adrianroselli.com/2020/11/under-engineered-responsive-tables.html); with a `--table-max-height`, the header stays put.

{% include terminal.html id="web_table" %}

{% include web-preview.html src="table.html" title="Table" height="15rem" dual=true caption="Scroll the rows: the header stays" %}

{% include usage.html generator="web:table" %}

### `web:list` {#web-list}

A list without bullets for feeds and settings; `list--divided` draws lines between the items.

{% include terminal.html id="web_list" %}

{% include web-preview.html src="list.html" title="List" height="11rem" dual=true %}

{% include usage.html generator="web:list" %}

### `web:field` {#web-field}

A form control with its label above, a hint and an error message, after the [GOV.UK Design System](https://design-system.service.gov.uk/components/text-input/). The hint and error are tied to the control with `aria-describedby`, so screen readers read them with it. [`web:base`](#web-base) already gives text fields the palette's colors.

{% include terminal.html id="web_field" %}

{% include web-preview.html src="field.html" title="Fields" height="20rem" dual=true %}

{% include usage.html generator="web:field" %}

## Pages and platform features {#platform}

Progressive enhancement: without support, the page still works. Markup goes in with `--into=<page.html>`, before `</body>` or before `--line` (`--line=8`, or `--line="</nav>"`). Nothing is rewritten or duplicated.

### `web:page` {#web-page}

A page after [Manuel Matuzović's HTML boilerplate](https://matuzo.at/blog/html-boilerplate/), linking your stylesheet, palette `theme-color`, and any existing icons and manifest – the plan says what it linked. No stylesheet yet: run [`web:cube`](#web-cube) first, then the page again with `--force`. `--url` adds canonical and `og:` tags; without `--description`, the page has no description tags, and search engines take text from the page. For a layout, see [a dashboard](#dashboard).

{% include terminal.html id="web_page" %}

{% include params.html generator="web:page" %}

### `web:manifest` {#web-manifest}

A `manifest.webmanifest` (in `public/` if there is one), with colors from the palette or `--themeColor`/`--backgroundColor`, and the icons that exist. A `favicon.svg` also gets an `icon-maskable.svg`. `--into=<page.html>` links it.

{% include terminal.html id="web_manifest" %}

{% include terminal.html id="web_manifest_file" %}

`--png` renders PNG icons from `favicon.svg`, for iOS and older browsers – using `rsvg-convert` or ImageMagick, whichever is installed.

{% include terminal.html id="web_manifest_png" %}

{% include params.html generator="web:manifest" %}

### `web:sw` {#web-sw}

A small service worker after the [Offline Cookbook](https://web.dev/articles/offline-cookbook): pages network-first, everything else cache-first (or `--strategy=swr`). It precaches pages and stylesheets, or `--precache=…`. `--offline` adds an `offline.html`. Bump `VERSION` to drop old caches.

`register-sw.js` matches your project's [types style]({{ '/js.html#styles' | relative_url }}). A waiting update fires `sw-update`; `event.detail.apply()` switches and reloads. In Vite, it only registers in production builds.

{% include terminal.html id="web_sw" %}

The start of `sw.js`:

{% include terminal.html id="web_sw_file" %}

{% include params.html generator="web:sw" %}

### `web:dialog` {#web-dialog}

An animated modal `.dialog`, opened without JavaScript via `<button commandfor="confirm" command="show-modal">`. A click outside closes it. With `--into`, the button goes at `--line`, the dialog before `</body>`.

{% include terminal.html id="web_dialog" %}

{% include web-preview.html src="dialog.html" title="A dialog" height="18rem" dual=true caption="Press the button" %}

{% include usage.html generator="web:dialog" %}

{% include params.html generator="web:dialog" %}

### `web:popover` {#web-popover}

A `.popover` anchored to its button, flipping when out of room – centered where anchor positioning isn't supported. `--into` works like the dialog's.

{% include terminal.html id="web_popover" %}

{% include web-preview.html src="popover.html" title="A popover" height="11rem" dual=true caption="Press the button" %}

{% include usage.html generator="web:popover" %}

{% include params.html generator="web:popover" %}

### `web:theme-toggle` {#web-theme-toggle}

Light, Dark and System as three radio buttons: every state visible and labeled, keyboard and screen readers work out of the box. The choice sets `data-theme` on `<html>`, which [the palette](#roles) reads, and is remembered in `localStorage`. `--into` also adds a small script to `<head>` that applies it before the first paint, so the page doesn't flash – after [Josh W. Comeau](https://www.joshwcomeau.com/react/dark-mode/). Both scripts are inline and classic, so they work from `file://`.

{% include terminal.html id="web_theme_toggle" %}

{% include web-preview.html src="theme-toggle.html" title="Theme toggle" height="5rem" caption="Pick one: this frame switches" %}

{% include usage.html generator="web:theme-toggle" %}

{% include params.html generator="web:theme-toggle" %}

### `web:scroll` {#web-scroll}

Scroll-driven animations without JavaScript: `.reading-progress`, `.reveal` and `.parallax`. Static with reduced motion.

{% include terminal.html id="web_scroll" %}

{% include web-preview.html src="scroll.html" title="Scroll-driven animations" height="18rem" caption="Scroll inside the frame" %}

{% include params.html generator="web:scroll" %}

### `web:transitions` {#web-transitions}

View transitions between pages: crossfade, or `--style=slide`. Off with reduced motion. `--spa` adds `transition(() => updateTheDom())` for single-page apps.

{% include terminal.html id="web_transitions" %}

{% include web-preview.html src="transitions-a.html" title="View transitions" height="12rem" caption="Follow the link inside the frame" %}

{% include params.html generator="web:transitions" %}

## Tailwind v4 {#tailwind}

### `web:tailwind` {#web-tailwind}

Imports Tailwind into the entry point, in CUBE CSS layer order. Then `web:palette` writes into `@theme` (`bg-surface`, `text-on-primary`, …) replacing Tailwind's colors, and `web:fluid` gives `text-step-1`, `p-s-m`. Install `tailwindcss` and e.g. `@tailwindcss/vite` yourself.

{% include terminal.html id="web_tailwind" %}

## Checking {#checking}

### `web:check` {#web-check}

Reads the project's pages and stylesheets and writes nothing. It warns about what's easy to miss:

- **classes no stylesheet defines** – a typo gets the closest class that exists, a pack-web class the generator that writes it
- **stylesheets nothing loads**: not linked from a page, imported from a script, or `@import`ed from one of those – and links to stylesheets that don't exist
- **color pairs the palette didn't measure**: a rule, or an element's `color-*` and `bg-*` classes, putting one role token on another that isn't a [checked pair](#roles) – with one that is

It reads `.html` files and the `<style>` in them, not classes set by scripts or in templates of a framework. In a Tailwind project, it leaves classes alone. `--strict` exits with `1` if there's a warning, e.g. in CI.

{% include terminal.html id="web_check" %}

## Recipes {#recipes}

### A dashboard {#dashboard}

A header, a sidebar and a row of stats. Five commands write the CSS and the page:

```sh
jen web:cube --primary=#0d9488 --dir=css
jen web:card --dir=css
jen web:nav --dir=css
jen web:stat --dir=css
jen web:page --name=index --title=Dashboard
```

`web:cube` comes first, so `web:page` finds `css/styles.css` and links it. The page's `<body>` then takes this markup:

```html
<body class="flow" style="padding-block: var(--space-s-m)">
  <header class="wrapper repel">
    <a href="/"><b>Acme</b></a>
    <nav class="nav" aria-label="Main">
      <ul role="list">
        <li><a href="/" aria-current="page">Overview</a></li>
        <li><a href="/reports">Reports</a></li>
        <li><a href="/settings">Settings</a></li>
      </ul>
    </nav>
  </header>
  <div class="wrapper sidebar">
    <aside>
      <div class="card">
        <h2>Filters</h2>
        <p>Last 30 days</p>
      </div>
    </aside>
    <main id="main" class="flow">
      <h1>Dashboard</h1>
      <div class="grid" style="--grid-min-item-size: 10rem; --stat-value-size: var(--step-2)">
        <article class="card stat"><h2 class="stat__label">Visitors</h2><p class="stat__value">12,480</p><p class="stat__trend" data-trend="up">+4 %</p></article>
        <article class="card stat"><h2 class="stat__label">Sign-ups</h2><p class="stat__value">318</p><p class="stat__trend" data-trend="flat">±0 %</p></article>
        <article class="card stat"><h2 class="stat__label">Revenue</h2><p class="stat__value">€4,210</p><p class="stat__trend" data-trend="up">+12 %</p></article>
        <article class="card stat"><h2 class="stat__label">Churn</h2><p class="stat__value">1.2 %</p><p class="stat__trend" data-trend="down">−0.3 %</p></article>
      </div>
    </main>
  </div>
</body>
```

{% include web-preview.html src="dashboard.html" title="A dashboard" height="22rem" dual=true %}

- **header**: [`.repel`](#web-compositions) puts the name and the [`.nav`](#web-nav) at either end; `aria-current="page"` marks where you are.
- **sidebar**: [`.sidebar`](#web-compositions) – the `<aside>` comes first, `<main>` takes the rest and goes below it when it gets narrower than half the width. The card sits inside the `<aside>`, so it keeps its own height.
- **grid**: [`.grid`](#web-compositions) of [`.card`](#web-card)s that are also [`.stat`](#web-stat)s. Its default 16rem columns fit three next to a sidebar; at 10rem it's four in a row from about 72em wide, with the values a step smaller to fit.
- **wrapper**: [`.wrapper`](#web-compositions) centers the header and the content, with room at the sides.

`jen web:page --help` lists the same parts, and `jen --find dashboard` shows the recipe's steps. Then [`jen web:check`](#web-check) looks for classes that don't exist and colors that clash.

## Credits {#credits}

Each file credits its sources:

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
- **[Under-Engineered Responsive Tables](https://adrianroselli.com/2020/11/under-engineered-responsive-tables.html)** by Adrian Roselli: the scroll region of `web:table`
- **[GOV.UK Design System](https://design-system.service.gov.uk/components/text-input/)** by the Government Digital Service: the label, hint and error pattern of `web:field`
- **[The Quest for the Perfect Dark Mode](https://www.joshwcomeau.com/react/dark-mode/)** by Josh W. Comeau: applying the stored theme before the first paint in `web:theme-toggle`
