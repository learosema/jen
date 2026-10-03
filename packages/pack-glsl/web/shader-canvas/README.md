# `<shader-canvas>`

A dependency-free WebGL2 element for prototyping GLSL shaders: one script, no build step, no framework.

```html
<script src="shader-canvas.js" defer></script>

<shader-canvas src="shaders/clouds.frag.glsl" live></shader-canvas>
```

Part of [@codejen/pack-glsl](../../README.md): `jen glsl:webgl --name=Clouds` sets up a page with it. You can also just copy [shader-canvas.js](shader-canvas.js) into your project.

## Getting started

Point `src` at a fragment shader, or put the shader inside the element:

```html
<shader-canvas>
  <script type="x-shader/x-fragment">
    #version 300 es
    precision highp float;

    uniform float uTime;
    uniform vec2 uResolution;
    out vec4 fragColor;

    void main() {
      vec2 uv = gl_FragCoord.xy / uResolution;
      fragColor = vec4(uv, 0.5 + 0.5 * sin(uTime), 1.0);
    }
  </script>
</shader-canvas>
```

Inline shaders work when the page is opened straight from disk. Shader files loaded via `src` need any static web server, e.g. `npx serve` or `python3 -m http.server`, because browsers don't fetch from `file://`.

The element is a classic script rather than a module, for the same reason: browsers refuse module scripts from `file://`. It still works as `import './shader-canvas.js'`, and it never adds globals. If you need the class, it's `customElements.get('shader-canvas')`.

By default the element is a block with a 16:9 aspect ratio. Size it with CSS like any other block, e.g. `shader-canvas { position: fixed; inset: 0; aspect-ratio: auto; }` for full-screen.

## Attributes

- **`src`**: URL of the fragment shader. Without it, an inline `<script type="x-shader/x-fragment">` child is used.
- **`vert`**: URL of the vertex shader. Without it, an inline `<script type="x-shader/x-vertex">` child is used, or else a built-in full-screen quad that passes `vUV`.
- **`mesh`**: What gets drawn: `quad` (default, full-screen), `plane` (a 2×2 plane facing the camera) or `sphere` (unit sphere).
- **`detail`**: Subdivisions of `plane` and `sphere`, default `32`.
- **`orbit`**: Drag to rotate the mesh. Without it, the pointer only feeds `uMouse`.
- **`texture0` … `texture3`**: Image URLs, bound to `uTexture0` … `uTexture3`. Textures repeat and are mipmapped; the image's bottom-left is UV `(0, 0)`.
- **`live`**: Re-fetches `src` and `vert` every second and recompiles when they change, while the element is visible.
- **`max-dpr`**: Caps the device pixel ratio, default `2`.

All attributes can change at runtime.

## Uniforms

Set whenever the shader declares them:

- **`float uTime`**: Seconds since start. Doesn't advance while the element is offscreen or paused.
- **`vec2 uResolution`**: Size of the drawing buffer in pixels.
- **`vec2 uMouse`**: Pointer position in pixels, origin bottom-left (same space as `gl_FragCoord`).
- **`mat4 uModel`, `mat4 uView`, `mat4 uProjection`**: For `plane` and `sphere`: the orbit rotation, a camera 3 units away, and a 45° perspective.
- **`sampler2D uTexture0` … `uTexture3`**: The textures from `texture0` … `texture3`.

## Vertex attributes

The `quad` feeds `vec2 aPos` at location 0. `plane` and `sphere` feed `vec3 aPosition` (location 0), `vec3 aNormal` (1) and `vec2 aUV` (2). These match the starters from `jen glsl:vert --kind=quad|mesh`:

```html
<shader-canvas mesh="sphere" detail="64" vert="shaders/blob.vert.glsl" src="shaders/blob.frag.glsl" orbit></shader-canvas>
```

## Desktop shaders

Shaders written for desktop OpenGL (`#version 330 core`, `#version 410 core`) run unchanged: the element swaps the header for `#version 300 es` plus default precisions. So the same file works in the browser and in a C++ host like `jen cpp:sdl3-opengl`, as long as it sticks to what both dialects support.

## Errors

Compile and link errors are shown over the canvas, each with the offending source line. Line numbers are those of your file, even when the header was rewritten. On an error, the last working shader stays in place below the overlay.

## Script API

- **`play()`**: Starts animating, also after `prefers-reduced-motion` paused it.
- **`pause()`**: Stops animating; the current frame stays.
- **`shader-compiled` event**: Fired after a successful compile, including every live reload.
- **`shader-error` event**: Fired on load, compile and link errors. `event.detail.log` holds the message as shown in the overlay.

Inline shaders compile right after the element is defined, so add your listeners before loading the script.

## Accessibility and performance

With `prefers-reduced-motion: reduce`, a single frame is rendered and nothing animates until `play()` is called. Rendering stops while the element is offscreen or the tab is hidden, and live reload polling pauses too. The WebGL context is only created once the element comes within a screen of the viewport, and dropped again when it's further away, so a page can hold many previews: browsers only keep around 16 contexts alive (fewer on phones) and drop the oldest for good. Coming back creates a fresh context right away. If the browser drops the context of a visible element anyway, it starts over once.

## License

[MIT-0](../../LICENSE) © Lea Rosema: use it however you like, no attribution required.
