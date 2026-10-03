/**
 * `glsl:webgl`: a no-build WebGL2 playground – index.html, the
 * <shader-canvas> element (web/shader-canvas/, dependency-free) and a
 * glsl:frag starter it renders full-screen.
 *
 * Fetching shader files needs any static server (`npx serve`,
 * `python3 -m http.server`, …); `--inline` puts the shader into the page
 * instead, so it also opens straight from disk (the element is a classic
 * script for that reason – browsers refuse module scripts from file://).
 * `--tag` renames the element if `shader-canvas` collides with something
 * on the page.
 */
import type { Action, Generator } from '@codejen/jen';
import { fail, inFolder, readPackFile } from './common.ts';
import { withHeader } from './dialect.ts';

const TAG_LINE = /^([ \t]*)const TAG = 'shader-canvas';$/m;

/** The element's source, with its name swapped for `tag`. */
export function componentSource(tag: string): string {
  const source = readPackFile('web/shader-canvas/shader-canvas.js');
  if (!TAG_LINE.test(source)) fail('pack-glsl: web/shader-canvas/shader-canvas.js lost its `const TAG` line');
  return source.replace(TAG_LINE, `$1const TAG = '${tag}';`);
}

const indent = (text: string, prefix: string) =>
  text
    .trimEnd()
    .split('\n')
    .map((l) => (l ? prefix + l : l))
    .join('\n');

function page(title: string, tag: string, script: string, element: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      html, body { margin: 0; block-size: 100%; background: #111; }
      ${tag} { position: fixed; inset: 0; aspect-ratio: auto; }
    </style>
    <script src="${script}" defer></script>
  </head>
  <body>
${element}
  </body>
</html>
`;
}

const webglGenerator: Generator = {
  description: 'create a no-build WebGL2 playground',
  params: {
    name: {},
    dir: { default: '.' },
    tag: { default: 'shader-canvas' },
    inline: { default: false },
  },
  actions: ({ name, dir, tag, inline }, { kebab, pascal }) => {
    const t = String(tag);
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(t)) {
      fail(`glsl:webgl --tag: "${t}" is not a valid custom element name (lowercase, with a hyphen, e.g. "shader-canvas")`);
    }
    const folder = String(dir);
    const base = kebab(String(name));
    const title = pascal(String(name));
    const script = `${t}.js`;
    const frag = withHeader('300es', readPackFile('starters/frag.glsl'));

    const element = inline
      ? `    <${t}>\n      <script type="x-shader/x-fragment">\n${indent(frag, '        ')}\n      </script>\n    </${t}>`
      : `    <!-- Fetching shaders needs a local web server, e.g. \`npx serve\` or \`python3 -m http.server\`. -->\n` +
        `    <!-- \`live\` recompiles whenever the file changes. -->\n` +
        `    <${t} src="shaders/${base}.frag.glsl" live></${t}>`;

    const actions: Action[] = [
      { add: inFolder(folder, 'index.html'), template: page(title, t, script, element) },
      { add: inFolder(folder, script), template: componentSource(t) },
    ];
    if (!inline) actions.push({ add: inFolder(folder, `shaders/${base}.frag.glsl`), template: frag });
    return actions;
  },
};

export default webglGenerator;
