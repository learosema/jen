/**
 * `cpp:shader`: embeds a GLSL file you already have (write it with pack-glsl's
 * `glsl:frag`, or by hand) into a C string header at CMake configure time via
 * cmake/embed-glsl.cmake (added if missing), wired in at the `# jen:embed` marker
 * like `cpp:embed`. It writes no GLSL of its own: the shader's content is the
 * glsl pack's job, getting it into the build is this one's.
 */
import { posix } from 'node:path';
import type { Action, Generator } from '@codejen/jen';
import { readAsset } from './assets.ts';
import { fail } from './util.ts';

/** `vignette.frag.glsl` → `vignetteFragmentShader`, `blur.glsl` → `blurShader`. */
function variableName(file: string, camel: (s: string) => string): string {
  const stem = posix.basename(file).replace(/\.glsl$/, '');
  const stage = /^(.*)\.(vert|frag)$/.exec(stem);
  if (stage) return `${camel(stage[1])}${stage[2] === 'vert' ? 'Vertex' : 'Fragment'}Shader`;
  return `${camel(stem)}Shader`;
}

const shaderGenerator: Generator = {
  description:
    'embed an existing GLSL file as a C string via cmake/embed-glsl.cmake, wired in at # jen:embed (write the shader with glsl:frag or by hand)',
  params: {
    file: { path: true },
    name: { default: '' },
  },
  actions: ({ file, name }, { camel }, ctx) => {
    const shader = String(file).slice(1); // a path param: /… from the project root
    if (!ctx.exists(shader)) {
      fail(`cpp:shader --file: ${String(file)} not found (relative to the current directory). Write it first, e.g. with glsl:frag, or by hand.`);
    }
    const variable = String(name) || variableName(shader, camel);
    const actions: Action[] = [{ add: '/cmake/embed-glsl.cmake', template: readAsset('embed-glsl.cmake') }];

    // embed_glsl() paths are relative to the CMakeLists.txt that calls it, so this one needs to know which
    const target = ctx.findUp('CMakeLists.txt', '# jen:embed', posix.dirname(shader)) ?? ctx.grep('CMakeLists.txt', '# jen:embed')[0];
    if (!target) fail('cpp:shader: no CMakeLists.txt with a "# jen:embed" marker found.');
    actions.push(
      { insert: `/${target}`, before: '# jen:embed', line: 'include(${PROJECT_SOURCE_DIR}/cmake/embed-glsl.cmake)' },
      { insert: `/${target}`, before: '# jen:embed', line: `embed_glsl("${posix.relative(posix.dirname(target), shader)}" ${variable})` },
    );
    return actions;
  },
};

export default shaderGenerator;
