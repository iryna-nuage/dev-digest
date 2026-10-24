import { describe, it, expect, vi, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isEntrypoint } from '../src/db/entrypoint.js';

/**
 * Regression for the Windows CLI guard: `pnpm db:migrate` / `pnpm db:seed`
 * compared `import.meta.url` with `file://${argv[1]}`, which never matches a
 * native Windows path, so both exited 0 without migrating or seeding.
 * No database is touched here: the spawned scripts get DATABASE_URL='' (dotenv
 * never overrides a variable that is already set) and stop at the URL check.
 */

const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..');
const TSX_CLI = createRequire(join(SERVER, 'package.json')).resolve('tsx/cli');

describe('isEntrypoint', () => {
  const self = fileURLToPath(import.meta.url);

  it('matches the module URL for the native path Node puts in argv[1]', () => {
    expect(isEntrypoint(pathToFileURL(self).href, self)).toBe(true);
  });

  it('does not match another file, a missing argv[1] or a non-existent path', () => {
    expect(isEntrypoint(pathToFileURL(self).href, join(SERVER, 'src', 'db', 'seed.ts'))).toBe(false);
    expect(isEntrypoint(pathToFileURL(self).href, undefined)).toBe(false);
    expect(isEntrypoint('file:///nowhere/x.ts', join(SERVER, 'nope', 'x.ts'))).toBe(false);
  });

  it.runIf(process.platform === 'win32')('handles a Windows drive path (the old string concat did not)', () => {
    const winPath = 'D:\\ProjectsDev\\dev-digest\\server\\src\\db\\seed.ts';
    expect(`file://${winPath}`).not.toBe('file:///D:/ProjectsDev/dev-digest/server/src/db/seed.ts');
    expect(isEntrypoint('file:///D:/ProjectsDev/dev-digest/server/src/db/seed.ts', winPath)).toBe(true);
  });

  it.runIf(process.platform !== 'win32')('handles a POSIX path', () => {
    expect(isEntrypoint('file:///srv/app/src/db/seed.ts', '/srv/app/src/db/seed.ts')).toBe(true);
  });

  it('percent-encodes like Node does (spaces in the path)', () => {
    const spaced = join(SERVER, 'dir with space', 'seed.ts');
    expect(isEntrypoint(pathToFileURL(spaced).href, spaced)).toBe(true);
  });
});

describe('importing seed.ts / migrate.ts runs nothing', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does not call process.exit or touch the database on import', async () => {
    const prev = process.env.DATABASE_URL;
    // If a guard ever fired on import, it would stop at "DATABASE_URL is
    // required" instead of reaching a real database.
    process.env.DATABASE_URL = '';
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code}) called on import`);
    }) as never);
    try {
      const migrate = await import('../src/db/migrate.js');
      const seed = await import('../src/db/seed.js');
      expect(typeof migrate.runMigrations).toBe('function');
      expect(typeof seed.seed).toBe('function');
      expect(exit).not.toHaveBeenCalled();
    } finally {
      if (prev === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prev;
    }
  });
});

describe('the CLI entrypoints actually run under tsx', () => {
  // Exactly what `pnpm db:migrate` / `pnpm db:seed` do (`tsx src/db/<x>.ts`, cwd server/).
  const run = (script: string) =>
    spawnSync(process.execPath, [TSX_CLI, script], {
      cwd: SERVER,
      env: { ...process.env, DATABASE_URL: '' },
      encoding: 'utf8',
      timeout: 60_000,
    });

  it.each(['src/db/migrate.ts', 'src/db/seed.ts'])(
    '%s reaches its CLI body (exit 1 "DATABASE_URL is required", not a silent exit 0)',
    (script) => {
      const res = run(script);
      expect(res.stderr).toContain('DATABASE_URL is required');
      expect(res.status).toBe(1);
    },
    60_000,
  );
});
