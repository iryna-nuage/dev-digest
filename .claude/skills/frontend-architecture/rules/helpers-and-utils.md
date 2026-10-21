# Helpers, utils and lib

Source ids like `[S13]` refer to [../README.md](../README.md).

## Vocabulary

| Term | Meaning | Lives in | Source |
|---|---|---|---|
| helper | Function specific to this project or domain; wouldn't transfer to another project | next to its consumer (`helpers.ts`), else feature `lib/` / `model/` | [S13] |
| util | Generic, domain-free function (lodash-like) | `utils/` | [S13] [S6] |
| lib | Preconfigured third-party library or client wrapper (API client, query client, date lib setup) | `lib/` | [S6] [S12] |
| hook | Function that calls React hooks; name starts with `use` | next to consumer, else `hooks/` or feature `hooks/` | [S18] |

## Rules

- Move a function out of the component body unless it needs the component's closure (state,
  props) [S15].
- If it calls hooks, it is a hook and gets the `use` prefix. If it doesn't, it is a plain
  function and must not be named `useX`, so it can be called conditionally [S18].
- Name hooks after their concrete purpose (`useRunStatus`, `useMediaQuery`). Avoid generic
  lifecycle wrappers like `useMount` [S18].
- Keep helpers pure: inputs → output, no fetching, no globals. Pure helpers can be
  unit-tested without rendering, which is the main payoff of extracting them [S25] [S26].
- Name files after the domain they serve (`format-cost.ts`, `severity.ts`), not after
  their kind. A growing `utils.ts` or `helpers.ts` at the root is a dumping ground.
- Placement follows colocation: start next to the consumer and promote on the second
  consumer [S14]. `utils/` is only for code that is truly domain-free [S13].

## When to extract a shared abstraction

- Avoid hasty abstractions. Duplicating code once is fine; abstract on the third occurrence,
  when the commonality is clear [S32].
- "Duplication is far cheaper than the wrong abstraction" [S33]. The warning sign is a shared
  helper or component that keeps gaining parameters and conditionals, each serving one caller.
- To fix one: inline it back into each caller, delete the branches each caller doesn't use,
  then extract again based on current needs [S33].
- Don't extract every small duplication into a hook either. Extract repeated stateful logic,
  not every pair of similar lines [S18].
