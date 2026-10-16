import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord, Severity } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

const mutate = vi.fn();
vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate, isPending: false }),
}));

import { FindingsPanel } from "./FindingsPanel";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mutate.mockReset();
});

function finding(id: string, severity: Severity, title: string, confidence = 0.9): FindingRecord {
  return {
    id,
    severity,
    category: "security",
    title,
    file: "src/config.ts",
    start_line: 11,
    end_line: 11,
    rationale: "Why it matters.",
    suggestion: null,
    confidence,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
  };
}

const FINDINGS: FindingRecord[] = [
  finding("f1", "CRITICAL", "Hardcoded secret"),
  finding("f2", "WARNING", "N+1 query", 0.5), // low confidence
  finding("f3", "CRITICAL", "Lethal trifecta"),
];

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

/** Rendered finding cards of a severity (FindingCard carries data-finding-id + data-severity). */
const cards = (sev?: Severity) =>
  document.querySelectorAll(`[data-finding-id]${sev ? `[data-severity="${sev}"]` : ""}`);
const pill = (sev: Severity) =>
  screen.getByTestId("severity-pills").querySelector(`[data-severity="${sev}"]`);
const button = (name: string) => screen.getByRole("button", { name });

describe("FindingsPanel (smoke)", () => {
  it("renders the toolbar + a finding card", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS.slice(0, 1)} prId="pr1" />);
    expect(screen.getByText("Hide low confidence")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches — no counters, no filter", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
    expect(screen.queryByTestId("severity-pills")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Filter by severity" })).not.toBeInTheDocument();
  });
});

describe("FindingsPanel — HW1 severity counters (criteria 16–17)", () => {
  it("shows only the severities present: 2 CRITICAL · 1 WARNING (FC1)", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(pill("CRITICAL")).toHaveTextContent("2 CRITICAL");
    expect(pill("WARNING")).toHaveTextContent("1 WARNING");
    expect(pill("SUGGESTION")).toBeNull();
  });

  it("each pill equals the cards of that severity rendered below, with and without Hide low confidence (FC2)", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(cards("CRITICAL")).toHaveLength(2);
    expect(cards("WARNING")).toHaveLength(1);

    fireEvent.click(screen.getByRole("switch")); // Hide low confidence → the 0.5 WARNING card goes
    expect(cards("WARNING")).toHaveLength(0);
    expect(pill("WARNING")).toBeNull();
    expect(pill("CRITICAL")).toHaveTextContent("2 CRITICAL");
    expect(cards("CRITICAL")).toHaveLength(2);
  });
});

describe("FindingsPanel — HW1 severity filter (criterion 18)", () => {
  it("Critical → only CRITICAL cards; Critical again → the full list (FC3)", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    fireEvent.click(button("Critical"));
    expect(button("Critical")).toHaveAttribute("aria-pressed", "true");
    expect(cards()).toHaveLength(2);
    expect(cards("WARNING")).toHaveLength(0);
    expect(screen.queryByText("N+1 query")).not.toBeInTheDocument();
    // counters keep describing the card's findings, not the filtered view
    expect(pill("WARNING")).toHaveTextContent("1 WARNING");

    fireEvent.click(button("Critical"));
    expect(button("Critical")).toHaveAttribute("aria-pressed", "false");
    expect(cards()).toHaveLength(3);
  });

  it("Critical → Warning switches the filter (FC4)", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    fireEvent.click(button("Critical"));
    fireEvent.click(button("Warning"));
    expect(button("Critical")).toHaveAttribute("aria-pressed", "false");
    expect(button("Warning")).toHaveAttribute("aria-pressed", "true");
    expect(cards()).toHaveLength(1);
    expect(screen.getByText("N+1 query")).toBeInTheDocument();
  });

  it("a severity with no findings is disabled; the active one stays clickable when its count drops to 0", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(button("Suggestion")).toBeDisabled();

    fireEvent.click(button("Warning"));
    fireEvent.click(screen.getByRole("switch")); // hides the only WARNING
    expect(button("Warning")).not.toBeDisabled();
    expect(screen.getByText("No findings match")).toBeInTheDocument();
    fireEvent.click(button("Warning")); // clear
    expect(cards()).toHaveLength(2);
  });

  it("filtering makes no request and triggers no finding action (FC10)", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    fireEvent.click(button("Critical"));
    fireEvent.click(button("Critical"));
    fireEvent.click(button("Warning"));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("j/k focus restarts at the first visible card when the filter changes", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    fireEvent.keyDown(window, { key: "j" });
    fireEvent.keyDown(window, { key: "j" }); // focus on the 3rd card (WARNING)
    fireEvent.click(button("Critical"));
    fireEvent.keyDown(window, { key: "a" }); // accept the focused card
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ findingId: "f1", action: "accept" }));
  });
});
