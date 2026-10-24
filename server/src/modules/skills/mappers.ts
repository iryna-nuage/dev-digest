import type { Skill, SkillSource, SkillType } from '@devdigest/shared';
import type * as t from '../../db/schema.js';

export type SkillRow = typeof t.skills.$inferSelect;

/** Map a persisted `skills` row to the public `Skill` DTO. */
export function toSkill(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as SkillType,
    source: row.source as SkillSource,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: row.evidenceFiles ?? null,
  };
}
