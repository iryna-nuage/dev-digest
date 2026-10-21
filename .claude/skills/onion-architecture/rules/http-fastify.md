# HTTP with Fastify

Source ids like `[O1]` refer to [../README.md](../README.md). Fastify features in general (hooks,
logging, security headers, performance) → `fastify-best-practices`; Zod API → `zod`.

## Contents
- Routes are a driving adapter
- What a handler does
- Parse at the boundary
- Error mapping
- Encapsulation and module registration
- Example

## Routes are a driving adapter

`modules/<m>/routes.ts` exports one Fastify plugin. It translates HTTP to a use-case call and
the result back to HTTP. That is all it does [O7] [O15]. The web layer stays inside its
boundary: `req`, `reply` and Fastify types never reach a service [O15].

A route file may import: `fastify` types, `fastify-type-provider-zod`, `zod`,
`@devdigest/shared`, `../_shared/*`, `platform/errors.ts` and its own module's `service.ts` and
`ports.ts`. It may import its own `repository.ts` only to construct the repository and hand it
to the service ([composition-root.md](composition-root.md)), never to call it. It never imports
`drizzle-orm`, `src/db/**` or `mappers.ts` (rule `routes-no-persistence`). Legacy: `pulls`,
`polling`, `settings` and `workspace` routes query Drizzle and are in the baseline. Don't copy
them.

## What a handler does

```
schema-validated params/query/body → getContext(app.container, req) → service call
  → undefined ⇒ NotFoundError → reply.status(201) if created → return DTO
```

- Wire the service once per plugin, not per request:
  `const service = new XService({ … from app.container … })` ([composition-root.md](composition-root.md)).
- No branching on business state, no loops over rows, no calculations. Those belong to the
  domain or the service.
- Status codes other than the default (`201`, `202`, `204`) are set here, and only here.

## Parse at the boundary

- Parse raw input once, at the edge, before any of it is acted on. Pushing validation deeper
  leads to "shotgun parsing" [O16].
- Every route declares `schema: { params, querystring, body }` with Zod schemas, and the type
  provider infers the handler types [T4]. Reuse `IdParams` from `_shared/schemas.ts` and
  contracts from `@devdigest/shared`.
- Versions in this repo: `fastify-type-provider-zod` 4.x runs on Zod 3 (5.x and later need Zod 4)
  [T5]. Don't import from `zod/v4`.
- Call `appBase.withTypeProvider<ZodTypeProvider>()` inside each plugin. Type providers don't
  propagate across encapsulated plugins [T4].
- A service may still `.parse()` data from an untyped source it reads itself (a job payload, a
  stored JSON column). That parse is a boundary too.

## Error mapping

- One error handler, in `app.ts`, registered before the modules so every encapsulated module
  plugin inherits it [T2]. It turns validation errors into 422, `AppError` into its status and
  everything else into 500 with the `ApiErrorBody` envelope.
- Services and domain throw taxonomy errors ([domain-core.md](domain-core.md)). Never catch them
  in a route to call `reply.status()` by hand. Never set a status from a service.
- Adapters convert SDK failures to `ExternalServiceError` / `ConfigError` before they reach the
  handler.

## Encapsulation and module registration

- Each module is an encapsulated plugin. Its decorators and hooks stay inside it [T1] [T2]. Don't
  wrap a feature module in `fastify-plugin`. `fp` is for cross-cutting infrastructure that must
  be visible to the parent [T1].
- Cross-cutting concerns (container decorator, helmet, CORS, rate limit, SSE, error handler) are
  registered in `buildApp` before the modules, because plugins load in declaration order [T1].
- New module: one import and one entry in `modules/index.ts` (static, no autoload, per
  `server/CLAUDE.md`).
- Job handlers registered in a route plugin are driving adapters too. They parse the payload and
  call the service.

## Example

```ts
// ✅ thin handler
app.post('/notes/archive-stale', { schema: { body: ArchiveBody } }, async (req) => {
  const { workspaceId } = await getContext(app.container, req);
  return service.archiveStale(workspaceId, new Date());
});

// ❌ persistence and a rule in the handler (pulls/routes.ts legacy style)
app.get('/repos/:id/pulls', async (req) => {
  const [repo] = await container.db.select().from(t.repos).where(…);
  for (const pr of pulls) await container.db.insert(t.pullRequests)…;
});
```
