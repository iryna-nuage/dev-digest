# Testing by ring

Source ids like `[O1]` refer to [../README.md](../README.md). Suite layout and commands →
`TESTING.md`; naming → root `CLAUDE.md`.

## Contents
- Why rings make testing cheap
- One test level per ring
- Fakes for ports
- Integration and HTTP tests
- Gotchas in this repo

## Why rings make testing cheap

Because the core does not depend on infrastructure, it can be unit-tested in isolation, and
infrastructure gets integration tests against the real dependency [O13]. A port lets a test
harness drive the application, and an in-memory double can stand in for the database [O4].
In-memory doubles run much faster than Docker-backed tests, but they need contract checks
against the real adapter to stay faithful [T15].

## One test level per ring

| Ring | Test | Dependencies | DevDigest example |
|---|---|---|---|
| Domain | unit, `test/<area>.test.ts` | none, no mocks | `test/pulls-cost.test.ts`, `test/pulls-status.test.ts` |
| Application service | unit, `test/<area>.test.ts` | fakes or mocks of its ports | services built with `MockGitHubClient`, an in-memory store |
| Repository (driven adapter) | integration, `test/<area>.it.test.ts` | real Postgres via Testcontainers (`test/helpers/pg.ts`) [T14] | `test/agents-versions.it.test.ts` |
| Other driven adapters | unit on the mapping (recorded payloads), no network | SDK stubbed at its edge | `test/adapters.test.ts` (mock contracts, pricing), `test/astgrep.test.ts` |
| Routes (driving adapter) | `buildApp({ db, overrides })` + `app.inject()` [T3] | real DB or overrides | `test/reviews.it.test.ts`, `test/routes-smoke.test.ts` |

- Put each assertion on the lowest ring that owns the behaviour. A COST rule is asserted in the
  domain test, not through `GET /repos/:id/pulls`.
- An `.it.test.ts` file proves SQL, mapping and workspace scoping. It does not re-test domain
  rules.

## Fakes for ports

- Existing doubles: `src/adapters/mocks.ts` (`MockLLMProvider`, `MockGitHubClient`,
  `MockGitClient`, `MockCodeIndex`, `MockAuthProvider`, `MockSecretsProvider`, `MockEmbedder`).
- A new port gets its double there, or an in-memory class beside the test when only one test
  file uses it.
- Service tests construct the service with a `Deps` object of doubles. They need no container,
  no Fastify and no DB. This is why services take narrow deps
  ([application-services.md](application-services.md)).
- Optional contract test: one `describe` block run against both the in-memory store and the real
  repository (in the `.it` file), so the fake can't drift [T15].

## Integration and HTTP tests

- `buildApp()` is separate from `listen()` (`src/app.ts` vs `src/server.ts`), so tests drive HTTP
  with `app.inject()` and no port [T3].
- Inject adapters through `overrides` (`ContainerOverrides`). Every LLM provider an enabled agent
  can use must be overridden.

## Gotchas in this repo

- `server/.env` keys reach tests: an un-mocked `openrouter` provider calls the real API. Always
  pass `overrides.llm.openrouter` when seeded agents can run (`server/INSIGHTS.md`).
- When Docker hangs, `*.it.test.ts` files report "skipped", not failed. Never count skipped `.it`
  files as coverage (`server/INSIGHTS.md`).
- On Windows, `test/indexer-pipeline.test.ts` fails with ENOENT because of its own helper, not
  because of your change (`server/INSIGHTS.md`).
