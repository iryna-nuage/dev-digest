# Server data flow

How `@devdigest/api` boots and how data moves through its three main flows. The request
pipeline, DI diagram, API map and env vars are in [`../README.md`](../README.md); feature contracts
in [`../specs/`](../specs/).

## Boot (`src/app.ts` → `buildApp`)

1. `loadConfig()` → a `Container` (`src/platform/container.ts`) unless tests pass one.
2. Reap orphaned `running` agent runs left by a previous process (`ReviewService.reapStaleRuns`).
3. Register cross-cutting plugins (helmet, cors, SSE, rate-limit) and the error handler.
4. Register every feature module from the static list in `src/modules/index.ts`
   (`settings`, `repos`, `pulls`, `polling`, `workspace`, `agents`, `reviews`, `repo-intel`).

## Layering

- A module is `src/modules/<name>/`: `routes.ts` (Fastify plugin + zod schemas) → `service.ts` →
  `repository.ts` / `repository/*.repo.ts` (Drizzle). `pulls` and `polling` still query Drizzle
  from routes (legacy).
- Services reach the outside world only through the container: `git`, `github()`, `llm(provider)`
  (cached per provider), `secrets`, `repoIntel` (facade), `jobs` (in-memory `JobRunner`) and
  `runBus` (in-memory SSE event bus). Tests swap these via `ContainerOverrides`.
- Every query is scoped by the `workspaceId` from `getContext()`.

## Flow 1 — add a repo → clone → index

`POST /repos` persists the repo and enqueues a `clone` job → the job runs `git clone` into
`DEVDIGEST_CLONE_DIR` and enqueues an `index` job (handler registered by the `repo-intel` module)
→ `repo-intel` indexes symbols + import graph and records the index state the UI shows as
**Indexed**. Repo map, callers and file rank are later read through `container.repoIntel.*`.

## Flow 2 — PR list read model (`GET /repos/:id/pulls`)

1. With a GitHub token: list PRs from GitHub and upsert them (offline → persisted rows only).
2. Backfill diff stats for up to 10 PRs that still have zero size.
3. Aggregate per PR from the DB: `score` of the latest review, `status` from GitHub state +
   `last_reviewed_sha` vs head (`src/modules/pulls/status.ts`), `cost_usd` (`src/modules/pulls/cost.ts`) and
   `latest_findings` (`src/modules/pulls/findings.ts`) — pure helpers over one `agent_runs` and one
   `reviews` query plus one `findings` query.

## Flow 3 — review run (`POST /pulls/:id/review`)

1. `ReviewService.runReview` resolves the target agents (one agent, or all enabled) and inserts one
   `agent_runs` row per agent, `status = running`, sharing one `review_batch_id`; the response
   returns the run ids immediately.
2. In the background (`void executor.executeRuns`, no queue): load the diff once
   (`git.diff(base, head)`, fallback: rebuild it from persisted `pr_files` patches).
3. For each agent, sequentially (`run-executor.ts`):
   - best-effort context: repo map, callers, file-rank note from `repoIntel` (omitted on failure);
   - `reviewPullRequest()` from `@devdigest/reviewer-core` with the agent's provider/model;
   - persist `reviews` + grounded `findings`, `markReviewed(head_sha)`;
   - `completeAgentRun`: status `done`, tokens, `cost_usd`, `findings_count`, grounding, score,
     `blockers` (`countBlockers` with the agent's `ciFailOn`);
   - save one `run_traces` document and complete the run on `runBus`.
   A failure or cancel marks that run `failed` / `cancelled` with an error and a trace.
4. Clients follow progress through `GET /runs/:id/events` (SSE, replay buffer first) and
   `GET /pulls/:id/runs/active`; results are read from `/pulls/:id/runs`, `/pulls/:id/reviews`
   and `/runs/:id/trace`.
