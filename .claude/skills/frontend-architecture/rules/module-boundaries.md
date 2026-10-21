# Module boundaries and dependency direction

Source ids like `[S6]` refer to [../README.md](../README.md).

## Contents
- One-way dependency flow
- No sideways imports
- Public API of a module
- Barrel files
- Import paths
- Enforcing the rules

## One-way dependency flow

```
shared (components, hooks, lib, utils, types, config)
   ↑ imported by
features / domains
   ↑ imported by
app / routes (pages, layouts, route-local _components)
```

- Shared code can be used anywhere. Features import only from shared code. The app layer
  imports from features and shared code [S6]. Code flows in one direction: utilities →
  features → pages, never back [S12].
- FSD is the stricter form: a layer imports only from the layers strictly below it [S9].
- Server-only modules are a boundary too: they must never enter a client module graph [S2].

## No sideways imports

- A feature never imports from another feature. Compose features at the route level instead,
  so each one stays removable [S6] [S12].
- When two features need the same code, move it down to a shared layer, or to a lower FSD
  layer such as `entities` [S9] [S12].
- Route-local code (`_components/`, `_lib/`) is private to its route subtree. Another route
  that needs it gets a promoted copy ([project-structure.md](project-structure.md)). Never
  reach into a sibling route's private folder.
- FSD allows controlled cross-imports between entities only, through the `@x` notation [S10].

## Public API of a module

- Outsiders use a module only through its entry point and never import its internal files
  [S10] [S12].
- A public API is a contract. Export named members explicitly and never use wildcard
  re-exports (`export *`) [S10].
- Inside a module, import siblings by relative path, never through the module's own index.
  Going through your own index creates circular imports [S10] [S34].

## Barrel files

The sources disagree, so this skill takes the following position (rationale in
[../README.md](../README.md)):

- **Avoid aggregating barrels in application code**, meaning `index.ts` files that re-export
  many modules. They slow dev servers, test runners and type-checking, weaken tree-shaking,
  and invite circular imports [S6] [S34] [S35] [S36].
- **Acceptable**: a component folder's `index.ts` that re-exports that one component [S12]
  [S13], and a library or package entry point [S34].
- Comeau argues barrel cost is negligible for typical apps [S13]. Tooling evidence at scale
  points the other way [S35] [S36].
- When a project already has a barrel by convention, follow the documented import style and
  don't spread the pattern to new modules without agreement.

## Import paths

- Use a path alias (for example `@/components/...`) for imports that cross top-level areas,
  and relative paths within a module. Moving a module then doesn't rewrite every importer
  [S15].
- Import a cross-package contract through its alias. Never copy its types.

## Enforcing the rules

- Write rules down first (project CLAUDE.md or architecture doc), then automate them.
- ESLint `import/no-restricted-paths` can forbid cross-feature imports [S6].
  `eslint-plugin-boundaries` classifies files into elements by path pattern and validates
  allowed dependencies between them [S37]. Steiger lints FSD public-API violations [S10].
- Without a linter, check imports during review against the diagram above.
