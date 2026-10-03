/**
 * GLSL dialects jen writes: WebGL2's GLSL ES 3.00 (the default – prototype in
 * the browser first) and desktop GLSL 3.30 / 4.10 core (cpp:sdl3-opengl uses
 * 4.10). Starters and chunks are written in the subset all three share, so
 * only the header differs: the `#version` line plus, for ES, default
 * precisions. `glsl:port` swaps exactly that header.
 */
import { fail } from './common.ts';

export const VERSIONS = ['300es', '330', '410'] as const;
export type Version = (typeof VERSIONS)[number];

export function parseVersion(value: unknown, flag = '--version'): Version {
  const v = String(value);
  if (!(VERSIONS as readonly string[]).includes(v)) {
    fail(`${flag}: expected one of ${VERSIONS.map((x) => `"${x}"`).join(', ')}, got "${v}"`);
  }
  return v as Version;
}

/**
 * The header lines for a dialect, without a trailing newline. ES needs a
 * default float precision in fragment shaders; `highp int` keeps integer
 * hashes at full 32 bits. Desktop GLSL ignores precision, so it gets none.
 */
export function header(version: Version): string {
  switch (version) {
    case '300es':
      return '#version 300 es\nprecision highp float;\nprecision highp int;';
    case '330':
      return '#version 330 core';
    case '410':
      return '#version 410 core';
  }
}

/** Prefixes a starter's body with the dialect header. */
export function withHeader(version: Version, body: string): string {
  return `${header(version)}\n\n${body}`;
}
