# jen

**the code jen(erator)** – a tiny, zero-dependency scaffolding CLI.

jen takes parameters from the command line (or their defaults), shows you exactly what it's about to do, and then touches your files. Generators are plain JavaScript or TypeScript modules, templates are template literals, and the whole thing is a single file with no dependencies beyond Node itself.

```
$ jen class --name=rigid_body --moveOnly
class (project) – C++ class

  + src/RigidBody.h
  + src/RigidBody.cpp
  ~ src/CMakeLists.txt  + RigidBody.cpp

✓ 3 written
```

## Why jen?

- **Zero dependencies.** No `node_modules` tree, no Handlebars, no Inquirer. Just Node.
- **No dialog.** Generators declare plain parameters with defaults, answered with `--name=value` on the command line. Nothing asks you questions.
- **Templates with logic, for free.** Template literals already do conditionals (`? :`) and loops (`.map()`), so there's no template language to learn.
- **Plan first, then act.** Every run computes all changes in memory and shows them as a plan before writing. `--dry-run` stops right there if you just want to look.
- **Deterministic.** Same params, same output. Every time.
- **Language-agnostic.** jen is written in TypeScript, but it happily scaffolds C++, CMake, Rust, shaders or anything else that's text.
- **Respects your `.editorconfig`.** Generated files and inserted/modified blocks come out in the project's own indent style – no chasing tabs vs. spaces in every generator.

## Installation

Requires **Node.js 22.18** or newer.

```sh
npm install -g @lea.rosema/jen
```

Or run it without installing:

```sh
npx @lea.rosema/jen
```

## Quick start

Let jen create your first generator:

```sh
jen generator --name=hello --location=project
```

This creates `.jen/hello.mjs` in the current directory. Run it:

```sh
jen hello --name=world
```

and you'll get `src/World.txt` saying hello. Open `.jen/hello.mjs` and make it your own.

## Writing generators

A generator is a module that exports `params` and an `actions()` function, either as named exports or as a default export:

```js
// .jen/class.mjs
export const description = "C++ class";

export const params = {
  name: {},
  dir: { default: "src" },
  moveOnly: { default: false },
};

export const actions = ({ name, dir, moveOnly }, { pascal }) => {
  const Name = pascal(name);
  return [
    {
      add: `${dir}/${Name}.h`,
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
      add: `${dir}/${Name}.cpp`,
      template: `#include "${Name}.h"\n\n${Name}::${Name}() = default;\n`,
    },
    {
      insert: `${dir}/CMakeLists.txt`,
      before: "# scaffold:sources",
      line: `${Name}.cpp`,
    },
  ];
};
```

Because `actions()` receives the resolved params, you can build the action list dynamically, for example to add a test file only when asked for it: `...(withTest ? [{ add: … }] : [])`.

Generator files can be `.mjs`, `.js`, `.ts` or `.mts`. TypeScript generators run through Node's built-in type stripping, so no build step is needed.

> **Tip:** C++ and template literals get along well. You only need to escape backticks and `${`, and neither shows up in C++ very often.

### Params

A param is just a name and an optional `default`:

```js
export const params = {
  name: {},                 // required – jen fails with a clear message if it's missing
  dir: { default: "src" },  // string, used as-is when not given
  moveOnly: { default: false }, // boolean – its default's type decides how the CLI value is parsed
};
```

Every param is answered from the command line with `--<name>=<value>`. Boolean params also work as a bare flag without a value (`--moveOnly`), and accept `1`, `true`, `y` and `yes` when given explicitly (`--moveOnly=yes`). A param with no `default` is required; if it's missing, jen stops before planning anything and lists what's missing.

There's no prompting, no `validate`, no `select` with choices – if a generator needs to constrain a value, it's just a check at the top of `actions()` that throws.

### Actions

| Action     | Shape                          | What it does                                                                                                                                 |
| ---------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **add**    | `{ add, template, force? }`    | Creates a file. Existing files are skipped unless `force` or `--force` is set.                                                               |
| **insert** | `{ insert, before, line }`     | Inserts `line` before the first line containing the marker `before`, using the marker's indentation. Skipped if the line is already present. |
| **modify** | `{ modify, pattern, replace }` | Search and replace with a `RegExp`. Also the way to remove lines.                                                                            |
| **delete** | `{ delete }`                   | Deletes a file. Only works inside the project root, and never on directories.                                                                |

All paths are relative to the **project root**: the directory containing `.jen/`, or the current directory if there is none. Actions on the same file build on each other, so you can `add` a file and `insert` into it in the same run.

A marker for `insert` is just a comment in the target file:

```cmake
target_sources(app PRIVATE
	main.cpp
	# scaffold:sources
)
```

`line` and `replace` can be a single line or a `\n`-joined block. A single line always reuses the marker's (or, for `modify`, the matched line's) exact indentation. A block keeps its own relative nesting but is re-rendered in the target file's indent style – see [EditorConfig](#editorconfig) below.

### EditorConfig

If the project has an `.editorconfig`, jen uses it:

- **`add`** – the whole new file is normalized: `indent_style`, `indent_size`/`tab_width`, `end_of_line`, `trim_trailing_whitespace` and `insert_final_newline` are all applied.
- **`insert`/`modify`** – only the text jen introduces is touched, never the rest of the file. A single line already matches its surroundings exactly (it reuses real, on-disk indentation), so it's left alone. A multi-line block is reindented to the applicable `indent_style`/`indent_size` – or, without a matching `.editorconfig` rule, to whatever style jen detects in the file itself (tabs vs. spaces, and the width, guessed from its existing indentation).

For a `modify` replacement, only the lines *after* the first are reindented – the first line continues right where the match was, so it's kept exactly as written.

`charset` and `max_line_length` aren't applied; the former is always UTF-8, the latter would mean rewrapping text, which jen doesn't do.

### Helpers

The second argument to `actions()` is a set of case helpers, so generators never need to import anything:

| Helper     | `'rigid body'` becomes |
| ---------- | ---------------------- |
| `pascal`   | `RigidBody`            |
| `camel`    | `rigidBody`            |
| `snake`    | `rigid_body`           |
| `kebab`    | `rigid-body`           |
| `constant` | `RIGID_BODY`           |

### Undoing things

`delete` and `modify` together make a neat counterpart to the `class` generator above:

```js
// .jen/destroy.mjs
export const params = { name: {} };

export const actions = ({ name }, { pascal }) => [
  { delete: `src/${pascal(name)}.h` },
  { delete: `src/${pascal(name)}.cpp` },
  {
    modify: "src/CMakeLists.txt",
    pattern: new RegExp(`^\\s*${pascal(name)}\\.cpp\\n`, "m"),
    replace: "",
  },
];
```

## Where jen looks for generators

jen searches these locations in order. The first match wins, so a project generator can override a personal or built-in one of the same name:

1. **Project:** `.jen/`, searched upwards from the current directory (just like `.git`).
2. **User:** `$XDG_CONFIG_HOME/jen`, `~/.config/jen`, or `%APPDATA%\jen` on Windows.
3. **`$JEN_PATH`:** additional directories, separated like `PATH`.
4. **Packs:** listed in `.jen/config.json`, then in the user `config.json`.
5. **Built-ins:** currently just `generator`.

`jen --list` shows every generator, where it comes from, and which ones are shadowed:

```
$ jen --list
  class                  project                    C++ class
  destroy                project
  class                  user                       my personal class template (shadowed)
  cpp:example            pack @lea.rosema/jen-cpp   example project
  generator              built-in                   create a new generator (project or user-wide)
```

To pick a shadowed generator, prefix it with its source or pack: `jen user:class`, `jen cpp:class`.

Running `jen` without a generator name shows the same list and exits with code 1 – there's no interactive picker.

## Generator packs

Generators can be shared as npm packages. A pack's default export maps generator names to generators:

```js
// index.mjs
import * as cls from "./generators/class.mjs";
import * as example from "./generators/example.mjs";

export default { class: cls, example };
```

```json
{
  "name": "@lea.rosema/jen-cpp",
  "type": "module",
  "exports": "./index.mjs",
  "keywords": ["jen-pack"]
}
```

A few things to keep in mind when publishing a pack:

- Use the plain string form of `exports` shown above. jen resolves packs like `require` does, so an `exports` map with only an `import` condition won't be found.
- Ship JavaScript. Node doesn't strip types from files inside `node_modules`, so `.ts` generators only work outside of packages.
- Packs don't need to depend on jen, so no `dependencies` or `peerDependencies` are required.
- The `jen-pack` keyword makes your pack easy to find on npm.

Enable packs in a `config.json`, either per project in `.jen/config.json` or for all your projects in the user directory:

```json
{ "packs": ["@lea.rosema/jen-cpp"] }
```

jen looks for packs in the project's `node_modules` first, then next to jen itself. That means packs installed globally with `npm install -g` are found automatically, which is handy for projects that don't have a `package.json` at all, such as C++ repos.

The pack prefix is the package name without its scope and without a leading `jen-`: `@lea.rosema/jen-cpp` becomes `cpp`.

## Command line

```
jen [generator] [--param=value …] [options]

  generator       name ("class"), with pack ("cpp:class") or source ("user:class")
  --list,    -l   list all generators and where they come from
  --dry-run, -n   only show the plan
  --force,   -f   overwrite existing files
  --where,   -w   generate into this directory instead of the project root
  --help,    -h   show this help
```

Without a generator name, jen lists all available generators and exits with code 1.

Params always use the `=` form (`--name=Foo`). The option names `list`, `dry-run`, `force`, `where` and `help` are reserved, so don't use them as param names.

By default, all action paths are relative to the project root (the directory containing `.jen/`, or the current directory if there is none). `--where`/`-w` overrides that root for a single run, so you can scaffold into another directory without `cd`-ing there first — generators are still looked up from where you actually are.

The plan uses these marks:

| Mark | Meaning                                                            |
| ---- | ------------------------------------------------------------------ |
| `+`  | file will be created                                               |
| `~`  | file will be changed                                               |
| `!`  | file will be overwritten                                           |
| `-`  | file will be deleted                                               |
| `=`  | nothing to do (already exists, already present, no match)          |
| `?`  | problem, action skipped (missing file or marker, path not allowed) |

## Editor integration

### Type checking in generators

jen ships its types, so JavaScript generators get autocompletion and type checking through JSDoc:

```js
// @ts-check
/** @type {import('@lea.rosema/jen').Generator} */
export default {
  params: { name: {} },
  actions: ({ name }, { pascal }) => [
    { add: `src/${pascal(name)}.txt`, template: name },
  ],
};
```

The exported types are `Generator`, `Params`, `Action`, `Answers`, `Helpers` and `Pack`. If jen isn't installed locally, you simply lose autocompletion; the generator still runs.

### VS Code tasks

Hook generators into the command palette with a task in `.vscode/tasks.json`:

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
  "inputs": [
    { "id": "className", "type": "promptString", "description": "Class name" }
  ]
}
```

VS Code asks for `${input:className}` and passes it as `--name=…`; any param without a default that isn't wired up this way makes jen fail immediately, so give every required param its own input.

## Development

jen is written in TypeScript using only erasable syntax (`erasableSyntaxOnly`), so it runs directly from source.

```sh
npm test            # node:test, no test framework needed
npm run typecheck   # tsc, including the tests
npm run build       # jen.js + jen.d.ts for publishing
```

`prepublishOnly` runs all three, so nothing broken ends up on npm.

The tests run jen as a real process in temporary directories, each with its own `XDG_CONFIG_HOME`, so your personal generators are never touched.

## License

MIT © Lea Rosema
