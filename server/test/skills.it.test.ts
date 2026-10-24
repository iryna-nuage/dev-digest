import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { strToU8, zipSync } from 'fflate';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { waitForPrRuns } from './helpers/runs.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed, TEST_QUALITY_REVIEWER } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockEmbedder, MockGitClient, MockGitHubClient, MockLLMProvider } from '../src/adapters/mocks.js';
import type { Review } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[skills] Docker not available — skipping integration tests.');
}

const DIFF = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -10,3 +10,4 @@
   port: 3000,
+  retries: 3,
   redisUrl: x,`;

const EMPTY_REVIEW: Review = { verdict: 'approve', summary: 'ok', score: 100, findings: [] };

/**
 * L02 — skills: CRUD + versions, name conflicts, workspace isolation, import
 * preview (writes nothing), agent links (order, duplicates, foreign skills,
 * atomicity), and the executor passing exactly the active skills to the prompt.
 */
d('skills (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let foreignSkillId: string;

  beforeAll(async () => {
    pg = await startPg();
    ({ workspaceId } = await seed(pg.handle.db));
    // A skill in ANOTHER workspace: must be invisible from the default context.
    const [ws2] = await pg.handle.db.insert(t.workspaces).values({ name: 'other' }).returning();
    const [foreign] = await pg.handle.db
      .insert(t.skills)
      .values({
        workspaceId: ws2!.id,
        name: 'foreign-skill',
        description: 'x',
        type: 'custom',
        source: 'manual',
        body: 'x',
      })
      .returning();
    foreignSkillId = foreign!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp(llm = new MockLLMProvider('openai', { structured: EMPTY_REVIEW })) {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        embedder: new MockEmbedder(),
        git: new MockGitClient({ diff: DIFF }),
        github: new MockGitHubClient(),
        // Seeded agents use `openrouter`; server/.env keys would otherwise reach the real API.
        llm: { openai: llm, openrouter: llm },
      },
    });
  }

  let seq = 0;
  const body = (over: Record<string, unknown> = {}) => ({
    name: `skill-${seq++}`,
    description: 'Use when testing.',
    type: 'rubric',
    body: '# Rule\nDo the thing.',
    ...over,
  });

  it('seed: Test Quality Reviewer has its two skills attached in order', async () => {
    const app = await makeApp();
    const agents = (await app.inject({ method: 'GET', url: '/agents' })).json();
    const tq = agents.find((a: { name: string }) => a.name === TEST_QUALITY_REVIEWER);
    expect(tq).toBeDefined();
    const links = (await app.inject({ method: 'GET', url: `/agents/${tq.id}/skills` })).json();
    const skills = (await app.inject({ method: 'GET', url: '/skills' })).json();
    const nameOf = (id: string) => skills.find((s: { id: string }) => s.id === id)?.name;
    expect(links.map((l: { skill_id: string }) => nameOf(l.skill_id))).toEqual([
      'branch-coverage-gate',
      'mocking-discipline',
    ]);
    await app.close();
  });

  it('CRUD: create (201, v1 snapshot), list with agents_count, get, update, delete cascades', async () => {
    const app = await makeApp();
    const created = await app.inject({ method: 'POST', url: '/skills', payload: body() });
    expect(created.statusCode).toBe(201);
    const skill = created.json();
    expect(skill).toMatchObject({ source: 'manual', enabled: true, version: 1 });

    const versions = await pg.handle.db.select().from(t.skillVersions).where(eq(t.skillVersions.skillId, skill.id));
    expect(versions.map((v) => v.version)).toEqual([1]);

    const list = (await app.inject({ method: 'GET', url: '/skills' })).json();
    expect(list.find((s: { id: string }) => s.id === skill.id)).toMatchObject({ agents_count: 0 });
    expect(list.some((s: { id: string }) => s.id === foreignSkillId)).toBe(false);

    // Non-body edit: same version, no snapshot.
    const renamed = (
      await app.inject({ method: 'PUT', url: `/skills/${skill.id}`, payload: { description: 'Use always.' } })
    ).json();
    expect(renamed).toMatchObject({ description: 'Use always.', version: 1 });

    // Body edit: version 2 + snapshot.
    const edited = (
      await app.inject({ method: 'PUT', url: `/skills/${skill.id}`, payload: { body: '# Rule v2' } })
    ).json();
    expect(edited.version).toBe(2);
    const v2 = await pg.handle.db.select().from(t.skillVersions).where(eq(t.skillVersions.skillId, skill.id));
    expect(v2.map((v) => [v.version, v.body]).sort()).toEqual([
      [1, '# Rule\nDo the thing.'],
      [2, '# Rule v2'],
    ]);

    // Toggling enabled leaves the other fields as they are.
    const toggled = (
      await app.inject({ method: 'PUT', url: `/skills/${skill.id}`, payload: { enabled: false } })
    ).json();
    expect(toggled).toMatchObject({ enabled: false, body: '# Rule v2', description: 'Use always.', version: 2 });

    // Attach to an agent, then delete: the link cascades.
    const agentId = (await app.inject({ method: 'GET', url: '/agents' })).json()[0].id;
    await app.inject({ method: 'POST', url: `/agents/${agentId}/skills`, payload: { skill_id: skill.id } });
    const del = await app.inject({ method: 'DELETE', url: `/skills/${skill.id}` });
    expect(del.statusCode).toBe(200);
    const links = await pg.handle.db.select().from(t.agentSkills).where(eq(t.agentSkills.skillId, skill.id));
    expect(links).toHaveLength(0);
    expect((await app.inject({ method: 'GET', url: `/skills/${skill.id}` })).statusCode).toBe(404);
    await app.close();
  });

  it('validation: kebab-case name, required description/body, duplicate name → 409', async () => {
    const app = await makeApp();
    const bad = await app.inject({ method: 'POST', url: '/skills', payload: body({ name: 'Bad Name' }) });
    expect(bad.statusCode).toBe(422);
    const noDesc = await app.inject({ method: 'POST', url: '/skills', payload: body({ description: '  ' }) });
    expect(noDesc.statusCode).toBe(422);
    const noBody = await app.inject({ method: 'POST', url: '/skills', payload: body({ body: '   ' }) });
    expect(noBody.statusCode).toBe(422);

    const first = (await app.inject({ method: 'POST', url: '/skills', payload: body({ name: 'dup-name' }) })).json();
    const dup = await app.inject({ method: 'POST', url: '/skills', payload: body({ name: 'dup-name' }) });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe('conflict');

    const other = (await app.inject({ method: 'POST', url: '/skills', payload: body() })).json();
    const rename = await app.inject({ method: 'PUT', url: `/skills/${other.id}`, payload: { name: 'dup-name' } });
    expect(rename.statusCode).toBe(409);
    // A foreign workspace's name does not conflict.
    const sameAsForeign = await app.inject({ method: 'POST', url: '/skills', payload: body({ name: 'foreign-skill' }) });
    expect(sameAsForeign.statusCode).toBe(201);
    expect(first.name).toBe('dup-name');
    await app.close();
  });

  it('workspace isolation: a foreign skill is 404 everywhere', async () => {
    const app = await makeApp();
    for (const [method, url] of [
      ['GET', `/skills/${foreignSkillId}`],
      ['GET', `/skills/${foreignSkillId}/agents`],
      ['DELETE', `/skills/${foreignSkillId}`],
    ] as const) {
      expect((await app.inject({ method, url })).statusCode).toBe(404);
    }
    const put = await app.inject({ method: 'PUT', url: `/skills/${foreignSkillId}`, payload: { enabled: false } });
    expect(put.statusCode).toBe(404);

    const agentId = (await app.inject({ method: 'GET', url: '/agents' })).json()[0].id;
    const linkAll = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_ids: [foreignSkillId] },
    });
    expect(linkAll.statusCode).toBe(404);
    const linkOne = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_id: foreignSkillId },
    });
    expect(linkOne.statusCode).toBe(404);
    await app.close();
  });

  it('import preview: .md and .zip are parsed, nothing is written, bad files get clear errors', async () => {
    const app = await makeApp();
    const before = (await pg.handle.db.select().from(t.skills)).length;
    const b64 = (bytes: Uint8Array | string) => Buffer.from(bytes).toString('base64');

    const md = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: {
        filename: 'edge.md',
        content_base64: b64('---\nname: edge-case-checklist\ndescription: Use when tests change.\ntype: rubric\n---\n# Edge\nbody'),
      },
    });
    expect(md.statusCode).toBe(200);
    expect(md.json()).toMatchObject({ name: 'edge-case-checklist', type: 'rubric', ignored_files: [] });

    const zip = zipSync({
      'api-contract-tests/SKILL.md': strToU8('---\ndescription: d\n---\n# Api contract tests\nbody'),
      'api-contract-tests/scripts/check.sh': strToU8('rm -rf /'),
    });
    const z = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename: 'api.zip', content_base64: b64(zip) },
    });
    expect(z.statusCode).toBe(200);
    expect(z.json().ignored_files).toEqual([{ path: 'api-contract-tests/scripts/check.sh', executable: true }]);

    const unsupported = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename: 'x.pdf', content_base64: b64('x') },
    });
    expect(unsupported.statusCode).toBe(415);
    expect(unsupported.json().error.details).toEqual({ reason: 'unsupported_type' });

    const corrupt = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename: 'x.zip', content_base64: b64('nope') },
    });
    expect(corrupt.statusCode).toBe(422);
    expect(corrupt.json().error.details).toEqual({ reason: 'invalid_archive' });

    // 1.2 MB file: over the 1 MB file limit, under the 2 MB route body limit → 413 from the service.
    const big = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename: 'x.md', content_base64: b64(new Uint8Array(1_200_000)) },
    });
    expect(big.statusCode).toBe(413);
    expect(big.json().error.details).toEqual({ reason: 'file_too_large' });

    expect((await pg.handle.db.select().from(t.skills)).length).toBe(before);
    expect((await pg.handle.db.select().from(t.skillVersions)).length).toBeGreaterThan(0);
    await app.close();
  });

  it('confirmed import is stored as imported_file and disabled', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: body({ source: 'imported_file', enabled: true }),
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ source: 'imported_file', enabled: false });
    await app.close();
  });

  it('agent links: order persists, duplicates 422, a failed set keeps the old links', async () => {
    const app = await makeApp();
    const agentId = (await app.inject({ method: 'POST', url: '/agents', payload: {
      name: 'Linker', provider: 'openai', model: 'gpt-4.1', system_prompt: 'x',
    } })).json().id;
    const a = (await app.inject({ method: 'POST', url: '/skills', payload: body() })).json();
    const b = (await app.inject({ method: 'POST', url: '/skills', payload: body() })).json();

    const set = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_ids: [b.id, a.id] },
    });
    expect(set.statusCode).toBe(200);
    expect(set.json().map((l: { skill_id: string; order: number }) => [l.skill_id, l.order])).toEqual([
      [b.id, 0],
      [a.id, 1],
    ]);

    const dup = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_ids: [a.id, a.id] },
    });
    expect(dup.statusCode).toBe(422);

    const mixed = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_ids: [a.id, foreignSkillId] },
    });
    expect(mixed.statusCode).toBe(404);
    const after = (await app.inject({ method: 'GET', url: `/agents/${agentId}/skills` })).json();
    expect(after.map((l: { skill_id: string }) => l.skill_id)).toEqual([b.id, a.id]);

    const users = (await app.inject({ method: 'GET', url: `/skills/${a.id}/agents` })).json();
    expect(users).toEqual([{ id: agentId, name: 'Linker', enabled: true }]);
    const list = (await app.inject({ method: 'GET', url: '/skills' })).json();
    expect(list.find((s: { id: string }) => s.id === a.id).agents_count).toBe(1);

    // Detach = set without it.
    await app.inject({ method: 'POST', url: `/agents/${agentId}/skills`, payload: { skill_ids: [a.id] } });
    expect((await app.inject({ method: 'GET', url: `/skills/${b.id}/agents` })).json()).toEqual([]);
    await app.close();
  });

  it('review run: only attached + enabled skills reach the prompt, in link order, and the trace log lists them', async () => {
    const llm = new MockLLMProvider('openai', { structured: EMPTY_REVIEW });
    const app = await makeApp(llm);
    const db = pg.handle.db;

    const agentId = (await app.inject({ method: 'POST', url: '/agents', payload: {
      name: 'Skilled', provider: 'openai', model: 'gpt-4.1', system_prompt: 'Review it.',
    } })).json().id;
    const first = (await app.inject({ method: 'POST', url: '/skills', payload: body({ name: 'first-skill', body: 'FIRST BODY' }) })).json();
    const second = (await app.inject({ method: 'POST', url: '/skills', payload: body({ name: 'second-skill', body: 'SECOND BODY' }) })).json();
    const off = (await app.inject({ method: 'POST', url: '/skills', payload: body({ name: 'off-skill', body: 'OFF BODY', enabled: false }) })).json();
    await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_ids: [second.id, off.id, first.id] },
    });

    const [repo] = await db.insert(t.repos).values({ workspaceId, owner: 'acme', name: 'skills-repo', fullName: 'acme/skills-repo' }).returning();
    const [pr] = await db.insert(t.pullRequests).values({
      workspaceId, repoId: repo!.id, number: 7, title: 'Retries', author: 'dev', branch: 'feat/r',
      base: 'main', headSha: 'abc123', additions: 1, deletions: 0, filesCount: 1, status: 'needs_review',
    }).returning();
    await db.insert(t.prFiles).values({
      prId: pr!.id, path: 'src/config.ts', additions: 1, deletions: 0,
      patch: '@@ -10,3 +10,4 @@\n   port: 3000,\n+  retries: 3,\n   redisUrl: x,',
    });

    const res = await app.inject({ method: 'POST', url: `/pulls/${pr!.id}/review`, payload: { agentId } });
    expect(res.statusCode).toBe(200);
    const [run] = await waitForPrRuns(db, pr!.id, { expected: 1 });
    expect(run!.status).toBe('done');

    const trace = (await app.inject({ method: 'GET', url: `/runs/${run!.id}/trace` })).json();
    const skillsBlock: string = trace.prompt_assembly.skills;
    expect(skillsBlock.indexOf('### Skill: second-skill')).toBeGreaterThanOrEqual(0);
    expect(skillsBlock.indexOf('### Skill: second-skill')).toBeLessThan(skillsBlock.indexOf('### Skill: first-skill'));
    expect(skillsBlock).not.toContain('OFF BODY');
    expect(trace.prompt_assembly.user).toContain('## Skills / rules');

    const lines: string[] = trace.log.map((l: { msg: string }) => l.msg);
    expect(lines.some((m) => /^Skill "second-skill" v1 attached \(\d+ tokens\)$/.test(m))).toBe(true);
    expect(lines.some((m) => /^Skill "first-skill" v1 attached \(\d+ tokens\)$/.test(m))).toBe(true);
    expect(lines.some((m) => m.includes('off-skill'))).toBe(false);
    expect(lines.some((m) => /^Skills: 2 active, \d+ tokens$/.test(m))).toBe(true);

    // The model really received them.
    const sent = JSON.stringify(llm.calls.filter((c) => c.method !== 'listModels').map((c) => c.req));
    expect(sent).toContain('FIRST BODY');
    expect(sent).not.toContain('OFF BODY');

    // Stats: the run counts for the skills in its prompt; its findings and their decisions too.
    const [review] = await db.select().from(t.reviews).where(eq(t.reviews.runId, run!.id));
    const finding = { reviewId: review!.id, file: 'src/config.ts', startLine: 11, endLine: 11, severity: 'WARNING',
      category: 'test', title: 'Untested retries', rationale: 'x', confidence: 0.9 };
    await db.insert(t.findings).values([
      { ...finding, acceptedAt: new Date() },
      { ...finding, dismissedAt: new Date() },
      { ...finding, acceptedAt: new Date() },
    ]);
    const statsOf = async (id: string) => (await app.inject({ method: 'GET', url: `/skills/${id}/stats` })).json();
    expect(await statsOf(second.id)).toEqual({
      window_days: 30, runs: 1, findings: 3, accepted: 2, dismissed: 1, accept_rate: 67,
    });
    expect(await statsOf(off.id)).toEqual({
      window_days: 30, runs: 0, findings: 0, accepted: 0, dismissed: 0, accept_rate: null,
    });
    expect((await app.inject({ method: 'GET', url: `/skills/${foreignSkillId}/stats` })).statusCode).toBe(404);

    // Detach everything → no skills section at all.
    await app.inject({ method: 'POST', url: `/agents/${agentId}/skills`, payload: { skill_ids: [] } });
    await app.inject({ method: 'POST', url: `/pulls/${pr!.id}/review`, payload: { agentId } });
    const runs = await waitForPrRuns(db, pr!.id, { expected: 2 });
    const latest = runs.find((r) => r.id !== run!.id)!;
    const trace2 = (await app.inject({ method: 'GET', url: `/runs/${latest.id}/trace` })).json();
    expect(trace2.prompt_assembly.skills ?? null).toBeNull();
    expect(trace2.prompt_assembly.user).not.toContain('## Skills / rules');
    expect(trace2.log.map((l: { msg: string }) => l.msg)).toContain('Skills: none active');
    // A run without the skill in its prompt doesn't count.
    expect((await statsOf(second.id)).runs).toBe(1);

    await app.close();
  });
});
