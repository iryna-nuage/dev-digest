import type {
  Skill,
  SkillAgentRef,
  SkillImportPreview,
  SkillListItem,
  SkillStats,
  SkillType,
} from '@devdigest/shared';
import {
  ConflictError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  ValidationError,
} from '../../platform/errors.js';
import { SKILL_STATS_WINDOW_DAYS } from './constants.js';
import { acceptRate, initialEnabled, isRename, nextVersion, skillPromptMarker } from './domain.js';
import { decodeUpload, extractSkill } from './import/extract.js';
import type { ImportFailure } from './import/types.js';
import type { SkillPatch, SkillStore } from './ports.js';

/**
 * Skills use cases (L02): CRUD over reusable, text-only review skills and the
 * import preview. Attaching skills to agents lives in the agents module; the
 * review executor reads the active ones through `SkillStore.activeForAgent`.
 */

export interface SkillsServiceDeps {
  skills: SkillStore;
}

export interface CreateSkillInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  enabled?: boolean;
  source?: 'manual' | 'imported_file';
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
}

function importError(failure: ImportFailure): Error {
  const details = { reason: failure.reason };
  switch (failure.reason) {
    case 'unsupported_type':
      return new UnsupportedMediaTypeError(failure.message, details);
    case 'file_too_large':
    case 'archive_too_large':
    case 'skill_too_large':
      return new PayloadTooLargeError(failure.message, details);
    default:
      return new ValidationError(failure.message, details);
  }
}

export class SkillsService {
  constructor(private deps: SkillsServiceDeps) {}

  list(workspaceId: string): Promise<SkillListItem[]> {
    return this.deps.skills.list(workspaceId);
  }

  get(workspaceId: string, id: string): Promise<Skill | undefined> {
    return this.deps.skills.get(workspaceId, id);
  }

  async create(workspaceId: string, input: CreateSkillInput): Promise<Skill> {
    await this.assertNameFree(workspaceId, input.name);
    const source = input.source ?? 'manual';
    return this.deps.skills.create(workspaceId, {
      name: input.name,
      description: input.description,
      type: input.type,
      body: input.body,
      source,
      enabled: initialEnabled(source, input.enabled),
    });
  }

  async update(workspaceId: string, id: string, input: UpdateSkillInput): Promise<Skill | undefined> {
    const existing = await this.deps.skills.get(workspaceId, id);
    if (!existing) return undefined;
    if (isRename(existing, input.name)) await this.assertNameFree(workspaceId, input.name);

    const patch: SkillPatch = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined),
    );
    const version = nextVersion(existing, input);
    if (version !== undefined) patch.version = version;
    if (Object.keys(patch).length === 0) return existing;
    return this.deps.skills.update(workspaceId, id, patch);
  }

  delete(workspaceId: string, id: string): Promise<boolean> {
    return this.deps.skills.delete(workspaceId, id);
  }

  /** Agents attaching the skill; undefined when the skill isn't in this workspace. */
  async agents(workspaceId: string, id: string): Promise<SkillAgentRef[] | undefined> {
    const skill = await this.deps.skills.get(workspaceId, id);
    if (!skill) return undefined;
    return this.deps.skills.agentsUsing(workspaceId, id);
  }

  /** Stats tab: runs of the last window whose prompt carried the skill; undefined when not in this workspace. */
  async stats(workspaceId: string, id: string, now = new Date()): Promise<SkillStats | undefined> {
    const skill = await this.deps.skills.get(workspaceId, id);
    if (!skill) return undefined;
    const since = new Date(now.getTime() - SKILL_STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const usage = await this.deps.skills.usageSince(workspaceId, skillPromptMarker(skill.name), since);
    return {
      window_days: SKILL_STATS_WINDOW_DAYS,
      ...usage,
      accept_rate: acceptRate(usage.accepted, usage.dismissed),
    };
  }

  /** Parse an upload into a preview. Never writes: saving is a separate `create`. */
  async importPreview(workspaceId: string, filename: string, contentBase64: string): Promise<SkillImportPreview> {
    const bytes = decodeUpload(contentBase64);
    if (!(bytes instanceof Uint8Array)) throw importError(bytes);
    const result = extractSkill(filename, bytes);
    if (!result.ok) throw importError(result);

    const preview = result.preview;
    if (await this.deps.skills.findByName(workspaceId, preview.name)) {
      preview.warnings.push({
        code: 'name_taken',
        message: `A skill named "${preview.name}" already exists. Rename it before saving.`,
      });
    }
    return preview;
  }

  private async assertNameFree(workspaceId: string, name: string): Promise<void> {
    if (await this.deps.skills.findByName(workspaceId, name)) {
      throw new ConflictError(`A skill named "${name}" already exists`, { field: 'name' });
    }
  }
}
