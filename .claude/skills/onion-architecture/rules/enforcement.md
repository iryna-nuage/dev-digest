# Enforcement

Source ids like `[O1]` refer to [../README.md](../README.md).

## Contents
- The check
- Rules
- Baseline policy
- What the checker cannot see
- Review checklist

## The check

dependency-cruiser 17.4.3 is already a dependency of `server/` (repo-intel uses it), so the check
needs no install. Run it from `server/`:

```bash
npx depcruise src \
  --config ../.claude/skills/onion-architecture/scripts/onion.depcruise.cjs \
  --ignore-known ../.claude/skills/onion-architecture/scripts/known-violations.json \
  --output-type err-long
```

- Exit code 0 means no new violations. On violations, the exit code is the number of `error`
  violations and `err-long` prints each rule's comment with the fix [T10].
- Known violations are hidden, and the output ends with "‼ N known violations ignored". Add
  `--no-ignore-known` to list them [T10].
- The config counts type-only imports (`tsPreCompilationDeps: true`), resolves
  `@devdigest/shared` through `tsconfig.json` and does not follow `node_modules` or
  `../reviewer-core`.

Run it after any change under `server/src/` and before reporting the task done. The check takes
seconds.

## Rules

| Rule | Protects | Typical fix |
|---|---|---|
| `shared-kernel-is-pure` | `src/vendor/shared` imports only itself and zod | move the code out of the contracts |
| `domain-is-pure` | `domain.ts`, `domain/**`, `ports.ts` stay free of I/O, Fastify, Drizzle, SDKs, `container` | pass data in; put I/O behind a port |
| `inner-rings-no-framework-or-db` | services, executors and helpers don't import Fastify, Drizzle, `src/db/**`, SDKs | repository port for data; parse in routes |
| `inner-rings-no-container` | services, executors and helpers don't import `platform/container.ts` | constructor `Deps` built in `routes.ts` |
| `routes-no-persistence` | routes don't import Drizzle, `src/db/**` or mappers | move the query to a repository, call a service |
| `adapters-only-via-composition-root` | only `container.ts`, `app.ts`, `server.ts` and adapters import `src/adapters/**` | depend on the port; add a container getter |
| `no-cross-module-internals` | a module imports only itself, `_shared`, `repo-intel/types.ts` | move shared code to `@devdigest/shared` or `_shared` |
| `adapters-not-into-core` | adapters don't import modules | move the constant or type inward |

The rules are written as `forbidden` with path regexes, and `$1` keeps cross-module matching
generic [T9]. Forbidden rules fit a codebase with a few risky import combinations. An `allowed`
allow-list is stricter [T11]; the skill doesn't use one yet (README, open question).

## Baseline policy

`scripts/known-violations.json` lists the 35 legacy violations that existed when the skill was
created (2026-10-21). New code is held to the rules, and old code is fixed when a task touches it
[T12].

- The baseline **only shrinks**. Never regenerate it to make a new violation pass.
- Fixed a legacy violation? Regenerate the baseline and check that `git diff` shows only removed
  entries:
  ```bash
  npx depcruise src --config ../.claude/skills/onion-architecture/scripts/onion.depcruise.cjs \
    --output-type baseline \
    --output-to ../.claude/skills/onion-architecture/scripts/known-violations.json
  ```
  The `--baseline` flag described in dependency-cruiser's current docs does not exist in 17.4.3
  (`error: unknown option '--baseline'`). Use `--output-type baseline --output-to <file>`.
- Entries for npm packages store the resolved pnpm path with its version
  (`node_modules/.pnpm/drizzle-orm@0.38.4_postgres@3.4.9/…`). After a dependency upgrade those
  entries stop matching and resurface as "new". Regenerate the baseline, and check in the diff
  that only version segments changed.

## What the checker cannot see

Review these by hand:
- Business rules inside routes or repositories (loops, branching on state, calculations).
- Rows passed through untyped values (`unknown`, `any`) or rebuilt object literals.
- Services that receive the container's members one by one when a narrow port would do.
- Route handlers that call a repository directly instead of the service.
- A port shaped like the SDK instead of the use case.
- Domain code in a file that isn't named `domain.ts`. `pulls/cost.ts` is pure, but the checker
  treats it as application code (the looser rule). Name new domain files `domain.ts` or
  `domain/<name>.ts`.

## Review checklist

```
- [ ] Every new or changed file is classified into one ring (layers-and-dependency-rule.md).
- [ ] Imports point inward, and depcruise exits 0 with the baseline.
- [ ] No Drizzle row, FastifyRequest/Reply or SDK type crosses into a service or the domain.
- [ ] The service takes a Deps object of ports, not the Container.
- [ ] Business rules are pure functions with unit tests and no mocks.
- [ ] External input is parsed by a Zod schema at the route or adapter edge.
- [ ] Errors are taxonomy errors; no numeric status outside platform/errors.ts and routes.
- [ ] Every repository query is scoped by workspaceId.
- [ ] The baseline did not grow.
```
