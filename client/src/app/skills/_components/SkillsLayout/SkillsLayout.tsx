/* SkillsLayout — the Skills master-detail frame, rendered once by
   app/skills/layout.tsx: the list stays mounted (scroll + search survive)
   while the right pane changes with the route. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { AppShell } from "../../../../components/app-shell";
import { SkillsListPane } from "../SkillsListPane";
import { s } from "./styles";

export function SkillsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("skills");
  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbSkills"), href: "/skills" }]}>
      <div style={s.frame}>
        <SkillsListPane />
        <main style={s.detail}>{children}</main>
      </div>
    </AppShell>
  );
}
