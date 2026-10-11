/** The output styles come from jen; pack-js adds its templates in each style. */
import { type Types, stripTypes } from '@codejen/jen';
import { template } from './templates.ts';

export { TYPES_PARAM, type Types, detectTypes, ext, importExt, pick, source, stripTypes, typesFor } from '@codejen/jen';

/** A template in the project's style: `name.ts`, or `name.js` (JSDoc), stripped of its types for plain JavaScript. */
export function styled(name: string, types: Types): string {
  if (types === 'ts') return template(`${name}.ts`);
  const js = template(`${name}.js`);
  return types === 'jsdoc' ? js : stripTypes(js);
}
