/** Accepted upload types and size (server: `server/src/modules/skills/constants.ts`). */
export const IMPORT_EXTENSIONS = [".md", ".zip"] as const;
export const IMPORT_ACCEPT = IMPORT_EXTENSIONS.join(",");
export const IMPORT_MAX_BYTES = 1_048_576;
