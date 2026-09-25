# server (@devdigest/api)

## Before answering
Search `server/docs/`, `server/specs/`, `server/INSIGHTS.md` first.

## Conventions (not obvious from code)
- Multi-tenancy: domain tables carry `workspace_id`; scope every query and insert by the
  `workspaceId` from `getContext()` (`src/modules/_shared/context.ts`).
- DI via `src/platform/container.ts`: services depend on interfaces from `@devdigest/shared`,
  not concrete adapters; tests swap implementations through `ContainerOverrides`.
- Use repo-intel only through the facade `container.repoIntel.*` — never call its pipeline,
  ast-grep or dependency-cruiser directly.
- Context enrichment (repo map, callers, file rank) is best-effort: on failure, omit the
  section; never fail the review.
- New feature → new module `src/modules/<name>/` + one entry in `src/modules/index.ts`
  (static registration, no filesystem autoload).
- Module layering: routes → service → repository. `pulls` and `polling` query Drizzle in
  routes — legacy exception, don't copy it.
- New DB column/table → new migration, never an edit to an old one (see Do-not-touch).

## Gotchas
- Seeded agents use provider `openrouter` → reviews need `OPENROUTER_API_KEY`.

## Do-not-touch
- `src/db/migrations/` — reading is fine. Never hand-edit existing history (`0000_*.sql` …
  latest, `meta/_journal.json`, `meta/*_snapshot.json`). Schema change: edit
  `src/db/schema/*.ts` → `pnpm db:generate` (new migration) → `pnpm db:migrate`.
  Drizzle tracks order, hashes and snapshots; editing old migrations desyncs local DBs, CI
  and teammates' DBs.
- `src/vendor/shared/` — vendored contracts (reviewer-core aliases here). Edit only when the
  task requires a contract change, then mirror it in `client/src/vendor/shared/`.

## Use when
- Env vars, DI flow, API map, review-context notes → read `server/README.md`
- Indexing / repo-intel facade → read `server/src/modules/repo-intel/README.md`
- Deep-dives → read `server/docs/` · feature specs → read `server/specs/` ·
  known bugs and findings → read `server/INSIGHTS.md`
