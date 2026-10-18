# jen

**the code jen(erator)** – a scaffolding CLI that never asks questions. Parameters come from the command line, every run prints exactly what it does to your files, and generators are plain JavaScript or TypeScript modules. No dependencies beyond Node.

**Documentation: <https://learosema.github.io/jen/>** – the [command line](https://learosema.github.io/jen/cli.html), [writing generators](https://learosema.github.io/jen/generators.html), and the packs for C++, GLSL, the web, JavaScript and Yeoman.

## Install

Requires Node.js 24 or newer.

```sh
npm install -g @codejen/jen   # or run it without installing: npx @codejen/jen
```

```sh
jen generator --name=hello   # writes .jen/hello.mjs
jen hello --name=world       # writes World.txt
```

## License

MIT © Lea Rosema
