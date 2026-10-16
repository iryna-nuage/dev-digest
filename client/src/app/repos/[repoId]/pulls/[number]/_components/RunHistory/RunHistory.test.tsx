/**
 * RunHistory — the badge must reflect the review OUTCOME, not the run lifecycle.
 * Regression guard for the "green ✓ done on a run that found 5 blockers" bug:
 * a settled run is colored/labelled by its denormalized blocker/finding counts,
 * and shows the review score ring.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord, RunSummary, Severity } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";
import common from "../../../../../../../../messages/en/common.json";
import { RunHistory } from "./RunHistory";

afterEach(cleanup);

function run(o: Partial<RunSummary>): RunSummary {
  return {
    run_id: "run-1",
    agent_id: "a1",
    agent_name: "Security Reviewer",
    provider: "openrouter",
    model: "deepseek/deepseek-v4-flash",
    status: "done",
    error: null,
    duration_ms: 1000,
    tokens_in: 100,
    tokens_out: 50,
    cost_usd: null,
    findings_count: 0,
    grounding: "0/0 passed",
    ran_at: "2026-06-11T18:44:34.000Z",
    score: null,
    blockers: null,
    ...o,
  };
}

function renderRuns(runs: RunSummary[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages, common }}>
      <RunHistory runs={runs} onOpenTrace={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe("RunHistory — outcome badge", () => {
  it("a done run WITH blockers reads 'rejected' (never green 'done') + shows the score ring", () => {
    renderRuns([run({ status: "done", findings_count: 5, blockers: 5, score: 0 })]);
    expect(screen.getByText("rejected")).toBeInTheDocument();
    expect(screen.queryByText("done")).not.toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument(); // CircularScore renders the number
    expect(screen.getByText(/5 blockers/)).toBeInTheDocument();
  });

  it("a clean done run reads 'approved'", () => {
    renderRuns([run({ status: "done", findings_count: 0, blockers: 0, score: 95 })]);
    expect(screen.getByText("approved")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
  });

  it("a done run with non-blocking findings reads 'reviewed'", () => {
    renderRuns([run({ status: "done", findings_count: 3, blockers: 0, score: 72 })]);
    expect(screen.getByText("reviewed")).toBeInTheDocument();
    expect(screen.queryByText(/blockers/)).not.toBeInTheDocument();
  });

  it("a failed run reads 'error'", () => {
    renderRuns([run({ status: "failed", error: "boom", score: null, blockers: null })]);
    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("a running run reads 'running'", () => {
    renderRuns([run({ status: "running", score: null, blockers: null })]);
    expect(screen.getByText("running")).toBeInTheDocument();
  });
});

function finding(id: string, severity: Severity, title: string, o: Partial<FindingRecord> = {}): FindingRecord {
  return {
    id, severity, title, category: "security", file: "src/config.ts", start_line: 12, end_line: 12,
    rationale: "Why it matters.", suggestion: "Fix it.", confidence: 0.9, kind: "finding",
    trifecta_components: null, evidence: null, review_id: "rv-1", accepted_at: null, dismissed_at: null,
    ...o,
  };
}

const RUN1_FINDINGS = [
  finding("f1", "CRITICAL", "Hardcoded Stripe secret key in commit", { confidence: 0.98 }),
  finding("f2", "CRITICAL", "Lethal trifecta: untrusted input reaches exfil path"),
  finding("f3", "WARNING", "N+1 query in user list endpoint", {
    category: "perf", file: "src/api/users.ts", start_line: 45, end_line: 52, confidence: 0.86,
    rationale: "The loop calls `db.posts.findMany` once per user.",
  }),
];
const RUN2_FINDINGS = [finding("g1", "SUGGESTION", "Extract magic number 3600", { category: "style" })];

describe("RunHistory — HW1 severity icons + read-only preview (criterion 16)", () => {
  function renderTimeline(
    runs: RunSummary[],
    findingsByRun?: Record<string, FindingRecord[]>,
    handlers: { onOpenTrace?: () => void; onGoToReview?: () => void } = {},
  ) {
    return render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages, common }}>
        <RunHistory
          runs={runs}
          onOpenTrace={handlers.onOpenTrace ?? (() => {})}
          onGoToReview={handlers.onGoToReview}
          findingsByRun={findingsByRun}
        />
      </NextIntlClientProvider>,
    );
  }

  it("a done run shows its severity icons + blockers (FC5)", () => {
    renderTimeline([run({ status: "done", findings_count: 3, blockers: 2, score: 38 })], { "run-1": RUN1_FINDINGS });
    const icons = screen.getByTestId("severity-icon-counts");
    expect(icons.querySelector('[data-severity="CRITICAL"]')).toHaveTextContent("2");
    expect(icons.querySelector('[data-severity="WARNING"]')).toHaveTextContent("1");
    expect(icons.querySelector('[data-severity="SUGGESTION"]')).toBeNull();
    expect(screen.getByText(/2 blockers/)).toBeInTheDocument();
    expect(screen.queryByText(/finding\(s\)/)).not.toBeInTheDocument();
  });

  it("the severity summary is not clickable: no button, and a click does nothing (FC5)", () => {
    const onGoToReview = vi.fn();
    const onOpenTrace = vi.fn();
    renderTimeline([run({ status: "done", findings_count: 3, blockers: 2, score: 38 })], { "run-1": RUN1_FINDINGS }, {
      onGoToReview,
      onOpenTrace,
    });
    const trigger = screen.getByTestId("findings-popover-trigger");
    expect(trigger.tagName).toBe("SPAN");
    expect(trigger).not.toHaveAttribute("role");
    expect(trigger.closest("button")).toBeNull();
    expect(trigger.querySelector("button")).toBeNull();
    fireEvent.click(trigger);
    expect(onGoToReview).not.toHaveBeenCalled();
    expect(onOpenTrace).not.toHaveBeenCalled();
  });

  it("hover opens a read-only preview of THAT run's findings — no buttons, no request (FC12, FC10)", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderTimeline(
      [
        run({ run_id: "run-1", status: "done", findings_count: 3, blockers: 2, score: 38, ran_at: "2026-06-11T18:44:34.000Z" }),
        run({ run_id: "run-2", agent_name: "Performance Reviewer", status: "done", findings_count: 1, blockers: 0, score: 80, ran_at: "2026-06-11T18:40:00.000Z" }),
      ],
      { "run-1": RUN1_FINDINGS, "run-2": RUN2_FINDINGS },
    );
    const [run1Trigger] = screen.getAllByTestId("findings-popover-trigger");
    fireEvent.mouseEnter(run1Trigger!);

    const popover = screen.getByRole("dialog", { name: "3 FINDINGS IN THIS RUN" });
    const p = within(popover);
    expect(p.getByText("Hardcoded Stripe secret key in commit")).toBeInTheDocument();
    expect(p.getByText("N+1 query in user list endpoint")).toBeInTheDocument();
    expect(p.getByText("perf")).toBeInTheDocument();
    expect(p.getByText("src/api/users.ts:45-52")).toBeInTheDocument();
    expect(p.getByText("86% conf")).toBeInTheDocument();
    expect(p.getByText("The loop calls db.posts.findMany once per user.")).toBeInTheDocument();
    expect(p.queryByText("Extract magic number 3600")).not.toBeInTheDocument(); // run-2's finding
    expect(p.queryByText("Fix it.")).not.toBeInTheDocument(); // preview only, no suggested fix
    // read-only: no Accept / Reject or any other control
    expect(p.queryAllByRole("button")).toHaveLength(0);
    expect(p.queryAllByRole("link")).toHaveLength(0);
    expect(p.queryAllByRole("textbox")).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("keyboard focus opens the preview; Escape closes it", () => {
    renderTimeline([run({ status: "done", findings_count: 1, blockers: 0, score: 80 })], { "run-1": RUN2_FINDINGS });
    const trigger = screen.getByTestId("findings-popover-trigger");
    fireEvent.focus(trigger);
    expect(screen.getByRole("dialog", { name: "1 FINDING IN THIS RUN" })).toHaveTextContent("Extract magic number 3600");
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("no review for the run → the plain finding count, no popover (fallback)", () => {
    renderTimeline([run({ status: "done", findings_count: 3, blockers: 0, score: 70 })], {});
    expect(screen.queryByTestId("findings-popover-trigger")).not.toBeInTheDocument();
    expect(screen.getByText("3 finding(s)")).toBeInTheDocument();
  });

  it("a review with zero findings → '0 finding(s)', no popover", () => {
    renderTimeline([run({ status: "done", findings_count: 0, blockers: 0, score: 95 })], { "run-1": [] });
    expect(screen.queryByTestId("findings-popover-trigger")).not.toBeInTheDocument();
    expect(screen.getByText("0 finding(s)")).toBeInTheDocument();
  });
});

describe("RunHistory — L01 run cost badge", () => {
  it("a finished run shows total tokens · cost next to the time (C3)", () => {
    renderRuns([run({ status: "done", tokens_in: 8200, tokens_out: 919, cost_usd: 0.0013, score: 90, blockers: 0 })]);
    expect(screen.getByTestId("run-cost-badge")).toHaveTextContent("9,119 tok · $0.0013");
  });

  it("a failed run (0/0 tokens, unknown cost) shows — (C4)", () => {
    renderRuns([run({ status: "failed", error: "429 quota", tokens_in: 0, tokens_out: 0, cost_usd: null })]);
    const badge = screen.getByTestId("run-cost-badge");
    expect(badge).toHaveTextContent(/^—$/);
    expect(badge).toHaveAttribute("title", "Cost unknown");
  });

  it("a running run shows no badge (C5)", () => {
    renderRuns([run({ status: "running", score: null, blockers: null })]);
    expect(screen.queryByTestId("run-cost-badge")).not.toBeInTheDocument();
  });
});
