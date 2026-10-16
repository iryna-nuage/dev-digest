# client (@devdigest/web)

## Before answering
Search `client/docs/`, `client/specs/`, `client/INSIGHTS.md` first.

## Conventions (not obvious from code)
- Types/contracts come from `@devdigest/shared` (Zod) — never hand-duplicate them.
- `src/vendor/shared` is a manual copy of `server/src/vendor/shared`: mirror server contract
  changes into it; don't edit it on its own.
- All API access goes through `src/lib/hooks/*` → `src/lib/api.ts`; no `fetch` in components.
- UI strings live in `messages/en/*.json` (next-intl), not inline.

## Gotchas
- PR pages are routed by PR number, but PR APIs take the row uuid — resolve it via `usePulls`.

## Use when
- Page/route map, commands → read `client/README.md`
- UI primitives → read `client/src/vendor/ui/README.md`
- Server/Client boundary, data flow (hooks → `api.ts` → API), where code goes → read
  `client/docs/ui-architecture.md`
- Feature behaviour → read `client/specs/L01-run-cost.md` (cost badge placements) ·
  `client/specs/L01-findings-severity.md` (severity counters, filter, findings popovers)
- Findings → read `client/INSIGHTS.md`
