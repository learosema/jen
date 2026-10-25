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
      - { title: "TS or JSDoc", id: styles }
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
  - title: Modules
    links:
      - { title: "js:module", id: js-module }
      - { title: "js:test", id: js-test }
  - title: Finally
    links:
      - { title: Credits, id: credits }
---

## Install {#install}

### Globally {#install-global}

{% include terminal.html id="js_install_global" %}

### Locally {#install-local}

{% include terminal.html id="js_install_local" %}

### Not at all {#install-npx}

{% include terminal.html id="js_install_npx" %}

## Output styles {#styles}

From `tsconfig.json`, `jsconfig.json` or neither – or `--types=ts|jsdoc|none`.

`--withTest`: Vitest if the project has it, else `node:test`.

## Projects {#projects}

A new folder, with the latest versions from npm.

### `js:vite` {#js-vite}

`npm create vite@latest`, without questions.

{% include terminal.html id="js_vite" %}

{% include params.html generator="js:vite" %}

### `js:esbuild` {#js-esbuild}

A page bundled by [esbuild](https://esbuild.github.io/).

{% include terminal.html id="js_esbuild" %}

{% include params.html generator="js:esbuild" %}

## Web components {#components}

### `js:element` {#js-element}

A custom element with typed attributes and events.

{% include terminal.html id="js_element" %}

{% include web-preview.html base="/js/" src="element.html" title="A custom element" height="13rem" dual=true caption="<code>--attrs=count:number,label,open:boolean --events='change:{value:number}'</code>: the properties are typed, and every change shows in the attributes" %}

{% include terminal.html id="js_element_jsdoc" %}

{% include params.html generator="js:element" %}

## Keyboard patterns {#keyboard}

After the [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/).

### `js:roving` {#js-roving}

{% include terminal.html id="js_roving" %}

{% include web-preview.html base="/js/" src="roving.html" title="Roving tabindex" height="21rem" dual=true caption="Click a control, or Tab into a group, then use the arrow keys" %}

{% include params.html generator="js:roving" %}

### `js:menu` {#js-menu}

{% include terminal.html id="js_menu" %}

{% include web-preview.html base="/js/" src="menu.html" title="Menus" height="18rem" dual=true caption="Open the menu, then try the arrow keys and typing S" %}

{% include params.html generator="js:menu" %}

### `js:grid` {#js-grid}

{% include terminal.html id="js_grid" %}

{% include web-preview.html base="/js/" src="grid.html" title="Grid navigation" height="18rem" caption="Click a day, then use the arrow keys" %}

{% include params.html generator="js:grid" %}

### `js:hotkeys` {#js-hotkeys}

{% include terminal.html id="js_hotkeys" %}

{% include web-preview.html base="/js/" src="hotkeys.html" title="Hotkeys" height="16rem" dual=true caption="Click into the frame, then press ?" %}

{% include params.html generator="js:hotkeys" %}

## Type patterns {#types}

### `js:class` {#js-class}

{% include terminal.html id="js_class" %}

{% include params.html generator="js:class" %}

### `js:enum` {#js-enum}

{% include terminal.html id="js_enum" %}

{% include params.html generator="js:enum" %}

### `js:union` {#js-union}

{% include terminal.html id="js_union" %}

{% include params.html generator="js:union" %}

### `js:brand` {#js-brand}

{% include terminal.html id="js_brand" %}

{% include params.html generator="js:brand" %}

### `js:error` {#js-error}

{% include terminal.html id="js_error" %}

{% include params.html generator="js:error" %}

### `js:emitter` {#js-emitter}

{% include terminal.html id="js_emitter" %}

{% include params.html generator="js:emitter" %}

## Modules and tests {#tests}

### `js:module` {#js-module}

{% include terminal.html id="js_module" %}

{% include params.html generator="js:module" %}

### `js:test` {#js-test}

{% include terminal.html id="js_test" %}

{% include params.html generator="js:test" %}

## Credits {#credits}

- **[ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)** by the W3C WAI: the [keyboard interface practices](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/), [menubar](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/) and [grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) patterns
- **[create-vite](https://github.com/vitejs/vite/tree/main/packages/create-vite)** by the Vite team: run by `js:vite`, and the layout of `js:esbuild`
