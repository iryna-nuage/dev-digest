import { describe, it, expect } from "vitest";
import type { PrMeta } from "./constants";
import { countNeedsReview, countOpen, filterPulls, sortPulls } from "./helpers";

const pr = (number: number, title: string, status: string, updated_at: string | null) =>
  ({ number, title, status, updated_at }) as PrMeta;

const PULLS = [
  pr(12, "Add Stripe checkout", "needs_review", "2026-10-02T10:00:00Z"),
  pr(7, "Fix N+1 query in users API", "reviewed", "2026-10-05T10:00:00Z"),
  pr(31, "Bump deps", "stale", null),
  pr(4, "Old refactor", "merged", "2026-09-01T10:00:00Z"),
  pr(120, "Docs typo", "closed", "not-a-date"),
];

const numbers = (list: PrMeta[]) => list.map((p) => p.number);

describe("PR list helpers", () => {
  it("filterPulls keeps only the chosen status; 'all' keeps everything", () => {
    expect(numbers(filterPulls(PULLS, "needs_review", ""))).toEqual([12]);
    expect(numbers(filterPulls(PULLS, "merged", ""))).toEqual([4]);
    expect(numbers(filterPulls(PULLS, "all", ""))).toEqual([12, 7, 31, 4, 120]);
  });

  it("filterPulls matches the query against the title (trimmed, case-insensitive) or the PR number", () => {
    expect(numbers(filterPulls(PULLS, "all", "  STRIPE "))).toEqual([12]);
    expect(numbers(filterPulls(PULLS, "all", "12"))).toEqual([12, 120]);
    expect(numbers(filterPulls(PULLS, "all", "   "))).toEqual([12, 7, 31, 4, 120]);
    expect(numbers(filterPulls(PULLS, "reviewed", "stripe"))).toEqual([]);
  });

  it("sortPulls orders newest-first by default and oldest-first on 'oldest'; missing/invalid dates count as 0", () => {
    expect(numbers(sortPulls(PULLS, "newest"))).toEqual([7, 12, 4, 31, 120]);
    expect(numbers(sortPulls(PULLS, "oldest"))).toEqual([31, 120, 4, 12, 7]);
  });

  it("sortPulls returns a copy and leaves the input untouched", () => {
    const before = numbers(PULLS);
    const sorted = sortPulls(PULLS, "oldest");
    expect(sorted).not.toBe(PULLS);
    expect(numbers(PULLS)).toEqual(before);
  });

  it("countOpen counts needs_review/reviewed/stale; countNeedsReview counts only needs_review", () => {
    expect(countOpen(PULLS)).toBe(3);
    expect(countNeedsReview(PULLS)).toBe(1);
    expect(countOpen([])).toBe(0);
    expect(countNeedsReview([])).toBe(0);
  });
});
