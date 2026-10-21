# frontend-architecture — research notes and sources

Companion document for [SKILL.md](SKILL.md). It records how the skill was researched, which
architectural positions it takes and why, where the sources disagree, and every source the
rules cite.

## Contents
- Purpose and scope
- Skill layout
- Research method
- Architectural decisions
- Where the sources disagree
- Sources (S1–S37)
- Skill-authoring reference
- Considered but not used
- Changelog

## Purpose and scope

A general-purpose skill on **frontend architecture** for React and Next.js (App Router): where
components, constants, helpers, utils and business logic live, how components are split,
where each kind of state belongs, where the Server/Client boundary goes, and which way module
dependencies point.

Out of scope, because other skills in this repo already cover it:
- `react-best-practices`: in-component patterns, hooks misuse, memoization, performance,
  accessibility.
- `next-best-practices`: file-convention syntax, RSC validity, async APIs, data-fetching APIs,
  image and font optimization, bundling.
- `security`: auth, validation, secrets.

The skill is general-purpose. Its only project-specific part is the short "Applying to
DevDigest" section in SKILL.md, which points to existing repo conventions instead of copying
them.

## Skill layout

```
frontend-architecture/
  SKILL.md                         # activation, vocabulary, "where does it go?" table, core rules, workflow
  README.md                        # this file
  rules/project-structure.md       # layout, colocation, promotion, feature folders, FSD
  rules/component-boundaries.md    # splitting, folder anatomy, composition, shared UI
  rules/constants-and-config.md    # constant tiers, env config
  rules/helpers-and-utils.md       # helper / util / lib / hook, abstraction timing
  rules/business-logic.md          # view → hook → domain / API layer
  rules/state-and-server-data.md   # state kinds and their homes, server cache, query keys
  rules/nextjs-architecture.md     # routing layer, Server/Client boundary, DAL, Server Actions
  rules/module-boundaries.md       # dependency direction, public API, barrels, enforcement
```

The structure follows Anthropic's skill-authoring guidance [A1]:
- SKILL.md is the overview, well under 500 lines, and links each rule file directly, one level
  deep.
- Rule files are split by domain, so an agent loads only the one it needs.
- Every rule file over 100 lines starts with a table of contents.
- Terminology is fixed in a vocabulary section.
- The description is in the third person and says both what the skill does and when to use it.

## Research method

1. Listed the questions the skill must answer: where components go, how to split them, where
   constants go, what counts as a helper or a util, where business logic goes, where state
   goes, how Next.js changes the picture, and how to keep module dependencies clean.
2. Searched for primary sources: official docs (react.dev, nextjs.org, TanStack), widely
   adopted reference architectures (Bulletproof React, Feature-Sliced Design), and recognized
   practitioners (Kent C. Dodds, Dominik Dorfmeister/TkDodo, Juntao Qiu on martinfowler.com,
   Robin Wieruch, Josh W. Comeau, Dan Abramov, Sandi Metz).
3. Fetched every cited page to confirm that the URL is live, the author and date are right,
   and the cited claim is actually there. Two exceptions are noted on their entries ([S21],
   [S25]).
4. Wrote each rule only where at least one source supports it, and cited it by id. Where the
   sources disagree, the skill takes a position, recorded in the next two sections.
5. Checked overlap against the existing `react-best-practices` and `next-best-practices` skills.
   Their topics are referenced from here, not repeated.

## Architectural decisions

| # | Decision | Rationale | Sources |
|---|---|---|---|
| D1 | **Default layout: colocate by route/feature, plus thin shared top-level folders**, not purely technical folders | Next.js names "split by feature or route" as a first-class strategy. Colocation keeps code that changes together in one place. Bulletproof and Wieruch converge on feature folders as apps grow | [S1] [S6] [S12] [S14] |
| D2 | **Promote on the second consumer, to the lowest common ancestor** | Speculative shared code gets orphaned. Wieruch's "shared by 2+ features → move up" | [S12] [S14] |
| D3 | **FSD is opt-in, not the default** | Valuable for many domains and teams with enforced layering. FSD itself says not to adopt it where the current architecture works | [S9] [S11] |
| D4 | **Hooks replace container components** | Abramov withdrew the container/presentational split. Hooks give the same separation with no wrapper | [S21] [S22] |
| D5 | **Four logic layers: view, hook, domain, API layer**, dependencies pointing inward | The convergent model across Juntao Qiu (Fowler), Kettmann and Bespoyasov. Scale it to need: for small apps, extract the domain and respect the direction | [S24] [S25] [S26] [S7] |
| D6 | **Classify state first. Server cache goes in a data library, never copied into `useState`** | Server cache and UI state have different lifecycles. Copies stop receiving background updates | [S8] [S27] [S28] |
| D7 | **Query keys via per-feature factories, colocated with the queries** | Consistent keys and invalidation at any level | [S29] [S30] |
| D8 | **One-way dependencies (shared → features → app), no sideways imports** | Keeps each feature removable. Every structure source shares this rule | [S6] [S9] [S12] |
| D9 | **No aggregating barrels in app code. Single-component `index.ts` is allowed** | Measured tooling and test costs, plus circular-import risk. A one-component entry file carries neither cost and is common practice | [S6] [S34] [S35] [S36] [S12] [S13] |
| D10 | **Abstract late (rule of three). Re-inline abstractions that grow per-caller flags** | Duplication is cheaper than the wrong abstraction | [S32] [S33] |
| D11 | **Next.js: `app/` is the routing layer, `'use client'` at leaves, one data-access approach per app, DAL for full-stack apps** | Official guidance in the Next.js docs and in Markbåge's security post | [S1] [S2] [S3] [S4] |
| D12 | **Project conventions override the skill** | The skill is general-purpose. A codebase's documented choices are deliberate trade-offs, so the skill never drives refactors against them | — |

## Where the sources disagree

| Topic | Positions | Skill's resolution |
|---|---|---|
| Barrel files | Comeau: per-folder `index.ts` re-exports are fine and barrel cost is negligible for typical apps [S13]. Bulletproof, TkDodo, Hagemeister, Atlassian: avoid barrels because of tree-shaking, tooling slowdown and circular imports [S6] [S34] [S35] [S36]. FSD: index files as an explicit public API, no wildcards [S10] | D9: no aggregating barrels; single-component entry files and library entry points are fine; follow an existing project barrel convention |
| Function-based vs feature-based folders | Comeau: group by function because product boundaries shift [S13]. Wieruch, Bulletproof, Kondov: group by feature/route as the app grows [S6] [S12] [S15] | D1: feature/route colocation by default; function-based is acceptable for small or single-domain apps |
| Container/presentational split | Original 2015 pattern vs Abramov's 2019 retraction [S21]; patterns.dev hooks pattern [S22] | D4: hooks, not wrapper containers |
| Supporting-file naming | `<Name>.helpers.ts` [S13] vs plain `helpers.ts` inside the folder [S12] | Either; follow the project |
| How much layering | Full clean architecture with ports and adapters [S26] vs incremental evolution [S24] | D5: incremental; extract the domain first |
| Server data in Next.js | Fetch in Server Components (framework-native) vs a client cache (TanStack Query) [S31] | One owner per piece of data; don't render the same query data in both places [S31] |

## Sources (S1–S37)

Dates are publication dates (and last-updated dates where the page shows one). All pages
were fetched and checked on 2026-10-21 unless an entry notes otherwise.

### Next.js (official)
- **[S1]** Next.js docs — *Project structure and organization* (updated 2026-07-21).
  https://nextjs.org/docs/app/getting-started/project-structure
  — colocation is safe in `app/`; private folders; route groups; the three organization
  strategies; "choose a strategy … and be consistent".
- **[S2]** Next.js docs — *Server and Client Components* (updated 2026-10-05).
  https://nextjs.org/docs/app/getting-started/server-and-client-components
  — `'use client'` marks a module-graph boundary; put it on interactive leaves; interleave
  Server Components via `children`; providers as deep as possible; `server-only` /
  `client-only`; `NEXT_PUBLIC_` env.
- **[S3]** Next.js docs — *How to think about data security in Next.js* (updated 2026-10-06).
  https://nextjs.org/docs/app/guides/data-security
  — three data-access approaches, pick one; Data Access Layer (server-only, auth checks, DTOs);
  only the DAL reads `process.env`; thin Server Actions that delegate to the DAL.
- **[S4]** Sebastian Markbåge — *How to Think About Security in Next.js*, Next.js blog,
  2023-10-23. https://nextjs.org/blog/security-nextjs-server-components-actions
  — origin of the HTTP-API / DAL / component-level model; DTOs; minimal client props.
- **[S5]** Next.js docs — *Route Groups* (updated 2025-06-16).
  https://nextjs.org/docs/app/api-reference/file-conventions/route-groups
  — organize routes by team, concern or feature; full reload between root layouts; no
  conflicting paths.

### Reference architectures
- **[S6]** Alan Alickovic — *Bulletproof React: Project Structure*.
  https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
  — `app/ components/ features/ hooks/ lib/ utils/ config/ types/ stores/`; one-way flow
  shared → features → app; no cross-feature imports (`import/no-restricted-paths`); avoid
  barrel files.
- **[S7]** Bulletproof React — *API Layer*.
  https://github.com/alan2207/bulletproof-react/blob/master/docs/api-layer.md
  — one configured API client; each endpoint declared as types/schema + fetcher + hook.
- **[S8]** Bulletproof React — *State Management*.
  https://github.com/alan2207/bulletproof-react/blob/master/docs/state-management.md
  — component, application, server-cache, form and URL state, each with its own home;
  "localize the state as closely as possible".
- **[S9]** Feature-Sliced Design — *Overview*.
  https://feature-sliced.design/docs/get-started/overview
  — layers app → pages → widgets → features → entities → shared; import only from lower
  layers; slices isolated on a layer; segments `ui api model lib config`; when not to use it.
- **[S10]** Feature-Sliced Design — *Public API*.
  https://feature-sliced.design/docs/reference/public-api
  — public API as a contract; no wildcard re-exports; `@x` cross-imports for entities; avoid
  importing your own index (circular imports); Steiger linter.
- **[S11]** Feature-Sliced Design — *Usage with Next.js*.
  https://feature-sliced.design/docs/guides/tech/with-nextjs
  — `app/` at the project root, re-export FSD pages; `_app` / `_pages` renames;
  `index.server.ts`.

### Structure and component design
- **[S12]** Robin Wieruch — *React Folder Structure Best Practices* (updated 2026-05-05).
  https://www.robinwieruch.de/react-folder-structure/
  — stepwise evolution from one file to technical folders, then feature folders, domains and
  packages; one-way flow; features don't import each other; promote when 2+ features share;
  nest at most two levels.
- **[S13]** Josh W. Comeau — *Delightful React File/Directory Structure*, 2022-03-15 (updated
  2025-12-03). https://www.joshwcomeau.com/react/file-structure/
  — folder per component with `index.ts`, `.helpers.ts`, `.constants.ts`; helpers are
  project-specific, utils are generic; app-wide `constants.ts`; argues barrels are a non-issue.
- **[S14]** Kent C. Dodds — *Colocation*, 2019-06-17. https://kentcdodds.com/blog/colocation
  — "Place code as close to where it's relevant as possible"; premature shared utils become
  orphaned.
- **[S15]** Alex Kondov — *Tao of React*. https://alexkondov.com/tao-of-react/
  — organize by route/module; a common module for shared UI; absolute import paths; wrap
  external components; move helpers out of components; no nested component definitions;
  split when responsibilities multiply.
- **[S16]** react.dev — *Thinking in React*. https://react.dev/learn/thinking-in-react
  — one component, one responsibility; hierarchy mirrors the data model; state lives in the
  closest common parent.
- **[S17]** react.dev — *Rules of React*. https://react.dev/reference/rules
  — components and hooks are pure; React calls components and hooks; rules of hooks. Cited as
  background: the purity rules themselves belong to `react-best-practices`.
- **[S18]** react.dev — *Reusing Logic with Custom Hooks*.
  https://react.dev/learn/reusing-logic-with-custom-hooks
  — `use` prefix only for functions that call hooks; hooks share logic, not state; concrete
  purpose names; no `useMount`-style lifecycle wrappers; don't extract every duplication.
- **[S19]** react.dev — *Choosing the State Structure*.
  https://react.dev/learn/choosing-the-state-structure
  — group related state; avoid contradictions, redundancy, duplication and deep nesting.
- **[S20]** react.dev — *Sharing State Between Components*.
  https://react.dev/learn/sharing-state-between-components
  — lifting state up; single source of truth; controlled vs uncontrolled.
- **[S21]** Dan Abramov — *Presentational and Container Components*, 2015 (update note 2019).
  https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0
  — the 2019 note says he no longer recommends the split, because hooks cover it.
  *Verification:* Medium returned HTTP 403 to the fetcher. The note's content was confirmed
  through a secondary source that quotes it:
  https://www.greatfrontend.com/questions/quiz/explain-the-presentational-vs-container-component-pattern-in-react
- **[S22]** patterns.dev — *Hooks Pattern*. https://www.patterns.dev/react/hooks-pattern
  — hooks extract reusable stateful logic and separate logic from view, replacing HOCs,
  render props and containers.
- **[S23]** patterns.dev — *Compound Pattern*. https://www.patterns.dev/react/compound-pattern
  — components that work together and share implicit state via context.

### Business logic and layering
- **[S24]** Juntao Qiu — *Modularizing React Applications with Established UI Patterns*,
  martinfowler.com, 2023-02-16. https://martinfowler.com/articles/modularizing-react-apps.html
  — React as the view layer only; view, hooks, domain models and gateway layers; five-step
  evolution from a single component to a layered app.
- **[S25]** Johannes Kettmann — *Path To A Clean(er) React Architecture (Part 6): Business
  Logic Separation*, 2024-06-21.
  https://dev.to/jkettmann/path-to-a-cleaner-react-architecture-part-6-business-logic-separation-221g
  — use-case functions outside React; components focus on UI; dependency injection via hooks;
  unit-test logic without rendering. *Verification:* the canonical copy on profy.dev
  (https://profy.dev/article/react-architecture-business-logic-and-dependency-injection) did
  not resolve from the fetcher (DNS failure), so the dev.to mirror by the same author was
  used.
- **[S26]** Alex Bespoyasov — *Clean Architecture on Frontend*, 2021-09-01.
  https://dev.to/bespoyasov/clean-architecture-on-frontend-4311
  — domain, application and adapters layers; only outer layers depend on inner ones; for
  small projects, extract the domain and respect the direction.

### State and server data
- **[S27]** Kent C. Dodds — *Application State Management with React*, 2020-07-21.
  https://kentcdodds.com/blog/application-state-management-with-react
  — separate server cache from UI state; colocate; lift state; context for app-wide concerns.
- **[S28]** Dominik Dorfmeister (TkDodo) — *Practical React Query*, 2020-11-16 (updated
  2023-10-21). https://tkdodo.eu/blog/practical-react-query
  — don't copy server data into local state; custom hooks per query; colocate query logic.
- **[S29]** TkDodo — *Effective React Query Keys*, 2021-06-13 (updated 2022-04-23).
  https://tkdodo.eu/blog/effective-react-query-keys
  — colocate keys per feature; array keys from generic to specific; query key factories.
- **[S30]** TkDodo — *The Query Options API*, 2024-01-17.
  https://tkdodo.eu/blog/the-query-options-api
  — `queryOptions` shares key + fn across `useQuery`, prefetching and `getQueryData` with
  type inference; factories combine key and fn.
- **[S31]** TanStack Query docs — *Advanced Server Rendering*.
  https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
  — a new QueryClient per request on the server, a singleton in the browser;
  prefetch + `HydrationBoundary`; don't render query data in Server Components; consider
  framework-native fetching for new RSC apps.

### Abstractions and module boundaries
- **[S32]** Kent C. Dodds — *AHA Programming*, 2020-06-22. https://kentcdodds.com/blog/aha-programming
  — avoid hasty abstractions; optimize for change; abstract on the third occurrence.
- **[S33]** Sandi Metz — *The Wrong Abstraction*, 2016-01-20.
  https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction
  — "duplication is far cheaper than the wrong abstraction"; abstractions decay through
  per-caller parameters; fix by re-inlining.
- **[S34]** TkDodo — *Please Stop Using Barrel Files*, 2024-07-26.
  https://tkdodo.eu/blog/please-stop-using-barrel-files
  — circular imports; dev-time module bloat (one Next.js app went from 11k to 3.5k modules);
  inconsistent import paths; barrels are fine as library entry points.
- **[S35]** Marvin Hagemeister — *Speeding up the JavaScript ecosystem: The barrel file
  debacle*, 2023-10-08. https://marvinh.dev/blog/speeding-up-javascript-ecosystem-part-7/
  — barrels inflate module graphs; removing them sped up tests and linting by 60–80%.
- **[S36]** Atlassian Engineering — *How We Achieved 75% Faster Builds by Removing Barrel
  Files*, 2025-06-26.
  https://www.atlassian.com/blog/how-we-build/faster-builds-when-removing-barrel-files
  — 75% fewer build minutes; 88% fewer unit tests run per build; faster TypeScript
  highlighting.
- **[S37]** Javier Brea — *eslint-plugin-boundaries*. https://github.com/javierbrea/eslint-plugin-boundaries
  — classifies files into architectural elements by path pattern and validates allowed
  dependencies between them.

## Skill-authoring reference
- **[A1]** Anthropic — *Skill authoring best practices*.
  https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
  — frontmatter limits (name ≤ 64 chars, lowercase/digits/hyphens; description ≤ 1024 chars,
  third person, what + when); SKILL.md body under 500 lines; references one level deep; table
  of contents for files over 100 lines; consistent terminology; no time-sensitive
  instructions.

## Considered but not used
- Vercel `agent-skills` / *react-best-practices* (https://github.com/vercel-labs/agent-skills):
  performance rules, outside this skill's scope.
- OWASP *Next.js Security Cheat Sheet*
  (https://cheatsheetseries.owasp.org/cheatsheets/Nextjs_Security_Cheat_Sheet.html): security
  topic, covered by the `security` skill.
- Next.js 14 *Composition Patterns* page
  (https://nextjs.org/docs/14/app/building-your-application/rendering/composition-patterns):
  superseded by [S2].
- Kent C. Dodds, *State Colocation will make your React app faster*: performance framing;
  [S14] and [S27] cover the architectural point.
- react.dev *You Might Not Need an Effect* and *Keeping Components Pure*: in-component rules,
  covered by `react-best-practices`.

## Changelog
- **1.0.0** (2026-10-21): initial version. Eight rule files, 37 cited sources, DevDigest
  section.
