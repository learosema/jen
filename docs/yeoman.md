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

Every installed `generator-<name>` becomes `yeoman:<name>`.

### Globally {#install-global}

{% include terminal.html id="yeoman_install_global" %}

### Locally {#install-local}

{% include terminal.html id="yeoman_install_local" %}

### Not at all {#install-npx}

{% include terminal.html id="yeoman" %}

{% include terminal.html id="yeoman_install_from" %}

## Running generators {#running}

### How it runs {#how}

Into jen's plan. No questions, no network, no `npm install`.

### Questions {#questions}

A flag named after the question answers it; otherwise the default.

### `yeoman:<name>` {#generators}

{% include terminal.html id="yeoman_code" %}

## JHipster {#jhipster-section}

### `yeoman:jhipster` {#jhipster}

`--defaults`, or any JHipster option as a flag.

{% include terminal.html id="yeoman_jhipster" %}

### JDL and commands {#jdl}

{% include terminal.html id="yeoman_jdl" %}

## Credits {#credits}

- **[Yeoman](https://yeoman.io)** by the Yeoman team: the generators, and the environment the pack stands in for
- **[JHipster](https://www.jhipster.tech)** by the JHipster team: the environment builder and the deferred commit the pack runs JHipster with
