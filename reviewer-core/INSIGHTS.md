# Insights — reviewer-core

Non-obvious findings for agents working in this module. Maintained by the `engineering-insights`
skill: append-only — add entries at the end of a section; never edit or delete them, only append
to their `Status:` line.

Entry: `### YYYY-MM-DD · <area> · <the lesson stated as a rule>`, then What / Do / Where / Status.

## What Works

## What Doesn't Work

## Codebase Patterns

### 2026-09-25 · review · Score is recomputed, verdict is not
What: after grounding, the score is recomputed from surviving findings
(100 − 35·CRITICAL − 12·WARNING − 3·SUGGESTION), but the verdict is kept from the model even
if grounding dropped the findings that justified it.
Where: src/review/run.ts · src/review/reduce.ts:27
Status: by design (so far)

### 2026-09-25 · review · Cancellation checkpoint only between chunks
What: `checkCancelled()` runs before each chunk's LLM call. In single-pass mode (the studio
default) there is exactly one checkpoint, before the only call.
Where: src/review/run.ts:162-164
Status: by design; see server/INSIGHTS.md for the related cancel bug

## Tool & Library Notes

### 2026-09-25 · build · Consumed as raw TS; own zod
What: never compiled — the server imports `src/` through a tsconfig alias, so it needs this
package's `node_modules` (npm). `zod` resolves from this package, giving the server process
two zod instances.
Where: tsconfig.json:24 · server/tsconfig.json · scripts/dev.sh:78-80
Status: by design (starter)

## Recurring Errors & Fixes

## Session Notes

## Open Questions

### 2026-09-25 · prompt · INJECTION_GUARD assumes the PR title is wrapped
What: the guard says the PR title is inside `<untrusted>` blocks, but the server's task line
passes the title raw.
Where: src/prompt.ts · server/src/modules/reviews/helpers.ts:82
Status: open
