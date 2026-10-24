import type { CSSProperties } from "react";

/** Co-located styles for ImportSkillDrawer. */
export const s = {
  file: { fontSize: 13, color: "var(--text-secondary)" } satisfies CSSProperties,
  muted: { fontSize: 12, color: "var(--text-muted)", marginTop: 8 } satisfies CSSProperties,
  error: { fontSize: 12, color: "var(--crit)", marginTop: 8 } satisfies CSSProperties,
  notice: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "var(--warn)",
    background: "var(--warn-bg)",
    borderRadius: 6,
    padding: "8px 12px",
    marginBottom: 16,
  } satisfies CSSProperties,
  section: { marginBottom: 20 } satisfies CSSProperties,
  h3: { fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 } satisfies CSSProperties,
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 } satisfies CSSProperties,
  warning: {
    display: "flex",
    gap: 8,
    fontSize: 13,
    color: "var(--warn)",
    lineHeight: 1.45,
  } satisfies CSSProperties,
  ignored: { display: "flex", alignItems: "center", gap: 8, fontSize: 13 } satisfies CSSProperties,
  previewHead: { display: "flex", alignItems: "center", marginBottom: 8 } satisfies CSSProperties,
  switch: { marginLeft: "auto", display: "flex", gap: 4 } satisfies CSSProperties,
  body: {
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--bg-elevated)",
    padding: "14px 18px",
    maxHeight: 360,
    overflow: "auto",
    fontSize: 14,
  } satisfies CSSProperties,
  raw: { margin: 0, whiteSpace: "pre-wrap", fontSize: 12.5, lineHeight: 1.5 } satisfies CSSProperties,
} as const;
