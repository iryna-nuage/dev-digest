# L01 — Run cost (client)

Show the cost (and tokens) of agent runs in three places with one `RunCostBadge` component: the
Timeline and the trace drawer show the **individual run's** cost; the PR list shows the **sum of all
successful runs of the PR**. Data, persistence and the PR-list sum rule are defined in
[`server/specs/L01-run-cost.md`](../../server/specs/L01-run-cost.md) — the client never recomputes
them, it only formats what the API returns.

## Data the client reads

| Field | Endpoint / hook | `null` / absent means |
|---|---|---|
| `PrMeta.cost_usd` (sum of the PR's successful runs) | `GET /repos/:id/pulls` · `usePulls` | no successful run with a known cost (never reviewed, only failed / cancelled / running runs, or unknown costs) |
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
| `0 < x < 0.000001` | `<$0.000001` |
| `0.000001 ≤ x < 0.01` | up to 6 decimals, trailing zeros trimmed — `$0.000722`, `$0.0013`, `$0.002` (matches OpenRouter logs) |
| `0.01 ≤ x < 1` | 3 decimals — `$0.014` |
| `x ≥ 1` | 2 decimals — `$1.24` |

`formatTokenTotal(n)`: full number with `en-US` thousands separators + ` tok`
(`842 tok`, `9,119 tok`, `1,204,331 tok`).

The drawer's existing `formatTokens` (`4k→0.2k`) and its separate TOKENS tile are left untouched.

## Placement 1 — PR list, COST column

`src/app/repos/[repoId]/pulls/` — `constants.ts` (`COLUMN_KEYS`, `GRID`), `PRRow`, `messages/en/prReview.json`.

- New column **Cost** between *Status* and *Updated* (matches the design order).
- Cell: `<RunCostBadge variant="compact" costUsd={pr.cost_usd} />` — the PR's total over all its
  successful runs, e.g. `0.008296 + 0.004938 = 0.013234` renders `$0.013` (formatting table above).
- Shows `—` when the PR has no successful run with a known cost (never reviewed, only failed /
  cancelled runs, only unknown or pre-L01 costs). While a new review runs, the cell keeps showing the
  total of the runs that already succeeded. All of that is decided by the server (`cost_usd`); the
  cell does not look at run statuses.
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
| C1 | PR list, `cost_usd = 0.013234` (sum of two successful runs) | Cost cell shows `$0.013` |
| C2 | PR list, `cost_usd = null` (never reviewed, only failed / cancelled, unknown or legacy costs) | Cost cell shows `—`, never `$0.00` |
| C3 | Timeline, finished run with cost and tokens (`8,200 + 919`, `$0.0013`) | `9,119 tok · $0.0013` next to the time |
| C4 | Timeline, `failed` run (cost `null`, tokens `0/0`) | `—` next to the time |
| C5 | Timeline, `running` run | No badge |
| C6 | Drawer, `stats.cost_usd = 0.06` | COST tile shows `$0.060` |
| C7 | Drawer, trace without `cost_usd` | COST tile shows `—` |
| C8 | Any view | Rendering makes no extra API or model calls |

Server-side behaviour behind C1–C2 (which runs are summed): server spec S6–S10a.

## Tests (Vitest + RTL)

- `formatUsd` / `formatTokenTotal`: every row of the tables above.
- `RunCostBadge`: both variants, `—` case, token part dropped on `0/0`, `9,119 tok · —`.
- `RunHistory.test.tsx`: badge for `done` and `failed`, none for `running` (C3–C5).
- `RunTraceDrawer.test.tsx`: COST tile with a value and without (C6–C7); restore `cost_usd` in the
  `TRACE` fixture.
- `PRRow`: Cost cell with a value and with `null` (C1–C2).
