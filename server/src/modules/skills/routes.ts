import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SkillType } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import {
  IMPORT_REQUEST_BODY_LIMIT,
  SKILL_BODY_MAX,
  SKILL_DESCRIPTION_MAX,
  SKILL_NAME_PATTERN,
} from './constants.js';
import { SkillsService } from './service.js';

/**
 * L02 — skills module.
 *   GET    /skills                  → list (+ agents_count)
 *   GET    /skills/:id              → one skill
 *   POST   /skills                  → create (manual, or a confirmed import)
 *   PUT    /skills/:id              → edit / toggle enabled (body change bumps version)
 *   DELETE /skills/:id              → delete (links + versions cascade)
 *   GET    /skills/:id/agents       → agents attaching the skill
 *   GET    /skills/:id/stats        → runs (30d) that carried it + their findings
 *   POST   /skills/import/preview   → parse an uploaded .md / .zip; writes nothing
 * Attach / detach / reorder stays on POST /agents/:id/skills (agents module).
 */

const SkillName = z
  .string()
  .regex(SKILL_NAME_PATTERN, 'Use kebab-case: lowercase letters, digits and hyphens, 2–64 characters');
const SkillDescription = z.string().trim().min(1).max(SKILL_DESCRIPTION_MAX);
const SkillBody = z
  .string()
  .max(SKILL_BODY_MAX)
  .refine((s) => s.trim().length > 0, 'Skill body is required');

const CreateSkillBody = z.object({
  name: SkillName,
  description: SkillDescription,
  type: SkillType,
  body: SkillBody,
  enabled: z.boolean().optional(),
  source: z.enum(['manual', 'imported_file']).optional(),
});

const UpdateSkillBody = z.object({
  name: SkillName.optional(),
  description: SkillDescription.optional(),
  type: SkillType.optional(),
  body: SkillBody.optional(),
  enabled: z.boolean().optional(),
});

const ImportPreviewBody = z.object({
  filename: z.string().min(1).max(255),
  content_base64: z.string().min(1),
});

export default async function skillsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new SkillsService({ skills: app.container.skillsRepo });

  app.get('/skills', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId);
  });

  app.get('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.get(workspaceId, req.params.id);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.post('/skills', { schema: { body: CreateSkillBody } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.create(workspaceId, req.body);
    reply.status(201);
    return skill;
  });

  app.put('/skills/:id', { schema: { params: IdParams, body: UpdateSkillBody } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.update(workspaceId, req.params.id, req.body);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.delete('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const ok = await service.delete(workspaceId, req.params.id);
    if (!ok) throw new NotFoundError('Skill not found');
    return { ok: true };
  });

  app.get('/skills/:id/agents', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const agents = await service.agents(workspaceId, req.params.id);
    if (!agents) throw new NotFoundError('Skill not found');
    return agents;
  });

  app.get('/skills/:id/stats', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const stats = await service.stats(workspaceId, req.params.id);
    if (!stats) throw new NotFoundError('Skill not found');
    return stats;
  });

  app.post(
    '/skills/import/preview',
    { bodyLimit: IMPORT_REQUEST_BODY_LIMIT, schema: { body: ImportPreviewBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.importPreview(workspaceId, req.body.filename, req.body.content_base64);
    },
  );
}
