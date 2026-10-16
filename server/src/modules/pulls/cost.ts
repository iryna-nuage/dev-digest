/**
 * PR-list COST (pure — no DB, so it unit-tests cleanly). Spec: server/specs/L01-run-cost.md.
 *
 * A PR's COST is the SUM of the costs of ALL its successful runs: every
 * `status = 'done'` agent run with a known `cost_usd`, across all launches —
 * older runs keep counting when newer ones happen. Failed / cancelled / still
 * running runs and unknown (NULL) costs add nothing. Per-run cost (Timeline,
 * trace) stays the individual run's own value.
 *
 * Null (the UI shows "—") when the PR has no successful run with a known cost.
 */

export interface RunCostRow {
  prId: string | null;
  status: string | null;
  costUsd: number | null;
}

/**
 * Total successful-run cost per PR. PRs without any run are absent (the route
 * maps them to null); PRs whose runs have no successful known cost map to null.
 * A known 0 (free model) counts, so an all-free PR totals 0, not null.
 */
export function successfulRunsCostByPr(rows: RunCostRow[]): Map<string, number | null> {
  const out = new Map<string, number | null>();
  for (const r of rows) {
    if (!r.prId) continue;
    const total = out.get(r.prId) ?? null;
    if (r.status === 'done' && r.costUsd != null) out.set(r.prId, (total ?? 0) + r.costUsd);
    else out.set(r.prId, total);
  }
  return out;
}
