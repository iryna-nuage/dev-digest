/* helpers.ts — pure formatters for run cost / tokens (client/specs/L01-run-cost.md). */

/** Shown wherever a cost is unknown — never "$0.00". */
export const NO_VALUE = "—";

/**
 * USD cost for dense UI. Precision scales with magnitude so tiny per-run costs
 * stay readable: `$0.0013`, `$0.014`, `$1.24`. Null → "—"; a known 0 → "$0.00".
 */
export function formatUsd(usd: number | null | undefined): string {
  if (usd == null || !Number.isFinite(usd)) return NO_VALUE;
  if (usd === 0) return "$0.00";
  if (usd < 0.0001) return "<$0.0001";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

/** Total tokens with en-US grouping: `9,119 tok`. */
export function formatTokenTotal(n: number): string {
  return `${n.toLocaleString("en-US")} tok`;
}
