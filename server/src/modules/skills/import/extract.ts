import { SkillType, type SkillImportWarning } from '@devdigest/shared';
import {
  IMPORT_FILE_MAX_BYTES,
  IMPORT_SKILL_MD_MAX_BYTES,
  IMPORTED_SKILL_FALLBACK_NAME,
  SKILL_BODY_MAX,
  SKILL_DESCRIPTION_MAX,
  SKILL_NAME_MAX,
  SKILL_NAME_PATTERN,
} from '../constants.js';
import { readSkillArchive } from './archive.js';
import { firstHeading, parseSkillMarkdown } from './markdown.js';
import type { ImportFailure, ImportResult } from './types.js';

/**
 * Upload → skill preview. Text extraction only: a `.md` file is decoded, a
 * `.zip` yields its `SKILL.md`; nothing is persisted, written to disk or run.
 */

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** Decode the request's base64 payload, enforcing the upload size limit. */
export function decodeUpload(contentBase64: string): Uint8Array | ImportFailure {
  const compact = contentBase64.replace(/\s+/g, '');
  if (compact.length % 4 !== 0 || !BASE64.test(compact)) {
    return { ok: false, reason: 'invalid_file', message: 'The upload is not valid base64.' };
  }
  const bytes = Buffer.from(compact, 'base64');
  if (bytes.length > IMPORT_FILE_MAX_BYTES) return tooLarge();
  return new Uint8Array(bytes);
}

function tooLarge(): ImportFailure {
  return {
    ok: false,
    reason: 'file_too_large',
    message: `The file is larger than ${IMPORT_FILE_MAX_BYTES / 1_048_576} MB.`,
  };
}

/** lowercase kebab-case, ≤ 64 chars; '' when nothing usable is left. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SKILL_NAME_MAX)
    .replace(/-+$/g, '');
}

function baseName(filename: string): string {
  const last = filename.replace(/\\/g, '/').split('/').pop() ?? filename;
  return last.replace(/\.[^.]+$/, '');
}

function decodeText(bytes: Uint8Array): string | undefined {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return text.includes('\u0000') ? undefined : text;
  } catch {
    return undefined;
  }
}

const URL_RE = /\bhttps?:\/\/\S+/i;
const TOOLS_RE =
  /```\s*(?:bash|sh|shell|zsh|powershell|pwsh|ps1|cmd|bat)\b|\bscripts\/|\b(?:run|execute|invoke)\s+(?:the\s+|this\s+)?(?:script|command|tool)s?\b/i;
const SUSPICIOUS_RE =
  /\bignore\s+(?:all\s+|any\s+)?(?:previous|prior|above|earlier)\s+instructions\b|\bdisregard\s+(?:the\s+|all\s+)?(?:previous|prior|system)\b|\byou\s+are\s+now\b|\bsystem\s+prompt\b/i;

export function extractSkill(filename: string, bytes: Uint8Array): ImportResult {
  const lower = filename.toLowerCase();
  const kind = lower.endsWith('.md') ? 'md' : lower.endsWith('.zip') ? 'zip' : undefined;
  if (!kind) {
    return { ok: false, reason: 'unsupported_type', message: 'Only .md and .zip files can be imported.' };
  }
  if (bytes.length > IMPORT_FILE_MAX_BYTES) return tooLarge();

  let raw: Uint8Array;
  let folder: string | undefined;
  let ignored: { path: string; executable: boolean }[] = [];
  if (kind === 'zip') {
    const archive = readSkillArchive(bytes);
    if (!archive.ok) return archive;
    raw = archive.skillMd;
    folder = archive.folder;
    ignored = archive.ignored;
  } else {
    if (bytes.length > IMPORT_SKILL_MD_MAX_BYTES) {
      return {
        ok: false,
        reason: 'skill_too_large',
        message: `The skill file is larger than ${IMPORT_SKILL_MD_MAX_BYTES / 1024} KB.`,
      };
    }
    raw = bytes;
  }

  const text = decodeText(raw);
  if (text === undefined) {
    return { ok: false, reason: 'invalid_file', message: 'The skill file is not UTF-8 text.' };
  }

  const parsed = parseSkillMarkdown(text);
  if (parsed.body.length === 0) {
    return { ok: false, reason: 'empty_body', message: 'The skill file has no Markdown body.' };
  }
  if (parsed.body.length > SKILL_BODY_MAX) {
    return {
      ok: false,
      reason: 'skill_too_large',
      message: `The skill body is longer than ${SKILL_BODY_MAX.toLocaleString('en-US')} characters.`,
    };
  }

  const name =
    [parsed.meta.name, firstHeading(parsed.body), folder, baseName(filename)]
      .map((c) => (c ? slugify(c) : ''))
      .find((c) => SKILL_NAME_PATTERN.test(c)) ?? IMPORTED_SKILL_FALLBACK_NAME;
  const typeParse = SkillType.safeParse(parsed.meta.type?.toLowerCase());
  const description = parsed.meta.description?.trim() ?? '';

  const warnings: SkillImportWarning[] = [];
  const executables = ignored.filter((f) => f.executable).length;
  const others = ignored.length - executables;
  if (executables > 0) {
    warnings.push({
      code: 'executable_ignored',
      message: `${executables} executable file(s) ignored. Scripts and binaries are never run or stored.`,
    });
  }
  if (others > 0) {
    warnings.push({
      code: 'extra_files_ignored',
      message: `${others} other file(s) ignored. Only SKILL.md is imported.`,
    });
  }
  if (parsed.ignoredKeys.length > 0) {
    warnings.push({
      code: 'frontmatter_keys_ignored',
      message: `Frontmatter keys ignored: ${parsed.ignoredKeys.join(', ')}.`,
    });
  }
  if (parsed.meta.type && !typeParse.success) {
    warnings.push({
      code: 'type_unknown',
      message: `Unknown type "${parsed.meta.type}"; using "custom".`,
    });
  }
  if (!description) {
    warnings.push({
      code: 'description_missing',
      message: 'No description found. Write one before saving: when to apply the skill and what to check.',
    });
  } else if (description.length > SKILL_DESCRIPTION_MAX) {
    warnings.push({
      code: 'description_too_long',
      message: `The description is longer than ${SKILL_DESCRIPTION_MAX} characters; shorten it before saving.`,
    });
  }
  if (URL_RE.test(parsed.body)) {
    warnings.push({
      code: 'contains_urls',
      message: 'The body contains links. Skills are plain text: the agent cannot open them.',
    });
  }
  if (TOOLS_RE.test(parsed.body)) {
    warnings.push({
      code: 'mentions_tools',
      message: 'The body refers to scripts, commands or tools. They are not available to the review agent.',
    });
  }
  if (SUSPICIOUS_RE.test(text)) {
    warnings.push({
      code: 'suspicious_instructions',
      message: 'The text tries to override the agent’s instructions. Read it carefully before enabling.',
    });
  }

  return {
    ok: true,
    preview: {
      filename,
      name,
      description,
      type: typeParse.success ? typeParse.data : 'custom',
      body: parsed.body,
      ignored_files: ignored,
      warnings,
    },
  };
}
