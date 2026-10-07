# @codejen/pack-web

A [jen](https://github.com/learosema/jen) pack for web development: a contrast-checked color palette with light and dark mode, a CUBE CSS starter – layers, modern reset, fluid type and space, layout compositions, utilities – and buttons that keep their contrast in every state. Plain CSS on the web platform – no framework, no build step required.

## Install

```sh
npm install --save-dev @codejen/pack-web   # or: npm install -g @codejen/jen @codejen/pack-web
```

jen picks the pack up automatically; see jen's own README for how pack discovery works.

```sh
jen web:cube --primary=#5b5bd6 --secondary=330 --dir=src/css
```

That's the whole starter at once; every part also has its own generator:

```sh
jen web:base --dir=src/css
jen web:palette --primary=#5b5bd6 --secondary=330 --dir=src/css
jen web:fluid --dir=src/css
jen web:compositions --dir=src/css
jen web:utilities --dir=src/css
jen web:button --dir=src/css
```

Then link `src/css/styles.css` from your page, or `import './css/styles.css'` in a Vite project.

## web:base

Writes the stylesheet entry point `styles.css`, plus `reset.css` and `base.css`.

`styles.css` declares the cascade layers in CUBE CSS order – `reset, tokens, base, compositions, utilities, blocks, exceptions` – so a later layer wins over an earlier one whatever the selectors' specificity. It ends with a `/* jen:imports */` marker; the other generators add their `@import` lines above it.

The reset removes default margins, sets `box-sizing`, makes media blocks, balances headings and prettifies paragraphs (`text-wrap`), and turns off animations for `prefers-reduced-motion`. The base styles keep the scrollbar gutter stable, add a visible `:focus-visible` ring and use the palette's colors – with system colors as fallbacks, so they work before `web:palette` has run.

A few touches follow [SmolCSS](https://smolcss.dev):

- **Transition tokens**: `--transition-duration` and `--transition-easing`, with the duration 0 under `prefers-reduced-motion`
- **Visited links** in the strong primary shade
- **List icons**: `<li data-icon="✅">` uses the attribute as its marker
- **Heading anchors**: a `#` link inside an `h2`–`h4` is muted, and a heading you jump to is highlighted

If the project already has a stylesheet with the `jen:imports` marker, `web:base` wires its two files into that one instead of creating `styles.css`.

## web:palette

```sh
jen web:palette --primary=#5b5bd6 [--secondary=… --tertiary=…] [--neutral=…] [--success=… --warning=… --danger=… --info=…] [--contrast=aaa|aa]
```

Colors are `#rrggbb`, `#rgb`, `oklch(L C H)` or a bare hue in degrees (`--secondary=330`).

Every color gets six shades, `--color-primary-1` (lightest) to `--color-primary-6` (darkest). Shades are placed by luminance rather than copied, so every color's shade 3 is equally light, and contrast depends only on how many shades apart two colors are – across colors, too:

- **2 apart**: at least 3:1 – borders, icons, large text
- **3 apart**: at least 4.5:1 – WCAG AA for text
- **4 apart**: at least 7:1 – WCAG AAA for text

So `--color-primary-5` text on `--color-danger-1` is AAA, without looking anything up.

Besides your brand colors you get a neutral gray (tinted toward the primary hue unless you pass `--neutral`) and the status colors success, warning, danger and info, with defaults you can override.

### Role tokens and dark mode

On top of the shades come role tokens that switch between light and dark mode with `light-dark()`, following `color-scheme` (browsers without `light-dark()` get the same through `prefers-color-scheme`):

- **Neutral**: `--color-surface`, `--color-surface-2` (cards, sidebars), `--color-text`, `--color-text-muted`, `--color-border`, `--color-focus`
- **Per color** (shown for primary): `--color-primary`, `--color-primary-strong` (hover, and colored text on tints), `--color-primary-subtle` (tinted background), `--color-on-primary` (text on the color), `--color-primary-large` (large text only)

`--color-surface-2` and the `-subtle` tints sit between shades (1.4 in light mode, 5.6 in dark mode), so they stand out from the page while text on them keeps the full level. Use `-strong` for colored text on a tint.

The text pairs meet WCAG AAA by default (shades 4 apart); `--contrast=aa` relaxes them to 3 apart.

Large text – at least 1.5rem, or 1.1667rem bold, at the default font size – needs less contrast for the same level (4.5:1 for AAA). The `-large` roles use that: they sit one shade closer to the background, so an h1 or a hero can be more colorful and still be AAA:

```css
h1 {
  color: var(--color-primary-large);
}

.hero {
  background: var(--color-primary-large);
  color: var(--color-on-primary);
  font-size: 2.5rem;
}
```

Before anything is written, these pairs are measured on the final hex values, in light and dark mode – if one ever missed, the generator would fail instead of writing the file:

- **Text level** (7:1 by default, 4.5:1 with `--contrast=aa`): `--color-text` and `--color-text-muted` on `--color-surface` and `--color-surface-2`; per color, `--color-on-primary` on `--color-primary` and `--color-primary-strong`, `--color-primary` on `--color-surface`, `--color-text` and `--color-primary-strong` on `--color-primary-subtle`, `--color-primary-strong` on `--color-surface-2`
- **Large text level** (4.5:1, or 3:1 with `--contrast=aa`): `--color-on-primary` on `--color-primary-large`, `--color-primary-large` on `--color-surface`
- **UI** (3:1): `--color-border` on `--color-surface` and `--color-surface-2`, `--color-focus` on `--color-surface`

Set `data-theme="light"` or `data-theme="dark"` on `<html>` to force a mode.

To change colors later, run the command again with `--force`; the header records the command that made the file.

## web:fluid

```sh
jen web:fluid [--minWidth=20 --maxWidth=77.5] [--minSize=1.125 --maxSize=1.25] [--minRatio=1.2 --maxRatio=1.25]
```

Fluid type and space scales in the style of [Utopia](https://utopia.fyi): every size grows smoothly from its value at `--minWidth` to its value at `--maxWidth` with `clamp()`. All lengths are in rem (the defaults are Utopia's 320–1240px and 18–20px); the rem part of each formula keeps text zoomable.

- **Type**: `--step--2` to `--step-5`, step 0 being `--minSize`/`--maxSize`, each step up multiplied by `--minRatio`/`--maxRatio`
- **Space**: `--space-3xs` to `--space-3xl` as multiples of step 0, one-up pairs that grow more (`--space-xs-s`, `--space-s-m`, …) and `--space-s-l`

A size that grows more than 2.5× across the range is refused: browser zoom couldn't reach 200% text size anymore (WCAG 1.4.4).

`web:base` uses the steps for body text and headings when they exist.

## web:compositions

```sh
jen web:compositions [--only=flow,cluster,sidebar]
```

CUBE CSS compositions – layout primitives after [Every Layout](https://every-layout.dev) and [SmolCSS](https://smolcss.dev) – in the `compositions` layer. Each is tuned with custom properties that fall back to the fluid space tokens, then to fixed rem values:

- **`.flow`**: vertical space between siblings – `--flow-space`
- **`.cluster`**: items that wrap as a group, like tags or nav links – `--gutter`, `--cluster-justify`, `--cluster-align`
- **`.repel`**: two groups pushed to either end – `--gutter`, `--repel-align`
- **`.sidebar`**: a sidebar beside the content, stacking when the content would get narrower than `--sidebar-content-min`; the first child is the sidebar, or the last with `data-direction="end"` – `--sidebar-target`
- **`.switcher`**: side by side above `--switcher-threshold`, stacked below; five or more items always stack
- **`.grid`**: as many columns as fit, each at least `--grid-min-item-size`; a few items stretch to fill the row
- **`.wrapper`**: a centered column up to `--wrapper-max-width` that never touches the viewport edges (`--wrapper-gutter`)
- **`.center`**: content centered in both directions
- **`.overlay`**: children layered in one grid cell, like text over an image
- **`.breakout`**: a text column (`--breakout-max-width`) whose children can break out with `data-breakout="wide"` or `data-breakout="full"`
- **`.reel`**: a horizontally scrolling row that snaps to its items – `--reel-item-size`
- **`.gallery`**: media in wrapping rows, cropped to `--gallery-ratio` – `--gallery-min-item-size`

## web:utilities

Utility classes from your tokens, in the `utilities` layer: `.color-*` and `.bg-*` for every role token (not the raw shades, so you stay on checked pairs), `.step-*` font sizes, `.flow-space-*` and `.gutter-*` for every space size, `.pad-fluid` (padding that grows with its container), `.unbreakable` (long words and URLs wrap) and `.visually-hidden`. Run it after `web:palette` and `web:fluid`, and again with `--force` when they change. In a Tailwind project it refuses: Tailwind's utilities take their place.

## web:cube

```sh
jen web:cube [--primary=#5b5bd6 …] [--minWidth=… …]
```

The whole starter at once: `web:base`, `web:fluid`, `web:compositions` and `web:utilities`, plus `web:palette` and `web:button` when `--primary` is given. It takes the flags of `web:palette` and `web:fluid`.

## Tailwind v4

```sh
jen web:tailwind --dir=src/css
jen web:cube --primary=#5b5bd6 --dir=src/css
```

`web:tailwind` sets up the entry point for Tailwind: `@import "tailwindcss"`, and Tailwind's layers fitted into the CUBE CSS order – `theme, reset, tokens, base, compositions, components, utilities, blocks, exceptions`. jen doesn't install anything, so add `tailwindcss` and its build integration (e.g. `@tailwindcss/vite`) yourself.

From then on, `web:palette`, `web:fluid` and `web:cube` notice Tailwind (or take `--tailwind`):

- **`web:palette`** writes its tokens into `@theme` under the same names, so Tailwind makes classes from them – `bg-surface`, `text-text-muted`, `bg-primary`, `text-on-primary`, `bg-primary-subtle`, `border-border`, `bg-primary-5`, … It also drops Tailwind's own colors (`--color-*: initial`), leaving only the checked ones.
- **`web:fluid`** maps its scales into Tailwind's namespaces: `text-step-1`, `p-s-m`, `gap-xs-s`, …
- **`web:cube`** leaves out `web:utilities`; Tailwind's utilities take its place.

A palette made before `web:tailwind` needs a re-run with `--force`.

## web:button

A `.button` block in the `blocks` layer, built on the palette's role tokens: the text on its fill and on its hover fill, the fill against the page, and the focus ring all keep the palette's checked contrast, in light and dark mode. It needs a palette in the project.

```html
<button class="button">Save</button>
<a class="button button--outline" href="/docs">Read the docs</a>
<button class="button button--danger button--small">Delete</button>
```

Modifiers:

- **Colors**: `--secondary` and `--tertiary` (if the palette has them) and `--danger`
- **Styles**: `--outline` (primary text and border on the page background, `-strong` text on its tinted hover), `--ghost` (no border)
- **Shape and size**: `--pill`, `--small`, `--large`

Disabled buttons (`disabled` or `aria-disabled="true"`) are muted. For your own variant, set `--button-bg`, `--button-bg-hover`, `--button-fg`, `--button-fg-hover` and `--button-border` in a modifier.

## web:card and web:avatars

Two blocks after [SmolCSS](https://smolcss.dev), on the palette's checked pairs:

- **`web:card`**: a composable `.card` – any children get its padding, an image or video first or last goes edge to edge, and the last child sits at the bottom, so footers line up across a row of cards. Links in it use `--color-primary-strong`.
- **`web:avatars`**: `<ul class="avatars">` – overlapping round avatars that move apart on hover or focus. Each step is at least 2.75rem wide, the WCAG AAA target size, for avatars that are links. `--avatar-size` sets the size.

## Credits

The layout techniques follow [CUBE CSS](https://cube.fyi) by Andy Bell, [Every Layout](https://every-layout.dev) by Heydon Pickering and Andy Bell, [SmolCSS](https://smolcss.dev) by Stephanie Eckles, and [Utopia](https://utopia.fyi) by James Gilyead and Trys Mudford. The CSS is written fresh for this pack, not copied.

## Where files go

Files go into the current directory, or `--dir`. `@import` lines go into the nearest stylesheet with the `jen:imports` marker – in the destination or a folder above it, else the shallowest one in the project – with the path relative to that stylesheet. Without one, the plan shows the import as skipped; files that already exist are left alone.

## License

ISC © Lea Rosema
