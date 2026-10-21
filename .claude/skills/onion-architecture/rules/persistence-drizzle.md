# Persistence with Drizzle

Source ids like `[O1]` refer to [../README.md](../README.md). Query syntax, relations and
migrations workflow → `drizzle-orm-patterns`; table design and indexes → `postgresql-table-design`.

## Contents
- The repository is an adapter
- Repository port and class
- Mappers
- Workspace scoping
- Read models and aggregates
- Transactions
- Schema and migrations

## The repository is an adapter

"The database is not the center. It is external." [O1] A repository mediates between the domain
and the data-mapping layer with a collection-like interface [O10]. In DevDigest it is the driven
adapter for Postgres: `modules/<m>/repository.ts`, or `repository/<entity>.repo.ts` when a module
owns several entities (`reviews/repository/`).

Drizzle (`drizzle-orm`), the schema (`src/db/schema/*.ts`) and row types (`src/db/rows.ts`) are
imported only by repositories, mappers, `src/db/**` and the composition root. The checker
enforces this for services and routes. A module's `routes.ts` may import its repository class to
construct it ([composition-root.md](composition-root.md)). It must not call the class directly.

## Repository port and class

```ts
// modules/notes/ports.ts (core)
export interface NoteStore {
  listOpen(workspaceId: string): Promise<Note[]>;
  archive(workspaceId: string, ids: string[], tx?: TxHandle): Promise<void>;
}

// modules/notes/repository.ts (infrastructure)
export class NotesRepository implements NoteStore {
  constructor(private db: Db) {}
  async listOpen(workspaceId: string): Promise<Note[]> {
    const rows = await this.db.select().from(t.notes)
      .where(and(eq(t.notes.workspaceId, workspaceId), eq(t.notes.status, 'open')));
    return rows.map(toNote);                        // mappers.ts
  }
}
```

- The service sees `NoteStore` and never the class. Tests pass an in-memory `NoteStore`.
- Method names speak the domain (`listOpen`, `markReviewed`), not SQL (`selectWhereStatus`).
- Repositories hold no business rules. "Which runs count toward COST" is domain logic
  (`pulls/cost.ts`); the repository only fetches the runs.

## Mappers

- Map a row to a domain type or DTO inside the infrastructure ring: a `mappers.ts` beside the
  repository, or a private function in it. Rows never cross into services [O5].
- Legacy: services map rows with helpers (`toAgentDto` in `agents/helpers.ts`) and import row
  types (`reviews/service.ts` → `db/rows.ts`, in the baseline). New code maps in the repository.
- Narrow reads that only feed a pure calculation may return a structural subset that the domain
  input type accepts (`RunCostRow`). That is still a domain type, not a row.

## Workspace scoping

- Every query and every insert on a domain table filters or sets `workspace_id` from the
  `workspaceId` parameter (`server/CLAUDE.md`). The repository method signature makes it
  mandatory: `workspaceId: string` comes first.
- Child tables reached through a parent (`agent_versions` via `agents`) are checked through the
  parent in the service before the child is read (`AgentsService.listVersions`).

## Read models and aggregates

- A list screen (the PR list) gets a query method that returns exactly the rows the calculation
  needs. The aggregation runs in pure domain functions (`pulls/cost.ts`,
  `pulls/findings.ts`) [O9].
- Upserts from an external source (GitHub PRs) live in one repository method and are called
  from one use case. Legacy: `pulls/routes.ts` and `polling/routes.ts` duplicate the upsert
  inline (`server/INSIGHTS.md`). Don't add a third copy; extract it when you touch either file.

## Transactions

Pattern and port: [application-services.md](application-services.md#transactions). On the
infrastructure side:

- Derive the transaction type from the client in `src/db/`:
  `type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]`.
- Each write method accepts `tx?: TxHandle` and runs on `(tx as Tx | undefined) ?? this.db` [T8].
- Run all of a transaction's statements on `tx`, never on `db` [T7].
- Postgres options (`isolationLevel`, `accessMode`, `deferrable`) are set by the
  `TransactionRunner` implementation, not by the use case [T7].

## Schema and migrations

- Schema: `src/db/schema/<area>.ts`. It is infrastructure, and domain types are not derived from
  it. Use Zod contracts in `@devdigest/shared`.
- Migration: edit the schema → `pnpm db:generate` → `pnpm db:migrate`. Never hand-edit
  `src/db/migrations/**` (`server/CLAUDE.md`). On Windows, apply migrations with
  `runMigrations()` (`server/INSIGHTS.md`).
