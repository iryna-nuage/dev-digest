/**
 * Skill limits (L02). Field rules (name pattern, description / body length)
 * come from `@devdigest/shared` so the editor validates exactly like the API.
 */
export {
  SKILL_NAME_PATTERN,
  SKILL_NAME_MAX,
  SKILL_DESCRIPTION_MAX,
  SKILL_BODY_MAX,
} from '@devdigest/shared';

/** Stats tab window: runs and findings of the last N days. */
export const SKILL_STATS_WINDOW_DAYS = 30;

/** Fallback name when nothing usable can be derived from an imported file. */
export const IMPORTED_SKILL_FALLBACK_NAME = 'imported-skill';

// ---- import limits ----------------------------------------------------------
/** Decoded upload size (the `.md` file or the `.zip` archive). */
export const IMPORT_FILE_MAX_BYTES = 1_048_576;
/** Route-level body limit: base64 of a 1 MB file is ≈ 1.34 MB (global limit is 1 MB). */
export const IMPORT_REQUEST_BODY_LIMIT = 2 * 1_048_576;
export const IMPORT_ARCHIVE_MAX_ENTRIES = 200;
/** Sum of the entries' declared uncompressed sizes, checked before anything is inflated. */
export const IMPORT_ARCHIVE_MAX_UNCOMPRESSED = 5 * 1_048_576;
export const IMPORT_SKILL_MD_MAX_BYTES = 100 * 1024;

/** Archive entries that are scripts or binaries: listed as ignored, never inflated or run. */
export const EXECUTABLE_EXTENSIONS = [
  '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
  '.py', '.js', '.mjs', '.cjs', '.ts', '.rb', '.pl',
  '.exe', '.bin', '.so', '.dll', '.dylib',
] as const;
