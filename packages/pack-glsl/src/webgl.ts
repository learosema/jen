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
import { posix } from 'node:path';
import type { Action, Generator } from '@codejen/jen';
import { INTO_MARKER, MARKER_LINE, NOTICES_FILE } from './chunks.ts';
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

/** One notices file from several: the first one's header, then every `## source` section once. */
function mergeNotices(files: string[]): string {
  if (files.length < 2) return files[0] ?? '';
  const [head] = files[0].split(/^## /m);
  const sections = new Map<string, string>();
  for (const file of files) {
    for (const section of file.split(/^## /m).slice(1)) sections.set(section.split('\n')[0], `## ${section.trimEnd()}\n`);
  }
  return `${head.trimEnd()}\n\n${[...sections.values()].join('\n')}`;
}

const webglGenerator: Generator = {
  description: 'create a no-build WebGL2 playground',
  params: {
    name: { description: 'page title and shader name: Clouds makes shaders/clouds.frag.glsl' },
    dir: { default: '.', description: 'folder for the playground, relative to the current directory' },
    shaderDir: { default: 'shaders', description: 'folder for the shader inside it' },
    tag: { default: 'shader-canvas', description: 'custom element name, if shader-canvas clashes with something on the page' },
    inline: { default: false, description: 'put the shader into the page, so it opens from disk without a web server' },
    texture: { default: '', description: 'texture0 for the shader (uTexture0): an image or video (.mp4, .webm) next to the page, camera, or test-pattern' },
    cubemap: { default: '', description: 'cubemap0 for the shader (uCubemap0): sky/{face}.jpg ({face} is px nx py ny pz nz), or test-pattern' },
    shader: { path: true, default: '', description: 'an existing fragment shader for the page instead of the starter, e.g. from glsl:raymarch --name' },
    post: { path: true, default: '', description: 'a post pass over the shader\'s image, e.g. from glsl:filter --post' },
  },
  examples: ['--name=Clouds', '--name=Clouds --inline', '--name=Land --inline --shader=shaders/land.frag.glsl', '--name=Retro --inline --shader=retro.frag.glsl --texture=photo.jpg', '--name=City --inline --shader=city.frag.glsl --post=retro.frag.glsl'],
  usage: [
    'with --inline the page opens from disk, and glsl:* --into=index.html adds functions to its shader',
    '<shader-canvas time="12.5"> or #t=12.5 in the URL draws one still frame, e.g. for screenshots',
    'a post pass reads the image before it as uniform sampler2D uPrevious; inline, every <script type="x-shader/x-fragment"> after the first is one',
    'texture0="photo.jpg" or "clip.mp4" needs a web server (browsers keep WebGL from reading files on a page opened from disk); "test-pattern" and "camera" work anywhere',
  ],
  actions: ({ name, dir, shaderDir, tag, inline, shader, texture, cubemap, post }, { kebab, pascal }, ctx) => {
    const t = String(tag);
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(t)) {
      fail(`glsl:webgl --tag: "${t}" is not a valid custom element name (lowercase, with a hyphen, e.g. "shader-canvas")`);
    }
    const folder = String(dir);
    const at = (file: string): string => inFolder(folder, file);
    const title = pascal(String(name));
    const script = `${t}.js`;
    // --shader: from the project root (a path param), the page's folder from there
    const own = shader ? String(shader).replace(/^\//, '') : '';
    const pageDir = posix.join(ctx.destDir, folder);
    const ownText = own ? ctx.read(own) : null;
    if (own && ownText === null) fail(`glsl:webgl --shader: can't read ${posix.relative(ctx.cwd, own)}`);
    const shaderFile = own ? posix.relative(pageDir, own) : inFolder(String(shaderDir), `${kebab(String(name))}.frag.glsl`);
    const frag = ownText ?? withHeader('300es', readPackFile('starters/frag.glsl'));
    // the page's shader takes `glsl:* --into=index.html` too
    const inlineFrag = frag.includes(INTO_MARKER) ? frag : frag.replace(/^void main\(/m, `${MARKER_LINE}\n\nvoid main(`);
    const postFile = post ? String(post).replace(/^\//, '') : '';
    const postText = postFile ? ctx.read(postFile) : null;
    if (postFile && postText === null) fail(`glsl:webgl --post: can't read ${posix.relative(ctx.cwd, postFile)}`);

    // the attribute value goes into HTML: escape what could end it
    const escape = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const attrs = (texture ? ` texture0="${escape(String(texture))}"` : '') + (cubemap ? ` cubemap0="${escape(String(cubemap))}"` : '') + (postFile && !inline ? ` post="${escape(posix.relative(pageDir, postFile))}"` : '');
    const fragmentScript = (source: string) => `      <script type="x-shader/x-fragment">\n${indent(source, '        ')}\n      </script>\n`;
    const element = inline
      ? `    <${t}${attrs}>\n${fragmentScript(inlineFrag)}${postText !== null ? fragmentScript(postText) : ''}    </${t}>`
      : `    <!-- Fetching shaders needs a local web server, e.g. \`npx serve\` or \`python3 -m http.server\`. -->\n` +
        `    <!-- \`live\` recompiles whenever the file changes. -->\n` +
        `    <${t} src="${shaderFile}"${attrs} live></${t}>`;

    const actions: Action[] = [
      { add: at('index.html'), template: page(title, t, script, element) },
      { add: at(script), template: componentSource(t) },
    ];
    if (!inline && !own) actions.push({ add: at(shaderFile), template: frag });
    // the shaders' notices belong next to the page that now holds them
    if (inline) {
      const folders = [...new Set([own, postFile].filter(Boolean).map((f) => posix.dirname(f)))].filter((d) => d !== pageDir);
      const notices = mergeNotices(folders.map((d) => ctx.read(posix.join(d, NOTICES_FILE))).filter((n): n is string => n !== null));
      const existing = ctx.read(posix.join(pageDir, NOTICES_FILE));
      if (notices && existing === null) actions.push({ add: at(NOTICES_FILE), template: notices });
      // one there already: add the sources it lacks, each as its own section
      else if (notices) for (const section of notices.split(/^## /m).slice(1)) actions.push({ append: at(NOTICES_FILE), text: `\n## ${section.trimEnd()}` });
    }
    return actions;
  },
};

export default webglGenerator;
