/**
 * PR-list FINDINGS (`modules/pulls/findings.ts`) — the pure rule that picks a
 * PR's LATEST review run for the read-only popover
 * (server/specs/L01-findings-severity.md, FS1–FS7). Rows are fed newest-first,
 * exactly as the route queries them.
 */
import { describe, it, expect } from 'vitest';
import {
  latestRunReviewIds,
  latestFindingsByPr,
  type FindingsRunRow,
  type FindingsReviewRow,
  type FindingPreviewRow,
} from '../src/modules/pulls/findings.js';

const run = (o: Partial<FindingsRunRow>): FindingsRunRow => ({
  id: 'run-1',
  prId: 'pr-1',
  reviewBatchId: 'b-new',
  ...o,
});
const review = (o: Partial<FindingsReviewRow>): FindingsReviewRow => ({
  id: 'rv-1',
  prId: 'pr-1',
  runId: 'run-1',
  ...o,
});
const finding = (o: Partial<FindingPreviewRow>): FindingPreviewRow => ({
  id: 'f-1',
  reviewId: 'rv-1',
  severity: 'WARNING',
  confidence: 0.8,
  ...o,
});

describe('latestRunReviewIds', () => {
  it('PR with no runs and no reviews is absent (the route maps it to null) (FS1)', () => {
    expect(latestRunReviewIds([], []).get('pr-1')).toBeUndefined();
  });

  it('takes every review of the latest batch (FS2) and none of older batches (FS3)', () => {
    const ids = latestRunReviewIds(
      [
        run({ id: 'run-a', reviewBatchId: 'b-new' }),
        run({ id: 'run-b', reviewBatchId: 'b-new' }),
        run({ id: 'run-old', reviewBatchId: 'b-old' }),
      ],
      [
        review({ id: 'rv-b', runId: 'run-b' }),
        review({ id: 'rv-a', runId: 'run-a' }),
        review({ id: 'rv-old', runId: 'run-old' }),
      ],
    ).get('pr-1');
    expect(ids).toEqual(['rv-b', 'rv-a']);
  });

  it('latest batch without a persisted review (running / all failed) → null, never an older batch (FS4)', () => {
    const ids = latestRunReviewIds(
      [run({ id: 'run-new', reviewBatchId: 'b-new' }), run({ id: 'run-old', reviewBatchId: 'b-old' })],
      [review({ id: 'rv-old', runId: 'run-old' })],
    );
    expect(ids.get('pr-1')).toBeNull();
  });

  it('no runs but a review (seeded PR) → the latest review (FS5)', () => {
    const ids = latestRunReviewIds([], [review({ id: 'rv-new', runId: null }), review({ id: 'rv-seed', runId: null })]);
    expect(ids.get('pr-1')).toEqual(['rv-new']);
  });

  it('latest run is a pre-L01 run (no batch) → the latest review (FS5)', () => {
    const ids = latestRunReviewIds(
      [run({ id: 'run-legacy', reviewBatchId: null })],
      [review({ id: 'rv-legacy', runId: 'run-legacy' })],
    );
    expect(ids.get('pr-1')).toEqual(['rv-legacy']);
  });

  it('keeps PRs apart', () => {
    const ids = latestRunReviewIds(
      [run({ id: 'run-1', prId: 'pr-1', reviewBatchId: 'b1' }), run({ id: 'run-2', prId: 'pr-2', reviewBatchId: 'b2' })],
      [review({ id: 'rv-1', prId: 'pr-1', runId: 'run-1' }), review({ id: 'rv-2', prId: 'pr-2', runId: 'run-2' })],
    );
    expect(ids.get('pr-1')).toEqual(['rv-1']);
    expect(ids.get('pr-2')).toEqual(['rv-2']);
  });
});

describe('latestFindingsByPr', () => {
  it('sorts CRITICAL → WARNING → SUGGESTION, then confidence DESC, across reviews (FS6)', () => {
    const out = latestFindingsByPr(new Map([['pr-1', ['rv-a', 'rv-b']]]), [
      finding({ id: 'sugg', reviewId: 'rv-a', severity: 'SUGGESTION', confidence: 0.99 }),
      finding({ id: 'warn-low', reviewId: 'rv-b', severity: 'WARNING', confidence: 0.6 }),
      finding({ id: 'crit', reviewId: 'rv-b', severity: 'CRITICAL', confidence: 0.7 }),
      finding({ id: 'warn-high', reviewId: 'rv-a', severity: 'WARNING', confidence: 0.9 }),
      finding({ id: 'other-review', reviewId: 'rv-x', severity: 'CRITICAL' }),
    ]);
    expect(out.get('pr-1')!.map((f) => f.id)).toEqual(['crit', 'warn-high', 'warn-low', 'sugg']);
  });

  it('finished review with zero findings → [] (FS7); null review ids → null (FS4)', () => {
    const out = latestFindingsByPr(
      new Map<string, string[] | null>([
        ['pr-1', ['rv-empty']],
        ['pr-2', null],
      ]),
      [],
    );
    expect(out.get('pr-1')).toEqual([]);
    expect(out.get('pr-2')).toBeNull();
  });
});
