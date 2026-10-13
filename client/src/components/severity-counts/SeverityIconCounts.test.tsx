import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../messages/en/prReview.json";
import { SeverityIconCounts } from "./SeverityIconCounts";
import { countBySeverity, totalOf } from "./helpers";

afterEach(cleanup);

describe("countBySeverity", () => {
  it("tallies by severity, ignoring unknown values", () => {
    expect(
      countBySeverity([
        { severity: "CRITICAL" },
        { severity: "WARNING" },
        { severity: "CRITICAL" },
        { severity: "INFO" },
      ]),
    ).toEqual({ CRITICAL: 2, WARNING: 1, SUGGESTION: 0 });
  });

  it("empty / missing input → all zero", () => {
    expect(countBySeverity([])).toEqual({ CRITICAL: 0, WARNING: 0, SUGGESTION: 0 });
    expect(countBySeverity(null)).toEqual({ CRITICAL: 0, WARNING: 0, SUGGESTION: 0 });
    expect(totalOf(countBySeverity(undefined))).toBe(0);
  });
});

describe("SeverityIconCounts", () => {
  function renderCounts(counts: Parameters<typeof SeverityIconCounts>[0]["counts"]) {
    return render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <SeverityIconCounts counts={counts} />
      </NextIntlClientProvider>,
    );
  }

  it("shows only non-zero severities, as summary (no buttons)", () => {
    renderCounts({ CRITICAL: 2, WARNING: 0, SUGGESTION: 1 });
    const group = screen.getByTestId("severity-icon-counts");
    expect(group.querySelector('[data-severity="CRITICAL"]')).toHaveTextContent("2");
    expect(group.querySelector('[data-severity="WARNING"]')).toBeNull();
    expect(group.querySelector('[data-severity="SUGGESTION"]')).toHaveTextContent("1");
    expect(group).toHaveAttribute("aria-label", "2 critical, 0 warning, 1 suggestion");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
