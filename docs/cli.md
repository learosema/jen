---
layout: doc
permalink: /cli.html
title: jen — command line
description: "Every jen option, how params are typed, what --help and --list --json print, and how jen fails: never a prompt, never a flag ignored."
eyebrow: "@codejen/jen"
mega: cli
lede: One command, a handful of options, and a generator's own params as <code>--flags</code>.
sub: jen never asks. Anything it doesn't understand stops it before writing.
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

`jen [generator] [--param=value …] [options]`. The generator is a name (`class`), or prefixed by its pack (`cpp:class`) or source (`user:class`).

- **`--dry-run`, `-n`**: show the plan, write nothing.
- **`--force`, `-f`**: overwrite existing files.
- **`--dir=<path>`**: write there instead of the current directory. See [where files go]({{ '/#where' | relative_url }}).
- **`--from <package>`**: fetch a pack, or a package a pack runs, for one run: `jen --from generator-code yeoman:code`.
- **`--list`, `-l`**: list every generator and its source – or one pack's: `jen web --list`.
- **`--json`**: with `--list`, as JSON.
- **`--help`, `-h`**: jen's help, or a generator's params.
- **`--version`, `-v`**: jen's version.

### Params {#params}

Everything else is a generator param. Values use `=`: `--name=Foo`. Booleans work bare (`--moveOnly`) or with `=true`/`false`, `yes`/`no`, `on`/`off`, `1`/`0`. Anything else fails.

A param without a default is required. Leave it out and jen prints the params and `Missing: --name`, then stops ([see `--help`](#help)).

#### Paths {#paths}

Path params like `--into` are relative to where you run jen, not to `--dir`, and must stay inside the project. `jen web:dialog --name=confirm --into=index.html --dir=css` writes `css/dialog.css` and edits `./index.html`.

#### Choices

Some params take only a few values. Anything else fails: `cpp:enum --std: expected one of "20", "23", got "17"`.

`list`, `dry-run`, `force`, `from` and `help` are reserved. `json` and `dir` aren't: a generator with its own `dir` param gets `--dir`.

### Unknown flags {#unknown}

An unknown flag stops jen, so a typo like `--moveonly` never silently changes your output. jen names them all, suggests the closest match, and lists the known params:

{% include terminal.html id="cli_unknown" %}

`--dir` is always accepted.

### Reading the plan {#plan}

One line per file:

- **`+`**: created
- **`~`**: changed, with the line that goes in – for an insert, `file:12` is where it went
- **`!`**: overwritten (`--force`)
- **`-`**: deleted
- **`info:`**: nothing to do, or a hint – e.g. that `--line="</nav>"` is on several lines, and which one was used
- **`warning:`**: skipped – a missing file or marker, or a path outside the project

Both `info:` and `warning:` exit with `0`. Real errors stop jen before the plan.

{% include terminal.html id="cli_plan" %}

If the project root isn't where you stand, the plan says so: `root: .. (package.json)`.

### Fetching packs {#fetching}

`--from <package>[@<version>]` installs into a throwaway directory, runs once and cleans up – nothing left in your project. The generator name stays the same.

A prefixed generator without its pack, like `lua:function` or `jen lua --list`, fetches `@codejen/pack-lua` the same way. Only from `@codejen`, so a typo can't install someone else's package; anything else gets a hint to use `--from`.

Packs fetch only names fixed in their code: pack-yeoman its [generator list]({{ '/yeoman.html' | relative_url }}), pack-js `npm create vite@latest` and the versions for [`js:esbuild`]({{ '/js.html#js-esbuild' | relative_url }}). Installs use your `npm` with `--ignore-scripts`. `JEN_NO_FETCH=1` turns it all off.

## Looking around {#looking}

### `--help` {#help}

`jen <generator> --help` shows the params as you'd type them – `(required)`, defaults, choices (`--std=23|20`), path params marked – then `usage:`, examples ready to copy (the first also via `npx`), and the pack's docs link.

{% include terminal.html id="cli_help" %}

Run a generator without its required params for the same text plus what's missing, on stderr with exit code `1`. Generators with all-default params, like `web:base`, just run.

{% include terminal.html id="cli_missing" %}

### `--list` {#list}

`jen --list` shows every generator, its source, and what's shadowed.

A prefix lists one pack or source: `jen web --list`, `jen cpp --list --json`, `jen project --list`, or just `jen web` if no generator is called `web`. Missing `@codejen` packs are [fetched](#fetching).

### `--list --json` {#json}

The same catalog as JSON on stdout, for tools. Each generator has:

- **`name`**: e.g. `cpp:class`
- **`source`**: e.g. `pack @codejen/pack-cpp`, `project`, `built-in`
- **`pack`**: its `name`, plus `version`, `description` and `homepage` if set
- **`shadowed`**: `true` if another of the same name wins
- **`description`**: or `""`
- **`params`**: in `--help` order, each with
  - **`type`**: `string` or `boolean`
  - **`required`**: `true` without a default
  - **`default`**, **`choices`**, **`path`**, **`description`**: when given
- **`examples`**: each as a `jen` and an `npx --yes @codejen/jen` call (with `--from` outside `@codejen`), or `[]`
- **`usage`**: as under `usage:` in `--help`, or `[]`

A generator that fails to load gets an `error` instead, and the listing goes on.

{% include terminal.html id="cli_json" %}

## For scripts {#scripts}

### Exit codes {#exit}

`0` when jen ran – including nothing to do, `--dry-run`, `info:` and `warning:`. `1` with a message on stderr otherwise: a missing, unknown or unreadable param, an unknown generator, or bare `jen`. Nothing is written then.

### Passing flags on {#passthrough}

Generators that wrap another tool, like [pack-yeoman]({{ '/yeoman.html' | relative_url }}), set `passthrough: true`: jen then accepts unknown flags and hands them, with the positionals, over in `ctx.args`.
