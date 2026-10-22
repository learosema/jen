/**
 * Checks what the packages publish – each package.json's `files`, with src/ for dist/ – for code that
 * mustn't be in them: NonCommercial or ShareAlike licenses (Creative Commons BY-NC, BY-SA …), and Shadertoy,
 * whose shaders are CC BY-NC-SA unless their authors say otherwise. Also that each package has a LICENSE
 * file and a license in package.json. Run by `npm test`:
 *
 *   node scripts/check-licenses.ts
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(import.meta.dirname, '..');
const packages = join(root, 'packages');

const FORBIDDEN = /creative\s*commons|non-?commercial|share-?alike|\bCC[ -]BY|\bBY-NC\b|\bBY-SA\b|shadertoy/i;

const walk = (path: string): string[] =>
  !existsSync(path) ? [] : statSync(path).isDirectory() ? readdirSync(path).flatMap((e) => (e === 'node_modules' ? [] : walk(join(path, e)))) : [path];

const problems: string[] = [];
for (const name of readdirSync(packages)) {
  const dir = join(packages, name);
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { license?: string; files?: string[] };
  if (!pkg.license) problems.push(`${name}: package.json has no license`);
  if (!existsSync(join(dir, 'LICENSE'))) problems.push(`${name}: no LICENSE file`);
  const shipped = [...(pkg.files ?? []).map((f) => (f === 'dist' ? 'src' : f)), 'README.md'];
  for (const file of shipped.flatMap((f) => walk(join(dir, f)))) {
    const text = readFileSync(file);
    if (text.includes(0)) continue; // binary
    const line = text.toString('utf8').split('\n').findIndex((l) => FORBIDDEN.test(l));
    if (line >= 0) problems.push(`${relative(root, file)}:${line + 1}: ${text.toString('utf8').split('\n')[line].trim().slice(0, 120)}`);
  }
}

if (problems.length > 0) {
  console.error(`check-licenses: these need a look – only MIT-compatible code without NonCommercial or ShareAlike terms may ship:\n${problems.map((p) => `  ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('check-licenses: no NonCommercial or ShareAlike code, every package has a license');
