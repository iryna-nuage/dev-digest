/**
 * RunCostBadge + formatters (client/specs/L01-run-cost.md). Unknown cost must
 * read "—", never "$0.00"; the detailed variant follows the design mock
 * (`9,119 tok · $0.0013`).
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import common from "../../../messages/en/common.json";
import { RunCostBadge, type RunCostBadgeProps } from "./RunCostBadge";
import { formatTokenTotal, formatUsd } from "./helpers";

afterEach(cleanup);

describe("formatUsd", () => {
  it.each([
    [null, "—"],
    [undefined, "—"],
    [0, "$0.00"],
    [0.0000004, "<$0.000001"],
    [0.000001, "$0.000001"],
    // sub-cent values keep up to 6 decimals, no trailing zeros — match OpenRouter logs
    [0.000722, "$0.000722"],
    [0.000356, "$0.000356"],
    [0.000456, "$0.000456"],
    [0.00004, "$0.00004"],
    [0.0013, "$0.0013"],
    [0.002, "$0.002"],
    [0.0099999, "$0.01"],
    [0.014, "$0.014"],
    [0.0123, "$0.012"],
    [0.06, "$0.060"],
    [1.239, "$1.24"],
  ])("%s → %s", (input, out) => {
    expect(formatUsd(input)).toBe(out);
  });
});

describe("formatTokenTotal", () => {
  it.each([
    [842, "842 tok"],
    [9119, "9,119 tok"],
    [1204331, "1,204,331 tok"],
  ])("%s → %s", (input, out) => {
    expect(formatTokenTotal(input)).toBe(out);
  });
});

function renderBadge(props: RunCostBadgeProps) {
  render(
    <NextIntlClientProvider locale="en" messages={{ common }}>
      <RunCostBadge {...props} />
    </NextIntlClientProvider>,
  );
  return screen.getByTestId("run-cost-badge");
}

describe("RunCostBadge", () => {
  it("compact: cost only", () => {
    expect(renderBadge({ variant: "compact", costUsd: 0.0123, tokensIn: 100, tokensOut: 50 })).toHaveTextContent(
      /^\$0\.012$/,
    );
  });

  it("detailed: total tokens · cost", () => {
    expect(renderBadge({ variant: "detailed", costUsd: 0.0013, tokensIn: 8200, tokensOut: 919 })).toHaveTextContent(
      "9,119 tok · $0.0013",
    );
  });

  it("unknown cost renders — with a tooltip, never $0.00", () => {
    const badge = renderBadge({ variant: "compact", costUsd: null });
    expect(badge).toHaveTextContent(/^—$/);
    expect(badge).toHaveAttribute("title", "Cost unknown");
  });

  it("detailed: drops the token part on 0/0 or missing tokens", () => {
    expect(renderBadge({ variant: "detailed", costUsd: null, tokensIn: 0, tokensOut: 0 })).toHaveTextContent(/^—$/);
    cleanup();
    expect(renderBadge({ variant: "detailed", costUsd: 0.002, tokensIn: null, tokensOut: null })).toHaveTextContent(
      /^\$0\.002$/,
    );
  });

  it("detailed: known tokens with unknown cost", () => {
    expect(renderBadge({ variant: "detailed", costUsd: null, tokensIn: 9000, tokensOut: 119 })).toHaveTextContent(
      "9,119 tok · —",
    );
  });
});
