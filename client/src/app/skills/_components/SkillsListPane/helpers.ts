import type { SkillListItem } from "@devdigest/shared";

/** Case-insensitive match on name or description. */
export function filterSkills(skills: SkillListItem[], query: string): SkillListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return skills;
  return skills.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
}
