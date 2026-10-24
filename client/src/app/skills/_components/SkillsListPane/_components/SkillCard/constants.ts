import type { IconName } from "@devdigest/ui";
import type { SkillSource } from "@devdigest/shared";

/** Icon next to the source label on a card. */
export const SOURCE_ICON: Record<SkillSource, IconName> = {
  manual: "Edit",
  extracted: "Edit",
  community: "Globe",
  imported_url: "Upload",
  imported_file: "Upload",
};
