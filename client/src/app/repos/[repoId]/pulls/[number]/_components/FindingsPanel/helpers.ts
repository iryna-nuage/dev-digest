import type { FindingRecord, Severity } from "@devdigest/shared";
import { LOW_CONFIDENCE_THRESHOLD, SEVERITY_ORDER } from "./constants";

/** Optionally drop low-confidence findings and sort by severity. */
export function visibleFindings(findings: FindingRecord[], hideLow: boolean): FindingRecord[] {
  let shown = findings;
  if (hideLow) shown = shown.filter((f) => f.confidence >= LOW_CONFIDENCE_THRESHOLD);
  return [...shown].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );
}

/**
 * Narrow the card's visible findings to one severity (null = no filter). Only
 * filters — the severity counters are taken from the same `findings` input.
 */
export function filterBySeverity(findings: FindingRecord[], severity: Severity | null): FindingRecord[] {
  return severity ? findings.filter((f) => f.severity === severity) : findings;
}
