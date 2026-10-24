import type { CSSProperties } from "react";

/** Co-located styles for SkillsListPane (same frame as the agent editor's list). */
export const s = {
  pane: {
    width: 320,
    flexShrink: 0,
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-surface)",
    minHeight: 0,
  } satisfies CSSProperties,
  top: { padding: "16px 16px 12px" } satisfies CSSProperties,
  headerRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 } satisfies CSSProperties,
  h1: { fontSize: 18, fontWeight: 700, flex: 1 } satisfies CSSProperties,
  search: { position: "relative" } satisfies CSSProperties,
  searchIcon: {
    position: "absolute",
    left: 10,
    top: "50%",
    transform: "translateY(-50%)",
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  searchInput: {
    width: "100%",
    height: 32,
    padding: "0 10px 0 30px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
    fontSize: 13,
    outline: "none",
  } satisfies CSSProperties,
  list: {
    flex: 1,
    overflow: "auto",
    padding: "0 12px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  } satisfies CSSProperties,
  noMatch: { fontSize: 13, color: "var(--text-muted)", padding: "8px 4px" } satisfies CSSProperties,
} as const;
