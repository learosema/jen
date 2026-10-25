/** pack-web's script templates in the project's style. */
import { type Types, stripTypes } from '@codejen/jen/js';
import { template } from './templates.ts';

/** A template in the project's style: `name.ts`, or `name.js` (JSDoc), stripped of its types for plain JavaScript. */
export function styled(name: string, types: Types): string {
  if (types === 'ts') return template(`${name}.ts`);
  const js = template(`${name}.js`);
  return types === 'jsdoc' ? js : stripTypes(js);
}
