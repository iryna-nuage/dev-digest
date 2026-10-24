import type { IconName } from "@devdigest/ui";
import { SkillType } from "@devdigest/shared/contracts/knowledge";

/** Detail tabs. `labelKey` resolves under the `skills` namespace. */
export const TABS: readonly { key: string; labelKey: string; icon: IconName }[] = [
  { key: "config", labelKey: "detail.tabs.config", icon: "Settings" },
  { key: "preview", labelKey: "detail.tabs.preview", icon: "Eye" },
  { key: "stats", labelKey: "detail.tabs.stats", icon: "BarChart" },
];

export const VALID_TABS = TABS.map((t) => t.key);

/** Create mode has nothing to measure yet. */
export const CREATE_TABS = TABS.filter((t) => t.key !== "stats");

export const SKILL_TYPES = SkillType.options;
