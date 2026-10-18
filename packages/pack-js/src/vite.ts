/** `js:vite`: a new Vite project from `npm create vite@latest`, run in a scratch directory so its files go through jen's plan. */
import type { Action, Generator } from '@codejen/jen';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { fail } from './common.ts';
import { npm } from './npm.ts';
import { NAME_PARAM, projectName } from './project.ts';

const CREATE = ['--yes', 'create', 'vite@latest'];

/** The template names create-vite lists under "Available templates" in its --help. */
export function templatesIn(help: string): string[] {
  const list = help.split(/^Available templates:\s*$/m)[1] ?? '';
  return list.split(/\s+/).filter((name) => /^[a-z][a-z0-9-]*$/.test(name));
}

const utf8 = new TextDecoder('utf-8', { fatal: true });

/** Every file below `dir`, as text where it is text, else byte for byte. */
function filesIn(dir: string, prefix: string): Action[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort()
    .map((file) => {
      const add = posix.join(prefix, file.slice(dir.length + 1).replaceAll('\\', '/'));
      const bytes = readFileSync(file);
      try {
        return { add, template: utf8.decode(bytes) };
      } catch {
        return { add, bytes: new Uint8Array(bytes) };
      }
    });
}

const viteGenerator: Generator = {
  description: 'create a new Vite project in its own directory, from npm create vite@latest',
  params: {
    ...NAME_PARAM,
    framework: { default: 'vanilla', description: 'a create-vite template: vanilla, vue, react, preact, lit, svelte, solid, qwik …' },
    types: { default: 'none', description: 'ts or none (plain JavaScript)' },
  },
  actions: (answers, helpers, ctx) => {
    const name = projectName('js:vite', answers, helpers, ctx);
    const types = String(answers.types || 'none');
    if (types === 'jsdoc') fail('js:vite --types: create-vite has no JSDoc templates – use ts or none');
    if (types !== 'ts' && types !== 'none') fail(`js:vite --types: expected ts or none, got "${types}"`);
    const framework = String(answers.framework || 'vanilla');
    const template = types === 'ts' ? `${framework}-ts` : framework;
    const scratch = mkdtempSync(join(tmpdir(), 'jen-vite-'));
    try {
      // create-vite takes an unknown template for vanilla-ts without a word, so check it against its own list first.
      const templates = templatesIn(npm('js:vite', [...CREATE, '--', '--help'], scratch));
      if (templates.length === 0) fail('js:vite: found no templates in npm create vite@latest -- --help');
      if (!templates.includes(template)) {
        const frameworks = [...new Set(templates.map((t) => t.replace(/-ts$/, '')))];
        fail(`js:vite --framework: create-vite has no ${template} template; expected ${frameworks.join(', ')}, got "${framework}"`);
      }
      npm('js:vite', [...CREATE, name, '--', '--template', template, '--no-interactive', '--no-immediate'], scratch);
      return filesIn(join(scratch, name), name);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  },
};

export default viteGenerator;
