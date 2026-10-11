# Insights — server

Non-obvious findings for agents working in this module. Maintained by the `engineering-insights`
skill: append-only — add entries at the end of a section; never edit or delete them, only append
to their `Status:` line.

Entry: `### YYYY-MM-DD · <area> · <the lesson stated as a rule>`, then What / Do / Where / Status.

## What Works

## What Doesn't Work

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
Where: src/vendor/shared ↔ client/src/vendor/shared
Status: open

### 2026-09-25 · platform · Unused modules
What: `model-router.ts`, `trace-builder.ts` and `prompts.ts` are not imported anywhere.
`platform/prompt.ts` and `platform/grounding.ts` are re-export shims of reviewer-core.
Where: src/platform/
Status: scaffolding for later lessons

## Tool & Library Notes

### 2026-09-25 · boot · reviewer-core is imported as raw TS
What: the server resolves `@devdigest/reviewer-core` to `../reviewer-core/src`, so it needs
`reviewer-core/node_modules` (npm, not pnpm). reviewer-core also resolves its own `zod`,
giving two zod instances; the error handler therefore detects ZodError by shape.
Where: scripts/dev.sh:78-80 · reviewer-core/tsconfig.json:24 · src/app.ts:139
Status: by design (starter)

## Recurring Errors & Fixes

### 2026-09-25 · db · On Windows `pnpm db:migrate` / `pnpm db:seed` can silently do nothing
What: the CLI entrypoint guard compares `import.meta.url` (`file:///D:/…/migrate.ts`) with
`` `file://${process.argv[1]}` `` (`file://D:\…\migrate.ts`). On Windows they never match, so
the script exits 0 without migrating or seeding and without printing "✓ migrations applied".
`scripts/dev.sh` calls the same commands. Tests are unaffected: they call `runMigrations()`
directly. Fix direction: compare with `pathToFileURL(process.argv[1]).href`.
Found by reading the code; confirm by checking for the "✓ migrations applied" line.
Where: src/db/migrate.ts:37 · src/db/seed.ts:227 · scripts/dev.sh:84
Status: open (Windows only)

## Session Notes

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
Status: open (L01 task)

### 2026-09-25 · reviews · PR title and author enter the prompt unwrapped
What: `taskLine()` puts the PR title and author into the task line outside `<untrusted>`,
while `INJECTION_GUARD` tells the model the title is inside untrusted blocks. The PR
description is wrapped correctly.
Where: src/modules/reviews/helpers.ts:82
Status: open
