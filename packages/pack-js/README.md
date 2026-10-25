# @codejen/pack-js

A [jen](https://learosema.github.io/jen/) pack for TypeScript and JavaScript patterns – classes, enums, tagged unions, branded types, errors, event emitters, modules and tests – in TypeScript, JSDoc-typed JavaScript or plain JavaScript, whichever your project uses.

**Documentation: <https://learosema.github.io/jen/js.html>**

## Install

```sh
npm install --save-dev @codejen/pack-js   # or: npm install -g @codejen/jen @codejen/pack-js
```

```sh
jen js:union --name=shape --cases="circle:{radius:number},square:{size:number}"
jen js:brand --name=user-id --withTest
```

## License

ISC © Lea Rosema
