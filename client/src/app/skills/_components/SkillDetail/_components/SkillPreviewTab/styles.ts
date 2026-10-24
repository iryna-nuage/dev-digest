import type { CSSProperties } from "react";

/** Co-located styles for SkillPreviewTab. */
export const s = {
  wrap: { maxWidth: 860 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-muted)", margin: "6px 0 16px" } satisfies CSSProperties,
  note: {
    fontSize: 12,
    color: "var(--warn)",
    background: "var(--warn-bg)",
    borderRadius: 6,
    padding: "6px 10px",
    marginBottom: 10,
  } satisfies CSSProperties,
  card: {
    border: "1px solid var(--border)",
    borderRadius: 10,
    background: "var(--bg-elevated)",
    padding: "20px 24px",
    fontSize: 14,
  } satisfies CSSProperties,
  empty: { color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
