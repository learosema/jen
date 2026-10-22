---
layout: doc
permalink: /js.html
title: jen — js pack recipes
description: "Every jen command in @codejen/pack-js: new Vite and esbuild projects, custom elements with typed attributes and events, ARIA keyboard patterns, and type patterns – as TypeScript, JSDoc or plain JavaScript, with live previews."
eyebrow: "@codejen/pack-js"
mega: scripts
lede: Every generator, with the command, the output it prints, and the code it makes – running live.
sub: Vite and esbuild projects, web components, keyboard navigation and type patterns – in TypeScript, JSDoc or plain JavaScript.
cta: { text: "Three ways to install ↓", url: "#install" }
toc:
  - title: Install
    links:
      - { title: Globally, id: install-global }
      - { title: Locally, id: install-local }
      - { title: Not at all, id: install-npx }
  - title: Output styles
    links:
      - { title: "TypeScript, JSDoc or plain", id: styles }
  - title: Projects
    links:
      - { title: "js:vite", id: js-vite }
      - { title: "js:esbuild", id: js-esbuild }
  - title: Web components
    links:
      - { title: "js:element", id: js-element }
  - title: Keyboard patterns
    links:
      - { title: "js:roving", id: js-roving }
      - { title: "js:menu", id: js-menu }
      - { title: "js:grid", id: js-grid }
      - { title: "js:hotkeys", id: js-hotkeys }
  - title: Type patterns
    links:
      - { title: "js:class", id: js-class }
      - { title: "js:enum", id: js-enum }
      - { title: "js:union", id: js-union }
      - { title: "js:brand", id: js-brand }
      - { title: "js:error", id: js-error }
      - { title: "js:emitter", id: js-emitter }
  - title: Modules and tests
    links:
      - { title: "js:module", id: js-module }
      - { title: "js:test", id: js-test }
  - title: Finally
    links:
      - { title: Credits, id: credits }
---

## Install {#install}

The generated code depends on nothing.

### Globally {#install-global}

{% include terminal.html id="js_install_global" %}

### Locally {#install-local}

{% include terminal.html id="js_install_local" %}

### Not at all {#install-npx}

Any `js:` generator without the pack fetches it for one run (`JEN_NO_FETCH=1` turns that off).

{% include terminal.html id="js_install_npx" %}

## Output styles {#styles}

Picked by the nearest config file, or `--types=ts|jsdoc|none`:

- **TypeScript** (`tsconfig.json`): erasable syntax only, so Node runs it directly
- **JSDoc** (`jsconfig.json`, or `checkJs`): `// @ts-check` `.js` files
- **Plain JavaScript**: neither

Imports end in `.ts` if the tsconfig allows it, else `.js`.

`--withTest` uses Vitest if the project has it, else `node:test` (or `--runner=node|vitest`).

## Projects {#projects}

A new folder `--name` (must be empty), with the latest versions from npm. Run `npm install` afterwards. Plain JavaScript unless `--types=ts`; later generators follow that style.

### `js:vite` {#js-vite}

Runs `npm create vite@latest` without questions, for any [create-vite](https://github.com/vitejs/vite/tree/main/packages/create-vite) `--framework` (`vanilla`, `vue`, `react`, `svelte`, …), and turns the result into jen's plan.

{% include terminal.html id="js_vite" %}

{% include params.html generator="js:vite" %}

### `js:esbuild` {#js-esbuild}

A counter page bundled by [esbuild](https://esbuild.github.io/): `build` and a watching `dev` server. Also takes `--types=jsdoc`. TypeScript gets a `check` script. `--withTest` adds a `node:test` test (or `--runner=vitest`).

{% include terminal.html id="js_esbuild" %}

{% include params.html generator="js:esbuild" %}

## Web components {#components}

### `js:element` {#js-element}

A custom element. `--attrs` become typed, reflecting properties (`max-value` → `maxValue`). `--events` get a typed event map, so `emit('change', { value: 1 })` and listeners are checked.

Light DOM by default, with a shared constructable stylesheet; `--shadow=open|closed` uses a shadow root and `<slot>`. `--form` makes it form-associated. In TypeScript, the tag joins `HTMLElementTagNameMap`.

`--into` adds the tag and script to a page, or an import to a module.

{% include terminal.html id="js_element" %}

{% include web-preview.html base="/js/" src="element.html" title="A custom element" height="13rem" dual=true caption="<code>--attrs=count:number,label,open:boolean --events='change:{value:number}'</code>: the properties are typed, and every change shows in the attributes" %}

In JSDoc style, the tag goes into the nearest `elements.d.ts` with `// jen:elements`, or a new one:

{% include terminal.html id="js_element_jsdoc" %}

{% include params.html generator="js:element" %}

## Keyboard patterns {#keyboard}

[ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) keyboard handling as plain modules. Each takes a container and returns a cleanup function (or takes a `signal`). Arrow keys respect right-to-left text.

### `js:roving` {#js-roving}

Roving tabindex: one tab stop per group, arrow keys within, direction from the container's role. In tabs, radio groups and listboxes, selection follows focus. `onChange` reports moves.

{% include terminal.html id="js_roving" %}

{% include web-preview.html base="/js/" src="roving.html" title="Roving tabindex" height="21rem" dual=true caption="Click a control, or Tab into a group, then use the arrow keys" %}

{% include params.html generator="js:roving" %}

### `js:menu` {#js-menu}

Menus and menubars: arrows, Home/End, type-ahead. `popover` menus open with the arrow keys and close with Escape, Tab or a choice, returning focus to the button.

{% include terminal.html id="js_menu" %}

{% include web-preview.html base="/js/" src="menu.html" title="Menus" height="18rem" dual=true caption="Open the menu, then try the arrow keys and typing S" %}

{% include params.html generator="js:menu" %}

### `js:grid` {#js-grid}

`role="grid"` navigation: arrows, Home/End, Ctrl+Home/End, Page Up/Down. `onMove` reports row and column.

{% include terminal.html id="js_grid" %}

{% include web-preview.html base="/js/" src="grid.html" title="Grid navigation" height="18rem" caption="Click a day, then use the arrow keys" %}

{% include params.html generator="js:grid" %}

### `js:hotkeys` {#js-hotkeys}

Keyboard shortcuts: `createHotkeys().bind('mod+k', openSearch, { description: 'Search' })`. `mod` is ⌘ or Ctrl. Ignored in text fields unless `inputs: true`; `scope` limits a binding to an element. `{ help: true }` binds `?` to a list of all shortcuts.

{% include terminal.html id="js_hotkeys" %}

{% include web-preview.html base="/js/" src="hotkeys.html" title="Hotkeys" height="16rem" dual=true caption="Click into the frame, then press ?" %}

{% include params.html generator="js:hotkeys" %}

## Type patterns {#types}

The C++ pack's type patterns, in strippable TypeScript or JSDoc.

### `js:class` {#js-class}

`#private` fields from `--fields=id:number,label:string`, getters, and a static `create()`. `--disposable` adds `[Symbol.dispose]()` for `using`.

{% include terminal.html id="js_class" %}

{% include params.html generator="js:class" %}

### `js:enum` {#js-enum}

An `as const` object instead of `enum`, with a union type and an `isDirection()` guard.

{% include terminal.html id="js_enum" %}

{% include params.html generator="js:enum" %}

### `js:union` {#js-union}

A tagged union with an exhaustive `matchShape(shape, { circle: …, square: … })` – forget a case and TypeScript says where.

{% include terminal.html id="js_union" %}

{% include params.html generator="js:union" %}

### `js:brand` {#js-brand}

A branded type: not every string is a `UserId`. `userId()` validates and brands; `isUserId()` checks. `--underlying` is `string`, `number` or `bigint`.

{% include terminal.html id="js_brand" %}

{% include params.html generator="js:brand" %}

### `js:error` {#js-error}

An `Error` subclass with its own name, `--fields` and `cause`: `throw new NotFoundError('No such file', { path, cause })`.

{% include terminal.html id="js_error" %}

{% include params.html generator="js:error" %}

### `js:emitter` {#js-emitter}

A typed `EventTarget`, like [`js:element`](#js-element)'s, for code outside the DOM.

{% include terminal.html id="js_emitter" %}

{% include params.html generator="js:emitter" %}

## Modules and tests {#tests}

### `js:module` {#js-module}

A module with one function, optionally `--withTest`.

{% include terminal.html id="js_module" %}

{% include params.html generator="js:module" %}

### `js:test` {#js-test}

A test per export of an existing module – or a test-first stub for a new one.

{% include terminal.html id="js_test" %}

{% include params.html generator="js:test" %}

## Credits {#credits}

- **[ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)** by the W3C WAI: the [keyboard interface practices](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/), [menubar](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/) and [grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) patterns
- **[create-vite](https://github.com/vitejs/vite/tree/main/packages/create-vite)** by the Vite team: run by `js:vite`, and the layout of `js:esbuild`
