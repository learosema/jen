# Changelog

## [3.0.0](https://github.com/learosema/jen/compare/pack-web-v2.1.0...pack-web-v3.0.0) (2026-10-25)


### ⚠ BREAKING CHANGES

* **pack-web:** web:import is gone – add `@import "./your.css";` to styles.css, before /* jen:imports */.

### Bug Fixes

* **pack-js, pack-web:** need @codejen/jen 4 ([b4e99ec](https://github.com/learosema/jen/commit/b4e99ec3fd5920ece7541dd5db8d806283caedff))
* **pack-web:** a new palette color reaches the buttons and badges the project has ([895596c](https://github.com/learosema/jen/commit/895596ccf9de54a994d6671191fdb9366ceeaff7))
* **pack-web:** a select's text isn't clipped at the bottom ([dcef91a](https://github.com/learosema/jen/commit/dcef91a914b5155383accf76626c95e57f1067a9))
* **pack-web:** blocks keep their own lines in --list ([d24d6bf](https://github.com/learosema/jen/commit/d24d6bfab6c4f6a64e5e504d2bca94275e960c48))
* **pack-web:** dashboard links work from file://, notes say what to replace and what's guaranteed ([c37cc09](https://github.com/learosema/jen/commit/c37cc0920d57585209bc93592b32f78059b17ef5))
* **pack-web:** fix css bug ([f7438c0](https://github.com/learosema/jen/commit/f7438c0bf964b2b4e1840ad9c4de5bf5a3a937d8))
* **pack-web:** group the generators in --list; a new palette moves theme-color and the manifest along ([33d11f4](https://github.com/learosema/jen/commit/33d11f4b16e557b4dfbad7c84db384be70210a7c))
* **pack-web:** quote placeholder text without stripping tags ([9a9176c](https://github.com/learosema/jen/commit/9a9176cedd64fb0a7446efbbeee2202d99726aa1))
* **pack-web:** remove web:import ([8b86c41](https://github.com/learosema/jen/commit/8b86c4198528afd25bca27048a6aae3d8bd45821))
* **pack-web:** the placeholder warning quotes the text it found ([84c1b4a](https://github.com/learosema/jen/commit/84c1b4a3922bac579759709671907bd1a93788cc))
* **pack-web:** the site name as a brand, neutral pills that show on cards, one stat label ([3e84191](https://github.com/learosema/jen/commit/3e841917daf7c1d15443394741a7577a45e77abd))
* **pack-web:** warn when a new palette drops a color, and when palette tokens are undefined ([eb983ed](https://github.com/learosema/jen/commit/eb983eddff8c8dbc8b0c836150add249a1c420ac))
* **pack-web:** web:check finds layout placeholders, the dashboard has a button and an activity list, web:page --like ([8dec838](https://github.com/learosema/jen/commit/8dec838e11177847a3c060e9c4206cb8de34e3c3))
* **pack-web:** web:color and web:palette say where an accent color goes ([37a0750](https://github.com/learosema/jen/commit/37a075048967b49ec9e539cf3303ac3507d411ce))

## [2.1.0](https://github.com/learosema/jen/compare/pack-web-v2.0.1...pack-web-v2.1.0) (2026-10-25)


### Features

* **pack-web:** page layouts, rendered checks, script generators, friendlier blocks ([8027780](https://github.com/learosema/jen/commit/8027780864df0b8991bda25f79c6b78498065a15))


### Bug Fixes

* **pack-web:** calmer block defaults – subtle borders, slimmer controls ([f0e4f6b](https://github.com/learosema/jen/commit/f0e4f6b0b538fd015fd132e57857124063c12862))
* **pack-web:** place palette roles between shades, only as far apart as their ratio needs ([5ef1fc8](https://github.com/learosema/jen/commit/5ef1fc855d8a4681ea91fafaf56918e47f634606))
* **pack-web:** say why Chromium quits in web:check --render; allow its sandbox in CI ([67b6e2f](https://github.com/learosema/jen/commit/67b6e2f6179313dedc983189ae3b6aa7f413ddc5))
* **pack-web:** web:check --render survives Chromium closing its pipe ([ed37db3](https://github.com/learosema/jen/commit/ed37db36004f008a516e520edaf9a77ff38244ed))
* packs accept @codejen/jen 4 ([d6d39b5](https://github.com/learosema/jen/commit/d6d39b538021efda59c4656b6149ed0a5f895a9d))

## [2.0.1](https://github.com/learosema/jen/compare/pack-web-v2.0.0...pack-web-v2.0.1) (2026-10-22)


### Bug Fixes

* **pack-web:** update peer deps ([0e54f1c](https://github.com/learosema/jen/commit/0e54f1c68ced7e602f8d0515a43b2c9fb42467d0))

## [2.0.0](https://github.com/learosema/jen/compare/pack-web-v1.5.0...pack-web-v2.0.0) (2026-10-22)


### ⚠ BREAKING CHANGES

* new projects put utilities after blocks, so a utility class on a block wins. Existing styles.css files keep their order.

### Features

* **pack-web:** --dir hint, usage as CSS, styled form fields ([9e2b63f](https://github.com/learosema/jen/commit/9e2b63fb278d760b2ac52a6240a1cfd150f50e4f))
* **pack-web:** add ability to merge utils into one file ([73cb888](https://github.com/learosema/jen/commit/73cb8884875d1e85c1d5d32f310966afca317f79))
* **pack-web:** add more granular generators for tools ([bf94b76](https://github.com/learosema/jen/commit/bf94b76313015daee6cbff02c77f54adc044e293))
* **pack-web:** improve cli experience ([68ac477](https://github.com/learosema/jen/commit/68ac47784a660ee8f511719cc125f715ae5ecf94))
* **pack-web:** page links note, palette/cube usage, brand color note ([8ed0d78](https://github.com/learosema/jen/commit/8ed0d78fea1ca9fa0ffb525ccd50b07997595336))
* **pack-web:** web:check, color-border-subtle, import, various blocks, dashboard recipe ([630264f](https://github.com/learosema/jen/commit/630264fc37304f92187032bffae6328321d3afa2))
* rework utils, notes instead of failures, cube --into, usage ([afb7939](https://github.com/learosema/jen/commit/afb793985fef39c8fe77fc249a31f04efecc76ed))


### Bug Fixes

* **pack-web:** fix regex security issue ([76f4baa](https://github.com/learosema/jen/commit/76f4baaf0e58f499d83a93d78567b495308d1a36))
* **pack-web:** update license ([c23ebc5](https://github.com/learosema/jen/commit/c23ebc51d01858850d7add3a40136cf5c7f86171))

## [1.5.0](https://github.com/learosema/jen/compare/pack-web-v1.4.0...pack-web-v1.5.0) (2026-10-18)


### Features

* **pack-web:** add metadata for pack-web ([d791f83](https://github.com/learosema/jen/commit/d791f832fb39ceb4941e14f8ab68da7a164264f4))

## [1.4.0](https://github.com/learosema/jen/compare/pack-web-v1.3.0...pack-web-v1.4.0) (2026-10-13)


### Features

* **pack-web:** support string args for --line ([1211a73](https://github.com/learosema/jen/commit/1211a73cbff4a14346f3301c45a7c3df3d939a01))

## [1.3.0](https://github.com/learosema/jen/compare/pack-web-v1.2.1...pack-web-v1.3.0) (2026-10-11)


### Features

* **main:** add --list --json command ([5040305](https://github.com/learosema/jen/commit/5040305f61f0a3414d04ede4084d7565e3c14e15))

## [1.2.1](https://github.com/learosema/jen/compare/pack-web-v1.2.0...pack-web-v1.2.1) (2026-10-11)


### Bug Fixes

* **pack-web:** fix codeql issues ([1eafce4](https://github.com/learosema/jen/commit/1eafce4e3871cdee0861407e16df18c6172f6819))

## [1.2.0](https://github.com/learosema/jen/compare/pack-web-v1.1.0...pack-web-v1.2.0) (2026-10-11)


### Features

* **pack-web:** implement pwa utilities ([c818417](https://github.com/learosema/jen/commit/c818417171b56e9a3a5293d18c992ce31b579fcf))

## [1.1.0](https://github.com/learosema/jen/compare/pack-web-v1.0.0...pack-web-v1.1.0) (2026-10-11)


### Features

* **pack-yeoman:** move yeoman into separate pack ([d7fa9cd](https://github.com/learosema/jen/commit/d7fa9cddcdef95d8eed663b7a485819e7f9e2854))

## 1.0.0 (2026-10-08)


### Features

* **pack-web:** add tailwind support, modern css techniques and documentation ([ab6a1db](https://github.com/learosema/jen/commit/ab6a1db2e006da2d2411b3dacc446f92e4ce56ba))
* **pack-web:** add varous snippets and boilerplates ([0fe2527](https://github.com/learosema/jen/commit/0fe2527ddcd8e3c141666fe2d7cd1a266d860c32))
* **pack-web:** initial commit, scaffold base styles, tokens and palettes ([9a2ce8b](https://github.com/learosema/jen/commit/9a2ce8be91fbe9d1080bc7220e9df047ba729496))


### Bug Fixes

* **pack-web:** avoid polynomial redos ([aafb10a](https://github.com/learosema/jen/commit/aafb10a6d60be4bc9b52a881f744def388ac36db))
