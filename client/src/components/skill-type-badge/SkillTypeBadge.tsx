/* SkillTypeBadge / SkillTypeIcon — the skill type as a coloured label and as
   the square icon tile (Skills list, skill header, agent Skills tab). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { SKILL_TYPE_STYLE } from "./constants";

export function SkillTypeBadge({ type }: { type: SkillType }) {
  const t = useTranslations("skills");
  const st = SKILL_TYPE_STYLE[type];
  return (
    <Badge color={st.color} bg={st.bg} mono>
      {t(`listItem.type.${type}`)}
    </Badge>
  );
}

export function SkillTypeIcon({ type, size = 26 }: { type: SkillType; size?: number }) {
  const st = SKILL_TYPE_STYLE[type];
  const I = Icon[st.icon];
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 7,
        background: st.bg,
        color: st.color,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <I size={Math.round(size * 0.55)} />
    </span>
  );
}
