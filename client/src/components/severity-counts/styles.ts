import type { CSSProperties } from "react";

export const s = {
  group: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    fontSize: 12.5,
    fontWeight: 600,
  } satisfies CSSProperties,
  item: (color: string): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    color,
  }),
} as const;
