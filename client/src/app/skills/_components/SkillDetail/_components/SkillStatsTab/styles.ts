import type { CSSProperties } from "react";

/** Co-located styles for SkillStatsTab. */
export const s = {
  wrap: { display: "flex", flexDirection: "column", gap: 16, maxWidth: 1000 } satisfies CSSProperties,
  tiles: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  } satisfies CSSProperties,
  tile: {
    border: "1px solid var(--border)",
    borderRadius: 10,
    background: "var(--bg-elevated)",
    padding: "16px 20px",
  } satisfies CSSProperties,
  tileHead: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 } satisfies CSSProperties,
  tileHint: { fontSize: 12, color: "var(--text-muted)", marginTop: 6 } satisfies CSSProperties,
  note: { fontSize: 12, color: "var(--text-muted)", margin: "-4px 0 0" } satisfies CSSProperties,
  tileLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "var(--text-muted)",
    marginBottom: 10,
  } satisfies CSSProperties,
  tileValue: { fontSize: 30, fontWeight: 700 } satisfies CSSProperties,
  tileUnit: { fontSize: 14, color: "var(--text-muted)", marginLeft: 6 } satisfies CSSProperties,
  card: {
    border: "1px solid var(--border)",
    borderRadius: 10,
    background: "var(--bg-elevated)",
    padding: 16,
  } satisfies CSSProperties,
  cardTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "var(--text-muted)",
    marginBottom: 12,
  } satisfies CSSProperties,
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  row: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    border: "1px solid var(--border)",
    borderRadius: 8,
  } satisfies CSSProperties,
  agentName: { flex: 1, fontSize: 14, fontWeight: 600 } satisfies CSSProperties,
  empty: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
