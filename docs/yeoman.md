---
layout: doc
permalink: /yeoman.html
title: jen — Yeoman pack
description: "@codejen/pack-yeoman runs Yeoman generators – JHipster included – through jen's plan: never interactive, no network, nothing written before you see it."
eyebrow: "@codejen/pack-yeoman"
mega: yeoman
lede: Yeoman generators, JHipster included, run through jen's plan – the same diff, the same <code>--dry-run</code>, the same <code>--force</code>.
sub: Never interactive, never online, and nothing is written until jen applies the plan.
cta: { text: "Three ways to install ↓", url: "#install" }
toc:
  - title: Install
    links:
      - { title: Globally, id: install-global }
      - { title: Locally, id: install-local }
      - { title: Not at all, id: install-npx }
  - title: Running generators
    links:
      - { title: How it runs, id: how }
      - { title: Questions, id: questions }
      - { title: Any generator, id: generators }
  - title: JHipster
    links:
      - { title: "yeoman:jhipster", id: jhipster }
      - { title: JDL and commands, id: jdl }
  - title: Finally
    links:
      - { title: Coming from jen 2, id: jen-2 }
      - { title: Credits, id: credits }
---

## Install {#install}

The pack runs the generators you have installed: every dependency named `generator-<name>` or `@scope/generator-<name>` becomes `yeoman:<name>`. jen adds no dependency for it – yeoman-generator, mem-fs and EJS come with the generator.

### Globally {#install-global}

{% include terminal.html id="yeoman_install_global" %}

### Locally {#install-local}

{% include terminal.html id="yeoman_install_local" %}

### Not at all {#install-npx}

Ask for `yeoman:code` with nothing installed, and jen fetches `@codejen/pack-yeoman` and `generator-code` into a throwaway directory, runs the generator once and removes it again – like `yo code`, without the global install. jen only does this for a fixed list of generators: `generator-code` and `generator-jhipster`. A typo like `yeoman:jhispter` matches nothing on the list, so it can never install someone else's package. `JEN_NO_FETCH=1` turns it off.

{% include terminal.html id="yeoman" %}

Any other generator can be fetched for one run with `--from`:

{% include terminal.html id="yeoman_install_from" %}

## Running generators {#running}

### How it runs {#how}

The generator writes into memory, and what it wrote becomes jen's plan: new files, changed files, deleted files. jen applies it like any other – existing files are skipped unless you pass `--force`, `--dry-run` only shows it, and nothing outside the project is touched. Binary files, like images and keystores, are written as they are.

Some things are left out on purpose:

- **No questions.** Every answer comes from a flag or the question's default – see below.
- **No network.** While a generator runs, `fetch` and every outgoing connection fail, and so does the run – even if the generator catches the error itself. Generators that download their templates, like `generator-office`, can't run under jen.
- **No install step.** Yeoman's `install` and `end` steps run `npm install`, `git init` or open an editor, on files that aren't written yet when the generator runs. They never run: install and initialize the project yourself afterwards.

### Questions {#questions}

A generator's questions are answered from a flag with the question's name – as it's written, or in kebab-case: `--extensionType` and `--extension-type` both answer `extensionType`. Without a flag, the answer is what pressing enter would give: the question's default, the first choice of a list, yes for a confirm. A question with none of these stops jen with `Missing: --<name>` before anything is written. Questions the generator would skip, it skips here too.

Most generators also take options for the things they ask; check the generator's own docs. Positionals after the generator name go to the generator as its arguments.

### `yeoman:<name>` {#generators}

Runs the package's default generator – the one `yo <name>` runs – with just enough of a Yeoman environment around it. Generators that compose other generators (`composeWith`) fail with a clear message; JHipster is the one that gets a real environment. A generator that writes to disk itself, past Yeoman's file system, isn't caught by the plan – the generators on jen's fetch list don't.

{% include terminal.html id="yeoman_code" %}

## JHipster {#jhipster-section}

### `yeoman:jhipster` {#jhipster}

With `generator-jhipster` installed, `yeoman:jhipster` runs JHipster in its own Yeoman environment, with its sub-generators, priorities and Prettier formatting – the files are the ones the `jhipster` command would write, minus `npm install` and `git init`. `--defaults` takes every default instead of asking; any other JHipster option works as a flag, e.g. `--base-name=blog`.

{% include terminal.html id="yeoman_jhipster" %}

Blueprints are turned off, since JHipster would install a missing one from npm. Files JHipster keeps outside the project, like `~/.yo-rc-global.json`, are skipped.

### JDL and commands {#jdl}

The first positional picks a JHipster command, the same as with `jhipster`: `jen yeoman:jhipster jdl blog.jdl` applies a JDL file. The file has to be inside the project – JHipster would otherwise look it up online. Describe entities in JDL: `jhipster entity` asks for every field one by one, so without JDL it stops at the first field. Regenerating changes files that exist, so it needs `--force`:

{% include terminal.html id="yeoman_jdl" %}

## Coming from jen 2 {#jen-2}

jen 2 ran Yeoman generators itself, under their short name: `jen code`. That moved into this pack, so it's `jen yeoman:code` now, and `jen --from generator-code yeoman:code`. jen 3 points it out when you use the old name.

## Credits {#credits}

- **[Yeoman](https://yeoman.io)** by the Yeoman team: the generators, and the environment the pack stands in for
- **[JHipster](https://www.jhipster.tech)** by the JHipster team: the environment builder and the deferred commit the pack runs JHipster with

The pack is ISC licensed.
