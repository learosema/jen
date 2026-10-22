---
layout: doc
permalink: /yeoman.html
title: jen — Yeoman pack
description: "@codejen/pack-yeoman runs Yeoman generators – JHipster included – through jen's plan: never interactive, no network, nothing written before you see it."
eyebrow: "@codejen/pack-yeoman"
mega: yeoman
lede: Yeoman generators, JHipster included, run through jen's plan – the same diff, the same <code>--dry-run</code>, the same <code>--force</code>.
sub: Never interactive, never online.
cta: { text: "Three ways to install ↓", url: "#install" }
toc:
  - title: Install
    links:
      - { title: Globally, id: install-global }
      - { title: Locally, id: install-local }
      - { title: Not at all, id: install-npx }
  - title: Running generators
    links:
      - { title: Overview, id: how }
      - { title: Questions, id: questions }
      - { title: Any generator, id: generators }
  - title: JHipster
    links:
      - { title: "yeoman:jhipster", id: jhipster }
      - { title: JDL, id: jdl }
  - title: Finally
    links:
      - { title: Credits, id: credits }
---

## Install {#install}

Every installed `generator-<name>` or `@scope/generator-<name>` becomes `yeoman:<name>`. yeoman-generator, mem-fs and EJS come with the generator.

### Globally {#install-global}

{% include terminal.html id="yeoman_install_global" %}

### Locally {#install-local}

{% include terminal.html id="yeoman_install_local" %}

### Not at all {#install-npx}

`yeoman:code` with nothing installed fetches the pack and `generator-code` for one run. Only `generator-code` and `generator-jhipster` are fetched this way, so a typo can't install someone else's package. `JEN_NO_FETCH=1` turns it off.

{% include terminal.html id="yeoman" %}

Any other generator: `--from`.

{% include terminal.html id="yeoman_install_from" %}

## Running generators {#running}

### How it runs {#how}

The generator writes into memory; that becomes jen's plan, with `--force`, `--dry-run` and the project boundary as usual. Binary files are kept as they are.

- **No questions**: answers come from flags or defaults.
- **No network**: any connection fails the run. Generators that download templates, like `generator-office`, can't run.
- **No install step**: `install` and `end` (`npm install`, `git init`, opening an editor) are skipped – run those yourself.

### Questions {#questions}

A flag named after the question answers it: `--extensionType` or `--extension-type`. Otherwise it's what Enter would give – default, first choice, or yes. No answer at all: `Missing: --<name>`.

Generator options and positional arguments are passed on too.

### `yeoman:<name>` {#generators}

Runs what `yo <name>` runs, in a minimal Yeoman environment. `composeWith` fails with a message (JHipster gets a full environment). Writes that bypass Yeoman's file system escape the plan.

{% include terminal.html id="yeoman_code" %}

## JHipster {#jhipster-section}

### `yeoman:jhipster` {#jhipster}

The same files as `jhipster`, minus `npm install` and `git init`. `--defaults` takes every default; any JHipster option works as a flag, e.g. `--base-name=blog`.

{% include terminal.html id="yeoman_jhipster" %}

Blueprints are off (they'd install from npm). Files outside the project, like `~/.yo-rc-global.json`, are skipped.

### JDL and commands {#jdl}

The first positional is the JHipster command: `jen yeoman:jhipster jdl blog.jdl`. The JDL file must be in the project. Use JDL for entities – `entity` would ask field by field. Regenerating needs `--force`:

{% include terminal.html id="yeoman_jdl" %}

## Credits {#credits}

- **[Yeoman](https://yeoman.io)** by the Yeoman team: the generators, and the environment the pack stands in for
- **[JHipster](https://www.jhipster.tech)** by the JHipster team: the environment builder and the deferred commit the pack runs JHipster with
