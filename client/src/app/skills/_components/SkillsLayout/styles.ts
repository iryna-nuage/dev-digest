import type { CSSProperties } from "react";

/** Co-located styles for SkillsLayout (same frame as /agents/[id]). */
export const s = {
  frame: { display: "flex", height: "calc(100vh - 52px)" } satisfies CSSProperties,
  detail: { flex: 1, minWidth: 0, minHeight: 0, overflow: "auto" } satisfies CSSProperties,
} as const;
