/**
 * `cpp:shader`: a GLSL vertex/fragment shader pair (or a single stage),
 * embedded into a C string header at CMake configure time via
 * cmake/embed-glsl.cmake (added if missing), and wired into
 * src/CMakeLists.txt's embed_glsl() calls at a `# jen:shaders` marker.
 */
import type { Action, Generator } from '@codejen/jen';
import { readAsset } from './assets.ts';
import { fail } from './util.ts';

const VERT_TEMPLATE = `#version 410 core
layout (location = 0) in vec2 aPos;

void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG_TEMPLATE = `#version 410 core
out vec4 FragColor;

void main() {
  FragColor = vec4(1.0, 0.0, 1.0, 1.0);
}
`;

const shaderGenerator: Generator = {
  description:
    'create a GLSL vertex/fragment shader pair (or one stage via --stage=vert|frag), embedded via cmake/embed-glsl.cmake and wired into src/CMakeLists.txt',
  params: {
    name: {},
    stage: { default: 'both' },
  },
  actions: ({ name, stage }, { kebab, camel }) => {
    const stageVal = String(stage);
    if (stageVal !== 'both' && stageVal !== 'vert' && stageVal !== 'frag') {
      fail(`cpp:shader --stage: expected "both", "vert" or "frag", got "${stageVal}"`);
    }

    const base = kebab(String(name));
    const varBase = camel(String(name));

    const actions: Action[] = [{ add: 'cmake/embed-glsl.cmake', template: readAsset('embed-glsl.cmake') }];
    const embedLines: string[] = [];

    if (stageVal !== 'frag') {
      actions.push({ add: `src/${base}.vert.glsl`, template: VERT_TEMPLATE });
      embedLines.push(`embed_glsl("${base}.vert.glsl" ${varBase}VertexShader)`);
    }
    if (stageVal !== 'vert') {
      actions.push({ add: `src/${base}.frag.glsl`, template: FRAG_TEMPLATE });
      embedLines.push(`embed_glsl("${base}.frag.glsl" ${varBase}FragmentShader)`);
    }

    actions.push({ insert: 'src/CMakeLists.txt', before: '# jen:shaders', line: embedLines.join('\n') });
    return actions;
  },
};

export default shaderGenerator;
