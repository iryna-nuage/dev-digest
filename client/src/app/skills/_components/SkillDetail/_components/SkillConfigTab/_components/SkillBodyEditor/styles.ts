import type { CSSProperties } from "react";

const LINE = 20;

/** Co-located styles for SkillBodyEditor. Gutter, highlight layer and textarea share
    one font, padding and line height, so the layer lines up with the text. */
export const s = {
  card: {
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--bg-elevated)",
    overflow: "hidden",
  } satisfies CSSProperties,
  head: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderBottom: "1px solid var(--border)",
  } satisfies CSSProperties,
  file: { fontSize: 13, fontWeight: 600 } satisfies CSSProperties,
  tokens: { marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  editor: { display: "flex", height: 420 } satisfies CSSProperties,
  gutter: {
    padding: "10px 8px",
    minWidth: 40,
    textAlign: "right",
    color: "var(--text-muted)",
    fontSize: 12,
    lineHeight: `${LINE}px`,
    fontFamily: "var(--font-mono)",
    overflow: "hidden",
    userSelect: "none",
    borderRight: "1px solid var(--border)",
  } satisfies CSSProperties,
  field: { position: "relative", flex: 1, minWidth: 0 } satisfies CSSProperties,
  /* Extra bottom/right padding lets it scroll as far as the textarea, whose
     scrollbars shrink its viewport. */
  highlight: {
    position: "absolute",
    inset: 0,
    padding: "10px 52px 40px 12px",
    overflow: "hidden",
    whiteSpace: "pre",
    color: "var(--text-primary)",
    fontSize: 13,
    lineHeight: `${LINE}px`,
    pointerEvents: "none",
  } satisfies CSSProperties,
  heading: { color: "var(--accent-text)" } satisfies CSSProperties,
  textarea: {
    position: "relative",
    display: "block",
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    border: "none",
    outline: "none",
    resize: "none",
    background: "transparent",
    color: "transparent",
    caretColor: "var(--text-primary)",
    fontSize: 13,
    lineHeight: `${LINE}px`,
  } satisfies CSSProperties,
  foot: {
    padding: "6px 12px",
    borderTop: "1px solid var(--border)",
    fontSize: 12,
    color: "var(--text-muted)",
    textAlign: "right",
  } satisfies CSSProperties,
} as const;
