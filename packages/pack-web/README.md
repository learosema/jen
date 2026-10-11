# @codejen/pack-web

A [jen](https://learosema.github.io/jen/) pack for web development: a contrast-checked color palette with light and dark mode, a CUBE CSS starter with fluid type and space, layout compositions, buttons, cards, dialogs, popovers, scroll-driven animations, view transitions, and a manifest and service worker for installable, offline-capable sites – plain HTML and CSS, WCAG AAA by default.

**Documentation: <https://learosema.github.io/jen/web.html>** – every generator with its params, the plan it prints, and live previews.

## Install

```sh
npm install --save-dev @codejen/pack-web   # or: npm install -g @codejen/jen @codejen/pack-web
```

```sh
jen web:cube --primary=#5b5bd6 --dir=src/css
jen web:page --name=index --site="My Site"
```

## Credits

The CSS follows [CUBE CSS](https://cube.fyi) by Andy Bell, [Every Layout](https://every-layout.dev) by Heydon Pickering and Andy Bell, [SmolCSS](https://smolcss.dev) by Stephanie Eckles, [Utopia](https://utopia.fyi) by James Gilyead and Trys Mudford, and [Reasonable Colors](https://www.reasonable.work/colors/) by Matthew Howell; `web:page` follows the [HTML boilerplate](https://matuzo.at/blog/html-boilerplate/) by Manuel Matuzović and links the icon set from [How to Favicon](https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs) by Andrey Sitnik; `web:manifest` follows [MDN's manifest reference](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest), and `web:sw` the caching strategies of [The Offline Cookbook](https://web.dev/articles/offline-cookbook) by Jake Archibald. Everything is written fresh for this pack and credited where it's used.

## License

ISC © Lea Rosema
