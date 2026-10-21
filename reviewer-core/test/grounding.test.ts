/**
 * groundFindings — the citation gate (spec E2). Pins range intersection
 * (incl. reversed ranges), file-not-in-diff, full-file kinds, the declared-range
 * fallback, and that an unbounded model-supplied range can't stall the loop.
 */
import { describe, it, expect } from 'vitest';
import type { Finding, UnifiedDiff } from '@devdigest/shared';
import { groundFindings, groundingSummary } from '../src/grounding.js';

// src/config.ts: lines 10-13 in a hunk. src/users.ts: no explicit line list,
// so grounding falls back to the declared new range 44..49.
const DIFF: UnifiedDiff = {
  raw: '',
  files: [
    {
      path: 'src/config.ts',
      additions: 1,
      deletions: 0,
      hunks: [
        { file: 'src/config.ts', oldStart: 10, oldLines: 3, newStart: 10, newLines: 4, newLineNumbers: [10, 11, 12, 13] },
      ],
    },
    {
      path: 'src/users.ts',
      additions: 4,
      deletions: 0,
      hunks: [{ file: 'src/users.ts', oldStart: 44, oldLines: 2, newStart: 44, newLines: 6, newLineNumbers: [] }],
    },
  ],
};

function f(partial: Partial<Finding>): Finding {
  return {
    id: 'x',
    severity: 'WARNING',
    category: 'bug',
    title: 't',
    file: 'src/config.ts',
    start_line: 12,
    end_line: 12,
    rationale: 'r',
    confidence: 0.8,
    ...partial,
  };
}

const keptIds = (findings: Finding[]) => groundFindings(findings, DIFF).kept.map((k) => k.id);

describe('groundFindings — citation gate', () => {
  it('keeps a finding on a hunk line and drops one outside every hunk', () => {
    const res = groundFindings([f({ id: 'in' }), f({ id: 'out', start_line: 40, end_line: 41 })], DIFF);
    expect(res.kept.map((k) => k.id)).toEqual(['in']);
    expect(res.dropped[0]!.finding.id).toBe('out');
    expect(res.dropped[0]!.reason).toMatch(/do not intersect any diff hunk in 'src\/config.ts'/);
    expect(groundingSummary(res)).toBe('1/2 passed');
  });

  it('keeps a range that only partially overlaps a hunk, at either edge', () => {
    expect(keptIds([f({ id: 'lo', start_line: 5, end_line: 10 }), f({ id: 'hi', start_line: 13, end_line: 20 })])).toEqual([
      'lo',
      'hi',
    ]);
    expect(keptIds([f({ id: 'gap', start_line: 14, end_line: 20 })])).toEqual([]);
  });

  it('treats a reversed range (start > end) like the normal one', () => {
    expect(keptIds([f({ id: 'rev', start_line: 20, end_line: 11 })])).toEqual(['rev']);
    expect(keptIds([f({ id: 'rev-out', start_line: 30, end_line: 20 })])).toEqual([]);
  });

  it("uses the hunk's declared new range when it has no explicit line list", () => {
    expect(keptIds([f({ id: 'a', file: 'src/users.ts', start_line: 49, end_line: 49 })])).toEqual(['a']);
    expect(keptIds([f({ id: 'b', file: 'src/users.ts', start_line: 50, end_line: 52 })])).toEqual([]);
  });

  it('drops a finding whose file is not in the diff, even for full-file kinds', () => {
    const res = groundFindings([f({ id: 'ghost', file: 'src/other.ts', kind: 'secret_leak' })], DIFF);
    expect(res.kept).toEqual([]);
    expect(res.dropped[0]!.reason).toBe("file 'src/other.ts' not present in diff");
  });

  it('keeps full-file kinds on any line of a file in the diff', () => {
    expect(keptIds([f({ id: 'secret', kind: 'secret_leak', start_line: 999, end_line: 999 })])).toEqual(['secret']);
  });

  it('handles an unbounded model-supplied range without iterating it', () => {
    const t0 = performance.now();
    const ids = keptIds([
      f({ id: 'huge', start_line: -2_000_000_000, end_line: 2_000_000_000 }),
      f({ id: 'huge-miss', start_line: 1_000_000, end_line: 2_000_000_000 }),
    ]);
    const ms = performance.now() - t0;
    // Same verdicts as before: the huge range overlaps the hunk, the far one doesn't.
    expect(ids).toEqual(['huge']);
    // The old loop walked lo..hi (~4e9 steps, seconds to minutes); now it's O(hunk lines).
    expect(ms).toBeLessThan(100);
  });
});
