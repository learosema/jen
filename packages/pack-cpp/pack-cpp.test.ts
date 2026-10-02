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
  const defaults = { width: '800', height: '600', bundleId: '', sdlTag: 'release-3.4.14', folderCase: 'kebab', dir: '.' };
  return pack.sdl3.actions({ ...defaults, ...answers }, helpers);
}

function planSdl3Opengl(answers: Record<string, string>): Action[] {
  const defaults = { width: '800', height: '600', bundleId: '', sdlTag: 'release-3.4.14', folderCase: 'kebab', dir: '.' };
  return pack['sdl3-opengl'].actions({ ...defaults, ...answers }, helpers);
}

const template = (a: Action): string => ('template' in a ? a.template : '');
const adds = (actions: Action[]): string[] => actions.filter((a): a is { add: string; template: string } => 'add' in a).map((a) => a.add);
const inserts = (actions: Action[]): { insert: string; before: string; line: string }[] =>
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

describe('app starter folder', () => {
  for (const [id, plan] of [['sdl3', planSdl3], ['sdl3-opengl', planSdl3Opengl]] as const) {
    it(`${id}: lands in a kebab-case folder named after the app by default`, () => {
      const actions = plan({ name: 'MyGame', dir: '' });
      assert.ok(adds(actions).every((p) => p.startsWith('my-game/')));
      assert.ok(adds(actions).includes('my-game/src/main.cpp'));
    });

    it(`${id}: --folderCase=pascal gives a PascalCase folder`, () => {
      const actions = plan({ name: 'my-game', dir: '', folderCase: 'pascal' });
      assert.ok(adds(actions).every((p) => p.startsWith('MyGame/')));
    });

    it(`${id}: --dir overrides the folder, --dir=. writes in place`, () => {
      assert.ok(adds(plan({ name: 'MyGame', dir: 'games/x/' })).every((p) => p.startsWith('games/x/')));
      assert.ok(adds(plan({ name: 'MyGame', dir: '.' })).includes('CMakeLists.txt'));
    });

    it(`${id}: rejects an unknown --folderCase`, () => {
      assert.throws(() => plan({ name: 'MyGame', dir: '', folderCase: 'snake' }), /--folderCase/);
    });
  }
});

describe('sdl3', () => {
  it('writes the root/vendor/src CMakeLists and src/main.cpp', () => {
    const actions = planSdl3({ name: 'MyGame' });
    assert.deepEqual(adds(actions), [
      'CMakeLists.txt',
      'vendor/CMakeLists.txt',
      'src/CMakeLists.txt',
      'src/main.cpp',
      'src/app.h',
      'src/app.cpp',
    ]);
  });

  it('kebab-cases the CMake project/target name', () => {
    const actions = planSdl3({ name: 'MyGame' });
    assert.match(byAdd(actions, 'CMakeLists.txt'), /project\(my-game CXX\)/);
    assert.match(byAdd(actions, 'src/CMakeLists.txt'), /add_executable\(my-game main\.cpp\)/);
  });

  it('splits the code into a my-game-core library, linked by a thin executable', () => {
    const cmake = byAdd(planSdl3({ name: 'MyGame' }), 'src/CMakeLists.txt');
    assert.match(cmake, /add_library\(my-game-core\)/);
    assert.match(cmake, /target_link_libraries\(my-game-core PUBLIC SDL3::SDL3\)/);
    assert.match(cmake, /target_link_libraries\(my-game PRIVATE my-game-core\)/);
  });

  it('leaves the jen markers later generators insert at', () => {
    const actions = planSdl3({ name: 'MyGame' });
    const src = byAdd(actions, 'src/CMakeLists.txt');
    for (const marker of ['# jen:embed', '# jen:link', '# jen:app']) assert.match(src, new RegExp(marker));
    assert.match(src, /app\.cpp\n {2}# jen:sources/);
    const root = byAdd(actions, 'CMakeLists.txt');
    for (const marker of ['# jen:options', '# jen:subdirs', '# jen:install', '# jen:cpack']) assert.match(root, new RegExp(marker));
    const app = byAdd(actions, 'src/app.cpp');
    for (const marker of ['// jen:includes', '// jen:frame-end']) assert.match(app, new RegExp(marker));
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
    assert.match(byAdd(actions, 'src/main.cpp'), /#define SDL_MAIN_USE_CALLBACKS 1/);
    assert.match(byAdd(actions, 'src/app.cpp'), /SDL_SetAppMetadata\("MyGame", "1\.0", "com\.example\.my-game"\)/);
  });

  it('honors --bundleId', () => {
    const actions = planSdl3({ name: 'MyGame', bundleId: 'lgbt.lea.my-game' });
    assert.match(byAdd(actions, 'src/app.cpp'), /SDL_SetAppMetadata\("MyGame", "1\.0", "lgbt\.lea\.my-game"\)/);
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
      'src/app.h',
      'src/app.cpp',
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
    assert.match(cmake, /target_link_libraries\(my-game-core PUBLIC SDL3::SDL3 glad\)/);
  });

  it('names the app class after the pascal-cased name', () => {
    const actions = planSdl3Opengl({ name: 'my_game' });
    const header = byAdd(actions, 'src/app.h');
    assert.match(header, /class MyGameApp \{/);
    assert.match(byAdd(actions, 'src/main.cpp'), /new MyGameApp\(\)/);
  });

  it('sets up an OpenGL 4.1 core context and loads it via gladLoadGLLoader', () => {
    const actions = planSdl3Opengl({ name: 'MyGame' });
    const source = byAdd(actions, 'src/app.cpp');
    assert.match(source, /SDL_GL_CONTEXT_PROFILE_CORE/);
    assert.match(source, /SDL_GL_CONTEXT_MAJOR_VERSION, 4/);
    assert.match(source, /gladLoadGLLoader\(reinterpret_cast<GLADloadproc>\(SDL_GL_GetProcAddress\)\)/);
  });

  it('leaves the GL markers for cpp:tracy', () => {
    const source = byAdd(planSdl3Opengl({ name: 'MyGame' }), 'src/app.cpp');
    for (const marker of ['// jen:includes', '// jen:gl-init', '// jen:frame-end']) assert.match(source, new RegExp(marker));
  });
});

// ─── class & type generators ────────────────────────────────────────────────

type Plan = (answers: Record<string, string | boolean>) => Action[];
const plan = (id: string, answers: Record<string, string | boolean>, defaults: Record<string, string | boolean> = {}): Action[] =>
  pack[id].actions({ namespace: '', withTest: false, ...defaults, ...answers }, helpers);

const planInterface: Plan = (a) => plan('interface', a, { methods: '', impl: '' });
const planStruct: Plan = (a) => plan('struct', a, { compare: false });
const planStrong: Plan = (a) => plan('strong', a, { ops: 'compare' });
const planEnum: Plan = (a) => plan('enum', a, { std: '23' });
const planPimpl: Plan = (a) => plan('pimpl', a);
const planVariant: Plan = (a) => plan('variant', a);

describe('--withTest', () => {
  it('adds tests/<Name>_test.cpp and wires it in at # jen:tests, on every type generator', () => {
    const cases: [Action[], string][] = [
      [planClass({ name: 'Foo', withTest: true }), 'Foo'],
      [planR0Test({ name: 'Foo', members: 'int a' }), 'Foo'],
      [planStruct({ name: 'Foo', members: 'int a', withTest: true }), 'Foo'],
      [planStrong({ name: 'Foo', underlying: 'int', withTest: true }), 'Foo'],
      [planEnum({ name: 'Foo', values: 'a, b', withTest: true }), 'Foo'],
      [planPimpl({ name: 'Foo', withTest: true }), 'Foo'],
      [planVariant({ name: 'Foo', cases: 'A, B', withTest: true }), 'Foo'],
      [planInterface({ name: 'Foo', withTest: true }), 'Foo'],
    ];
    for (const [actions, name] of cases) {
      assert.ok(adds(actions).includes(`tests/${name}_test.cpp`));
      assert.ok(inserts(actions).some((i) => i.before === '# jen:tests' && i.line === `  ${name}_test.cpp`));
    }
  });

  it('is off by default', () => {
    assert.ok(!adds(planClass({ name: 'Foo' })).some((p) => p.startsWith('tests/')));
    assert.ok(!inserts(planStruct({ name: 'Foo', members: 'int a' })).some((i) => i.before === '# jen:tests'));
  });

  it('checks the properties the generator promises', () => {
    const moveOnly = byAdd(planClass({ name: 'Foo', moveOnly: true, withTest: true }), 'tests/Foo_test.cpp');
    assert.match(moveOnly, /#include <doctest\/doctest\.h>/);
    assert.match(moveOnly, /#include "Foo\.h"/);
    assert.match(moveOnly, /!std::is_copy_constructible_v<Foo>/);
    assert.match(byAdd(planStruct({ name: 'Foo', members: 'int a', withTest: true }), 'tests/Foo_test.cpp'), /is_aggregate_v<Foo>/);
  });
});

function planR0Test(answers: Record<string, string>): Action[] {
  return pack.r0.actions({ namespace: '', compare: false, ...answers, withTest: true }, helpers);
}

describe('cpp:r0 --compare', () => {
  it('defaults <=> as a member', () => {
    const [header] = pack.r0.actions({ name: 'P', members: 'int a', namespace: '', compare: true, withTest: false }, helpers);
    assert.match(template(header), /#include <compare>/);
    assert.match(template(header), /auto operator<=>\(const P&\) const = default;/);
  });
});

describe('cpp:interface', () => {
  const methods = 'void draw(), int size() const, std::map<int, int> find(int key, int def = 3) const';

  it('has a virtual defaulted destructor, protected copy/move and pure virtual methods', () => {
    const header = byAdd(planInterface({ name: 'Drawable', methods }), 'src/Drawable.h');
    assert.match(header, /virtual ~Drawable\(\) = default;/);
    assert.match(header, /virtual void draw\(\) = 0;/);
    assert.match(header, /virtual int size\(\) const = 0;/);
    assert.match(header, /virtual std::map<int, int> find\(int key, int def = 3\) const = 0;/);
    assert.match(header, / protected:\n[^]*Drawable\(const Drawable&\) = default;/);
  });

  it('--impl scaffolds a final class with overrides, wired into src/CMakeLists.txt', () => {
    const actions = planInterface({ name: 'Drawable', methods, impl: 'SpriteDrawable' });
    assert.deepEqual(adds(actions), ['src/Drawable.h', 'src/SpriteDrawable.h', 'src/SpriteDrawable.cpp']);
    assert.deepEqual(inserts(actions), [{ insert: 'src/CMakeLists.txt', before: '# jen:sources', line: '  SpriteDrawable.cpp' }]);
    const header = byAdd(actions, 'src/SpriteDrawable.h');
    assert.match(header, /class SpriteDrawable final : public Drawable/);
    assert.match(header, /void draw\(\) override;/);
    assert.match(header, /int size\(\) const override;/);
  });

  it('defines stubs without repeating default arguments, marking params unused', () => {
    const source = byAdd(planInterface({ name: 'Drawable', methods, impl: 'Sprite' }), 'src/Sprite.cpp');
    assert.match(source, /void Sprite::draw\(\) \{\}/);
    assert.match(source, /int Sprite::size\(\) const \{ return \{\}; \}/);
    assert.match(source, /Sprite::find\(\[\[maybe_unused\]\] int key, \[\[maybe_unused\]\] int def\) const/);
  });

  it('wraps everything in the namespace', () => {
    const actions = planInterface({ name: 'Drawable', methods: 'void draw()', impl: 'Sprite', namespace: 'gfx' });
    assert.match(byAdd(actions, 'src/Drawable.h'), /namespace gfx \{[^]*\} {2}\/\/ namespace gfx/);
    assert.match(byAdd(actions, 'src/Sprite.cpp'), /namespace gfx \{[^]*void Sprite::draw\(\) \{\}/);
  });

  it('fails clearly on a malformed method', () => {
    assert.throws(() => planInterface({ name: 'Drawable', methods: 'draw' }), /--methods/);
  });
});

describe('cpp:struct', () => {
  it('generates public members with default initializers, value-initializing bare ones', () => {
    const header = byAdd(planStruct({ name: 'Config', members: 'int width = 800, std::array<int, 3> rgb{1, 2, 3}, float scale' }), 'src/Config.h');
    assert.match(header, /struct Config \{/);
    assert.match(header, / {2}int width = 800;/);
    assert.match(header, / {2}std::array<int, 3> rgb\{1, 2, 3\};/);
    assert.match(header, / {2}float scale\{\};/);
  });

  it('--compare adds a defaulted <=>', () => {
    const header = byAdd(planStruct({ name: 'Config', members: 'int a', compare: true }), 'src/Config.h');
    assert.match(header, /#include <compare>/);
    assert.match(header, /auto operator<=>\(const Config&\) const = default;/);
  });

  it('fails clearly on a member without a type', () => {
    assert.throws(() => planStruct({ name: 'Config', members: 'width' }), /Type name/);
  });
});

describe('cpp:strong', () => {
  it('has an explicit constructor and a value() accessor', () => {
    const header = byAdd(planStrong({ name: 'Pixels', underlying: 'int' }), 'src/Pixels.h');
    assert.match(header, /constexpr explicit Pixels\(int value\) noexcept : value_\{value\} \{\}/);
    assert.match(header, /int value_\{\};/);
    assert.match(header, /auto operator<=>\(const Pixels&\) const = default;/);
    assert.doesNotMatch(header, /operator\+/);
  });

  it('--ops=arith,hash adds arithmetic and a std::hash specialization', () => {
    const header = byAdd(planStrong({ name: 'Pixels', underlying: 'int', ops: 'arith,hash', namespace: 'gfx' }), 'src/Pixels.h');
    assert.match(header, /operator\+=\(Pixels rhs\)/);
    assert.match(header, /struct std::hash<gfx::Pixels>/);
    assert.doesNotMatch(header, /<=>/);
  });

  it('fails clearly on an unknown op', () => {
    assert.throws(() => planStrong({ name: 'Pixels', underlying: 'int', ops: 'sort' }), /--ops/);
  });
});

describe('cpp:enum', () => {
  it('generates the enum class, to_string() without a default case, and a formatter', () => {
    const header = byAdd(planEnum({ name: 'game-state', values: 'idle, running, paused' }), 'src/GameState.h');
    assert.match(header, /enum class GameState \{\n {2}Idle,\n {2}Running,\n {2}Paused,\n\};/);
    assert.match(header, /case GameState::Running:\n {6}return "Running";/);
    assert.doesNotMatch(header, /default:/);
    assert.match(header, /std::unreachable\(\);/);
    assert.match(header, /struct std::formatter<GameState> : std::formatter<std::string_view>/);
  });

  it('--std=20 swaps std::unreachable() for std::abort()', () => {
    const header = byAdd(planEnum({ name: 'State', values: 'a', std: '20' }), 'src/State.h');
    assert.match(header, /std::abort\(\);/);
    assert.match(header, /#include <cstdlib>/);
    assert.doesNotMatch(header, /std::unreachable\(\);/);
  });

  it('qualifies the formatter with the namespace', () => {
    const header = byAdd(planEnum({ name: 'State', values: 'a', namespace: 'game' }), 'src/State.h');
    assert.match(header, /std::formatter<game::State>/);
    assert.match(header, /game::to_string\(value\)/);
  });

  it('fails clearly on a bad --std or a non-identifier value', () => {
    assert.throws(() => planEnum({ name: 'State', values: 'a', std: '17' }), /--std/);
    assert.throws(() => planEnum({ name: 'State', values: '1st' }), /identifier/);
  });
});

describe('cpp:pimpl', () => {
  it('keeps Impl incomplete in the header and defaults the special members in the .cpp', () => {
    const actions = planPimpl({ name: 'Renderer' });
    assert.deepEqual(adds(actions), ['src/Renderer.h', 'src/Renderer.cpp']);
    assert.deepEqual(inserts(actions), [{ insert: 'src/CMakeLists.txt', before: '# jen:sources', line: '  Renderer.cpp' }]);
    assert.match(byAdd(actions, 'src/Renderer.h'), /struct Impl;\n {2}std::unique_ptr<Impl> impl_;/);
    const source = byAdd(actions, 'src/Renderer.cpp');
    assert.match(source, /Renderer::~Renderer\(\) = default;/);
    assert.match(source, /Renderer::Renderer\(Renderer&&\) noexcept = default;/);
  });
});

describe('cpp:variant', () => {
  it('generates a struct per case, the variant alias and a shared overloaded.h', () => {
    const actions = planVariant({ name: 'Event', cases: 'key-down, KeyUp, Resize' });
    assert.deepEqual(adds(actions), ['src/overloaded.h', 'src/Event.h']);
    const header = byAdd(actions, 'src/Event.h');
    assert.match(header, /struct KeyDown \{\};/);
    assert.match(header, /using Event = std::variant<KeyDown, KeyUp, Resize>;/);
    assert.match(byAdd(actions, 'src/overloaded.h'), /struct overloaded : Ts\.\.\./);
  });
});

// ─── tooling, profiling, packaging, resources ───────────────────────────────

const planTool = (id: string, answers: Record<string, string | boolean> = {}, defaults: Record<string, string | boolean> = {}): Action[] =>
  pack[id].actions({ ...defaults, ...answers }, helpers);

describe('cpp:tidy', () => {
  it('enables the guideline checks, with the noisy ones disabled', () => {
    const actions = planTool('tidy', {}, { cmake: true });
    const yaml = byAdd(actions, '.clang-tidy');
    for (const check of ['cppcoreguidelines-\\*', 'modernize-\\*', 'bugprone-\\*', 'performance-\\*', '-cppcoreguidelines-avoid-magic-numbers']) {
      assert.match(yaml, new RegExp(check));
    }
  });

  it('keeps the Checks block free of comments, which YAML would read as content', () => {
    const yaml = byAdd(planTool('tidy', {}, { cmake: true }), '.clang-tidy');
    const block = yaml.slice(yaml.indexOf('Checks: >'), yaml.indexOf('WarningsAsErrors'));
    assert.doesNotMatch(block, /#/);
  });

  it('wires an opt-in CLANG_TIDY option in at # jen:options, unless --cmake=false', () => {
    const actions = planTool('tidy', {}, { cmake: true });
    assert.match(byAdd(actions, 'cmake/tidy.cmake'), /CMAKE_CXX_CLANG_TIDY/);
    assert.deepEqual(inserts(actions), [{ insert: 'CMakeLists.txt', before: '# jen:options', line: 'include(cmake/tidy.cmake)' }]);
    assert.deepEqual(adds(planTool('tidy', { cmake: false })), ['.clang-tidy']);
  });
});

describe('cpp:format', () => {
  it('writes a .clang-format matching the generated style', () => {
    const yaml = byAdd(planTool('format', {}, { basedOn: 'Google', indent: '2', columnLimit: '120' }), '.clang-format');
    assert.match(yaml, /BasedOnStyle: Google/);
    assert.match(yaml, /IndentWidth: 2/);
    assert.match(yaml, /ColumnLimit: 120/);
  });
});

describe('cpp:presets', () => {
  it('writes valid JSON with debug, release, asan and ubsan presets', () => {
    const json = JSON.parse(byAdd(planTool('presets'), 'CMakePresets.json'));
    const names = json.configurePresets.map((p: { name: string }) => p.name);
    assert.deepEqual(names, ['base', 'debug', 'release', 'asan', 'ubsan']);
    assert.equal(json.configurePresets[0].binaryDir, '${sourceDir}/build/${presetName}');
    assert.match(json.configurePresets[3].cacheVariables.CMAKE_CXX_FLAGS, /-fsanitize=address/);
    assert.match(json.configurePresets[4].cacheVariables.CMAKE_CXX_FLAGS, /-fsanitize=undefined/);
    assert.deepEqual(json.buildPresets.map((p: { name: string }) => p.name), ['debug', 'release', 'asan', 'ubsan']);
  });
});

describe('cpp:warnings', () => {
  it('defines an INTERFACE target with GCC/Clang and MSVC flags, and links it via # jen:link', () => {
    const actions = planTool('warnings', {}, { werror: false });
    const cmake = byAdd(actions, 'cmake/warnings.cmake');
    assert.match(cmake, /add_library\(project_warnings INTERFACE\)/);
    assert.match(cmake, /-Wall -Wextra -Wpedantic -Wconversion -Wshadow>/);
    assert.match(cmake, /\/W4 \/permissive->/);
    assert.deepEqual(inserts(actions).map((i) => i.before), ['# jen:options', '# jen:link']);
  });

  it('--werror adds -Werror and /WX', () => {
    const cmake = byAdd(planTool('warnings', { werror: true }), 'cmake/warnings.cmake');
    assert.match(cmake, /-Werror>/);
    assert.match(cmake, /\/WX>/);
  });
});

describe('cpp:compiler', () => {
  const compiler = (answers: Record<string, string | boolean> = {}): Action[] => planTool('compiler', answers, { hardening: true });

  it('turns compiler extensions off and exports compile_commands.json', () => {
    const cmake = byAdd(compiler(), 'cmake/compiler.cmake');
    assert.match(cmake, /set\(CMAKE_CXX_EXTENSIONS OFF\)/);
    assert.match(cmake, /set\(CMAKE_CXX_STANDARD_REQUIRED ON\)/);
    assert.match(cmake, /set\(CMAKE_EXPORT_COMPILE_COMMANDS ON\)/);
  });

  it('maps warnings to the guideline they enforce', () => {
    const cmake = byAdd(compiler(), 'cmake/compiler.cmake');
    assert.match(cmake, /-Wnon-virtual-dtor\s+# C\.35/);
    assert.match(cmake, /-Wsuggest-override\s+# C\.128/);
    assert.match(cmake, /-Wold-style-cast\s+# ES\.49/);
    assert.match(cmake, /\/utf-8/);
  });

  it('adds hardening, which --hardening=false drops', () => {
    assert.match(byAdd(compiler(), 'cmake/compiler.cmake'), /_GLIBCXX_ASSERTIONS/);
    assert.match(byAdd(compiler(), 'cmake/compiler.cmake'), /-fstack-protector-strong/);
    assert.doesNotMatch(byAdd(compiler({ hardening: false }), 'cmake/compiler.cmake'), /_GLIBCXX_ASSERTIONS|stack-protector/);
  });

  it('links project_options privately into the core library via # jen:link', () => {
    assert.deepEqual(inserts(compiler()).map((i) => [i.insert, i.before, i.line]), [
      ['CMakeLists.txt', '# jen:options', 'include(cmake/compiler.cmake)'],
      ['src/CMakeLists.txt', '# jen:link', 'target_link_libraries(${PROJECT_NAME}-core PRIVATE project_options)'],
    ]);
  });
});

describe('cpp:doctest', () => {
  const actions = planTool('doctest', {}, { doctestTag: 'v2.4.12' });

  it('writes tests/ with a doctest main and a tests target linked against the core library', () => {
    assert.deepEqual(adds(actions), ['tests/CMakeLists.txt', 'tests/main.cpp']);
    assert.match(byAdd(actions, 'tests/main.cpp'), /DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN/);
    const cmake = byAdd(actions, 'tests/CMakeLists.txt');
    assert.match(cmake, /GIT_TAG v2\.4\.12/);
    assert.match(cmake, /target_link_libraries\(tests PRIVATE \$\{PROJECT_NAME\}-core doctest::doctest\)/);
    assert.match(cmake, /doctest_discover_tests\(tests\)/);
  });

  it('sets up the # jen:tests marker and enables testing from the root', () => {
    assert.match(byAdd(actions, 'tests/CMakeLists.txt'), /main\.cpp\n {2}# jen:tests/);
    assert.deepEqual(inserts(actions), [{ insert: 'CMakeLists.txt', before: '# jen:subdirs', line: 'enable_testing()\nadd_subdirectory(tests)' }]);
  });
});

describe('cpp:tracy', () => {
  const tracy = (answers: Record<string, string | boolean> = {}): Action[] =>
    planTool('tracy', answers, { gpu: false, file: 'src/app.cpp', tracyTag: 'v0.11.1' });

  it('adds a PROFILING option (default OFF) that drives TRACY_ENABLE, and links TracyClient', () => {
    const actions = tracy();
    const cmake = byAdd(actions, 'cmake/tracy.cmake');
    assert.match(cmake, /option\(PROFILING "Enable Tracy profiling" OFF\)/);
    assert.match(cmake, /set\(TRACY_ENABLE \$\{PROFILING\} CACHE BOOL/);
    assert.match(cmake, /GIT_TAG v0\.11\.1/);
    assert.ok(inserts(actions).some((i) => i.line.includes('Tracy::TracyClient') && i.before === '# jen:link'));
  });

  it('marks the frame end', () => {
    const app = inserts(tracy()).filter((i) => i.insert === 'src/app.cpp');
    assert.deepEqual(app.map((i) => [i.before, i.line]), [
      ['// jen:includes', '#include <tracy/Tracy.hpp>'],
      ['// jen:frame-end', 'FrameMark;'],
    ]);
  });

  it('--gpu adds the OpenGL context and collects before the frame mark', () => {
    const app = inserts(tracy({ gpu: true })).filter((i) => i.before.startsWith('//'));
    assert.ok(app.some((i) => i.before === '// jen:gl-init' && i.line === 'TracyGpuContext;'));
    const lines = app.filter((i) => i.before === '// jen:frame-end').map((i) => i.line);
    assert.deepEqual(lines, ['TracyGpuCollect;', 'FrameMark;']);
  });
});

describe('cpp:cpack', () => {
  const cpack = (answers: Record<string, string | boolean> = {}): Action[] =>
    planTool('cpack', answers, { assets: 'assets', staticSdl: false, bundleId: '', maintainer: '' });
  const install = (actions: Action[]): string => inserts(actions).find((i) => i.before === '# jen:install')?.line ?? '';

  it('installs the executable and assets at # jen:install, CPack settings at # jen:cpack', () => {
    const actions = cpack();
    assert.match(install(actions), /install\(TARGETS \$\{PROJECT_NAME\}/);
    assert.match(install(actions), /install\(DIRECTORY assets\/ DESTINATION/);
    const settings = inserts(actions).find((i) => i.before === '# jen:cpack')?.line ?? '';
    assert.match(settings, /"ZIP;NSIS"/);
    assert.match(settings, /"DragNDrop"/);
    assert.match(settings, /"TGZ;DEB"/);
    assert.match(settings, /include\(CPack\)/);
  });

  it('ships a shared SDL3 next to the executable, and sets an $ORIGIN RPATH', () => {
    const rules = install(cpack());
    assert.match(rules, /install\(IMPORTED_RUNTIME_ARTIFACTS SDL3::SDL3/);
    assert.match(rules, /\$ORIGIN\/\.\.\/\$\{CMAKE_INSTALL_LIBDIR\}/);
  });

  it('--staticSdl sets SDL_STATIC up front and skips the runtime install', () => {
    const actions = cpack({ staticSdl: true });
    assert.ok(inserts(actions).some((i) => i.before === '# jen:options' && i.line.includes('set(SDL_STATIC ON)')));
    assert.doesNotMatch(install(actions), /IMPORTED_RUNTIME_ARTIFACTS/);
  });

  it('reuses --bundleId for the macOS bundle, with an Info.plist template', () => {
    const actions = cpack({ bundleId: 'lgbt.lea.game' });
    assert.match(install(actions), /set\(BUNDLE_ID "lgbt\.lea\.game"\)/);
    assert.match(install(actions), /MACOSX_BUNDLE TRUE/);
    assert.match(byAdd(actions, 'cmake/Info.plist.in'), /\$\{MACOSX_BUNDLE_GUI_IDENTIFIER\}/);
  });
});

describe('cpp:embed', () => {
  const embed = (answers: Record<string, string>): Action[] =>
    planTool('embed', answers, { target: '', method: 'cmake' });

  it('ships the build-time embedding scripts and inserts embed_file() at # jen:embed', () => {
    const actions = embed({ file: 'assets/tiles.png', name: 'tiles-png' });
    assert.match(byAdd(actions, 'cmake/embed.cmake'), /function\(embed_file target file name\)/);
    assert.match(byAdd(actions, 'cmake/embed.cmake'), /add_custom_command/);
    assert.match(byAdd(actions, 'cmake/embed-file.cmake'), /file\(READ "\$\{IN\}" hex HEX\)/);
    assert.deepEqual(inserts(actions).map((i) => [i.before, i.line]), [
      ['# jen:embed', 'include(${PROJECT_SOURCE_DIR}/cmake/embed.cmake)'],
      ['# jen:embed', 'embed_file(${PROJECT_NAME}-core assets/tiles.png tilesPng)'],
    ]);
  });

  it('honors --target', () => {
    const actions = embed({ file: 'a.bin', name: 'blob', target: 'editor' });
    assert.ok(inserts(actions).some((i) => i.line === 'embed_file(editor a.bin blob)'));
  });

  it('only supports --method=cmake for now', () => {
    assert.throws(() => embed({ file: 'a.bin', name: 'blob', method: 'embed' }), /--method/);
  });
});

describe('cpp:icon', () => {
  it('writes a .rc next to the icon and wires the Windows and macOS icons in at # jen:app', () => {
    const actions = planTool('icon', {}, { ico: 'resources/app.ico', icns: 'resources/app.icns' });
    assert.equal(byAdd(actions, 'resources/app.rc'), 'IDI_ICON1 ICON "app.ico"\n');
    const [cmake] = inserts(actions);
    assert.equal(cmake.before, '# jen:app');
    assert.match(cmake.line, /if\(WIN32\)/);
    assert.match(cmake.line, /MACOSX_PACKAGE_LOCATION Resources/);
    assert.match(cmake.line, /MACOSX_BUNDLE_ICON_FILE app\.icns/);
  });
});

// ─── more starters ──────────────────────────────────────────────────────────

describe('cpp:app', () => {
  const actions = pack.app.actions({ name: 'MyTool', folderCase: 'kebab', dir: '.' }, helpers);

  it('has a core library and a thin executable, without SDL or vendor/', () => {
    assert.deepEqual(adds(actions), ['CMakeLists.txt', 'src/CMakeLists.txt', 'src/main.cpp', 'src/app.h', 'src/app.cpp']);
    const cmake = byAdd(actions, 'src/CMakeLists.txt');
    assert.match(cmake, /add_library\(my-tool-core\)/);
    assert.match(cmake, /add_executable\(my-tool main\.cpp\)/);
    assert.doesNotMatch(cmake, /SDL3/);
    assert.doesNotMatch(byAdd(actions, 'CMakeLists.txt'), /add_subdirectory\(vendor\)/);
  });

  it('wraps argv in a span instead of doing pointer arithmetic', () => {
    assert.match(byAdd(actions, 'src/main.cpp'), /std::span<char\* const> args\{argv, static_cast<std::size_t>\(argc\)\}/);
  });

  it('leaves the markers', () => {
    for (const marker of ['# jen:sources', '# jen:link', '# jen:embed', '# jen:app']) assert.match(byAdd(actions, 'src/CMakeLists.txt'), new RegExp(marker));
  });
});

describe('cpp:lib', () => {
  const actions = pack.lib.actions({ name: 'MyLib', folderCase: 'kebab', dir: '.' }, helpers);

  it('puts the public header in include/<name>/ with an export header', () => {
    assert.deepEqual(adds(actions), [
      'CMakeLists.txt',
      'src/CMakeLists.txt',
      'include/my-lib/my-lib.h',
      'src/my-lib.cpp',
      'cmake/my-libConfig.cmake.in',
    ]);
    assert.match(byAdd(actions, 'include/my-lib/my-lib.h'), /MY_LIB_EXPORT std::string_view version\(\) noexcept;/);
    assert.match(byAdd(actions, 'src/CMakeLists.txt'), /generate_export_header\(my-lib-core/);
  });

  it('uses BUILD_INTERFACE/INSTALL_INTERFACE and exports <name>::<name> from the core target', () => {
    const src = byAdd(actions, 'src/CMakeLists.txt');
    assert.match(src, /\$<BUILD_INTERFACE:/);
    assert.match(src, /\$<INSTALL_INTERFACE:/);
    assert.match(src, /EXPORT_NAME my-lib/);
    const root = byAdd(actions, 'CMakeLists.txt');
    assert.match(root, /NAMESPACE my-lib::/);
    assert.match(root, /write_basic_package_version_file/);
  });
});

describe('cpp:module', () => {
  const actions = pack.module.actions({ name: 'MyMod', folderCase: 'kebab', dir: '.' }, helpers);

  it('requires CMake 3.28 and puts the .cppm in a CXX_MODULES file set', () => {
    assert.match(byAdd(actions, 'CMakeLists.txt'), /cmake_minimum_required\(VERSION 3\.28\)/);
    assert.match(byAdd(actions, 'src/CMakeLists.txt'), /FILE_SET CXX_MODULES FILES\n {2}my_mod\.cppm/);
  });

  it('exports a module that main.cpp imports', () => {
    assert.match(byAdd(actions, 'src/my_mod.cppm'), /export module my_mod;/);
    assert.match(byAdd(actions, 'src/main.cpp'), /import my_mod;/);
  });
});

