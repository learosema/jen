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
      - { title: Your first generator, id: start }
      - { title: A generator, id: generator }
  - title: Reference
    links:
      - { title: Params, id: params }
      - { title: Examples and usage, id: examples }
      - { title: Actions, id: actions }
      - { title: EditorConfig, id: editorconfig }
      - { title: Helpers, id: helpers }
      - { title: Context, id: context }
      - { title: Types, id: types }
  - title: Sharing
    links:
      - { title: Where jen looks, id: lookup }
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

That writes `.jen/hello.mjs`. `jen hello --name=world` then writes `World.txt`. `--location=user` makes it available in every project.

### A generator {#generator}

A module exporting `params` and `actions()` – named, or as a default export with an optional `description`:

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

`actions()` gets the params and returns the list, optionally `async`. A test file on request: `...(withTest ? [{ add: … }] : [])`.

`.mjs`, `.js`, `.ts` or `.mts` – TypeScript runs through Node's type stripping. Only backticks and `${` need escaping, which C++ rarely has.

## Reference {#reference}

### Params {#params}

A name, with optional `default`, `description` and `choices`:

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

- **`description`**: what the name doesn't say, in the words people would search for. Shown by `--help` and `--list --json`.
- **`choices`**: the only values allowed, checked before `actions()`. The default always passes, so `default: ""` can mean "not given".
- **`path: true`**: arrives as an action path from the project root (`/shaders/main.glsl`). Fails outside the project.

A default from another param: give it `default: ""`, and fill it in `actions()`:

```js
export const params = { name: {}, path: { default: "" } };

export const actions = ({ name, path }, { kebab }) => {
  const route = path || `/${kebab(name)}`; // --path, else from --name
  // …
};
```

Params are `--<name>=<value>` on the [command line]({{ '/cli.html#params' | relative_url }}). No prompts, no `validate`: check in `actions()` and throw.

### Examples and usage {#examples}

`examples`: what follows the generator name on the command line:

```js
export const examples = ["--name=Camera", "--name=Texture --moveOnly"];
```

[`--help`]({{ '/cli.html#help' | relative_url }}) prints them as `jen class --name=Camera`, [`--list --json`]({{ '/cli.html#json' | relative_url }}) also via `npx`. Quote as a shell needs: `--members="int x, int y"`. Use `""` for a bare call.

`usage`: how to use the output – markup, custom properties, attributes – one plain line each. Write custom properties as CSS, so nobody takes them for flags:

```js
export const usage = [
  '<div class="sidebar"><aside>…</aside><main>…</main></div>',
  'the first child is the sidebar; data-direction="end" makes it the last',
  ".sidebar { --sidebar-target: 20rem; }  the sidebar's width",
];
```

Shown under `usage:` in `--help` and as `usage` in `--list --json`.

### Actions {#actions}

- **`add`**: `{ add, template, force? }` creates a file, skipped if it exists unless `force`/`--force`. `{ add, bytes }` writes a `Uint8Array`.
- **`insert`**: `{ insert, before, line }` inserts `line` before the first line containing `before` (or matching a `RegExp`, or at a 1-based line number). It takes the marker's indentation – one level deeper before a closing line like `</nav>` or `}`. Existing lines are skipped. `path` instead of `line` inserts that file's path relative to the target.
- **`insert` … `after`**: `{ insert, after, line }` inserts `line` after the **last** line containing `after` (or matching a `RegExp`) – one level deeper after a line ending in `[`, `{` or `(`. `after: /^import /` is "after the imports". A multi-line import ends on another line than it starts, so match that one too: `after: /^import |^} from /`.
- **`modify`**: `{ modify, pattern, replace }` – `RegExp` search and replace; also removes lines. Unlike `insert` and `append`, it doesn't skip text that's already there: run twice, it replaces twice. Make the pattern match only the old state, or use `insert`.
- **`append`**: `{ append, text }` adds `text` on its own line at the end (`\n` first for a blank line). Skipped if already there.
- **`note`**: `{ note, file? }` changes nothing, prints an `info:` line: `{ note: ".reel is already here, nothing to add", file: "css/layout.css" }`. With `written: true`, it's about what an `add` of `file` writes, and left out when that add is skipped: `{ note: "links css/styles.css", file: "index.html", written: true }`.
- **`delete`**: `{ delete }` deletes a file, never a directory.

**A generator says what, jen says where.** Paths are relative to where the files go (current directory or `--dir`); `/` starts at the project root: `{ add: "/test/routes/users.test.js", … }` lands there wherever jen runs. Nothing outside the root is touched. Actions on one file build on each other.

To find an existing file, `insert` and `modify` take `{ find, containing? }`: the nearest file with that name (or `RegExp`) containing `containing` (for `insert`, the marker), in the destination or above, else the shallowest in the project. None found: a `warning:`, or your own `info:` with `missing: "…"`.

A marker is a comment:

```cmake
target_sources(app PRIVATE
	main.cpp
	# jen:sources
)
```

Without a marker, `after` and a `RegExp` still find the spot – registering a route in an `index.js` that imports each route and lists them in `export const routes = [`, one per line, up to `];`:

```js
const index = { find: "index.js", containing: "export const routes" };

export const actions = ({ name }, { camel, kebab }) => [
  { insert: index, after: /^import /, line: `import { ${camel(name)} } from './${kebab(name)}.js';` },
  { insert: index, before: /^\];/, line: `${camel(name)},` },
];
```

The import goes after the last import, the entry before the list's closing `];`, one level deeper. A rerun adds neither twice.

**Reruns and `--force`.** `--force` only touches `add`: a file that exists is skipped – the plan says so and that `--force` overwrites it – and with `--force` it's written again. `insert` and `append` never add a line twice, with or without it. `modify` runs every time.

`line` and `replace` may be a `\n`-joined block: it keeps its nesting, in the target's indent style ([EditorConfig](#editorconfig)).

`delete` and `modify` undo a generator:

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

- **`add`**: the new file follows `indent_style`, `indent_size`/`tab_width`, `end_of_line`, `trim_trailing_whitespace` and `insert_final_newline`.
- **`insert`, `modify`, `append`**: only the inserted text is reindented – by the `.editorconfig`, or else the style found in the file. In `modify`, the first line stays where the match was.

Files are always UTF-8; `max_line_length` isn't applied.

### Helpers {#helpers}

The second argument to `actions()`. For `'rigid body'`:

- **`pascal`**: `RigidBody`
- **`camel`**: `rigidBody`
- **`snake`**: `rigid_body`
- **`kebab`**: `rigid-body`
- **`constant`**: `RIGID_BODY`

### Context {#context}

The third argument to `actions()`, for the rare output that depends on the project:

- **`ctx.destDir`**: where the files go, relative to the project root.
- **`ctx.root`** and **`ctx.cwd`**: the absolute project root, and the current directory relative to it.
- **`ctx.exists`**, **`isDir`**, **`read`**, **`readdir`** (`path`), **`findUp`**, **`grep`** (`name, text?`): read-only, paths from the root.
- **`ctx.args`**: all flags (but jen's own and `--dir`) and positionals – for generators that set `passthrough: true`, like [pack-yeoman]({{ '/yeoman.html' | relative_url }}).

### Types {#types}

jen ships types, so JSDoc gives JavaScript generators autocompletion – `jen generator` writes:

```js
// @ts-check
/** @type {import('@codejen/jen').Generator} */
export default {
  params: { name: {} },
  actions: ({ name }, { pascal }) => [{ add: `${pascal(name)}.txt`, template: name }],
};
```

Types: `Generator`, `Params`, `Action`, `Answers`, `Helpers`, `Context`, `Pack`, `PackFactory`. Without jen installed locally, only autocompletion is lost.

To write TypeScript, JSDoc or plain JavaScript to match the project, as pack-js and pack-web do, import `typesFor`, `detectTypes`, `TYPES_PARAM`, `ext`, `importExt`, `source`, `stripTypes` and `pick` – making `@codejen/jen` a peer dependency.

## Sharing {#sharing}

### Where jen looks {#lookup}

In order; the first match wins:

1. **Project**: `.jen/`, searched upwards, but not past the repository or your home folder. A `.jen/` that isn't yours or is world-writable is skipped.
2. **User**: `$XDG_CONFIG_HOME/jen`, `~/.config/jen`, or `%APPDATA%\jen` on Windows.
3. **`$JEN_PATH`**: more folders, separated like `PATH`.
4. **Packs**: `jen-pack-*` or `@scope/pack-*` dependencies – project, user directory, then global.
5. **Built-ins**: `generator`.

[`jen --list`]({{ '/cli.html#list' | relative_url }}) shows shadowing. Prefix to pick one: `jen user:class`, `jen cpp:class`. An unknown pack prefix [fetches]({{ '/cli.html#fetching' | relative_url }}) from `@codejen`.

### Packs {#packs}

An npm package whose default export maps names to generators:

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

- **Name**: `jen-pack-<name>` or `@scope/pack-<name>`; both run as `<name>:…`.
- **`exports`**: a plain string – an `import`-only map isn't found.
- **Ship JavaScript**: Node doesn't strip types in `node_modules`.
- **No dependency on jen**, unless you import its helpers (then a peer dependency).
- **`jen-pack` keyword**: for npm search.
- **`description`, `version`, `homepage`**: go into [`--list --json`]({{ '/cli.html#json' | relative_url }}); `--help` links the `homepage`.

A pack can also export `recipes`: generators that make something together, in order. `--list` shows them, [`--find`]({{ '/cli.html#find' | relative_url }}) finds them:

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

Any kind of dependency in the project's or user directory's `package.json` is found:

```json
{ "devDependencies": { "@codejen/pack-cpp": "^1.0.0" } }
```

Global packs next to jen need no listing, so `npm install -g @codejen/jen @codejen/pack-cpp` works without a `package.json`. A project's `node_modules` isn't scanned – its `package.json` decides.

A default export can also be a (sync or async) function of `env`: `env.packages(re)` lists installed packages matching a pattern, `env.resolve(name)` resolves one, `env.fetch(name)` installs one for this run – only names fixed in the pack's code:

```js
export default (env) =>
  Object.fromEntries(env.packages(/^generator-/).map((name) => [name.slice(10), makeGenerator(name, env.resolve(name))]));
```

### VS Code tasks {#vscode}

A task in `.vscode/tasks.json` puts a generator in the command palette:

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

VS Code asks for each `${input:…}`; wire up every required param.

## Developing jen {#develop}

The [repository](https://github.com/learosema/jen) is an npm workspaces monorepo: `packages/jen` and each pack, like `packages/pack-cpp`. jen is erasable-syntax TypeScript and runs from source.

```sh
npm test            # node:test across every package
npm run typecheck   # tsc, tests included, across every package
npm run build       # jen.js + jen.d.ts, and each pack's dist
npm run docs        # this website, with its live previews, at localhost:4000
```

`-w` targets one package: `npm test -w @codejen/pack-cpp`. `prepublishOnly` runs tests, typecheck and build. Tests run jen in temporary folders with their own `XDG_CONFIG_HOME`.
