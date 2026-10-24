/* SkillDetail — right pane of /skills: header + Config / Preview / Stats.
   Owns the form draft (only the fields the user touched), so Preview renders
   the current text and Save sends only real changes. Remount with
   `key={skill.id}` to reset the draft when another skill is selected. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Tabs } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SkillTypeBadge, SkillTypeIcon } from "../../../../components/skill-type-badge";
import { useCreateSkill, useUpdateSkill } from "../../../../lib/hooks/skills";
import { useToast } from "../../../../lib/toast";
import { ApiError } from "../../../../lib/api";
import { SkillConfigTab } from "./_components/SkillConfigTab";
import { SkillPreviewTab } from "./_components/SkillPreviewTab";
import { SkillStatsTab } from "./_components/SkillStatsTab";
import { CREATE_TABS, TABS } from "./constants";
import {
  buildSkillPatch,
  fieldsOf,
  resolveFields,
  validateSkillFields,
  type SkillDraft,
  type SkillFields,
} from "../../../../lib/skill-fields";
import { s } from "./styles";

export function SkillDetail({
  skill,
  tab,
  onTab,
}: {
  /** undefined = create mode (/skills/new). */
  skill?: Skill;
  tab: string;
  onTab: (t: string) => void;
}) {
  const t = useTranslations("skills");
  const router = useRouter();
  const toast = useToast();
  const create = useCreateSkill();
  const update = useUpdateSkill();
  const [draft, setDraft] = React.useState<SkillDraft>({});
  const [attempted, setAttempted] = React.useState(false);
  const [nameTaken, setNameTaken] = React.useState(false);

  const saved = fieldsOf(skill);
  const values = resolveFields(saved, draft);
  const patch = skill ? buildSkillPatch(saved, draft) : values;
  const dirty = skill ? Object.keys(patch).length > 0 : Object.keys(draft).length > 0;
  const errors = validateSkillFields(values);
  const pending = create.isPending || update.isPending;

  const change = <K extends keyof SkillFields>(key: K, value: SkillFields[K]) => {
    if (key === "name") setNameTaken(false);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const onConflict = (err: unknown) => {
    if (err instanceof ApiError && err.status === 409) setNameTaken(true);
  };

  const save = () => {
    setAttempted(true);
    if (Object.keys(errors).length > 0) return;
    if (!skill) {
      create.mutate(
        { ...values, source: "manual" },
        {
          onSuccess: (created) => {
            toast.success(t("config.createdToast", { name: created.name }));
            router.replace(`/skills/${created.id}?tab=config`);
          },
          onError: onConflict,
        },
      );
      return;
    }
    update.mutate(
      { id: skill.id, patch },
      {
        onSuccess: (updated) => {
          setDraft({});
          setAttempted(false);
          toast.success(t("config.savedToast", { name: updated.name, version: updated.version }));
        },
        onError: onConflict,
      },
    );
  };

  const cancel = () => {
    setDraft({});
    setAttempted(false);
    setNameTaken(false);
    if (!skill) router.push("/skills");
  };

  const tabs = (skill ? TABS : CREATE_TABS).map((tb) => ({ key: tb.key, label: t(tb.labelKey), icon: tb.icon }));
  const activeTab = tabs.some((tb) => tb.key === tab) ? tab : "config";

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <SkillTypeIcon type={values.type} size={28} />
        <h1 style={s.h1}>{skill ? skill.name : t("detail.newSkill")}</h1>
        <SkillTypeBadge type={values.type} />
        {skill && (
          <Badge color="var(--text-secondary)" mono>
            {t("detail.version", { version: skill.version })}
          </Badge>
        )}
      </div>
      <Tabs tabs={tabs} value={activeTab} onChange={onTab} pad="0 28px" />
      <div style={s.body}>
        {activeTab === "config" && (
          <SkillConfigTab
            skill={skill}
            values={values}
            dirty={dirty}
            errors={errors}
            showErrors={attempted}
            touched={draft}
            nameTaken={nameTaken}
            pending={pending}
            onChange={change}
            onSave={save}
            onCancel={cancel}
          />
        )}
        {activeTab === "preview" && <SkillPreviewTab values={values} dirty={dirty} />}
        {activeTab === "stats" && skill && <SkillStatsTab skillId={skill.id} />}
      </div>
    </div>
  );
}
