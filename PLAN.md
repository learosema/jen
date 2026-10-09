# jen packs – plan

Where the pack work stands and what comes next. Written 2026-10-08, updated 2026-10-09 after pack-js, so a fresh session can pick it up. Read [CLAUDE.md](CLAUDE.md) first: its rules (never commit, never interactive, no network, no `px`, no Markdown tables, docs on the website only, always credit) apply to everything below.

## Status

- **pack-cpp, pack-glsl, pack-web**: released (pack-web 1.0.0).
- **pack-js**: done, all four steps below, not released yet (version `0.0.0`, already in `release-please-config.json` and `.release-please-manifest.json`). Generators: `js:element`, `roving`, `menu`, `grid`, `hotkeys`, `class`, `enum`, `union`, `brand`, `error`, `emitter`, `module`, `test`. Docs: [docs/js.md](docs/js.md), published at <https://learosema.github.io/jen/js.html>.
- **Next: pack-ecs**, then pack-react, pack-vue.

## How a pack is built – pack-web is the reference

Copy pack-web's structure for every new pack:

- **Package**: `packages/pack-<name>/` with `package.json` (version `0.0.0`, `"license": "ISC"`, `peerDependencies` `@codejen/jen: ^2.0.0`, `files` listing `dist` and `templates`), `tsconfig.json` (includes `src`, `scripts`, tests), `tsconfig.build.json` (copy). Add it to `release-please-config.json` and `.release-please-manifest.json` (`"0.0.0"`), then `npm install` once to link the workspace.
- **Namespace**: the pack's prefix comes from its package name (`packPrefix` in `packages/jen/src/cli.ts`), so `@codejen/pack-js` can only provide `js:` – another namespace needs its own package.
- **Generators**: `src/<name>.ts`, each a `Generator` (`params`, `actions(answers, helpers, ctx)`), registered in `src/index.ts`. Action paths are relative to the destination (`--dir`), `/…` to the project root. Params with `path: true` arrive root-relative (`/…`).
- **Templates**: whole-file boilerplate lives as plain files in `templates/` (`.css`, `.html`, `.js`, `.ts`), read with `template()` and filled with `fill()` from `src/templates.ts` – copy that file. `{{name}}` placeholders; a `null` value drops the line; a placeholder alone on its line takes multi-line values at its indent. Only computed output stays in code.
- **Comments**: source and template files carry no explanatory headers – one line per module, plus a credit line (author + link) wherever an idea or snippet came from someone. Never copy code without a license that allows it; write it fresh and credit.
- **Wiring into existing files**: pack-web's `src/entry.ts` (find the nearest file with a marker, insert relative `@import "./…"` lines) and `src/html.ts` (`--into=<page.html>` inserts markup before `</body>`, no marker needed) are the patterns. jen's own `insert` dedupes, so re-running is safe.
- **Tests**: `pack-<name>.test.ts` with `node:test`, an in-memory `Context` (see `context()` in `pack-web.test.ts`) and a small stand-in for jen's `Helpers` (only what the generators use, e.g. `kebab`). Erasable TypeScript only – no parameter properties, enums or namespaces.
- **Docs**: a page `docs/<name>.md` (layout `doc`, front matter with `eyebrow`, `mega`, `lede`, `sub`, `cta`, `toc` – copy `docs/web.md`), terminal blocks in `docs/_data/terminals.yml` (copied from real jen runs), params via `{% include cards.html rows=rows … %}`, links in `docs/_data/nav.yml` (header and footer), the language badge in `docs/_data/langs.yml` (TS and JS are there with `soon: true` – drop `soon` when pack-js ships). Live previews: a `scripts/docs-assets.ts` that runs the pack's generators in memory and writes preview pages to a gitignored `docs/<name>/` folder, shown with `{% include web-preview.html src=… dual=true %}` (light and dark side by side). Add the script to `.github/workflows/pages.yml`, the root `npm run docs` script and `.gitignore`. Literal `{{…}}` in docs needs `{% raw %}`.
- **README**: minimal – what it is, the docs link, install, credits, license (see `packages/pack-web/README.md`). The website is the single source of truth.

## How to verify

- `npm test`, `npx eslint .`, `npx tsc -p packages/<pack> --noEmit`.
- Real CLI runs: build the pack (`npm run build -w packages/<pack>`), make a scratch project with `package.json` listing the pack as a devDependency and `node_modules/@codejen/<pack>` symlinked to the package, run `node packages/jen/dist/jen.js <ns>:<gen> …` there.
- Browser checks: headless `chromium --screenshot` (add `--force-prefers-reduced-motion` for docs pages, whose scroll-reveal otherwise hides content). Interactions can be triggered by a test copy of the page that calls `.click()` on load.
- Docs: `node packages/<pack>/scripts/docs-assets.ts`, then `cd docs && PATH="$(ruby -e 'puts Gem.user_dir')/bin:$PATH" bundle exec jekyll build -d <scratch>/_site` and serve that folder.
- Refactors that shouldn't change output: snapshot every generator's actions as JSON before and after, and diff.

## Phase 3: pack-js (`js:`) – done

As planned, with these decisions made along the way:

- **Styles**: `src/style.ts`. `--types=ts|jsdoc|none` on every generator, else the nearer of `tsconfig.json`/`jsconfig.json` (a tsconfig with `checkJs` means JSDoc). Template-based generators have `.ts` and `.js` (JSDoc) templates; plain JS is the JSDoc version run through `stripTypes()`, so JSDoc blocks must be type-only (a description goes on a `//` line above). Computed generators write TS and JSDoc, and plain JS is stripped the same way (`pick()`). Relative imports end in `.ts` only where the tsconfig allows it, else `.js`.
- **`js:element`**: light DOM by default (Lea, 2026-10-09) – `--shadow=open|closed` for a shadow root with a `<slot>`; the light-DOM stylesheet is adopted once by the element's root node. `emit()` takes a conditional rest tuple, so an event without a detail is `emit('close')` (TypeScript won't drop a `void` param through a generic indexed type). JSDoc can't do `declare global`, so its tag goes into a shared `elements.d.ts` at a `// jen:elements` marker. `--into` takes a page (tag + module script before `</body>`) or a module (import above the first line of code).
- **Keyboard modules**: one function each, returning a cleanup function and taking `signal`. No `--into` – they export functions to call. The hotkeys help overlay is a runtime option (`createHotkeys({ help: true })`), not a generator flag.
- **Type patterns** use `--fields` (`js:class`, `js:error`), `--values`, `--cases=kind:{fields}`, `--underlying`, `--events`; all take `--withTest` and `--runner=node|vitest` (else Vitest if package.json lists it or a Vite/Vitest config exists).
- **Verified** by generating every generator in all three styles into a scratch project with a usage file: strict `tsc` (incl. `noUnused*`, `noImplicitOverride`, `@ts-expect-error` on bad calls) passes for TS and JSDoc, the generated tests pass under `node --test` in all three, and the keyboard modules were driven in headless Chromium.

Still open for Lea: should `js:element` take `--demo` to also write a page showing the new element running?

## Later phases

- **pack-ecs (`ecs:`)** – own package because of the namespace rule. A tiny ECS core vendored into the project (no dependency), plain-object storage; `ecs:world`, `ecs:component`, `ecs:system`, registering at markers. Same output styles as pack-js.
- **pack-react**, then **pack-vue**: hooks and composables, TanStack Query, react-hook-form / VeeValidate patterns. Design the two side by side so equivalent generators share names and params.

## Loose ends

- **jen's numeric insert markers** (`insert` with `before: <line number>`) went in under `fix(pack-web): avoid polynomial redos` (aafb10a), so they shipped in jen 2.0.1 as a patch rather than as 2.1.0. pack-web's `peerDependencies` still say `^2.0.0`, which allows 2.0.0, where `--line` crashes: bump it to `^2.0.1`. pack-js doesn't use numeric markers, so `^2.0.0` is fine there.

- Trim pack-glsl's README (114 lines) and the root README (436 lines) to the new minimal-README rule, moving anything missing into docs/.
- Shorten the long explanatory headers in pack-cpp's and pack-glsl's sources to one line (+ credits), per CLAUDE.md.
- pack-web extras: a print stylesheet (the HTML boilerplate links one), registering `web:page` pages in a multi-page Vite config, tooltips via `interestfor` once it's widely supported.
- pack-js's first release: after pushing to main, release-please proposes it – merge that PR untouched (never push onto release branches).
- pack-js extras: `removeEventListener` overloads next to `addEventListener`; submenus (Arrow Right/Left opening and closing them) in `js:menu`; multi-select listboxes in `js:roving`.
