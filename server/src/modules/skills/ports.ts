import type { Skill, SkillAgentRef, SkillListItem, SkillSource, SkillType } from '@devdigest/shared';

/** A skill ready to insert (validated, `enabled` already decided by the domain). */
export interface NewSkill {
  name: string;
  description: string;
  type: SkillType;
  source: SkillSource;
  body: string;
  enabled: boolean;
}

/** Field changes for an existing skill. `version` set ⇒ the body changed: snapshot it. */
export interface SkillPatch {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
  version?: number;
}

/** Runs whose prompt carried a skill, and those runs' findings. */
export interface SkillUsage {
  runs: number;
  findings: number;
  accepted: number;
  dismissed: number;
}

/** Persistence port for skills. Every method is scoped to one workspace. */
export interface SkillStore {
  list(workspaceId: string): Promise<SkillListItem[]>;
  get(workspaceId: string, id: string): Promise<Skill | undefined>;
  findByName(workspaceId: string, name: string): Promise<Skill | undefined>;
  /** Insert the skill and its version-1 snapshot atomically. */
  create(workspaceId: string, input: NewSkill): Promise<Skill>;
  /** Apply the patch; with `version`, also record the new body in `skill_versions` atomically. */
  update(workspaceId: string, id: string, patch: SkillPatch): Promise<Skill | undefined>;
  delete(workspaceId: string, id: string): Promise<boolean>;
  agentsUsing(workspaceId: string, skillId: string): Promise<SkillAgentRef[]>;
  /** Usage of runs since `since` whose stored prompt contains `marker`. */
  usageSince(workspaceId: string, marker: string, since: Date): Promise<SkillUsage>;
  /** Skills attached to the agent AND globally enabled, in the agent's link order. */
  activeForAgent(workspaceId: string, agentId: string): Promise<Skill[]>;
}
