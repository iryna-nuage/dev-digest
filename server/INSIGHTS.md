# Insights — server

Non-obvious findings for agents working in this module. Maintained by the `engineering-insights`
skill: append-only — add entries at the end of a section; never edit or delete them, only append
to their `Status:` line.

Entry: `### YYYY-MM-DD · <area> · <the lesson stated as a rule>`, then What / Do / Where / Status.

## What Works

### 2026-10-11 · db · On Windows apply migrations by calling `runMigrations()` directly
What: new facts for "On Windows `pnpm db:migrate` / `pnpm db:seed` can silently do nothing" —
confirmed: `pnpm db:migrate` exited 0, printed no "✓ migrations applied", and
`drizzle.__drizzle_migrations` stayed at 10 rows. Calling the exported function bypasses the
broken CLI guard and applied 0010.
Do: ALWAYS run, from `server/`:
`npx tsx --eval 'import("./src/db/migrate.ts").then(m => m.runMigrations("<DATABASE_URL>")).then(() => console.log("✓ migrations applied"))'`
then verify the row count in `drizzle.__drizzle_migrations` / the new column in
`information_schema.columns`.
Where: src/db/migrate.ts:37
Status: workaround (until the guard is fixed) → superseded by "CLI entrypoints use `isEntrypoint()` (`pathToFileURL`)" (2026-10-24)

### 2026-10-11 · tests · When Docker CLI hangs, replay an `.it` scenario on a throwaway DB
What: `docker info` / `docker version` hung (Docker Desktop unresponsive) while Postgres on
:5432 still accepted connections, so `dockerAvailable()` (5 s timeout) returned false and every
`*.it.test.ts` silently skipped. Replaying the scenario against `CREATE DATABASE <tmp>` in the
local Postgres → `runMigrations()` + `seed()` + `buildApp({ db, overrides })` → `DROP DATABASE
… WITH (FORCE)` verified the SQL/wiring. Script outside the package: name it `.mts`
(tsx compiles `.ts` there as CJS → "Top-level await is currently not supported"), import server
files as `file:///D:/…` URLs, resolve deps via `createRequire(server/package.json)`, run with
`npx tsx --tsconfig tsconfig.json` from `server/` for the `@devdigest/*` aliases.
Do: NEVER report integration coverage when the `.it` files show "skipped"; replay on a throwaway
DB and drop it afterwards.
Where: test/helpers/pg.ts:23 · test/reviews.it.test.ts
Status: workaround

## What Doesn't Work

### 2026-10-16 · pulls · PR-list COST is the sum of ALL successful runs, never the latest batch
What: L01 first scoped `PrMeta.cost_usd` to the latest review batch (null while it ran); the user
corrected it against HW1 criterion 12 and the course demo: COST = sum of every `done` run with a
known `cost_usd`, across all launches. The neighbouring FINDINGS column deliberately keeps the
latest-batch scope (`latestRunReviewIds`), and both read the same `runRows`. The Session Note
"2026-10-11 · L01 run cost" (COST = latest batch) is outdated.
Do: NEVER align COST with the FINDINGS latest-batch rule; keep per-run cost (Timeline, trace)
as the individual run's value.
Where: src/modules/pulls/cost.ts:24 · src/modules/pulls/findings.ts:38 · src/modules/pulls/routes.ts:151
Status: fixed (2026-10-16)

## Codebase Patterns

### 2026-09-25 · platform · Runtime state lives in memory
What: `runBus` is a module-level singleton; its `buffers`, `seq` and `completed` maps are
never cleared. The JobRunner queue is in-memory (the `jobs` table only mirrors it), so
queued jobs are lost on restart. `withTimeout` doesn't cancel the handler, so a retry can
run alongside a still-running attempt.
Where: src/platform/sse.ts:103 · src/platform/jobs.ts · src/platform/resilience.ts
Status: open

### 2026-09-25 · reviews · Two background mechanisms
What: clone/index jobs go through JobRunner (queue, timeout, retries); reviews start as
`void executor.executeRuns()` with no queue, concurrency limit or timeout.
Where: src/modules/reviews/service.ts:133
Status: open

### 2026-09-25 · repos · Job handlers are registered as a side effect of route plugins
What: `repos` and `repo-intel` register job handlers when their route plugins load. The
clone job enqueues `index` by string kind; if no handler is registered, the error is
swallowed by an empty `catch {}`.
Where: src/modules/repos/routes.ts:24 · src/modules/repo-intel/routes.ts:30 ·
src/modules/repos/service.ts
Status: open

### 2026-09-25 · pulls · GET syncs GitHub; upsert duplicated
What: `GET /repos/:id/pulls` lists PRs from GitHub and upserts them on every call (the
client polls it every 60 s). The same upsert is copy-pasted in polling.
Where: src/modules/pulls/routes.ts:65 · src/modules/polling/routes.ts:49
Status: open

### 2026-09-25 · shared · Contract copies have drifted
What: `client/src/vendor/shared` is a manual copy of `src/vendor/shared`. Already differing:
adapters.ts, contracts/trace.ts, contracts/eval-ci.ts, contracts/knowledge.ts,
contracts/productionize.ts. Contract changes must be applied to both copies.
Where: src/vendor/shared ↔ client/src/vendor/shared · src/vendor/shared/adapters.ts:83 ↔
client/src/vendor/shared/adapters.ts:77
Status: open

### 2026-09-25 · platform · Unused modules
What: `model-router.ts`, `trace-builder.ts` and `prompts.ts` are not imported anywhere.
`platform/prompt.ts` and `platform/grounding.ts` are re-export shims of reviewer-core.
Where: src/platform/ · src/platform/model-router.ts:27 · src/platform/trace-builder.ts:37 ·
src/platform/prompts.ts:24 · src/platform/prompt.ts:6 · src/platform/grounding.ts:6
Status: scaffolding for later lessons

### 2026-10-23 · db · Multi-statement writes run in a transaction owned by ONE repository method
What: the first `db.transaction` calls in `src/` (L02): skill insert + `skill_versions` v1,
body update + snapshot, and `AgentsRepository.setSkills` (delete + insert, which used to leave an
agent with no links if the insert failed). Each is opened inside a single repository method that no
other use case wraps, so no `TransactionRunner` port was introduced; the onion skill's
"no transactional use case yet" note predates this.
Do: when a write spans one repository's tables, wrap it in that method; introduce the
`TransactionRunner` / `TxHandle` port only when a use case spans several repositories.
Where: src/modules/skills/repository.ts:44 · src/modules/skills/repository.ts:55 · src/modules/agents/repository.ts:231
Status: by design

## Tool & Library Notes

### 2026-09-25 · boot · reviewer-core is imported as raw TS
What: the server resolves `@devdigest/reviewer-core` to `../reviewer-core/src`, so it needs
`reviewer-core/node_modules` (npm, not pnpm). reviewer-core also resolves its own `zod`,
giving two zod instances; the error handler therefore detects ZodError by shape.
Where: scripts/dev.sh:78-80 · reviewer-core/tsconfig.json:24 · src/app.ts:139
Status: by design (starter)

### 2026-10-23 · db · A new value in a Drizzle `text(…, { enum })` column needs no migration, but the schema enum must change
What: `skills.source` is `text('source', { enum: [...] })` — the enum is TypeScript-only (no
CHECK, no pg enum). Adding `imported_file` to the Zod `SkillSource` alone made inserts fail
typecheck (TS2769 "Type '\"imported_file\"' is not assignable"); after adding it to the schema
enum, `pnpm db:generate` printed "No schema changes, nothing to migrate".
Do: ALWAYS update the Drizzle schema enum together with the Zod contract enum, and confirm with
`pnpm db:generate` that no migration is produced.
Where: src/db/schema/skills.ts:14 · src/vendor/shared/contracts/knowledge.ts:119
Status: by design

## Recurring Errors & Fixes

### 2026-09-25 · db · On Windows `pnpm db:migrate` / `pnpm db:seed` can silently do nothing
What: the CLI entrypoint guard compares `import.meta.url` (`file:///D:/…/migrate.ts`) with
`` `file://${process.argv[1]}` `` (`file://D:\…\migrate.ts`). On Windows they never match, so
the script exits 0 without migrating or seeding and without printing "✓ migrations applied".
`scripts/dev.sh` calls the same commands. Tests are unaffected: they call `runMigrations()`
directly. Fix direction: compare with `pathToFileURL(process.argv[1]).href`.
Found by reading the code; confirm by checking for the "✓ migrations applied" line.
Where: src/db/migrate.ts:37 · src/db/seed.ts:227 · scripts/dev.sh:84
Status: open (Windows only) → fixed (2026-10-24), see "CLI entrypoints use `isEntrypoint()` (`pathToFileURL`)"

### 2026-10-11 · tests · `server/.env` keys reach tests — un-mocked `openrouter` agents call the real API
What: `src/platform/config.ts` starts with `import 'dotenv/config'`, so `OPENROUTER_API_KEY`
from `server/.env` is loaded even when unset in the shell and under `NODE_ENV=test`. The seeded
agents use provider `openrouter`; a test app that mocks only `llm.openai`/`llm.anthropic`
(like `appWith` in reviews.it) sends real OpenRouter requests on `POST /pulls/:id/review`
`{ all: true }`. Seen in a replay: the seeded runs logged "Resolving openrouter provider done"
and hung on the network call.
Do: ALWAYS pass `overrides.llm.openrouter` (e.g. a `MockLLMProvider`) whenever a test can run
seeded/enabled agents.
Where: src/platform/config.ts:1 · test/reviews.it.test.ts (appWith, "run all enabled agents")
Status: open → fixed in reviews.it.test.ts `appWith` (2026-10-11); other `.it` files not audited

### 2026-10-16 · tests · `indexer-pipeline.test.ts` ENOENT on Windows comes from its own test helper
What: the 6 failures ("ENOENT … open '…\repo-intel-full-XXXX\src\util.ts'") are thrown by the
test's `writeFileAt`, not by the pipeline: it finds the parent dir with `full.lastIndexOf('/')`,
but on win32 `join()` returns backslashes, so the index is -1, `mkdir` is skipped and `writeFile`
of a nested path (`src/util.ts`, `src/a.ts`) fails. Confirmed with `path.join` on Windows; every
failing case writes a nested path. Not fixed yet — fix direction: `path.dirname(full)`.
Do: NEVER treat these 6 Windows failures as a regression from a feature change.
Where: test/indexer-pipeline.test.ts:142 · test/indexer-pipeline.test.ts:162-165
Status: open (test-only, Windows)

### 2026-10-24 · db · CLI entrypoints use `isEntrypoint()` (`pathToFileURL`), never `file://${argv[1]}`
What: fixes "On Windows `pnpm db:migrate` / `pnpm db:seed` can silently do nothing". Both guards
call `isEntrypoint(import.meta.url)`, which compares with `pathToFileURL(argv[1]).href` (and its
realpath). Effect seen before the fix: the dev DB had no Test Quality Reviewer or skills although
`pnpm db:seed` "succeeded". Verified after: on a throwaway DB, migrate ×2 → 11 rows in
`drizzle.__drizzle_migrations` both times; seed ×2 → identical row counts. `test/db-entrypoint.test.ts`
spawns both scripts through `tsx/cli` with `DATABASE_URL=''` (dotenv never overrides a set
variable, so no DB is reached) and expects exit 1 "DATABASE_URL is required"; with the old guard
it fails on Windows.
Do: ALWAYS guard a runnable script with `isEntrypoint(import.meta.url)` from `src/db/entrypoint.ts`;
confirm a real run by its "✓ migrations applied" / "✓ seeded" line, not by exit code 0.
Where: src/db/entrypoint.ts:14 · src/db/migrate.ts:38 · src/db/seed.ts:298 · test/db-entrypoint.test.ts:83
Status: fixed (2026-10-24)

## Session Notes

### 2026-10-11 · L01 run cost
Persisted `agent_runs.cost_usd` + per-launch `review_batch_id` (migration 0010), PR-list COST =
latest batch (`modules/pulls/cost.ts`). Added: runMigrations workaround, Docker-hang replay,
.env key leak into tests, indexer-pipeline ENOENT question.
Where: src/db/migrations/0010_sleepy_wild_child.sql:1 · src/modules/reviews/run-executor.ts:248 ·
src/modules/reviews/service.ts:120

### 2026-10-16 · PR-list COST → sum of all successful runs
Replaced the latest-batch cost rule with `successfulRunsCostByPr` (criterion 12); specs and
tests updated. Added: "PR-list COST is the sum of ALL successful runs, never the latest batch".
Where: src/modules/pulls/cost.ts:24 · test/pulls-cost.test.ts:21 · specs/L01-run-cost.md:87

### 2026-10-16 · INSIGHTS `path:line` evidence (HW1 criterion 11)
Validator and skill now require `Where: path:line` in every dated entry; one-time repair of 8
entries' `Where:`. Added: "`indexer-pipeline.test.ts` ENOENT on Windows comes from its own test helper".
Where: .claude/skills/engineering-insights/scripts/check-insights.mjs:31 · test/indexer-pipeline.test.ts:142

### 2026-10-23 · L02 skills (server)
New `skills` module (CRUD, versions, `.md` / `.zip` import preview via `fflate`), workspace-safe
transactional `POST /agents/:id/skills`, executor passes attached ∧ enabled skills to the prompt
and logs their tokens; Test Quality Reviewer seeded. Added: "transaction owned by one repository
method", "Drizzle text enum needs no migration".
Where: src/modules/skills/service.ts:60 · src/modules/skills/import/extract.ts:71 · src/modules/reviews/run-executor.ts:55

## Open Questions

### 2026-09-25 · reviews · Cancelling a live run doesn't stop it
What: `cancelRun` calls `runBus.cancel()` and then `runBus.complete()`, which deletes the
cancelled flag, so the engine's checkpoint never sees it. When the LLM returns, findings are
saved and `completeAgentRun` (no status guard) overwrites `cancelled` with `done`.
Found by reading the code; not reproduced.
Where: src/modules/reviews/service.ts:87-89 · src/platform/sse.ts:79 ·
src/modules/reviews/run-executor.ts:243 · src/modules/reviews/repository/run.repo.ts:141
Status: open

### 2026-09-25 · reviews · Run cost is computed but not persisted (L01)
What: `reviewPullRequest` returns `costUsd`; the executor only keeps tokens and grounding.
`agent_runs.cost_usd` was dropped in migration 0009.
Where: src/modules/reviews/run-executor.ts:213 · src/db/migrations/0009_complex_runaways.sql
Status: open (L01 task) → fixed (2026-10-11): persisted again in migration 0010, see server/specs/L01-run-cost.md

### 2026-09-25 · reviews · PR title and author enter the prompt unwrapped
What: `taskLine()` puts the PR title and author into the task line outside `<untrusted>`,
while `INJECTION_GUARD` tells the model the title is inside untrusted blocks. The PR
description is wrapped correctly.
Where: src/modules/reviews/helpers.ts:82
Status: open

### 2026-10-11 · repo-intel · `indexer-pipeline.test.ts` fails on Windows with ENOENT
What: all 6 tests fail with `ENOENT: no such file or directory, open
'C:\Users\…\Temp\repo-intel-full-XXXX\src\util.ts'` — a file the test itself writes into a
`mkdtemp` dir. Seen during L01, whose changes are outside its import chain; not compared against
a clean HEAD and the cause is not traced (suspect: path join/normalisation in the pipeline vs
Windows separators).
Do: check whether the pipeline rebuilds paths with `/` before blaming a feature change.
Where: test/indexer-pipeline.test.ts:140-144 · src/modules/repo-intel/pipeline/full.ts:144
Status: unverified → superseded by "`indexer-pipeline.test.ts` ENOENT on Windows comes from its own test helper" (2026-10-16)
