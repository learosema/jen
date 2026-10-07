# @codejen/pack-web

A [jen](https://github.com/learosema/jen) pack for web development: a contrast-checked color palette with light and dark mode, a CUBE CSS layer setup with a modern reset, and buttons that keep their contrast in every state. Plain CSS on the web platform – no framework, no build step required.

## Install

```sh
npm install --save-dev @codejen/pack-web   # or: npm install -g @codejen/jen @codejen/pack-web
```

jen picks the pack up automatically; see jen's own README for how pack discovery works.

```sh
jen web:base --dir=src/css
jen web:palette --primary=#5b5bd6 --secondary=330 --dir=src/css
jen web:button --dir=src/css
```

Then link `src/css/styles.css` from your page, or `import './css/styles.css'` in a Vite project.

## web:base

Writes the stylesheet entry point `styles.css`, plus `reset.css` and `base.css`.

`styles.css` declares the cascade layers in CUBE CSS order – `reset, tokens, base, compositions, utilities, blocks, exceptions` – so a later layer wins over an earlier one whatever the selectors' specificity. It ends with a `/* jen:imports */` marker; the other generators add their `@import` lines above it.

The reset removes default margins, sets `box-sizing`, makes media blocks, balances headings and prettifies paragraphs (`text-wrap`), and turns off animations for `prefers-reduced-motion`. The base styles keep the scrollbar gutter stable, add a visible `:focus-visible` ring and use the palette's colors – with system colors as fallbacks, so they work before `web:palette` has run.

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

- **Neutral**: `--color-surface`, `--color-surface-2`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-focus`
- **Per color** (shown for primary): `--color-primary`, `--color-primary-strong` (hover), `--color-primary-subtle` (tinted background), `--color-on-primary` (text on the color), `--color-primary-large` (large text only)

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

- **Text level** (7:1 by default, 4.5:1 with `--contrast=aa`): `--color-text` on `--color-surface` and `--color-surface-2`, `--color-text-muted` on `--color-surface`; per color, `--color-on-primary` on `--color-primary` and `--color-primary-strong`, `--color-primary` on `--color-surface` and `--color-primary-subtle`
- **Large text level** (4.5:1, or 3:1 with `--contrast=aa`): `--color-on-primary` on `--color-primary-large`, `--color-primary-large` on `--color-surface` and `--color-primary-subtle`
- **UI** (3:1): `--color-border` on `--color-surface` and `--color-surface-2`, `--color-focus` on `--color-surface`

Set `data-theme="light"` or `data-theme="dark"` on `<html>` to force a mode.

To change colors later, run the command again with `--force`; the header records the command that made the file.

## web:button

A `.button` block in the `blocks` layer, built on the palette's role tokens: the text on its fill and on its hover fill, the fill against the page, and the focus ring all keep the palette's checked contrast, in light and dark mode. It needs a palette in the project.

```html
<button class="button">Save</button>
<a class="button button--outline" href="/docs">Read the docs</a>
<button class="button button--danger button--small">Delete</button>
```

Modifiers:

- **Colors**: `--secondary` and `--tertiary` (if the palette has them) and `--danger`
- **Styles**: `--outline` (primary text and border on the page background), `--ghost` (no border)
- **Shape and size**: `--pill`, `--small`, `--large`

Disabled buttons (`disabled` or `aria-disabled="true"`) are muted. For your own variant, set `--button-bg`, `--button-bg-hover`, `--button-fg` and `--button-border` in a modifier.

## Where files go

Files go into the current directory, or `--dir`. `@import` lines go into the nearest stylesheet with the `jen:imports` marker – in the destination or a folder above it, else the shallowest one in the project – with the path relative to that stylesheet. Without one, the plan shows the import as skipped; files that already exist are left alone.

## License

ISC © Lea Rosema
