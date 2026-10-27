/**
 * `glsl:port`: switches an existing shader between dialects by rewriting only
 * its header – e.g. a WebGL2 prototype (300es) into cpp:sdl3-opengl (410).
 * Default `precision … float|int;` lines are dropped and the `#version` line
 * is replaced by the target's header; other precision lines (samplers) stay,
 * since desktop GLSL accepts and ignores them.
 *
 * `--out` writes the result to a new file instead; with an .html page as
 * `--file`, the shader comes from its `<script type="x-shader/x-fragment">`.
 */
import type { Action, Generator } from '@codejen/jen';
import { fail } from './common.ts';
import { VERSIONS, header, parseVersion } from './dialect.ts';

const DEFAULT_PRECISION = /^[ \t]*precision\s+(?:lowp|mediump|highp)\s+(?:float|int)\s*;[ \t]*\r?\n/gm;
const VERSION_LINE = /^#version[^\n]*$/m;

/** The fragment shader inside a page, without the page's indentation. */
function fromPage(page: string, file: string): string {
  const m = /<script\b[^>]*\btype=["']x-shader\/x-fragment["'][^>]*>\r?\n?([\s\S]*?)<\/script>/.exec(page);
  if (!m) fail(`glsl:port --file: ${file} has no <script type="x-shader/x-fragment">`);
  const lines = m[1].replace(/\s+$/, '').split('\n');
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)![0].length));
  return `${lines.map((l) => l.slice(indent)).join('\n')}\n`;
}

const portGenerator: Generator = {
  description: 'switch a shader between GLSL dialects by rewriting its header',
  params: {
    file: { path: true, description: 'the shader to convert, or an --inline page (then --out is needed)' },
    to: { choices: VERSIONS, description: 'target dialect: 300es is WebGL2, 330 and 410 desktop OpenGL' },
    out: { path: true, default: '', description: 'write the ported shader here and leave --file as it is' },
  },
  examples: ['--file=shaders/clouds.frag.glsl --to=410', '--file=index.html --to=330 --out=shaders/scene.330.frag.glsl'],
  actions: ({ file, to, out }, _helpers, ctx) => {
    const target = String(file);
    if (!target) fail('glsl:port --file: the shader to port is required');
    const version = parseVersion(to, 'glsl:port --to');
    const page = /\.html?$/i.test(target);
    if (page && !out) fail(`glsl:port --file=${target.replace(/^\//, '')}: a page keeps its WebGL shader – add --out=<file> for the ported copy`);
    if (!out) {
      return [
        { modify: target, pattern: DEFAULT_PRECISION, replace: '' },
        { modify: target, pattern: VERSION_LINE, replace: header(version) },
      ];
    }
    const text = ctx.read?.(target.replace(/^\//, ''));
    if (text == null) fail(`glsl:port --file: ${target.replace(/^\//, '')} doesn't exist`);
    const source = page ? fromPage(text, target) : text;
    if (!VERSION_LINE.test(source)) fail(`glsl:port --file: no #version line in ${target.replace(/^\//, '')}`);
    const ported = source.replace(DEFAULT_PRECISION, '').replace(VERSION_LINE, header(version));
    const action: Action = { add: String(out), template: ported };
    return [action];
  },
};

export default portGenerator;
