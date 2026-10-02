# jen website

Built by GitHub Pages' stock Jekyll (`.github/workflows/pages.yml`): no plugins, no Gemfile.
Preview locally with `jekyll serve` (or `bundle exec jekyll serve` with the `github-pages` gem).

- `index.md`, `recipes.md`: the pages, written in Markdown. `{: .class}` after a block adds a CSS class; headings that need an anchor say so: `## Title {#anchor}`.
- `_layouts/default.html`: page shell (head, header, footer). `doc.html`: reference page with a big title and a table of contents, driven by the page's front matter (see `recipes.md`).
- `_data/nav.yml`: the header and footer links, shared by every page. Add a page here to get it into the navigation.
- `_data/terminals.yml` + `_includes/terminal.html`: every terminal block. Add the lines to the data file, then `{% include terminal.html id="..." %}`.
- `_data/langs.yml`: the language badges on the landing page.
- `_includes/`: the landing page's design pieces (`hero`, `langs`, `actions`, `generator-example`, `finale`), `copy-button`, and `head`/`header`/`footer`.
- `css/*.css`, `site.js`: styles (one file per part of the site, linked in order from `_includes/head.html`) and progressive enhancement. The hero demo's scenes live in `SCENES` in `site.js`.
