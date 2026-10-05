# Changelog

## [1.0.0](https://github.com/learosema/jen/compare/pack-cpp-v0.2.0...pack-cpp-v1.0.0) (2026-10-05)


### ⚠ BREAKING CHANGES

* **pack-cpp:** generators write into the current directory (or --dir) instead of src/, and wire into the nearest CMakeLists.txt with the marker. --withTest puts the test next to the header. --cmake is gone.

### Features

* **pack-cpp:** let jen decide where files go ([65b9e4b](https://github.com/learosema/jen/commit/65b9e4b835e18f3d7ff99163d5a830198f2c6298))

## [0.2.0](https://github.com/learosema/jen/compare/pack-cpp-v0.1.0...pack-cpp-v0.2.0) (2026-10-02)


### Features

* add more templates ([6724e1c](https://github.com/learosema/jen/commit/6724e1cc5ebc4c9cb2485dc79e21477118dd1c61))
* app-starters create project folders ([ceb150c](https://github.com/learosema/jen/commit/ceb150ca5dfa2988018e1e436c6bd922bff19e88))


### Bug Fixes

* fix polynomial redos issues ([4306de0](https://github.com/learosema/jen/commit/4306de0e8faa0546a6242ae38e38621b00271569))
