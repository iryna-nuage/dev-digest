/* skill-fields.ts — the editable fields of a skill, shared by the skill editor
   (SkillDetail) and the import drawer: draft → patch, validation (mirrors the
   API via @devdigest/shared limits), token estimate. Pure, no React.
   Runtime values (not just types) come from `@devdigest/shared/contracts/knowledge`:
   the package index re-exports with ESM `.js` specifiers that Next's webpack
   cannot resolve to the vendored `.ts` files; type-only imports are erased. */

import {
  SKILL_BODY_MAX,
  SKILL_DESCRIPTION_MAX,
  SKILL_NAME_PATTERN,
  type Skill,
  type SkillType,
} from "@devdigest/shared/contracts/knowledge";

/** The editable fields of a skill. */
export interface SkillFields {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  enabled: boolean;
}

/** Only the fields the user touched in the form; the rest follow the saved skill. */
export type SkillDraft = Partial<SkillFields>;

export const EMPTY_SKILL_FIELDS: SkillFields = {
  name: "",
  description: "",
  type: "custom",
  body: "",
  enabled: true,
};

export function fieldsOf(skill: Skill | undefined): SkillFields {
  if (!skill) return EMPTY_SKILL_FIELDS;
  const { name, description, type, body, enabled } = skill;
  return { name, description, type, body, enabled };
}

/** What the form shows: the saved values overlaid with the user's edits. */
export function resolveFields(saved: SkillFields, draft: SkillDraft): SkillFields {
  return { ...saved, ...draft };
}

/**
 * The fields to send on Save: every drafted field that differs from the saved
 * skill. Untouched fields are never sent, so a value saved elsewhere meanwhile
 * (the list's Enabled toggle) is not overwritten by a stale form value.
 */
export function buildSkillPatch(saved: SkillFields, draft: SkillDraft): Partial<SkillFields> {
  const patch: Partial<SkillFields> = {};
  for (const key of Object.keys(draft) as (keyof SkillFields)[]) {
    const value = draft[key];
    if (value !== undefined && value !== saved[key]) (patch as Record<string, unknown>)[key] = value;
  }
  return patch;
}

export type SkillFieldErrors = Partial<Record<"name" | "description" | "body", string>>;

/** Client-side mirror of the API's validation; values are `config.*` i18n keys. */
export function validateSkillFields(v: SkillFields): SkillFieldErrors {
  const errors: SkillFieldErrors = {};
  if (!SKILL_NAME_PATTERN.test(v.name)) errors.name = "namePattern";
  if (v.description.trim().length === 0) errors.description = "descriptionRequired";
  else if (v.description.trim().length > SKILL_DESCRIPTION_MAX) errors.description = "descriptionTooLong";
  if (v.body.trim().length === 0) errors.body = "bodyRequired";
  else if (v.body.length > SKILL_BODY_MAX) errors.body = "bodyTooLong";
  return errors;
}

/** Same heuristic as the server tokenizer's fallback: ceil(chars / 4). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
