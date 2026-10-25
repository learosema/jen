/** `web:check --render`: each page in headless Chromium, light and dark, 390 and 1280 wide – what only shows on screen. */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { delimiter, extname, join, normalize, sep } from 'node:path';
import type { Readable, Writable } from 'node:stream';

export const SCHEMES = ['light', 'dark'];
export const WIDTHS = [390, 1280];

/** Chromium: $CHROME, else a usual install on the PATH or in its usual place. Never fetched. */
export function findChrome(env: NodeJS.ProcessEnv = process.env): string | null {
  const isFile = (p: string) => existsSync(p) && statSync(p).isFile();
  if (env.CHROME) return isFile(env.CHROME) ? env.CHROME : null;
  const names = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'microsoft-edge'];
  const onPath = (env.PATH ?? '').split(delimiter).filter(Boolean).flatMap((dir) => names.map((n) => join(dir, n)));
  const apps = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ...[env.PROGRAMFILES, env['PROGRAMFILES(X86)']].filter(Boolean).flatMap((dir) => [`${dir}\\Google\\Chrome\\Application\\chrome.exe`, `${dir}\\Microsoft\\Edge\\Application\\msedge.exe`]),
  ];
  return [...onPath, ...apps].find(isFile) ?? null;
}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

/** The project as a static site on 127.0.0.1, public/ at the root like Vite – so root-relative links and module scripts work. */
async function serve(root: string): Promise<{ origin: string; close: () => void }> {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    for (const base of [root, join(root, 'public')]) {
      let file = normalize(join(base, path));
      if (file !== base && !file.startsWith(base + sep)) continue;
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
      if (existsSync(file) && statSync(file).isFile()) {
        return void res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
      }
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const close = () => {
    server.closeAllConnections();
    server.close();
  };
  return { origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Message = { id?: number; method?: string; params?: any; result?: any; error?: { message: string }; sessionId?: string };

/** Headless Chromium, spoken to over --remote-debugging-pipe: no port, no WebSocket. */
function launch(chrome: string) {
  const profile = mkdtempSync(join(tmpdir(), 'jen-render-'));
  const args = ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--mute-audio', `--user-data-dir=${profile}`, '--remote-debugging-pipe'];
  // Chromium's sandbox refuses to run as root, e.g. in a container
  if (process.getuid?.() === 0) args.push('--no-sandbox');
  const proc = spawn(chrome, [...args, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  let stderr = '';
  proc.stderr!.on('data', (d) => (stderr = (stderr + d).slice(-2000)));
  const input = proc.stdio[3] as Writable;
  const output = proc.stdio[4] as Readable;

  let id = 0;
  const pending = new Map<number, { resolve: (v: Message['result']) => void; reject: (e: Error) => void }>();
  const listeners = new Set<(m: Message) => void>();
  let buffer = '';
  output.on('data', (chunk) => {
    buffer += chunk;
    for (let end = buffer.indexOf('\0'); end >= 0; end = buffer.indexOf('\0')) {
      const msg = JSON.parse(buffer.slice(0, end)) as Message;
      buffer = buffer.slice(end + 1);
      const call = msg.id === undefined ? undefined : pending.get(msg.id);
      if (call) {
        pending.delete(msg.id!);
        if (msg.error) call.reject(new Error(msg.error.message));
        else call.resolve(msg.result);
      }
      for (const listen of listeners) listen(msg);
    }
  });
  let pipeError = '';
  const quit = () => {
    const last = stderr.trim().split('\n').at(-1) || pipeError;
    const why = /No usable sandbox/.test(stderr)
      ? ': it can\'t start its sandbox – on Ubuntu 23.10+, allow it with sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0'
      : last
        ? `: ${last}`
        : '';
    for (const call of pending.values()) call.reject(new Error(`Chromium quit${why}`));
    pending.clear();
  };
  const exited = new Promise<void>((resolve) => proc.on('exit', () => resolve()));
  proc.on('error', (e) => (stderr += `\n${e.message}`));
  // A pipe Chromium closed (it quit, or is shutting down) doesn't crash jen; the calls in flight end when it
  // has exited and said why on stderr – or time out.
  for (const stream of [input, output, proc.stderr!]) stream.on('error', (e: Error) => (pipeError ||= e.message));
  void exited.then(quit);

  const send = (method: string, params: object = {}, sessionId?: string, timeout = 20_000): Promise<Message['result']> =>
    new Promise((resolve, reject) => {
      const callId = ++id;
      const timer = setTimeout(() => {
        pending.delete(callId);
        reject(new Error(`${method} timed out`));
      }, timeout);
      const done = <T>(fn: (v: T) => void) => (v: T) => {
        clearTimeout(timer);
        fn(v);
      };
      pending.set(callId, { resolve: done(resolve), reject: done(reject) });
      input.write(`${JSON.stringify({ id: callId, method, params, sessionId })}\0`);
    });

  return {
    send,
    listen: (fn: (m: Message) => void) => (listeners.add(fn), () => listeners.delete(fn)),
    close: async () => {
      let timer: NodeJS.Timeout | undefined;
      const within = (ms: number) => Promise.race([exited, new Promise((resolve) => (timer = setTimeout(resolve, ms)))]).finally(() => clearTimeout(timer));
      // ask first, so it shuts its pipes down itself; kill it only if that doesn't work
      await send('Browser.close', {}, undefined, 2000).catch(() => undefined);
      await within(2000);
      if (proc.exitCode === null && proc.signalCode === null) {
        proc.kill();
        await within(2000);
      }
      // Chromium's helper processes may hold the pipes open a while longer: don't wait for them
      for (const stream of [input, output, proc.stderr!]) stream.destroy();
      rmSync(profile, { recursive: true, force: true });
    },
  };
}

/** What a page shows in one scheme at one width – runs in the page. */
interface Seen {
  contrast: Array<{ text: string; el: string; ratio: number; need: number }>;
  overflow: string[];
  touching: Array<{ a: string; b: string; parent: string; axis: 'vertical' | 'horizontal' }>;
}

const MEASURE = `(async () => {
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const ctx = document.createElement('canvas').getContext('2d');
  const rgba = (c) => {
    ctx.fillStyle = '#000';
    ctx.fillStyle = c;
    const v = ctx.fillStyle;
    if (v.startsWith('#')) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)).concat(1);
    const m = v.match(/[\\d.]+/g).map(Number);
    return [m[0], m[1], m[2], m[3] ?? 1];
  };
  const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const blend = (top, bottom) => [0, 1, 2].map((i) => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1);
  const probe = document.body.appendChild(document.createElement('div'));
  probe.style.background = 'Canvas';
  const canvas = rgba(getComputedStyle(probe).backgroundColor);
  probe.remove();
  // the color behind an element, or null over an image or gradient
  const backgroundOf = (el) => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.backgroundImage !== 'none') return null;
      const c = rgba(s.backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] === 1) break;
    }
    let bg = layers.length && layers[layers.length - 1][3] === 1 ? [255, 255, 255, 1] : canvas;
    for (const c of layers.reverse()) bg = blend(c, bg);
    return bg;
  };
  const describe = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + [...el.classList].slice(0, 3).map((c) => '.' + c).join('');
  const shown = (el) => {
    const s = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && s.visibility !== 'hidden' && Number(s.opacity) > 0;
  };

  const contrast = [];
  for (const el of document.body.querySelectorAll('*')) {
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (!text || !shown(el)) continue;
    const bg = backgroundOf(el);
    if (!bg) continue;
    const s = getComputedStyle(el);
    const [hi, lo] = [lum(blend(rgba(s.color), bg)), lum(bg)].sort((a, b) => b - a);
    const ratio = Math.floor(((hi + 0.05) / (lo + 0.05)) * 10) / 10;
    const size = parseFloat(s.fontSize);
    const need = size >= 24 || (Number(s.fontWeight) >= 700 && size >= 18.66) ? 3 : 4.5;
    if (ratio < need) contrast.push({ text: text.length > 40 ? text.slice(0, 39) + '…' : text, el: describe(el), ratio, need });
  }

  const overflow = [];
  // the layout viewport: a phone zooms out instead, so innerWidth grows with the page
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw + 1) {
    const clips = (el) => /(hidden|auto|scroll|clip)/.test(getComputedStyle(el).overflowX);
    for (const el of document.body.querySelectorAll('*')) {
      if (el.getBoundingClientRect().right <= vw + 1 || !shown(el)) continue;
      const parent = el.parentElement;
      if (parent !== document.body && parent.getBoundingClientRect().right > vw + 1) continue;
      let clipped = false;
      for (let e = parent; e && e !== document.body; e = e.parentElement) if (clips(e)) clipped = true;
      if (!clipped) overflow.push(describe(el));
    }
  }

  // a box: borders on two sides or more, a shadow, or a background that differs from what's behind it.
  // A border on one side only is a divider, like a divided list's between its rows.
  const isBox = (el) => {
    const s = getComputedStyle(el);
    if (s.boxShadow !== 'none' || s.backgroundImage !== 'none') return true;
    const sides = ['Top', 'Right', 'Bottom', 'Left'].filter((side) => parseFloat(s['border' + side + 'Width']) > 0 && s['border' + side + 'Style'] !== 'none' && rgba(s['border' + side + 'Color'])[3] > 0);
    if (sides.length > 1) return true;
    const own = rgba(s.backgroundColor);
    if (own[3] === 0 || !el.parentElement) return false;
    const behind = backgroundOf(el.parentElement);
    return !behind || blend(own, behind).some((v, i) => Math.abs(v - behind[i]) > 2);
  };
  // the element itself, or a descendant flush with its edge, if that one is a box
  const boxAt = (el, edge, depth = 0) => {
    if (isBox(el)) return true;
    if (depth > 5) return false;
    const r = el.getBoundingClientRect();
    return [...el.children].some((c) => shown(c) && Math.abs(c.getBoundingClientRect()[edge] - r[edge]) < 1 && boxAt(c, edge, depth + 1));
  };
  const laidOut = (el) => {
    const s = getComputedStyle(el);
    return shown(el) && !['inline', 'contents', 'none'].includes(s.display) && !s.display.startsWith('table') && !['absolute', 'fixed'].includes(s.position);
  };
  const touching = [];
  for (const parent of [document.body, ...document.body.querySelectorAll('*')]) {
    const kids = [...parent.children].filter(laidOut).slice(0, 60);
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const [a, b] = [kids[i].getBoundingClientRect(), kids[j].getBoundingClientRect()];
        const across = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const along = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        let edges = null;
        if (across > 1 && Math.abs(a.bottom - b.top) < 1) edges = ['bottom', 'top', 'vertical'];
        else if (across > 1 && Math.abs(b.bottom - a.top) < 1) edges = ['top', 'bottom', 'vertical'];
        else if (along > 1 && Math.abs(a.right - b.left) < 1) edges = ['right', 'left', 'horizontal'];
        else if (along > 1 && Math.abs(b.right - a.left) < 1) edges = ['left', 'right', 'horizontal'];
        if (!edges || !(boxAt(kids[i], edges[0]) || boxAt(kids[j], edges[1]))) continue;
        touching.push({ a: describe(kids[i]), b: describe(kids[j]), parent: describe(parent), axis: edges[2] });
      }
    }
  }
  return { contrast, overflow, touching };
})()`;

/** One problem on one page, with the runs (`dark 390`) it showed in. */
export interface Finding {
  page: string;
  message: string;
  runs: string[];
}

const touchMessage = ({ a, b, parent, axis }: Seen['touching'][number]): string =>
  `${a} and ${b} touch ${axis === 'vertical' ? 'one above the other' : 'side by side'} – ` +
  `${axis === 'vertical' ? `class="flow" on ${parent}` : `a gap on ${parent}`} spaces them out`;

/** Renders `pages` (paths from `root`) in each scheme and width. Throws if Chromium doesn't start. */
export async function renderPages(chrome: string, root: string, pages: string[]): Promise<Finding[]> {
  const found = new Map<string, Finding>();
  const add = (page: string, message: string, run: string) => {
    const key = `${page}\n${message}`;
    const f = found.get(key) ?? { page, message, runs: [] };
    if (!f.runs.includes(run)) f.runs.push(run);
    found.set(key, f);
  };
  const site = await serve(root);
  const browser = launch(chrome);
  try {
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
    const send = (method: string, params: object = {}, timeout?: number) => browser.send(method, params, sessionId, timeout);
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Log.enable');
    for (const page of pages) {
      for (const scheme of SCHEMES) {
        for (const width of WIDTHS) {
          const run = `${scheme} ${width}`;
          const errors: string[] = [];
          let loaded!: () => void;
          const load = new Promise<void>((resolve) => (loaded = resolve));
          const stop = browser.listen((m) => {
            if (m.sessionId !== sessionId) return;
            if (m.method === 'Page.loadEventFired') loaded();
            if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] ?? m.params.exceptionDetails.text);
            if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
              errors.push(m.params.args.map((a: { value?: unknown; description?: string }) => a.value ?? a.description).join(' '));
            }
            if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/\/favicon\.ico$/.test(m.params.entry.url ?? '')) {
              errors.push(`${m.params.entry.text}${m.params.entry.url ? ` ${m.params.entry.url.replace(site.origin, '')}` : ''}`);
            }
          });
          try {
            await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
            await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
            await send('Page.navigate', { url: `${site.origin}/${page}` });
            let timer: NodeJS.Timeout | undefined;
            const slow = new Promise((_, reject) => (timer = setTimeout(() => reject(new Error('the page took over 15 s to load')), 15_000)));
            await Promise.race([load, slow]).finally(() => clearTimeout(timer));
            const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: MEASURE, awaitPromise: true, returnByValue: true });
            if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
            const seen = result.value as Seen;
            for (const c of seen.contrast) add(page, `"${c.text}" (${c.el}) has a contrast of ${c.ratio}:1, needs ${c.need}:1 (WCAG AA)`, run);
            for (const el of seen.overflow) add(page, `${el} is wider than the screen, so the page scrolls sideways`, run);
            for (const t of seen.touching) add(page, touchMessage(t), run);
            for (const e of errors) add(page, `console error: ${e}`, run);
          } catch (e) {
            add(page, `couldn't render it: ${(e as Error).message}`, run);
          } finally {
            stop();
          }
        }
      }
    }
  } finally {
    await browser.close();
    site.close();
  }
  return [...found.values()];
}

/** " (dark, 390 wide)" – nothing when it showed in every run. */
export function where(runs: string[]): string {
  if (runs.length === SCHEMES.length * WIDTHS.length) return '';
  const parsed = runs.map((r) => r.split(' '));
  const schemes = new Set(parsed.map(([s]) => s));
  const widths = new Set(parsed.map(([, w]) => w));
  if (schemes.size === 1 && widths.size === WIDTHS.length) return ` (${[...schemes][0]} mode)`;
  if (widths.size === 1 && schemes.size === SCHEMES.length) return ` (${[...widths][0]} wide)`;
  return ` (${parsed.map(([s, w]) => `${s}, ${w} wide`).join('; ')})`;
}
