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
Where: src/vendor/shared ↔ server/src/vendor/shared · src/vendor/shared/adapters.ts:77 ↔
server/src/vendor/shared/adapters.ts:83
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

### 2026-10-11 · tests · Components using `RunCostBadge` need the `common` namespace in tests
What: component tests wrap in `NextIntlClientProvider` with ONLY the feature namespace
(`{ prReview: messages }`, `{ runs: messages }`). `RunCostBadge` calls
`useTranslations("common")` for its "Cost unknown" tooltip, so `PRRow` / `RunHistory` tests must
also pass `common` (`messages/en/common.json`) or the tooltip resolves to a missing key.
Do: ALWAYS add every namespace a rendered child uses to the test provider, not just the
component's own.
Where: src/components/run-cost-badge/RunCostBadge.tsx:22 · src/app/repos/[repoId]/pulls/[number]/_components/RunHistory/RunHistory.test.tsx:41
Status: by design

### 2026-10-23 · providers · Opt a mutation out of the global error toast with `meta: { silent: true }`
What: `MutationCache.onError` in `providers.tsx` toasts every failed mutation. A UI that shows the
error inline (the skill import drawer) would show it twice; the cache now returns early when
`mutation.meta?.silent` is set. Only `useImportSkillPreview` uses it so far.
Do: ALWAYS set `meta: { silent: true }` on a mutation whose error the component renders itself;
leave it off for ordinary user actions.
Where: src/lib/providers.tsx:45 · src/lib/hooks/skills.ts:129
Status: by design

## Tool & Library Notes

### 2026-10-24 · ui · The `Markdown` primitive renders headings and lists as plain text
What: `@devdigest/ui` `Markdown` styles only `p`, `strong`, `code` and `a`. `styles.css` imports
Tailwind 4, whose preflight resets `h1`–`h6` size and weight and `ul`/`ol` markers, so `# Title`
and `- item` look like ordinary lines (the skill Preview did, before `SkillMarkdown`).
Do: ALWAYS give react-markdown your own `h1`/`h2`/`h3`/`ul`/`ol`/`li` styles (as `SkillMarkdown`
does) when rendering a whole Markdown document; keep `Markdown` for short inline text.
Where: src/vendor/ui/primitives/Markdown.tsx:6 · src/vendor/ui/styles.css:1 · src/app/skills/_components/SkillDetail/_components/SkillPreviewTab/_components/SkillMarkdown/SkillMarkdown.tsx:11
Status: by design

## Recurring Errors & Fixes

### 2026-10-23 · build · A runtime import from `@devdigest/shared` passes typecheck and Vitest but breaks `next build`
What: `src/vendor/shared/index.ts` re-exports with ESM specifiers (`./contracts/knowledge.js`).
`tsc` and Vitest resolve them to the `.ts` files, but Next's webpack does not: the first value
import (`formatSkillForPrompt`, `SkillType`, limits in L02) failed with "Module not found: Can't
resolve './contracts/review-api.js'" (one line per contract file). Until L02 every client import
from the package was `import type`, which is erased, so the problem never showed.
Do: ALWAYS import runtime values from the contract file (`@devdigest/shared/contracts/knowledge`);
type-only imports may keep using `@devdigest/shared`. Run `pnpm build` after adding one.
Where: src/vendor/shared/index.ts:20 · src/lib/skill-fields.ts:14
Status: workaround (a `webpack.resolve.extensionAlias` in next.config would fix it globally)

## Session Notes

### 2026-10-23 · L02 skills (client)
`/skills` master-detail (Config / Preview / Stats), import drawer, agent Skills tab (attach,
drag / Alt+↑↓ reorder). Added: "`meta: { silent: true }`", "runtime import from `@devdigest/shared`
breaks `next build`".
Where: src/app/skills/layout.tsx:6 · src/lib/skill-fields.ts:52 · src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab/SkillsTab.tsx:17

## Open Questions
