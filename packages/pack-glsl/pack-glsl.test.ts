/**
 * Tests for @codejen/pack-glsl – unit tests against the pack's actions()
 * output, plus compile checks of every starter and chunk with
 * glslangValidator in each dialect (skipped when it isn't on PATH).
 *
 * A small local stand-in for jen's Helpers is used here (rather than the
 * runtime helpers from `@codejen/jen`) so this pack's tests don't depend on
 * jen's own dist being built first. `applyActions` likewise mimics jen's
 * add/insert/modify closely enough to check the resulting shader text.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { Script } from 'node:vm';
import { describe, it } from 'node:test';
import type { Action, Helpers } from '@codejen/jen';
import pack from './src/index.ts';
import { INLINE_LICENSE, NOISE_BASES, OWN_LICENSE, chunkIds, licenseText, loadChunk, noticesFor, resolveChunks } from './src/chunks.ts';
import { listGlsl, packPath } from './src/common.ts';
import { VERSIONS, header } from './src/dialect.ts';
import type { Version } from './src/dialect.ts';

const words = (s: string): string[] => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[\s_\-./]+/).filter(Boolean);
const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1);

const helpers: Helpers = {
  pascal: (s) => words(s).map(cap).join(''),
  camel: (s) => {
    const p = helpers.pascal(s);
    return p.charAt(0).toLowerCase() + p.slice(1);
  },
  snake: (s) => words(s).map((w) => w.toLowerCase()).join('_'),
  kebab: (s) => words(s).map((w) => w.toLowerCase()).join('-'),
  constant: (s) => words(s).map((w) => w.toUpperCase()).join('_'),
};

function run(generator: string, answers: Record<string, string | boolean>): Action[] {
  const g = pack[generator];
  const defaults = Object.fromEntries(
    Object.entries(g.params ?? {})
      .filter(([, p]) => p.default !== undefined)
      .map(([k, p]) => [k, p.default]),
  );
  return g.actions({ ...defaults, ...answers }, helpers);
}

/** Applies actions to an in-memory file map, like jen's plan() (dedupe by trimmed block, insert before marker). */
function applyActions(files: Map<string, string>, actions: Action[]): Map<string, string> {
  for (const a of actions) {
    if ('add' in a) {
      if (!files.has(a.add)) files.set(a.add, a.template);
    } else if ('insert' in a) {
      const lines = (files.get(a.insert) ?? assert.fail(`missing ${a.insert}`)).split('\n');
      const block = a.line.split('\n').map((l) => l.trim());
      const present = lines.some((_, k) => block.every((b, j) => lines[k + j]?.trim() === b));
      if (present) continue;
      const i = lines.findIndex((l) => l.includes(a.before));
      assert.ok(i >= 0, `marker "${a.before}" not found in ${a.insert}`);
      lines.splice(i, 0, ...a.line.split('\n'));
      files.set(a.insert, lines.join('\n'));
    } else if ('modify' in a) {
      files.set(a.modify, (files.get(a.modify) ?? '').replace(a.pattern, a.replace));
    }
  }
  return files;
}

const adds = (actions: Action[]) => actions.filter((a): a is { add: string; template: string } => 'add' in a);

// ─── glslangValidator ────────────────────────────────────────────────────────

const hasGlslang = spawnSync('glslangValidator', ['--version']).status === 0;

/** Compiles `source` as `stage` (vert/frag); returns the validator's log on failure, '' on success. */
function compile(source: string, stage: 'vert' | 'frag'): string {
  const r = spawnSync('glslangValidator', ['--stdin', '-S', stage], { input: source, encoding: 'utf8' });
  return r.status === 0 ? '' : `${r.stdout}${r.stderr}`;
}

function assertCompiles(source: string, stage: 'vert' | 'frag', label: string) {
  const log = compile(source, stage);
  assert.equal(log, '', `${label} failed to compile:\n${log}\n--- source ---\n${source}`);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('chunks', () => {
  const allIds = ['util', 'noise', 'fractal'].flatMap(chunkIds);

  it('every chunk declares a license; third-party ones have an existing notice', () => {
    for (const id of allIds) {
      const chunk = loadChunk(id);
      assert.ok(chunk.licenses.length > 0, id);
      for (const l of noticesFor(chunk)) assert.match(licenseText(l), /Copyright/, `${id}: ${l}`);
    }
  });

  it('own (MIT-0) chunks name pack-glsl and MIT-0 in their attribution line', () => {
    for (const id of allIds.filter((i) => loadChunk(i).licenses.includes(OWN_LICENSE))) {
      assert.match(loadChunk(id).code.split('\n')[0], /^\/\/ .* · pack-glsl · MIT-0$/, id);
    }
  });

  it('inline-licensed chunks carry copyright, license name and source in their own header', () => {
    for (const id of allIds.filter((i) => loadChunk(i).licenses.includes(INLINE_LICENSE))) {
      const header = loadChunk(id).code.split('\n').slice(0, 3).join('\n');
      assert.match(header, /\(c\) \d{4} /, id);
      assert.match(header, /MIT license/i, id);
      assert.match(header, /https:\/\//, id);
    }
  });

  it('every third-party notice is a full MIT notice, as GLSL line comments', () => {
    const ids = existsSync(packPath('glsl/licenses')) ? listGlsl('glsl/licenses') : [];
    assert.ok(ids.length > 0);
    for (const id of ids) {
      const text = licenseText(id);
      assert.match(text, /Copyright \(C\)/i, id);
      assert.match(text, /Permission is hereby granted, free of charge/, id);
      assert.match(text, /The above copyright notice and this permission notice shall be included/, id);
      assert.ok(text.split('\n').every((l) => l.startsWith('//')), `${id}: every line must be a // comment`);
    }
  });

  it('dependencies resolve without cycles, dependencies first', () => {
    for (const id of allIds) {
      const order = resolveChunks([id]).map((c) => c.id);
      assert.equal(order.at(-1), id);
      assert.equal(new Set(order).size, order.length);
    }
  });

  it('strips directives but keeps the attribution line', () => {
    const chunk = loadChunk('util/rot2');
    assert.doesNotMatch(chunk.code, /@license|@requires/);
    assert.match(chunk.code, /^\/\/ rot2 · pack-glsl · MIT-0\n/);
  });

  it('rebases fractals onto another noise, renaming functions and swapping requirements', () => {
    const warp = loadChunk('fractal/warp2@simplex');
    assert.equal(warp.id, 'fractal/warp2@simplex');
    assert.deepEqual(warp.requires, ['fractal/fbm2@simplex']);
    assert.match(warp.code, /float simplexWarp\(vec2 p, int octaves\)/);
    assert.doesNotMatch(warp.code, /valueFbm|valueWarp/);
    assert.deepEqual(loadChunk('fractal/fbm2@simplex').requires, ['noise/simplex2']);
    assert.equal(loadChunk('fractal/fbm2@value'), loadChunk('fractal/fbm2'), 'own base: same chunk');
    assert.throws(() => loadChunk('fractal/fbm2@gabor'), /unknown base noise "gabor"/);
    assert.throws(() => loadChunk('noise/perlin2@simplex'), /has no \/\/ @base directive/);
  });

  it('rebasable chunks only use base-named identifiers the rename can catch', () => {
    const rebasable = allIds.filter((id) => loadChunk(id).base);
    assert.ok(rebasable.length > 0);
    for (const id of rebasable) {
      const from = loadChunk(id).base!;
      const code = loadChunk(id).code.split('\n').filter((l) => !l.trimStart().startsWith('//')).join('\n');
      // The bare base name (e.g. a variable called `value`) would survive the rename unnoticed.
      assert.doesNotMatch(code, new RegExp(`\\b${from}\\b`), `${id}: bare "${from}"`);
      for (const base of NOISE_BASES.filter((b) => b !== from)) {
        const rebased = loadChunk(`${id}@${base}`).code.split('\n').filter((l) => !l.trimStart().startsWith('//')).join('\n');
        assert.doesNotMatch(rebased, new RegExp(`\\b${from}[A-Z]`), `${id}@${base} still uses ${from}*`);
      }
    }
  });

  it('rejects unknown and path-like ids', () => {
    assert.throws(() => loadChunk('util/nope'), /unknown GLSL chunk/);
    assert.throws(() => loadChunk('../package'), /unknown GLSL chunk/);
    assert.throws(() => loadChunk('licenses/jen'), /unknown GLSL chunk/);
  });

  it('compiles every chunk in every dialect', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    const rebased = ['fbm', 'turbulence', 'ridged', 'warp'].flatMap((k) => [2, 3].flatMap((d) => NOISE_BASES.map((b) => `fractal/${k}${d}@${b}`)));
    for (const version of VERSIONS) {
      for (const id of [...allIds, ...rebased]) {
        const code = resolveChunks([id])
          .map((c) => c.code)
          .join('\n\n');
        assertCompiles(`${header(version)}\n\n${code}\n\nout vec4 fragColor;\nvoid main() { fragColor = vec4(0.0); }\n`, 'frag', `${id} (${version})`);
      }
    }
  });
});

describe('glsl:frag', () => {
  it('writes <dir>/<kebab-name>.frag.glsl with a 300 es header by default', () => {
    const [a] = adds(run('frag', { name: 'MyClouds' }));
    assert.equal(a.add, 'shaders/my-clouds.frag.glsl');
    assert.match(a.template, /^#version 300 es\nprecision highp float;\nprecision highp int;\n\n/);
    assert.match(a.template, /uniform float uTime;/);
    assert.match(a.template, /uniform vec2 uResolution;/);
    assert.match(a.template, /uniform vec2 uMouse;/);
  });

  it('honours --dir and --version', () => {
    const [a] = adds(run('frag', { name: 'tonemap', dir: 'src/', version: '410' }));
    assert.equal(a.add, 'src/tonemap.frag.glsl');
    assert.match(a.template, /^#version 410 core\n\n/);
    assert.doesNotMatch(a.template, /precision/);
    assert.equal(adds(run('frag', { name: 'x', dir: '.' }))[0].add, 'x.frag.glsl');
  });

  it('rejects unknown versions', () => {
    assert.throws(() => run('frag', { name: 'x', version: '100' }), /--version: expected one of "300es", "330", "410", got "100"/);
  });

  it('compiles in every dialect', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    for (const version of VERSIONS) assertCompiles(adds(run('frag', { name: 'x', version }))[0].template, 'frag', `frag (${version})`);
  });
});

describe('glsl:vert', () => {
  it('writes the quad starter by default, matching cpp:sdl3-opengl\'s attribute layout', () => {
    const [a] = adds(run('vert', { name: 'Fullscreen' }));
    assert.equal(a.add, 'shaders/fullscreen.vert.glsl');
    assert.match(a.template, /layout\(location = 0\) in vec2 aPos;/);
    assert.match(a.template, /out vec2 vUV;/);
  });

  it('triangle needs no attributes, mesh has matrices and world-space outputs', () => {
    const tri = adds(run('vert', { name: 'x', kind: 'triangle' }))[0].template;
    assert.match(tri, /gl_VertexID/);
    assert.doesNotMatch(tri, /\bin vec/);
    const mesh = adds(run('vert', { name: 'x', kind: 'mesh' }))[0].template;
    for (const s of ['aPosition', 'aNormal', 'aUV', 'uModel', 'uView', 'uProjection', 'vWorldPos', 'vNormal', 'vUV']) {
      assert.match(mesh, new RegExp(`\\b${s}\\b`));
    }
  });

  it('rejects unknown kinds', () => {
    assert.throws(() => run('vert', { name: 'x', kind: 'cube' }), /--kind: expected one of "quad", "triangle", "mesh", got "cube"/);
  });

  it('compiles every kind in every dialect', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    for (const version of VERSIONS) {
      for (const kind of ['quad', 'triangle', 'mesh']) {
        assertCompiles(adds(run('vert', { name: 'x', kind, version }))[0].template, 'vert', `vert ${kind} (${version})`);
      }
    }
  });
});

describe('glsl:port', () => {
  const portTo = (source: string, to: Version) =>
    applyActions(new Map([['s.glsl', source]]), run('port', { file: 's.glsl', to })).get('s.glsl')!;

  it('round-trips 300es → 410 → 300es and only touches the header', () => {
    const es = adds(run('frag', { name: 'x' }))[0].template;
    const desktop = portTo(es, '410');
    assert.match(desktop, /^#version 410 core\n\n/);
    assert.doesNotMatch(desktop, /precision/);
    assert.equal(portTo(desktop, '300es'), es);
    assert.equal(portTo(es, '300es'), es, 'porting to the same dialect is a no-op');
  });

  it('keeps sampler precision lines', () => {
    const src = '#version 300 es\nprecision mediump float;\nprecision highp sampler3D;\nvoid main() {}\n';
    assert.equal(portTo(src, '330'), '#version 330 core\nprecision highp sampler3D;\nvoid main() {}\n');
  });

  it('rejects unknown targets', () => {
    assert.throws(() => run('port', { file: 's.glsl', to: 'webgl1' }), /glsl:port --to: expected one of/);
  });

  it('ported vertex and fragment starters compile', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    for (const to of VERSIONS) {
      assertCompiles(portTo(adds(run('frag', { name: 'x' }))[0].template, to), 'frag', `frag → ${to}`);
      assertCompiles(portTo(adds(run('vert', { name: 'x', kind: 'mesh', version: '410' }))[0].template, to), 'vert', `mesh → ${to}`);
    }
  });
});

describe('glsl:util', () => {
  const fragWith = (answers: Record<string, string>) => {
    const files = applyActions(new Map(), run('frag', { name: 'x' }));
    return applyActions(files, run('util', { into: 'shaders/x.frag.glsl', ...answers })).get('shaders/x.frag.glsl')!;
  };

  it('inserts the chunks in order before main(), without any notice (MIT-0)', () => {
    const out = fragWith({ fns: 'rot2,remap' });
    assert.doesNotMatch(out, /Permission is hereby granted/);
    const [rot2, remap, main] = ['mat2 rot2(', 'float remap(', 'void main('].map((s) => out.indexOf(s));
    assert.ok(0 < rot2 && rot2 < remap && remap < main, 'order: rot2, remap, main');
  });

  it('is idempotent and adds only what is missing on a second run', () => {
    const files = applyActions(new Map(), run('frag', { name: 'x' }));
    applyActions(files, run('util', { into: 'shaders/x.frag.glsl', fns: 'rot2' }));
    const once = files.get('shaders/x.frag.glsl')!;
    applyActions(files, run('util', { into: 'shaders/x.frag.glsl', fns: 'rot2' }));
    assert.equal(files.get('shaders/x.frag.glsl'), once);
    applyActions(files, run('util', { into: 'shaders/x.frag.glsl', fns: 'all' }));
    const all = files.get('shaders/x.frag.glsl')!;
    assert.equal(all.match(/mat2 rot2\(/g)?.length, 1);
    assert.match(all, /const float PI/);
  });

  it('without --into, writes one file per chunk', () => {
    const files = adds(run('util', { fns: 'saturate', dir: 'web/shaders' }));
    assert.deepEqual(files.map((f) => f.add), ['web/shaders/lib/util-saturate.glsl']);
    assert.match(files[0].template, /^\/\/ saturate · pack-glsl · MIT-0\n/);
    assert.match(files[0].template, /vec3 saturate\(vec3 x\)/);
  });

  it('fails with the valid names when nothing or something unknown is picked', () => {
    assert.throws(() => run('util', {}), /glsl:util --fns: pick at least one – valid: consts, hash, remap, rot2, saturate \(or "all"\)/);
    assert.throws(() => run('util', { fns: 'rot2,rot4' }), /unknown "rot4"/);
  });

  it('a shader with all helpers inserted compiles in every dialect', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    for (const version of VERSIONS) {
      const files = applyActions(new Map(), run('frag', { name: 'x', version }));
      applyActions(files, run('util', { into: 'shaders/x.frag.glsl', fns: 'all' }));
      assertCompiles(files.get('shaders/x.frag.glsl')!, 'frag', `frag + util (${version})`);
    }
  });
});

describe('glsl:webgl', () => {
  const byPath = (actions: Action[]) => new Map(adds(actions).map((a) => [a.add, a.template]));

  it('writes the page, the element and a fetched 300 es shader', () => {
    const files = byPath(run('webgl', { name: 'MyClouds' }));
    assert.deepEqual([...files.keys()], ['index.html', 'shader-canvas.js', 'shaders/my-clouds.frag.glsl']);
    const html = files.get('index.html')!;
    assert.match(html, /<title>MyClouds<\/title>/);
    assert.match(html, /<script src="shader-canvas.js" defer><\/script>/, 'classic script, so file:// works');
    assert.match(html, /<shader-canvas src="shaders\/my-clouds.frag.glsl" live><\/shader-canvas>/);
    assert.match(files.get('shaders/my-clouds.frag.glsl')!, /^#version 300 es\n/);
  });

  it('--inline embeds the shader in the page and writes no shader file', () => {
    const files = byPath(run('webgl', { name: 'x', inline: true, dir: 'play' }));
    assert.deepEqual([...files.keys()], ['play/index.html', 'play/shader-canvas.js']);
    const html = files.get('play/index.html')!;
    assert.doesNotMatch(html, / src="shaders/);
    const shader = /<script type="x-shader\/x-fragment">\n([\s\S]*?)\n\s*<\/script>/.exec(html)?.[1];
    assert.ok(shader, 'inline fragment shader');
    assert.match(shader.trimStart(), /^#version 300 es\n/);
  });

  it('--tag renames the element in the script and the page', () => {
    const files = byPath(run('webgl', { name: 'x', tag: 'my-canvas' }));
    assert.match(files.get('my-canvas.js')!, /^ {2}const TAG = 'my-canvas';$/m);
    assert.match(files.get('index.html')!, /<my-canvas src=/);
    assert.match(files.get('index.html')!, /<script src="my-canvas.js" defer>/);
    assert.throws(() => run('webgl', { name: 'x', tag: 'Canvas' }), /--tag: "Canvas" is not a valid custom element name/);
    assert.throws(() => run('webgl', { name: 'x', tag: 'canvas' }), /not a valid custom element name/);
  });

  it('the element is a classic script without exports, defined once under TAG', () => {
    const source = byPath(run('webgl', { name: 'x' })).get('shader-canvas.js')!;
    assert.doesNotThrow(() => new Script(source), 'parses as a classic script');
    assert.doesNotMatch(source, /^\s*(?:export|import)\s/m);
    assert.equal(source.match(/const TAG = /g)?.length, 1);
    assert.match(source, /customElements\.define\(TAG, ShaderCanvas\)/);
    assert.match(source, /^\/\/ <shader-canvas> · pack-glsl · MIT-0$/m);
  });

  it('the inline shader compiles', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    const html = byPath(run('webgl', { name: 'x', inline: true })).get('index.html')!;
    const shader = /<script type="x-shader\/x-fragment">\n([\s\S]*?)\n\s*<\/script>/.exec(html)![1];
    assertCompiles(shader.split('\n').map((l) => l.replace(/^ {8}/, '')).join('\n'), 'frag', 'inline webgl shader');
  });
});

describe('glsl:noise', () => {
  const KINDS = [...NOISE_BASES, 'fbm', 'turbulence', 'ridged', 'warp', 'curl'];
  const emptyShader = (version: Version = '300es') =>
    new Map([['s.frag.glsl', `${header(version)}\n\nout vec4 fragColor;\n\nvoid main() {\n  fragColor = vec4(0.0);\n}\n`]]);
  const into = (files: Map<string, string>, answers: Record<string, string>) =>
    applyActions(files, run('noise', { into: 's.frag.glsl', ...answers }));

  it('inserts the webgl-noise notice once and the shared helpers once for 2D + 3D Perlin', () => {
    const files = into(into(emptyShader(), { kind: 'perlin' }), { kind: 'perlin', dim: '3' });
    const out = files.get('s.frag.glsl')!;
    assert.equal(out.match(/Permission is hereby granted/g)?.length, 1);
    assert.equal(out.match(/vec4 permute\(vec4 x\)/g)?.length, 1);
    assert.match(out, /float perlinNoise\(vec2 p\)/);
    assert.match(out, /float perlinNoise\(vec3 p, vec3 period\)/);
    assert.ok(out.indexOf('Permission is hereby granted') < out.indexOf('vec4 mod289'), 'notice before the code it covers');
  });

  it('psrdnoise carries its short header instead of a full notice', () => {
    const out = into(emptyShader(), { kind: 'simplex' }).get('s.frag.glsl')!;
    assert.match(out, /\/\/ psrdnoise \(c\) 2021 Stefan Gustavson and Ian McEwan\n\/\/ Published under the MIT license.\n\/\/ https:\/\/github.com\/stegu\/psrdnoise\//);
    assert.doesNotMatch(out, /Permission is hereby granted/);
  });

  it('fractals default to simplex and follow --base', () => {
    const fbm = into(emptyShader(), { kind: 'fbm' }).get('s.frag.glsl')!;
    assert.match(fbm, /float simplexFbm\(vec2 p, vec2 period, int octaves, float gain\)/);
    assert.match(fbm, /float simplexFbm\(vec2 p, int octaves\) \{ return simplexFbm\(p, octaves, 0\.5\); \}/);
    const warp = into(emptyShader(), { kind: 'warp', base: 'value' }).get('s.frag.glsl')!;
    assert.match(warp, /float valueWarp\(vec2 p, int octaves, float strength\)/);
    const ridged = into(emptyShader(), { kind: 'ridged', base: 'worley', dim: '3' }).get('s.frag.glsl')!;
    assert.match(ridged, /float worleyRidged\(vec3 p, int octaves\)/);
    assert.match(ridged, /vec2 worley\(vec3 p, vec3 period\)/);
  });

  it('without --into, writes chunk files, each with the notices it needs', () => {
    const files = new Map(adds(run('noise', { kind: 'turbulence', base: 'perlin' })).map((a) => [a.add, a.template]));
    assert.deepEqual([...files.keys()], [
      'shaders/lib/noise-gustavson-common.glsl',
      'shaders/lib/noise-classic2.glsl',
      'shaders/lib/noise-perlin2.glsl',
      'shaders/lib/fractal-turbulence2-perlin.glsl',
    ]);
    assert.match(files.get('shaders/lib/noise-classic2.glsl')!, /^\/\/ webgl-noise .*\n\/\/\n\/\/ Copyright \(C\) 2011 by Ashima Arts/);
    assert.doesNotMatch(files.get('shaders/lib/fractal-turbulence2-perlin.glsl')!, /Permission is hereby granted/);
    assert.match(files.get('shaders/lib/fractal-turbulence2-perlin.glsl')!, /^\/\/ Needs \(include first\): noise-perlin2.glsl\n/);
  });

  it('validates its flags', () => {
    assert.throws(() => run('noise', {}), /--kind: pick one of "value", "perlin", "simplex", "worley", "fbm", "turbulence", "ridged", "warp", "curl"/);
    assert.throws(() => run('noise', { kind: 'gabor' }), /--kind: expected one of/);
    assert.throws(() => run('noise', { kind: 'value', dim: '4' }), /--dim: expected "2" or "3", got "4"/);
    assert.throws(() => run('noise', { kind: 'fbm', base: 'curl' }), /--base: expected one of "value", "perlin", "simplex", "worley", got "curl"/);
    assert.throws(() => run('noise', { kind: 'value', name: 'x', into: 'y' }), /either --name .* or --into/);
  });

  it('--name writes a preview shader with the noise inserted before main()', () => {
    const files = applyActions(new Map(), run('noise', { kind: 'warp', name: 'Marble', base: 'simplex', tile: true }));
    const out = files.get('shaders/marble.frag.glsl')!;
    assert.match(out, /^#version 300 es\n/);
    assert.match(out, /float n = simplexWarp\(p, period, 6\);/);
    assert.ok(out.indexOf('float simplexWarp(') < out.indexOf('void main('));
  });

  it('every kind, base and dimension fits into one shader without clashes', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    for (const version of VERSIONS) {
      let files = emptyShader(version);
      for (const kind of KINDS) {
        for (const dim of ['2', '3']) {
          for (const base of kind === 'fbm' || kind === 'turbulence' || kind === 'ridged' || kind === 'warp' ? NOISE_BASES : ['perlin']) {
            files = into(files, { kind, dim, base });
          }
        }
      }
      assertCompiles(files.get('s.frag.glsl')!, 'frag', `all noises (${version})`);
    }
  });

  it('every preview shader compiles', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    for (const kind of KINDS) {
      for (const dim of ['2', '3']) {
        for (const tile of [false, true]) {
          const files = applyActions(new Map(), run('noise', { kind, dim, tile, name: 'x', base: 'simplex' }));
          assertCompiles(files.get('shaders/x.frag.glsl')!, 'frag', `preview ${kind} ${dim}D${tile ? ' tiled' : ''}`);
        }
      }
    }
  });
});
