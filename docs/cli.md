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
      - { title: The plan, id: plan }
      - { title: Fetching packs, id: fetching }
  - title: Looking around
    links:
      - { title: "--help", id: help }
      - { title: "--list", id: list }
      - { title: "--list --json", id: json }
      - { title: "--find", id: find }
  - title: Scripts
    links:
      - { title: Exit codes, id: exit }
      - { title: "--json output", id: json-run }
      - { title: Passthrough, id: passthrough }
---

## Running a generator {#running}

### Options {#options}

`jen [generator] [--param=value …] [options]` – `class`, `cpp:class` or `user:class`.

- **`--dry-run`, `-n`**: show the plan, write nothing
- **`--force`, `-f`**: overwrite existing files
- **`--strict`**: exit `1` on a `warning:`
- **`--dir=<path>`**: write there
- **`--from <package>`**: fetch a pack for one run
- **`--list`, `-l`**: all generators, or one pack's: `jen web --list`
- **`--find "<words>"`**: search generators and recipes – the place to start: `jen --find dashboard`
- **`--json`**: JSON for `--list`, `--find`, `--help` and runs
- **`--help`, `-h`**, **`--version`, `-v`**

### Params {#params}

`--name=Foo`; booleans bare or `=true|false`. No default means required.

#### Paths {#paths}

Path params like `--into` are relative to where you run jen, not to `--dir`.

#### Choices

Anything else fails.

### Unknown flags {#unknown}

Stop jen, with a suggestion.

{% include terminal.html id="cli_unknown" %}

### Reading the plan {#plan}

`+` created, `~` changed, `!` overwritten, `-` deleted, `info:` a hint, `warning:` skipped.

{% include terminal.html id="cli_plan" %}

### Fetching packs {#fetching}

A missing `@codejen` pack is fetched for one run; anything else needs `--from`. `JEN_NO_FETCH=1` turns it off.

## Looking around {#looking}

### `--help` {#help}

{% include terminal.html id="cli_help" %}

{% include terminal.html id="cli_missing" %}

### `--list` {#list}

`jen --list`, or one pack: `jen web --list`. Recipes come first – where to start.

### `--list --json` {#json}

`{ packs, generators }`; each generator's details with `jen <generator> --help --json`. Empty and default values are left out.

{% include terminal.html id="cli_json" %}

### `--find` {#find}

`jen --find "sidebar layout"`, or in one pack: `jen web --find "dark mode"`.

## For scripts {#scripts}

### Exit codes {#exit}

`0` when jen ran (`warning:` too, unless `--strict`), `1` on an error – then nothing is written.

### `--json` results and errors {#json-run}

- **stdout**: `{ generator, source, root?, dryRun, steps: [{ kind, file?, line?, note? }], written, deleted }`
- **stderr**: `{ error: { code, message, … } }` – `missing_param`, `unknown_flag`, `bad_value`, `not_found`, `unknown_pack` or `error`

### Passing flags on {#passthrough}

`passthrough: true` hands unknown flags to the generator in `ctx.args`.
