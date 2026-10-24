import type { ReactNode } from "react";
import { SkillsLayout } from "./_components/SkillsLayout";

/* Route layout: /skills/** — the skills list (left) stays mounted across
   /skills, /skills/new and /skills/[id]; each page renders the right pane. */
export default function Layout({ children }: { children: ReactNode }) {
  return <SkillsLayout>{children}</SkillsLayout>;
}
