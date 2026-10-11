/** jen pack running Yeoman generators – documented at https://learosema.github.io/jen/yeoman.html */
import type { AnyGenerator, PackFactory } from '@codejen/jen';
import { FETCHABLE, isInstalled } from './common.ts';
import { jhipsterGenerator } from './jhipster.ts';
import { shimGenerator } from './shim.ts';

/** Yeoman's package naming: "generator-code" or "@scope/generator-code" → "code". */
const YEOMAN_RE = /^(?:@[^/]+\/)?generator-(.+)$/;

const pack: PackFactory = (env) => {
  const generators: Record<string, AnyGenerator> = {};
  for (const name of new Set([...env.packages(YEOMAN_RE), ...FETCHABLE])) {
    const short = YEOMAN_RE.exec(name)?.[1] ?? name;
    if (short in generators) continue;
    const fetched = isInstalled(env, name) ? '' : ' – fetched when run';
    generators[short] =
      name === 'generator-jhipster'
        ? jhipsterGenerator(env, `JHipster: an app, or a command like jdl${fetched}`)
        : shimGenerator(name, short, env, `Yeoman ${name}${fetched}`);
  }
  return generators;
};

export default pack;
