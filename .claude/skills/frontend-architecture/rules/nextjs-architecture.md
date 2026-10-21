# Next.js App Router architecture

Source ids like `[S1]` refer to [../README.md](../README.md). File-convention syntax (special
files, `_private`, `(group)`, `@slot`), RSC validity rules (async client components,
serializable props), directives and data-fetching APIs belong to `next-best-practices`. This
file covers the architectural decisions those features enable.

## Contents
- `app/` is the routing layer
- Route groups and private folders as organizing tools
- Placing the Server/Client boundary
- Choosing one data-access approach
- Data Access Layer
- Server Actions as thin entry points
- Feature-Sliced Design with Next.js

## `app/` is the routing layer

- Folders define routes, but only what `page`/`route` returns is public. Project files can
  safely be colocated inside `app/` [S1].
- Keep `page.tsx` and `layout.tsx` thin: read params, call the data layer, compose views from
  `_components/` or shared components. Business logic and markup-heavy UI go in the files
  they compose.
- Choose one of the three organization strategies (outside `app/`, top-level inside `app/`,
  split by feature/route) and stay consistent [S1]. See
  [project-structure.md](project-structure.md).

## Route groups and private folders as organizing tools

- Use `_folder` private folders to separate UI logic from routing and to group a route's
  internal files [S1].
- Use `(group)` folders to organize routes by section, intent or team, and to share a layout
  across a subset of routes without changing URLs [S1] [S5].
- Two caveats affect structure decisions. Moving between different *root* layouts triggers a
  full page reload. Two groups must never resolve to the same path [S5].

## Placing the Server/Client boundary

- Layouts and pages are Server Components by default. Add `'use client'` to the files that
  define interactive components, not to large subtrees [S2].
- `'use client'` marks a module-graph boundary: everything that file imports becomes client
  code. Keep boundary files small, and keep heavy or server-only imports out of them [S2].
- To nest server-rendered UI inside a client shell (modal, tabs, accordion), pass it as
  `children` or as a slot prop instead of importing it [S2].
- Context providers are client components that wrap `children`. Mount them as deep in the
  tree as possible [S2].
- Mark server-only modules with `import 'server-only'` and client-only modules with
  `client-only`. An import from the wrong environment then fails the build [S2] [S3].

## Choosing one data-access approach

Next.js recommends picking one approach per app and not mixing them [S3] [S4]:

| Approach | Fits | Source |
|---|---|---|
| HTTP APIs: Server/Client Components call an existing REST/GraphQL backend | Existing apps, separate backend teams or languages; treat server rendering as an untrusted client (zero trust) | [S3] [S4] |
| Data Access Layer: an internal server-only library | New full-stack Next.js projects | [S3] [S4] |
| Component-level access: queries inside Server Components | Prototypes and learning only | [S3] [S4] |

An app where every API call runs in the browser through a client data cache, against a
separate backend, follows the HTTP-API model. Its architecture is
`component → hook → API client` (see [business-logic.md](business-logic.md)), and the DAL
rules below don't apply to it.

## Data Access Layer

- Put all data access for the app in one server-only module (for example `src/data/` or
  `src/server/`). It runs only on the server, performs authorization checks, and returns
  minimal Data Transfer Objects [S3] [S4].
- Only the DAL reads secrets from `process.env` [S3] [S4].
- Client components accept only the fields they render. A broad prop type such as a whole
  `User` record invites over-exposure [S3] [S4].

## Server Actions as thin entry points

- Keep `'use server'` actions thin. They validate input and delegate auth, authorization and
  database work to the server-only DAL [S3].
- Colocate actions with the route or feature that uses them (`actions.ts`). Return only what
  the UI needs [S3].
- Security specifics (re-authorization, IDOR, CSRF) belong to the `security` skill.

## Feature-Sliced Design with Next.js

If the app uses FSD, keep Next.js `app/` at the project root for routing only, and keep FSD
layers in `src/`. Rename FSD's `app` and `pages` layers (`_app`, `_pages`) to avoid
collisions, and re-export pages from route files [S11]. Expose server-only parts through a
separate `index.server.ts` public API [S11].
