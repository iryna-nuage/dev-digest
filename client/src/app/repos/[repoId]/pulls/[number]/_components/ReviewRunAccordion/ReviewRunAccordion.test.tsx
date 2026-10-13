/**
 * ReviewRunAccordion — HW1 criterion 16 placement: in the expanded run card the
 * severity pills sit under the verdict + PR SCORE banner, and the filter
 * buttons under the pills.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReviewRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useDeleteReview: () => ({ mutate: vi.fn(), isPending: false }),
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { ReviewRunAccordion } from "./ReviewRunAccordion";

afterEach(cleanup);

const REVIEW: ReviewRecord = {
  id: "rv1",
  pr_id: "pr1",
  agent_id: "a1",
  run_id: "run-1",
  agent_name: "Security Reviewer",
  kind: "review",
  verdict: "request_changes",
  summary: "Two critical exposures.",
  score: 38,
  model: "deepseek",
  grounding: "3/3 passed",
  created_at: "2026-06-13T18:52:51.000Z",
  findings: [
    {
      id: "f1", severity: "CRITICAL", category: "security", title: "Hardcoded Stripe secret key in commit",
      file: "src/config.ts", start_line: 12, end_line: 12, rationale: "r", suggestion: null, confidence: 0.98,
      kind: "finding", trifecta_components: null, evidence: null, review_id: "rv1", accepted_at: null, dismissed_at: null,
    },
    {
      id: "f2", severity: "WARNING", category: "perf", title: "N+1 query in user list endpoint",
      file: "src/api/users.ts", start_line: 45, end_line: 52, rationale: "r", suggestion: null, confidence: 0.86,
      kind: "finding", trifecta_components: null, evidence: null, review_id: "rv1", accepted_at: null, dismissed_at: null,
    },
  ],
};

describe("ReviewRunAccordion — expanded card", () => {
  it("renders verdict/PR SCORE, then the severity pills, then the filter buttons", () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <ReviewRunAccordion review={REVIEW} prId="pr1" defaultOpen />
      </NextIntlClientProvider>,
    );
    const score = screen.getByText("PR SCORE");
    const pills = screen.getByTestId("severity-pills");
    const filter = screen.getByRole("group", { name: "Filter by severity" });
    expect(pills).toHaveTextContent("1 CRITICAL·1 WARNING");
    // DOCUMENT_POSITION_FOLLOWING = 4 → the second node comes after the first.
    expect(score.compareDocumentPosition(pills) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pills.compareDocumentPosition(filter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
