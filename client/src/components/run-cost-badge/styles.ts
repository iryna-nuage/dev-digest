import type { CSSProperties } from "react";

/** Co-located styles for RunCostBadge — muted mono text that fits dense rows. */
export const s = {
  badge: { fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" } satisfies CSSProperties,
} as const;
