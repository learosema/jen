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

   `--flags` or defaults. No prompts.

2. ### Plan

   Every change, printed. `--dry-run` only looks.

3. ### Act

   Same params, same output.
{: .steps .reveal}

</section>

<section class="reveal" markdown="1">

Why
{: .kicker}

## Small on purpose.
{: .big}

- **Zero dependencies.** Just Node.
- **No dialog.** Even for Yeoman generators.
- **Logic for free.** Template literals.
- **Deterministic.** Same params, same output.
- **Language-agnostic.** Anything that's text.
- **Try before you install.** `npx --yes @codejen/jen …`
{: .why .auto-grid .reveal}

</section>

<section id="where" class="reveal" markdown="1">
<div class="split" markdown="1">
<div markdown="1">

Where files go
{: .kicker}

## Right where you *stand*.
{: .big}

- **Where you stand**, or `--dir`.
- **Nothing outside the project** is touched.

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

One file in `.jen/`: `params` and `actions()`.
{: .sub}

{% include generator-example.html %}

{% include actions.html %}

<div class="facts auto-grid reveal" markdown="1">
<div markdown="1">

### Case helpers, built in

`pascal` `camel` `snake` `kebab` `constant`

</div>
<div markdown="1">

### Logic is just JavaScript

`? :` and `.map()`.

</div>
<div markdown="1">

### Respects your .editorconfig

</div>
<div markdown="1">

### Share it as a pack

`jen-pack-<name>` or `@scope/pack-<name>`.

</div>
</div>

[Writing generators]({{ '/generators.html' | relative_url }})
{: .sub}

</section>

<section class="reveal" markdown="1">
<div class="split" markdown="1">
<div markdown="1">

Bring your own ecosystem
{: .kicker}

## Not just your own generators.
{: .big}

[Yeoman](https://yeoman.io/) generators, JHipster included, with [`@codejen/pack-yeoman`](yeoman.html).

</div>
{% include terminal.html id="yeoman" title="~/projects" %}
</div>
</section>

{% include finale.html %}
