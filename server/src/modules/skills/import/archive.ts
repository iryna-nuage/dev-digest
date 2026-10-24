import { unzipSync, type UnzipFileInfo } from 'fflate';
import type { SkillImportIgnoredFile } from '@devdigest/shared';
import {
  EXECUTABLE_EXTENSIONS,
  IMPORT_ARCHIVE_MAX_ENTRIES,
  IMPORT_ARCHIVE_MAX_UNCOMPRESSED,
  IMPORT_SKILL_MD_MAX_BYTES,
} from '../constants.js';
import type { ImportFailure } from './types.js';

/**
 * Reads ONE file — `SKILL.md` — out of a `.zip`, entirely in memory. Every
 * other entry is only listed (from the central directory) and never inflated,
 * written to disk or executed. Limits are checked against the declared sizes
 * before anything is decompressed.
 */

export interface ArchiveSkill {
  ok: true;
  /** Raw bytes of the chosen SKILL.md. */
  skillMd: Uint8Array;
  /** Top-level folder holding SKILL.md, if it is not at the archive root. */
  folder?: string;
  ignored: SkillImportIgnoredFile[];
}

const SKILL_MD = /^(?:([^/]+)\/)?skill\.md$/i;

export function isExecutablePath(path: string): boolean {
  const lower = path.toLowerCase();
  if (lower.split('/').includes('scripts')) return true;
  return EXECUTABLE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function readSkillArchive(bytes: Uint8Array): ArchiveSkill | ImportFailure {
  const entries: UnzipFileInfo[] = [];
  try {
    // First pass: collect the central directory without inflating anything.
    unzipSync(bytes, {
      filter: (file) => {
        entries.push({ ...file, name: file.name.replace(/\\/g, '/') });
        return false;
      },
    });
  } catch {
    return { ok: false, reason: 'invalid_archive', message: 'The archive is corrupt or not a zip file.' };
  }

  const files = entries.filter((e) => !e.name.endsWith('/'));
  const declared = files.reduce((n, e) => n + e.originalSize, 0);
  if (files.length > IMPORT_ARCHIVE_MAX_ENTRIES || declared > IMPORT_ARCHIVE_MAX_UNCOMPRESSED) {
    return {
      ok: false,
      reason: 'archive_too_large',
      message: `The archive is too large: at most ${IMPORT_ARCHIVE_MAX_ENTRIES} files and ${IMPORT_ARCHIVE_MAX_UNCOMPRESSED / 1_048_576} MB uncompressed.`,
    };
  }

  const skillMds = files.filter((e) => SKILL_MD.test(e.name));
  const atRoot = skillMds.filter((e) => !e.name.includes('/'));
  const inFolder = skillMds.filter((e) => e.name.includes('/'));
  const candidates = atRoot.length > 0 ? atRoot : inFolder;
  if (candidates.length === 0) {
    return {
      ok: false,
      reason: 'no_skill_md',
      message: 'No SKILL.md found at the archive root or in its top-level folder.',
    };
  }
  if (candidates.length > 1) {
    return {
      ok: false,
      reason: 'ambiguous_skill_md',
      message: 'The archive contains more than one SKILL.md; import one skill per archive.',
    };
  }

  const chosen = candidates[0]!;
  if (chosen.originalSize > IMPORT_SKILL_MD_MAX_BYTES) {
    return {
      ok: false,
      reason: 'skill_too_large',
      message: `SKILL.md is larger than ${IMPORT_SKILL_MD_MAX_BYTES / 1024} KB.`,
    };
  }

  let skillMd: Uint8Array | undefined;
  try {
    // Second pass: inflate SKILL.md only.
    const out = unzipSync(bytes, { filter: (file) => file.name.replace(/\\/g, '/') === chosen.name });
    skillMd = Object.values(out)[0];
  } catch {
    return { ok: false, reason: 'invalid_archive', message: 'SKILL.md could not be extracted from the archive.' };
  }
  if (!skillMd || skillMd.length > IMPORT_SKILL_MD_MAX_BYTES) {
    return {
      ok: false,
      reason: 'skill_too_large',
      message: `SKILL.md is larger than ${IMPORT_SKILL_MD_MAX_BYTES / 1024} KB.`,
    };
  }

  const folder = SKILL_MD.exec(chosen.name)?.[1];
  return {
    ok: true,
    skillMd,
    ...(folder ? { folder } : {}),
    ignored: files
      .filter((e) => e !== chosen)
      .map((e) => ({ path: e.name, executable: isExecutablePath(e.name) })),
  };
}
