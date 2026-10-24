/* SkillsListPane — left side of the Skills master-detail: search, skill cards
   with the global Enabled toggle (saved at once), and Add Skill ▾
   (create / import). Rendered once by the /skills layout. */
"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Dropdown, EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import { useSetSkillEnabled, useSkills } from "../../../../lib/hooks/skills";
import { SkillCard } from "./_components/SkillCard";
import { ImportSkillDrawer } from "./_components/ImportSkillDrawer";
import { filterSkills } from "./helpers";
import { s } from "./styles";

export function SkillsListPane() {
  const t = useTranslations("skills");
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const activeId = params?.id;
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const setEnabled = useSetSkillEnabled();
  const [query, setQuery] = React.useState("");
  const [importing, setImporting] = React.useState(false);

  const list = filterSkills(skills ?? [], query);
  const create = () => router.push("/skills/new?tab=config");

  return (
    <aside style={s.pane}>
      {importing && <ImportSkillDrawer onClose={() => setImporting(false)} />}
      <div style={s.top}>
        <div style={s.headerRow}>
          <h1 style={s.h1}>{t("page.heading")}</h1>
          <Dropdown
            width={210}
            align="right"
            trigger={
              <Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">
                {t("page.addSkill")}
              </Button>
            }
            items={[
              { label: t("page.menu.create"), icon: "Edit", onClick: create },
              { label: t("page.menu.importFile"), icon: "Upload", onClick: () => setImporting(true) },
            ]}
          />
        </div>
        <div style={s.search}>
          <Icon.Search size={13} style={s.searchIcon} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("page.searchPlaceholder")}
            aria-label={t("page.searchPlaceholder")}
            style={s.searchInput}
          />
        </div>
      </div>

      <div style={s.list}>
        {isLoading && (
          <>
            <Skeleton height={110} />
            <Skeleton height={110} />
          </>
        )}
        {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
        {!isLoading && !isError && (skills ?? []).length === 0 && (
          <EmptyState
            icon="Sparkles"
            title={t("page.empty.title")}
            body={t("page.empty.body")}
            cta={t("page.empty.cta")}
            onCta={create}
          />
        )}
        {!isLoading && (skills ?? []).length > 0 && list.length === 0 && (
          <p style={s.noMatch}>{t("page.noMatch", { query })}</p>
        )}
        {list.map((skill) => (
          <SkillCard
            key={skill.id}
            skill={skill}
            active={skill.id === activeId}
            onClick={() => router.push(`/skills/${skill.id}?tab=config`)}
            onToggle={(enabled) => setEnabled.mutate({ id: skill.id, enabled })}
          />
        ))}
      </div>
    </aside>
  );
}
