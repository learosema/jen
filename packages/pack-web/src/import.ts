/** `web:import`: wires a stylesheet of your own into the entry point – and starts it if it doesn't exist yet. */
import { posix } from 'node:path';
import type { Generator } from '@codejen/jen';
import { fail } from './common.ts';
import { findEntry, importActions } from './entry.ts';

const importGenerator: Generator = {
  description: 'import a stylesheet of your own into the entry point – created empty if it doesn\'t exist',
  params: {
    file: { path: true, description: 'the stylesheet, e.g. css/dashboard.css' },
  },
  examples: ['--file=css/dashboard.css'],
  actions: ({ file }, _helpers, ctx) => {
    const path = String(file).replace(/^\//, '');
    if (!path.endsWith('.css')) fail(`web:import --file: "${path}" isn't a .css file`);
    if (path === findEntry(ctx)) fail(`web:import --file: ${path} is the entry point itself – import other stylesheets into it`);
    // relative to where the files go, as importActions() reads them
    const rel = posix.relative(ctx.destDir, path);
    return [...(ctx.exists(path) ? [] : [{ add: `/${path}`, template: '' }]), ...importActions(ctx, [rel], false)];
  },
};

export default importGenerator;
