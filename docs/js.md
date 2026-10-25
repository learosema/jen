---
layout: doc
permalink: /js.html
title: jen — js pack recipes
description: "Every jen command in @codejen/pack-js: type patterns, modules and tests – as TypeScript, JSDoc or plain JavaScript."
eyebrow: "@codejen/pack-js"
mega: scripts
lede: Every generator, with the command and the output it prints.
sub: Type patterns, modules and tests – in TypeScript, JSDoc or plain JavaScript. Projects, web components and keyboard patterns are in the <a href="web.html#scripts">web pack</a>.
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
  - title: Moved
    links:
      - { title: "To the web pack", id: moved }
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

## Moved to the web pack {#moved}

- <span id="js-vite"></span>[`web:vite`](web.html#web-vite)
- <span id="js-esbuild"></span>[`web:esbuild`](web.html#web-esbuild)
- <span id="js-element"></span>[`web:element`](web.html#web-element)
- <span id="js-roving"></span>[`web:roving`](web.html#web-roving)
- <span id="js-menu"></span>[`web:menu`](web.html#web-menu)
- <span id="js-grid"></span>[`web:grid-navigation`](web.html#web-grid-navigation)
- <span id="js-hotkeys"></span>[`web:hotkeys`](web.html#web-hotkeys)
