# L01 — Run cost (client)

Show the cost (and tokens) of agent runs in three places with one `RunCostBadge` component.
Data, persistence, review batches and the "latest review" rule are defined in
[`server/specs/L01-run-cost.md`](../../server/specs/L01-run-cost.md) — the client never recomputes
them, it only formats what the API returns.

## Data the client reads

| Field | Endpoint / hook | `null` / absent means |
|---|---|---|
| `PrMeta.cost_usd` | `GET /repos/:id/pulls` · `usePulls` | latest review unfinished, unknown, or never reviewed |
| `RunSummary.cost_usd`, `tokens_in`, `tokens_out` | `GET /pulls/:id/runs` · run history hook | cost unknown (failed, cancelled, no price, pre-L01 run) |
| `RunTrace.stats.cost_usd` | `GET /runs/:id/trace` · `useRunTrace` | same; absent on traces stored before L01 |

Contract fields come from `@devdigest/shared`; `client/src/vendor/shared/contracts/{trace,platform}.ts`
must mirror the server copy (server spec → Contracts).

## `RunCostBadge`

Location: `src/components/run-cost-badge/` (used by the PR list page and the PR detail page).

```ts
type RunCostBadgeProps = {
  costUsd: number | null | undefined;
  variant: "compact" | "detailed";
  tokensIn?: number | null;   // detailed only
  tokensOut?: number | null;  // detailed only
};
```

| Variant | Renders | Example |
|---|---|---|
| `compact` | cost only | `$0.012` |
| `detailed` | total tokens (`tokensIn + tokensOut`) · cost — as in the design mock | `9,119 tok · $0.0013` |

- Monospace, muted text, no background — it sits in dense rows.
- `detailed` drops the token part when the total is `0` or both counts are null
  (failed runs store `0/0`), leaving just the cost (or `—`). Known tokens with unknown cost →
  `9,119 tok · —`.
- Unknown cost renders `—` with `title` "Cost unknown" (i18n), never `$0.00`.

### Formatting (pure helpers, unit-tested)

`formatUsd(usd)`:

| Input | Output |
|---|---|
| `null` / `undefined` | `—` |
| `0` | `$0.00` (known zero, e.g. a free model) |
| `0 < x < 0.0001` | `<$0.0001` |
| `0.0001 ≤ x < 0.01` | 4 decimals — `$0.0013` |
| `0.01 ≤ x < 1` | 3 decimals — `$0.014` |
| `x ≥ 1` | 2 decimals — `$1.24` |

`formatTokenTotal(n)`: full number with `en-US` thousands separators + ` tok`
(`842 tok`, `9,119 tok`, `1,204,331 tok`).

The drawer's existing `formatTokens` (`4k→0.2k`) and its separate TOKENS tile are left untouched.

## Placement 1 — PR list, COST column

`src/app/repos/[repoId]/pulls/` — `constants.ts` (`COLUMN_KEYS`, `GRID`), `PRRow`, `messages/en/prReview.json`.

- New column **Cost** between *Status* and *Updated* (matches the design order).
- Cell: `<RunCostBadge variant="compact" costUsd={pr.cost_usd} />`.
- Shows `—` while the latest review is still running, for PRs never reviewed, for PRs whose latest
  run is pre-L01, and when no run in the latest review has a known cost. All of that is decided by
  the server (`cost_usd: null`); the cell does not look at run statuses.
- No new polling: the value appears on the next `usePulls` refetch (60 s / window focus).

## Placement 2 — PR detail, Agent runs timeline

`src/app/repos/[repoId]/pulls/[number]/_components/RunHistory/RunHistory.tsx`.

- In each run row's right-hand column, next to the run time:
  `<RunCostBadge variant="detailed" costUsd={r.cost_usd} tokensIn={r.tokens_in} tokensOut={r.tokens_out} />`.
- `status = 'running'` → no badge (the run isn't finished).
- `done` / `failed` / `cancelled` → badge always shown; unknown cost → `—`.
- Commit rows are unchanged.

## Placement 3 — Run trace drawer, Stats

`.../RunTraceDrawer/_components/TraceBody/TraceBody.tsx`, `messages/en/runs.json` (`trace.stat.cost`).

- New tile **COST** between *TOKENS* and *FINDINGS*: value `formatUsd(stats.cost_usd)`.
- Unknown / absent → `—`.

## Out of scope

- A cost line in the verdict banner (mentioned in the lesson slide; not one of the three screens
  agreed for this task).
- Cost on the Review Runs accordion, Agents, Eval, CI and Agent Performance pages.

## Acceptance criteria

| # | Given | Then |
|---|---|---|
| C1 | PR list, `cost_usd = 0.0123` | Cost cell shows `$0.012` |
| C2 | PR list, `cost_usd = null` (in progress, never reviewed, legacy, all failed) | Cost cell shows `—`, never `$0.00` |
| C3 | Timeline, finished run with cost and tokens (`8,200 + 919`, `$0.0013`) | `9,119 tok · $0.0013` next to the time |
| C4 | Timeline, `failed` run (cost `null`, tokens `0/0`) | `—` next to the time |
| C5 | Timeline, `running` run | No badge |
| C6 | Drawer, `stats.cost_usd = 0.06` | COST tile shows `$0.060` |
| C7 | Drawer, trace without `cost_usd` | COST tile shows `—` |
| C8 | Any view | Rendering makes no extra API or model calls |

Server-side behaviour behind C2 (which batch, when it counts as finished): server spec S6–S10.

## Tests (Vitest + RTL)

- `formatUsd` / `formatTokenTotal`: every row of the tables above.
- `RunCostBadge`: both variants, `—` case, token part dropped on `0/0`, `9,119 tok · —`.
- `RunHistory.test.tsx`: badge for `done` and `failed`, none for `running` (C3–C5).
- `RunTraceDrawer.test.tsx`: COST tile with a value and without (C6–C7); restore `cost_usd` in the
  `TRACE` fixture.
- `PRRow`: Cost cell with a value and with `null` (C1–C2).
