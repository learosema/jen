---
layout: doc
permalink: /js.html
title: jen — js pack recipes
description: "Every jen command in @codejen/pack-js: custom elements with typed attributes and events, ARIA keyboard patterns, and type patterns – as TypeScript, JSDoc or plain JavaScript, with live previews."
eyebrow: "@codejen/pack-js"
mega: scripts
lede: Every generator, with the command, the output it prints, and the code it makes – running live.
sub: Web components, keyboard navigation and type patterns for the project you already have. TypeScript, JSDoc or plain JavaScript – whatever your project uses.
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

Same three ways as every jen pack. The pack writes source files into your project – nothing it writes depends on the pack or on any library.

### Globally {#install-global}

{% include terminal.html id="js_install_global" %}

### Locally {#install-local}

{% include terminal.html id="js_install_local" %}

### Not at all {#install-npx}

Ask for a `js:` generator without the pack installed and jen fetches `@codejen/pack-js` into a throwaway directory, runs it once and removes it again (first-party `@codejen` scope only; `JEN_NO_FETCH=1` turns it off).

{% include terminal.html id="js_install_npx" %}

## Output styles {#styles}

Every generator writes in one of three styles, picked from the nearest config file above the folder the files go to:

- **TypeScript**, with a `tsconfig.json`: `.ts` files using only erasable syntax – no `enum`, no namespaces, no parameter properties – so Node runs them directly, and any bundler strips them
- **JSDoc**, with a `jsconfig.json`, or a `tsconfig.json` that sets `checkJs`: `.js` files with `// @ts-check` and types in JSDoc comments, checked by your editor without a build step
- **Plain JavaScript**, with neither: the same `.js` files without the types

`--types=ts`, `--types=jsdoc` or `--types=none` overrides it. Relative imports end in `.ts` where the tsconfig allows that (`allowImportingTsExtensions` or `rewriteRelativeImportExtensions`), else in `.js`, which TypeScript maps to the `.ts` file.

Generators that take `--withTest` write a test next to the file: with Vitest if the nearest `package.json` lists it or there's a Vite or Vitest config, else with `node:test`. `--runner=node` or `--runner=vitest` overrides it.

The keyboard modules are plain files in the pack's [`templates/`](https://github.com/learosema/jen/tree/main/packages/pack-js/templates) folder, as `.ts` and as `.js` with JSDoc; the plain JavaScript is the JSDoc file with its types taken out. Elements and type patterns are made in code, from your names and types.

## Web components {#components}

### `js:element` {#js-element}

A custom element as a class, registered with `customElements.define`. Every attribute in `--attrs` gets a property that reflects it, converted to its type: numbers through `Number()`, booleans as present or absent (`toggleAttribute`), kebab-case names as camelCase properties (`max-value` becomes `maxValue`). `observedAttributes` lists them, and `attributeChangedCallback` takes only their names. Events from `--events` get a typed event map: `emit('change', { value: 1 })` checks the detail, an event without a detail takes none, and listeners added with `addEventListener('change', …)` know `event.detail.value` is a number. Events bubble, and leave a shadow root the element sits in.

It renders into the light DOM: its children stay where they are, page styles reach them, and nothing needs a slot. Its own styles go in a constructable stylesheet, adopted once by the document – or the shadow root the element is in. With `--shadow=open` or `--shadow=closed`, it gets a shadow root with a `<slot>` instead, and the stylesheet is shared by every instance's shadow root. `--form` makes it form-associated: `ElementInternals` sends its `value` with the form, and it gets `form`, `validity`, `checkValidity()` and `reportValidity()`. In TypeScript, the tag joins `HTMLElementTagNameMap`, so `document.querySelector('star-rating')` is a `StarRating`.

`--into` loads the element: in a page, its tag and a module script go in before `</body>`; in a module like `src/main.ts`, an import line goes in above the first line of code.

{% include terminal.html id="js_element" %}

{% include web-preview.html base="/js/" src="element.html" title="A custom element" height="13rem" dual=true caption="<code>--attrs=count:number,label,open:boolean --events='change:{value:number}'</code>: the properties are typed, and every change shows in the attributes" %}

JSDoc can't add to a global type from a `.js` file, so in the JSDoc style the tag goes into an `elements.d.ts` instead – the nearest one with a `// jen:elements` marker, or a new one next to the element:

{% include terminal.html id="js_element_jsdoc" %}

{% capture rows %}
`name` | — | required; the tag, lowercase with a hyphen – `star-rating` makes the class `StarRating`
`attrs` | — | `name:type` pairs: `string` (the default), `number` or `boolean`
`events` | — | `name:{detail}` pairs; quote them for the shell. Without a detail type, the event has none
`shadow` | `none` | light DOM, or `open` or `closed` for a shadow root
`form` | `false` | form-associated, with a `value` attribute
`into` | — | a page or module to load the element from
`types` | detected | `ts`, `jsdoc` or `none`
{% endcapture %}
{% include cards.html rows=rows label="default" heading="Params" %}

## Keyboard patterns {#keyboard}

The keyboard interaction of the [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/), as plain modules any page or element can use. Each exports one function that takes the container and returns a function that removes its listeners again – or pass `signal` from an `AbortController`. Arrow keys follow the writing direction, so they swap in right-to-left text.

### `js:roving` {#js-roving}

Roving tabindex: a group of controls is one stop in the tab order, and arrow keys move within it. It knows the items and arrows from the container's role – toolbars go left and right, listboxes up and down, radio groups both ways – and `aria-orientation`, `items`, `orientation` and `wrap` change that. In tab lists, radio groups and listboxes, selection follows focus: `aria-selected` or `aria-checked` moves along, and a tab list shows the panel its tab `aria-controls`. `onChange` hears about every move.

{% include terminal.html id="js_roving" %}

{% include web-preview.html base="/js/" src="roving.html" title="Roving tabindex" height="21rem" dual=true caption="Click a control, or Tab into a group, then use the arrow keys" %}

### `js:menu` {#js-menu}

Menus and menubars: arrow keys move through the items, Home and End jump to the ends, and typing a letter or two moves to the item that starts with them. On a `popover` menu, its `popovertarget` button opens it with Arrow Down or Arrow Up (at the last item), the first item gets focus, and Escape, Tab or choosing an item closes it and returns focus to the button. A submenu's items stay out of their parent's way.

{% include terminal.html id="js_menu" %}

{% include web-preview.html base="/js/" src="menu.html" title="Menus" height="18rem" dual=true caption="Open the menu, then try the arrow keys and typing S" %}

### `js:grid` {#js-grid}

Two-dimensional navigation for `role="grid"`: arrow keys move between cells, Home and End to the ends of the row, Ctrl+Home and Ctrl+End to the first and last cell, Page Up and Page Down by `pageSize` rows. A cell with a control in it focuses the control. `rows` and `cells` take other selectors, and `onMove` reports the row and column.

{% include terminal.html id="js_grid" %}

{% include web-preview.html base="/js/" src="grid.html" title="Grid navigation" height="18rem" caption="Click a day, then use the arrow keys" %}

### `js:hotkeys` {#js-hotkeys}

A registry for keyboard shortcuts: `const keys = createHotkeys()`, then `keys.bind('mod+k', openSearch, { description: 'Search' })`. `mod` is ⌘ on Apple devices and Ctrl elsewhere. Symbols like `?` match whatever Shift your keyboard layout needs for them. Bindings are ignored while someone types in a field, unless they set `inputs: true`. A binding with a `scope` only fires inside that element, and wins over a global one. `createHotkeys({ help: true })` binds `?` to a dialog that lists every binding with a description.

{% include terminal.html id="js_hotkeys" %}

{% include web-preview.html base="/js/" src="hotkeys.html" title="Hotkeys" height="16rem" dual=true caption="Click into the frame, then press ?" %}

## Type patterns {#types}

The patterns of the C++ pack's types, for TypeScript – without the syntax Node can't strip. In the JSDoc style they come with the same types, and in plain JavaScript they still work at runtime.

### `js:class` {#js-class}

A class with `#private` fields, a getter for each, and a static `create()` to put async setup or validation in later. `--fields=id:number,label:string` makes the fields and an options type for them. `--disposable` adds `[Symbol.dispose]()`, so `using timer = Timer.create(…)` cleans it up at the end of the block (in TypeScript, that needs `esnext.disposable` in `lib`).

{% include terminal.html id="js_class" %}

### `js:enum` {#js-enum}

An object `as const` instead of TypeScript's `enum`: `Direction.Up` is `'up'`, the type `Direction` is the union of the values, and `isDirection(value)` checks a value from outside.

{% include terminal.html id="js_enum" %}

### `js:union` {#js-union}

A tagged union: an interface for each case with a `kind`, the union of them, and `matchShape(shape, { circle: …, square: … })`. The handlers have to cover every case, and the `switch` inside ends in `assertNever` – add a case and forget it somewhere, and TypeScript says where.

{% include terminal.html id="js_union" %}

### `js:brand` {#js-brand}

A branded type: a `UserId` is a string, but not every string is a `UserId`. `userId(value)` checks a value and brands it, `isUserId(value)` is the check on its own – put your validation there. `--underlying` takes `string` (the default), `number` (finite only) or `bigint`.

{% include terminal.html id="js_brand" %}

### `js:error` {#js-error}

An `Error` subclass, named after itself so stack traces and logs say what went wrong, with extra fields from `--fields` and the standard `cause`: `throw new NotFoundError('No such file', { path, cause })`. The name gets an `Error` at the end if it doesn't have one.

{% include terminal.html id="js_error" %}

### `js:emitter` {#js-emitter}

An event emitter on the platform's own `EventTarget`, with the same typed event map, `emit()` and listeners as [`js:element`](#js-element) – for stores and services outside the DOM.

{% include terminal.html id="js_emitter" %}

{% capture rows %}
`name` | — | required; the type, any case – `user-id` and `UserId` both make `UserId` in `user-id.ts`
`fields` | — | `js:class`, `js:error`: `name:type` pairs
`values` | — | `js:enum`: required, the values
`cases` | — | `js:union`: required, `kind:{fields}` pairs, or a bare `kind` without fields
`underlying` | `string` | `js:brand`: `string`, `number` or `bigint`
`events` | — | `js:emitter`: required, like `js:element`'s
`disposable` | `false` | `js:class`: add `Symbol.dispose`
`withTest` | `false` | a test next to it
`runner` | detected | `node` or `vitest`
`types` | detected | `ts`, `jsdoc` or `none`
{% endcapture %}
{% include cards.html rows=rows label="default" heading="Params" %}

## Modules and tests {#tests}

### `js:module` {#js-module}

A module with one exported function of the same name, to fill in – and with `--withTest`, its test.

{% include terminal.html id="js_module" %}

### `js:test` {#js-test}

A test file for a module that's already there: it imports every function, class and constant the module exports and starts a test for each, with `node:test` or Vitest. For a module that doesn't exist yet, it imports the module as a whole, ready for test-first.

{% include terminal.html id="js_test" %}

## Credits {#credits}

The keyboard patterns follow the **[ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)** by the W3C Web Accessibility Initiative – roving tabindex and keyboard shortcuts from its [keyboard interface practices](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/), menus from the [menu and menubar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/), grids from the [grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/). Each module credits it in its first line.

The code is written fresh for this pack, not copied. The pack is ISC licensed.
