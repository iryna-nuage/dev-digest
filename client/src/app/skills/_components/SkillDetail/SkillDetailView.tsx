/* SkillDetailView — route-level wrapper for /skills/[id] and /skills/new:
   loads the skill, keeps the tab in ?tab=, and renders loading / not-found /
   error states around SkillDetail. */
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import { useSkill } from "../../../../lib/hooks/skills";
import { ApiError } from "../../../../lib/api";
import { SkillDetail } from "./SkillDetail";
import { VALID_TABS } from "./constants";

export function SkillDetailView({ id }: { id?: string }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const search = useSearchParams();
  const { data: skill, isLoading, isError, error, refetch } = useSkill(id);

  const raw = search.get("tab") ?? "";
  const tab = VALID_TABS.includes(raw) ? raw : "config";
  const setTab = (next: string) => {
    const sp = new URLSearchParams(search.toString());
    sp.set("tab", next);
    router.replace(`${id ? `/skills/${id}` : "/skills/new"}?${sp.toString()}`);
  };

  if (!id) return <SkillDetail key="new" tab={tab} onTab={setTab} />;

  if (isLoading) {
    return (
      <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
        <Skeleton height={24} width={240} />
        <Skeleton height={200} />
      </div>
    );
  }
  if (error instanceof ApiError && error.status === 404) {
    return <EmptyState icon="Sparkles" title={t("detail.notFound.title")} body={t("detail.notFound.body")} />;
  }
  if (isError || !skill) {
    return <ErrorState body={t("detail.loadError")} onRetry={() => refetch()} />;
  }
  return <SkillDetail key={skill.id} skill={skill} tab={tab} onTab={setTab} />;
}
