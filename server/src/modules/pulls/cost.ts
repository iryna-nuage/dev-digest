/**
 * PR-list COST (pure — no DB, so it unit-tests cleanly). Spec: server/specs/L01-run-cost.md.
 *
 * A PR's COST is the cost of its LATEST REVIEW: the review batch of the PR's
 * most recent agent run (`agent_runs.review_batch_id`, one id per
 * `POST /pulls/:id/review`). Older batches never count.
 *
 * Null (the UI shows "—") when the latest run has no batch (pre-L01 run), when
 * any run of the batch is still `running`, or when no run of the batch has a
 * known cost. Failed/cancelled runs are finished and simply add nothing.
 */

export interface RunCostRow {
  prId: string | null;
  reviewBatchId: string | null;
  status: string | null;
  costUsd: number | null;
}

/**
 * Latest-review cost per PR. `rows` MUST be ordered newest-first (`ran_at DESC`)
 * — the first row seen for a PR decides its latest batch.
 */
export function latestReviewCostByPr(rows: RunCostRow[]): Map<string, number | null> {
  const latestBatch = new Map<string, string | null>();
  for (const r of rows) {
    if (r.prId && !latestBatch.has(r.prId)) latestBatch.set(r.prId, r.reviewBatchId);
  }

  const out = new Map<string, number | null>();
  for (const [prId, batchId] of latestBatch) {
    if (batchId == null) {
      out.set(prId, null);
      continue;
    }
    const batch = rows.filter((r) => r.prId === prId && r.reviewBatchId === batchId);
    if (batch.some((r) => r.status === 'running')) {
      out.set(prId, null);
      continue;
    }
    const known = batch.filter((r) => r.costUsd != null).map((r) => r.costUsd!);
    out.set(prId, known.length === 0 ? null : known.reduce((a, b) => a + b, 0));
  }
  return out;
}
