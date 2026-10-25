---
layout: doc
permalink: /generators.html
title: jen — writing generators
description: "How to write a jen generator: params, actions, case helpers, the project context, where jen finds generators, and how to publish them as a pack."
eyebrow: "@codejen/jen"
mega: write
lede: A generator is one file – the <code>params</code> it takes and an <code>actions()</code> function saying what should happen.
sub: Plain JavaScript or TypeScript. No template language, no plugin API, no prompts.
cta: { text: "Your first generator ↓", url: "#start" }
toc:
  - title: Getting started
    links:
      - { title: First steps, id: start }
      - { title: From existing files, id: like }
      - { title: A generator, id: generator }
  - title: Reference
    links:
      - { title: Params, id: params }
      - { title: Examples, id: examples }
      - { title: Actions, id: actions }
      - { title: EditorConfig, id: editorconfig }
      - { title: Helpers, id: helpers }
      - { title: Context, id: context }
      - { title: Types, id: types }
  - title: Sharing
    links:
      - { title: Lookup, id: lookup }
      - { title: Packs, id: packs }
      - { title: VS Code tasks, id: vscode }
  - title: Finally
    links:
      - { title: Developing jen, id: develop }
---

## Getting started {#getting-started}

### Your first generator {#start}

```sh
jen generator --name=hello --location=project
```

Writes `.jen/hello.mjs`; `--location=user` for every project.

### Start from existing files {#like}


```sh
jen generator --name=route --like=src/routes/users.js,test/routes/users.test.js
```

```
  + .jen/route.mjs
  info: .jen/route.mjs reproduces src/routes/users.js, test/routes/users.test.js – replaced users 10×; check where the name shouldn't change
  info: src/routes/index.js mentions users too (lines 2 and 6) – add inserts for it (docs: Actions)
✓ 1 written
```

The word that varies is `--word`, or the first file's name; every spelling the [helpers](#helpers) make is replaced, whole names only. Other files that mention it are only named – add [`insert`](#actions)s.

### A generator {#generator}

`params` and `actions()`, named or as a default export:

```js
// .jen/class.mjs
export const description = "C++ class";

export const params = {
  name: {},
  moveOnly: { default: false },
};

export const actions = ({ name, moveOnly }, { pascal }) => {
  const Name = pascal(name);
  return [
    {
      add: `${Name}.h`,
      template: `#pragma once

class ${Name} {
public:
	explicit ${Name}();
${
  moveOnly
    ? `
	${Name}(const ${Name}&) = delete;
	${Name}& operator=(const ${Name}&) = delete;
	${Name}(${Name}&&) noexcept = default;
	${Name}& operator=(${Name}&&) noexcept = default;
`
    : ""
}
private:
};
`,
    },
    {
      add: `${Name}.cpp`,
      template: `#include "${Name}.h"\n\n${Name}::${Name}() = default;\n`,
    },
    {
      insert: { find: "CMakeLists.txt" },
      before: "# jen:sources",
      path: `${Name}.cpp`,
    },
  ];
};
```

`.mjs`, `.js`, `.ts` or `.mts`; `actions()` may be `async`.

## Reference {#reference}

### Params {#params}


```js
export const params = {
  name: {},                     // required – jen stops with a clear message if it's missing
  namespace: { default: "" },   // a string, used as is when not given
  moveOnly: {                   // a boolean – the default's type decides how the value is read
    default: false,
    description: "RAII wrapper: copy deleted, move defaulted (Rule of Five)",
  },
  into: { path: true, default: "" }, // a path the user types, relative to where they stand
  std: { default: "23", choices: ["20", "23"] }, // only these values
};
```

No prompts: check in `actions()` and throw.

### Examples and usage {#examples}


```js
export const examples = ["--name=Camera", "--name=Texture --moveOnly"];
```


```js
export const usage = [
  '<div class="sidebar"><aside>…</aside><main>…</main></div>',
  'the first child is the sidebar; data-direction="end" makes it the last',
  ".sidebar { --sidebar-target: 20rem; }  the sidebar's width",
];
```

### Actions {#actions}

- **`add`**: `{ add, template, force? }` creates a file, skipped if it exists unless `force`/`--force`. `{ add, bytes }` writes a `Uint8Array`.
- **`insert`**: `{ insert, before | after, line | path }` – before the first or after the last line containing (or matching, or numbered) the marker, at its indentation. Never twice.
- **`modify`**: `{ modify, pattern, replace }` – `RegExp` replace, every run.
- **`append`**: `{ append, text }` – at the end, never twice.
- **`note`**: `{ note, file?, written?, warning? }` – an `info:` or `warning:` line.
- **`delete`**: `{ delete }` – a file, never a directory.

Paths are relative to where the files go; `/` starts at the project root. `{ find, containing? }` finds the nearest matching file for `insert` and `modify`. A marker is a comment:

```cmake
target_sources(app PRIVATE
	main.cpp
	# jen:sources
)
```

Without a marker:

```js
const index = { find: "index.js", containing: "export const routes" };

export const actions = ({ name }, { camel, kebab }) => [
  { insert: index, after: /^import /, line: `import { ${camel(name)} } from './${kebab(name)}.js';` },
  { insert: index, before: /^\];/, line: `${camel(name)},` },
];
```

Undoing one:

```js
// .jen/destroy.mjs
export const params = { name: {} };

export const actions = ({ name }, { pascal }) => [
  { delete: `${pascal(name)}.h` },
  { delete: `${pascal(name)}.cpp` },
  {
    modify: { find: "CMakeLists.txt", containing: "# jen:sources" },
    pattern: new RegExp(`^\\s*${pascal(name)}\\.cpp\\n`, "m"),
    replace: "",
  },
];
```

### EditorConfig {#editorconfig}

New files follow `.editorconfig`; inserted text is reindented to it, or to the file's own style.

### Helpers {#helpers}

The second argument to `actions()`. For `'rigid body'`:

- **`pascal`**: `RigidBody`
- **`camel`**: `rigidBody`
- **`snake`**: `rigid_body`
- **`kebab`**: `rigid-body`
- **`constant`**: `RIGID_BODY`

### Context {#context}


- **`ctx.destDir`**: where the files go, relative to the project root.
- **`ctx.root`** and **`ctx.cwd`**: the absolute project root, and the current directory relative to it.
- **`ctx.exists`**, **`isDir`**, **`read`**, **`readdir`** (`path`), **`findUp`**, **`grep`** (`name, text?`): read-only, paths from the root.
- **`ctx.args`**: all flags (but jen's own and `--dir`) and positionals – for generators that set `passthrough: true`, like [pack-yeoman]({{ '/yeoman.html' | relative_url }}).

### Types {#types}


```js
// @ts-check
/** @type {import('@codejen/jen').Generator} */
export default {
  params: { name: {} },
  actions: ({ name }, { pascal }) => [{ add: `${pascal(name)}.txt`, template: name }],
};
```

Also exported: `Params`, `Action`, `Answers`, `Helpers`, `Context`, `Pack`, `PackFactory`. For packs that write JavaScript, `@codejen/jen/js` has the types style (`typesFor`, `ext`, `stripTypes`, …), list params, typed events and tests.

## Sharing {#sharing}

### Where jen looks {#lookup}

First match wins:

1. **Project**: `.jen/`, searched upwards, but not past the repository or your home folder. A `.jen/` that isn't yours or is world-writable is skipped.
2. **User**: `$XDG_CONFIG_HOME/jen`, `~/.config/jen`, or `%APPDATA%\jen` on Windows.
3. **`$JEN_PATH`**: more folders, separated like `PATH`.
4. **Packs**: `jen-pack-*` or `@scope/pack-*` dependencies – project, user directory, then global.
5. **Built-ins**: `generator`.

A prefix picks one: `jen user:class`, `jen cpp:class`.

### Packs {#packs}


```js
// index.mjs
import * as cls from "./generators/class.mjs";
import * as example from "./generators/example.mjs";

export default { class: cls, example };
```

```json
{
  "name": "jen-pack-cpp",
  "type": "module",
  "exports": "./index.mjs",
  "keywords": ["jen-pack"]
}
```

`exports` must be a plain string, and the code JavaScript – Node doesn't strip types in `node_modules`. Optional `recipes`:

```js
export const recipes = [
  {
    name: "dashboard",
    description: "a dashboard page: a header, a sidebar and a row of cards",
    steps: ["web:cube --primary=#0d9488 --dir=css", "web:card --dir=css", "web:page --name=index"],
    usage: ['<div class="wrapper sidebar"><aside>…</aside><main id="main">…</main></div>'], // how the results fit together
    docs: "https://example.com/dashboard", // optional
  },
];
```

Or a function of `env` (`packages`, `resolve`, `fetch`):

```js
export default (env) =>
  Object.fromEntries(env.packages(/^generator-/).map((name) => [name.slice(10), makeGenerator(name, env.resolve(name))]));
```

### VS Code tasks {#vscode}


```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "jen: new class",
      "type": "shell",
      "command": "jen class --name=${input:className}",
      "problemMatcher": []
    }
  ],
  "inputs": [{ "id": "className", "type": "promptString", "description": "Class name" }]
}
```

## Developing jen {#develop}

[An npm workspaces monorepo](https://github.com/learosema/jen):

```sh
npm test            # node:test across every package
npm run typecheck   # tsc, tests included, across every package
npm run build       # jen.js + jen.d.ts, and each pack's dist
npm run docs        # this website, with its live previews, at localhost:4000
```
