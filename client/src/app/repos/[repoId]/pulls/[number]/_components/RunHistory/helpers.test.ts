import { describe, it, expect } from "vitest";
import type { RunSummary } from "@devdigest/shared";
import { outcomeOf, tsOf } from "./helpers";

const run = (p: Partial<RunSummary>) => p as RunSummary;
const key = (p: Partial<RunSummary>) => outcomeOf(run(p)).key;

describe("RunHistory helpers", () => {
  it("outcomeOf reports the lifecycle state before any counts", () => {
    expect(key({ status: "running", blockers: 2, findings_count: 5 })).toBe("running");
    expect(key({ status: "failed", blockers: 2 })).toBe("error");
    expect(key({ status: "cancelled", findings_count: 1 })).toBe("cancelled");
  });

  it("outcomeOf grades a settled run by its deterministic counts, not the verdict", () => {
    expect(key({ status: "done", blockers: 1, findings_count: 3 })).toBe("rejected");
    expect(key({ status: "done", blockers: 0, findings_count: 3 })).toBe("reviewed");
    expect(key({ status: "done", blockers: 0, findings_count: 0 })).toBe("approved");
    expect(key({ status: "done" })).toBe("approved");
  });

  it("outcomeOf treats a missing status as settled", () => {
    expect(key({ status: null, blockers: 1 })).toBe("rejected");
    expect(key({})).toBe("approved");
  });

  it("outcomeOf pairs each outcome with its colour tokens and icon", () => {
    expect(outcomeOf(run({ status: "done", blockers: 1 }))).toEqual({
      key: "rejected",
      color: "var(--crit)",
      bg: "var(--crit-bg)",
      icon: "XCircle",
    });
  });

  it("tsOf parses ISO timestamps and maps missing/unparseable ones to 0", () => {
    expect(tsOf("2026-10-02T10:00:00Z")).toBe(Date.parse("2026-10-02T10:00:00Z"));
    expect(tsOf(null)).toBe(0);
    expect(tsOf(undefined)).toBe(0);
    expect(tsOf("")).toBe(0);
    expect(tsOf("not-a-date")).toBe(0);
  });
});
