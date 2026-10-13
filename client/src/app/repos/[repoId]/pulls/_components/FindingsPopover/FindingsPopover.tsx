/* FindingsPopover — PR-list FINDINGS cell: severity icons that open a READ-ONLY
   "N FINDINGS IN THIS RUN" popover on hover / keyboard focus (HW1 criteria
   20–21). No buttons or links inside — Accept / Reject live on the PR page.
   Rendered through a portal: the table card clips overflow.
   Spec: client/specs/L01-findings-severity.md. */
"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Icon, SEV, CategoryTag, ConfidenceNum, type Category } from "@devdigest/ui";
import type { PrFindingPreview } from "@devdigest/shared";
import { SeverityIconCounts, countBySeverity } from "@/components/severity-counts";
import { CLOSE_DELAY_MS, POPOVER_WIDTH } from "./constants";
import { lineLabel, plainText } from "./helpers";
import { s } from "./styles";

export function FindingsPopover({ findings }: { findings: PrFindingPreview[] }) {
  const t = useTranslations("prReview");
  const triggerRef = React.useRef<HTMLSpanElement | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const titleId = React.useId();

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const open = () => {
    cancelClose();
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const maxLeft = Math.max(8, window.innerWidth - POPOVER_WIDTH - 8);
    setPos({ top: r.bottom + 6, left: Math.min(r.left, maxLeft) });
  };
  const close = React.useCallback(() => {
    cancelClose();
    setPos(null);
  }, []);
  // Grace delay so the pointer can travel from the icons into the popover.
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(close, CLOSE_DELAY_MS);
  };

  // A fixed-position popover would drift on scroll/resize — just close it.
  React.useEffect(() => {
    if (!pos) return;
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos, close]);
  React.useEffect(() => cancelClose, []);

  return (
    <>
      <span
        ref={triggerRef}
        tabIndex={0}
        aria-describedby={pos ? titleId : undefined}
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
        onFocus={open}
        onBlur={close}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
        style={s.trigger}
        data-testid="pr-findings-trigger"
      >
        <SeverityIconCounts counts={countBySeverity(findings)} />
      </span>
      {pos &&
        createPortal(
          <div
            role="dialog"
            aria-labelledby={titleId}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            // React portals bubble to PRRow's onClick — don't navigate from here.
            onClick={(e) => e.stopPropagation()}
            style={s.panel(pos.top, pos.left)}
            data-testid="pr-findings-popover"
          >
            <div id={titleId} style={s.header}>
              <Icon.Info size={13} aria-hidden />
              {t("list.findingsPopover.title", { count: findings.length })}
            </div>
            <div style={s.list}>
              {findings.map((f) => {
                const meta = SEV[f.severity];
                const SevIcon = Icon[meta.icon];
                return (
                  <div key={f.id} style={s.item} data-severity={f.severity}>
                    <div style={s.titleRow}>
                      <span style={s.sevIcon(meta.c, meta.bg)}>
                        <SevIcon size={12.5} aria-label={t(`severity.${f.severity}`)} />
                      </span>
                      <span style={s.title}>{f.title}</span>
                      <CategoryTag category={f.category as Category} />
                    </div>
                    <div style={s.metaRow}>
                      <span className="mono" style={s.file}>
                        {f.file}:{lineLabel(f)}
                      </span>
                      <ConfidenceNum value={f.confidence} />
                    </div>
                    <div style={s.rationale}>{plainText(f.rationale)}</div>
                  </div>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
