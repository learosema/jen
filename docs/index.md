---
layout: default
title: jen — the code jen(erator)
---

<main markdown="0">
{% include hero.html %}
</main>

{% include langs.html %}

<section id="how" class="reveal" markdown="1">

How it works
{: .kicker}

## Three steps. *Zero* surprises.
{: .big}

1. ### Params

   Answers come from `--flags` or a param's own default. Something required is missing? jen says so and quits. It never prompts.

2. ### Plan

   Every change is computed in memory and shown first: `+` add, `~` modify, `=` skip. `--dry-run` stops right here.

3. ### Act

   Only then are files written. Same params, same output, every time. Indentation follows your `.editorconfig`.
{: .steps .reveal}

</section>

<section class="reveal" markdown="1">

Why
{: .kicker}

## Small on purpose.
{: .big}

- **Zero dependencies.** No node\_modules tree, no Handlebars, no Inquirer. Just Node.
- **No dialog.** Params come from the command line. Nothing asks you questions, Yeoman generators included.
- **Templates with logic, for free.** Template literals already do conditionals and loops.
- **Plan first, then act.** Every run shows the plan before writing anything.
- **Deterministic.** Same params, same output. Every time.
- **Language-agnostic.** Scaffolds C++, CMake, Rust, shaders, or anything else that's text.
- **Try before you install.** `--from` fetches a pack or generator via npm, runs it once, and cleans up after itself. Ask for `lua:function` without the pack and jen fetches `@codejen/pack-lua` for you.
- {: .wide} **Runs real Yeoman generators, too.** No extra dependency for that either. jen borrows yeoman-generator, mem-fs and EJS straight from the generator's own install.
{: .why .reveal}

</section>

<section id="write" class="reveal" markdown="1">

Make it yours
{: .kicker}

## Write your own *jen*.
{: .big}

A generator is one file: the `params` it accepts and an `actions()` function that returns what should happen. No template language, no plugin API. Drop it in `.jen/` and it's a command.
{: .sub style="margin-bottom:2rem"}

{% include generator-example.html %}

{% include actions.html %}

<div class="facts reveal" markdown="1">
<div markdown="1">

### Case helpers, built in

`pascal` `camel` `snake` `kebab` `constant`: **rigid body** becomes `RigidBody`, `rigidBody`, `rigid_body`, `rigid-body`, `RIGID_BODY`.

</div>
<div markdown="1">

### Logic is just JavaScript

Conditionals and loops are `? :` and `.map()`. Want a test file only on request? `...(withTest ? [{ add: … }] : [])`.

</div>
<div markdown="1">

### Respects your .editorconfig

New files and inserted blocks come out in the project's own indent style, tabs or spaces.

</div>
<div markdown="1">

### Share it as a pack

Publish to npm as `jen-pack-<name>` or `@scope/pack-<name>`. Anyone with it in `package.json` gets your generators. Like [@codejen/pack-cpp]({{ '/recipes.html' | relative_url }}).

</div>
</div>

jen looks in `.jen/` (searched upwards, like `.git`), then your user config, `$JEN_PATH`, installed packs (local or global), and built-ins. First match wins; `jen --list` shows what shadows what. Full reference in the [README](https://github.com/learosema/jen#writing-generators).
{: .sub style="margin-top:2rem"}

</section>

<section class="reveal" markdown="1">
<div class="split" markdown="1">
<div markdown="1">

Bring your own ecosystem
{: .kicker}

## Not just your own generators.
{: .big}

jen also runs real [Yeoman](https://yeoman.io/) generators, and can fetch one on the fly without ever touching your project's own dependencies.

</div>
{% include terminal.html id="yeoman" title="~/projects" %}
</div>
</section>

{% include finale.html %}
