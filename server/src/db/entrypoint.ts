import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * True when the module whose `import.meta.url` is `moduleUrl` is the script
 * Node was started with (`tsx src/db/seed.ts`), false when it is imported.
 *
 * `argv[1]` is a native path (`D:\…\seed.ts` on Windows), so it is converted
 * with `pathToFileURL` instead of string-concatenating `file://` — the old
 * comparison never matched on Windows and the CLI exited 0 without doing
 * anything. The realpath variant covers a script started through a symlink
 * (Node reports the main module's URL by its real path).
 */
export function isEntrypoint(moduleUrl: string, argv1: string | undefined = process.argv[1]): boolean {
  if (!argv1) return false;
  const candidates = [argv1];
  try {
    candidates.push(realpathSync(argv1));
  } catch {
    // argv[1] may not exist on disk (e.g. `node -e`); the plain path is enough.
  }
  return candidates.some((p) => pathToFileURL(p).href === moduleUrl);
}
