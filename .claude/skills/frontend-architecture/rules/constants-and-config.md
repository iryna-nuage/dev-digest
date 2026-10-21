# Constants and configuration

Source ids like `[S13]` refer to [../README.md](../README.md).

## What counts as a constant

A value that doesn't depend on props, state, or the request: option lists, limits and
thresholds, polling intervals, lookup tables (enum → label, color, icon), default values,
storage keys. Values derived from props or state are computed during render, not stored as
constants. That rule lives in the `react-best-practices` skill.

## Placement tiers

| Used by | Place | Source |
|---|---|---|
| One component | `constants.ts` in the component folder | [S13] |
| Several components of one route/feature | `constants.ts` at that route/feature root (or its `config` segment in FSD) | [S9] [S12] |
| The whole app | `config/` (or a single `constants.ts`) at the source root | [S6] [S13] |

Promote a constant by the same second-consumer rule used for code
([project-structure.md](project-structure.md)). An app-wide constants file that mixes
domains is a dumping ground. Split it by domain once it holds unrelated groups.

## Things that look like constants but have their own home

- **UI copy**: if the project uses i18n, user-facing strings live in the message catalogs,
  never in `constants.ts`.
- **Design tokens** (colors, spacing, breakpoints): if the project has a design system or theme,
  tokens live there. Comeau keeps style constants in `constants.ts` [S13], but only for
  projects that have no design system.
- **Query keys**: keep them next to the queries that use them, ideally in a per-feature key
  factory [S29] [S30]. See [state-and-server-data.md](state-and-server-data.md).
- **Contract enums and schemas**: if a shared contract/schema package exists, import enums and
  types from it. Never redeclare them locally.

## Environment and runtime configuration

- Read environment variables in one config module. Other modules import typed values from
  it.
- In Next.js only `NEXT_PUBLIC_*` variables reach the client bundle. Every other variable is
  server-only [S2] [S3].
- When the app has a server-side Data Access Layer, only that layer reads secrets from
  `process.env` [S3] [S4].
