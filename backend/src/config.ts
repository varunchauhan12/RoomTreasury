import { existsSync, realpathSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { Ajv } from 'ajv';

export type Mode = 'test' | 'demo' | 'real';
export interface Config {
  readonly mode: Mode;
  readonly databasePath: string;
  readonly projectRoot: string;
  readonly host: '127.0.0.1' | '::1';
  readonly port: number;
}
export class ConfigurationError extends Error {
  constructor() { super('Invalid RoomTreasury configuration; check mode, explicit database path, host and port.'); }
}
// Resolve existing ancestors, so a symlink cannot redirect a demo/test path to real storage.
function canonicalPath(path: string): string {
  if (existsSync(path)) return realpathSync(path);
  const parent = dirname(path);
  if (parent === path) throw new ConfigurationError();
  return resolve(canonicalPath(parent), basename(path));
}
function isInside(root: string, path: string): boolean {
  const part = relative(root, path);
  return part !== '' && part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part);
}
export function assertDatabasePath(config: Config): void {
  if (process.env.NODE_ENV === 'test' && config.mode !== 'test') throw new ConfigurationError();
  const path = canonicalPath(config.databasePath);
  if (existsSync(path) && (!statSync(path).isFile() || statSync(path).nlink !== 1)) throw new ConfigurationError();
  if (config.mode === 'test') {
    const root = canonicalPath(tmpdir());
    const parts = relative(root, path).split(sep);
    if (!isInside(root, path) || !parts[0]?.startsWith('roomtreasury-test-') || parts.length < 2) throw new ConfigurationError();
  } else {
    const root = resolve(canonicalPath(config.projectRoot), 'var', config.mode);
    if (!isInside(root, path)) throw new ConfigurationError();
  }
  if (!/\.(sqlite|sqlite3|db)$/.test(path)) throw new ConfigurationError();
}
const validate = new Ajv({ coerceTypes: false, allErrors: false }).compile({
  type: 'object', additionalProperties: false,
  required: ['mode', 'databasePath', 'projectRoot', 'host', 'port'],
  properties: {
    mode: { enum: ['test', 'demo', 'real'] },
    databasePath: { type: 'string', minLength: 1 }, projectRoot: { type: 'string', minLength: 1 },
    host: { enum: ['127.0.0.1', '::1'] }, port: { type: 'integer', minimum: 1, maximum: 65535 }
  }
});
export function readConfig(env: NodeJS.ProcessEnv = process.env, projectRoot = process.cwd()): Config {
  const rawPort = env.ROOMTREASURY_PORT ?? '3000';
  if (!/^\d+$/.test(rawPort)) throw new ConfigurationError();
  const mode = env.ROOMTREASURY_MODE ?? (env.NODE_ENV === 'test' ? 'test' : undefined);
  if (env.NODE_ENV === 'test' && mode !== 'test') throw new ConfigurationError();
  if (!env.ROOMTREASURY_DB_PATH?.trim()) throw new ConfigurationError();
  const config = {
    mode, databasePath: resolve(projectRoot, env.ROOMTREASURY_DB_PATH), projectRoot: resolve(projectRoot),
    host: env.ROOMTREASURY_HOST ?? '127.0.0.1', port: Number(rawPort)
  };
  if (!validate(config)) throw new ConfigurationError();
  const checked = config as Config;
  assertDatabasePath(checked);
  return Object.freeze(checked);
}
