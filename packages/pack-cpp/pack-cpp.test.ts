/**
 * Tests for @codejen/pack-cpp – unit tests against the pack's actions() output.
 *
 * A small local stand-in for jen's Helpers is used here (rather than the
 * runtime helpers from `@codejen/jen`) so this pack's tests don't depend
 * on jen's own dist being built first – same as any external pack author,
 * who only takes jen's types, never a runtime dependency on it.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Action, Helpers } from '@codejen/jen';
import pack from './src/index.ts';

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

function planClass(answers: Record<string, string | boolean>): Action[] {
  const defaults = { namespace: '', moveOnly: false, resource: 'Resource*', nullValue: 'nullptr', destroy: 'destroy' };
  return pack.class.actions({ ...defaults, ...answers }, helpers);
}

function planHandle(name: string, namespace = ''): { add: string; template: string }[] {
  return pack.handle.actions({ name, namespace }, helpers) as { add: string; template: string }[];
}

function planScopeExit(name: string, namespace = ''): { add: string; template: string }[] {
  return pack.scopeexit.actions({ name, namespace }, helpers) as { add: string; template: string }[];
}

function planR0(answers: Record<string, string>): { add: string; template: string }[] {
  return pack.r0.actions({ namespace: '', ...answers }, helpers) as { add: string; template: string }[];
}

function planShader(answers: Record<string, string>): Action[] {
  return pack.shader.actions({ stage: 'both', ...answers }, helpers);
}

function planSdl3(answers: Record<string, string>): Action[] {
  const defaults = { width: '800', height: '600', bundleId: '', sdlTag: 'release-3.4.14' };
  return pack.sdl3.actions({ ...defaults, ...answers }, helpers);
}

function planSdl3Opengl(answers: Record<string, string>): Action[] {
  const defaults = { width: '800', height: '600', bundleId: '', sdlTag: 'release-3.4.14' };
  return pack['sdl3-opengl'].actions({ ...defaults, ...answers }, helpers);
}

const template = (a: Action): string => ('template' in a ? a.template : '');
const adds = (actions: Action[]): string[] => actions.filter((a): a is { add: string; template: string } => 'add' in a).map((a) => a.add);
const inserts = (actions: Action[]): { before: string; line: string }[] =>
  actions.filter((a): a is { insert: string; before: string; line: string } => 'insert' in a);
const byAdd = (actions: Action[], path: string): string =>
  template(actions.find((a): a is { add: string; template: string } => 'add' in a && a.add === path) ?? { add: '', template: '' });

describe('class', () => {
  it('writes the header and source under src/, named after the pascal-cased class name', () => {
    const actions = planClass({ name: 'rigid-body' });
    assert.deepEqual(adds(actions), ['src/RigidBody.h', 'src/RigidBody.cpp']);
  });

  it('wires the new source into src/CMakeLists.txt at the # jen:sources marker', () => {
    const actions = planClass({ name: 'RigidBody' });
    assert.deepEqual(inserts(actions), [{ insert: 'src/CMakeLists.txt', before: '# jen:sources', line: '  RigidBody.cpp' }]);
  });

  it('uses an include guard derived from the name', () => {
    const [header] = planClass({ name: 'rigid-body' });
    assert.match(template(header), /#ifndef RIGID_BODY_H/);
    assert.match(template(header), /#define RIGID_BODY_H/);
    assert.match(template(header), /#endif {2}\/\/ RIGID_BODY_H/);
  });

  it('declares and defines the constructor and destructor by default', () => {
    const [header, source] = planClass({ name: 'Foo' });
    assert.match(template(header), /class Foo \{/);
    assert.match(template(header), /~Foo\(\);/);
    assert.match(template(source), /Foo::Foo\(\) \{\}/);
    assert.match(template(source), /Foo::~Foo\(\) \{\}/);
  });

  it('omits the namespace wrapper by default', () => {
    const [header] = planClass({ name: 'Foo' });
    assert.doesNotMatch(template(header), /namespace/);
  });

  it('wraps the class in a namespace when given one', () => {
    const [header, source] = planClass({ name: 'Foo', namespace: 'game' });
    assert.match(template(header), /namespace game \{/);
    assert.match(template(header), /\} {2}\/\/ namespace game/);
    assert.match(template(source), /namespace game \{/);
  });

  describe('--moveOnly', () => {
    it('is move-only: copy deleted, move defined via release()/reset()', () => {
      const [header] = planClass({ name: 'Texture', moveOnly: true });
      assert.match(template(header), /Texture\(const Texture&\) = delete;/);
      assert.match(template(header), /Texture& operator=\(const Texture&\) = delete;/);
      assert.match(template(header), /Texture\(Texture&& other\) noexcept : handle_\{other\.release\(\)\} \{\}/);
    });

    it('defaults to a raw Resource* handle destroyed via destroy()', () => {
      const [header, source] = planClass({ name: 'Texture', moveOnly: true });
      assert.match(template(header), /Resource\* handle_\{nullptr\};/);
      assert.match(template(source), /if \(handle_ != nullptr\) destroy\(handle_\);/);
    });

    it('honors --resource, --nullValue and --destroy', () => {
      const [header, source] = planClass({
        name: 'Texture',
        moveOnly: true,
        resource: 'GLuint',
        nullValue: '0',
        destroy: 'glDeleteTextures',
      });
      assert.match(template(header), /GLuint handle_\{0\};/);
      assert.match(template(source), /if \(handle_ != 0\) glDeleteTextures\(handle_\);/);
    });

    it('still wires the source into src/CMakeLists.txt', () => {
      const actions = planClass({ name: 'Texture', moveOnly: true });
      assert.deepEqual(inserts(actions), [{ insert: 'src/CMakeLists.txt', before: '# jen:sources', line: '  Texture.cpp' }]);
    });
  });
});

describe('cpp:handle', () => {
  it('names the header after the pascal-cased name, under src/', () => {
    const [header] = planHandle('handle');
    assert.equal(header.add, 'src/Handle.h');
  });

  it('is a header-only template constrained by Deleter invocability', () => {
    const [header] = planHandle('Handle');
    assert.match(template(header), /template <std::regular T, auto Deleter, T Null = T\{\}>/);
    assert.match(template(header), /requires std::invocable<decltype\(Deleter\), T>/);
  });

  it('is move-only and exposes get\\(\\)\\/release\\(\\)\\/reset\\(\\)', () => {
    const [header] = planHandle('Handle');
    assert.match(template(header), /Handle\(const Handle&\) = delete;/);
    assert.match(template(header), /\[\[nodiscard\]\] T get\(\) const noexcept \{ return handle_; \}/);
    assert.match(template(header), /\[\[nodiscard\]\] T release\(\) noexcept \{ return std::exchange\(handle_, Null\); \}/);
  });
});

describe('cpp:scopeexit', () => {
  it('names the header after the pascal-cased name, under src/', () => {
    const [header] = planScopeExit('scope-exit');
    assert.equal(header.add, 'src/ScopeExit.h');
  });

  it('requires a nothrow-invocable callable and runs it on destruction unless released', () => {
    const [header] = planScopeExit('ScopeExit');
    assert.match(template(header), /requires std::is_nothrow_invocable_v<F>/);
    assert.match(template(header), /~ScopeExit\(\) \{\n\s*if \(active_\) f_\(\);/);
    assert.match(template(header), /void release\(\) noexcept \{ active_ = false; \}/);
  });
});

describe('cpp:r0', () => {
  it('names the header after the pascal-cased class name, under src/', () => {
    const [header] = planR0({ name: 'person', members: 'std::string name, int age' });
    assert.equal(header.add, 'src/Person.h');
  });

  it('generates a constructor with a member-init list from --members', () => {
    const [header] = planR0({ name: 'Person', members: 'std::string name, int age' });
    assert.match(template(header), /explicit Person\(std::string name, int age\)/);
    assert.match(template(header), /name_\{std::move\(name\)\}, age_\{std::move\(age\)\}/);
  });

  it('declares private members for each param, with no special member functions', () => {
    const [header] = planR0({ name: 'Person', members: 'std::string name, int age' });
    assert.match(template(header), /std::string name_;/);
    assert.match(template(header), /int age_;/);
    assert.doesNotMatch(template(header), /= delete/);
    assert.doesNotMatch(template(header), /= default/);
  });

  it('fails clearly on a malformed member (missing name)', () => {
    assert.throws(() => planR0({ name: 'Person', members: 'std::string' }), /Type name/);
  });
});

describe('cpp:shader', () => {
  it('writes a kebab-cased vertex/fragment pair under src/ by default', () => {
    const actions = planShader({ name: 'Tonemap' });
    assert.deepEqual(adds(actions), ['cmake/embed-glsl.cmake', 'src/tonemap.vert.glsl', 'src/tonemap.frag.glsl']);
  });

  it('wires both stages into src/CMakeLists.txt at the # jen:shaders marker', () => {
    const actions = planShader({ name: 'Tonemap' });
    assert.deepEqual(inserts(actions), [
      {
        insert: 'src/CMakeLists.txt',
        before: '# jen:shaders',
        line: 'embed_glsl("tonemap.vert.glsl" tonemapVertexShader)\nembed_glsl("tonemap.frag.glsl" tonemapFragmentShader)',
      },
    ]);
  });

  it('ships the embed_glsl() CMake helper unmodified', () => {
    const actions = planShader({ name: 'Tonemap' });
    assert.match(byAdd(actions, 'cmake/embed-glsl.cmake'), /function\(embed_glsl INPUT_FILE VARIABLE_NAME\)/);
  });

  it('--stage=vert writes only the vertex shader', () => {
    const actions = planShader({ name: 'Tonemap', stage: 'vert' });
    assert.deepEqual(adds(actions), ['cmake/embed-glsl.cmake', 'src/tonemap.vert.glsl']);
    assert.deepEqual(inserts(actions), [
      { insert: 'src/CMakeLists.txt', before: '# jen:shaders', line: 'embed_glsl("tonemap.vert.glsl" tonemapVertexShader)' },
    ]);
  });

  it('--stage=frag writes only the fragment shader', () => {
    const actions = planShader({ name: 'Tonemap', stage: 'frag' });
    assert.deepEqual(adds(actions), ['cmake/embed-glsl.cmake', 'src/tonemap.frag.glsl']);
  });

  it('fails clearly on an unknown --stage', () => {
    assert.throws(() => planShader({ name: 'Tonemap', stage: 'geom' }), /--stage/);
  });
});

describe('sdl3', () => {
  it('writes the root/vendor/src CMakeLists and src/main.cpp', () => {
    const actions = planSdl3({ name: 'MyGame' });
    assert.deepEqual(adds(actions), ['CMakeLists.txt', 'vendor/CMakeLists.txt', 'src/CMakeLists.txt', 'src/main.cpp']);
  });

  it('kebab-cases the CMake project/target name', () => {
    const actions = planSdl3({ name: 'MyGame' });
    assert.match(byAdd(actions, 'CMakeLists.txt'), /project\(my-game CXX\)/);
    assert.match(byAdd(actions, 'src/CMakeLists.txt'), /add_executable\(my-game\)/);
  });

  it('leaves a # jen:sources marker in src/CMakeLists.txt for `class` to insert into', () => {
    const actions = planSdl3({ name: 'MyGame' });
    assert.match(byAdd(actions, 'src/CMakeLists.txt'), /main\.cpp\n {2}# jen:sources/);
  });

  it('vendors SDL3 via FetchContent, preferring a local find_package first', () => {
    const actions = planSdl3({ name: 'MyGame' });
    const vendor = byAdd(actions, 'vendor/CMakeLists.txt');
    assert.match(vendor, /GIT_REPOSITORY "https:\/\/github\.com\/libsdl-org\/SDL\.git"/);
    assert.match(vendor, /GIT_TAG release-3\.4\.14/);
    assert.match(vendor, /FIND_PACKAGE_ARGS NAMES SDL3 CONFIG GLOBAL/);
  });

  it('honors --sdlTag', () => {
    const actions = planSdl3({ name: 'MyGame', sdlTag: 'release-3.2.0' });
    assert.match(byAdd(actions, 'vendor/CMakeLists.txt'), /GIT_TAG release-3\.2\.0/);
  });

  it('uses SDL_MAIN_USE_CALLBACKS with a default bundle id derived from the name', () => {
    const actions = planSdl3({ name: 'MyGame' });
    const main = byAdd(actions, 'src/main.cpp');
    assert.match(main, /#define SDL_MAIN_USE_CALLBACKS 1/);
    assert.match(main, /SDL_SetAppMetadata\("MyGame", "1\.0", "com\.example\.my-game"\)/);
  });

  it('honors --bundleId', () => {
    const actions = planSdl3({ name: 'MyGame', bundleId: 'lgbt.lea.my-game' });
    assert.match(byAdd(actions, 'src/main.cpp'), /SDL_SetAppMetadata\("MyGame", "1\.0", "lgbt\.lea\.my-game"\)/);
  });
});

describe('sdl3-opengl', () => {
  it('writes CMake glue, vendored glad, the app class, shader-utils and the demo shaders', () => {
    const actions = planSdl3Opengl({ name: 'MyGame' });
    assert.deepEqual(adds(actions), [
      'CMakeLists.txt',
      'vendor/CMakeLists.txt',
      'cmake/embed-glsl.cmake',
      'vendor/glad/CMakeLists.txt',
      'vendor/glad/include/glad/glad.h',
      'vendor/glad/include/KHR/khrplatform.h',
      'vendor/glad/src/glad.c',
      'src/CMakeLists.txt',
      'src/main.cpp',
      'src/my-game-app.h',
      'src/my-game-app.cpp',
      'src/shader-utils.h',
      'src/shader-utils.cpp',
      'src/quad.vert.glsl',
      'src/quad.frag.glsl',
    ]);
  });

  it('vendors a real, non-empty glad loader', () => {
    const actions = planSdl3Opengl({ name: 'MyGame' });
    const gladH = byAdd(actions, 'vendor/glad/include/glad/glad.h');
    const gladC = byAdd(actions, 'vendor/glad/src/glad.c');
    assert.match(gladH, /gladLoadGLLoader/);
    assert.ok(gladC.length > 1000);
  });

  it('includes cmake/embed-glsl.cmake from the root and add_subdirectory(glad) from vendor/', () => {
    const actions = planSdl3Opengl({ name: 'MyGame' });
    assert.match(byAdd(actions, 'CMakeLists.txt'), /include\(cmake\/embed-glsl\.cmake\)/);
    assert.match(byAdd(actions, 'vendor/CMakeLists.txt'), /add_subdirectory\(glad\)/);
  });

  it('embeds the bundled quad demo shaders and leaves both jen markers in src/CMakeLists.txt', () => {
    const actions = planSdl3Opengl({ name: 'MyGame' });
    const cmake = byAdd(actions, 'src/CMakeLists.txt');
    assert.match(cmake, /embed_glsl\("quad\.vert\.glsl" quadVertexShader\)/);
    assert.match(cmake, /embed_glsl\("quad\.frag\.glsl" quadFragmentShader\)/);
    assert.match(cmake, /# jen:shaders/);
    assert.match(cmake, /# jen:sources/);
    assert.match(cmake, /target_link_libraries\(my-game PRIVATE SDL3::SDL3 glad\)/);
  });

  it('names the app class after the pascal-cased name', () => {
    const actions = planSdl3Opengl({ name: 'my_game' });
    const header = byAdd(actions, 'src/my-game-app.h');
    assert.match(header, /class MyGameApp \{/);
    assert.match(byAdd(actions, 'src/main.cpp'), /new MyGameApp\(\)/);
  });

  it('sets up an OpenGL 4.1 core context and loads it via gladLoadGLLoader', () => {
    const actions = planSdl3Opengl({ name: 'MyGame' });
    const source = byAdd(actions, 'src/my-game-app.cpp');
    assert.match(source, /SDL_GL_CONTEXT_PROFILE_CORE/);
    assert.match(source, /SDL_GL_CONTEXT_MAJOR_VERSION, 4/);
    assert.match(source, /gladLoadGLLoader\(reinterpret_cast<GLADloadproc>\(SDL_GL_GetProcAddress\)\)/);
  });
});
