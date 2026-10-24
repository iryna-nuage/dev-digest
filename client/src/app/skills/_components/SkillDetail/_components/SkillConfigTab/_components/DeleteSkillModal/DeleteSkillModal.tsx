/* DeleteSkillModal — confirms deleting a skill and says how many agents lose it. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Modal } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useDeleteSkill, useSkillAgents } from "../../../../../../../../lib/hooks/skills";
import { useToast } from "../../../../../../../../lib/toast";

export function DeleteSkillModal({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const toast = useToast();
  const { data: agents } = useSkillAgents(skill.id);
  const del = useDeleteSkill();

  const confirm = () =>
    del.mutate(skill.id, {
      onSuccess: () => {
        toast.success(t("deleteModal.deletedToast", { name: skill.name }));
        onClose();
        router.push("/skills");
      },
    });

  return (
    <Modal
      width={480}
      title={t("deleteModal.title", { name: skill.name })}
      onClose={onClose}
      footer={
        <>
          <Button kind="secondary" onClick={onClose} disabled={del.isPending}>
            {t("deleteModal.cancel")}
          </Button>
          <Button kind="danger" icon="Trash" onClick={confirm} loading={del.isPending} disabled={!agents}>
            {t("deleteModal.confirm")}
          </Button>
        </>
      }
    >
      <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-secondary)" }}>
        {t("deleteModal.body", { count: agents?.length ?? 0 })}
      </p>
    </Modal>
  );
}
