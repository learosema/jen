---
layout: doc
permalink: /agents.html
title: jen — as an agent tool
description: "What jen does for AI coding agents, measured: no tokens saved on a first build, but code with known sources, the same output every time, and cheaper changes later."
eyebrow: "@codejen/jen"
mega: agents
lede: jen is a code generator first. Agents can use it too – here is what that buys, measured.
sub: It doesn't save tokens on a first build. It changes where the code comes from.
cta: { text: "The numbers ↓", url: "#tokens" }
toc:
  - title: Measured
    links:
      - { title: Tokens, id: tokens }
      - { title: Where jen wins, id: wins }
  - title: Using it
    links:
      - { title: What agents read, id: read }
      - { title: Setup, id: setup }
---

## Tokens {#tokens}

Claude Haiku, the same tasks with and without jen, tokens with jen ÷ tokens by hand:

- **Web pages**: 0.98× – a dashboard, a second page like it, a re-brand (3 runs each)
- **Re-brand alone**: 0.42× – 2.4 times cheaper with jen
- **Shaders, first build**: 1.05×–1.30× – a landscape, a planet, a cathedral, a city
- **Shaders, follow-up changes**: 0.88× – fog, PBR, point lights, a desktop GLSL copy (3 runs each)

## Where jen wins {#wins}

- **Known sources**: every generated function names its author and link; notices land in `THIRD_PARTY_NOTICES.md`. By hand, agents called their shader code their own and credited from memory.
- **The same output every time**: three runs, byte-identical CSS.
- **Changes later**: a re-brand or a new lighting model is a command, not a rewrite.
- **Starters**: where jen has one (the terrain), its look is jen's, not the model's.

## What agents read {#read}

- **`--help`**: params, choices, usage lines, examples – text is the interface, `--json` is for scripts
- **`--list`**, **`--find <word>`**: what exists
- **`--dry-run`**: the plan, and where each function comes from, before anything is written

{% include terminal.html id="agents_dry_run" %}

## Setup {#setup}

- **Run**: `npx --yes @codejen/jen <generator> …` from the project folder – jen never asks, a missing param is an error.
- **Offline**: `JEN_NO_FETCH=1` – jen fetches nothing.
- **Command line**: [all options](cli.html).
