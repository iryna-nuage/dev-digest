/* SkillPreviewTab — the skill body rendered as a document, as in the design.
   Agents get it under `### Skill: <name>` + description (`formatSkillForPrompt`). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { SkillFields } from "../../../../../../lib/skill-fields";
import { SkillMarkdown } from "./_components/SkillMarkdown";
import { s } from "./styles";

export function SkillPreviewTab({ values, dirty }: { values: SkillFields; dirty: boolean }) {
  const t = useTranslations("skills");
  const empty = values.body.trim().length === 0;
  return (
    <div style={s.wrap}>
      <h2 style={s.h2}>{t("preview.title")}</h2>
      <p style={s.subtitle}>{t("preview.subtitle")}</p>
      {dirty && <div style={s.note}>{t("preview.unsavedNote")}</div>}
      {!values.enabled && <div style={s.note}>{t("preview.disabledNote")}</div>}
      <div style={s.card} data-testid="skill-preview">
        {empty ? <span style={s.empty}>{t("preview.empty")}</span> : <SkillMarkdown>{values.body}</SkillMarkdown>}
      </div>
    </div>
  );
}
