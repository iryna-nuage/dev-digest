/** `12` or `45-52` — the finding's line span. */
export function lineLabel(f: { start_line: number; end_line: number }): string {
  return f.end_line !== f.start_line ? `${f.start_line}-${f.end_line}` : String(f.start_line);
}

/**
 * Rationale is markdown; the read-only preview shows it as plain text. Drops
 * inline-code backticks and bold/italic asterisks only (underscores are kept —
 * they appear inside identifiers like `sk_live_`), and collapses whitespace.
 */
export function plainText(md: string): string {
  return md.replace(/`+/g, "").replace(/\*+/g, "").replace(/\s+/g, " ").trim();
}
