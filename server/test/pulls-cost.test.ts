/**
 * PR-list COST (`modules/pulls/cost.ts`) — the pure rule that prices a PR's
 * LATEST review batch (server/specs/L01-run-cost.md, S6–S10). Rows are fed
 * newest-first, exactly as the route queries them.
 */
import { describe, it, expect } from 'vitest';
import { latestReviewCostByPr, type RunCostRow } from '../src/modules/pulls/cost.js';

const run = (o: Partial<RunCostRow>): RunCostRow => ({
  prId: 'pr-1',
  reviewBatchId: 'b-new',
  status: 'done',
  costUsd: 0.001,
  ...o,
});

describe('latestReviewCostByPr', () => {
  it('PR without runs is absent (the route maps it to null)', () => {
    expect(latestReviewCostByPr([]).get('pr-1')).toBeUndefined();
  });

  it('sums the known costs of the finished latest batch; failed runs add nothing (S7)', () => {
    const cost = latestReviewCostByPr([
      run({ costUsd: 0.002 }),
      run({ costUsd: 0.003 }),
      run({ status: 'failed', costUsd: null }),
    ]).get('pr-1');
    expect(cost).toBeCloseTo(0.005, 10);
  });

  it('null while any run of the latest batch is still running (S6)', () => {
    const costs = latestReviewCostByPr([
      run({ status: 'running', costUsd: null }),
      run({ costUsd: 0.002 }),
    ]);
    expect(costs.get('pr-1')).toBeNull();
  });

  it('null when the finished latest batch has no known cost (S8)', () => {
    const costs = latestReviewCostByPr([
      run({ status: 'failed', costUsd: null }),
      run({ status: 'cancelled', costUsd: null }),
    ]);
    expect(costs.get('pr-1')).toBeNull();
  });

  it('null when the most recent run is a legacy run without a batch (S9)', () => {
    const costs = latestReviewCostByPr([
      run({ reviewBatchId: null, costUsd: null }),
      run({ reviewBatchId: 'b-old', costUsd: 0.004 }),
    ]);
    expect(costs.get('pr-1')).toBeNull();
  });

  it('older batches never contribute (S10)', () => {
    const cost = latestReviewCostByPr([
      run({ costUsd: 0.001 }),
      run({ reviewBatchId: 'b-old', costUsd: 0.5 }),
      run({ reviewBatchId: 'b-old', costUsd: 0.5 }),
    ]).get('pr-1');
    expect(cost).toBeCloseTo(0.001, 10);
  });

  it('a known zero cost (free model) stays 0, not null', () => {
    expect(latestReviewCostByPr([run({ costUsd: 0 })]).get('pr-1')).toBe(0);
  });

  it('prices each PR independently', () => {
    const costs = latestReviewCostByPr([
      run({ prId: 'pr-2', reviewBatchId: 'b-x', costUsd: 0.01 }),
      run({ costUsd: 0.002 }),
      run({ prId: 'pr-2', reviewBatchId: 'b-x', status: 'running', costUsd: null }),
    ]);
    expect(costs.get('pr-1')).toBeCloseTo(0.002, 10);
    expect(costs.get('pr-2')).toBeNull();
  });
});
