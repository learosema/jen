// jen site — progressive enhancement only. Every page is fully readable without this file.
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── theme toggle ────────────────────────────────────────────────
  const themeBtn = document.querySelector('.theme');
  const isDark = () =>
    root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  try {
    const saved = localStorage.getItem('jen-theme');
    if (saved) root.dataset.theme = saved;
  } catch {}
  const paintTheme = () => themeBtn && (themeBtn.textContent = isDark() ? '☀' : '☾');
  paintTheme();
  themeBtn?.addEventListener('click', () => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    try { localStorage.setItem('jen-theme', root.dataset.theme); } catch {}
    paintTheme();
  });

  // ── copy buttons ────────────────────────────────────────────────
  const flash = async (text, el, label) => {
    try { await navigator.clipboard.writeText(text); } catch { return; }
    const prev = el.textContent;
    el.textContent = label;
    setTimeout(() => (el.textContent = prev), 1400);
  };
  document.querySelectorAll('.copy[data-copy]').forEach((b) => {
    const tag = b.querySelector('.tag');
    b.addEventListener('click', () => flash(b.dataset.copy, tag, 'copied ✓'));
  });
  // terminal blocks: copy just the commands (lines starting with "$ ")
  document.querySelectorAll('.doc .terminal').forEach((t) => {
    const cmds = [...t.querySelectorAll('pre')]
      .flatMap((p) => p.textContent.split('\n'))
      .filter((l) => l.startsWith('$ '))
      .map((l) => l.slice(2))
      .join('\n');
    if (!cmds) return;
    const b = document.createElement('button');
    b.className = 'cp';
    b.type = 'button';
    b.textContent = 'copy';
    b.setAttribute('aria-label', 'Copy command');
    b.addEventListener('click', () => flash(cmds, b, 'copied ✓'));
    t.appendChild(b);
  });

  // ── the demo: type a command, then show the plan, then act ─────
  const demo = document.querySelector('.demo');
  if (!demo) return;
  const out = demo.querySelector('pre');
  const tabs = [...demo.querySelectorAll('.tab')];
  const dry = demo.querySelector('#dry');

  const SCENES = [
    {
      cmd: 'jen class --name=rigid_body --moveOnly',
      head: 'class (project) – C++ class',
      rows: [['add', '+ src/RigidBody.h'], ['add', '+ src/RigidBody.cpp'], ['mod', '~ src/CMakeLists.txt  + RigidBody.cpp']],
      done: '✓ 3 written',
    },
    {
      cmd: 'jen cpp:shader --name=Vignette',
      head: 'cpp:shader (pack @codejen/pack-cpp) – GLSL vertex/fragment pair, embedded via CMake',
      rows: [
        ['dim', '= cmake/embed-glsl.cmake  exists, skipped'],
        ['add', '+ src/vignette.vert.glsl'],
        ['add', '+ src/vignette.frag.glsl'],
        ['mod', '~ src/CMakeLists.txt  + embed_glsl("vignette.vert.glsl" …) (+1 more)'],
      ],
      done: '✓ 3 written',
    },
    {
      cmd: 'jen cpp:sdl3 --name=MyGame',
      head: 'cpp:sdl3 (pack @codejen/pack-cpp) – SDL3 callback-based app starter',
      rows: [['add', '+ my-game/CMakeLists.txt'], ['add', '+ my-game/vendor/CMakeLists.txt'], ['add', '+ my-game/src/CMakeLists.txt'], ['add', '+ my-game/src/main.cpp'], ['add', '+ my-game/src/app.h'], ['add', '+ my-game/src/app.cpp']],
      done: '✓ 6 written',
    },
  ];

  const el = (cls, text) => {
    const s = document.createElement('span');
    if (cls) s.className = cls;
    s.textContent = text;
    return s;
  };
  let run = 0;

  async function play(i, animate = true) {
    const me = ++run;
    const s = SCENES[i];
    const isDry = dry.checked;
    const cmd = s.cmd + (isDry ? ' --dry-run' : '');
    const caret = el('caret', '');
    const live = () => me === run;
    out.replaceChildren();

    const typed = el('', '');
    out.append(el('prompt', '$ '), typed, caret);
    if (animate) {
      for (const ch of cmd) {
        typed.textContent += ch;
        await sleep(ch === ' ' ? 55 : 22 + Math.random() * 30);
        if (!live()) return;
      }
      await sleep(380);
    } else typed.textContent = cmd;
    if (!live()) return;
    caret.remove();
    out.append('\n', s.head, '\n\n');
    for (const [cls, text] of s.rows) {
      if (animate) await sleep(170);
      if (!live()) return;
      out.append('  ', el(cls, text), '\n');
    }
    if (!isDry) {
      if (animate) await sleep(320);
      if (!live()) return;
      out.append('\n', el('ok', s.done), '\n');
    }
    out.append(el('prompt', '$ '), el('caret', ''));
  }

  const select = (i, animate) => {
    tabs.forEach((t, j) => t.setAttribute('aria-selected', String(i === j)));
    play(i, animate && !reduced);
  };
  tabs.forEach((t, i) => t.addEventListener('click', () => select(i, true)));
  dry.addEventListener('change', () => select(tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true'), true));

  // start once the demo scrolls into view
  if ('IntersectionObserver' in window && !reduced) {
    out.replaceChildren();
    const io = new IntersectionObserver((es) => {
      if (es[0].isIntersecting) { io.disconnect(); select(0, true); }
    }, { threshold: 0.4 });
    io.observe(demo);
  } else select(0, false);
})();
