# Changelog

> Renamed from `@lea.rosema/jen` to `@codejen/jen` and republished as 1.0.0. The history below (up to 1.1.0) is `@lea.rosema/jen`'s; `@lea.rosema/jen` is deprecated in favor of this package.

## [4.0.0](https://github.com/learosema/jen/compare/jen-v3.2.0...jen-v4.0.0) (2026-10-25)


### ⚠ BREAKING CHANGES

* **main:** TYPES_PARAM, detectTypes, ext, importExt, pick, source, stripTypes, typesFor and the Types type are no longer exported from @codejen/jen – import them from @codejen/jen/js. The package now has an exports map, so deep imports other than /js and /package.json fail.
* **main:** leaner structural information in the list/find/help comments

### Features

* **main:** reduce verbosity and noise ([2d0215f](https://github.com/learosema/jen/commit/2d0215f790f063d0bc93af6042035c72eb46f5fa))
* **main:** shorter --help and --list text, JS codegen helpers under @codejen/jen/js ([2d2c749](https://github.com/learosema/jen/commit/2d2c7493f10d699003fca071d031efde661df20d))

## [3.2.0](https://github.com/learosema/jen/compare/jen-v3.1.0...jen-v3.2.0) (2026-10-22)


### Features

* **jen:** explicit info/warning output ([89ba5da](https://github.com/learosema/jen/commit/89ba5da3e21384521a284e72a1b6c2cd92f97ca0))
* **jen:** implement --like ([a6f14be](https://github.com/learosema/jen/commit/a6f14beba9ffffbc2172d07eab65d6df9fb8c330))
* **jen:** improve cli experience ([af407ac](https://github.com/learosema/jen/commit/af407ac0c938b324858614f43c7db7227dcbdb83))
* **jen:** insert after, line numbers in plan, generator suggestions ([5755bf4](https://github.com/learosema/jen/commit/5755bf45c3475cdbb9c8296deacfd2aab8d80293))
* **jen:** jen learns append ([4ca1687](https://github.com/learosema/jen/commit/4ca1687790a8a2e94a4a0b9c604811c214fc0598))
* **jen:** skipped-files summary, written notes, clearer --list without fetching ([a6bfee1](https://github.com/learosema/jen/commit/a6bfee1c38a49226b579e0e9c1aae3b842abc104))
* **jen:** warning notes and --strict ([35db6c9](https://github.com/learosema/jen/commit/35db6c93fbd5bfabc181c2b754070535187b56c8))


### Bug Fixes

* **jen:** fix regex security issue ([e402b69](https://github.com/learosema/jen/commit/e402b6923db6ef06a3ca99ae1a81aa700f5f6fca))
* **pack-cpp:** update licenses ([dd53c5e](https://github.com/learosema/jen/commit/dd53c5eaa5c60e55944cfdcd32b7765bdacbc60e))

## [3.1.0](https://github.com/learosema/jen/compare/jen-v3.0.0...jen-v3.1.0) (2026-10-18)


### Features

* **jen:** add pack-level metadata support ([0d153ef](https://github.com/learosema/jen/commit/0d153ef40cedd514d307096d6107ae532e6a2e63))


### Bug Fixes

* **pack-yeoman:** clarify offline guardrails ([6157841](https://github.com/learosema/jen/commit/615784180bb917c0bb512e2e2977f16e0f0f6284))

## [3.0.0](https://github.com/learosema/jen/compare/jen-v2.4.0...jen-v3.0.0) (2026-10-14)


### ⚠ BREAKING CHANGES

* **jen:** unknown flags no longer fail silently

### Features

* **jen:** reject unknown flags, suggestions on error ([7d80f36](https://github.com/learosema/jen/commit/7d80f36447f397f116a3ec81b988cadff4899032))

## [2.4.0](https://github.com/learosema/jen/compare/jen-v2.3.1...jen-v2.4.0) (2026-10-13)


### Features

* **jen:** stricter boolean flags, error-handling ([d7f740e](https://github.com/learosema/jen/commit/d7f740e1fb288e2eba478b63001efd207cb9282f))

## [2.3.1](https://github.com/learosema/jen/compare/jen-v2.3.0...jen-v2.3.1) (2026-10-12)


### Bug Fixes

* **jen:** describe --name of the generator built-in ([be9d479](https://github.com/learosema/jen/commit/be9d4794ce313b6bd3a1a744f00b7f5000441ead))

## [2.3.0](https://github.com/learosema/jen/compare/jen-v2.2.0...jen-v2.3.0) (2026-10-11)


### Features

* **main:** add --list --json command ([5040305](https://github.com/learosema/jen/commit/5040305f61f0a3414d04ede4084d7565e3c14e15))

## [2.2.0](https://github.com/learosema/jen/compare/jen-v2.1.0...jen-v2.2.0) (2026-10-11)


### Features

* **pack-web:** implement pwa utilities ([c818417](https://github.com/learosema/jen/commit/c818417171b56e9a3a5293d18c992ce31b579fcf))

## [2.1.0](https://github.com/learosema/jen/compare/jen-v2.0.2...jen-v2.1.0) (2026-10-11)


### Features

* **pack-yeoman:** move yeoman into separate pack ([d7fa9cd](https://github.com/learosema/jen/commit/d7fa9cddcdef95d8eed663b7a485819e7f9e2854))

## [2.0.2](https://github.com/learosema/jen/compare/jen-v2.0.1...jen-v2.0.2) (2026-10-10)


### Bug Fixes

* update dev dependencies ([5e6df33](https://github.com/learosema/jen/commit/5e6df339c0e5335ffd78f7978fc5b0c622a2ba70))

## [2.0.1](https://github.com/learosema/jen/compare/jen-v2.0.0...jen-v2.0.1) (2026-10-08)


### Bug Fixes

* **pack-web:** avoid polynomial redos ([aafb10a](https://github.com/learosema/jen/commit/aafb10a6d60be4bc9b52a881f744def388ac36db))

## [2.0.0](https://github.com/learosema/jen/compare/jen-v1.2.0...jen-v2.0.0) (2026-10-05)


### ⚠ BREAKING CHANGES

* **jen:** remove --where, make --dir surprise-free

### Features

* **jen:** remove --where, make --dir surprise-free ([72f0834](https://github.com/learosema/jen/commit/72f083403e699ad17732d966dc865e3ba4e8dfce))


### Bug Fixes

* **jen:** run Yeoman generators in the CWD ([b147400](https://github.com/learosema/jen/commit/b1474001723ddfbc6341a5191a97d6396aa59d4d))

## [1.2.0](https://github.com/learosema/jen/compare/jen-v1.1.0...jen-v1.2.0) (2026-10-04)


### Features

* **jen:** support regexp for insert.before ([bd43477](https://github.com/learosema/jen/commit/bd43477411c5033bd53c883671f33011d74ec0b9))


### Bug Fixes

* **jen:** update esbuild ([99b1e32](https://github.com/learosema/jen/commit/99b1e32df58037b1f2d69eec8dc4cf48a7dec1d4))

## [1.1.0](https://github.com/learosema/jen/compare/jen-v1.0.0...jen-v1.1.0) (2026-09-30)


### Features

* improve jen usability/ux, website overhaul ([2f0dc37](https://github.com/learosema/jen/commit/2f0dc37943d39d1cda5dfc1943fac1b84ceb67d9))

## [1.1.0](https://github.com/learosema/jen/compare/v1.0.1...v1.1.0) (2026-09-29)


### Features

* add yeoman support ([bbe5c63](https://github.com/learosema/jen/commit/bbe5c6326e87bf55e6d9d0c590a5e4ca78c644db))


### Bug Fixes

* read available packs from the user's package.json instead of from a config ([5923ea9](https://github.com/learosema/jen/commit/5923ea9b5b7993b7eb30da7b4cfa1b36477667ed))

## [1.0.1](https://github.com/learosema/jen/compare/v1.0.0...v1.0.1) (2026-09-28)


### Bug Fixes

* use node 24 as minimum ([cf40c9f](https://github.com/learosema/jen/commit/cf40c9f73bc1a9db9133a24bb5ef8e686b9eebe8))

## [1.0.0](https://github.com/learosema/jen/compare/v0.1.0...v1.0.0) (2026-09-28)


### Miscellaneous Chores

* initial commit ([7ed31e0](https://github.com/learosema/jen/commit/7ed31e0fd7afba0b672fd788d1e3cd6dd99fee19))
