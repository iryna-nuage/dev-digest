# Application services

Source ids like `[O1]` refer to [../README.md](../README.md).

## Contents
- Role
- Dependencies come in through the constructor
- Inputs and outputs
- Workflow inside a use case
- Transactions
- Best-effort enrichment and background work
- Example

## Role

An application service (`modules/<m>/service.ts`, or a focused class such as
`reviews/run-executor.ts`) implements one module's use cases: load through ports, let the domain
decide, save through ports, then emit events or enqueue jobs [O7] [O8]. It holds no HTTP, SQL or
SDK code, and no business rule that a pure function could hold.

## Dependencies come in through the constructor

- A new service declares the ports it needs as a `Deps` interface and receives them through its
  constructor [O2] [O11]:

  ```ts
  // modules/notes/service.ts (illustrative)
  export interface NotesServiceDeps {
    notes: NoteStore;                       // port from ./ports.ts
    github: () => Promise<GitHubClient>;    // lazy: the client needs a secret
    jobs: JobQueue;                         // port from ./ports.ts; JobRunner satisfies it structurally
  }
  // ./ports.ts
  export interface JobQueue {
    enqueue(workspaceId: string, kind: string, payload: unknown): Promise<unknown>;
  }
  export class NotesService {
    constructor(private deps: NotesServiceDeps) {}
  }
  ```

- The module's `routes.ts` builds it from `app.container` ([composition-root.md](composition-root.md)).
- Never take the whole `Container`, and never `new` a repository or adapter inside a service. The
  legacy services (`agents`, `repos`, `reviews`, `repo-intel`) do both. They are in the checker's
  baseline, so don't copy them. Fowler considers a service locator acceptable inside one
  application [O11]. The skill still requires injection, because narrow deps make a test's setup
  obvious and keep the ring check mechanical (README, decision D4).

## Inputs and outputs

- Inputs are already-parsed, typed values: ids, `workspaceId`, DTO-shaped objects. Never
  `FastifyRequest`, a raw `body: unknown` or a Drizzle row [O15].
- `workspaceId` is an explicit parameter on every method that touches tenant data. Routes get it
  from `getContext()` (`server/CLAUDE.md`).
- Outputs are `@devdigest/shared` DTOs or domain values. "Not found" is `undefined` or a
  `NotFoundError`; the route decides the status code.

## Workflow inside a use case

```
load (ports) → validate state (domain) → decide (domain) → persist (ports) → side effects (jobs, runBus)
```

- Keep each step a call. If a step grows branching, move it into `domain.ts`.
- Errors: throw taxonomy errors ([domain-core.md](domain-core.md)). Never pick numeric statuses.

## Transactions

DevDigest has no transactional use case yet (no `db.transaction` in `src/`). The first one
follows this pattern [T7] [T8]:

- Application side: a port with an opaque handle, so the service imports nothing from Drizzle:
  ```ts
  export type TxHandle = { readonly __tx: unique symbol };
  export interface TransactionRunner { run<T>(fn: (tx: TxHandle) => Promise<T>): Promise<T> }
  ```
- Infrastructure side: the implementation wraps `db.transaction(async (tx) => fn(tx as TxHandle))`.
  A repository method takes `tx?: TxHandle` and runs `const q = (tx as Tx | undefined) ?? this.db`.
- Drizzle details: the callback's return value resolves the transaction; `tx.rollback()` throws to
  roll back; `tx.transaction()` nests through a savepoint [T7].
- One use case owns the transaction. Never open one inside a repository method that another
  use case may already be wrapping.

## Best-effort enrichment and background work

- Optional context (repo map, callers, file rank) is best-effort: wrap the port call, log, omit
  the section, never fail the use case (`server/CLAUDE.md`, `reviews/run-executor.ts`).
- Long work goes through the jobs port (`container.jobs`) with a registered handler. Don't start
  untracked promises (`void executor.executeRuns()` in `reviews/service.ts` is legacy; see
  `server/INSIGHTS.md`).

## Example

```ts
// ✅ service: ports in, DTO out, rule in the domain
async archiveStale(workspaceId: string, now: Date): Promise<Note[]> {
  const notes = await this.deps.notes.listOpen(workspaceId);
  const stale = selectStale(notes, now);              // domain.ts, pure
  await this.deps.notes.archive(workspaceId, stale.map((n) => n.id));
  return stale;
}

// ❌ service reaching outward
constructor(private container: Container) {
  this.repo = new NotesRepository(container.db);      // builds infrastructure itself
}
async archiveStale(req: FastifyRequest) {             // HTTP type in the core
  const rows = await this.container.db.select()…;     // SQL in the service
}
```
