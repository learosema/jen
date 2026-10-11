# @codejen/pack-yeoman

A [jen](https://learosema.github.io/jen/) pack that runs [Yeoman](https://yeoman.io) generators – [JHipster](https://www.jhipster.tech) included – through jen's plan: never interactive, never online, and nothing is written before you see it.

**Documentation: <https://learosema.github.io/jen/yeoman.html>**

## Install

```sh
npm install --save-dev @codejen/pack-yeoman generator-code   # or: npm install -g @codejen/jen @codejen/pack-yeoman generator-code
```

```sh
jen yeoman:code --extensionType=command-ts --extensionDisplayName="My Extension"
jen yeoman:jhipster --defaults --base-name=blog
```

## Credits

[Yeoman](https://yeoman.io) by the Yeoman team, and [JHipster](https://www.jhipster.tech) by the JHipster team, whose environment builder and deferred commit the pack runs JHipster with.

## License

ISC © Lea Rosema
