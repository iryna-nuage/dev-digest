/* SeverityIconCounts — `⊘2 ⚠1 💡1`: icon + number for every non-zero severity.
   Summary only (not interactive) — used by the Agent runs timeline and the PR
   list FINDINGS column. Spec: client/specs/L01-findings-severity.md. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, SEV } from "@devdigest/ui";
import { SEVERITIES, type SeverityCounts } from "./helpers";
import { s } from "./styles";

export function SeverityIconCounts({ counts, size = 13 }: { counts: SeverityCounts; size?: number }) {
  const t = useTranslations("prReview");
  return (
    <span
      style={s.group}
      aria-label={t("severity.summaryLabel", {
        critical: counts.CRITICAL,
        warning: counts.WARNING,
        suggestion: counts.SUGGESTION,
      })}
      data-testid="severity-icon-counts"
    >
      {SEVERITIES.map((sev) => {
        const n = counts[sev];
        if (!n) return null;
        const meta = SEV[sev];
        const SevIcon = Icon[meta.icon];
        return (
          <span key={sev} className="tnum" style={s.item(meta.c)} data-severity={sev}>
            <SevIcon size={size} aria-hidden />
            {n}
          </span>
        );
      })}
    </span>
  );
}
