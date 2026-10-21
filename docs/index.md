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

   Answers come from `--flags` or defaults. Missing or unknown flag? jen says so and quits. No prompts.

2. ### Plan

   Every change is printed: `+` add, `~` modify, `=` skip. `--dry-run` only looks.

3. ### Act

   Files are written. Same params, same output. Indentation follows your `.editorconfig`.
{: .steps .reveal}

</section>

<section class="reveal" markdown="1">

Why
{: .kicker}

## Small on purpose.
{: .big}

- **Zero dependencies.** No Handlebars, no Inquirer. Just Node.
- **No dialog.** Params come from the command line, even for Yeoman generators.
- **Logic for free.** Template literals already do conditionals and loops.
- **Readable output.** Every run prints what it adds, changes and skips.
- **Deterministic.** Same params, same output.
- **Language-agnostic.** C++, CMake, shaders – anything that's text.
- **Try before you install.** `--from` runs a pack once and cleans up. `lua:function` without the pack fetches `@codejen/pack-lua`.
- {: .wide} **Runs real Yeoman generators**, JHipster included, with [`@codejen/pack-yeoman`](yeoman.html) – borrowing yeoman-generator, mem-fs and EJS from the generator's own install.
{: .why .auto-grid .reveal}

</section>

<section id="where" class="reveal" markdown="1">
<div class="split" markdown="1">
<div markdown="1">

Where files go
{: .kicker}

## Right where you *stand*.
{: .big}

- **Files land where you stand.** App starters make a new folder. `--dir=<path>` writes elsewhere.
- **Generators say what, jen says where.** Files to wire into, like a `CMakeLists.txt` with a marker, jen finds: the nearest one above.
- **The project root is the boundary.** It's the nearest `.jen/`, `package.json` or `.git` above you. Nothing outside is touched.

</div>
{% include terminal.html id="where" title="~/projects/my-game" %}
</div>
</section>

{% include packs.html %}

<section id="write" class="reveal" markdown="1">

Make it yours
{: .kicker}

## Write your own *jen*.
{: .big}

One file: `params` and an `actions()` function. No template language, no plugin API. Drop it in `.jen/` and it's a command.
{: .sub}

{% include generator-example.html %}

{% include actions.html %}

<div class="facts auto-grid reveal" markdown="1">
<div markdown="1">

### Case helpers, built in

`pascal` `camel` `snake` `kebab` `constant`: **rigid body** becomes `RigidBody`, `rigidBody`, `rigid_body`, `rigid-body`, `RIGID_BODY`.

</div>
<div markdown="1">

### Logic is just JavaScript

`? :` and `.map()`. A test file on request: `...(withTest ? [{ add: … }] : [])`.

</div>
<div markdown="1">

### Respects your .editorconfig

New files and inserts use the project's indent style.

</div>
<div markdown="1">

### Share it as a pack

Publish as `jen-pack-<name>` or `@scope/pack-<name>`, like [@codejen/pack-cpp]({{ '/recipes.html' | relative_url }}).

</div>
</div>

Lookup order: `.jen/`, user config, `$JEN_PATH`, packs, built-ins. First match wins. More in [command line]({{ '/cli.html' | relative_url }}) and [writing generators]({{ '/generators.html' | relative_url }}).
{: .sub}

</section>

<section class="reveal" markdown="1">
<div class="split" markdown="1">
<div markdown="1">

Bring your own ecosystem
{: .kicker}

## Not just your own generators.
{: .big}

[`@codejen/pack-yeoman`](yeoman.html) runs real [Yeoman](https://yeoman.io/) generators, JHipster included – fetched on the fly, never touching your dependencies.

</div>
{% include terminal.html id="yeoman" title="~/projects" %}
</div>
</section>

{% include finale.html %}
