import { and, asc, eq, gte, sql } from 'drizzle-orm';
import type { Skill, SkillAgentRef, SkillListItem } from '@devdigest/shared';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';
import { toSkill } from './mappers.js';
import type { NewSkill, SkillPatch, SkillStore, SkillUsage } from './ports.js';

/**
 * Skills data-access (L02): `skills`, `skill_versions`, and the read side of
 * `agent_skills` (who uses a skill, which skills an agent runs with). The
 * agents module owns writes to `agent_skills`. Workspace-scoped throughout.
 */
export class SkillsRepository implements SkillStore {
  constructor(private db: Db) {}

  async list(workspaceId: string): Promise<SkillListItem[]> {
    const rows = await this.db
      .select({ skill: t.skills, agentsCount: sql<number>`count(${t.agentSkills.agentId})::int` })
      .from(t.skills)
      .leftJoin(t.agentSkills, eq(t.agentSkills.skillId, t.skills.id))
      .where(eq(t.skills.workspaceId, workspaceId))
      .groupBy(t.skills.id)
      .orderBy(asc(t.skills.name));
    return rows.map((r) => ({ ...toSkill(r.skill), agents_count: r.agentsCount }));
  }

  async get(workspaceId: string, id: string): Promise<Skill | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
    return row ? toSkill(row) : undefined;
  }

  async findByName(workspaceId: string, name: string): Promise<Skill | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.name, name)));
    return row ? toSkill(row) : undefined;
  }

  async create(workspaceId: string, input: NewSkill): Promise<Skill> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(t.skills)
        .values({ workspaceId, ...input, version: 1 })
        .returning();
      await tx.insert(t.skillVersions).values({ skillId: row!.id, version: 1, body: row!.body });
      return toSkill(row!);
    });
  }

  async update(workspaceId: string, id: string, patch: SkillPatch): Promise<Skill | undefined> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(t.skills)
        .set(patch)
        .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
        .returning();
      if (!row) return undefined;
      if (patch.version !== undefined) {
        await tx.insert(t.skillVersions).values({ skillId: row.id, version: row.version, body: row.body });
      }
      return toSkill(row);
    });
  }

  /** Links and version snapshots cascade. */
  async delete(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning({ id: t.skills.id });
    return rows.length > 0;
  }

  async agentsUsing(workspaceId: string, skillId: string): Promise<SkillAgentRef[]> {
    return this.db
      .select({ id: t.agents.id, name: t.agents.name, enabled: t.agents.enabled })
      .from(t.agentSkills)
      .innerJoin(t.agents, eq(t.agentSkills.agentId, t.agents.id))
      .where(and(eq(t.agentSkills.skillId, skillId), eq(t.agents.workspaceId, workspaceId)))
      .orderBy(asc(t.agents.name));
  }

  /**
   * Reads the run trace (`run_traces.trace` jsonb), where the executor stores the
   * exact skills text of each run's prompt. No skill ↔ run table: matching by
   * the prompt marker means a rename leaves older runs uncounted.
   */
  async usageSince(workspaceId: string, marker: string, since: Date): Promise<SkillUsage> {
    const [row] = await this.db
      .select({
        runs: sql<number>`count(distinct ${t.agentRuns.id})::int`,
        findings: sql<number>`count(${t.findings.id})::int`,
        accepted: sql<number>`count(${t.findings.acceptedAt})::int`,
        dismissed: sql<number>`count(${t.findings.dismissedAt})::int`,
      })
      .from(t.agentRuns)
      .innerJoin(t.runTraces, eq(t.runTraces.runId, t.agentRuns.id))
      .leftJoin(t.reviews, eq(t.reviews.runId, t.agentRuns.id))
      .leftJoin(t.findings, eq(t.findings.reviewId, t.reviews.id))
      .where(
        and(
          eq(t.agentRuns.workspaceId, workspaceId),
          gte(t.agentRuns.ranAt, since),
          sql`strpos(${t.runTraces.trace}->'prompt_assembly'->>'skills', ${marker}) > 0`,
        ),
      );
    return row ?? { runs: 0, findings: 0, accepted: 0, dismissed: 0 };
  }

  async activeForAgent(workspaceId: string, agentId: string): Promise<Skill[]> {
    const rows = await this.db
      .select({ skill: t.skills })
      .from(t.agentSkills)
      .innerJoin(t.skills, eq(t.agentSkills.skillId, t.skills.id))
      .where(
        and(
          eq(t.agentSkills.agentId, agentId),
          eq(t.skills.workspaceId, workspaceId),
          eq(t.skills.enabled, true),
        ),
      )
      .orderBy(asc(t.agentSkills.order));
    return rows.map((r) => toSkill(r.skill));
  }
}
