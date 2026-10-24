import type { SkillImportPreview } from '@devdigest/shared';

/** Why an upload was rejected. The service maps each reason to an HTTP error class. */
export type ImportFailureReason =
  | 'unsupported_type'
  | 'file_too_large'
  | 'invalid_file'
  | 'invalid_archive'
  | 'archive_too_large'
  | 'no_skill_md'
  | 'ambiguous_skill_md'
  | 'skill_too_large'
  | 'empty_body';

export interface ImportFailure {
  ok: false;
  reason: ImportFailureReason;
  /** User-facing explanation, shown in the import drawer as is. */
  message: string;
}

export interface ImportSuccess {
  ok: true;
  preview: SkillImportPreview;
}

export type ImportResult = ImportSuccess | ImportFailure;
