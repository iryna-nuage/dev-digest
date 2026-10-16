# DevDigest — agent guide

Local-first AI PR reviewer. Course starter: Part-0 works end to end; each lesson adds one feature.

## Before answering
Search the relevant package's `docs/`, `specs/` and `INSIGHTS.md` first — they are curated
and may already answer the question — then read code.

## Insights loop (mandatory)
Each package keeps non-obvious findings in its `INSIGHTS.md` (`server/` also covers repo-intel).
- Before acting on a request: invoke the `engineering-insights` skill and read the
  `INSIGHTS.md` of every package the request touches or asks about. Treat entries as
  high-confidence guidance; verify one cheaply before relying on it for a decision.
- When work uncovers something substantive and new, and at the end of every non-trivial
  task before reporting it done: append it via the skill, after re-reading the file —
  already there → don't write. Nothing substantive → write nothing.

## Structure
Four standalone packages (no monorepo workspace) plus repo tooling:
- `client/` — `@devdigest/web`: the web studio (PR list, PR review, agents, settings), port 3000.
- `server/` — `@devdigest/api`: REST API, Postgres persistence, GitHub import, review runs,
  port 3001. Also hosts `src/modules/repo-intel/` (codebase indexer → repo map) and
  `src/vendor/shared/` (`@devdigest/shared`, the Zod contracts every package uses).
- `reviewer-core/` — `@devdigest/reviewer-core`: pure review engine (diff → prompt → LLM →
  grounded findings), no DB/FS/network I/O; the server imports it as raw TS.
- `e2e/` — `@devdigest/e2e`: deterministic browser flows (`specs/*.flow.json`) on a seeded stack.
- `scripts/` — `dev.sh` (bring up the local stack), `e2e.sh` (hermetic e2e run).
- `docs/` — cross-package docs: `agent-prompts/` (reviewer prompt templates), lesson reports.
- `.github/workflows/` — one CI workflow per test suite; `.claude/skills/` — project skills.

## Stack
TypeScript in every package; Node ≥ 22, pnpm ≥ 10, Docker (Postgres only).
- client: Next.js 15 (App Router) + React 19, TanStack Query, next-intl, vendored
  `@devdigest/ui` (CSS variables, Tailwind 4 via PostCSS); tests: Vitest + React Testing
  Library + jsdom.
- server: Fastify 5 (ESM) + `fastify-type-provider-zod`, Drizzle ORM + `postgres` driver on
  Postgres 16 + pgvector; Octokit, simple-git; LLM SDKs `openai` / `@anthropic-ai/sdk`;
  repo-intel: `@ast-grep/napi`, dependency-cruiser, graphology; tests: Vitest + Testcontainers.
- reviewer-core: TypeScript library (ESM), Zod, `openai` SDK (OpenRouter client); tests: Vitest.
- e2e: `tsx run.ts` driving the Vercel agent-browser CLI (installed globally).

## Commands
`./scripts/*` and `docker compose` run from the repo root, package scripts from that package's
directory; full setup, flags and troubleshooting in `README.md`.
- Run everything: `./scripts/dev.sh` — Postgres (Docker) → migrate → seed → API :3001 + web
  :3000 (`--no-seed`, `--no-client`, `--db-only`).
- Manual: `docker compose up -d`; `cd server && pnpm install && pnpm db:migrate && pnpm db:seed
  && pnpm dev`; `cd client && pnpm install && pnpm dev`. Migrations never run on boot; on
  Windows `pnpm db:migrate` can exit silently (see `server/INSIGHTS.md`).

Verify (suite map and strategy: `TESTING.md`):

| Package | Tests | Typecheck |
|---|---|---|
| client | `pnpm test` | `pnpm typecheck` |
| server | unit `pnpm exec vitest run --exclude '**/*.it.test.ts'` · integration (Docker) `pnpm exec vitest run .it.test` · both `pnpm test` | `pnpm typecheck` |
| reviewer-core | `npm test` | `npm run typecheck` |
| e2e | `npm test` (needs the running seeded stack) or `npm run e2e:hermetic` (Docker) | `npm run typecheck` |

Lint: no linter is configured — no `lint` script, no ESLint/Biome config, no lint step in CI.

## Naming conventions
- Packages `@devdigest/<name>`; cross-package code only via tsconfig aliases
  (`@devdigest/shared`, `@devdigest/ui`, `@devdigest/reviewer-core`).
- Files: kebab-case in server, reviewer-core and e2e (`run-executor.ts`, `to-review.ts`);
  React components PascalCase.
- client: route-local components in `_components/<PascalCase>/` → `<PascalCase>.tsx`,
  `index.ts`, optional `styles.ts` / `constants.ts` / `helpers.ts`, colocated
  `<PascalCase>.test.tsx`; shared components in `src/components/<kebab-case>/`; hooks
  `useXxx` in `src/lib/hooks/<area>.ts`; i18n namespaces `messages/en/<camelCase>.json`.
- server: one folder per feature `src/modules/<kebab-case>/` with `routes.ts` → `service.ts` →
  `repository.ts` (or `repository/<entity>.repo.ts`).
- Tests: server `test/<area>[-<topic>].test.ts`, DB-backed ones must end in `.it.test.ts`;
  reviewer-core `test/<name>.test.ts`; client colocated `*.test.ts(x)`.
- Migrations `server/src/db/migrations/NNNN_<name>.sql` — produced by `pnpm db:generate`, never by hand.
- e2e flows `e2e/specs/NN-<kebab-name>.flow.json`; feature specs `<package>/specs/L<NN>-<feature>.md`;
  CI workflows `.github/workflows/<suite>.yml`.

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
- Lock files — `client/pnpm-lock.yaml`, `server/pnpm-lock.yaml`,
  `reviewer-core/package-lock.json`, `e2e/package-lock.json`, and the root `skills-lock.json`
  (installed agent skills): never hand-edit. Change dependencies only through the package's
  own manager (`pnpm add`/`remove` in client and server, `npm install`/`uninstall` in
  reviewer-core and e2e) and commit the regenerated lock file with its `package.json`.

## Use when
- Architecture diagram, full setup, script flags, troubleshooting → read `README.md`
- Test layout, unit/integration split → read `TESTING.md`
- Working inside a package → read that package's CLAUDE.md: `server/CLAUDE.md`,
  `client/CLAUDE.md`, `reviewer-core/CLAUDE.md`, `e2e/CLAUDE.md`
- Agent prompt templates → read `docs/agent-prompts/`
