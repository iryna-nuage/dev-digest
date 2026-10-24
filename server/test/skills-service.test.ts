import { describe, it, expect } from 'vitest';
import { formatSkillForPrompt, type Skill, type SkillAgentRef, type SkillListItem } from '@devdigest/shared';
import { acceptRate, initialEnabled, nextVersion, skillPromptMarker } from '../src/modules/skills/domain.js';
import { SkillsService } from '../src/modules/skills/service.js';
import type { NewSkill, SkillPatch, SkillStore, SkillUsage } from '../src/modules/skills/ports.js';
import { ConflictError, PayloadTooLargeError, UnsupportedMediaTypeError, ValidationError } from '../src/platform/errors.js';

/** L02 — skill rules and use cases, against an in-memory SkillStore. */

class FakeSkillStore implements SkillStore {
  skills: Skill[] = [];
  patches: SkillPatch[] = [];
  usage: SkillUsage = { runs: 0, findings: 0, accepted: 0, dismissed: 0 };
  usageCalls: Array<{ marker: string; since: Date }> = [];
  private seq = 0;

  async list(): Promise<SkillListItem[]> {
    return this.skills.map((s) => ({ ...s, agents_count: 0 }));
  }
  async get(_ws: string, id: string) {
    return this.skills.find((s) => s.id === id);
  }
  async findByName(_ws: string, name: string) {
    return this.skills.find((s) => s.name === name);
  }
  async create(_ws: string, input: NewSkill): Promise<Skill> {
    const skill: Skill = { id: `s${++this.seq}`, version: 1, evidence_files: null, ...input };
    this.skills.push(skill);
    return skill;
  }
  async update(_ws: string, id: string, patch: SkillPatch) {
    this.patches.push(patch);
    const s = this.skills.find((x) => x.id === id);
    if (!s) return undefined;
    Object.assign(s, patch);
    return s;
  }
  async delete() {
    return true;
  }
  async agentsUsing(): Promise<SkillAgentRef[]> {
    return [];
  }
  async usageSince(_ws: string, marker: string, since: Date) {
    this.usageCalls.push({ marker, since });
    return this.usage;
  }
  async activeForAgent() {
    return [];
  }
}

const WS = 'ws-1';
const input = { name: 'branch-gate', description: 'Use always.', type: 'rubric' as const, body: '# Gate' };

describe('skill domain rules', () => {
  it('formatSkillForPrompt: heading, description, blank line, body', () => {
    expect(formatSkillForPrompt({ name: 'gate', description: ' Use it. ', body: '\n# Body\n' })).toBe(
      '### Skill: gate\nUse it.\n\n# Body',
    );
  });

  it('imported skills always start disabled; manual ones default to enabled', () => {
    expect(initialEnabled('imported_file', true)).toBe(false);
    expect(initialEnabled('manual', undefined)).toBe(true);
    expect(initialEnabled('manual', false)).toBe(false);
  });

  it('the prompt marker is the first line formatSkillForPrompt writes', () => {
    const block = formatSkillForPrompt({ name: 'gate', description: 'Use it.', body: '# Body' });
    expect(block.startsWith(skillPromptMarker('gate'))).toBe(true);
    // A longer name sharing the prefix is a different skill.
    expect(formatSkillForPrompt({ name: 'gate-2', description: 'x', body: 'y' })).not.toContain(skillPromptMarker('gate'));
  });

  it('accept rate: accepted share of decided findings, null when none is decided', () => {
    expect(acceptRate(0, 0)).toBeNull();
    expect(acceptRate(3, 1)).toBe(75);
    expect(acceptRate(2, 1)).toBe(67);
    expect(acceptRate(0, 4)).toBe(0);
  });

  it('only a changed body bumps the version', () => {
    const existing = { body: 'a', version: 3 };
    expect(nextVersion(existing, { body: 'b' })).toBe(4);
    expect(nextVersion(existing, { body: 'a' })).toBeUndefined();
    expect(nextVersion(existing, {})).toBeUndefined();
  });
});

describe('SkillsService', () => {
  it('stats: last 30 days by the skill name marker, with the accept rate; unknown skill → undefined', async () => {
    const store = new FakeSkillStore();
    const service = new SkillsService({ skills: store });
    const skill = await service.create(WS, input);
    store.usage = { runs: 4, findings: 5, accepted: 3, dismissed: 1 };
    const now = new Date('2026-10-24T12:00:00Z');

    expect(await service.stats(WS, skill.id, now)).toEqual({
      window_days: 30, runs: 4, findings: 5, accepted: 3, dismissed: 1, accept_rate: 75,
    });
    expect(store.usageCalls).toEqual([{ marker: '### Skill: branch-gate\n', since: new Date('2026-09-24T12:00:00Z') }]);
    expect(await service.stats(WS, 'missing', now)).toBeUndefined();
  });

  it('create: rejects a taken name with ConflictError', async () => {
    const service = new SkillsService({ skills: new FakeSkillStore() });
    await service.create(WS, input);
    await expect(service.create(WS, input)).rejects.toBeInstanceOf(ConflictError);
  });

  it('create: an imported skill is stored disabled even if enabled was requested', async () => {
    const service = new SkillsService({ skills: new FakeSkillStore() });
    const s = await service.create(WS, { ...input, source: 'imported_file', enabled: true });
    expect(s).toMatchObject({ source: 'imported_file', enabled: false });
  });

  it('update: sends only the fields given, so an enabled toggle never rewrites other fields', async () => {
    const store = new FakeSkillStore();
    const service = new SkillsService({ skills: store });
    const s = await service.create(WS, input);

    await service.update(WS, s.id, { enabled: false });
    expect(store.patches.at(-1)).toEqual({ enabled: false });

    await service.update(WS, s.id, { description: 'New.', enabled: undefined });
    expect(store.patches.at(-1)).toEqual({ description: 'New.' });
  });

  it('update: a body change carries the next version; an unchanged body does not', async () => {
    const store = new FakeSkillStore();
    const service = new SkillsService({ skills: store });
    const s = await service.create(WS, input);

    await service.update(WS, s.id, { body: '# Gate' });
    expect(store.patches.at(-1)).toEqual({ body: '# Gate' }); // same body → no version

    const updated = await service.update(WS, s.id, { body: '# Gate v2' });
    expect(store.patches.at(-1)).toEqual({ body: '# Gate v2', version: 2 });
    expect(updated?.version).toBe(2);
  });

  it('update: renaming onto another skill conflicts; keeping the name does not', async () => {
    const service = new SkillsService({ skills: new FakeSkillStore() });
    const a = await service.create(WS, input);
    await service.create(WS, { ...input, name: 'other' });
    await expect(service.update(WS, a.id, { name: 'other' })).rejects.toBeInstanceOf(ConflictError);
    await expect(service.update(WS, a.id, { name: 'branch-gate', type: 'custom' })).resolves.toMatchObject({
      type: 'custom',
    });
  });

  it('update / agents: unknown skill → undefined', async () => {
    const service = new SkillsService({ skills: new FakeSkillStore() });
    expect(await service.update(WS, 'nope', { enabled: true })).toBeUndefined();
    expect(await service.agents(WS, 'nope')).toBeUndefined();
  });

  it('importPreview: never writes, adds name_taken, maps failures to error classes', async () => {
    const store = new FakeSkillStore();
    const service = new SkillsService({ skills: store });
    await service.create(WS, input);
    const b64 = (s: string) => Buffer.from(s).toString('base64');

    const preview = await service.importPreview(WS, 'x.md', b64('---\nname: branch-gate\n---\n# Body'));
    expect(preview.warnings.map((w) => w.code)).toContain('name_taken');
    expect(store.skills).toHaveLength(1);

    await expect(service.importPreview(WS, 'x.exe', b64('x'))).rejects.toBeInstanceOf(UnsupportedMediaTypeError);
    await expect(service.importPreview(WS, 'x.zip', b64('garbage'))).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.importPreview(WS, 'x.md', Buffer.alloc(1_048_577).toString('base64')),
    ).rejects.toBeInstanceOf(PayloadTooLargeError);
  });
});
