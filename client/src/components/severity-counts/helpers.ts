import type { Severity } from "@devdigest/shared";

/** Display order of the finding severities, everywhere. */
export const SEVERITIES: readonly Severity[] = ["CRITICAL", "WARNING", "SUGGESTION"];

export type SeverityCounts = Record<Severity, number>;

/** Tally findings by `severity` (a plain COUNT — no model involved). Unknown values are ignored. */
export function countBySeverity(findings: ReadonlyArray<{ severity: string }> | null | undefined): SeverityCounts {
  const counts: SeverityCounts = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
  for (const f of findings ?? []) {
    if (f.severity in counts) counts[f.severity as Severity] += 1;
  }
  return counts;
}

/** Total of all severities. */
export function totalOf(counts: SeverityCounts): number {
  return SEVERITIES.reduce((sum, s) => sum + counts[s], 0);
}
