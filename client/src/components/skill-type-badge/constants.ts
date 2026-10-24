import type { IconName } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";

/** Colour + icon per skill type (Skills list, skill header, agent Skills tab). */
export const SKILL_TYPE_STYLE: Record<SkillType, { color: string; bg: string; icon: IconName }> = {
  rubric: { color: "var(--accent-text)", bg: "var(--accent-bg)", icon: "Sparkles" },
  convention: { color: "var(--ok)", bg: "var(--ok-bg)", icon: "Sparkles" },
  security: { color: "var(--crit)", bg: "var(--crit-bg)", icon: "Sparkles" },
  custom: { color: "var(--text-secondary)", bg: "var(--bg-hover)", icon: "Sparkles" },
};
