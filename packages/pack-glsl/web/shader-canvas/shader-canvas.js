// <shader-canvas> · https://github.com/learosema/jen/tree/main/packages/pack-glsl/web/shader-canvas
// A classic script (no exports, no globals) so it also loads from file://.

(() => {
  'use strict';

  /** The element name; `jen glsl:webgl --tag=…` rewrites this line. */
  const TAG = 'shader-canvas';

  const QUAD_VERT = `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

  const FALLBACK_FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;
void main() { fragColor = vec4(0.0); }
`;

  const STYLE = `
:host { display: block; position: relative; aspect-ratio: 16 / 9; contain: content; }
canvas { display: block; inline-size: 100%; block-size: 100%; touch-action: none; }
:host([orbit]) canvas { cursor: grab; }
pre {
  position: absolute; inset: 0; margin: 0; padding: 1em; overflow: auto;
  font: 0.75rem/1.5 ui-monospace, monospace; white-space: pre-wrap;
  color: #ffd7d7; background: rgb(40 0 0 / 0.88);
}
pre[hidden] { display: none; }
mark { color: inherit; background: rgb(255 80 80 / 0.35); }
button {
  position: absolute; inset-block-end: 1em; inset-inline-start: 50%; translate: -50% 0;
  padding: 0.5em 1.2em; border: thin solid rgb(255 255 255 / 0.6); border-radius: 100vmax;
  font: 0.875rem/1.2 system-ui, sans-serif; color: #fff; background: rgb(0 0 0 / 0.6); cursor: pointer;
}
button[hidden] { display: none; }
`;

  /** texture0 values that are videos rather than images. */
  const VIDEO = /\.(?:mp4|webm|ogv|mov|m4v)(?:[?#].*)?$/i;

  const ES_HEADER = ['#version 300 es', 'precision highp float;', 'precision highp int;'];

  /**
   * Turns any GLSL 3.30/4.10/ES 3.00 source into WebGL2-compilable ES 3.00 by
   * rewriting the header. Returns the source and how many lines were added
   * before the original line 2, so error line numbers can be mapped back.
   */
  function toES(source) {
    const lines = source.replace(/^\s+/, '').split('\n');
    if (!/^#version/.test(lines[0])) return { code: [...ES_HEADER, ...lines].join('\n'), offset: ES_HEADER.length };
    if (/^#version\s+300\s+es/.test(lines[0])) return { code: lines.join('\n'), offset: 0 };
    const hasFloatPrecision = lines.some((l) => /^\s*precision\s+\w+\s+float\s*;/.test(l));
    const header = hasFloatPrecision ? ES_HEADER.slice(0, 1) : ES_HEADER;
    return { code: [...header, ...lines.slice(1)].join('\n'), offset: header.length - 1 };
  }

  // ─── Small matrix helpers (column-major, like GLSL) ─────────────────────────

  function perspective(fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2);
    const nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  }

  function rotationYX(yaw, pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // Ry(yaw) * Rx(pitch)
    return [cy, 0, -sy, 0, sy * sp, cp, cy * sp, 0, sy * cp, -sp, cy * cp, 0, 0, 0, 0, 1];
  }

  const translationZ = (z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, z, 1];

  // ─── Meshes ─────────────────────────────────────────────────────────────────

  /** texture0="test-pattern": color bars, a gray ramp, a grid, a circle and fine stripes, to try filters on. */
  function testPattern() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#202024';
    g.fillRect(0, 0, size, size);
    const bars = ['#bfbfbf', '#bfbf00', '#00bfbf', '#00bf00', '#bf00bf', '#bf0000', '#0000bf'];
    bars.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect((i * size) / 7, 0, size / 7 + 1, 0.45 * size);
    });
    for (let i = 0; i < 16; i++) {
      const v = Math.round((255 * i) / 15);
      g.fillStyle = `rgb(${v} ${v} ${v})`;
      g.fillRect((i * size) / 16, 0.45 * size, size / 16 + 1, 0.2 * size);
    }
    for (let x = 0; x < size / 2; x += 4) {
      g.fillStyle = '#fff';
      g.fillRect(x, 0.8 * size, 2, 0.2 * size);
    }
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        g.fillStyle = (x + y) % 2 ? '#fff' : '#000';
        g.fillRect(size / 2 + x * 32, 0.8 * size + y * 13, 32, 13);
      }
    }
    g.strokeStyle = 'rgb(255 255 255 / 0.35)';
    g.lineWidth = 1;
    for (let p = 32; p < size; p += 32) {
      g.beginPath();
      g.moveTo(p + 0.5, 0);
      g.lineTo(p + 0.5, size);
      g.moveTo(0, p + 0.5);
      g.lineTo(size, p + 0.5);
      g.stroke();
    }
    g.strokeStyle = '#fff';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(size / 2, 0.45 * size, 0.3 * size, 0, 2 * Math.PI);
    g.stroke();
    return canvas;
  }

  function quadMesh() {
    return { attribs: [{ size: 2, data: [-1, -1, 1, -1, -1, 1, 1, 1] }], indices: [0, 1, 2, 2, 1, 3] };
  }

  /** A 2×2 plane in XY facing +Z, `n`×`n` quads. */
  function planeMesh(n) {
    const pos = [], nrm = [], uv = [], idx = [];
    for (let y = 0; y <= n; y++) {
      for (let x = 0; x <= n; x++) {
        const u = x / n, v = y / n;
        pos.push(u * 2 - 1, v * 2 - 1, 0);
        nrm.push(0, 0, 1);
        uv.push(u, v);
      }
    }
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * (n + 1) + x;
        idx.push(i, i + 1, i + n + 1, i + n + 1, i + 1, i + n + 2);
      }
    }
    return { attribs: [{ size: 3, data: pos }, { size: 3, data: nrm }, { size: 2, data: uv }], indices: idx };
  }

  /** A unit UV sphere with `n` latitude and 2·`n` longitude segments. */
  function sphereMesh(n) {
    const pos = [], uv = [], idx = [];
    const lon = 2 * n;
    for (let y = 0; y <= n; y++) {
      const theta = (y / n) * Math.PI;
      for (let x = 0; x <= lon; x++) {
        const phi = (x / lon) * 2 * Math.PI;
        pos.push(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi));
        uv.push(x / lon, 1 - y / n);
      }
    }
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < lon; x++) {
        const i = y * (lon + 1) + x;
        idx.push(i, i + lon + 1, i + 1, i + 1, i + lon + 1, i + lon + 2);
      }
    }
    return { attribs: [{ size: 3, data: pos }, { size: 3, data: pos }, { size: 2, data: uv }], indices: idx };
  }

  // ─── The element ────────────────────────────────────────────────────────────

  class ShaderCanvas extends HTMLElement {
    static observedAttributes = ['src', 'vert', 'post', 'mesh', 'detail', 'texture0', 'texture1', 'texture2', 'texture3', 'live', 'time'];

    #canvas;
    #overlay;
    #gl = null;
    #program = null;
    #uniforms = new Map();
    #posts = [];  // post passes: { program, uniforms }, each reading the previous image as uPrevious
    #targets = [];  // { framebuffer, texture, width, height }: where every pass but the last draws
    #quad = null;  // post passes always cover the canvas, whatever mesh the scene uses
    #floatTargets = false;
    #mesh = null;
    #textures = [];
    #media = [];  // per unit: { url, video, stream } – outlives the GL context
    #cameraButton;
    #seekTargets = new WeakMap();  // video → the still time it was last sent to
    #sources = { frag: '', vert: '', post: [] };
    #frame = 0;
    #time = 0;
    #lastTick = 0;
    #playing = true;
    #visible = true;
    #loseContext = null;
    #canvasUsed = false;
    #near = false;
    #recovered = false;
    #mouse = [0, 0];
    #rotation = [0, 0];
    #drag = null;
    #pollTimer = 0;
    #observers = [];
    #loadToken = 0;

    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>${STYLE}</style><canvas part="canvas"></canvas><pre part="error" role="alert" hidden></pre><button part="camera" type="button" hidden>Use camera</button>`;
      this.#canvas = root.querySelector('canvas');
      this.#overlay = root.querySelector('pre');
      this.#cameraButton = root.querySelector('button');
      this.#cameraButton.addEventListener('click', () => this.#startCamera());
    }

    connectedCallback() {
      const resize = new ResizeObserver(() => this.#resize());
      resize.observe(this);
      const intersect = new IntersectionObserver(([entry]) => {
        this.#visible = entry.isIntersecting;
        this.#schedule();
      });
      intersect.observe(this);
      // Browsers only keep around 16 WebGL contexts alive (fewer on phones)
      // and drop the oldest for good, so a page full of previews would go
      // blank. So the context is only created once the element comes within
      // a screen of the viewport, and dropped when it's further away again;
      // coming back creates a fresh one (restoreContext() would be async and
      // slow). Shaders load right away either way.
      const nearby = new IntersectionObserver((entries) => this.#setNearby(entries[entries.length - 1].isIntersecting), {
        rootMargin: '100% 0%',
      });
      nearby.observe(this);
      this.#observers = [resize, intersect, nearby];
      addEventListener('hashchange', this.#onHashChange);

      const motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.#playing = !motion.matches;

      this.#listen(this.#canvas);
      this.#resize();
      this.#reload();
    }

    disconnectedCallback() {
      cancelAnimationFrame(this.#frame);
      this.#frame = 0;
      clearInterval(this.#pollTimer);
      this.#pollTimer = 0;
      for (const o of this.#observers) o.disconnect();
      this.#observers = [];
      removeEventListener('hashchange', this.#onHashChange);
      // the camera goes off with the element; videos just pause
      for (const media of this.#media) {
        media?.stream?.getTracks().forEach((track) => track.stop());
        media?.video.pause();
      }
      this.#media = [];
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (!this.isConnected || oldValue === newValue) return;
      if (name === 'live') this.#setupPolling();
      if (name === 'src' || name === 'vert' || name === 'post') this.#reload();
      // Without a context yet, #initGL() picks up the current mesh and textures.
      if (!this.#gl || this.#gl.isContextLost()) return;
      if (name.startsWith('texture')) this.#loadTexture(Number(name.slice(-1)));
      else if (name === 'mesh' || name === 'detail') this.#buildMesh();
      this.#schedule();
    }

    /** Starts animating (also after prefers-reduced-motion paused it). */
    play() {
      this.#playing = true;
      this.#schedule();
    }

    /** Stops animating; the current frame stays. */
    pause() {
      this.#playing = false;
    }

    // ─── GL setup ───────────────────────────────────────────────────────────

    #listen(canvas) {
      canvas.addEventListener('pointermove', this.#onPointerMove);
      canvas.addEventListener('pointerdown', this.#onPointerDown);
      canvas.addEventListener('pointerup', this.#onPointerUp);
      canvas.addEventListener('pointercancel', this.#onPointerUp);
      canvas.addEventListener('webglcontextlost', this.#onContextLost);
      canvas.addEventListener('webglcontextrestored', this.#onContextRestored);
    }

    #initGL() {
      const gl = this.#canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: true });
      if (!gl) {
        this.#showError('WebGL2 is not available in this browser.');
        return false;
      }
      this.#gl = gl;
      this.#canvasUsed = true;
      this.#loseContext = gl.getExtension('WEBGL_lose_context');
      // float targets keep HDR between passes, where the browser can render to them
      this.#floatTargets = !!gl.getExtension('EXT_color_buffer_float');
      this.#buildMesh();
      for (let i = 0; i < 4; i++) this.#loadTexture(i);
      return true;
    }

    #buildMesh() {
      const gl = this.#gl;
      if (this.#mesh) {
        gl.deleteVertexArray(this.#mesh.vao);
        for (const b of this.#mesh.buffers) gl.deleteBuffer(b);
      }
      const kind = this.getAttribute('mesh') || 'quad';
      const detail = Math.max(1, Math.min(512, Number(this.getAttribute('detail')) || 32));
      const data = kind === 'plane' ? planeMesh(detail) : kind === 'sphere' ? sphereMesh(detail) : quadMesh();

      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const buffers = data.attribs.map((attrib, location) => {
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(attrib.data), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, attrib.size, gl.FLOAT, false, 0, 0);
        return buffer;
      });
      const indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(data.indices), gl.STATIC_DRAW);
      gl.bindVertexArray(null);

      this.#mesh = { kind, vao, buffers: [...buffers, indexBuffer], count: data.indices.length };
    }

    #loadTexture(unit) {
      const gl = this.#gl;
      if (this.#textures[unit]) gl.deleteTexture(this.#textures[unit]);
      const texture = gl.createTexture();
      this.#textures[unit] = texture;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));

      const url = this.getAttribute(`texture${unit}`);
      if (url === 'camera' || VIDEO.test(url ?? '')) {
        this.#useMedia(unit, url);
        return;
      }
      this.#forgetMedia(unit);
      if (!url) return;
      if (url === 'test-pattern') {
        this.#upload(unit, texture, testPattern());
        return;
      }
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => this.#upload(unit, texture, image);
      image.onerror = () => this.#textureError(unit, url);
      image.src = new URL(url, document.baseURI).href;
    }

    /** texture<unit> from a video file or the camera; #draw() uploads its frames. */
    #useMedia(unit, url) {
      if (this.#media[unit]?.url === url) return;  // kept across a lost context
      this.#forgetMedia(unit);
      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      video.preload = 'auto';
      // metadata lets a still frame seek; the first frame and seeks redraw a still or paused element
      for (const type of ['loadedmetadata', 'loadeddata', 'seeked']) video.addEventListener(type, () => this.#schedule());
      this.#media[unit] = { url, video, stream: null };
      if (url === 'camera') {
        // a click first: browsers want one, and no page should ask for the camera just by opening
        this.#cameraButton.hidden = false;
        return;
      }
      video.addEventListener('error', () => this.#textureError(unit, url));
      video.src = new URL(url, document.baseURI).href;
      this.#syncVideo(video);
    }

    #textureError(unit, url) {
      // a page opened from disk: browsers give each file its own origin, and WebGL may not read across origins
      const why = location.protocol === 'file:'
        ? ' – browsers don\'t let WebGL read images or videos on a page opened from disk: serve the folder (e.g. npx serve), or use texture0="test-pattern" or "camera"'
        : '';
      this.#showError(`Could not load texture${unit}: ${url}${why}`);
    }

    async #startCamera() {
      this.#cameraButton.hidden = true;
      if (!navigator.mediaDevices?.getUserMedia) {
        this.#showError('Camera: not available here – it needs https:// or localhost.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const users = this.#media.filter((media) => media?.url === 'camera');
        if (users.length === 0) return stream.getTracks().forEach((track) => track.stop());
        for (const media of users) {
          media.stream = stream;
          media.video.srcObject = stream;
          this.#syncVideo(media.video);
        }
      } catch (error) {
        const why = error.name === 'NotAllowedError' ? 'permission denied' : error.name === 'NotFoundError' ? 'no camera found' : error.message;
        this.#showError(`Camera: ${why}`);
        this.#cameraButton.hidden = false;
      }
    }

    #forgetMedia(unit) {
      const media = this.#media[unit];
      if (!media) return;
      this.#media[unit] = undefined;
      const shared = this.#media.some((other) => other?.stream && other.stream === media.stream);
      if (media.stream && !shared) media.stream.getTracks().forEach((track) => track.stop());
      media.video.pause();
      media.video.srcObject = null;
      media.video.removeAttribute('src');
      this.#cameraButton.hidden = !this.#media.some((other) => other?.url === 'camera' && !other.stream);
    }

    /** Plays while the element animates; a still frame seeks to its time instead. */
    #syncVideo(video) {
      const still = this.#stillTime();
      if (still !== null) {
        if (!video.paused) video.pause();
        const at = Number.isFinite(video.duration) && video.duration > 0 ? still % video.duration : still;
        // once per target: a seek past the end lands elsewhere, and its 'seeked' would seek again
        if (!video.srcObject && video.readyState >= 1 && this.#seekTargets.get(video) !== at) {
          this.#seekTargets.set(video, at);
          video.currentTime = at;
        }
      } else if (this.#playing && this.#visible) {
        if (video.paused) video.play().catch(() => {});
      } else if (!video.paused) {
        video.pause();
      }
    }

    #upload(unit, texture, source) {
      const gl = this.#gl;
      if (this.#textures[unit] !== texture || !gl) return;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      this.#schedule();
    }

    // ─── Sources ────────────────────────────────────────────────────────────

    #inline(type) {
      const script = this.querySelector(`script[type="x-shader/x-${type}"]`);
      return script ? script.textContent : null;
    }

    /** The post passes: post="a.glsl b.glsl", or every fragment script after the first. */
    #postSources() {
      const urls = (this.getAttribute('post') ?? '').split(/\s+/).filter(Boolean);
      if (urls.length) return Promise.all(urls.map((url) => this.#fetchSource(url)));
      return [...this.querySelectorAll('script[type="x-shader/x-fragment"]')].slice(1).map((script) => script.textContent);
    }

    async #fetchSource(url) {
      const response = await fetch(new URL(url, document.baseURI), { cache: 'no-cache' });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
      return response.text();
    }

    /** Loads both stages; with `force` false, only recompiles if something changed. */
    async #reload(force = true) {
      const token = ++this.#loadToken;
      const src = this.getAttribute('src');
      const vert = this.getAttribute('vert');
      let frag, vertex, post;
      try {
        [frag, vertex, post] = await Promise.all([
          src ? this.#fetchSource(src) : this.#inline('fragment'),
          vert ? this.#fetchSource(vert) : this.#inline('vertex'),
          this.#postSources(),
        ]);
      } catch (error) {
        if (token === this.#loadToken) this.#showError(`Could not load shader – ${error.message}`);
        return;
      }
      if (token !== this.#loadToken) return;
      frag ??= FALLBACK_FRAG;
      vertex ??= QUAD_VERT;
      const same = frag === this.#sources.frag && vertex === this.#sources.vert && post.join('\0') === this.#sources.post.join('\0');
      if (!force && same) return;
      this.#sources = { frag, vert: vertex, post };
      this.#compile();
      this.#setupPolling();
    }

    #setupPolling() {
      clearInterval(this.#pollTimer);
      this.#pollTimer = 0;
      const remote = this.hasAttribute('src') || this.hasAttribute('vert') || this.hasAttribute('post');
      if (this.hasAttribute('live') && remote && this.isConnected) {
        this.#pollTimer = setInterval(() => {
          if (this.#visible && !document.hidden) this.#reload(false);
        }, 1000);
      }
    }

    // ─── Compiling ──────────────────────────────────────────────────────────

    #compileStage(type, label, source) {
      const gl = this.#gl;
      const { code, offset } = toES(source);
      const shader = gl.createShader(type);
      gl.shaderSource(shader, code);
      gl.compileShader(shader);
      if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return { shader };
      const log = gl.getShaderInfoLog(shader) || 'unknown compile error';
      gl.deleteShader(shader);
      return { error: { label, log, source, offset } };
    }

    /** A linked program and its uniform locations, or { errors } (compile errors) / { linkError }. */
    #link(vertSource, fragSource, label) {
      const gl = this.#gl;
      const vs = this.#compileStage(gl.VERTEX_SHADER, 'vertex shader', vertSource);
      const fs = this.#compileStage(gl.FRAGMENT_SHADER, label, fragSource);
      const errors = [vs.error, fs.error].filter(Boolean);
      if (errors.length) {
        if (vs.shader) gl.deleteShader(vs.shader);
        if (fs.shader) gl.deleteShader(fs.shader);
        return { errors };
      }
      const program = gl.createProgram();
      gl.attachShader(program, vs.shader);
      gl.attachShader(program, fs.shader);
      gl.linkProgram(program);
      gl.deleteShader(vs.shader);
      gl.deleteShader(fs.shader);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const linkError = gl.getProgramInfoLog(program) || 'unknown link error';
        gl.deleteProgram(program);
        return { linkError };
      }
      const uniforms = new Map();
      const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < count; i++) {
        const name = gl.getActiveUniform(program, i).name;
        uniforms.set(name, gl.getUniformLocation(program, name));
      }
      return { program, uniforms };
    }

    #compile() {
      const gl = this.#gl;
      // No context yet, or dropped: compiling now would only report bogus
      // errors. #freshContext() compiles once there is one.
      if (!gl || gl.isContextLost() || !this.#sources.frag) return;
      const passes = [
        this.#link(this.#sources.vert, this.#sources.frag, 'fragment shader'),
        ...this.#sources.post.map((source, i) => this.#link(QUAD_VERT, source, `post pass ${i + 1}`)),
      ];
      const errors = passes.flatMap((pass) => pass.errors ?? []);
      const linkError = passes.find((pass) => pass.linkError)?.linkError;
      if (errors.length || linkError) {
        for (const pass of passes) if (pass.program) gl.deleteProgram(pass.program);
        if (errors.length) this.#reportCompileErrors(errors);
        else {
          this.#showError(`Link error:\n${linkError}`);
        }
        return;
      }

      if (this.#program) gl.deleteProgram(this.#program);
      for (const pass of this.#posts) gl.deleteProgram(pass.program);
      [{ program: this.#program, uniforms: this.#uniforms }, ...this.#posts] = passes;
      this.#hideError();
      this.dispatchEvent(new CustomEvent('shader-compiled'));
      this.#draw();
      this.#schedule();
    }

    #reportCompileErrors(errors) {
      const escape = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
      const parts = errors.map(({ label, log, source, offset }) => {
        const lines = source.replace(/^\s+/, '').split('\n');
        const out = [];
        for (const raw of log.trim().split('\n')) {
          const m = /^(ERROR|WARNING):\s*\d+:(\d+):\s*(.*)$/.exec(raw);
          if (!m) {
            out.push(escape(raw));
            continue;
          }
          // Lines after the (rewritten) #version line moved by `offset`.
          const reported = Number(m[2]);
          const line = reported > 1 ? reported - offset : reported;
          out.push(`${m[1]} line ${line}: ${escape(m[3])}`);
          if (lines[line - 1] !== undefined) out.push(`  <mark>${escape(lines[line - 1].trim())}</mark>`);
        }
        return `${label}:\n${out.join('\n')}`;
      });
      this.#overlay.innerHTML = parts.join('\n\n');
      this.#overlay.hidden = false;
      // The overlay's text: line numbers already mapped back to the original file.
      this.dispatchEvent(new CustomEvent('shader-error', { detail: { log: this.#overlay.textContent } }));
    }

    #showError(message) {
      this.#overlay.textContent = message;
      this.#overlay.hidden = false;
      this.dispatchEvent(new CustomEvent('shader-error', { detail: { log: message } }));
    }

    #hideError() {
      this.#overlay.hidden = true;
      this.#overlay.textContent = '';
    }

    // ─── Rendering ──────────────────────────────────────────────────────────

    #resize() {
      const maxDpr = Number(this.getAttribute('max-dpr')) || 2;
      const dpr = Math.min(devicePixelRatio || 1, maxDpr);
      const width = Math.max(1, Math.round(this.clientWidth * dpr));
      const height = Math.max(1, Math.round(this.clientHeight * dpr));
      if (this.#canvas.width !== width || this.#canvas.height !== height) {
        this.#canvas.width = width;
        this.#canvas.height = height;
        this.#draw();
      }
    }

    /** A still frame's time: `#t=12.5` in the page's URL, else the `time` attribute; null to animate. */
    #stillTime() {
      const hash = /(?:^#|&)t=(\d+(?:\.\d+)?)(?:&|$)/.exec(location.hash);
      const value = hash ? hash[1] : this.getAttribute('time');
      return value !== null && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
    }

    #onHashChange = () => this.#schedule();

    #schedule() {
      for (const media of this.#media) if (media) this.#syncVideo(media.video);
      if (this.#frame || !this.#gl || !this.#program) return;
      const still = this.#stillTime();
      if (still !== null) {
        this.#time = still;
        this.#lastTick = 0;
        this.#draw();
        return;
      }
      if (!this.#playing || !this.#visible) {
        this.#lastTick = 0;
        return;
      }
      this.#frame = requestAnimationFrame(this.#tick);
    }

    #tick = (now) => {
      this.#frame = 0;
      if (this.#lastTick) this.#time += (now - this.#lastTick) / 1000;
      this.#lastTick = now;
      this.#draw();
      this.#schedule();
    };

    #draw() {
      const gl = this.#gl;
      if (!gl || !this.#program || gl.isContextLost()) return;
      const { width, height } = this.#canvas;
      for (let i = 0; i < 4; i++) {
        const video = this.#media[i]?.video;
        if (video && video.readyState >= 2 && this.#textures[i]) {
          gl.activeTexture(gl.TEXTURE0 + i);
          gl.bindTexture(gl.TEXTURE_2D, this.#textures[i]);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          // a new frame every draw: no mipmaps, and no wrapping into the other edge
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
      }
      // the scene, then each post pass on the image before it; only the last one draws to the canvas
      const passes = [{ program: this.#program, uniforms: this.#uniforms, mesh: this.#mesh }, ...this.#posts.map((pass) => ({ ...pass, mesh: this.#quadMesh() }))];
      this.#ensureTargets(passes.length - 1, width, height);
      passes.forEach((pass, i) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, i < passes.length - 1 ? this.#targets[i].framebuffer : null);
        this.#drawPass(pass, width, height, i > 0 ? this.#targets[i - 1].texture : null);
      });
    }

    #drawPass({ program, uniforms, mesh }, width, height, previous) {
      const gl = this.#gl;
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);

      const set = (name, fn) => uniforms.has(name) && fn(uniforms.get(name));
      set('uTime', (l) => gl.uniform1f(l, this.#time));
      set('uResolution', (l) => gl.uniform2f(l, width, height));
      set('uMouse', (l) => gl.uniform2f(l, this.#mouse[0], this.#mouse[1]));
      for (let i = 0; i < 4; i++) {
        set(`uTexture${i}`, (l) => {
          gl.activeTexture(gl.TEXTURE0 + i);
          gl.bindTexture(gl.TEXTURE_2D, this.#textures[i]);
          gl.uniform1i(l, i);
        });
      }
      // unit 4: the previous pass's image
      set('uPrevious', (l) => {
        gl.activeTexture(gl.TEXTURE0 + 4);
        gl.bindTexture(gl.TEXTURE_2D, previous);
        gl.uniform1i(l, 4);
      });

      if (mesh.kind !== 'quad') {
        gl.enable(gl.DEPTH_TEST);
        set('uModel', (l) => gl.uniformMatrix4fv(l, false, rotationYX(this.#rotation[0], this.#rotation[1])));
        set('uView', (l) => gl.uniformMatrix4fv(l, false, translationZ(-3)));
        set('uProjection', (l) => gl.uniformMatrix4fv(l, false, perspective(Math.PI / 4, width / height, 0.1, 100)));
      } else {
        gl.disable(gl.DEPTH_TEST);
      }

      gl.bindVertexArray(mesh.vao);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
    }

    /** The full-canvas quad for post passes – the scene's own mesh when that is the quad. */
    #quadMesh() {
      if (this.#mesh.kind === 'quad') return this.#mesh;
      if (this.#quad) return this.#quad;
      const gl = this.#gl;
      const data = quadMesh();
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.attribs[0].data), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, data.attribs[0].size, gl.FLOAT, false, 0, 0);
      const indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(data.indices), gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      this.#quad = { kind: 'quad', vao, buffers: [buffer, indexBuffer], count: data.indices.length };
      return this.#quad;
    }

    /** `count` canvas-sized textures to draw into, kept until the size or count changes. */
    #ensureTargets(count, width, height) {
      const gl = this.#gl;
      if (this.#targets.length === count && this.#targets.every((t) => t.width === width && t.height === height)) return;
      for (const t of this.#targets) {
        gl.deleteFramebuffer(t.framebuffer);
        gl.deleteTexture(t.texture);
        gl.deleteRenderbuffer(t.depth);
      }
      this.#targets = Array.from({ length: count }, () => {
        const texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + 4);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        if (this.#floatTargets) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        // the scene may use depth (a mesh), so its target gets a depth buffer too
        const depth = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
        return { framebuffer, texture, depth, width, height };
      });
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // ─── Input & context loss ───────────────────────────────────────────────

    #onPointerMove = (event) => {
      const rect = this.#canvas.getBoundingClientRect();
      const sx = this.#canvas.width / rect.width;
      const sy = this.#canvas.height / rect.height;
      this.#mouse = [(event.clientX - rect.left) * sx, (rect.bottom - event.clientY) * sy];
      if (this.#drag) {
        const dx = event.clientX - this.#drag.x;
        const dy = event.clientY - this.#drag.y;
        this.#drag = { x: event.clientX, y: event.clientY };
        const speed = (2 * Math.PI) / Math.max(rect.width, 1);
        this.#rotation = [this.#rotation[0] + dx * speed, Math.max(-1.5, Math.min(1.5, this.#rotation[1] + dy * speed))];
      }
      if (!this.#frame) this.#draw();
    };

    #onPointerDown = (event) => {
      if (!this.hasAttribute('orbit')) return;
      this.#drag = { x: event.clientX, y: event.clientY };
      this.#canvas.setPointerCapture(event.pointerId);
      this.#canvas.style.cursor = 'grabbing';
    };

    #onPointerUp = (event) => {
      if (!this.#drag) return;
      this.#drag = null;
      this.#canvas.releasePointerCapture(event.pointerId);
      this.#canvas.style.cursor = '';
    };

    #setNearby(near) {
      this.#near = near;
      if (near) {
        this.#recovered = false;
        if (!this.#gl || this.#gl.isContextLost()) this.#freshContext();
        return;
      }
      if (!this.#gl) return;
      // Hand the context back right away instead of waiting for garbage collection.
      if (!this.#gl.isContextLost()) this.#loseContext?.loseContext();
      cancelAnimationFrame(this.#frame);
      this.#frame = 0;
      this.#gl = null;
      this.#program = null;
      this.#mesh = null;
      this.#quad = null;
      this.#posts = [];
      this.#targets = [];
      this.#textures = [];
    }

    /** A new context – on a new canvas if this one ever had one, since a canvas keeps its (lost) context. */
    #freshContext() {
      if (this.#canvasUsed) {
        const canvas = document.createElement('canvas');
        canvas.setAttribute('part', 'canvas');
        canvas.width = this.#canvas.width;
        canvas.height = this.#canvas.height;
        this.#canvas.replaceWith(canvas);
        this.#canvas = canvas;
        this.#listen(canvas);
      }
      this.#gl = null;
      this.#program = null;
      this.#mesh = null;
      this.#quad = null;
      this.#posts = [];
      this.#targets = [];
      this.#textures = [];
      if (this.#initGL()) this.#compile();
    }

    #onContextLost = (event) => {
      if (event.target !== this.#canvas) return;  // an old canvas, dropped on purpose
      event.preventDefault();
      cancelAnimationFrame(this.#frame);
      this.#frame = 0;
      this.#program = null;
      // Lost while on screen (the browser made room for other contexts):
      // start over once, rather than staying blank.
      if (this.#near && !this.#recovered) {
        this.#recovered = true;
        setTimeout(() => this.#near && this.#freshContext(), 0);
      }
    };

    #onContextRestored = (event) => {
      if (event.target !== this.#canvas) return;
      this.#mesh = null;
      this.#quad = null;
      this.#posts = [];
      this.#targets = [];
      this.#textures = [];
      this.#buildMesh();
      for (let i = 0; i < 4; i++) this.#loadTexture(i);
      if (this.#sources.frag) this.#compile();  // before the first load, #reload() compiles
    };
  }

  if (!customElements.get(TAG)) customElements.define(TAG, ShaderCanvas);
})();
