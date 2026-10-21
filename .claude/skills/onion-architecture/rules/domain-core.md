# Domain core

Source ids like `[O1]` refer to [../README.md](../README.md).

## Contents
- What belongs in the core
- Where it lives
- Purity rules
- Shape of domain code
- Domain errors
- Example

## What belongs in the core

| Kind of logic | Example in DevDigest | Ring |
|---|---|---|
| Rule on a single entity (invariant, derived value) | PR review status from GitHub state and `last_reviewed_sha` (`pulls/status.ts`) | domain model |
| Rule across several entities | PR-list COST over all successful runs (`pulls/cost.ts`), latest findings per PR (`pulls/findings.ts`) | domain service |
| What a valid value is | Zod contracts in `@devdigest/shared` | domain model |
| Review engine (diff → prompt → LLM → grounded findings) | `@devdigest/reviewer-core` | domain package |
| What the core needs from the outside world | `GitHubClient`, `LLMProvider`, a repository interface | port |

Use cases (load → decide → save) are application logic, not domain logic
([application-services.md](application-services.md)) [O8].

## Where it lives

- Shared by server, client or reviewer-core → `@devdigest/shared`. Edit it only when the task
  needs a contract change, and mirror the change in `client/src/vendor/shared` (root `CLAUDE.md`).
- Used by one module → `modules/<m>/domain.ts` (or a small named file such as `cost.ts`, which is
  the existing convention for one rule). `domain.ts` and `domain/**` are the names the checker
  treats as the domain ring.
- Review-engine logic → `reviewer-core` (its own package, its own `CLAUDE.md`).
- A port used by one module → `modules/<m>/ports.ts`.

## Purity rules

- No I/O: no Fastify, Drizzle, `src/db/**`, SDKs, `src/adapters/**`, file system, network or
  `process.env` [O1] [O3].
- The domain may import: `@devdigest/shared`, `@devdigest/reviewer-core`, `zod`,
  `platform/errors.ts` and sibling domain files. That list is the whole allowance.
- Time, randomness and ids come in as arguments (`now: Date`, `id: string`), so the result is
  deterministic and unit-testable.
- No hidden state: no module-level mutable maps or singletons in domain files.
- The core compiles and runs without infrastructure [O3], so a domain test needs no mocks
  ([testing.md](testing.md)).

## Shape of domain code

- Plain functions over plain data are the default. Introduce a class only when it guards an
  invariant across several methods.
- Inputs are narrow structural interfaces declared next to the function (`RunCostRow`), not
  Drizzle rows. A repository row satisfies them structurally, so no mapping code is needed for
  reads that only feed a calculation.
- Outputs are domain values or `@devdigest/shared` DTOs, never HTTP shapes.
- Zod belongs to the domain: a contract schema plus `z.infer` is the domain type. Parse at the
  boundary, then pass the inferred type inward [O16] [T13].

## Domain errors

`platform/errors.ts` is the shared error taxonomy (`AppError` → `NotFoundError`,
`ValidationError`, `ExternalServiceError`, `ConfigError`). It works as the single mapping table
from error meaning to HTTP status, and the error handler in `app.ts` reads it.

- Throw a taxonomy error by meaning: `NotFoundError`, `ValidationError`, or a subclass you add in
  `platform/errors.ts` (`class InvalidRunRequestError extends ValidationError`).
- Never pick a numeric status in domain or service code. `new AppError('x', msg, 400)` in a
  service is legacy (`reviews/service.ts`); don't copy it.
- Never import Fastify types or call `reply` to signal an error.
- Known deviation: `AppError` stores `statusCode` itself, so the core indirectly knows about HTTP
  [O5]. The skill accepts this because the mapping stays in one file (README, decision D6).

## Example

```ts
// ✅ modules/pulls/cost.ts: pure, narrow input, deterministic, unit-tested in test/pulls-cost.test.ts
export interface RunCostRow { prId: string | null; status: string | null; costUsd: number | null }
export function successfulRunsCostByPr(rows: RunCostRow[]): Map<string, number | null> { … }

// ❌ the same rule computed inside a route handler over Drizzle rows
app.get('/repos/:id/pulls', async () => {
  const runs = await container.db.select().from(t.agentRuns)…;   // persistence in presentation
  const cost = runs.filter((r) => r.status === 'done')…;         // business rule in presentation
});
```
