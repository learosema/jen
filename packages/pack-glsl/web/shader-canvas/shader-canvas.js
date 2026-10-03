// <shader-canvas> · pack-glsl · MIT-0
// A dependency-free WebGL2 element for prototyping GLSL shaders.
//
//   <script src="shader-canvas.js" defer></script>
//   <shader-canvas src="shaders/clouds.frag.glsl" live></shader-canvas>
//
// Attributes, uniforms, events and examples:
// https://github.com/learosema/jen/tree/main/packages/pack-glsl/web/shader-canvas
//
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
`;

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
    static observedAttributes = ['src', 'vert', 'mesh', 'detail', 'texture0', 'texture1', 'texture2', 'texture3', 'live'];

    #canvas;
    #overlay;
    #gl = null;
    #program = null;
    #uniforms = new Map();
    #mesh = null;
    #textures = [];
    #sources = { frag: '', vert: '' };
    #frame = 0;
    #time = 0;
    #lastTick = 0;
    #playing = true;
    #visible = true;
    #mouse = [0, 0];
    #rotation = [0, 0];
    #drag = null;
    #pollTimer = 0;
    #observers = [];
    #loadToken = 0;

    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>${STYLE}</style><canvas part="canvas"></canvas><pre part="error" role="alert" hidden></pre>`;
      this.#canvas = root.querySelector('canvas');
      this.#overlay = root.querySelector('pre');
    }

    connectedCallback() {
      if (!this.#initGL()) return;

      const resize = new ResizeObserver(() => this.#resize());
      resize.observe(this);
      const intersect = new IntersectionObserver(([entry]) => {
        this.#visible = entry.isIntersecting;
        this.#schedule();
      });
      intersect.observe(this);
      this.#observers = [resize, intersect];

      const motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.#playing = !motion.matches;

      this.#canvas.addEventListener('pointermove', this.#onPointerMove);
      this.#canvas.addEventListener('pointerdown', this.#onPointerDown);
      this.#canvas.addEventListener('pointerup', this.#onPointerUp);
      this.#canvas.addEventListener('pointercancel', this.#onPointerUp);
      this.#canvas.addEventListener('webglcontextlost', this.#onContextLost);
      this.#canvas.addEventListener('webglcontextrestored', this.#onContextRestored);

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
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (!this.#gl || oldValue === newValue) return;
      if (name === 'live') this.#setupPolling();
      else if (name.startsWith('texture')) this.#loadTexture(Number(name.slice(-1)));
      else if (name === 'mesh' || name === 'detail') this.#buildMesh();
      if (name === 'src' || name === 'vert') this.#reload();
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

    #initGL() {
      const gl = this.#canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: true });
      if (!gl) {
        this.#showError('WebGL2 is not available in this browser.');
        return false;
      }
      this.#gl = gl;
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
      if (!url) return;
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        if (this.#textures[unit] !== texture || !this.#gl) return;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        this.#schedule();
      };
      image.onerror = () => this.#showError(`Could not load texture${unit}: ${url}`);
      image.src = new URL(url, document.baseURI).href;
    }

    // ─── Sources ────────────────────────────────────────────────────────────

    #inline(type) {
      const script = this.querySelector(`script[type="x-shader/x-${type}"]`);
      return script ? script.textContent : null;
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
      let frag, vertex;
      try {
        [frag, vertex] = await Promise.all([
          src ? this.#fetchSource(src) : this.#inline('fragment'),
          vert ? this.#fetchSource(vert) : this.#inline('vertex'),
        ]);
      } catch (error) {
        if (token === this.#loadToken) this.#showError(`Could not load shader – ${error.message}`);
        return;
      }
      if (token !== this.#loadToken) return;
      frag ??= FALLBACK_FRAG;
      vertex ??= QUAD_VERT;
      if (!force && frag === this.#sources.frag && vertex === this.#sources.vert) return;
      this.#sources = { frag, vert: vertex };
      this.#compile();
      this.#setupPolling();
    }

    #setupPolling() {
      clearInterval(this.#pollTimer);
      this.#pollTimer = 0;
      const remote = this.hasAttribute('src') || this.hasAttribute('vert');
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

    #compile() {
      const gl = this.#gl;
      const vs = this.#compileStage(gl.VERTEX_SHADER, 'vertex shader', this.#sources.vert);
      const fs = this.#compileStage(gl.FRAGMENT_SHADER, 'fragment shader', this.#sources.frag);
      const errors = [vs.error, fs.error].filter(Boolean);
      if (errors.length) {
        if (vs.shader) gl.deleteShader(vs.shader);
        if (fs.shader) gl.deleteShader(fs.shader);
        this.#reportCompileErrors(errors);
        return;
      }

      const program = gl.createProgram();
      gl.attachShader(program, vs.shader);
      gl.attachShader(program, fs.shader);
      gl.linkProgram(program);
      gl.deleteShader(vs.shader);
      gl.deleteShader(fs.shader);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program) || 'unknown link error';
        gl.deleteProgram(program);
        this.#showError(`Link error:\n${log}`);
        this.dispatchEvent(new CustomEvent('shader-error', { detail: { log } }));
        return;
      }

      if (this.#program) gl.deleteProgram(this.#program);
      this.#program = program;
      this.#uniforms.clear();
      const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < count; i++) {
        const name = gl.getActiveUniform(program, i).name;
        this.#uniforms.set(name, gl.getUniformLocation(program, name));
      }
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

    #schedule() {
      if (this.#frame || !this.#gl || !this.#program) return;
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
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.#program);

      const u = this.#uniforms;
      const set = (name, fn) => u.has(name) && fn(u.get(name));
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

      const is3d = this.#mesh.kind !== 'quad';
      if (is3d) {
        gl.enable(gl.DEPTH_TEST);
        set('uModel', (l) => gl.uniformMatrix4fv(l, false, rotationYX(this.#rotation[0], this.#rotation[1])));
        set('uView', (l) => gl.uniformMatrix4fv(l, false, translationZ(-3)));
        set('uProjection', (l) => gl.uniformMatrix4fv(l, false, perspective(Math.PI / 4, width / height, 0.1, 100)));
      } else {
        gl.disable(gl.DEPTH_TEST);
      }

      gl.bindVertexArray(this.#mesh.vao);
      gl.drawElements(gl.TRIANGLES, this.#mesh.count, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
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

    #onContextLost = (event) => {
      event.preventDefault();
      cancelAnimationFrame(this.#frame);
      this.#frame = 0;
      this.#program = null;
    };

    #onContextRestored = () => {
      this.#mesh = null;
      this.#textures = [];
      this.#buildMesh();
      for (let i = 0; i < 4; i++) this.#loadTexture(i);
      this.#compile();
    };
  }

  if (!customElements.get(TAG)) customElements.define(TAG, ShaderCanvas);
})();
