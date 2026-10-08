# jen

**the code jen(erator)** – a scaffolding CLI. Extremely lightweight. Blazing fast. Zero extra dependencies.

**Website: <https://learosema.github.io/jen/>**

jen takes parameters from the command line (or their defaults), prints exactly what it does to your files. Generators are plain JavaScript or TypeScript modules, templates are template literals, and the whole thing is a single file with no dependencies beyond Node itself.

```
$ jen class --name=rigid_body --moveOnly --dir=src
class (project) – C++ class

  + src/RigidBody.h
  + src/RigidBody.cpp
  ~ src/CMakeLists.txt  + RigidBody.cpp

✓ 3 written
```

## Why jen?

- **Zero extra dependencies.** No `node_modules` tree, no Handlebars, no Inquirer. Just Node.
- **No dialog.** Generators declare plain parameters with defaults, answered with `--name=value` on the command line. Nothing asks you questions.
- **Templates with logic, for free.** Template literals already do conditionals (`? :`) and loops (`.map()`), so there's no template language to learn.
- **Readable output.** Every run prints what it adds, changes and skips. `--dry-run` shows that without writing anything.
- **Deterministic.** Same params, same output. Every time.
- **Language-agnostic.** jen is written in TypeScript, but it happily scaffolds C++, CMake, Rust, shaders or anything else that's text.
- **Respects your `.editorconfig`.** Generated files and inserted/modified blocks come out in the project's own indent style – no chasing tabs vs. spaces in every generator.

## Installation

Requires **Node.js 24** or newer.

```sh
npm install -g @codejen/jen
```

Or run it without installing:

```sh
npx @codejen/jen
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

and you'll get `World.txt` saying hello. Open `.jen/hello.mjs` and make it your own.

## Writing generators

A generator is a module that exports `params` and an `actions()` function, either as named exports or as a default export:

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
      before: "# scaffold:sources",
      path: `${Name}.cpp`,
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
  name: {},                     // required – jen fails with a clear message if it's missing
  namespace: { default: "" },   // string, used as-is when not given
  moveOnly: { default: false }, // boolean – its default's type decides how the CLI value is parsed
  into: { path: true, default: "" }, // a path the user types, relative to where they stand
};
```

A `path: true` param reaches `actions()` ready to use as an action path (`/shaders/main.glsl`, from the project root), however deep in the project the user typed it. jen fails if it points outside the project.

Every param is answered from the command line with `--<name>=<value>`. Boolean params also work as a bare flag without a value (`--moveOnly`), and accept `1`, `true`, `y` and `yes` when given explicitly (`--moveOnly=yes`). A param with no `default` is required; if it's missing, jen stops before planning anything and lists what's missing.

There's no prompting, no `validate`, no `select` with choices – if a generator needs to constrain a value, it's just a check at the top of `actions()` that throws.

### Actions

- **add** – `{ add, template, force? }`: Creates a file. Existing files are skipped unless `force` or `--force` is set.
- **insert** – `{ insert, before, line }`: Inserts `line` before the first line containing the marker `before` (or, if `before` is a `RegExp`, the first line matching it; if it's a number, before that line – 1-based, e.g. from a `--line=65` param), using the marker's indentation – one level deeper before a closing line like `</nav>` or `}`, where the insert goes inside. Skipped if the line is already present. With `path` instead of `line`, the inserted line is that file's path relative to the file being inserted into – how a build file lists its sources.
- **modify** – `{ modify, pattern, replace }`: Search and replace with a `RegExp`. Also the way to remove lines.
- **delete** – `{ delete }`: Deletes a file, never a directory.

**A generator says what to create; jen decides where.** Paths are relative to where the files go: the current directory, or `--dir`. A path starting with `/` is relative to the project root instead. Nothing outside the project root is ever touched. Actions on the same file build on each other, so you can `add` a file and `insert` into it in the same run.

To change a file that already exists somewhere in the project, let jen find it instead of guessing its path: `insert` and `modify` take `{ find, containing? }` as their target. jen uses the nearest file with that name (or matching that `RegExp`) that contains `containing` – for `insert`, the marker by default – in the destination or a folder above it, otherwise the shallowest one anywhere in the project. If there is none, the action is skipped with a note.

A marker for `insert` is just a comment in the target file:

```cmake
target_sources(app PRIVATE
	main.cpp
	# scaffold:sources
)
```

`line` and `replace` can be a single line or a `\n`-joined block. A single line reuses the marker's (or, for `modify`, the matched line's) exact indentation, one level deeper before a closing line. A block keeps its own relative nesting but is re-rendered in the target file's indent style – see [EditorConfig](#editorconfig) below.

### EditorConfig

If the project has an `.editorconfig`, jen uses it:

- **`add`** – the whole new file is normalized: `indent_style`, `indent_size`/`tab_width`, `end_of_line`, `trim_trailing_whitespace` and `insert_final_newline` are all applied.
- **`insert`/`modify`** – only the text jen introduces is touched, never the rest of the file. A single line already matches its surroundings exactly (it reuses real, on-disk indentation), so it's left alone. A multi-line block is reindented to the applicable `indent_style`/`indent_size` – or, without a matching `.editorconfig` rule, to whatever style jen detects in the file itself (tabs vs. spaces, and the width, guessed from its existing indentation).

For a `modify` replacement, only the lines *after* the first are reindented – the first line continues right where the match was, so it's kept exactly as written.

`charset` and `max_line_length` aren't applied; the former is always UTF-8, the latter would mean rewrapping text, which jen doesn't do.

### Helpers

The second argument to `actions()` is a set of case helpers, so generators never need to import anything:

With `'rigid body'` as input:

- `pascal` – `RigidBody`
- `camel` – `rigidBody`
- `snake` – `rigid_body`
- `kebab` – `rigid-body`
- `constant` – `RIGID_BODY`

### Context

Most generators never need it, but the third argument to `actions()` tells a generator about the project it runs in – for the rare case where the content of a file depends on where things are:

- `ctx.destDir` – where the files go, relative to the project root.
- `ctx.root` and `ctx.cwd` – the absolute project root, and the current directory relative to it.
- `ctx.exists(path)`, `ctx.read(path)`, `ctx.findUp(name, text?)` and `ctx.grep(name, text?)` – a read-only look at the project, with paths relative to the root.

If a generator declares its own `dir` param, jen leaves `--dir` to it.

### Undoing things

`delete` and `modify` together make a neat counterpart to the `class` generator above:

```js
// .jen/destroy.mjs
export const params = { name: {} };

export const actions = ({ name }, { pascal }) => [
  { delete: `${pascal(name)}.h` },
  { delete: `${pascal(name)}.cpp` },
  {
    modify: { find: "CMakeLists.txt", containing: "# scaffold:sources" },
    pattern: new RegExp(`^\\s*${pascal(name)}\\.cpp\\n`, "m"),
    replace: "",
  },
];
```

## Project root and destination

jen never prompts, and it doesn't guess either. There are two simple rules.

**Files go where you are standing.** A generator that scaffolds a class, a shader or a single file writes it into the current directory. App starters (`cpp:sdl3`, `glsl:webgl`, …) create a new folder in the current directory and put everything there. `--dir=<path>` (relative to the current directory) writes somewhere else instead, so `jen cpp:class --name=Foo --dir=src/main/cpp` writes `src/main/cpp/Foo.h`. Generators don't pick folders themselves.

**The project root** is the boundary: jen never touches anything outside it. jen finds it by walking up from the current directory: the parent of the nearest `.jen/`, otherwise the nearest directory with a `package.json` or a `.git`, otherwise the current directory. Files a generator wires into, such as a `CMakeLists.txt` with a marker, are found within it – the nearest one above where the files go, which is how a class made in `src/net/` still lands in the right `CMakeLists.txt`.

The plan notes what jen decided, for example `root: .. (package.json)`.

## Where jen looks for generators

jen searches these locations in order. The first match wins, so a project generator can override a personal or built-in one of the same name:

1. **Project:** `.jen/`, searched upwards from the current directory (just like `.git`), but no further than the repository (the first directory with a `.git`) or your home directory. Generators in it run as code, so jen skips a `.jen/` that you don't own or that anyone can write to, and says so.
2. **User:** `$XDG_CONFIG_HOME/jen`, `~/.config/jen`, or `%APPDATA%\jen` on Windows.
3. **`$JEN_PATH`:** additional directories, separated like `PATH`.
4. **Packs:** dependencies in `package.json` named `jen-pack-*` or `@scope/pack-*`, project `package.json` first, then the user directory's, then packs installed globally (`npm install -g`).
5. **Built-ins:** currently just `generator`.

If nothing matches and the name has a pack prefix (`lua:function`), jen falls back to fetching `@codejen/pack-lua` – see [When a generator isn't found](#when-a-generator-isnt-found).

`jen --list` shows every generator, where it comes from, and which ones are shadowed:

```
$ jen --list
  class                  project                    C++ class
  destroy                project
  class                  user                       my personal class template (shadowed)
  cpp:example            pack @codejen/pack-cpp         example project
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
  "name": "@codejen/pack-cpp",
  "type": "module",
  "exports": "./index.mjs",
  "keywords": ["jen-pack"]
}
```

A few things to keep in mind when publishing a pack:

- Name it `jen-pack-<name>` (unscoped) or `@scope/pack-<name>` (any scope), e.g. `jen-pack-brainfuck` or `@codejen/pack-cpp`.
- Use the plain string form of `exports` shown above. jen resolves packs like `require` does, so an `exports` map with only an `import` condition won't be found.
- Ship JavaScript. Node doesn't strip types from files inside `node_modules`, so `.ts` generators only work outside of packages.
- Packs don't need to depend on jen, so no `dependencies` or `peerDependencies` are required.
- The `jen-pack` keyword makes your pack easy to find on npm.

jen finds packs automatically: add one as a dependency (of any kind – `dependencies`, `devDependencies`, or `peerDependencies`) in `package.json`, either in the project or in the user directory, and jen picks it up by name – no separate config needed:

```json
{ "devDependencies": { "@codejen/pack-cpp": "^1.0.0" } }
```

jen resolves the package from the project's `node_modules` first, then the user directory's, then from next to jen's own install location. Globally installed packs (`npm install -g`) are also found without being listed anywhere: jen scans the `node_modules` it is installed into for `jen-pack-*` / `@scope/pack-*` (and `generator-*`) packages. That makes `npm i -g @codejen/jen @codejen/pack-cpp` enough for projects without a `package.json`, such as C++ repos. `node_modules` inside the project are not scanned – there, its `package.json` decides.

The pack prefix is the part after `jen-pack-` or `@scope/pack-`: `@codejen/pack-cpp` and `jen-pack-cpp` both become `cpp`.

## Yeoman generators

jen can also run real [Yeoman](https://yeoman.io/) generators – npm packages named `generator-<name>` or `@scope/generator-<name>` – straight through its own plan/apply engine, without jen itself gaining a single runtime dependency for it. Add one as a dependency, same as a pack:

```json
{ "devDependencies": { "generator-code": "^1.12.0" } }
```

```
$ jen code --extensionType=command-ts --extensionDisplayName="My Extension"
code (yeoman generator-code) – Yeoman generator

  + my-extension/package.json
  + my-extension/src/extension.ts
  …

✓ 12 written
```

It's exposed under its short name – `code` for `generator-code` – the same generator `yo code` itself would run. jen doesn't enumerate a package's other sub-generators, just its default one.

**How, without a dependency:** a real Yeoman generator's own `package.json` already depends on `yeoman-generator`, `mem-fs` and `mem-fs-editor`. jen resolves and reuses those straight from the generator's own `node_modules` – exactly how it already resolves packs – instead of reimplementing the `Generator` base class or `copyTpl`'s EJS templating itself. What jen fakes is only the small slice of a Yeoman environment that `yeoman-generator` needs to run: a shared in-memory file store and the queue that schedules `initializing`/`prompting`/`configuring`/`default`/`writing`. The files the generator would write become a normal jen plan – same diff, same `--dry-run`, same `--force` conflict handling as a native generator.

This comes with real limits, on purpose:

- **Never interactive**, like the rest of jen. A generator's `this.prompt()` is answered from a `--flag` matching the question's `name`, or its own default – never a real prompt. If a question has neither, jen fails with a clear `Missing: --flag` message and quits, the same as a missing param on a native generator. Since Yeoman generators typically only prompt for what wasn't already given as an option (check the generator's own `--help`/docs for its options), supplying everything upfront avoids this entirely.
- **No `composeWith`/blueprints.** Generators that compose other generators (JHipster's blueprint system is the big example) aren't supported – jen fails with a clear error if one tries.
- **The `install` and `end` priorities never run.** That's where generators normally run `npm install`, `git init`, or open an editor – real side effects that assume the files are already on disk, which, in jen's plan-then-apply model, they aren't yet when the generator itself runs. Only the file changes make it into the plan; anything a generator would otherwise do afterwards is up to you.

## Running a pack or generator without installing it

`--from <name>` (optionally `<name>@<version>`) fetches a jen pack or a Yeoman generator via npm into a throwaway directory, runs it once, and removes the directory again – no `package.json` entry, no `node_modules` left behind in your project:

```sh
jen --from generator-code code --extensionType=command-ts --extensionDisplayName="My Extension"
jen --from @codejen/pack-cpp cpp:class --name=RigidBody
```

The generator name after `--from` still has to be given, same as it would be for an installed one (`code`, `cpp:class`) – `--from` only changes where jen gets the package from, not how you address what's inside it.

Besides the [not-found fallback](#when-a-generator-isnt-found) below, which is limited to the `@codejen` scope, this is the *only* thing jen ever fetches or installs, and only for that one invocation – nothing else in jen touches the network or writes outside the files it just showed you in the plan. It shells out to your own `npm` (with `--ignore-scripts`, so install/postinstall scripts don't run) rather than adding an installer dependency of its own.

## Command line

```
jen [generator] [--param=value …] [options]

  generator       name ("class"), with pack ("cpp:class") or source ("user:class")
  --list,    -l   list all generators and where they come from
  --dry-run, -n   only show the plan
  --force,   -f   overwrite existing files
  --dir           where the files go instead of the current directory
  --from          fetch a pack or Yeoman generator via npm, run it once, then remove it
  --help,    -h   show this help
```

Without a generator name, jen lists all available generators and exits with code 1.

Params always use the `=` form (`--name=Foo`). The option names `list`, `dry-run`, `force`, `from` and `help` are reserved, so don't use them as param names.

Files go into the current directory (see [Project root and destination](#project-root-and-destination)). To generate somewhere else, `cd` there first, or use `--dir` within the project.

The plan notes where jen found the project root, for example `root: .. (package.json)`.

The plan uses these marks:

- `+` – file will be created
- `~` – file will be changed
- `!` – file will be overwritten
- `-` – file will be deleted
- `=` – nothing to do (already exists, already present, no match)
- `?` – problem, action skipped (missing file or marker, path not allowed)

## Editor integration

### Type checking in generators

jen ships its types, so JavaScript generators get autocompletion and type checking through JSDoc:

```js
// @ts-check
/** @type {import('@codejen/jen').Generator} */
export default {
  params: { name: {} },
  actions: ({ name }, { pascal }) => [
    { add: `${pascal(name)}.txt`, template: name },
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

This repo is an npm workspaces monorepo: `packages/jen` is jen itself, and each first-party pack (e.g. `packages/pack-cpp`, published as `@codejen/pack-cpp`) lives next to it – same tooling, versioned and released independently.

jen is written in TypeScript using only erasable syntax (`erasableSyntaxOnly`), so it runs directly from source.

```sh
npm test            # node:test, no test framework needed, across every package
npm run typecheck   # tsc, including the tests, across every package
npm run build       # jen.js + jen.d.ts, and each pack's dist, for publishing
```

Run any of these for a single package instead with `-w`, e.g. `npm test -w @codejen/jen` or `npm test -w @codejen/pack-cpp`.

Each package's own `prepublishOnly` runs its test/typecheck/build, so nothing broken ends up on npm.

The tests run jen as a real process in temporary directories, each with its own `XDG_CONFIG_HOME`, so your personal generators are never touched.

## License

MIT © Lea Rosema

### When a generator isn't found

If you ask for a prefixed generator whose pack isn't installed, jen fetches it from npm the same way `--from` would – but only from jen's own `@codejen` scope:

```
$ jen lua:function
Fetching @codejen/pack-lua@latest …
```

So a mistyped name can never install a third party's package. If that package doesn't exist (or you set `JEN_NO_FETCH=1`, e.g. to stay offline), jen only prints the hint instead:

```
Generator "lua:function" not found – jen --list shows all.
If "lua" is a pack you haven't installed, try: jen --from @codejen/pack-lua lua:function
```

Packs from other scopes, and unprefixed names, are never fetched automatically – use `--from` for those.
