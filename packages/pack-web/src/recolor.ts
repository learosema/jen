/** The palette's colors where pages and the manifest repeat them – and updating those when the palette changes. */
import type { Action, Context } from '@codejen/jen';

/** The page background in light and dark mode (neutral-1 and -6) in `css`, or null. */
export function surfacesIn(css: string): [string, string] | null {
  const shade = (n: number) => new RegExp(`--color-neutral-${n}: (#[0-9a-f]{6});`).exec(css)?.[1];
  const [light, dark] = [shade(1), shade(6)];
  return light && dark ? [light, dark] : null;
}

/** A color role (`primary`, `surface`) in light mode in `css`, as hex, following var() and light-dark(); or null. */
export function roleIn(css: string, role: string): string | null {
  const resolve = (name: string, depth = 0): string | null => {
    const value = new RegExp(`--color-${name}: ([^;]+);`).exec(css)?.[1].trim();
    if (!value || depth > 4) return null;
    const light = /^light-dark\(\s*(var\([^)]*\)|#[0-9a-f]{3,6})\s*,/.exec(value)?.[1] ?? value;
    const ref = /^var\(--color-([\w-]+)\)$/.exec(light);
    if (ref) return resolve(ref[1], depth + 1);
    return /^#[0-9a-f]{6}$/.test(light) ? light : null;
  };
  return resolve(role);
}

const escape = (s: string) => s.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Moves the theme-color metas of the pages and the manifest's colors from the palette in `before` to the one in
 * `after` – only values that are the old palette's, so a color someone set on purpose stays.
 */
export function recolor(ctx: Context, before: string | null, after: string): Action[] {
  if (!before) return [];
  const actions: Action[] = [];
  const [was, now] = [surfacesIn(before), surfacesIn(after)];
  if (was && now) {
    for (const page of ctx.grep(/\.html?$/, 'name="theme-color"')) {
      const html = ctx.read(page) ?? '';
      for (const [i, scheme] of (['light', 'dark'] as const).entries()) {
        const meta = `content="${was[i]}" media="(prefers-color-scheme: ${scheme})"`;
        if (was[i] === now[i] || !html.includes(meta)) continue;
        actions.push({ modify: `/${page}`, pattern: new RegExp(escape(meta)), replace: `content="${now[i]}" media="(prefers-color-scheme: ${scheme})"` });
      }
    }
  }
  const pairs = (['primary', 'surface'] as const).map((role) => [roleIn(before, role), roleIn(after, role)]);
  for (const file of ctx.grep(/\.webmanifest$/)) {
    const json = ctx.read(file) ?? '';
    for (const [[old, next], key] of [
      [pairs[0], 'theme_color'],
      [pairs[1], 'background_color'],
    ] as const) {
      const entry = `"${key}": "${old}"`;
      if (!old || !next || old === next || !json.includes(entry)) continue;
      actions.push({ modify: `/${file}`, pattern: new RegExp(escape(entry)), replace: `"${key}": "${next}"` });
    }
  }
  const what = [...new Set(actions.map((a) => ('modify' in a && String(a.modify).endsWith('.webmanifest') ? 'the manifest' : 'theme-color')))];
  if (what.length > 0) actions.push({ note: `${what.join(' and ')} follow${what.length > 1 ? '' : 's'} the new palette` });
  return actions;
}
