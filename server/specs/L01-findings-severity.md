# L01 — Findings by severity (server)

HW1 criteria 16–22: findings counters by severity, a severity filter on the PR page, and a read-only
"N FINDINGS IN THIS RUN" popover on the PR list. Only the PR list (criteria 20–21) needs new data from
the server. The PR detail page reads endpoints that already exist. UI placement, the filter, and the
empty states are covered in
[`client/specs/L01-findings-severity.md`](../../client/specs/L01-findings-severity.md).

## Context — starting state

- `GET /pulls/:id/reviews` already returns every persisted finding with its `severity`, grouped by
  review, and each review carries its `run_id`. The PR detail page (Review runs cards, Timeline,
  Trace drawer) therefore needs **no server change**.
- `GET /repos/:id/pulls` returns `score` (latest review) and `cost_usd` (latest review batch, see
  [`L01-run-cost.md`](L01-run-cost.md)) but no findings. The old per-severity counts
  `findings_critical/warning/suggestion` were removed on purpose in commit `e07efea`
  ("cleanup before home tasks"). `rollupSeverities` in `src/modules/pulls/status.ts` is still there but
  the list no longer uses it.
- `Severity` is `CRITICAL | WARNING | SUGGESTION` (`src/vendor/shared/contracts/findings.ts`).

## Non-goals

- No LLM calls of any kind. The new data is a plain `SELECT` over persisted `findings`.
- No migration, no new table or column, no index, no denormalised counters.
- No change to `GET /pulls/:id/reviews`, `GET /pulls/:id/runs`, `GET /runs/:id/trace`,
  `GET /pulls/:id`. The Trace drawer's findings (criterion 23) keep coming from
  `GET /pulls/:id/reviews`.
- No per-severity counts on the server. The client derives them from the returned array, so the
  icons in the list cell and the popover items always match.
- `review_batch_id` stays unexposed, as in L01.

## Contracts (`src/vendor/shared/contracts/platform.ts`, mirrored to `client/src/vendor/shared/`)

```ts
import { Severity, FindingCategory } from './findings.js'; // findings.ts imports only zod → no cycle

/** Read-only preview of one finding for the PR-list popover. */
export const PrFindingPreview = z.object({
  id: z.string(),
  severity: Severity,
  category: FindingCategory,
  title: z.string(),
  file: z.string(),
  start_line: z.number().int(),
  end_line: z.number().int(),
  confidence: z.number(),
  rationale: z.string(), // markdown, sent in full; the client clamps it
});
export type PrFindingPreview = z.infer<typeof PrFindingPreview>;
```

| Schema | Field | Notes |
|---|---|---|
| `PrMeta` | `latest_findings: z.array(PrFindingPreview).nullish()` | List endpoint only, like `score` / `cost_usd`. `null` = nothing to show. `nullish` so payloads without the field still parse. |

No other fields of the finding are sent (no `suggestion`, `evidence`, `trifecta_components`,
`accepted_at` / `dismissed_at`). The popover is read-only.

## "Latest run" — which findings the list shows

"THIS RUN" is the **latest review**: the same notion as `PrMeta.cost_usd`, i.e. every agent of
the PR's most recent "Run Review" launch (review batch). There is one fallback, for PRs that have
no batch:

```
runs    = agent_runs (id, pr_id, review_batch_id) of the listed PRs, ORDER BY ran_at DESC
          -- the existing cost query, plus `id`
reviews = reviews (id, pr_id, run_id) of the listed PRs, kind = 'review', ORDER BY created_at DESC
          -- the existing score query, plus `id`, `run_id`

per PR:
  latestRun = first row of runs for the PR
  if latestRun exists and latestRun.review_batch_id IS NOT NULL:
      batchRunIds = ids of the PR's runs with that review_batch_id
      reviewIds   = ids of reviews whose run_id ∈ batchRunIds
      if reviewIds is empty → null                    // batch still running with nothing persisted, or every run failed
  else:                                               // no runs at all (seeded review) or a pre-L01 run
      latestReview = first row of reviews for the PR
      reviewIds = latestReview ? [latestReview.id] : null   // null = never reviewed

findings = SELECT id, review_id, severity, category, title, file, start_line, end_line, confidence, rationale
           FROM findings WHERE review_id IN (all reviewIds)   -- the only new query
per PR: latest_findings = findings of its reviewIds, sorted by severity
        (CRITICAL → WARNING → SUGGESTION), then confidence DESC
```

- Older batches never contribute.
- While a batch is still running, the findings of agents that already finished are shown, because
  each review's findings are final once persisted. A batch with no persisted review yet gives
  `null`. This deliberately differs from `cost_usd`, which stays `null` until the whole batch
  finishes because a partial sum would be misleading.
- Accepted and dismissed findings are included, the same as in the PR page's Review runs card.
- `[]` (a finished review with zero findings) and `null` are both valid. The client renders `—`
  for both.
- Deletes show up on the next read: `DELETE /runs/:id` removes the run and its review, and
  `DELETE /reviews/:id` removes the review. Deleting the whole latest batch makes the previous batch
  the latest review.
- Scoping: the runs query is already filtered by `workspace_id`. Reviews and findings are scoped
  through the `pr_id`s of a workspace-scoped repo, the same way as the existing score query.

### Where it lives

- Pure helper `src/modules/pulls/findings.ts`, next to `cost.ts`. It picks the review ids per PR, then
  groups and sorts findings. No DB access, so it unit-tests cleanly.
- `src/modules/pulls/routes.ts` (`GET /repos/:id/pulls`): extend the two existing selects with the
  columns above, add the one `findings` query (skipped when no review ids), and map rows to
  `PrFindingPreview` (`startLine` → `start_line`, etc.). Update the outdated comment "the
  per-severity FINDINGS breakdown is intentionally not surfaced on the list".
- `pulls` querying Drizzle in routes is the documented legacy exception. Keep the new grouping
  logic in the helper and don't add more logic to the route.

## API

| Route | Change |
|---|---|
| `GET /repos/:id/pulls` | Each `PrMeta` carries `latest_findings` (rule above). |
| every other route | Unchanged. |

## Acceptance criteria

| # | Given | Then |
|---|---|---|
| FS1 | PR with no runs and no reviews | `latest_findings = null` |
| FS2 | Latest batch: two agents' reviews with findings | the union of both reviews' findings |
| FS3 | Older batches with findings exist | they never appear |
| FS4 | Latest batch has no persisted review (still running / all failed) | `null` |
| FS5 | No runs but a review exists (seeded PR #482), or the latest run has no batch (pre-L01) | findings of the latest review (`kind = 'review'`) |
| FS6 | Any non-empty result | sorted CRITICAL → WARNING → SUGGESTION, then confidence DESC |
| FS7 | Latest review finished with zero findings | `latest_findings = []` |
| FS8 | `GET /repos/:id/pulls` | makes no LLM request; adds exactly one query (findings); no migration |
| FS9 | A `PrMeta` without `latest_findings` | still parses (`nullish`) |

## Tests

- Unit `test/pulls-findings.test.ts`: the pure helper, cases FS1–FS7, in the same style as
  `pulls-cost.test.ts`.
- `test/contracts.test.ts`: `PrMeta` accepts `latest_findings` (array, `null`) and parses without it
  (FS9). `PrFindingPreview` rejects an unknown severity.
- Integration `test/reviews.it.test.ts` (testcontainers, mock LLM with `overrides.llm.openrouter`
  set, see `server/INSIGHTS.md`): after a review, `GET /repos/:id/pulls` returns that review's
  findings. A second launch replaces them (FS2/FS3). `MockLLMProvider.calls` doesn't grow across the
  list call (FS8).

## Risks / notes

- Payload: full `rationale` for the latest run's findings, for each listed PR, on a list that the
  client polls every 60 s. This is acceptable for a local-first app with a handful of findings per run.
  If it grows, cap the length on the server; the client already clamps it.
- Windows/Docker: if Docker hangs, `.it` files silently skip. Use the replay workaround in
  `server/INSIGHTS.md` and never count "skipped" as coverage.
