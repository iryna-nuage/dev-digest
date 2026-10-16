/**
 * PR-list COST (`modules/pulls/cost.ts`) — the pure rule that totals ALL of a
 * PR's successful runs with a known cost (server/specs/L01-run-cost.md,
 * S6–S10a; HW1 criterion 12). Per-run cost (Timeline, trace) is not affected.
 */
import { describe, it, expect } from 'vitest';
import { successfulRunsCostByPr, type RunCostRow } from '../src/modules/pulls/cost.js';

const run = (o: Partial<RunCostRow>): RunCostRow => ({
  prId: 'pr-1',
  status: 'done',
  costUsd: 0.001,
  ...o,
});

describe('successfulRunsCostByPr', () => {
  it('PR without runs is absent (the route maps it to null)', () => {
    expect(successfulRunsCostByPr([]).get('pr-1')).toBeUndefined();
  });

  it('sums two successful runs from separate launches: 0.008296 + 0.004938 = 0.013234 (S6)', () => {
    // Newest first, as the route queries them — order plays no part in the sum.
    const cost = successfulRunsCostByPr([run({ costUsd: 0.004938 }), run({ costUsd: 0.008296 })]).get('pr-1');
    expect(cost).toBeCloseTo(0.013234, 10);
  });

  it('sums every successful run of one launch; a failed run adds nothing (S7)', () => {
    const cost = successfulRunsCostByPr([
      run({ costUsd: 0.002 }),
      run({ costUsd: 0.003 }),
      run({ status: 'failed', costUsd: null }),
    ]).get('pr-1');
    expect(cost).toBeCloseTo(0.005, 10);
  });

  it('failed / cancelled / running runs and NULL costs never contribute — not even a stored cost on a failed run (S8)', () => {
    const cost = successfulRunsCostByPr([
      run({ costUsd: 0.004 }),
      run({ status: 'failed', costUsd: 0.5 }),
      run({ status: 'cancelled', costUsd: 0.5 }),
      run({ status: 'running', costUsd: null }),
      run({ status: 'done', costUsd: null }), // unknown price / pre-L01
    ]).get('pr-1');
    expect(cost).toBeCloseTo(0.004, 10);
  });

  it('null when the PR has no successful run with a known cost (S9)', () => {
    const costs = successfulRunsCostByPr([
      run({ prId: 'pr-failed', status: 'failed', costUsd: null }),
      run({ prId: 'pr-failed', status: 'cancelled', costUsd: null }),
      run({ prId: 'pr-running', status: 'running', costUsd: null }),
      run({ prId: 'pr-legacy', status: 'done', costUsd: null }),
    ]);
    expect(costs.get('pr-failed')).toBeNull();
    expect(costs.get('pr-running')).toBeNull();
    expect(costs.get('pr-legacy')).toBeNull();
  });

  it('older successful runs keep contributing after a newer launch — succeeded, failed or running (S10)', () => {
    const older = run({ costUsd: 0.008296 });
    expect(successfulRunsCostByPr([run({ costUsd: 0.004938 }), older]).get('pr-1')).toBeCloseTo(0.013234, 10);
    expect(successfulRunsCostByPr([run({ status: 'failed', costUsd: null }), older]).get('pr-1')).toBeCloseTo(0.008296, 10);
    // A newer launch still running never hides the total (no "—" while it runs).
    expect(successfulRunsCostByPr([run({ status: 'running', costUsd: null }), older]).get('pr-1')).toBeCloseTo(0.008296, 10);
  });

  it('a known zero cost (free model) counts: an all-free PR totals 0, not null (S10a)', () => {
    expect(successfulRunsCostByPr([run({ costUsd: 0 }), run({ costUsd: 0 })]).get('pr-1')).toBe(0);
  });

  it('totals each PR independently', () => {
    const costs = successfulRunsCostByPr([
      run({ prId: 'pr-2', costUsd: 0.01 }),
      run({ costUsd: 0.002 }),
      run({ prId: 'pr-2', costUsd: 0.02 }),
      run({ prId: 'pr-2', status: 'running', costUsd: null }),
    ]);
    expect(costs.get('pr-1')).toBeCloseTo(0.002, 10);
    expect(costs.get('pr-2')).toBeCloseTo(0.03, 10);
  });
});
