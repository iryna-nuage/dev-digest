---
name: frontend-architecture
description: "Architecture and code-organization rules for React and Next.js (App Router) frontends. Use when deciding where a component, hook, constant, helper, util, type, API call or business rule should live; when splitting a component or creating a folder; when adding a route or feature; when placing the Server/Client boundary or a data access layer; or when reviewing imports between modules, barrel files and dependency direction. Complements react-best-practices (in-component patterns, hooks, performance) and next-best-practices (Next.js file conventions, RSC validity, data-fetching APIs)."
metadata:
  version: 1.0.0
  tags: react, nextjs, architecture, project-structure, code-organization, module-boundaries
---

# Frontend Architecture

Rules for **where code lives and which way dependencies point** in React and Next.js apps.
Every rule cites a source id (`[S1]`–`[S37]`) from the catalog in [README.md](README.md).

## Scope

Use this skill for placement and boundary decisions: folders, component splitting,
constants, helpers, business-logic layers, state placement, the Server/Client boundary,
import rules.

Use other skills for other topics:
- In-component patterns (purity, `useEffect`, memoization, keys, render factories, size limits)
  → `react-best-practices`
- Next.js file-convention syntax, RSC validity, directives, data-fetching APIs, performance →
  `next-best-practices`
- Auth, input validation, secrets exposure → `security`

## Precedence

**Project conventions override these defaults.** Before placing code, read the project's
CLAUDE.md files and architecture docs, and follow what is already there. Apply these rules
where the project is silent. When a rule here conflicts with a documented convention, follow
the convention and raise the conflict. Don't refactor toward this skill.

## Vocabulary (used consistently in all rule files)

- **route-local**: code used only by one route subtree (`app/<segment>/_components/`).
- **feature**: one business domain's code shared by several routes (`features/<name>/`).
- **shared**: code used across features (`components/`, `hooks/`, `lib/`, `utils/`, `config/`, `types/`).
- **view**: a component that renders and wires events.
- **hook**: a custom hook that orchestrates data, state and mutations for one use case.
- **domain logic**: pure functions or models that implement business rules.
- **API layer**: one configured client plus per-endpoint fetchers and query/mutation hooks.
- **promote**: move a module to the lowest common ancestor of its consumers.

## Where does it go?

| You are adding… | Put it… | Rule file |
|---|---|---|
| A component used by one route | `app/<segment>/_components/<Name>/` | [project-structure](rules/project-structure.md) |
| A component used by 2+ routes/features | lowest common ancestor; generic UI → `components/` | [project-structure](rules/project-structure.md) |
| A sub-part used only by its parent | inside the parent's folder (`_components/`) | [component-boundaries](rules/component-boundaries.md) |
| A static value used by one component | `constants.ts` beside it | [constants-and-config](rules/constants-and-config.md) |
| An app-wide constant or env value | `config/` (env read in one module) | [constants-and-config](rules/constants-and-config.md) |
| A pure function used by one component | `helpers.ts` beside it | [helpers-and-utils](rules/helpers-and-utils.md) |
| A generic, domain-free function | `utils/` | [helpers-and-utils](rules/helpers-and-utils.md) |
| A configured third-party client | `lib/` | [helpers-and-utils](rules/helpers-and-utils.md) |
| A business rule or calculation | domain module (pure, no React) | [business-logic](rules/business-logic.md) |
| Data loading or mutation for a screen | use-case hook over API-layer hooks | [business-logic](rules/business-logic.md) |
| A call to a backend endpoint | API layer: fetcher + types + query hook | [state-and-server-data](rules/state-and-server-data.md) |
| A query key | key factory next to that feature's queries | [state-and-server-data](rules/state-and-server-data.md) |
| UI state | lowest component that needs it; lift only to the common parent | [state-and-server-data](rules/state-and-server-data.md) |
| Interactive code in a Next.js page | a small `'use client'` leaf; the page stays a Server Component | [nextjs-architecture](rules/nextjs-architecture.md) |
| Server data access with secrets/auth | server-only Data Access Layer | [nextjs-architecture](rules/nextjs-architecture.md) |
| An import from another feature or route | don't: promote the shared part instead | [module-boundaries](rules/module-boundaries.md) |
| An `index.ts` re-exporting many modules | don't: import files directly | [module-boundaries](rules/module-boundaries.md) |

## Core rules

1. **Choose one organization strategy and stay consistent**; extend the existing one [S1].
2. **Colocate first.** Code, tests, styles, helpers, constants and state live next to their
   consumer [S14].
3. **Promote on the second consumer**, to the lowest common ancestor. Demote when the consumer
   count drops back to one [S12] [S14].
4. **One component, one responsibility.** Split on separate state, data, reason to change, or
   a second consumer [S16] [S15].
5. **Hooks, not containers.** Orchestration goes in a use-case hook, and the component
   renders [S21] [S22].
6. **Business rules are pure domain code** with no React and no fetching. Dependencies point
   inward: `view → hook → domain`, `hook → API layer` [S24] [S26].
7. **Classify state before placing it.** Server cache goes in the data-fetching library and is
   never copied into `useState`. UI state stays local [S8] [S27] [S28].
8. **Dependencies flow one way**: shared → features → app/routes. No feature-to-feature or
   route-to-route imports [S6] [S12].
9. **No aggregating barrels in app code.** A single-component `index.ts` is fine [S6] [S13] [S34].
10. **Abstract late.** Duplicate first, extract on the third occurrence. Re-inline an
    abstraction that keeps growing flags [S32] [S33].
11. **In Next.js, `app/` is the routing layer.** `'use client'` goes at interactive leaves,
    and the app uses one data-access approach [S1] [S2] [S3].

## Workflow: placing new code

```
- [ ] 1. Read the project's conventions (CLAUDE.md, architecture docs); they take precedence.
- [ ] 2. Classify the code: view / hook / domain / API layer / constant / helper / util.
- [ ] 3. Count consumers now (not "maybe later") and place it at their lowest common ancestor.
- [ ] 4. Check imports: no sideways imports, no server-only module in a client graph,
         no new aggregating barrel.
- [ ] 5. If a rule here conflicts with a project convention, follow the convention and
         mention the conflict.
```

When reviewing code, run the same checklist over each new or moved file and report any
violations with the rule file and source id.

## Rule files

- [rules/project-structure.md](rules/project-structure.md): layout, colocation, promotion,
  feature folders, when to adopt FSD
- [rules/component-boundaries.md](rules/component-boundaries.md): splitting, folder anatomy,
  composition, shared UI
- [rules/constants-and-config.md](rules/constants-and-config.md): constant tiers, env config,
  look-alikes
- [rules/helpers-and-utils.md](rules/helpers-and-utils.md): helper vs util vs lib vs hook,
  abstraction timing
- [rules/business-logic.md](rules/business-logic.md): view/hook/domain/API layers, decision
  steps, example
- [rules/state-and-server-data.md](rules/state-and-server-data.md): state kinds, server cache,
  query keys
- [rules/nextjs-architecture.md](rules/nextjs-architecture.md): routing layer, Server/Client
  boundary, DAL, Server Actions
- [rules/module-boundaries.md](rules/module-boundaries.md): dependency direction, public API,
  barrels, enforcement

## Applying to DevDigest

In this repo the project conventions are already written down. Read them and don't
re-derive them:
- Read first: `client/CLAUDE.md`, `client/docs/ui-architecture.md` (section "Where code goes"),
  the "Naming conventions" section of the root `CLAUDE.md`, and `client/INSIGHTS.md`.
- How the vocabulary maps onto the repo:
  - route-local = `_components/<PascalCase>/`
  - shared UI = `src/components/<kebab-case>/`
  - API layer = `src/lib/api.ts` + `src/lib/hooks/*`
  - shared non-React modules = `src/lib/*.ts`
  - contracts = `@devdigest/shared`
  - design system = `@devdigest/ui`
  - UI copy = next-intl message catalogs
- Data access in `client/` follows the **HTTP-API model**: a separate Fastify backend, and all
  fetching runs in the browser through TanStack Query hooks. The Data Access Layer rules in
  `nextjs-architecture.md` don't apply there.
- Existing conventions take precedence over this skill. Two examples: the per-component
  `index.ts`, and the documented hooks barrel `src/lib/hooks/index.ts`. Follow both as they
  are. Don't introduce `features/` folders, new aggregating barrels or FSD layers without
  agreement.
- Server-side code (`server/`, `reviewer-core/`) is out of scope for this skill.

## Sources

[README.md](README.md) lists every source (S1–S37) with its URL, plus the research method, the
architectural decisions taken here and where the sources disagree.
