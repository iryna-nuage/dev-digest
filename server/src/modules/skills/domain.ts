import type { Skill, SkillSource } from '@devdigest/shared';

/**
 * Pure skill rules (L02). No I/O: the service loads and saves through the
 * `SkillStore` port and asks these functions what to do.
 */

/** Imported skills are stored disabled until the user vets and enables them. */
export function initialEnabled(source: SkillSource, requested: boolean | undefined): boolean {
  if (source === 'imported_file') return false;
  return requested ?? true;
}

/**
 * The version a patch should land on: a changed body bumps it (and the
 * repository snapshots the new body); any other edit keeps it.
 */
export function nextVersion(existing: Pick<Skill, 'body' | 'version'>, patch: { body?: string }): number | undefined {
  if (patch.body === undefined || patch.body === existing.body) return undefined;
  return existing.version + 1;
}

/**
 * The line `formatSkillForPrompt` opens a skill's block with. A run carried the
 * skill iff its trace's `prompt_assembly.skills` contains this string.
 */
export function skillPromptMarker(name: string): string {
  return `### Skill: ${name}\n`;
}

/** Accepted share of decided findings, 0–100; null while none is decided. */
export function acceptRate(accepted: number, dismissed: number): number | null {
  const decided = accepted + dismissed;
  return decided === 0 ? null : Math.round((accepted / decided) * 100);
}

/** True when renaming `existing` to `name` needs a uniqueness check. */
export function isRename(existing: Pick<Skill, 'name'>, name: string | undefined): name is string {
  return name !== undefined && name !== existing.name;
}
