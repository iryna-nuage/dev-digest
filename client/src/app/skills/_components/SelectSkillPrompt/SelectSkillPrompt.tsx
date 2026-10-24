"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@devdigest/ui";

/** Right pane of /skills before a skill is picked. */
export function SelectSkillPrompt() {
  const t = useTranslations("skills");
  return (
    <div style={{ padding: 40 }}>
      <EmptyState icon="Sparkles" title={t("page.selectPrompt.title")} body={t("page.selectPrompt.body")} />
    </div>
  );
}
