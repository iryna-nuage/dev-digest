/**
 * RunHistory — the badge must reflect the review OUTCOME, not the run lifecycle.
 * Regression guard for the "green ✓ done on a run that found 5 blockers" bug:
 * a settled run is colored/labelled by its denormalized blocker/finding counts,
 * and shows the review score ring.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { RunSummary } from "@devdigest/shared";
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

describe("RunHistory — HW1 severity icons (criterion 16, summary only)", () => {
  function renderWithCounts(r: RunSummary, severityByRun?: Record<string, { CRITICAL: number; WARNING: number; SUGGESTION: number }>) {
    return render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages, common }}>
        <RunHistory runs={[r]} onOpenTrace={() => {}} severityByRun={severityByRun} />
      </NextIntlClientProvider>,
    );
  }

  it("a done run shows its severity icons + blockers, none clickable (FC5)", () => {
    renderWithCounts(run({ status: "done", findings_count: 3, blockers: 2, score: 38 }), {
      "run-1": { CRITICAL: 2, WARNING: 1, SUGGESTION: 0 },
    });
    const icons = screen.getByTestId("severity-icon-counts");
    expect(icons.querySelector('[data-severity="CRITICAL"]')).toHaveTextContent("2");
    expect(icons.querySelector('[data-severity="WARNING"]')).toHaveTextContent("1");
    expect(icons.querySelector('[data-severity="SUGGESTION"]')).toBeNull();
    expect(icons.closest("button")).toBeNull();
    expect(icons.querySelector("button")).toBeNull();
    expect(screen.getByText(/2 blockers/)).toBeInTheDocument();
    expect(screen.queryByText(/finding\(s\)/)).not.toBeInTheDocument();
  });

  it("no review for the run → the plain finding count (fallback)", () => {
    renderWithCounts(run({ status: "done", findings_count: 3, blockers: 0, score: 70 }), {});
    expect(screen.queryByTestId("severity-icon-counts")).not.toBeInTheDocument();
    expect(screen.getByText("3 finding(s)")).toBeInTheDocument();
  });

  it("a review with zero findings → '0 finding(s)'", () => {
    renderWithCounts(run({ status: "done", findings_count: 0, blockers: 0, score: 95 }), {
      "run-1": { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 },
    });
    expect(screen.queryByTestId("severity-icon-counts")).not.toBeInTheDocument();
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
