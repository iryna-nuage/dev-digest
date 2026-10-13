/**
 * PR-list FINDINGS (pure — no DB, so it unit-tests cleanly).
 * Spec: server/specs/L01-findings-severity.md.
 *
 * "THIS RUN" is the PR's LATEST REVIEW — the same notion as the COST column:
 * every review of the review batch of the PR's most recent agent run. PRs
 * without a batch (no runs at all, e.g. the seeded review, or a pre-L01 run)
 * fall back to their latest review. A batch with no persisted review yet
 * (still running / every run failed) gives null.
 */

export interface FindingsRunRow {
  id: string;
  prId: string | null;
  reviewBatchId: string | null;
}

export interface FindingsReviewRow {
  id: string;
  prId: string;
  runId: string | null;
}

export interface FindingPreviewRow {
  id: string;
  reviewId: string;
  severity: string;
  confidence: number;
}

/** Sort weight per severity (lower = listed first); unknown severities last. */
const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, WARNING: 1, SUGGESTION: 2 };

/**
 * Review ids that make up each PR's latest review run. `runs` MUST be ordered
 * newest-first (`ran_at DESC`) and `reviews` newest-first (`created_at DESC`) —
 * the first row seen for a PR is its latest. PRs never reviewed are absent.
 */
export function latestRunReviewIds(
  runs: FindingsRunRow[],
  reviews: FindingsReviewRow[],
): Map<string, string[] | null> {
  const latestRun = new Map<string, FindingsRunRow>();
  for (const r of runs) {
    if (r.prId && !latestRun.has(r.prId)) latestRun.set(r.prId, r);
  }
  const latestReview = new Map<string, FindingsReviewRow>();
  for (const rv of reviews) {
    if (!latestReview.has(rv.prId)) latestReview.set(rv.prId, rv);
  }

  const out = new Map<string, string[] | null>();
  for (const [prId, run] of latestRun) {
    if (run.reviewBatchId == null) continue; // legacy run → fallback below
    const batchRunIds = new Set(
      runs.filter((r) => r.prId === prId && r.reviewBatchId === run.reviewBatchId).map((r) => r.id),
    );
    const ids = reviews
      .filter((rv) => rv.prId === prId && rv.runId != null && batchRunIds.has(rv.runId))
      .map((rv) => rv.id);
    out.set(prId, ids.length === 0 ? null : ids);
  }
  for (const [prId, rv] of latestReview) {
    if (!out.has(prId)) out.set(prId, [rv.id]);
  }
  return out;
}

/**
 * Findings of each PR's latest review run, sorted CRITICAL → WARNING →
 * SUGGESTION, then by confidence (highest first). PRs with `null` review ids
 * map to null; a PR whose reviews have no findings maps to [].
 */
export function latestFindingsByPr<F extends FindingPreviewRow>(
  reviewIdsByPr: Map<string, string[] | null>,
  findings: F[],
): Map<string, F[] | null> {
  const byReview = new Map<string, F[]>();
  for (const f of findings) {
    const list = byReview.get(f.reviewId) ?? [];
    list.push(f);
    byReview.set(f.reviewId, list);
  }
  const out = new Map<string, F[] | null>();
  for (const [prId, ids] of reviewIdsByPr) {
    if (ids == null) {
      out.set(prId, null);
      continue;
    }
    const list = ids.flatMap((id) => byReview.get(id) ?? []);
    list.sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) ||
        b.confidence - a.confidence,
    );
    out.set(prId, list);
  }
  return out;
}
