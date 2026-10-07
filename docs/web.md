---
layout: doc
permalink: /web.html
title: jen — web pack recipes
description: "Every jen command in @codejen/pack-web: a contrast-checked palette with dark mode, a CUBE CSS starter with fluid type and space, layout compositions, utilities, buttons and cards – with live previews."
eyebrow: "@codejen/pack-web"
mega: styles
lede: Every generator, with the command, the output it prints, and the CSS it makes – running live, in light and dark mode.
sub: Plain CSS on the web platform. WCAG AAA contrast by default, checked before anything is written.
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

## Starter {#starter}

### `web:cube` {#web-cube}

The whole starter at once: [`web:base`](#web-base), [`web:fluid`](#web-fluid), [`web:compositions`](#web-compositions) and [`web:utilities`](#web-utilities), plus [`web:palette`](#web-palette) and [`web:button`](#web-button) when you pass `--primary`. It takes every flag of `web:palette` and `web:fluid`.

{% include terminal.html id="web_cube" %}

## Tokens {#tokens}

### `web:palette` {#web-palette}

Six shades per color, from your colors, as custom properties: `--color-primary-1` (lightest) to `--color-primary-6` (darkest). The shades aren't copied from your input but placed by luminance, so every color's shade 3 is equally light – and contrast depends only on how many shades apart two colors are, across colors too:

- **2 apart**: at least 3:1 – borders, icons, large text
- **3 apart**: at least 4.5:1 – WCAG AA for text
- **4 apart**: at least 7:1 – WCAG AAA for text

So `--color-primary-5` text on `--color-danger-1` is AAA, without looking anything up. Besides your colors you get a neutral gray tinted toward the primary hue, and success, warning, danger and info.

{% include terminal.html id="web_palette" %}

{% include web-preview.html src="palette.html" title="The palette" height="32rem" dual=true caption="<code>--primary=#5b5bd6 --secondary=330</code>: labels sit at least 3 shades away from their swatch" %}

{% capture rows %}
`primary` | — | required: `#rrggbb`, `#rgb`, `oklch(L C H)` or a hue in degrees
`secondary`, `tertiary` | — | more brand colors, same formats
`neutral` | primary's hue | the gray's tint
`success`, `warning`, `danger`, `info` | built in | override the status colors
`contrast` | `aaa` | `aa` relaxes the role tokens to shades 3 apart
`tailwind` | `false` | write Tailwind's `@theme` instead – on by itself in a Tailwind project
{% endcapture %}
{% include cards.html rows=rows label="default" heading="Params" %}

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

{% capture rows %}
`minWidth`, `maxWidth` | `20`, `77.5` | the viewport range in rem (320–1240px)
`minSize`, `maxSize` | `1.125`, `1.25` | step 0 at either end, in rem
`minRatio`, `maxRatio` | `1.2`, `1.25` | how much each step grows over the last
`tailwind` | `false` | also map the scales into Tailwind's `text-*` and spacing
{% endcapture %}
{% include cards.html rows=rows label="default" heading="Params" %}

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

## Tailwind v4 {#tailwind}

### `web:tailwind` {#web-tailwind}

Sets up the entry point for Tailwind: `@import "tailwindcss"`, with Tailwind's layers fitted into the CUBE CSS order. From then on, `web:palette` writes its tokens into `@theme` under the same names – so Tailwind makes `bg-surface`, `text-on-primary`, `bg-primary-subtle`, `border-border` – and drops Tailwind's own colors, leaving only checked ones. `web:fluid` maps its scales to `text-step-1`, `p-s-m` and friends, and `web:cube` leaves the utilities to Tailwind. jen doesn't install anything: add `tailwindcss` and its build integration (e.g. `@tailwindcss/vite`) yourself.

{% include terminal.html id="web_tailwind" %}

## Credits {#credits}

The techniques follow [CUBE CSS](https://cube.fyi) by Andy Bell, [Every Layout](https://every-layout.dev) by Heydon Pickering and Andy Bell, [SmolCSS](https://smolcss.dev) by Stephanie Eckles, [Utopia](https://utopia.fyi) by James Gilyead and Trys Mudford, and the shade-distance idea of [Reasonable Colors](https://www.reasonable.work/colors/) by Matthew Howell. The CSS is written fresh for this pack, not copied. The pack is ISC licensed.
