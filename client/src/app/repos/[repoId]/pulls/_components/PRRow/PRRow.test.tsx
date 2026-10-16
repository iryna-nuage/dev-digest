/**
 * PRRow — COST column (L01, C1–C2). The server totals the PR's successful runs
 * (null when none has a known cost); the row only formats it.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrMeta } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/prReview.json";
import common from "../../../../../../../messages/en/common.json";
import { PRRow } from "./PRRow";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  cleanup();
  push.mockReset();
});

const PR: PrMeta = {
  id: "pr-1",
  number: 482,
  title: "Add rate limiting to public API endpoints",
  author: "marisa.koch",
  branch: "feat/rl",
  base: "main",
  head_sha: "a1b2c3d",
  additions: 247,
  deletions: 38,
  files_count: 9,
  status: "needs_review",
  updated_at: null,
  score: 61,
};

function renderRow(pr: PrMeta) {
  render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages, common }}>
      <PRRow pr={pr} repoId="repo-1" />
    </NextIntlClientProvider>,
  );
  return screen.getByTestId("run-cost-badge");
}

const FINDINGS: NonNullable<PrMeta["latest_findings"]> = [
  {
    id: "f1", severity: "CRITICAL", category: "security", title: "Hardcoded Stripe secret key in commit",
    file: "src/config.ts", start_line: 12, end_line: 12, confidence: 0.98,
    rationale: "Line 12 contains a literal `sk_live_` Stripe **secret key**.",
  },
  {
    id: "f2", severity: "WARNING", category: "perf", title: "N+1 query in user list endpoint",
    file: "src/api/users.ts", start_line: 45, end_line: 52, confidence: 0.86,
    rationale: "Loop issues one query per user.",
  },
];

describe("PRRow — HW1 FINDINGS column + read-only popover (criteria 20–21)", () => {
  function renderFindingsRow(pr: PrMeta) {
    render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages, common }}>
        <PRRow pr={pr} repoId="repo-1" />
      </NextIntlClientProvider>,
    );
  }

  it("shows severity icons; hover opens 'N FINDINGS IN THIS RUN' with read-only previews (FC6–FC7)", () => {
    renderFindingsRow({ ...PR, latest_findings: FINDINGS });
    const trigger = screen.getByTestId("findings-popover-trigger");
    expect(trigger.querySelector('[data-severity="CRITICAL"]')).toHaveTextContent("1");
    expect(trigger.querySelector('[data-severity="WARNING"]')).toHaveTextContent("1");
    expect(screen.queryByTestId("findings-popover")).not.toBeInTheDocument();

    fireEvent.mouseEnter(trigger);
    const popover = screen.getByRole("dialog", { name: "2 FINDINGS IN THIS RUN" });
    const p = within(popover);
    expect(p.getByText("Hardcoded Stripe secret key in commit")).toBeInTheDocument();
    expect(p.getByText("security")).toBeInTheDocument();
    expect(p.getByText("src/config.ts:12")).toBeInTheDocument();
    expect(p.getByText("src/api/users.ts:45-52")).toBeInTheDocument();
    expect(p.getByText("98% conf")).toBeInTheDocument();
    expect(p.getByText("Line 12 contains a literal sk_live_ Stripe secret key.")).toBeInTheDocument();
    // read-only: no buttons, links or inputs
    expect(p.queryAllByRole("button")).toHaveLength(0);
    expect(p.queryAllByRole("link")).toHaveLength(0);
    expect(p.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("singular title for one finding; Escape closes the popover", () => {
    renderFindingsRow({ ...PR, latest_findings: FINDINGS.slice(0, 1) });
    const trigger = screen.getByTestId("findings-popover-trigger");
    fireEvent.focus(trigger); // keyboard users get it too
    expect(screen.getByRole("dialog", { name: "1 FINDING IN THIS RUN" })).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clicking inside the popover does not navigate the row", () => {
    renderFindingsRow({ ...PR, latest_findings: FINDINGS });
    fireEvent.mouseEnter(screen.getByTestId("findings-popover-trigger"));
    fireEvent.click(screen.getByText("N+1 query in user list endpoint"));
    expect(push).not.toHaveBeenCalled();
  });

  it("null or [] → '—' and no popover (FC8)", () => {
    renderFindingsRow({ ...PR, latest_findings: null });
    expect(screen.queryByTestId("findings-popover-trigger")).not.toBeInTheDocument();
    cleanup();
    renderFindingsRow({ ...PR, latest_findings: [] });
    expect(screen.queryByTestId("findings-popover-trigger")).not.toBeInTheDocument();
    cleanup();
    renderFindingsRow(PR); // field absent
    expect(screen.queryByTestId("findings-popover-trigger")).not.toBeInTheDocument();
  });

  it("hovering makes no request (FC10)", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderFindingsRow({ ...PR, latest_findings: FINDINGS });
    fireEvent.mouseEnter(screen.getByTestId("findings-popover-trigger"));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("PRRow — COST column", () => {
  it("shows the PR's total over its successful runs compactly (C1)", () => {
    // 0.008296 + 0.004938, summed on the server (criterion 12)
    expect(renderRow({ ...PR, cost_usd: 0.013234 })).toHaveTextContent(/^\$0\.013$/);
  });

  it("shows — when the server has no cost, never $0.00 (C2)", () => {
    expect(renderRow({ ...PR, cost_usd: null })).toHaveTextContent(/^—$/);
    cleanup();
    expect(renderRow({ ...PR, score: null })).toHaveTextContent(/^—$/); // never reviewed, field absent
  });
});
