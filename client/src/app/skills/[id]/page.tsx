import { SkillDetailView } from "../_components/SkillDetail";

/* Route: /skills/:id?tab=config|preview|stats — one skill in the detail pane. */
export default async function SkillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SkillDetailView id={id} />;
}
