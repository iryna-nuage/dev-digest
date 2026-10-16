# L01 — Run cost (server)

Persist the dollar cost of every agent run, group the runs of one "Run Review" launch into a
**review batch**, and expose cost on the GET routes the UI reads: the **individual run's** cost on the
run history and the trace, and on the PR list the **sum of all successful runs of the PR** (HW1
criterion 12). UI placement, formatting and empty states are in
[`client/specs/L01-run-cost.md`](../../client/specs/L01-run-cost.md).

## Context — starting state

- `agent_runs` stores `tokens_in` / `tokens_out` but no cost: `agent_runs.cost_usd` was dropped in
  migration `0009_complex_runaways.sql` (commit `d45ab0d`). This lesson restores it on purpose.
- The engine already computes the cost: `reviewPullRequest()` returns `costUsd`
  (`reviewer-core/src/review/run.ts`), but `run-executor.ts` discards it.
- **Agent runs are not grouped.** One `POST /pulls/:id/review` inserts N `agent_runs` rows in a loop
  (`service.ts` → `createAgentRun`), each with its own `ran_at = now()`; nothing on the row says
  which launch it belongs to. `multi_agent_runs` exists in the schema but is unused.

## Non-goals

- No extra model calls of any kind (cost = tokens × price, already computed per call).
- No backfill: runs created before this lesson keep `cost_usd = NULL` / `review_batch_id = NULL`.
- No cost on `GET /pulls/:id` (PR detail), reviews, CI, eval or observability routes.
- Do **not** use `multi_agent_runs`; do **not** infer batches from `ran_at` proximity.
- No `cost_pending` flag on the PR list: a run that is still `running` simply doesn't count yet.
- PR-list cost is **not** scoped to the latest launch / review batch.

## Data model

Edit `src/db/schema/runs.ts` → `pnpm db:generate` → `pnpm db:migrate`. One new migration
(`0010_*`); never hand-edit existing migrations or `meta/`.

| Column (`agent_runs`) | Type | Null | Meaning |
|---|---|---|---|
| `cost_usd` | `double precision` | yes | USD cost of the run, fixed at completion. `NULL` = unknown. |
| `review_batch_id` | `uuid` | yes | Same value for every run created by one `POST /pulls/:id/review`. No FK. `NULL` on legacy runs. |

No index: the PR list reads runs for at most a page of PRs, same as the existing score query.

## Cost calculation and persistence

Source, in priority order (already implemented in the engine, unchanged):
1. OpenRouter `usage.cost` from the API response;
2. `PriceBook.estimate()` — live OpenRouter `/models` prices (6 h cache);
3. static table `src/adapters/llm/pricing.ts`;
4. otherwise `null`.

For map-reduce runs the engine sums the per-chunk costs; if any chunk's cost is unknown, the
run's cost is `null` (`run.ts`: `costUsd == null || res.costUsd == null ? null : …`).

Persistence rules:
- `status = 'done'` → `completeAgentRun(..., { costUsd: outcome.costUsd })`.
- `status = 'failed' | 'cancelled'` → `costUsd: null` (the engine throws; no usage reaches the executor).
- The value is a **snapshot**: later price changes never rewrite stored costs.
- `0` is a valid, known cost (free model) and is stored as `0`, not `NULL`.
- The trace document gets the same value in `stats.cost_usd` (success path) / `null` (failure path,
  `traceFromBuffer`).

## Review batch

- `ReviewService.runReview()` generates **one** `randomUUID()` per call and passes it to every
  `createAgentRun()` of that call.
- "Run all agents" → one batch of N runs. A single agent from the dropdown → one batch of 1 run.
- The PR-list **cost does not use batches** (it sums every successful run, below). The batch is the
  grouping behind the PR-list FINDINGS "latest run" rule
  ([`L01-findings-severity.md`](L01-findings-severity.md)).

## Contracts (`src/vendor/shared/contracts/*`, mirrored to `client/src/vendor/shared/`)

| Schema | Field | Notes |
|---|---|---|
| `RunSummary` (`trace.ts`) | `cost_usd: z.number().nullable()` | From `agent_runs.cost_usd`. |
| `RunStats` (`trace.ts`) | `cost_usd: z.number().nullish()` | `nullish` so trace documents stored before L01 still parse. |
| `PrMeta` (`platform.ts`) | `cost_usd: z.number().nullish()` | List endpoint only, like `score`. |

`review_batch_id` is **not** exposed — grouping is a server concern.

## API

| Route | Change |
|---|---|
| `GET /pulls/:id/runs` | Each `RunSummary` carries `cost_usd`. |
| `GET /runs/:id/trace` | `stats.cost_usd` as stored in the trace document. |
| `GET /repos/:id/pulls` | Each `PrMeta` carries `cost_usd` = sum of the PR's successful runs (below). |
| `POST /pulls/:id/review` | Response unchanged; runs are created with a shared `review_batch_id`. |

### `PrMeta.cost_usd` — sum of all successful runs of the PR

Per-run cost (`RunSummary.cost_usd`, trace `stats.cost_usd`) is always the **individual** run's
cost. The PR list shows the PR's **total**: every successful, completed agent run that has a known
cost, across all launches.

Computed on read (no denormalisation) from the `agent_runs` query the route already makes, with a
pure helper (`src/modules/pulls/cost.ts`) so the rule is unit-testable:

```
rows = SELECT pr_id, status, cost_usd
       FROM agent_runs
       WHERE workspace_id = :ws AND pr_id IN (:prIds)

per PR:
  known = cost_usd of the PR's rows WHERE status = 'done' AND cost_usd IS NOT NULL
  if known is empty → null        // never reviewed, only failed / cancelled / running runs, or only unknown (incl. pre-L01) costs
  return sum(known)
```

- Example: two successful runs costing $0.008296 and $0.004938 → `cost_usd = 0.013234` (the client
  formats it).
- Consistency: the total equals the sum of the per-run costs the Timeline shows for the PR's `done`
  runs (each is the same `agent_runs.cost_usd`, also stored in that run's trace `stats.cost_usd`).
- Only `status = 'done'` counts. `failed` and `cancelled` runs never contribute, even if a cost were
  stored. A `running` run contributes nothing until it finishes `done`; the runs that already
  succeeded keep counting meanwhile.
- `NULL` (unknown) costs are skipped, not treated as 0. A known `0` (free model) is a real cost: a PR
  whose only successful runs are free gets `0`, not `null`.
- Older runs keep contributing when newer launches happen; batches and launch order play no part.
- Deleting a run (`DELETE /runs/:id`) removes its cost from the sum on the next read.
- No rounding on the server; the client formats.

## Acceptance criteria

| # | Given | Then |
|---|---|---|
| S1 | A run finishes `done` and the model has a price | `agent_runs.cost_usd` is a number ≥ 0, equal to `stats.cost_usd` in its trace |
| S2 | A run finishes `failed` or `cancelled` | `cost_usd = NULL` |
| S3 | Model has no price in API response, PriceBook or static table | `cost_usd = NULL` |
| S4 | "Run all agents" with 3 enabled agents | 3 rows with the same non-null `review_batch_id` |
| S5 | Two launches on the same PR | Two different `review_batch_id` values |
| S6 | Two successful runs from separate launches: $0.008296 and $0.004938 | `PrMeta.cost_usd = 0.013234` |
| S7 | One launch: `done` $0.002 + `done` $0.003 + `failed` (NULL) | `PrMeta.cost_usd = 0.005` |
| S8 | `failed` / `cancelled` / `running` runs, and `done` runs with NULL cost | contribute nothing (not even a stored cost on a failed run) |
| S9 | No `done` run with a known cost (never reviewed, all failed, only pre-L01 runs) | `PrMeta.cost_usd = null` |
| S10 | A newer launch exists (succeeded, failed or still running) | Older successful runs keep contributing; a `running` run adds nothing until `done` |
| S10a | Only successful runs are free (cost `0`) | `PrMeta.cost_usd = 0` |
| S11 | Trace stored before L01 | `GET /runs/:id/trace` still parses; `stats.cost_usd` absent |
| S12 | Any of the above | No additional LLM request is made |

## Tests

- Unit (`test/pulls-cost.test.ts`): the pure sum helper — cases S6–S10a, "no runs", and PRs kept
  apart.
- `test/contracts.test.ts`: `RunSummary` / `RunStats` / `PrMeta` accept the new fields;
  `RunStats` without `cost_usd` still parses.
- Integration (`test/reviews.it.test.ts`, testcontainers): a review with a fake LLM that
  returns `costUsd` persists `cost_usd` and a shared `review_batch_id`; `GET /pulls/:id/runs` and
  the trace return the run's own cost; after a second launch `GET /repos/:id/pulls` returns the sum of
  both runs, and a `running` / `failed` run doesn't change it.

## Risks / notes

- Windows: `pnpm db:migrate` can exit 0 without migrating (see `server/INSIGHTS.md`); confirm the
  `✓ migrations applied` line and that `agent_runs.cost_usd` exists.
- PriceBook cold start returns the static-table fallback while it refreshes; OpenRouter usually
  returns `usage.cost`, which takes priority anyway.
- Known bug: cancelling a live run can end as `done` (`server/INSIGHTS.md`, "Cancelling a live run
  doesn't stop it"). Such a run then stores a cost and, being `done`, counts in the PR-list sum.
