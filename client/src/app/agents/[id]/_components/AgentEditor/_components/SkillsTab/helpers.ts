import type { SkillListItem } from "@devdigest/shared";

export interface SkillRow {
  skill: SkillListItem;
  /** Position in the agent's prompt order; -1 = not attached. */
  index: number;
}

/** Attached skills first, in link order; then the rest by name. */
export function orderRows(skills: SkillListItem[], attachedIds: string[]): SkillRow[] {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const attached = attachedIds
    .map((id) => byId.get(id))
    .filter((s): s is SkillListItem => !!s)
    .map((skill, index) => ({ skill, index }));
  const linked = new Set(attachedIds);
  const rest = skills
    .filter((s) => !linked.has(s.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((skill) => ({ skill, index: -1 }));
  return [...attached, ...rest];
}

/** Checking appends the skill to the end; unchecking removes it. */
export function toggleAttached(ids: string[], id: string, attach: boolean): string[] {
  const without = ids.filter((x) => x !== id);
  return attach ? [...without, id] : without;
}

/** Move the item at `from` to `to` (clamped). Same array when nothing moves. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const target = Math.max(0, Math.min(items.length - 1, to));
  if (from === target || from < 0 || from >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved as T);
  return next;
}

export function filterRows(rows: SkillRow[], query: string): SkillRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => r.skill.name.toLowerCase().includes(q) || r.skill.description.toLowerCase().includes(q));
}
