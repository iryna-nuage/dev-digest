/* SkillStatsTab — usage of one skill: how many agents attach it, how many runs
   of the last 30 days had it in the prompt, and those runs' findings with the
   accept rate. No per-skill attribution exists: a run with several skills
   counts for each (see client/specs/L02-skills.md). */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Button, CircularScore, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import { useSkillAgents, useSkillStats } from "../../../../../../lib/hooks/skills";
import { s } from "./styles";

export function SkillStatsTab({ skillId }: { skillId: string }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const agentsQuery = useSkillAgents(skillId);
  const statsQuery = useSkillStats(skillId);
  const agents = agentsQuery.data;
  const stats = statsQuery.data;

  if (agentsQuery.isLoading || statsQuery.isLoading) return <Skeleton height={120} />;
  if (agentsQuery.isError || statsQuery.isError || !agents || !stats) {
    return (
      <ErrorState
        body={t("stats.loadError")}
        onRetry={() => {
          agentsQuery.refetch();
          statsQuery.refetch();
        }}
      />
    );
  }

  const days = stats.window_days;
  return (
    <div style={s.wrap}>
      <div style={s.tiles}>
        <div style={s.tile}>
          <div style={s.tileLabel}>{t("stats.usedBy")}</div>
          <div>
            <span style={s.tileValue}>{agents.length}</span>
            <span style={s.tileUnit}>{t("stats.agentsUnit", { count: agents.length })}</span>
          </div>
        </div>
        <div style={s.tile}>
          <div style={s.tileLabel}>{t("stats.runs", { days })}</div>
          <span style={s.tileValue}>{stats.runs}</span>
        </div>
        <div style={s.tile}>
          <div style={s.tileHead}>
            <div style={s.tileLabel}>{t("stats.acceptRate")}</div>
            {stats.accept_rate !== null && <CircularScore score={stats.accept_rate} size={36} stroke={3} />}
          </div>
          <div>
            {stats.accept_rate === null ? (
              <span style={s.tileValue}>{t("stats.noValue")}</span>
            ) : (
              <>
                <span style={s.tileValue}>{stats.accept_rate}</span>
                <span style={s.tileUnit}>%</span>
              </>
            )}
          </div>
          <div style={s.tileHint}>
            {t("stats.acceptCounts", { accepted: stats.accepted, dismissed: stats.dismissed })}
          </div>
        </div>
        <div style={s.tile}>
          <div style={s.tileLabel}>{t("stats.findings", { days })}</div>
          <span style={s.tileValue}>{stats.findings}</span>
        </div>
      </div>
      <p style={s.note}>{t("stats.windowNote", { days })}</p>

      <section style={s.card} aria-label={t("stats.agentsTitle")}>
        <div style={s.cardTitle}>
          <Icon.Cpu size={14} />
          {t("stats.agentsTitle")}
        </div>
        {agents.length === 0 ? (
          <p style={s.empty}>{t("stats.empty")}</p>
        ) : (
          <ul style={s.list}>
            {agents.map((a) => (
              <li key={a.id} style={s.row}>
                <Icon.Cpu size={14} style={{ color: "var(--accent)" }} />
                <span style={s.agentName}>{a.name}</span>
                {!a.enabled && <Badge color="var(--text-muted)">{t("stats.agentDisabled")}</Badge>}
                <Button kind="ghost" size="sm" onClick={() => router.push(`/agents/${a.id}?tab=skills`)}>
                  {t("stats.open")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
