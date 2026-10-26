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
import { existsSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';
import { Script } from 'node:vm';
import { describe, it } from 'node:test';
import type { Action, Find, Helpers } from '@codejen/jen';
import pack from './src/index.ts';
import { INLINE_LICENSE, NOISE_BASES, OWN_LICENSE, chunkIds, licenseText, loadChunk, noticesFor, resolveChunks } from './src/chunks.ts';
import { listGlsl, packPath, readPackFile } from './src/common.ts';
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

/**
 * Runs a generator the way jen does with `--dir=<answers.dir>` (`shaders` if not
 * given): path params arrive from the project root (`/…`), and the resulting paths
 * are placed – `/…` at the root, everything else in that folder. The GLSL
 * generators only ask the project whether a notices file exists (`existing`), and
 * read the file --into names (`files`, if given – without them, nothing can be read).
 */
function run(generator: string, answers: Record<string, string | boolean>, existing: string[] = [], files?: Map<string, string>): Action[] {
  const g = pack[generator];
  const params = g.params ?? {};
  const defaults = Object.fromEntries(
    Object.entries(params)
      .filter(([, p]) => p.default !== undefined)
      .map(([k, p]) => [k, p.default]),
  );
  const given = Object.fromEntries(Object.entries({ ...defaults, ...answers }).map(([k, v]) => [k, params[k]?.path && v ? `/${v}` : v]));
  const dir = 'dir' in params ? '.' : String(answers.dir ?? 'shaders');
  const place = (p: string | Find): string => (typeof p !== 'string' ? assert.fail('no find targets here') : p.startsWith('/') ? p.slice(1) : posix.join(dir, p));
  const ctx = { destDir: dir, cwd: '.', exists: (p: string) => existing.includes(p), read: (p: string) => (files ? (files.get(p) ?? null) : undefined) } as never;
  return g.actions(given, helpers, ctx).map((a): Action => {
    if ('add' in a) return { ...a, add: place(a.add) };
    if ('append' in a) return { ...a, append: place(a.append) };
    if ('insert' in a) return { ...a, insert: place(a.insert) };
    if ('modify' in a) return { ...a, modify: place(a.modify) };
    return a;
  });
}

/** Applies actions to an in-memory file map, like jen's plan() (dedupe by trimmed block, insert before marker). */
function applyActions(files: Map<string, string>, actions: Action[]): Map<string, string> {
  for (const a of actions) {
    if ('template' in a) {
      if (!files.has(a.add)) files.set(a.add, a.template);
    } else if ('append' in a) {
      const text = files.get(a.append) ?? assert.fail(`missing ${a.append}`);
      if (!text.includes(a.text.trim())) files.set(a.append, `${text}${a.text}\n`);
    } else if ('insert' in a) {
      if (typeof a.insert !== 'string' || !('line' in a) || a.before === undefined) assert.fail('only plain inserts here');
      const lines = (files.get(a.insert) ?? assert.fail(`missing ${a.insert}`)).split('\n');
      const block = a.line.split('\n').map((l) => l.trim());
      const present = lines.some((_, k) => block.every((b, j) => lines[k + j]?.trim() === b));
      if (present) continue;
      const marker = a.before;
      const i = typeof marker === 'number' ? marker - 1 : lines.findIndex((l) => (typeof marker === 'string' ? l.includes(marker) : marker.test(l)));
      assert.ok(i >= 0, `marker "${a.before}" not found in ${a.insert}`);
      lines.splice(i, 0, ...a.line.split('\n'));
      files.set(a.insert, lines.join('\n'));
    } else if ('modify' in a && typeof a.modify === 'string') {
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
  const allIds = ['util', 'noise', 'fractal', 'sdf2d', 'sdf3d', 'sdfop', 'sdffx', 'raymarch', 'intersect', 'filter', 'lighting', 'lights', 'atmosphere', 'color', 'matrix', 'vertex'].flatMap(chunkIds);

  it('every chunk has a license – the pack\'s own unless it declares one, which then has an existing notice', () => {
    for (const id of allIds) {
      assert.doesNotMatch(readPackFile(`glsl/${id.replace(/@.*/, '')}.glsl`), /@license MIT-0/, `${id}: the own license is the default, no need to say it`);
      const chunk = loadChunk(id);
      assert.ok(chunk.licenses.length > 0, id);
      for (const l of noticesFor(chunk)) assert.match(licenseText(l), /Copyright|public domain/, `${id}: ${l}`);
    }
  });

  it('only takes MIT or public-domain code from others: every license is MIT-0, inline, an MIT notice or a public-domain note', () => {
    const notices = readdirSync(new URL('./glsl/licenses/', import.meta.url)).map((f) => f.replace(/\.glsl$/, ''));
    for (const id of allIds) {
      for (const l of loadChunk(id).licenses) assert.ok(l === OWN_LICENSE || l === INLINE_LICENSE || notices.includes(l), `${id}: @license ${l}`);
    }
    for (const n of notices) assert.match(licenseText(n), /Permission is hereby granted, free of charge|^\/\/ .*public domain.*, no notice required\.$/m, n);
    for (const id of allIds.filter((i) => loadChunk(i).licenses.includes(INLINE_LICENSE))) {
      assert.match(loadChunk(id).code.split('\n').slice(0, 3).join('\n'), /MIT license/, id);
    }
  });

  it('own (MIT-0) chunks don\'t mention the pack or its license – only whose ideas they use', () => {
    for (const id of allIds.filter((i) => loadChunk(i).licenses.includes(OWN_LICENSE))) {
      assert.doesNotMatch(loadChunk(id).code, /pack-glsl|MIT-0/, id);
    }
  });

  it('every chunk with a credit line is listed in the pack\'s THIRD_PARTY_NOTICES.md', () => {
    const notices = readPackFile('THIRD_PARTY_NOTICES.md');
    for (const id of allIds) {
      const lines = loadChunk(id).code.split('\n');
      const header = lines.slice(0, lines.findIndex((l) => !l.startsWith('//')));
      // "· https://…" names a source, "after Someone" a method
      if (header.some((l) => / · https?:\/\/| after [A-Z]/.test(l))) assert.ok(notices.includes(`\`${id}\``), `${id} credits someone, but THIRD_PARTY_NOTICES.md doesn't list it`);
    }
  });

  it('keep their header short: a credit line, at most one more, and the note on a function of yours', () => {
    for (const id of allIds) {
      const lines = loadChunk(id).code.split('\n');
      const header = lines.slice(0, lines.findIndex((l) => !l.startsWith('//')));
      const own = header.filter((l) => !l.startsWith('// yours'));
      assert.ok(own.length <= 2, `${id}: ${header.length} header lines`);
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

  it('every third-party notice is a full MIT notice or a public-domain note, as GLSL line comments', () => {
    const ids = existsSync(packPath('glsl/licenses')) ? listGlsl('glsl/licenses') : [];
    assert.ok(ids.length > 0);
    for (const id of ids) {
      const text = licenseText(id);
      assert.ok(text.split('\n').every((l) => l.startsWith('//')), `${id}: every line must be a // comment`);
      // the Unlicense asks for no notice: a line with the source and that it's public domain
      if (/public domain/.test(text)) {
        assert.match(text, /^\/\/ .+ – .+, https:\/\/\S+\n\/\/ .*[Pp]ublic domain.*, no notice required\.$/, id);
        continue;
      }
      assert.match(text, /^\/\/ Copyright\b/im, id);
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
    const chunk = loadChunk('sdf2d/round-box');
    assert.doesNotMatch(chunk.code, /@license|@requires/);
    assert.match(chunk.code, /^\/\/ sdRoundBox \(2D\) · Inigo Quilez · https:\/\/iquilezles\.org\/articles\/distfunctions2d\/\n/);
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
        let code = resolveChunks([id])
          .map((c) => c.code)
          .join('\n\n');
        // Raymarch helpers call the user's scene, which they only declare.
        if (/\bscene\(/.test(code)) code += '\n\nfloat scene(vec3 p) { return length(p) - 1.0; }';
        if (/\bdisplacement\(/.test(code)) code += '\n\nfloat displacement(vec3 p) { return 0.1 * p.y; }';
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
    assert.doesNotMatch(files[0].template, /pack-glsl|MIT-0/);
    assert.match(files[0].template, /vec3 saturate\(vec3 x\)/);
  });

  it('fails with the valid names when nothing or something unknown is picked', () => {
    assert.throws(() => run('util', {}), /glsl:util --fns: pick at least one – valid: consts, hash, remap, rot2, saturate \(or "all"\)/);
    assert.throws(() => run('util', { fns: 'rot2,rot4' }), /unknown "rot4"/);
  });

  it('marks what a run needs: required params, or "pick at least one" on each of a group', () => {
    for (const [generator, param] of [['util', 'fns'], ['matrix', 'fns'], ['noise', 'kind']]) {
      assert.equal(pack[generator].params?.[param].default, undefined, `glsl:${generator} --${param} is required`);
    }
    for (const [generator, group] of [['sdf', ['shapes', 'ops', 'effects']], ['lighting', ['models', 'tonemap', 'sky', 'fog', 'point']]] as const) {
      for (const param of group) {
        assert.match(pack[generator].params?.[param].description ?? '', new RegExp(`\\(pick at least one of ${group.map((p) => `--${p}`).join(', ')}\\)$`));
      }
    }
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

  it('--texture sets texture0 on the element, escaped; the element knows the test-pattern keyword', () => {
    const inline = byPath(run('webgl', { name: 'x', inline: true, texture: 'test-pattern' }));
    assert.match(inline.get('index.html')!, /<shader-canvas texture0="test-pattern">/);
    const served = byPath(run('webgl', { name: 'x', texture: 'a "b".png' })).get('index.html')!;
    assert.match(served, /<shader-canvas src="shaders\/x\.frag\.glsl" texture0="a &quot;b&quot;\.png" live>/);
    assert.doesNotMatch(byPath(run('webgl', { name: 'x' })).get('index.html')!, /texture0/);
    assert.match(inline.get('shader-canvas.js')!, /url === 'test-pattern'/);
  });

  it('the element draws a still frame for a time attribute or #t= in the URL', () => {
    const source = byPath(run('webgl', { name: 'x' })).get('shader-canvas.js')!;
    assert.match(source, /observedAttributes = \[[^\]]*'time'\]/);
    assert.match(source, /location\.hash/);
    assert.match(source, /addEventListener\('hashchange'/);
  });

  it('the element is a classic script without exports, defined once under TAG', () => {
    const source = byPath(run('webgl', { name: 'x' })).get('shader-canvas.js')!;
    assert.doesNotThrow(() => new Script(source), 'parses as a classic script');
    assert.doesNotMatch(source, /^\s*(?:export|import)\s/m);
    assert.equal(source.match(/const TAG = /g)?.length, 1);
    assert.match(source, /customElements\.define\(TAG, ShaderCanvas\)/);
    assert.match(source, /^\/\/ <shader-canvas> · https:\/\/github\.com\/learosema\/jen\/.*\n\/\/ [^\n]*\n\n/, 'a two-line header');
    assert.doesNotMatch(source, /pack-glsl · MIT-0/);
  });

  it('the inline shader compiles', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    const html = byPath(run('webgl', { name: 'x', inline: true })).get('index.html')!;
    const shader = /<script type="x-shader\/x-fragment">\n([\s\S]*?)\n\s*<\/script>/.exec(html)![1];
    assertCompiles(shader.split('\n').map((l) => l.replace(/^ {8}/, '')).join('\n'), 'frag', 'inline webgl shader');
  });

  it('--shader puts an existing shader into the page, its notices next to it', () => {
    const files = applyActions(new Map(), run('raymarch', { name: 'Land', scene: 'terrain' }));
    const page = byPath(run('webgl', { name: 'Land', inline: true, shader: 'shaders/land.frag.glsl' }, [], files));
    assert.deepEqual([...page.keys()], ['index.html', 'shader-canvas.js', 'THIRD_PARTY_NOTICES.md']);
    assert.ok(page.get('index.html')!.includes('        float terrain(vec2 xz) {'), 'the terrain, indented into the script');
    assert.equal(page.get('THIRD_PARTY_NOTICES.md'), files.get('shaders/THIRD_PARTY_NOTICES.md'));
    const served = byPath(run('webgl', { name: 'Land', shader: 'shaders/land.frag.glsl' }, [], files));
    assert.deepEqual([...served.keys()], ['index.html', 'shader-canvas.js']);
    assert.match(served.get('index.html')!, /<shader-canvas src="shaders\/land\.frag\.glsl" live>/);
    assert.throws(() => run('webgl', { name: 'x', shader: 'nope.glsl' }, [], files), /--shader: can't read nope\.glsl/);
  });

  it('--inline keeps the marker, so --into=index.html puts functions into the page\'s shader', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    const files = byPath(run('webgl', { name: 'x', inline: true }));
    assert.match(files.get('index.html')!, /^ {8}\/\/ jen:functions – .*\n\n {8}void main\(/m);
    applyActions(files, run('noise', { kind: 'fbm', into: 'index.html' }, [], files));
    applyActions(files, run('raymarch', { parts: 'march,normal', into: 'index.html' }, [], files));
    const html = files.get('index.html')!;
    const shader = /<script type="x-shader\/x-fragment">\n([\s\S]*?)\n\s*<\/script>/.exec(html)![1];
    assert.ok(shader.indexOf('float simplexFbm(') < shader.indexOf('float raymarch(') && shader.indexOf('float raymarch(') < shader.indexOf('// jen:functions'));
    // the page's scene() comes later: a prototype is enough for the helpers
    const source = shader.split('\n').map((l) => l.replace(/^ {8}/, '')).join('\n');
    assertCompiles(`${source}\nfloat scene(vec3 p) { return length(p) - 1.0; }\n`, 'frag', 'page shader with fbm + raymarch helpers');
  });

  it('--into a page without the marker goes into its fragment shader script, before the first function', () => {
    const page = '<script type="x-shader/x-vertex">\n  void main() {}\n</script>\n<script type="x-shader/x-fragment">\n  out vec4 c;\n  void main() { c = vec4(rot2(1.0)[0], 0.0, 1.0); }\n</script>\n';
    const files = new Map([['p.html', page]]);
    applyActions(files, run('util', { into: 'p.html', fns: 'rot2' }, [], files));
    const out = files.get('p.html')!;
    assert.ok(out.indexOf('x-shader/x-fragment') < out.indexOf('mat2 rot2(') && out.indexOf('mat2 rot2(') < out.indexOf('// jen:functions'));
    assert.ok(out.indexOf('// jen:functions') < out.indexOf('void main() { c'));
  });

  it('--into says in words when there is nowhere to put the functions', () => {
    for (const [file, text, why] of [
      ['p.html', '<p>no shader</p>\n', /has no <script type="x-shader\/x-fragment"> with a function in it/],
      ['s.glsl', 'out vec4 c;\n', /has no function to put them before/],
    ] as const) {
      const actions = run('util', { into: file, fns: 'rot2' }, [], new Map([[file, text]]));
      assert.equal(actions.length, 1);
      const [note] = actions;
      assert.ok('note' in note && note.warning);
      assert.match(note.note, why);
      assert.match(note.note, /add a line "\/\/ jen:functions" where the functions should go/);
    }
  });
});

describe('glsl:noise', () => {
  const KINDS = [...NOISE_BASES, 'fbm', 'turbulence', 'ridged', 'warp', 'curl'];
  const emptyShader = (version: Version = '300es') =>
    new Map([['s.frag.glsl', `${header(version)}\n\nout vec4 fragColor;\n\nvoid main() {\n  fragColor = vec4(0.0);\n}\n`]]);
  const into = (files: Map<string, string>, answers: Record<string, string>) =>
    applyActions(files, run('noise', { into: 's.frag.glsl', ...answers }));

  it('writes the webgl-noise notice once next to the shader, and the shared helpers once for 2D + 3D Perlin', () => {
    const files = into(into(emptyShader(), { kind: 'perlin' }), { kind: 'perlin', dim: '3' });
    const out = files.get('s.frag.glsl')!;
    assert.doesNotMatch(out, /Permission is hereby granted/, 'no license text in the shader');
    assert.doesNotMatch(out, /THIRD_PARTY_NOTICES/, 'no pointer line either');
    assert.equal(out.match(/vec4 permute\(vec4 x\)/g)?.length, 1);
    assert.match(out, /float perlinNoise\(vec2 p\)/);
    assert.match(out, /float perlinNoise\(vec3 p, vec3 period\)/);
    const notices = files.get('THIRD_PARTY_NOTICES.md')!;
    assert.match(notices, /^# Third-party notices\n/);
    assert.equal(notices.match(/^## webgl-noise$/gm)?.length, 1);
    assert.equal(notices.match(/Permission is hereby granted/g)?.length, 1);
    assert.doesNotMatch(notices, /^\/\//m, 'plain text, not GLSL comments');
  });

  it('adds to a notices file that is already there, instead of writing a new one', () => {
    const actions = run('noise', { kind: 'perlin', into: 'shaders/s.frag.glsl' }, ['shaders/THIRD_PARTY_NOTICES.md']);
    assert.ok(!actions.some((a) => 'add' in a), 'no add');
    assert.ok(actions.some((a) => 'append' in a && a.append === 'shaders/THIRD_PARTY_NOTICES.md' && a.text.startsWith('\n## webgl-noise\n')));
  });

  it('notes public-domain code next to the shader too, without a license text', () => {
    const files = applyActions(emptyShader(), run('util', { into: 's.frag.glsl', fns: 'hash' }));
    assert.doesNotMatch(files.get('s.frag.glsl')!, /public domain|Unlicense/);
    const notices = files.get('THIRD_PARTY_NOTICES.md')!;
    assert.match(notices, /^## hash-prospector\n\n```\nlowbias32 – Chris Wellons, https:\/\/github\.com\/skeeto\/hash-prospector\nThe Unlicense: released into the public domain, no notice required\.\n```$/m);
  });

  it('credits psrdnoise in one line, its full notice next to the shader', () => {
    const files = into(emptyShader(), { kind: 'simplex' });
    const out = files.get('s.frag.glsl')!;
    assert.match(out, /^\/\/ psrdnoise · Stefan Gustavson and Ian McEwan · https:\/\/github\.com\/stegu\/psrdnoise$/m);
    assert.doesNotMatch(out, /MIT|Copyright|Permission is hereby granted/, 'no license words in the shader');
    assert.match(files.get('THIRD_PARTY_NOTICES.md')!, /## psrdnoise\n\n```\npsrdnoise \(https:\/\/github\.com\/stegu\/psrdnoise\)\n\nCopyright 2021, Stefan Gustavson and Ian MacEwan/);
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
      'shaders/lib/THIRD_PARTY_NOTICES.md',
    ]);
    assert.match(files.get('shaders/lib/noise-classic2.glsl')!, /^\/\/ Needs \(include first\): noise-gustavson-common\.glsl\n/);
    assert.doesNotMatch(files.get('shaders/lib/noise-classic2.glsl')!, /Permission is hereby granted/);
    assert.doesNotMatch(files.get('shaders/lib/fractal-turbulence2-perlin.glsl')!, /THIRD_PARTY_NOTICES/);
    assert.match(files.get('shaders/lib/fractal-turbulence2-perlin.glsl')!, /^\/\/ Needs \(include first\): noise-perlin2.glsl\n/);
  });

  it('validates its flags', () => {
    assert.throws(() => run('noise', {}), /--kind: pick one of "value", "perlin", "simplex", "worley", "fbm", "turbulence", "ridged", "warp", "curl"/);
    assert.throws(() => run('noise', { kind: 'gabor' }), /--kind: expected one of/);
    assert.throws(() => run('noise', { kind: 'value', dim: '4' }), /--dim: expected "2" or "3", got "4"/);
    assert.throws(() => run('noise', { kind: 'fbm', base: 'curl' }), /--base: expected one of "value", "perlin", "simplex", "worley", got "curl"/);
    assert.throws(() => run('noise', { kind: 'worley', base: 'value' }), /--base: only for fractals \(fbm, turbulence, ridged, warp\); --kind=worley is a base noise itself/);
    assert.throws(() => run('noise', { kind: 'curl', base: 'perlin' }), /--base: only for fractals .*; curl is always built on simplex/);
    assert.doesNotThrow(() => run('noise', { kind: 'fbm', base: 'worley' }));
    assert.doesNotThrow(() => run('noise', { kind: 'perlin' }));
    assert.doesNotThrow(() => run('noise', { kind: 'perlin', base: 'simplex' }));
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
          for (const base of kind === 'fbm' || kind === 'turbulence' || kind === 'ridged' || kind === 'warp' ? NOISE_BASES : ['simplex']) {
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

describe('--into placement', () => {
  const SCENE = `#version 300 es
precision highp float;
uniform float uTime;
out vec4 fragColor;

float scene(vec3 p) {
  return opSmoothUnion(sdSphere(p, 1.0), sdBox(p - vec3(1.0), vec3(0.5)), 0.2);
}

void main() {
  vec3 rd = cameraMatrix(vec3(0.0, 0.0, 4.0), vec3(0.0), 0.0) * normalize(vec3(0.0, 0.0, 1.5));
  float t = raymarch(vec3(0.0, 0.0, 4.0), rd, 20.0);
  fragColor = vec4(t > 0.0 ? calcNormal(vec3(0.0, 0.0, 4.0) + t * rd) : vec3(0.0), 1.0);
}
`;

  it('puts functions above the first function, so your own scene() can call them', () => {
    const files = applyActions(new Map([['s.glsl', SCENE]]), run('sdf', { dim: '3', shapes: 'sphere,box', ops: 'smooth-union', into: 's.glsl' }));
    const out = files.get('s.glsl')!;
    assert.equal(out.match(/\/\/ jen:functions/g)?.length, 1);
    const [sphere, union, marker, scene] = ['float sdSphere(', 'float opSmoothUnion(', '// jen:functions', 'float scene('].map((x) => out.indexOf(x));
    assert.ok(0 < sphere && sphere < union && union < marker && marker < scene, 'chunks, then the marker, then scene()');
  });

  it('a later run appends below what is already there, and the result compiles', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    const files = applyActions(new Map([['s.glsl', SCENE]]), run('sdf', { dim: '3', shapes: 'sphere,box', ops: 'smooth-union', into: 's.glsl' }));
    applyActions(files, run('raymarch', { into: 's.glsl', parts: 'march,normal,camera' }));
    const out = files.get('s.glsl')!;
    assert.equal(out.match(/\/\/ jen:functions/g)?.length, 1);
    assert.ok(out.indexOf('float opSmoothUnion(') < out.indexOf('float raymarch('), 'new chunks after existing ones');
    assert.ok(out.indexOf('float raymarch(') < out.indexOf('// jen:functions'));
    assertCompiles(out, 'frag', 'scene with sdf + raymarch helpers');
  });

  it('declares scene() once per shader, also across runs, and the starter once too', () => {
    const files = applyActions(new Map([['s.glsl', SCENE]]), run('raymarch', { into: 's.glsl', parts: 'march,normal' }));
    applyActions(files, run('raymarch', { into: 's.glsl', parts: 'soft-shadow,ao' }, [], files));
    const out = files.get('s.glsl')!;
    assert.equal(out.match(/^float scene\(vec3 p\);$/gm)?.length, 1);
    assert.equal(out.match(/^\/\/ yours\b/gm)?.length, 1);
    assert.ok(out.indexOf('float scene(vec3 p);') < out.indexOf('float raymarch('), 'declared before its first caller');
    for (const s of ['float raymarch(', 'vec3 calcNormal(', 'float softShadow(', 'float calcAO(']) assert.ok(out.includes(s), s);
    const starter = applyActions(new Map(), run('raymarch', { name: 'Scene' })).get('shaders/scene.frag.glsl')!;
    assert.equal(starter.match(/^float scene\(vec3 p\);$/gm)?.length, 1);
  });

  it('--into a missing file fails before anything is written – no notices for code that never went in', () => {
    assert.throws(() => run('noise', { kind: 'perlin', into: 'nope.glsl' }, [], new Map()), /--into: nope\.glsl doesn't exist – check the path, or start a shader with --name/);
  });

  it('starters bring their marker: no marker insert, so no "already has" line; --force over an old one keeps scene() declared', () => {
    const actions = run('raymarch', { name: 'Scene' }, [], new Map());
    assert.ok(!actions.some((a) => 'insert' in a && 'line' in a && a.line.startsWith('// jen:functions')), 'no marker insert');
    const old = applyActions(new Map(), run('raymarch', { name: 'Scene' }));
    const again = run('raymarch', { name: 'Scene' }, [], old);
    const out = applyActions(new Map(), again).get('shaders/scene.frag.glsl')!;
    assert.equal(out.match(/^float scene\(vec3 p\);$/gm)?.length, 1);
  });

  it('a prototype below the marker does not count: the helpers above it need their own', () => {
    const files = new Map([['s.glsl', SCENE.replace('float scene(', 'float scene(vec3 p);\n\nfloat scene(')]]);
    const out = applyActions(files, run('raymarch', { into: 's.glsl', parts: 'march' })).get('s.glsl')!;
    assert.ok(out.indexOf('float scene(vec3 p);') < out.indexOf('float raymarch('));
  });
});

describe('glsl:sdf', () => {
  const emptyShader = (version: Version = '300es') =>
    new Map([['s.glsl', `${header(version)}\n\nout vec4 fragColor;\n\nvoid main() {\n  fragColor = vec4(0.0);\n}\n`]]);

  it('validates its flags, listing what can be picked', () => {
    assert.throws(() => run('sdf', {}), /pick something – --shapes=arch, box, circle, polygon, round-box, segment, star, vesica; --ops=extrude, .*; --effects=fill, glow, inner-shadow, shadow, stroke/);
    assert.throws(() => run('sdf', { dim: '3' }), /--shapes=box, capsule, cylinder, plane, round-box, sphere, torus; --ops=.*\(each also takes "all"\)$/);
    assert.throws(() => run('sdf', { dim: '3', effects: 'glow' }), /--effects: 2D only/);
    assert.throws(() => run('sdf', { shapes: 'sphere' }), /--shapes: unknown "sphere"/);
    assert.throws(() => run('sdf', { dim: '4', shapes: 'box' }), /--dim: expected "2" or "3", got "4"/);
    assert.throws(() => run('sdf', { ops: 'union', name: 'x' }), /the preview needs at least one of --shapes=/);
  });

  it('previews shapes in the order given, `all` in the documented order', () => {
    const order = (answers: Record<string, string>) => {
      const out = applyActions(new Map(), run('sdf', { name: 'x', ...answers })).get('shaders/x.frag.glsl')!;
      return [...out.matchAll(/\b(sd[A-Z]\w*)\(\(p - /g)].map((m) => m[1]);
    };
    assert.deepEqual(order({ shapes: 'star,circle,box' }), ['sdStar', 'sdCircle', 'sdBox']);
    assert.deepEqual(order({ shapes: 'all' }), ['sdCircle', 'sdBox', 'sdRoundBox', 'sdSegment', 'sdPolygon', 'sdStar', 'sdVesica', 'sdPointedArch']);
    assert.deepEqual(order({ dim: '3', shapes: 'all' }), ['sdSphere', 'sdBox', 'sdRoundBox', 'sdTorus', 'sdCapsule', 'sdCylinder']);
  });

  it('pulls in dependencies: round-box needs box, stroke needs fill, smooth ops need smooth-union', () => {
    const ids = adds(run('sdf', { shapes: 'round-box', ops: 'smooth-subtract', effects: 'stroke' })).map((a) => a.add).filter((f) => f.endsWith('.glsl'));
    assert.deepEqual(ids, [
      'shaders/lib/sdf2d-box.glsl',
      'shaders/lib/sdf2d-round-box.glsl',
      'shaders/lib/sdfop-smooth-union.glsl',
      'shaders/lib/sdfop-smooth-subtract.glsl',
      'shaders/lib/sdffx-fill.glsl',
      'shaders/lib/sdffx-stroke.glsl',
    ]);
  });

  it('everything 2D and 3D fits into one shader', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    for (const version of VERSIONS) {
      const files = emptyShader(version);
      applyActions(files, run('sdf', { shapes: 'all', ops: 'all', effects: 'all', into: 's.glsl' }));
      applyActions(files, run('sdf', { dim: '3', shapes: 'all', ops: 'all', into: 's.glsl' }));
      assertCompiles(files.get('s.glsl')!, 'frag', `all sdf (${version})`);
    }
  });

  it('previews compile: 2D drawing and 3D raymarched scene', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    for (const dim of ['2', '3']) {
      const files = applyActions(new Map(), run('sdf', { dim, shapes: 'all', name: 'Shapes' }));
      const out = files.get('shaders/shapes.frag.glsl')!;
      assert.match(out, dim === '2' ? /float scene\(vec2 p\)/ : /float scene\(vec3 p\)/);
      assertCompiles(out, 'frag', `sdf preview ${dim}D`);
    }
  });
});

describe('glsl:raymarch', () => {
  it('the starter compiles with every lighting model, full, minimal and with materials, in every dialect', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    for (const version of VERSIONS) {
      for (const lighting of ['lambert', 'blinn', 'toon', 'pbr']) {
        for (const minimal of [false, true]) {
          for (const materials of [false, true]) {
            const files = applyActions(new Map(), run('raymarch', { name: 'Scene', lighting, minimal, materials, version }));
            assertCompiles(files.get('shaders/scene.frag.glsl')!, 'frag', `raymarch starter (${version}, ${lighting}, minimal: ${minimal}, materials: ${materials})`);
          }
        }
      }
    }
  });

  it('--lighting=pbr tonemaps with ACES and carries the BakingLab notice once', () => {
    const files = applyActions(new Map(), run('raymarch', { name: 'x', lighting: 'pbr', materials: true }));
    const out = files.get('shaders/x.frag.glsl')!;
    assert.match(out, /fragColor = vec4\(linearToSrgb\(tonemapAces\(color \* 1\.6\)\)/);
    assert.match(out, /float metallic = material > 1\.5 \? 1\.0 : 0\.0;/);
    assert.doesNotMatch(out, /Copyright/);
    assert.equal(files.get('shaders/THIRD_PARTY_NOTICES.md')!.match(/Copyright \(c\) 2016 MJP/g)?.length, 1);
    assert.throws(() => run('raymarch', { name: 'x', lighting: 'phong' }), /--lighting: expected one of "lambert", "blinn", "toon", "pbr", got "phong"/);
  });

  it('--materials: sceneMaterial() returns (distance, id); scene() stays the distance the helpers use', () => {
    const out = applyActions(new Map(), run('raymarch', { name: 'x', materials: true })).get('shaders/x.frag.glsl')!;
    assert.match(out, /vec2 sceneMaterial\(vec3 p\) \{/);
    assert.match(out, /float scene\(vec3 p\) \{ return sceneMaterial\(p\)\.x; \}/);
    assert.match(out, /float material = sceneMaterial\(p\)\.y;/);
    assert.throws(() => run('raymarch', { into: 'x.glsl', materials: true }), /--materials: only for a new starter/);
  });

  it('--scene=terrain: a heightfield flyover that compiles, with or without water, full or minimal, in every dialect', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    for (const version of VERSIONS) {
      for (const water of [false, true]) {
        for (const minimal of [false, true]) {
          const files = applyActions(new Map(), run('raymarch', { name: 'Land', scene: 'terrain', water, minimal, version }));
          assertCompiles(files.get('shaders/land.frag.glsl')!, 'frag', `terrain starter (${version}, water: ${water}, minimal: ${minimal})`);
        }
      }
    }
  });

  it('--scene=terrain brings only the helpers it uses', () => {
    const out = applyActions(new Map(), run('raymarch', { name: 'Land', scene: 'terrain', water: true })).get('shaders/land.frag.glsl')!;
    for (const s of ['float terrain(vec2 xz)', 'float scene(vec3 p) { return 0.4 * (p.y - terrain(p.xz)); }', 'vec3 terrainColor(', 'float simplexRidged(', 'vec3 skyColor(', 'vec3 fogExp2(', 'float softShadow(', 'const float WATER']) {
      assert.ok(out.includes(s), s);
    }
    for (const s of ['sdSphere', 'sdBox', 'sdRoundBox', 'sdTorus', 'sdPlane', 'opSmoothUnion', 'calcAO']) assert.ok(!out.includes(s), `no ${s}`);
    const dry = applyActions(new Map(), run('raymarch', { name: 'Land', scene: 'terrain', minimal: true })).get('shaders/land.frag.glsl')!;
    for (const s of ['WATER', 'softShadow', 'fogExp']) assert.ok(!dry.includes(s), `minimal, no water: no ${s}`);
  });

  it('smoothstep edges rise in every starter: GLSL leaves edge0 >= edge1 undefined', () => {
    const shaders = [
      applyActions(new Map(), run('raymarch', { name: 'Land', scene: 'terrain', water: true })).get('shaders/land.frag.glsl')!,
      applyActions(new Map(), run('raymarch', { name: 'x', lighting: 'toon' })).get('shaders/x.frag.glsl')!,
      applyActions(new Map(), run('sdf', { shapes: 'all', effects: 'all', name: 'x' })).get('shaders/x.frag.glsl')!,
    ];
    const value = (e: string) => Number(e.replace(/^[A-Za-z]+ \+ /, ''));
    for (const shader of shaders) {
      for (const [, e0, e1] of shader.matchAll(/smoothstep\(((?:[A-Za-z]+ \+ )?-?[\d.]+), ((?:[A-Za-z]+ \+ )?-?[\d.]+),/g)) {
        assert.ok(value(e0) < value(e1), `smoothstep(${e0}, ${e1}, …)`);
      }
    }
  });

  it('--scene and --water fail where they mean nothing', () => {
    assert.throws(() => run('raymarch', { name: 'x', scene: 'cave' }), /--scene: expected "shapes", "cube", "terrain", got "cave"/);
    assert.throws(() => run('raymarch', { name: 'x', water: true }), /--water: only with --scene=terrain/);
    assert.throws(() => run('raymarch', { into: 'x.glsl', scene: 'terrain' }), /--scene and --water: only for a new starter/);
    assert.throws(() => run('raymarch', { name: 'x', scene: 'terrain', materials: true }), /--scene=terrain: lit with lambert/);
    assert.throws(() => run('raymarch', { name: 'x', scene: 'terrain', lighting: 'pbr' }), /--lighting is for the shapes and cube scenes, --materials for shapes/);
  });

  it('--minimal leaves out shadows, AO and fog', () => {
    const full = applyActions(new Map(), run('raymarch', { name: 'x' })).get('shaders/x.frag.glsl')!;
    const minimal = applyActions(new Map(), run('raymarch', { name: 'x', minimal: true })).get('shaders/x.frag.glsl')!;
    for (const s of ['float softShadow(', 'float calcAO(', 'fog']) {
      assert.ok(full.includes(s), `full has ${s}`);
      assert.ok(!minimal.includes(s), `minimal lacks ${s}`);
    }
  });

  it('--scene=cube: one cube on the ground and nothing unused; compiles with every model, full and minimal, in every dialect', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    for (const version of VERSIONS) {
      for (const lighting of ['lambert', 'blinn', 'toon', 'pbr']) {
        for (const minimal of [false, true]) {
          const out = applyActions(new Map(), run('raymarch', { name: 'Box', scene: 'cube', lighting, minimal, version })).get('shaders/box.frag.glsl')!;
          assertCompiles(out, 'frag', `cube starter (${version}, ${lighting}, minimal: ${minimal})`);
        }
      }
    }
    const out = applyActions(new Map(), run('raymarch', { name: 'Box', scene: 'cube', minimal: true })).get('shaders/box.frag.glsl')!;
    assert.match(out, /float cube = sdRoundBox\(/);
    for (const s of ['sdSphere', 'sdTorus', 'opSmoothUnion', 'softShadow', 'calcAO']) assert.ok(!out.includes(s), `no ${s}`);
    assert.throws(() => run('raymarch', { name: 'Box', scene: 'cube', materials: true }), /--scene=cube: one object needs no material ids/);
    assert.throws(() => run('raymarch', { scene: 'cube', into: 's.glsl' }), /--scene and --water: only for a new starter/);
  });

  it('--hits adds exact ray intersections alone, or next to --parts; they hit what they should', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    const only = adds(run('raymarch', { hits: 'sphere,plane,box' }));
    assert.deepEqual(only.map((f) => f.add), ['shaders/lib/intersect-sphere.glsl', 'shaders/lib/intersect-plane.glsl', 'shaders/lib/intersect-box.glsl', 'shaders/lib/THIRD_PARTY_NOTICES.md']);
    const both = adds(run('raymarch', { hits: 'sphere', parts: 'march' })).map((f) => f.add);
    assert.ok(both.includes('shaders/lib/raymarch-march.glsl') && both.includes('shaders/lib/intersect-sphere.glsl'));
    assert.ok(adds(run('raymarch', {})).some((f) => f.add === 'shaders/lib/raymarch-ao.glsl'), 'all parts without --hits');
    assert.throws(() => run('raymarch', { hits: 'cone' }), /--hits: unknown "cone" – valid: box, plane, sphere/);
    assert.throws(() => run('raymarch', { name: 'x', hits: 'sphere' }), /--hits: only with --into/);
    const shader = `${header('300es')}\n\nout vec4 fragColor;\n\nvoid main() {\n  vec3 n;\n  vec2 s = raySphere(vec3(0.0, 0.0, 5.0), vec3(0.0, 0.0, -1.0), vec3(0.0), 1.0);\n  vec2 b = rayBox(vec3(0.0, 0.0, 5.0), vec3(0.0, 0.0, -1.0), vec3(0.0), vec3(1.0), n);\n  float p = rayPlane(vec3(0.0), vec3(0.0, -1.0, 0.0), vec3(0.0, 1.0, 0.0), 1.0);\n  fragColor = vec4(s.x, b.x, p, n.z);\n}\n`;
    const out = applyActions(new Map([['s.glsl', shader]]), run('raymarch', { hits: 'all', into: 's.glsl' })).get('s.glsl')!;
    assertCompiles(out, 'frag', 'ray intersections');
  });

  it('--parts picks helpers, which declare scene() as a prototype', () => {
    const files = adds(run('raymarch', { parts: 'soft-shadow' }));
    assert.deepEqual(files.map((f) => f.add), ['shaders/lib/raymarch-soft-shadow.glsl', 'shaders/lib/THIRD_PARTY_NOTICES.md']);
    assert.match(files[0].template, /^float scene\(vec3 p\);$/m);
    assert.doesNotMatch(files[0].template, /\bmap\(/);
    assert.throws(() => run('raymarch', { parts: 'shade' }), /--parts: unknown "shade" – valid: ao, camera, march, normal, soft-shadow/);
    assert.throws(() => run('raymarch', { name: 'x', into: 'y' }), /either --name .* or --into/);
  });

});

describe('glsl:filter', () => {
  const KINDS = ['blur-box', 'blur-gaussian', 'chromatic', 'crt', 'dither', 'grain', 'grayscale', 'kuwahara', 'pixelate', 'posterize', 'sepia', 'sharpen', 'sobel', 'vignette'];

  it('validates --kinds, listing what can be picked', () => {
    assert.throws(() => run('filter', {}), new RegExp(`--kinds: pick at least one – valid: ${KINDS.join(', ')}`));
    assert.throws(() => run('filter', { kinds: 'bloom' }), /--kinds: unknown "bloom"/);
    assert.throws(() => run('filter', { kinds: 'crt', name: 'x', into: 'y' }), /either --name .* or --into/);
  });

  it('the starter compiles with each filter, and with all, in every dialect', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    for (const version of VERSIONS) {
      for (const kinds of [...KINDS, 'all']) {
        const out = applyActions(new Map(), run('filter', { name: 'F', kinds, version })).get('shaders/f.frag.glsl')!;
        assertCompiles(out, 'frag', `filter starter (${version}, ${kinds})`);
      }
    }
  });

  it('one texture filter makes the color, the others are lines to switch to; color filters follow in order', () => {
    const out = applyActions(new Map(), run('filter', { name: 'F', kinds: 'vignette,sobel,crt,grayscale,pixelate' })).get('shaders/f.frag.glsl')!;
    const main = out.slice(out.indexOf('void main()'));
    assert.match(main, /^  uv = pixelate\(uTexture0, uv, 8\.0\);\n  vec3 color = vec3\(sobel\(uTexture0, uv\)\);\n  \/\/ or: color = crt\(/m);
    assert.ok(main.indexOf('grayscale(color)') < main.indexOf('vignette(uv'), 'grayscale before vignette');
    const plain = applyActions(new Map(), run('filter', { name: 'F', kinds: 'sepia' })).get('shaders/f.frag.glsl')!;
    assert.match(plain, /vec3 color = texture\(uTexture0, uv\)\.rgb;\n  color = sepia\(color, 1\.0\);/);
  });

  it('suggests the page with the test pattern, and notes the public-domain CRT next to the shader', () => {
    const actions = run('filter', { name: 'Retro', kinds: 'crt' });
    assert.ok(actions.some((a) => 'note' in a && /jen glsl:webgl --name=Retro --inline --shader=shaders\/retro\.frag\.glsl --texture=test-pattern/.test(a.note)));
    const notices = applyActions(new Map(), actions).get('shaders/THIRD_PARTY_NOTICES.md')!;
    assert.match(notices, /^## lottes-crt\n\n```\nCRT shader – Timothy Lottes, https:\/\/github\.com\/libretro\/glsl-shaders\/blob\/master\/crt\/shaders\/crt-lottes\.glsl\nReleased by its author into the public domain/m);
  });
});

describe('glsl:lighting', () => {
  it('--point adds pointLight(), which a loop over lights compiles with', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    const shader = `${header('300es')}\n\nout vec4 fragColor;\nuniform vec3 lamps[4];\n\nvoid main() {\n  vec3 p = vec3(0.0), n = vec3(0.0, 1.0, 0.0), color = vec3(0.0);\n  for (int i = 0; i < 4; i++) {\n    vec3 l;\n    float a = pointLight(p, lamps[i], 8.0, l);\n    color += lambert(n, l, vec3(0.8)) * a * 10.0 * vec3(1.0, 0.6, 0.3);\n  }\n  fragColor = vec4(color, 1.0);\n}\n`;
    const out = applyActions(new Map([['s.glsl', shader]]), run('lighting', { models: 'lambert', point: true, into: 's.glsl' })).get('s.glsl')!;
    assert.match(out, /^float pointLight\(vec3 p, vec3 lightPos, float range, out vec3 l\)/m);
    assert.match(out, /Brian Karis/);
    assertCompiles(out, 'frag', 'point lights in a loop');
  });

  it('validates, listing models and tonemaps', () => {
    assert.throws(() => run('lighting', {}), /pick something – --models=blinn, lambert, pbr, toon; --tonemap=aces, reinhard, srgb \(each also takes "all"\); --sky, --fog, --point/);
    assert.throws(() => run('lighting', { tonemap: 'filmic' }), /--tonemap: unknown "filmic"/);
    assert.throws(() => run('lighting', { models: 'phong' }), /--models: unknown "phong"/);
  });

  it('pbr brings its ambient light; tonemaps map to color chunks', () => {
    const files = adds(run('lighting', { models: 'pbr', tonemap: 'aces,srgb' })).map((a) => a.add);
    assert.deepEqual(files, [
      'shaders/lib/lighting-pbr.glsl',
      'shaders/lib/lighting-pbr-ambient.glsl',
      'shaders/lib/color-aces.glsl',
      'shaders/lib/color-srgb.glsl',
      'shaders/lib/THIRD_PARTY_NOTICES.md',
    ]);
  });

  it('every model and tonemap fits into one shader', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    for (const version of VERSIONS) {
      const files = new Map([['s.glsl', `${header(version)}\n\nout vec4 fragColor;\n\nvoid main() {\n  fragColor = vec4(0.0);\n}\n`]]);
      applyActions(files, run('lighting', { models: 'all', tonemap: 'all', sky: true, fog: true, into: 's.glsl' }));
      assertCompiles(files.get('s.glsl')!, 'frag', `all lighting (${version})`);
    }
  });

  it('--sky and --fog alone are enough, and bring only their own functions', () => {
    assert.deepEqual(adds(run('lighting', { sky: true, fog: true })).map((a) => a.add), ['shaders/lib/atmosphere-sky.glsl', 'shaders/lib/atmosphere-fog.glsl']);
  });
});

describe('glsl:displace', () => {
  it('--name writes a vertex/fragment pair that compiles, for every kind and dialect', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    for (const version of VERSIONS) {
      for (const kind of ['noise', 'wobble', 'waves']) {
        const files = applyActions(new Map(), run('displace', { kind, name: 'Blob', version }));
        assert.deepEqual([...files.keys()].filter((f) => f.endsWith('.glsl')), ['shaders/blob.vert.glsl', 'shaders/blob.frag.glsl']);
        assertCompiles(files.get('shaders/blob.vert.glsl')!, 'vert', `displace ${kind} vertex (${version})`);
        assertCompiles(files.get('shaders/blob.frag.glsl')!, 'frag', `displace ${kind} fragment (${version})`);
      }
    }
  });

  it('the preview uses the attributes and uniforms <shader-canvas> provides', () => {
    const vert = applyActions(new Map(), run('displace', { name: 'x' })).get('shaders/x.vert.glsl')!;
    for (const s of ['layout(location = 0) in vec3 aPosition;', 'layout(location = 1) in vec3 aNormal;', 'layout(location = 2) in vec2 aUV;', 'uniform mat4 uModel;', 'uniform float uTime;']) {
      assert.ok(vert.includes(s), s);
    }
    assert.ok(vert.indexOf('float simplexNoise(vec3 p)') < vert.indexOf('float displacement(vec3 p) {'), 'noise above your displacement()');
  });

  it('--into adds only the building blocks', () => {
    assert.deepEqual(adds(run('displace', { kind: 'noise' })).map((a) => a.add), ['shaders/lib/vertex-basis.glsl', 'shaders/lib/vertex-displace.glsl']);
    assert.deepEqual(adds(run('displace', { kind: 'waves' })).map((a) => a.add), ['shaders/lib/vertex-gerstner.glsl']);
    assert.throws(() => run('displace', { kind: 'twist' }), /--kind: expected one of "noise", "wobble", "waves", got "twist"/);
    assert.throws(() => run('displace', { name: 'x', into: 'y' }), /either --name .* or --into/);
  });
});

describe('glsl:matrix', () => {
  it('picks matrix helpers, which compile in vertex shaders too', { skip: !hasGlslang && 'glslangValidator not found' }, () => {
    assert.throws(() => run('matrix', {}), /--fns: pick at least one – valid: look-at, perspective, rotate, transform \(or "all"\)/);
    for (const version of VERSIONS) {
      const files = new Map([['m.vert.glsl', adds(run('vert', { name: 'm', kind: 'mesh', version }))[0].template]]);
      applyActions(files, run('matrix', { fns: 'all', into: 'm.vert.glsl' }));
      assertCompiles(files.get('m.vert.glsl')!, 'vert', `mesh starter + matrices (${version})`);
    }
  });

  it('reads translate and scale as the transform chunk, once', () => {
    for (const fns of ['scale', 'translate,scale', 'transform,scale']) {
      assert.deepEqual(adds(run('matrix', { fns })).map((a) => a.add), ['shaders/lib/matrix-transform.glsl'], fns);
    }
    assert.throws(() => run('matrix', { fns: 'skew' }), /--fns: unknown "skew" – valid: look-at, perspective, rotate, transform \(or "all"\)/);
  });
});

describe('glsl:webgl --shaderDir', () => {
  it('moves the shader and the URL that fetches it', () => {
    const files = new Map(adds(run('webgl', { name: 'x', shaderDir: 'glsl/' })).map((a) => [a.add, a.template]));
    assert.deepEqual([...files.keys()], ['index.html', 'shader-canvas.js', 'glsl/x.frag.glsl']);
    assert.match(files.get('index.html')!, /<shader-canvas src="glsl\/x.frag.glsl" live>/);
  });
});

// ─── Param descriptions ─────────────────────────────────────────────────────

/** Params that say what they're for by their name alone: the required name, and namespace. */
const selfExplanatory = (param: string, spec: { default?: unknown }): boolean =>
  (param === 'name' && spec.default === undefined) || param === 'namespace';

describe('param descriptions', () => {
  for (const [gen, g] of Object.entries(pack)) {
    it(`${gen}: every param says what it's for`, () => {
      const missing = Object.entries(g.params ?? {})
        .filter(([param, spec]) => !selfExplanatory(param, spec) && !spec.description?.trim())
        .map(([param]) => `--${param}`);
      assert.deepEqual(missing, []);
    });
  }
});

// ─── Examples ───────────────────────────────────────────────────────────────

/** The flags of an example call: `--name=Foo --moveOnly --members="int a, int b"` → { name: 'Foo', moveOnly: true, members: 'int a, int b' }. */
const exampleFlags = (args: string): Record<string, string | true> =>
  Object.fromEntries([...args.matchAll(/--([\w-]+)(?:=("[^"]*"|\S*))?/g)].map(([, k, v]) => [k, v === undefined ? true : v.replace(/^"(.*)"$/, '$1')]));

describe('examples', () => {
  for (const [gen, g] of Object.entries(pack)) {
    it(`${gen}: has examples that run as written`, () => {
      const params = g.params ?? {};
      assert.ok(g.examples?.length, 'no examples');
      for (const args of g.examples ?? []) {
        const flags = exampleFlags(args);
        for (const [flag, value] of Object.entries(flags)) {
          if (flag === 'dir' && !('dir' in params)) continue;
          assert.ok(flag in params, `${args}: no --${flag}`);
          const choices = params[flag].choices;
          if (choices) assert.ok(choices.includes(String(value)), `${args}: --${flag} takes ${choices.join(', ')}`);
        }
        const missing = Object.keys(params).filter((p) => params[p].default === undefined && !(p in flags));
        assert.deepEqual(missing, [], args);
      }
    });
  }
});
