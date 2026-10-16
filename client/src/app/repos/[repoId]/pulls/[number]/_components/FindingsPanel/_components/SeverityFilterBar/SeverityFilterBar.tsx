/* SeverityFilterBar — Critical / Warning / Suggestion toggle buttons for one run
   card (HW1 criterion 18). Clicking the active button again clears the filter.
   A zero-count button is disabled unless it is the active one. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";
import { SEVERITIES, type SeverityCounts } from "@/components/severity-counts";

export function SeverityFilterBar({
  counts,
  active,
  onToggle,
}: {
  counts: SeverityCounts;
  active: Severity | null;
  onToggle: (severity: Severity) => void;
}) {
  const t = useTranslations("prReview");
  return (
    <div role="group" aria-label={t("panel.filterBySeverity")} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {SEVERITIES.map((sev) => {
        const meta = SEV[sev];
        const SevIcon = Icon[meta.icon];
        const pressed = active === sev;
        const disabled = counts[sev] === 0 && !pressed;
        return (
          <button
            key={sev}
            type="button"
            aria-pressed={pressed}
            disabled={disabled}
            onClick={() => onToggle(sev)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "5px 12px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.45 : 1,
              border: "1px solid " + (pressed ? meta.c : "var(--border)"),
              background: pressed ? meta.bg : "transparent",
              color: pressed ? meta.c : "var(--text-secondary)",
              transition: "all .12s",
            }}
          >
            <SevIcon size={13} style={{ color: meta.c }} aria-hidden />
            {t(`severity.${sev}`)}
          </button>
        );
      })}
    </div>
  );
}
