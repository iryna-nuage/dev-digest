/* SkillsTab — attach / detach (checkbox) and order (drag, or Alt+↑/↓ on the
   handle) the workspace skills for this agent. Order = order of the blocks in
   the prompt. Every change saves the full ordered list at once. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Checkbox, EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { SkillTypeBadge } from "../../../../../../../components/skill-type-badge";
import { useAgentSkills, useSetAgentSkills } from "../../../../../../../lib/hooks/agents";
import { useSkills } from "../../../../../../../lib/hooks/skills";
import { filterRows, moveItem, orderRows, toggleAttached } from "./helpers";
import { s } from "./styles";

export function SkillsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const router = useRouter();
  const skills = useSkills();
  const links = useAgentSkills(agent.id);
  const setSkills = useSetAgentSkills();
  const [query, setQuery] = React.useState("");
  const [dragFrom, setDragFrom] = React.useState<number | null>(null);

  if (skills.isLoading || links.isLoading) return <Skeleton height={240} />;
  if (skills.isError || links.isError || !skills.data || !links.data) {
    return (
      <ErrorState
        body={t("skills.loadError")}
        onRetry={() => {
          void skills.refetch();
          void links.refetch();
        }}
      />
    );
  }

  const ids = links.data.map((l) => l.skill_id);
  const rows = orderRows(skills.data, ids);
  const attachedCount = rows.filter((r) => r.index >= 0).length;
  const shown = filterRows(rows, query);
  const filtering = query.trim().length > 0;
  const attachedIds = rows.filter((r) => r.index >= 0).map((r) => r.skill.id);
  const commit = (next: string[]) => {
    if (next.join() !== attachedIds.join()) setSkills.mutate({ agentId: agent.id, skillIds: next });
  };

  if (skills.data.length === 0) {
    return (
      <EmptyState
        icon="Sparkles"
        title={t("skills.empty")}
        cta={t("skills.emptyCta")}
        onCta={() => router.push("/skills")}
      />
    );
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("skills.title")}</h2>
        <Badge color="var(--accent-text)" bg="var(--accent-bg)">
          {t("skills.attachedCount", { attached: attachedCount, total: rows.length })}
        </Badge>
        <div style={s.filter}>
          <Icon.Search size={13} style={s.filterIcon} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("skills.filterPlaceholder")}
            aria-label={t("skills.filterPlaceholder")}
            style={s.filterInput}
          />
        </div>
      </div>
      <p style={s.hint}>{filtering ? t("skills.dragDisabled") : t("skills.orderHint")}</p>

      {shown.length === 0 && <p style={s.hint}>{t("skills.noMatch")}</p>}
      <ul style={s.list}>
        {shown.map(({ skill, index }) => {
          const attached = index >= 0;
          const draggable = attached && !filtering;
          return (
            <li
              key={skill.id}
              data-testid={`skill-row-${skill.name}`}
              draggable={draggable}
              onDragStart={(e) => {
                setDragFrom(index);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (draggable && dragFrom !== null) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null && draggable) commit(moveItem(attachedIds, dragFrom, index));
                setDragFrom(null);
              }}
              onDragEnd={() => setDragFrom(null)}
              style={s.row(attached, skill.enabled, dragFrom === index)}
            >
              {attached ? (
                <button
                  type="button"
                  aria-label={t("skills.handleLabel", { name: skill.name })}
                  disabled={filtering}
                  onKeyDown={(e) => {
                    if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
                    e.preventDefault();
                    commit(moveItem(attachedIds, index, index + (e.key === "ArrowUp" ? -1 : 1)));
                  }}
                  style={s.handle(filtering)}
                >
                  <Icon.Menu size={14} />
                </button>
              ) : (
                <span style={s.handleSpacer} />
              )}
              <Checkbox
                checked={attached}
                onChange={(v) => commit(toggleAttached(attachedIds, skill.id, v))}
                label={
                  <span className="mono" style={s.name}>
                    {skill.name}
                  </span>
                }
              />
              {!skill.enabled && <Badge color="var(--text-muted)">{t("skills.globallyDisabled")}</Badge>}
              <span style={s.badge}>
                <SkillTypeBadge type={skill.type} />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
