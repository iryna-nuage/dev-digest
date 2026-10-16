# Client UI architecture

How the Next.js 15 studio (`@devdigest/web`) is put together and how data reaches a component.
Routes and commands are in [`../README.md`](../README.md); feature behaviour in [`../specs/`](../specs/).

## Server / Client Component boundary

| Layer | Kind | What it does |
|---|---|---|
| `src/app/layout.tsx` | Server Component (async) | Reads locale + messages (`next-intl/server`), renders `<html>` with the no-flash theme script, wraps children in `NextIntlClientProvider` → `Suspense` → `Providers`. |
| `src/lib/providers.tsx` | Client (`"use client"`) | One `QueryClient` (`retry: 1`, `staleTime: 30s`) + `ThemeProvider`, `RepoProvider`, `ToastProvider`. |
| `src/app/**/page.tsx` | thin route entries | `/agents` and `/settings/[section]` are Server Components that only render a client view from `_components/`; `/`, `/onboarding`, the PR list, PR detail and agent detail pages are `"use client"`. |
| `_components/**`, `src/components/**` | Client | All interactive UI and all data fetching. |

No Server Component fetches API data: everything below the root layout that talks to the
API runs in the browser.

## Data flow

```
component → hook (src/lib/hooks/*.ts, TanStack Query) → apiFetch (src/lib/api.ts) → Fastify API (:3001)
```

- `src/lib/api.ts` — the only `fetch`: base URL `NEXT_PUBLIC_API_BASE` (default
  `http://localhost:3001`), JSON in/out, failures surface as `ApiError` (incl. "engine
  unreachable").
- `src/lib/hooks/*` — one hook per endpoint (`useRepos`, `usePulls`, `usePrReviews`, `usePrRuns`,
  `useRunReview`, `useFindingAction`, …). Query keys are arrays such as `["pulls", repoId]`,
  `["reviews", prId]`, `["pr-runs", prId]`; mutations invalidate the keys they affect.
- Refresh model: `usePulls` refetches every 60 s and on window focus; `usePrRuns` /
  `usePrActiveRuns` poll every 4 s only while a run is `running`; live progress streams over SSE —
  `useRunEvents` opens an `EventSource` on `/runs/:id/events` per run.
- PR pages are routed by PR **number**, PR APIs take the row **uuid**: the detail page resolves
  number → uuid from the cached `usePulls` list before any PR call.

## Shared code and cross-cutting state

- `@devdigest/shared` → `src/vendor/shared/` — Zod contracts, a manual copy of
  `server/src/vendor/shared/` (both must change together).
- `@devdigest/ui` → `src/vendor/ui/` — the design system (tokens, primitives, kit, shell,
  charts; CSS variables, see its README). Its components are rendered by the gallery in
  `src/components/showcase/`, which `src/test/smoke.test.tsx` mounts in both themes.
- i18n — `next-intl` with `src/i18n/request.ts`; strings in `messages/en/<namespace>.json`,
  read with `useTranslations("<namespace>")`.
- Active repo — `RepoProvider` (`src/lib/repo-context.tsx`): repo id from the URL, else
  `localStorage["dd-repo"]`, else the first repo from the API.

## Where code goes

- Route-specific UI: colocated `_components/<Name>/` next to its `page.tsx` (nested
  `_components/` for sub-parts).
- UI reused across routes: `src/components/<kebab-case>/` (e.g. `app-shell`, `run-cost-badge`,
  `severity-counts`, `findings-popover`).
- Pure formatting/counting logic lives in `helpers.ts` beside the component and is unit-tested.
