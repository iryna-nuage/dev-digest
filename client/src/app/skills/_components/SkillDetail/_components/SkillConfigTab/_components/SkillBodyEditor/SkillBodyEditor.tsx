/* SkillBodyEditor — Markdown body in a file-like card: `<name>.md` header,
   "unsaved" badge, ≈token estimate, a line-number gutter scroll-synced with a
   plain monospace textarea, and a character counter. Headings are coloured by
   a highlight layer under the textarea (its own text is transparent). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon } from "@devdigest/ui";
import { SKILL_BODY_MAX } from "@devdigest/shared/contracts/knowledge";
import { estimateTokens } from "../../../../../../../../lib/skill-fields";
import { isMarkdownHeading } from "./helpers";
import { s } from "./styles";

export function SkillBodyEditor({
  name,
  value,
  dirty,
  onChange,
}: {
  name: string;
  value: string;
  dirty: boolean;
  onChange: (v: string) => void;
}) {
  const t = useTranslations("skills");
  const gutter = React.useRef<HTMLDivElement>(null);
  const highlight = React.useRef<HTMLDivElement>(null);
  const lines = value.split("\n");

  return (
    <div style={s.card}>
      <div style={s.head}>
        <Icon.FileText size={14} style={{ color: "var(--text-muted)" }} />
        <span className="mono" style={s.file}>{`${name || "skill"}.md`}</span>
        {dirty && <Badge color="var(--warn)" bg="var(--warn-bg)">{t("config.unsaved")}</Badge>}
        <span style={s.tokens} title={t("config.tokensTitle")}>
          {t("config.tokens", { count: estimateTokens(value) })}
        </span>
      </div>
      <div style={s.editor}>
        <div ref={gutter} aria-hidden style={s.gutter}>
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <div style={s.field}>
          <div ref={highlight} aria-hidden className="mono" style={s.highlight}>
            {lines.map((line, i) =>
              isMarkdownHeading(line) ? (
                <div key={i} data-md-heading style={s.heading}>
                  {line}
                </div>
              ) : (
                <div key={i}>{line || " "}</div>
              ),
            )}
          </div>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={(e) => {
              const { scrollTop, scrollLeft } = e.currentTarget;
              if (gutter.current) gutter.current.scrollTop = scrollTop;
              if (highlight.current) {
                highlight.current.scrollTop = scrollTop;
                highlight.current.scrollLeft = scrollLeft;
              }
            }}
            aria-label={t("config.body")}
            spellCheck={false}
            wrap="off"
            className="mono"
            style={s.textarea}
          />
        </div>
      </div>
      <div style={s.foot}>{t("config.chars", { count: value.length, max: SKILL_BODY_MAX })}</div>
    </div>
  );
}
