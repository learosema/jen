# @codejen/pack-js

A [jen](https://learosema.github.io/jen/) pack for TypeScript and JavaScript: custom elements with typed attributes and events, the ARIA keyboard patterns (roving tabindex, menus, grids, hotkeys), and type patterns – classes, enums, tagged unions, branded types, errors, event emitters and tests. It writes TypeScript, JSDoc-typed JavaScript or plain JavaScript, whichever your project uses.

**Documentation: <https://learosema.github.io/jen/js.html>** – every generator with its params, the plan it prints, and live previews.

## Install

```sh
npm install --save-dev @codejen/pack-js   # or: npm install -g @codejen/jen @codejen/pack-js
```

```sh
jen js:element --name=star-rating --attrs=max:number --events="change:{value:number}" --into=index.html
jen js:menu --dir=src/lib
```

## Credits

The keyboard patterns follow the [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) by the W3C Web Accessibility Initiative. Everything is written fresh for this pack and credited where it's used.

## License

ISC © Lea Rosema
