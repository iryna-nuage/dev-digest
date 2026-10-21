# Layers and the Dependency Rule

Source ids like `[O1]` refer to [../README.md](../README.md).

## Contents
- The rings
- The Dependency Rule
- Ring map for `server/`
- Import matrix
- What crosses a boundary
- Modules are vertical slices
- Talking to another module

## The rings

```
        ┌──────────────────────────────────────────────────────────┐
        │ Outer: presentation (routes, job handlers, SSE)           │
        │        infrastructure (adapters, repositories, db, jobs)  │
        │   ┌──────────────────────────────────────────────────┐   │
        │   │ Application services (use cases: service.ts)     │   │
        │   │   ┌──────────────────────────────────────────┐   │   │
        │   │   │ Domain services + ports (interfaces)     │   │   │
        │   │   │   ┌──────────────────────────────────┐   │   │   │
        │   │   │   │ Domain model (contracts, rules)  │   │   │   │
        │   │   │   └──────────────────────────────────┘   │   │   │
        │   │   └──────────────────────────────────────────┘   │   │
        │   └──────────────────────────────────────────────────┘   │
        └──────────────────────────────────────────────────────────┘
   Composition root (platform/container.ts, app.ts) wires the outer ring to the ports.
```

Palermo's four tenets [O3]:
1. The application is built around an independent object model.
2. Inner layers define interfaces. Outer layers implement them.
3. Coupling points toward the center.
4. All application core code can be compiled and run without the infrastructure.

"The database is not the center. It is external." [O1]

## The Dependency Rule

- Source code dependencies point **inward only**. Nothing in an inner ring names anything in an
  outer ring: no function, class, variable or type [O5]. `import type` counts too, which is why
  the checker runs with `tsPreCompilationDeps` ([enforcement.md](enforcement.md)).
- An outer ring may call any inner ring directly. Routes may use a domain helper without going
  through a service, so pass-through methods aren't needed [O6].
- Infrastructure and presentation both depend on the core and never on each other [O13]. The
  composition root is the one exception: it knows every concrete class [O12].

## Ring map for `server/`

| Ring | DevDigest location | Rule file |
|---|---|---|
| Domain model | `@devdigest/shared` contracts (`src/vendor/shared/contracts`), `@devdigest/reviewer-core`, module `domain.ts` and pure calculators (`pulls/cost.ts`, `pulls/status.ts`) | [domain-core.md](domain-core.md) |
| Domain services and ports | `src/vendor/shared/adapters.ts` (`LLMProvider`, `GitHubClient`, `GitClient`, `CodeIndex`, `SecretsProvider`, `AuthProvider`), module `ports.ts`, `repo-intel/types.ts` (`RepoIntel` facade) | [ports-and-adapters.md](ports-and-adapters.md) |
| Application services | `modules/<m>/service.ts`, `reviews/run-executor.ts` | [application-services.md](application-services.md) |
| Infrastructure | `src/adapters/**`, `modules/<m>/repository.ts` or `repository/*.repo.ts`, `mappers.ts`, `src/db/**`, `platform/jobs.ts`, `platform/sse.ts` | [persistence-drizzle.md](persistence-drizzle.md) |
| Presentation | `modules/<m>/routes.ts`, job handlers registered there, the error handler in `app.ts` | [http-fastify.md](http-fastify.md) |
| Composition root | `platform/container.ts`, `app.ts` (`buildApp`), `modules/index.ts` | [composition-root.md](composition-root.md) |

`platform/errors.ts` is a shared kernel: every ring may import it ([domain-core.md](domain-core.md)).

## Import matrix

Read a row as "a file in this ring may import…".

| From \ To | shared / reviewer-core | domain, ports | service | repository, mappers | adapters | db, drizzle | fastify | container |
|---|---|---|---|---|---|---|---|---|
| shared (`vendor/shared`) | itself | — | — | — | — | — | — | — |
| domain, ports | ✔ | ✔ (own module) | — | — | — | — | — | — |
| service | ✔ | ✔ | ✔ (own module) | port only | — | — | — | — |
| repository, mappers | ✔ | ✔ | — | ✔ | — | ✔ | — | — |
| routes | ✔ | ✔ | ✔ | own repository class, to construct it only | — | — | ✔ | ✔ (`app.container`) |
| adapters | ✔ | ports | — | — | ✔ | when the adapter is the DB | — | — |
| container | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — |

"port only" means a service holds a repository through its interface. In legacy code the
repository class is used directly; new code depends on the interface.

## What crosses a boundary

- Only simple data: `@devdigest/shared` DTOs, domain types and plain structural inputs. Never pass
  Drizzle rows (`$inferSelect`, `src/db/rows.ts`), `FastifyRequest` or `FastifyReply`, SDK
  response objects or the `Container` [O5] [O15].
- A domain function declares the narrow input it needs. `RunCostRow` in `pulls/cost.ts` is the
  model: three fields, not the `agent_runs` row.
- Raw input is parsed once, at the outer boundary (route schema, adapter response). From there
  inward it is typed ([http-fastify.md](http-fastify.md)) [O16].

## Modules are vertical slices

- Split the top level into domain-oriented modules that are layered internally [O9]. In
  DevDigest each `src/modules/<name>/` holds its own rings as files:
  `routes.ts → service.ts → repository.ts`, plus `domain.ts`, `ports.ts` and `mappers.ts` when
  needed. Don't add `domain/ application/ infrastructure/` subfolders. Promote a file to a folder
  only when it outgrows one file.
- Root-level `src/platform/` and `src/adapters/` are the shared outer ring, and
  `@devdigest/shared` is the shared inner ring.

## Talking to another module

Components should not reach into each other's internals [O7]. In DevDigest a module uses another
module only through:
- `@devdigest/shared` (contracts, ports) or `modules/_shared` (request context, shared params);
- a facade type such as `repo-intel/types.ts`, resolved through `container.repoIntel`;
- a repository the container exposes for cross-cutting entities (`container.agentsRepo`,
  `container.reviewRepo`);
- a job kind string through `container.jobs` (handlers stay in their owning module).

Never import another module's `service.ts`, `repository.ts`, `constants.ts` or `pipeline/**`. If
two modules need the same constant, move it to `@devdigest/shared` or `_shared`.
