/* RunCostBadge.tsx — cost (+ tokens) of an agent run / review, for dense rows.
   `compact`  → `$0.012`              (PR list COST column)
   `detailed` → `9,119 tok · $0.0013` (Agent runs timeline)
   Unknown cost renders "—", never "$0.00". Spec: client/specs/L01-run-cost.md. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { formatTokenTotal, formatUsd } from "./helpers";
import { s } from "./styles";

export type RunCostBadgeProps = {
  costUsd: number | null | undefined;
  variant: "compact" | "detailed";
  /** detailed only — summed into the total. */
  tokensIn?: number | null;
  /** detailed only — summed into the total. */
  tokensOut?: number | null;
};

export function RunCostBadge({ costUsd, variant, tokensIn, tokensOut }: RunCostBadgeProps) {
  const t = useTranslations("common");
  const cost = formatUsd(costUsd);
  // Failed runs store 0/0 tokens — treat that like "no tokens", not "0 tok".
  const totalTokens = (tokensIn ?? 0) + (tokensOut ?? 0);
  const tokens = variant === "detailed" && totalTokens > 0 ? formatTokenTotal(totalTokens) : null;
  const text = tokens ? `${tokens} · ${cost}` : cost;
  return (
    <span
      className="mono"
      style={s.badge}
      title={costUsd == null ? t("cost.unknown") : undefined}
      data-testid="run-cost-badge"
    >
      {text}
    </span>
  );
}
