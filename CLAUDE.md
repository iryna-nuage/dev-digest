# DevDigest — agent guide

Local-first AI PR reviewer. Course starter: Part-0 works end to end; each lesson adds one feature.

## Before answering
Search the relevant package's `docs/`, `specs/` and `INSIGHTS.md` first — they are curated
and may already answer the question — then read code.

## Conventions (not obvious from code)
- Not a monorepo workspace: each package has its own `package.json`/lockfile; cross-package
  code is shared via tsconfig path aliases to raw `.ts`.
- `server/` and `client/` use pnpm; `reviewer-core/` and `e2e/` use npm.
- `server/`, `reviewer-core/` and `e2e/` are ESM: relative imports carry the `.js` extension.
- `@devdigest/shared` exists twice: `server/src/vendor/shared` (source) and
  `client/src/vendor/shared` (manual copy) — a contract change must land in both.

## Do-not-touch
- `server/src/vendor/shared/` and `server/src/db/migrations/` — never hand-edit without
  coordination; rules in `server/CLAUDE.md`.

## Use when
- Stack, commands, architecture, how to run → read `README.md`
- Test layout, unit/integration split → read `TESTING.md`
- Working inside a package → read that package's CLAUDE.md: `server/CLAUDE.md`,
  `client/CLAUDE.md`, `reviewer-core/CLAUDE.md`, `e2e/CLAUDE.md`
- Agent prompt templates → read `docs/agent-prompts/`
