import type { CSSProperties } from "react";

/** Co-located styles for SkillMarkdown. */
export const s = {
  root: { fontSize: 14, lineHeight: 1.7, color: "var(--text-primary)" } satisfies CSSProperties,
  h1: { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 12px" } satisfies CSSProperties,
  h2: { fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: "22px 0 8px" } satisfies CSSProperties,
  h3: { fontSize: 15, fontWeight: 650, color: "var(--text-primary)", margin: "18px 0 6px" } satisfies CSSProperties,
  p: { margin: "0 0 12px" } satisfies CSSProperties,
  ul: { margin: "0 0 12px", paddingLeft: 22, listStyle: "disc" } satisfies CSSProperties,
  ol: { margin: "0 0 12px", paddingLeft: 22, listStyle: "decimal" } satisfies CSSProperties,
  li: { margin: "4px 0" } satisfies CSSProperties,
  strong: { fontWeight: 650, color: "var(--text-primary)" } satisfies CSSProperties,
  code: {
    fontSize: "0.92em",
    padding: "1px 6px",
    borderRadius: 4,
    background: "var(--bg-hover)",
    color: "var(--accent-text)",
  } satisfies CSSProperties,
  pre: {
    margin: "0 0 12px",
    padding: "10px 12px",
    borderRadius: 6,
    background: "var(--bg-hover)",
    fontSize: 13,
    lineHeight: 1.5,
    overflowX: "auto",
  } satisfies CSSProperties,
  quote: {
    margin: "0 0 12px",
    paddingLeft: 12,
    borderLeft: "3px solid var(--border)",
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  a: { color: "var(--accent-text)", textDecoration: "underline" } satisfies CSSProperties,
} as const;
