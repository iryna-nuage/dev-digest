import type { CSSProperties } from "react";

/** Co-located styles for SkillDetail. */
export const s = {
  wrap: { display: "flex", flexDirection: "column", minHeight: "100%" } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "18px 28px 14px",
    flexWrap: "wrap",
  } satisfies CSSProperties,
  h1: { fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono, monospace)" } satisfies CSSProperties,
  body: { padding: "24px 28px 40px" } satisfies CSSProperties,
} as const;
