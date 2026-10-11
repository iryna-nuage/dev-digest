/**
 * PRRow — COST column (L01, C1–C2). The server decides the latest review's cost
 * (null while it runs / unknown / never reviewed); the row only formats it.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrMeta } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/prReview.json";
import common from "../../../../../../../messages/en/common.json";
import { PRRow } from "./PRRow";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(cleanup);

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

describe("PRRow — COST column", () => {
  it("shows the latest review's cost compactly (C1)", () => {
    expect(renderRow({ ...PR, cost_usd: 0.0123 })).toHaveTextContent(/^\$0\.012$/);
  });

  it("shows — when the server has no cost, never $0.00 (C2)", () => {
    expect(renderRow({ ...PR, cost_usd: null })).toHaveTextContent(/^—$/);
    cleanup();
    expect(renderRow({ ...PR, score: null })).toHaveTextContent(/^—$/); // never reviewed, field absent
  });
});
