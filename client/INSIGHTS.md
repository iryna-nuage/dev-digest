# Insights — client

Non-obvious findings for agents working in this module. Maintained by the `engineering-insights`
skill: append-only — add entries at the end of a section; never edit or delete them, only append
to their `Status:` line.

Entry: `### YYYY-MM-DD · <area> · <the lesson stated as a rule>`, then What / Do / Where / Status.

## What Works

## What Doesn't Work

## Codebase Patterns

### 2026-09-25 · shared · Contract copy has drifted from the server
What: `src/vendor/shared` is a manual copy of `server/src/vendor/shared`. Already differing:
adapters.ts, contracts/trace.ts, contracts/eval-ci.ts, contracts/knowledge.ts,
contracts/productionize.ts. Example: the client `LLMProvider.id` lacks `'openrouter'`.
Where: src/vendor/shared ↔ server/src/vendor/shared
Status: open

### 2026-09-25 · pulls · PR route uses the number, APIs use the uuid
What: `/repos/[repoId]/pulls/[number]` resolves number → uuid through the `usePulls` list
before any PR API call, so the detail page depends on the pulls query.
Where: src/app/repos/[repoId]/pulls/[number]/page.tsx:35
Status: by design

### 2026-09-25 · pulls · Polling the PR list hits GitHub
What: `usePulls` refetches every 60 s and on window focus; the server's
`GET /repos/:id/pulls` syncs from GitHub on each call.
Where: src/lib/hooks/core.ts:109 · server/src/modules/pulls/routes.ts
Status: open

### 2026-09-25 · hooks · Hooks for an endpoint that doesn't exist yet
What: `useContextFiles` and `useReindexContext` call `/repos/:id/context` and
`/repos/:id/context/reindex`; the starter API has no such routes (Project Context is L05).
Where: src/lib/hooks/core.ts:123-137
Status: scaffolding for L05

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes

## Open Questions
