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
      - { title: Entry point, id: where }
      - { title: "--into", id: into }
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
  - title: Platform
    links:
      - { title: "web:page", id: web-page }
      - { title: "web:manifest", id: web-manifest }
      - { title: "web:sw", id: web-sw }
      - { title: "web:dialog", id: web-dialog }
      - { title: "web:popover", id: web-popover }
      - { title: "web:theme-toggle", id: web-theme-toggle }
      - { title: "web:scroll", id: web-scroll }
      - { title: "web:transitions", id: web-transitions }
  - title: Scripts
    links:
      - { title: "web:vite", id: web-vite }
      - { title: "web:esbuild", id: web-esbuild }
      - { title: "web:element", id: web-element }
      - { title: "web:roving", id: web-roving }
      - { title: "web:menu", id: web-menu }
      - { title: "web:grid-navigation", id: web-grid-navigation }
      - { title: "web:hotkeys", id: web-hotkeys }
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

### Globally {#install-global}

{% include terminal.html id="web_install_global" %}

### Locally {#install-local}

{% include terminal.html id="web_install_local" %}

### Not at all {#install-npx}

{% include terminal.html id="web_install_npx" %}

## Where files go {#where}

One generator, one file, `@import`ed into `styles.css` (from `web:base` or `web:cube`) in CUBE CSS layer order. `--dir` picks the folder.

### One file for several {#into}

`--into=<file.css>` appends to one stylesheet instead.

{% include terminal.html id="web_into" %}

### Your own stylesheet {#web-import}

`@import "./dashboard.css";` in `styles.css`, before `/* jen:imports */` – [`web:check`](#web-check) names a stylesheet nothing imports.

## Starter {#starter}

### `web:cube` {#web-cube}

[`web:base`](#web-base), [`web:fluid`](#web-fluid), all [compositions](#web-compositions) and [utilities](#web-utilities) – plus [`web:palette`](#web-palette) and [`web:button`](#web-button) with `--primary`.

{% include terminal.html id="web_cube" %}

{% include terminal.html id="web_cube_into" %}

{% include params.html generator="web:cube" %}

## Tokens {#tokens}

### `web:palette` {#web-palette}

Six shades per color: 2 apart is 3:1, 3 apart AA, 4 apart AAA – across colors too.

{% include terminal.html id="web_palette" %}

{% include web-preview.html src="palette.html" title="The palette" height="32rem" dual=true caption="<code>--primary=#5b5bd6 --secondary=330</code>" %}

{% include params.html generator="web:palette" %}

### Role tokens and dark mode {#roles}

`light-dark()` roles, every text pair AAA in both modes – placed between shades, no darker than that needs. `data-theme="light"` or `"dark"` on `<html>` forces a mode.

{% include web-preview.html src="roles.html" title="Role tokens" height="27rem" dual=true %}

### Large text {#large}

`--color-*-large`: AAA for large text only.

### `web:color` {#web-color}

One color's six shades, no roles.

{% include terminal.html id="web_color" %}

{% include params.html generator="web:color" %}

### `web:fluid` {#web-fluid}

Fluid type and space after [Utopia](https://utopia.fyi). Refuses growth that would break 200 % zoom.

{% include terminal.html id="web_fluid" %}

{% include web-preview.html src="fluid.html" title="The type scale" height="27rem" caption="Resize the window" %}

{% include params.html generator="web:fluid" %}

## CUBE CSS {#cube}

### `web:base` {#web-base}

The entry point, a reset and base styles.

{% include terminal.html id="web_base" %}

{% include usage.html generator="web:base" %}

{% include web-preview.html src="base.html" title="Base styles" height="27rem" dual=true %}

### Compositions {#web-compositions}

Layouts after [Every Layout](https://every-layout.dev) and [SmolCSS](https://smolcss.dev), one generator each – `web:compositions` writes all.

{% include terminal.html id="web_sidebar" %}

#### `.grid` and `.wrapper`

{% include web-preview.html src="compositions-grid.html" title=".grid" height="12rem" %}
{% include usage.html generator="web:grid" %}
{% include web-preview.html src="compositions-wrapper.html" title=".wrapper" height="7rem" %}
{% include usage.html generator="web:wrapper" %}

#### `.flow`, `.cluster` and `.repel`

{% include web-preview.html src="compositions-flow.html" title=".flow" height="13rem" %}
{% include usage.html generator="web:flow" %}
{% include web-preview.html src="compositions-cluster.html" title=".cluster" height="10rem" %}
{% include usage.html generator="web:cluster" %}
{% include web-preview.html src="compositions-repel.html" title=".repel" height="5rem" %}
{% include usage.html generator="web:repel" %}

#### `.sidebar` and `.switcher`

{% include web-preview.html src="compositions-sidebar.html" title=".sidebar" height="7rem" %}
{% include usage.html generator="web:sidebar" %}
{% include web-preview.html src="compositions-switcher.html" title=".switcher" height="5rem" %}
{% include usage.html generator="web:switcher" %}

#### `.breakout`

{% include web-preview.html src="compositions-breakout.html" title=".breakout" height="19.5rem" %}
{% include usage.html generator="web:breakout" %}

#### `.center`, `.overlay`, `.reel` and `.gallery`

{% include usage.html generator="web:center" %}
{% include web-preview.html src="compositions-overlay.html" title=".overlay" height="20rem" %}
{% include usage.html generator="web:overlay" %}
{% include web-preview.html src="compositions-reel.html" title=".reel" height="6rem" %}
{% include usage.html generator="web:reel" %}
{% include web-preview.html src="compositions-gallery.html" title=".gallery" height="11rem" %}
{% include usage.html generator="web:gallery" %}

{% include params.html generator="web:compositions" %}

### Utilities {#web-utilities}

- **From your tokens**: `web:color-classes --name=<color>`, `web:step-classes`, `web:space-classes`
- **Fixed**: `web:visually-hidden`, `web:pad-fluid`, `web:unbreakable`

`web:utilities` writes all.

{% include terminal.html id="web_color_classes" %}

## Blocks {#blocks}

### `web:button` {#web-button}

Needs a palette.

{% include terminal.html id="web_button" %}

{% include web-preview.html src="buttons.html" title="Buttons" height="14rem" dual=true %}

{% include usage.html generator="web:button" %}

### `web:card` {#web-card}

{% include terminal.html id="web_card" %}

{% include web-preview.html src="card.html" title="Cards" height="37rem" dual=true %}

{% include usage.html generator="web:card" %}

### `web:avatars` {#web-avatars}

{% include terminal.html id="web_avatars" %}

{% include web-preview.html src="avatars.html" title="Avatars" height="6rem" caption="Hover or tab through them" %}

{% include usage.html generator="web:avatars" %}

### `web:nav` {#web-nav}

{% include terminal.html id="web_nav" %}

{% include web-preview.html src="nav.html" title="Navigation" height="9rem" dual=true %}

{% include usage.html generator="web:nav" %}

{% include params.html generator="web:nav" %}

### `web:badge` {#web-badge}

{% include terminal.html id="web_badge" %}

{% include web-preview.html src="badge.html" title="Badges" height="5rem" dual=true %}

{% include usage.html generator="web:badge" %}

### `web:stat` {#web-stat}

{% include terminal.html id="web_stat" %}

{% include web-preview.html src="stat.html" title="Stats" height="10rem" dual=true %}

{% include usage.html generator="web:stat" %}

### `web:table` {#web-table}

{% include terminal.html id="web_table" %}

{% include web-preview.html src="table.html" title="Table" height="15rem" dual=true caption="Scroll the rows: the header stays" %}

{% include usage.html generator="web:table" %}

### `web:list` {#web-list}

{% include terminal.html id="web_list" %}

{% include web-preview.html src="list.html" title="List" height="11rem" dual=true %}

{% include usage.html generator="web:list" %}

### `web:field` {#web-field}

{% include terminal.html id="web_field" %}

{% include web-preview.html src="field.html" title="Fields" height="20rem" dual=true %}

{% include usage.html generator="web:field" %}

## Pages and platform features {#platform}

`--into=<page.html>` adds markup before `</body>`, or before `--line`.

### `web:page` {#web-page}

`--layout=dashboard` writes [a dashboard](#dashboard); `--like=index.html` makes the next page with its header, nav and sidebar.

{% include terminal.html id="web_page" %}

{% include params.html generator="web:page" %}

### `web:manifest` {#web-manifest}

{% include terminal.html id="web_manifest" %}

{% include terminal.html id="web_manifest_png" %}

{% include params.html generator="web:manifest" %}

### `web:sw` {#web-sw}

{% include terminal.html id="web_sw" %}

{% include params.html generator="web:sw" %}

### `web:dialog` {#web-dialog}

{% include terminal.html id="web_dialog" %}

{% include web-preview.html src="dialog.html" title="A dialog" height="18rem" dual=true caption="Press the button" %}

{% include usage.html generator="web:dialog" %}

{% include params.html generator="web:dialog" %}

### `web:popover` {#web-popover}

{% include terminal.html id="web_popover" %}

{% include web-preview.html src="popover.html" title="A popover" height="11rem" dual=true caption="Press the button" %}

{% include usage.html generator="web:popover" %}

{% include params.html generator="web:popover" %}

### `web:theme-toggle` {#web-theme-toggle}

{% include terminal.html id="web_theme_toggle" %}

{% include web-preview.html src="theme-toggle.html" title="Theme toggle" height="5rem" caption="Pick one" %}

{% include usage.html generator="web:theme-toggle" %}

{% include params.html generator="web:theme-toggle" %}

### `web:scroll` {#web-scroll}

{% include terminal.html id="web_scroll" %}

{% include web-preview.html src="scroll.html" title="Scroll-driven animations" height="18rem" caption="Scroll inside the frame" %}

{% include params.html generator="web:scroll" %}

### `web:transitions` {#web-transitions}

{% include terminal.html id="web_transitions" %}

{% include web-preview.html src="transitions-a.html" title="View transitions" height="12rem" caption="Follow the link inside the frame" %}

{% include params.html generator="web:transitions" %}

## Scripts {#scripts}

In the project's [types style]({{ '/js.html#styles' | relative_url }}): TypeScript, JSDoc or plain JavaScript.

### Projects {#projects}

A new folder, with the latest versions from npm.

#### `web:vite` {#web-vite}

`npm create vite@latest`, without questions.

{% include terminal.html id="js_vite" %}

{% include params.html generator="web:vite" %}

#### `web:esbuild` {#web-esbuild}

A page bundled by [esbuild](https://esbuild.github.io/).

{% include terminal.html id="js_esbuild" %}

{% include params.html generator="web:esbuild" %}

### `web:element` {#web-element}

A custom element with typed attributes and events.

{% include terminal.html id="js_element" %}

{% include web-preview.html base="/js/" src="element.html" title="A custom element" height="13rem" dual=true caption="<code>--attrs=count:number,label,open:boolean --events='change:{value:number}'</code>: the properties are typed, and every change shows in the attributes" %}

{% include terminal.html id="js_element_jsdoc" %}

{% include params.html generator="web:element" %}

### Keyboard patterns {#keyboard}

After the [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/).

#### `web:roving` {#web-roving}

{% include terminal.html id="js_roving" %}

{% include web-preview.html base="/js/" src="roving.html" title="Roving tabindex" height="21rem" dual=true caption="Click a control, or Tab into a group, then use the arrow keys" %}

{% include params.html generator="web:roving" %}

#### `web:menu` {#web-menu}

{% include terminal.html id="js_menu" %}

{% include web-preview.html base="/js/" src="menu.html" title="Menus" height="18rem" dual=true caption="Open the menu, then try the arrow keys and typing S" %}

{% include params.html generator="web:menu" %}

#### `web:grid-navigation` {#web-grid-navigation}

{% include terminal.html id="js_grid" %}

{% include web-preview.html base="/js/" src="grid.html" title="Grid navigation" height="18rem" caption="Click a day, then use the arrow keys" %}

{% include params.html generator="web:grid-navigation" %}

#### `web:hotkeys` {#web-hotkeys}

{% include terminal.html id="js_hotkeys" %}

{% include web-preview.html base="/js/" src="hotkeys.html" title="Hotkeys" height="16rem" dual=true caption="Click into the frame, then press ?" %}

{% include params.html generator="web:hotkeys" %}

## Tailwind v4 {#tailwind}

### `web:tailwind` {#web-tailwind}

Then `web:palette` and `web:fluid` write into `@theme`.

{% include terminal.html id="web_tailwind" %}

## Checking {#checking}

### `web:check` {#web-check}

Undefined classes and palette tokens, unloaded stylesheets, unchecked color pairs. `--render` adds contrast, overflow, touching boxes and console errors from headless Chromium, if one is installed.

{% include terminal.html id="web_check" %}

{% include terminal.html id="web_check_render" %}

## Recipes {#recipes}

### A dashboard {#dashboard}

```sh
jen web:cube --primary=#0d9488 --dir=css
jen web:card --dir=css
jen web:nav --dir=css
jen web:stat --dir=css
jen web:list --dir=css
jen web:page --name=index --title=Dashboard --site=Acme --layout=dashboard
```

```html
<body class="flow" style="padding-block: var(--space-s-m)">
  <header class="wrapper repel">
    <a class="site-name" href="index.html">Acme</a>
    <nav class="nav" aria-label="Main">
      <ul role="list">
        <li><a href="index.html" aria-current="page">Overview</a></li>
        <li><a href="reports.html">Reports</a></li>
        <li><a href="settings.html">Settings</a></li>
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
      <div class="repel">
        <h1>Dashboard</h1>
        <button class="button" type="button">New report</button>
      </div>
      <div class="grid" style="--grid-min-item-size: 10rem; --stat-value-size: var(--step-2)">
        <article class="card stat"><h2 class="stat__label">Visitors</h2><p class="stat__value">12,480</p><p class="stat__trend" data-trend="up">+4 %</p></article>
        <article class="card stat"><h2 class="stat__label">Sign-ups</h2><p class="stat__value">318</p><p class="stat__trend" data-trend="flat">±0 %</p></article>
        <article class="card stat"><h2 class="stat__label">Revenue</h2><p class="stat__value">€4,210</p><p class="stat__trend" data-trend="up">+12 %</p></article>
        <article class="card stat"><h2 class="stat__label">Churn</h2><p class="stat__value">1.2 %</p><p class="stat__trend" data-trend="down">−0.3 %</p></article>
      </div>
      <section class="card" aria-labelledby="activity">
        <h2 id="activity">Recent activity</h2>
        <ul class="list list--divided" role="list">
          <li>Ada signed up – 2 min ago</li>
          <li>Invoice 1042 was paid – 1 h ago</li>
          <li>The March report was exported – yesterday</li>
        </ul>
      </section>
    </main>
  </div>
</body>
```

{% include web-preview.html src="dashboard.html" title="A dashboard" height="32rem" dual=true %}

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
- **[ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)** by the W3C WAI: the [keyboard interface practices](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/), [menubar](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/) and [grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) patterns
- **[create-vite](https://github.com/vitejs/vite/tree/main/packages/create-vite)** by the Vite team: run by `web:vite`, and the layout of `web:esbuild`
