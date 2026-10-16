import { describe, it, expect } from "vitest";
import type { FindingRecord, Severity } from "@devdigest/shared";
import { filterBySeverity, visibleFindings } from "./helpers";

const f = (id: string, severity: Severity, confidence = 0.9) =>
  ({ id, severity, confidence }) as FindingRecord;

const ALL = [f("s", "SUGGESTION"), f("w-low", "WARNING", 0.4), f("c", "CRITICAL"), f("w", "WARNING")];

describe("FindingsPanel helpers", () => {
  it("visibleFindings sorts by severity and drops low confidence only when asked", () => {
    expect(visibleFindings(ALL, false).map((x) => x.id)).toEqual(["c", "w-low", "w", "s"]);
    expect(visibleFindings(ALL, true).map((x) => x.id)).toEqual(["c", "w", "s"]);
  });

  it("filterBySeverity narrows to one severity; null keeps everything", () => {
    const eligible = visibleFindings(ALL, false);
    expect(filterBySeverity(eligible, "WARNING").map((x) => x.id)).toEqual(["w-low", "w"]);
    expect(filterBySeverity(eligible, null)).toBe(eligible);
    expect(filterBySeverity(eligible, "CRITICAL").map((x) => x.id)).toEqual(["c"]);
  });
});
