---
layout: doc
permalink: /generators.html
title: jen — writing generators
description: "How to write a jen generator: params, actions, case helpers, the project context, where jen finds generators, and how to publish them as a pack."
eyebrow: "@codejen/jen"
mega: write
lede: A generator is one file – the <code>params</code> it takes and an <code>actions()</code> function saying what should happen.
sub: No template language, no plugin API, no prompts. Plain JavaScript or TypeScript, and jen does the rest.
cta: { text: "Your first generator ↓", url: "#start" }
toc:
  - title: Getting started
    links:
      - { title: Your first generator, id: start }
      - { title: A generator, id: generator }
  - title: Reference
    links:
      - { title: Params, id: params }
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

Let jen write the skeleton:

```sh
jen generator --name=hello --location=project
```

That's `.jen/hello.mjs` in the project. Run it with `jen hello --name=world` and you get `World.txt` saying hello. `--location=user` puts it in your user directory instead, for every project.

### A generator {#generator}

A generator is a module exporting `params` and an `actions()` function – as named exports, or as one default export with an optional `description`:

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

`actions()` gets the resolved params, so it can build the list as it likes – a test file only on request is `...(withTest ? [{ add: … }] : [])`. It may be `async` and return a promise of the list.

Generators can be `.mjs`, `.js`, `.ts` or `.mts`. TypeScript runs through Node's type stripping, with no build step. C++ and template literals get along well: only backticks and `${` need escaping, and C++ rarely has either.

## Reference {#reference}

### Params {#params}

A param is a name, an optional `default` and an optional `description`:

```js
export const params = {
  name: {},                     // required – jen stops with a clear message if it's missing
  namespace: { default: "" },   // a string, used as is when not given
  moveOnly: {                   // a boolean – the default's type decides how the value is read
    default: false,
    description: "RAII wrapper: copy deleted, move defaulted (Rule of Five)",
  },
  into: { path: true, default: "" }, // a path the user types, relative to where they stand
};
```

- **`description`**: a short phrase for whatever the name doesn't already say. `jen <generator> --help` and `jen --list --json` show it, so use the words people would ask with.
- **`path: true`**: the value reaches `actions()` ready to use as an action path (`/shaders/main.glsl`, from the project root), however deep in the project the user typed it. jen fails if it points outside the project.

Every param is answered on the command line as `--<name>=<value>` – the [command line]({{ '/cli.html#params' | relative_url }}) has the details. There's no prompting, no `validate`, no `select` with choices: to constrain a value, check it at the top of `actions()` and throw.

### Actions {#actions}

- **`add`**: `{ add, template, force? }` creates a file. An existing file is skipped unless `force` or `--force` is set. `{ add, bytes }` writes a `Uint8Array` byte for byte, for binary files.
- **`insert`**: `{ insert, before, line }` inserts `line` before the first line containing the marker `before` – or matching it, if it's a `RegExp`; a number is a line number, 1-based, e.g. from a `--line=65` param. It takes the marker's indentation, one level deeper before a closing line like `</nav>` or `}`, where the insert goes inside. A line that's already there is skipped. With `path` instead of `line`, the line is that file's path relative to the file inserted into – how a build file lists its sources.
- **`modify`**: `{ modify, pattern, replace }` searches and replaces with a `RegExp` – also how to remove lines.
- **`delete`**: `{ delete }` deletes a file, never a directory.

**A generator says what, jen says where.** Paths are relative to where the files go: the current directory, or `--dir`. A path starting with `/` is relative to the project root. Nothing outside the project root is touched. Actions on the same file build on each other, so one run can `add` a file and `insert` into it.

To change a file that's somewhere in the project already, let jen find it instead of guessing its path: `insert` and `modify` take `{ find, containing? }` as their target. jen takes the nearest file with that name (or matching that `RegExp`) that contains `containing` – for `insert`, the marker by default – in the destination or a folder above it, else the shallowest one anywhere in the project. If there's none, the action is skipped with a note.

A marker is just a comment in the target file:

```cmake
target_sources(app PRIVATE
	main.cpp
	# jen:sources
)
```

`line` and `replace` can be one line or a `\n`-joined block. One line reuses the marker's (for `modify`, the matched line's) exact indentation. A block keeps its own nesting, re-rendered in the target file's indent style – see [EditorConfig](#editorconfig).

`delete` and `modify` together undo a generator. The counterpart to the class above:

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

With an `.editorconfig` in the project, jen follows it:

- **`add`**: the whole new file is normalized – `indent_style`, `indent_size`/`tab_width`, `end_of_line`, `trim_trailing_whitespace` and `insert_final_newline`.
- **`insert` and `modify`**: only the text jen brings in is touched, never the rest of the file. A single line already matches its surroundings, since it reuses their real indentation. A block is reindented to the `indent_style`/`indent_size` that applies – or, without a rule for the file, to the style jen finds in it: tabs or spaces, and how wide.

In a `modify` replacement, only the lines after the first are reindented: the first one continues where the match was. `charset` and `max_line_length` aren't applied – files are always UTF-8, and jen doesn't rewrap text.

### Helpers {#helpers}

The second argument to `actions()` holds the case helpers, so a generator imports nothing. For `'rigid body'`:

- **`pascal`**: `RigidBody`
- **`camel`**: `rigidBody`
- **`snake`**: `rigid_body`
- **`kebab`**: `rigid-body`
- **`constant`**: `RIGID_BODY`

### Context {#context}

Most generators never need it: the third argument to `actions()` tells a generator about the project it runs in, for the rare case where a file's content depends on where things are.

- **`ctx.destDir`**: where the files go, relative to the project root.
- **`ctx.root`** and **`ctx.cwd`**: the absolute project root, and the current directory relative to it.
- **`ctx.exists(path)`**, **`ctx.isDir(path)`**, **`ctx.read(path)`**, **`ctx.readdir(path)`**, **`ctx.findUp(name, text?)`** and **`ctx.grep(name, text?)`**: a read-only look at the project, with paths relative to the root.
- **`ctx.args`**: every flag given (besides jen's own and `--dir`) and the positionals after the generator name, params or not – for generators that pass them on, like [pack-yeoman]({{ '/yeoman.html' | relative_url }}). jen refuses flags a generator has no param for, unless it sets `passthrough: true`.

A generator with its own `dir` param gets `--dir` for itself.

### Types {#types}

jen ships its types, so a JavaScript generator gets autocompletion and type checking through JSDoc – the skeleton `jen generator` writes starts like this:

```js
// @ts-check
/** @type {import('@codejen/jen').Generator} */
export default {
  params: { name: {} },
  actions: ({ name }, { pascal }) => [{ add: `${pascal(name)}.txt`, template: name }],
};
```

The types are `Generator`, `Params`, `Action`, `Answers`, `Helpers`, `Context`, `Pack` and `PackFactory`. Without jen installed locally you only lose the autocompletion; the generator still runs.

For code in the project's own style – TypeScript, JavaScript with JSDoc types, or plain JavaScript – jen also exports what pack-js and pack-web use: `typesFor` and `detectTypes` (`--types`, else the nearest `tsconfig.json` or `jsconfig.json`), `TYPES_PARAM`, `ext`, `importExt`, `source`, `stripTypes` and `pick`. Importing them makes `@codejen/jen` a peer dependency of your pack.

## Sharing {#sharing}

### Where jen looks {#lookup}

jen searches these places in order, and the first match wins – so a project's generator can stand in for a personal or built-in one of the same name:

1. **Project**: `.jen/`, searched upwards from the current directory like `.git`, but not past the repository (the first folder with a `.git`) or your home folder. Generators run as code, so jen skips a `.jen/` that isn't yours or that anyone can write to, and says so.
2. **User**: `$XDG_CONFIG_HOME/jen`, `~/.config/jen`, or `%APPDATA%\jen` on Windows.
3. **`$JEN_PATH`**: more folders, separated like `PATH`.
4. **Packs**: dependencies named `jen-pack-*` or `@scope/pack-*` – in the project's `package.json` first, then the user directory's, then packs installed globally.
5. **Built-ins**: `generator`.

[`jen --list`]({{ '/cli.html#list' | relative_url }}) shows which one shadows which. To run a shadowed one, prefix it with its source or pack: `jen user:class`, `jen cpp:class`. A pack prefix nothing knows makes jen [fetch the pack]({{ '/cli.html#fetching' | relative_url }}) from `@codejen`.

### Packs {#packs}

Generators are shared as npm packages. A pack's default export maps generator names to generators:

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

- **Name** it `jen-pack-<name>` or `@scope/pack-<name>`. The part after that is the prefix: `jen-pack-cpp` and `@codejen/pack-cpp` both run as `cpp:…`.
- **`exports`** in the plain string form above: jen resolves packs like `require` does, so a map with only an `import` condition isn't found.
- **Ship JavaScript.** Node doesn't strip types inside `node_modules`, so `.ts` generators only work outside packages.
- **No dependency on jen** is needed – unless you import its style helpers, then it's a peer dependency.
- **The `jen-pack` keyword** makes it easy to find on npm.

jen finds a pack when it's a dependency of any kind in `package.json` – the project's or the user directory's – with no config of its own:

```json
{ "devDependencies": { "@codejen/pack-cpp": "^1.0.0" } }
```

It resolves the package from the project's `node_modules`, then the user directory's, then next to jen's own install. Packs installed globally next to jen are found without being listed anywhere, so `npm install -g @codejen/jen @codejen/pack-cpp` is enough for a project without a `package.json`, like a C++ repo. `node_modules` inside the project aren't scanned: there, its `package.json` decides.

When a pack's generators depend on what's installed, its default export can be a function – sync or async – that returns them. It gets `env.packages(re)`, the installed packages matching a pattern (from the same places jen looks for packs, plus a `--from` package), `env.resolve(name)`, where one resolves to, and `env.fetch(name)`, which installs a package for this run like `--from` – only for names fixed in the pack's own code, never one from the command line:

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

VS Code asks for `${input:className}` and passes it as `--name=…`. A required param that isn't wired up this way makes jen fail right away, so give each one its own input.

## Developing jen {#develop}

The [repository](https://github.com/learosema/jen) is an npm workspaces monorepo: `packages/jen` is jen itself, and each first-party pack, like `packages/pack-cpp` (published as `@codejen/pack-cpp`), lives next to it – same tooling, released on its own. jen is TypeScript with only erasable syntax, so it runs straight from its source.

```sh
npm test            # node:test across every package
npm run typecheck   # tsc, tests included, across every package
npm run build       # jen.js + jen.d.ts, and each pack's dist
npm run docs        # this website, with its live previews, at localhost:4000
```

`-w` runs one for a single package: `npm test -w @codejen/pack-cpp`. Each package's `prepublishOnly` runs its tests, typecheck and build, so nothing broken reaches npm. The tests run jen as a real process in temporary folders, each with its own `XDG_CONFIG_HOME`, so your own generators are never touched.
