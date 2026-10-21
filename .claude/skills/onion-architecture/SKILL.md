---
name: onion-architecture
description: "Enforces Onion Architecture in the DevDigest backend (server/, including repo-intel) on its stack: Fastify 5 + fastify-type-provider-zod, Drizzle ORM on Postgres, Octokit, simple-git, OpenAI/Anthropic SDKs, ast-grep, dependency-cruiser, Vitest + Testcontainers. Use when adding or changing a server module, service, repository, route, job handler, adapter or domain rule; when deciding where backend code lives or which way its imports point; when wiring a dependency in platform/container.ts; when adding an external integration or a transaction; and when reviewing server imports or layering. Ships a dependency-cruiser check with a legacy baseline. Complements fastify-best-practices, drizzle-orm-patterns, postgresql-table-design and zod, which cover each tool's own API."
metadata:
  version: 1.0.0
  tags: onion-architecture, clean-architecture, hexagonal, ports-and-adapters, fastify, drizzle, dependency-injection, backend
---

# Onion Architecture (server)

Rules for **which ring backend code belongs to and which way its imports point** in `server/`.
Every rule cites a source id (`[O1]`–`[O16]`, `[T1]`–`[T15]`) from [README.md](README.md).

## Scope

In scope: placement and dependency decisions in `server/src`: modules, services, repositories,
routes, adapters, the container, transactions and the test level for each ring.

Other skills cover the tools' own APIs:
- Fastify hooks, logging, security headers, performance → `fastify-best-practices`
- Drizzle query syntax, relations, migrations workflow → `drizzle-orm-patterns`
- Table design, indexes → `postgresql-table-design`
- Zod schema API → `zod`; auth, secrets, injection → `security`
- `client/` → `frontend-architecture`; `reviewer-core/` internals → its own `CLAUDE.md`

## Precedence and strength

- Documented conventions win: root `CLAUDE.md`, `server/CLAUDE.md`, `server/docs/data-flow.md`,
  `server/INSIGHTS.md`. Read them first. If a rule here conflicts with one, follow the convention
  and name the conflict.
- **Mandatory for new code and changed lines.** A task adds no new ring violation, and the
  import check passes ([rules/enforcement.md](rules/enforcement.md)).
- **Legacy is tolerated, not copied.** The 35 known violations stay in the baseline until a
  task touches that code. Don't refactor unrelated code toward this skill.

## Vocabulary

- **Domain model**: contracts and pure rules (`@devdigest/shared`, `reviewer-core`, `domain.ts`).
- **Domain service**: a pure rule spanning several entities (`pulls/cost.ts`).
- **Port**: an interface owned by the core, shaped by the use case (`GitHubClient`, `NoteStore`).
- **Adapter**: an outer-ring implementation of a port (driven: Octokit, Drizzle repository), or
  an entry that drives the core (driving: route, job handler).
- **Application service**: a module's use cases (`service.ts`). It orchestrates ports and domain.
- **Composition root**: `platform/container.ts` + `buildApp`, the only place that knows every
  concrete class.
- **Mapper**: row ↔ domain translation inside the infrastructure ring.

## Where does it go?

| You are adding… | Put it… | Rule file |
|---|---|---|
| A business rule or calculation | `modules/<m>/domain.ts` (pure); cross-package → `@devdigest/shared` | [domain-core](rules/domain-core.md) |
| A contract (DTO, enum, request shape) | `@devdigest/shared` (mirror in `client/src/vendor/shared`) | [domain-core](rules/domain-core.md) |
| A call to GitHub, git, an LLM or a CLI tool | a port in the core + an adapter in `src/adapters/<tech>/` | [ports-and-adapters](rules/ports-and-adapters.md) |
| A use case (load → decide → save) | `modules/<m>/service.ts`, with ports passed through the constructor | [application-services](rules/application-services.md) |
| SQL / Drizzle | `modules/<m>/repository.ts` implementing a port from `ports.ts` | [persistence-drizzle](rules/persistence-drizzle.md) |
| Row ↔ domain translation | `modules/<m>/mappers.ts` or inside the repository | [persistence-drizzle](rules/persistence-drizzle.md) |
| Several writes that must commit together | a `TransactionRunner` port + `tx?: TxHandle` on repository methods | [application-services](rules/application-services.md) |
| An endpoint, a status code, request parsing | `modules/<m>/routes.ts` with Zod schemas | [http-fastify](rules/http-fastify.md) |
| A new error meaning | a subclass in `platform/errors.ts`, thrown by meaning | [domain-core](rules/domain-core.md) |
| Constructing an adapter or shared repository | a lazy getter + override in `platform/container.ts` | [composition-root](rules/composition-root.md) |
| Constructing the module's service | the module's `routes.ts`, from `app.container` | [composition-root](rules/composition-root.md) |
| A new module | `src/modules/<name>/` + one entry in `modules/index.ts` | [layers-and-dependency-rule](rules/layers-and-dependency-rule.md) |
| Code another module needs | `@devdigest/shared`, `modules/_shared`, or a container-exposed facade | [layers-and-dependency-rule](rules/layers-and-dependency-rule.md) |
| A test | the lowest ring that owns the behaviour | [testing](rules/testing.md) |

## Core rules

1. **Dependencies point inward only**, `import type` included. The core never names Fastify,
   Drizzle, `src/db/**`, `src/adapters/**`, the container or an SDK [O1] [O3] [O5].
2. **The core owns the interfaces; the outer ring implements them** [O3] [O4] [O7].
3. **The database is not the center.** Repositories are adapters that return domain types, never
   Drizzle rows [O1] [O5] [O10].
4. **Only simple data crosses a boundary**: DTOs, domain types, primitives. Never `req`/`reply`,
   rows, SDK objects or the `Container` [O5] [O15].
5. **Parse at the boundary.** Zod schemas in routes (type provider) and adapter responses; typed
   values inward [O16] [T4] [T5].
6. **Services receive narrow ports through the constructor**, never the whole `Container` [O2]
   [O11] [O12].
7. **One composition root.** Only `platform/container.ts` and `buildApp` know concrete adapters;
   a module's `routes.ts` assembles its service [O12] [O13].
8. **Routes are thin driving adapters**: parse → `getContext` → service → reply. No SQL, no rules
   [O15] [T1].
9. **Errors are thrown by meaning** (`platform/errors.ts` taxonomy). The error handler maps them
   to HTTP; no numeric status in the core [O5].
10. **Transactions go through a port**: an opaque `TxHandle`, with `tx ?? db` in repositories
    [T7] [T8].
11. **Test each ring at its own level**: domain without mocks, services with fake ports,
    repositories against real Postgres, routes via `app.inject` [O4] [O13] [T3] [T15].
12. **Check mechanically.** The dependency-cruiser check passes, and the baseline only shrinks
    [T9] [T12].

## Workflow

```
- [ ] 1. Read server/CLAUDE.md, server/INSIGHTS.md and the touched module's files.
- [ ] 2. Classify each piece of new code by ring (table above).
- [ ] 3. Domain first: write pure rules in domain.ts with unit tests.
- [ ] 4. Ports before adapters: declare what the use case needs, then implement it outside.
- [ ] 5. Service: Deps interface of ports; no Fastify, Drizzle or Container imports.
- [ ] 6. Repository + mapper: workspace-scoped queries returning domain types.
- [ ] 7. Route: Zod schemas, getContext, service call; wire the service from app.container.
- [ ] 8. Tests per ring (rules/testing.md).
- [ ] 9. Run the check from server/ and fix every new violation:
         npx depcruise src --config ../.claude/skills/onion-architecture/scripts/onion.depcruise.cjs \
           --ignore-known ../.claude/skills/onion-architecture/scripts/known-violations.json --output-type err-long
```

For a review, run step 9 and the checklist in [rules/enforcement.md](rules/enforcement.md) over
every new or changed file. Report each violation with its rule file and source id.

## Applying to DevDigest

| Ring | Where it is today |
|---|---|
| Domain model | `src/vendor/shared/contracts` (`@devdigest/shared`), `@devdigest/reviewer-core`, `pulls/cost.ts`, `pulls/status.ts`, `pulls/findings.ts` |
| Ports | `src/vendor/shared/adapters.ts`, `repo-intel/types.ts` (`RepoIntel` facade) |
| Application | `modules/*/service.ts`, `reviews/run-executor.ts` |
| Infrastructure | `src/adapters/**`, `modules/*/repository*`, `src/db/**`, `platform/jobs.ts`, `platform/sse.ts` |
| Presentation | `modules/*/routes.ts`, error handler in `app.ts` |
| Composition root | `platform/container.ts`, `buildApp` in `app.ts`, `modules/index.ts` |

Legacy patterns. They are in the baseline. Never copy them:
- Services take the whole `Container` and `new` their repositories (`agents`, `repos`, `reviews`,
  `repo-intel`).
- Drizzle rows reach services (`reviews/service.ts` → `db/rows.ts`); services map with
  `toXDto` helpers.
- Drizzle in routes (`pulls`, `polling`, `settings`, `workspace`) and in application files
  (`reviews/run-executor.ts`, `reviews/diff-loader.ts`, `settings/feature-models.ts`,
  `repos/helpers.ts`).
- `repo-intel` imports `adapters/astgrep` and `adapters/codeindex/extract` directly; adapters
  import `repo-intel/constants.ts`.
- `new AppError(code, msg, 400)` in services instead of a taxonomy subclass.

## Rule files

- [rules/layers-and-dependency-rule.md](rules/layers-and-dependency-rule.md): rings, Dependency
  Rule, import matrix, boundaries, modules as slices
- [rules/domain-core.md](rules/domain-core.md): pure domain, contracts, domain errors
- [rules/ports-and-adapters.md](rules/ports-and-adapters.md): ports, adapter per technology,
  driving adapters, adding an integration
- [rules/application-services.md](rules/application-services.md): use cases, constructor
  injection, transactions, best-effort enrichment
- [rules/persistence-drizzle.md](rules/persistence-drizzle.md): repositories, mappers, workspace
  scoping, read models, migrations
- [rules/http-fastify.md](rules/http-fastify.md): routes, parse at the boundary, error mapping,
  encapsulation
- [rules/composition-root.md](rules/composition-root.md): the container, wiring a service,
  adding a dependency
- [rules/testing.md](rules/testing.md): one test level per ring
- [rules/enforcement.md](rules/enforcement.md): the dependency-cruiser check, baseline policy,
  review checklist

## Sources

[README.md](README.md) lists every source (O1–O16, T1–T15) with its URL and date, plus the
research method, the decisions (D1–D12) and where the sources disagree.
