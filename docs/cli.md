---
layout: doc
permalink: /cli.html
title: jen — command line
description: "Every jen option, how params are typed, what --help and --list --json print, and how jen fails: never a prompt, never a flag ignored."
eyebrow: "@codejen/jen"
mega: cli
lede: One command, a handful of options, and a generator's own params as <code>--flags</code>.
sub: jen never asks. Whatever it doesn't understand, it says so and quits before writing anything.
cta: { text: "All options ↓", url: "#options" }
toc:
  - title: Running
    links:
      - { title: Options, id: options }
      - { title: Params, id: params }
      - { title: Unknown flags, id: unknown }
      - { title: Reading the plan, id: plan }
      - { title: Fetching packs, id: fetching }
  - title: Looking around
    links:
      - { title: "--help", id: help }
      - { title: "--list", id: list }
      - { title: "--list --json", id: json }
  - title: Scripts
    links:
      - { title: Exit codes, id: exit }
      - { title: Passing flags on, id: passthrough }
---

## Running a generator {#running}

### Options {#options}

`jen [generator] [--param=value …] [options]`. The generator is a name (`class`), with its pack (`cpp:class`) or with its source (`user:class`).

- **`--dry-run`, `-n`**: only show the plan, write nothing.
- **`--force`, `-f`**: overwrite existing files instead of skipping them.
- **`--dir=<path>`**: where the files go, instead of the current directory. See [where files go]({{ '/#where' | relative_url }}).
- **`--from <package>`**: fetch a pack via npm, run it once, then remove it – or a package a pack runs, e.g. a Yeoman generator: `jen --from generator-code yeoman:code`.
- **`--list`, `-l`**: list every generator and where it comes from.
- **`--json`**: with `--list`, the same list as JSON.
- **`--help`, `-h`**: jen's own help, or with a generator, its params.

### Params {#params}

Everything else on the command line is a param of the generator. A value always takes the `=` form: `--name=Foo`. A boolean param works as a bare flag (`--moveOnly`), or with `=true`/`=false` – `yes`/`no`, `on`/`off` and `1`/`0` work too. Anything else fails, rather than being read as false.

A param without a default is required. Leave it out and jen stops with `Missing: --name` before anything is written – it never prompts for it.

`list`, `dry-run`, `force`, `from` and `help` are jen's own, so a generator can't use them as param names. `json` and `dir` can be: a generator with its own `dir` param gets `--dir` for itself.

### Unknown flags {#unknown}

A flag the generator has no param for stops jen too. A typo like `--moveonly` or `--namepsace=gfx` would otherwise be dropped without a word, and you'd get different code than you asked for. jen names every unknown flag at once, suggests the closest param for a near-miss, and lists the ones the generator knows:

{% include terminal.html id="cli_unknown" %}

`--dir` is always accepted, whether the generator has its own `dir` param or not.

### Reading the plan {#plan}

Every run prints its plan: one line per file, and what happens to it.

- **`+`**: the file is created.
- **`~`**: the file is changed, with the line that goes in.
- **`!`**: the file is overwritten, with `--force`.
- **`-`**: the file is deleted.
- **`=`**: nothing to do – the file exists, the line is already there, or nothing matched.
- **`?`**: a problem, so the action is skipped – a missing file or marker, or a path outside the project.

When the project root isn't where you stand, the plan says where jen found it and why, e.g. `root: .. (package.json)`. With `--dry-run`, the plan is all there is.

### Fetching packs {#fetching}

`--from <package>` (or `<package>@<version>`) installs a pack into a throwaway directory, runs it once and removes it again – no `package.json` entry, no `node_modules` left in your project. Any other package is installed the same way for a pack to run, e.g. a Yeoman generator: `jen --from generator-code yeoman:code`. The generator name stays the same as for an installed pack: `--from` only changes where jen gets it.

Ask for a prefixed generator whose pack isn't installed, like `lua:function`, and jen fetches `@codejen/pack-lua` the same way. That only ever pulls from jen's own `@codejen` scope, so a typo can't install someone else's package; for any other scope, or an unprefixed name, jen prints a hint to use `--from` instead.

Packs fetch, too – only names fixed in their own code, never one from the command line: pack-yeoman its [fixed list of generators]({{ '/yeoman.html' | relative_url }}), pack-js `npm create vite@latest` and the latest versions for [`js:esbuild`]({{ '/js.html#js-esbuild' | relative_url }}). jen uses your own `npm`, with `--ignore-scripts` for its installs. `JEN_NO_FETCH=1` turns all of it off.

## Looking around {#looking}

### `--help` {#help}

`jen <generator> --help` shows one generator and its params the way you'd type them: required ones marked `(required)`, strings with their default (`--namespace=""`), booleans as a bare flag, each followed by its description.

{% include terminal.html id="cli_help" %}

### `--list` {#list}

`jen --list` shows every generator, where it comes from, and which ones are shadowed by another of the same name further up the search path. Without a generator name at all, jen prints the same list.

### `--list --json` {#json}

`jen --list --json` prints the same catalog as JSON on stdout, and nothing else, for scripts, editors and other tools. Each generator has:

- **`name`**: the name to run it by, with the pack prefix, e.g. `cpp:class`.
- **`source`**: where it comes from, e.g. `pack @codejen/pack-cpp`, `project` or `built-in`.
- **`shadowed`**: `true` if another generator of the same name is found first, so this one only runs with its source prefix.
- **`description`**: what it makes, or `""`.
- **`params`**: each param by name, in the order `--help` shows them, with
  - **`type`**: `string` or `boolean`, following from its default,
  - **`required`**: `true` if it has no default,
  - **`default`**, **`path`** and **`description`**, only where the generator gives them.

A generator that fails to load gets an `error` with the message instead of `description` and `params`, and the listing goes on with the next one.

{% include terminal.html id="cli_json" %}

## For scripts {#scripts}

### Exit codes {#exit}

jen exits with `0` when it ran: files written, nothing to do, or only a plan with `--dry-run`. Anything else exits with `1` and a message on stderr: a missing or unknown param, a boolean it can't read, a generator that isn't found – and `jen` without a generator name, after listing them. Nothing is written in any of these cases.

### Passing flags on {#passthrough}

Some generators run something else and pass the command line on, like [pack-yeoman]({{ '/yeoman.html' | relative_url }}), which answers a Yeoman generator's questions from its flags. Such a generator sets `passthrough: true`: jen then accepts flags it has no param for and hands them over, with the positionals after the generator name, in `ctx.args`.
