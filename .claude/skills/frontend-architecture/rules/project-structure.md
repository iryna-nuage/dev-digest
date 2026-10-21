# Project structure: where files live

Source ids like `[S6]` refer to the catalog in [../README.md](../README.md).

## Contents
- Pick one strategy and keep to it
- Default layout
- Colocate first, promote on the second consumer
- Technical folders vs feature folders
- When to adopt Feature-Sliced Design
- Anti-patterns

## Pick one strategy and keep to it

Next.js is unopinionated about organization and offers three valid strategies: project files
outside `app/`, project files in top-level folders inside `app/`, or project files split by
feature/route [S1]. The strategy matters less than applying one consistently [S1]. Before adding
a folder, check which strategy the project already uses and extend it. Never introduce a
second one.

## Default layout

For a new project with no convention yet, use route colocation plus shared top-level folders
(the "split by feature or route" strategy [S1], aligned with [S6] and [S12]):

```
src/
  app/                         # routing layer (see nextjs-architecture.md)
    <segment>/
      page.tsx                 # thin: read params, compose views
      _components/<Name>/      # UI used only by this route subtree
      _lib/                    # route-local hooks/helpers, if any
  features/<feature>/          # OPTIONAL: code shared by several routes of one domain
    api/  components/  hooks/  model/
  components/                  # shared UI used by 2+ routes or features
  hooks/                       # shared, domain-agnostic hooks
  lib/                         # configured clients and wrappers (API client, query client)
  utils/                       # generic, project-agnostic functions
  config/                      # app-wide constants and env access
  types/                       # shared types not owned by a contract/schema package
```

Folder roles follow Bulletproof React [S6] and Robin Wieruch [S12]: `lib/` holds preconfigured
libraries, `utils/` holds generic functions, `config/` holds global configuration and env. A
feature folder holds that feature's `api`, `components`, `hooks`, `stores`, `types` and
`utils`. Create these folders only when the first file needs them [S6].

## Colocate first, promote on the second consumer

- "Place code as close to where it's relevant as possible" [S14]. Tests, styles, helpers,
  constants and sub-components live next to the component that uses them. So does
  component state.
- Promotion rule: once a second route or feature uses a module, move it to the **lowest common
  ancestor** of its consumers. That might be the parent route's `_components/`, a
  `features/<feature>/` folder, or the top-level shared folders [S12] [S14].
- Top-level shared folders hold only code that is used across features [S12]. They are not
  where code "might be reused someday" goes. Speculative shared modules become orphaned when
  their only consumer is deleted [S14].
- Demotion rule: if a shared module drops back to one consumer, move it back next to that
  consumer.
- Keep component-folder nesting shallow, at most two levels of folders nested in folders [S12].

## Technical folders vs feature folders

- Small apps can group by technical role (`components/`, `hooks/`, `utils/`) [S12] [S13].
- Switch to feature or domain folders when the technical folders start mixing unrelated
  domains: when understanding one feature means opening five top-level folders [S12] [S15].
- Josh Comeau deliberately stays function-based, because product boundaries shift [S13]. Treat
  that as a valid choice for small or single-domain apps. Don't treat it as the default for
  multi-domain apps.

## When to adopt Feature-Sliced Design

FSD stacks layers `app → pages → widgets → features → entities → shared`. Each layer can import
only from the layers below it, and slices on the same layer can't import each other [S9]. Use
it when several teams work on many business domains and you want strict layering enforced by
a linter. FSD itself is not recommended for teams whose current architecture works without
pain points [S9]. With Next.js, keep `app/` at the project root for routing only and re-export
FSD pages from it [S11]. Don't mix FSD layers with an ad-hoc `features/` layout in the same
app.

## Anti-patterns

- A top-level `components/` folder full of route-specific components that one page imports.
- A `utils.ts` or `helpers.ts` dumping ground at the root mixing domains (see
  [helpers-and-utils.md](helpers-and-utils.md)).
- Creating empty scaffold folders "for later".
- Moving a file to shared folders before a second consumer exists.
