/** `web:avatars`: an overlapping avatar list, after Smol Avatar List Component by Stephanie Eckles (https://smolcss.dev). */
import type { Generator } from '@codejen/jen';
import { paletteColors } from './button.ts';
import { importActions } from './entry.ts';
import { template } from './templates.ts';

export const FILE = 'avatars.css';

export const AVATARS = template('avatars.css');

const avatarsGenerator: Generator = {
  description: 'create an overlapping .avatars list block',
  actions: (_answers, _helpers, ctx) => {
    paletteColors(ctx);
    return [{ add: FILE, template: AVATARS }, ...importActions(ctx, [FILE])];
  },
};

export default avatarsGenerator;
