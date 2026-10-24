/* SkillConfigTab — name / description / type / body + Enabled. The values and
   the draft live in SkillDetail; this tab renders them and reports changes.
   Enabled here is part of the form (saved with Save), like the agent Config. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, FormField, SelectInput, TextInput, Toggle } from "@devdigest/ui";
import { SKILL_BODY_MAX, SKILL_DESCRIPTION_MAX, type Skill, type SkillType } from "@devdigest/shared/contracts/knowledge";
import { SKILL_TYPES } from "../../constants";
import type { SkillDraft, SkillFieldErrors, SkillFields } from "../../../../../../lib/skill-fields";
import { DeleteSkillModal } from "./_components/DeleteSkillModal";
import { SkillBodyEditor } from "./_components/SkillBodyEditor";
import { s } from "./styles";

export function SkillConfigTab({
  skill,
  values,
  dirty,
  errors,
  showErrors,
  touched,
  nameTaken,
  pending,
  onChange,
  onSave,
  onCancel,
}: {
  skill?: Skill;
  values: SkillFields;
  dirty: boolean;
  errors: SkillFieldErrors;
  /** After a Save attempt every error shows; before it, only touched fields. */
  showErrors: boolean;
  touched: SkillDraft;
  nameTaken: boolean;
  pending: boolean;
  onChange: <K extends keyof SkillFields>(key: K, value: SkillFields[K]) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("skills");
  const [deleting, setDeleting] = React.useState(false);

  const errorFor = (key: keyof SkillFieldErrors) => {
    const code = errors[key];
    if (!code || (!showErrors && touched[key] === undefined)) return undefined;
    const max = key === "description" ? SKILL_DESCRIPTION_MAX : SKILL_BODY_MAX;
    return t(`config.${code}`, { max });
  };
  const nameError = nameTaken ? t("config.nameTaken") : errorFor("name");
  const descriptionError = errorFor("description");
  const bodyError = errorFor("body");
  const typeOptions = SKILL_TYPES.map((v) => ({ value: v, label: t(`listItem.type.${v}`) }));

  return (
    <div style={s.wrap}>
      {deleting && skill && <DeleteSkillModal skill={skill} onClose={() => setDeleting(false)} />}
      <div style={s.header}>
        <h2 style={s.h2}>{t("config.title")}</h2>
        {skill && (
          <Badge color="var(--text-secondary)" mono>
            {t("detail.version", { version: skill.version })}
          </Badge>
        )}
        <label style={s.enabledLabel}>
          {t("config.enabled")}
          <Toggle on={values.enabled} onChange={(v) => onChange("enabled", v)} size={16} />
        </label>
      </div>

      <FormField label={t("config.name")} required hint={nameError ? undefined : t("config.nameHint")}>
        <TextInput value={values.name} onChange={(v) => onChange("name", v)} mono aria-label={t("config.name")} />
        {nameError && <div role="alert" style={s.error}>{nameError}</div>}
      </FormField>

      <FormField
        label={t("config.description")}
        required
        hint={t("config.descriptionHint")}
        right={
          <span style={s.counter}>
            {t("config.chars", { count: values.description.length, max: SKILL_DESCRIPTION_MAX })}
          </span>
        }
      >
        <TextInput
          value={values.description}
          onChange={(v) => onChange("description", v)}
          aria-label={t("config.description")}
        />
        {descriptionError && <div role="alert" style={s.error}>{descriptionError}</div>}
      </FormField>

      <FormField label={t("config.type")}>
        <SelectInput value={values.type} onChange={(v) => onChange("type", v as SkillType)} options={typeOptions} />
      </FormField>

      <FormField label={t("config.body")} required>
        <SkillBodyEditor
          name={values.name}
          value={values.body}
          dirty={dirty}
          onChange={(v) => onChange("body", v)}
        />
        {bodyError && <div role="alert" style={s.error}>{bodyError}</div>}
      </FormField>

      <div style={s.actions}>
        <Button kind="primary" icon="Check" onClick={onSave} disabled={pending || (!!skill && !dirty)}>
          {skill
            ? pending
              ? t("config.saving")
              : t("config.save")
            : pending
              ? t("config.creating")
              : t("config.create")}
        </Button>
        <Button kind="secondary" onClick={onCancel} disabled={pending || (!!skill && !dirty)}>
          {t("config.cancel")}
        </Button>
        {skill && (
          <div style={s.deleteWrap}>
            <Button kind="danger" icon="Trash" onClick={() => setDeleting(true)}>
              {t("config.delete")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
