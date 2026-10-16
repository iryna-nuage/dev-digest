/* SeverityPills — "N CRITICAL · N WARNING · N SUGGESTION" for one run card,
   only the severities actually present. Counts come from the same findings the
   card renders below (HW1 criteria 16–17). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, SEV } from "@devdigest/ui";
import { SEVERITIES, type SeverityCounts } from "@/components/severity-counts";

export function SeverityPills({ counts }: { counts: SeverityCounts }) {
  const t = useTranslations("prReview");
  const present = SEVERITIES.filter((sev) => counts[sev] > 0);
  if (present.length === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }} data-testid="severity-pills">
      {present.map((sev, i) => {
        const meta = SEV[sev];
        const SevIcon = Icon[meta.icon];
        return (
          <React.Fragment key={sev}>
            {i > 0 && <span style={{ color: "var(--text-muted)", fontSize: 12 }}>·</span>}
            <span
              className="tnum"
              data-severity={sev}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.03em",
                color: meta.c,
                background: meta.bg,
              }}
            >
              <SevIcon size={12.5} aria-hidden />
              {t(`severity.pill.${sev}`, { count: counts[sev] })}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}
