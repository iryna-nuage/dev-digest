/* ImportSkillDrawer — upload a .md / .zip → the server extracts the text →
   preview (Markdown, ignored files, warnings) → Save stores the skill
   disabled. Nothing is saved before Save; Cancel / Back / close discard. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Button, Drawer, FormField, Icon, Markdown, SelectInput, TextInput } from "@devdigest/ui";
import { SKILL_DESCRIPTION_MAX, SkillType, type SkillImportPreview } from "@devdigest/shared/contracts/knowledge";
import { useCreateSkill, useImportSkillPreview } from "../../../../../../lib/hooks/skills";
import { useToast } from "../../../../../../lib/toast";
import { ApiError } from "../../../../../../lib/api";
import { validateSkillFields, type SkillFields } from "../../../../../../lib/skill-fields";
import { IMPORT_ACCEPT } from "./constants";
import { checkImportFile, readAsBase64 } from "./helpers";
import { s } from "./styles";

type Meta = Pick<SkillFields, "name" | "description" | "type">;

export function ImportSkillDrawer({ onClose }: { onClose: () => void }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const toast = useToast();
  const parse = useImportSkillPreview();
  const create = useCreateSkill();
  const [error, setError] = React.useState<string>();
  const [reading, setReading] = React.useState(false);
  const [preview, setPreview] = React.useState<SkillImportPreview>();
  const [meta, setMeta] = React.useState<Meta>({ name: "", description: "", type: "custom" });
  const [raw, setRaw] = React.useState(false);
  const [attempted, setAttempted] = React.useState(false);
  const [nameTaken, setNameTaken] = React.useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(undefined);
    const problem = checkImportFile(file);
    if (problem) {
      setError(t(`import.${problem}`));
      return;
    }
    setReading(true);
    try {
      const content_base64 = await readAsBase64(file);
      const result = await parse.mutateAsync({ filename: file.name, content_base64 });
      setPreview(result);
      setMeta({ name: result.name, description: result.description, type: result.type });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("import.readFailed"));
    } finally {
      setReading(false);
    }
  };

  const values: SkillFields = { ...meta, body: preview?.body ?? "", enabled: false };
  const errors = validateSkillFields(values);
  const fieldError = (key: "name" | "description") =>
    key === "name" && nameTaken
      ? t("config.nameTaken")
      : attempted && errors[key]
        ? t(`config.${errors[key]}`, { max: SKILL_DESCRIPTION_MAX })
        : undefined;

  const save = () => {
    setAttempted(true);
    if (!preview || Object.keys(errors).length > 0) return;
    create.mutate(
      { ...meta, body: preview.body, source: "imported_file" },
      {
        onSuccess: (skill) => {
          toast.success(t("import.savedToast", { name: skill.name }));
          onClose();
          router.push(`/skills/${skill.id}?tab=preview`);
        },
        onError: (e) => {
          if (e instanceof ApiError && e.status === 409) setNameTaken(true);
        },
      },
    );
  };

  const back = () => {
    setPreview(undefined);
    setAttempted(false);
    setNameTaken(false);
  };

  const footer = preview ? (
    <>
      <Button kind="secondary" onClick={back} disabled={create.isPending}>
        {t("import.back")}
      </Button>
      <Button kind="secondary" onClick={onClose} disabled={create.isPending}>
        {t("import.cancel")}
      </Button>
      <Button kind="primary" icon="Check" onClick={save} loading={create.isPending}>
        {create.isPending ? t("import.saving") : t("import.save")}
      </Button>
    </>
  ) : (
    <Button kind="secondary" onClick={onClose}>
      {t("import.cancel")}
    </Button>
  );

  return (
    <Drawer width={760} title={t("import.title")} subtitle={t("import.subtitle")} onClose={onClose} footer={footer}>
      {!preview && (
        <FormField label={t("import.fileLabel")} hint={t("import.fileHint")}>
          <input
            type="file"
            accept={IMPORT_ACCEPT}
            aria-label={t("import.fileLabel")}
            disabled={reading}
            onChange={(e) => void onFile(e.target.files?.[0])}
            style={s.file}
          />
          {reading && <div style={s.muted}>{t("import.reading")}</div>}
          {error && (
            <div role="alert" style={s.error}>
              {error}
            </div>
          )}
        </FormField>
      )}

      {preview && (
        <div>
          <div style={s.notice}>
            <Icon.Lock size={14} />
            {t("import.disabledNotice")}
          </div>

          {preview.warnings.length > 0 && (
            <section style={s.section} aria-label={t("import.warningsTitle")}>
              <h3 style={s.h3}>{t("import.warningsTitle")}</h3>
              <ul style={s.list}>
                {preview.warnings.map((w) => (
                  <li key={w.code} style={s.warning}>
                    <Icon.AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                    {w.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <FormField label={t("config.name")} required>
            <TextInput
              value={meta.name}
              onChange={(name) => {
                setNameTaken(false);
                setMeta((m) => ({ ...m, name }));
              }}
              mono
              aria-label={t("config.name")}
            />
            {fieldError("name") && <div role="alert" style={s.error}>{fieldError("name")}</div>}
          </FormField>
          <FormField label={t("config.description")} required hint={t("config.descriptionHint")}>
            <TextInput
              value={meta.description}
              onChange={(description) => setMeta((m) => ({ ...m, description }))}
              aria-label={t("config.description")}
            />
            {fieldError("description") && (
              <div role="alert" style={s.error}>
                {fieldError("description")}
              </div>
            )}
          </FormField>
          <FormField label={t("config.type")}>
            <SelectInput
              value={meta.type}
              onChange={(v) => setMeta((m) => ({ ...m, type: v as SkillType }))}
              options={SkillType.options.map((v) => ({ value: v, label: t(`listItem.type.${v}`) }))}
            />
          </FormField>

          <section style={s.section}>
            <div style={s.previewHead}>
              <h3 style={s.h3}>{t("import.previewTitle")}</h3>
              <div style={s.switch}>
                <Button size="sm" kind={raw ? "ghost" : "secondary"} onClick={() => setRaw(false)}>
                  {t("import.rendered")}
                </Button>
                <Button size="sm" kind={raw ? "secondary" : "ghost"} onClick={() => setRaw(true)}>
                  {t("import.raw")}
                </Button>
              </div>
            </div>
            <div style={s.body} data-testid="import-preview-body">
              {raw ? <pre className="mono" style={s.raw}>{preview.body}</pre> : <Markdown>{preview.body}</Markdown>}
            </div>
          </section>

          {preview.ignored_files.length > 0 && (
            <section style={s.section} aria-label={t("import.ignoredTitle")}>
              <h3 style={s.h3}>{t("import.ignoredTitle")}</h3>
              <ul style={s.list}>
                {preview.ignored_files.map((f) => (
                  <li key={f.path} style={s.ignored}>
                    <span className="mono">{f.path}</span>
                    {f.executable && (
                      <Badge color="var(--crit)" bg="var(--crit-bg)">
                        {t("import.executable")}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Drawer>
  );
}
