# Ports and adapters

Source ids like `[O1]` refer to [../README.md](../README.md).

## Contents
- Definitions
- Where a port lives
- Designing a port
- One adapter per technology
- Writing an adapter
- Driving adapters
- Adding an external integration

## Definitions

- **Port**: an interface owned by the core, named for the purpose of the conversation, not for
  the tool behind it [O4] [O7].
- **Driven (secondary) adapter**: implements a port with a concrete technology (Octokit, Drizzle,
  OpenAI) and is injected wherever the core needs it [O7].
- **Driving (primary) adapter**: turns an outside trigger (HTTP request, job, SSE subscription)
  into a call on the core [O7].
- Goal: the application can be driven by users, programs, automated tests or batch scripts, and
  developed and tested apart from its run-time devices and databases [O4].

## Where a port lives

| Port used by | Put it in |
|---|---|
| server and reviewer-core, or server and client | `src/vendor/shared/adapters.ts` (mirror in `client/src/vendor/shared` only if the client uses it) |
| several server modules | `src/vendor/shared/adapters.ts`, or a facade type file such as `repo-intel/types.ts` |
| one module (its repository, a module-only client) | `modules/<m>/ports.ts` |

Inner layers define the interface and outer layers implement it [O3]. Legacy: `DepGraph`
(`adapters/depgraph/index.ts`) and `Tokenizer` (`adapters/tokenizer/index.ts`) declare their
interface next to the implementation. New ports never do that.

## Designing a port

- Shape it to the core's need, not to the SDK's API [O7]. `GitHubClient.listPullRequests(repo)`
  returns `PrMeta[]` from `@devdigest/shared`, not Octokit's response type.
- A concrete outer-ring class with no port yet (`JobRunner` in `platform/jobs.ts`) gets a narrow
  port in the consuming module's `ports.ts`. The class satisfies it structurally, so nothing in
  `platform/` has to change.
- Inputs and outputs are `@devdigest/shared` types or primitives. No SDK, Drizzle or Fastify types
  appear in a port signature.
- Keep ports small. Split by use (`AgentStore` for reads and writes of agents) rather than one
  god interface.
- Failure is part of the contract: document which taxonomy error the adapter throws
  (`ExternalServiceError`, `ConfigError`) and whether the caller may degrade.

## One adapter per technology

| Technology | Port | Adapter |
|---|---|---|
| Octokit | `GitHubClient` | `src/adapters/github/octokit.ts` |
| simple-git | `GitClient` | `src/adapters/git/simple-git.ts` |
| openai SDK | `LLMProvider`, `Embedder` | `src/adapters/llm/openai.ts`, `src/adapters/embedder/openai.ts` |
| @anthropic-ai/sdk | `LLMProvider` | `src/adapters/llm/anthropic.ts` |
| OpenRouter (openai SDK) | `LLMProvider` | `OpenRouterProvider` in `@devdigest/reviewer-core` |
| @vscode/ripgrep | `CodeIndex` | `src/adapters/codeindex/ripgrep.ts` |
| dependency-cruiser | `DepGraph` | `src/adapters/depgraph/index.ts` |
| js-tiktoken | `Tokenizer` | `src/adapters/tokenizer/index.ts` |
| @ast-grep/napi | none yet (legacy: functions imported by `repo-intel`) | `src/adapters/astgrep/index.ts` |
| Drizzle + postgres | repository interfaces | `modules/<m>/repository.ts` ([persistence-drizzle.md](persistence-drizzle.md)) |
| local files, no-auth | `SecretsProvider`, `AuthProvider` | `src/adapters/secrets/local.ts`, `src/adapters/auth/local.ts` |

Each port also has a test double in `src/adapters/mocks.ts` (`MockLLMProvider`,
`MockGitHubClient`, `MockGitClient`, …).

## Writing an adapter

- Translate both ways: domain input → SDK call → SDK response → port output. SDK types never leak
  past the adapter.
- Map SDK and network failures to taxonomy errors (`ExternalServiceError`, `ConfigError` for a
  missing key) so services can decide whether to degrade.
- No business decisions. "Skip PRs older than X" belongs to the domain. Retries, timeouts and rate
  limits belong to the adapter or to `platform/resilience.ts`.
- An adapter never imports a module (`adapters-not-into-core`). If it needs a constant that a
  module owns (`repo-intel/constants.ts` today, legacy), move the constant to
  `@devdigest/shared` or into the adapter.
- Only the composition root constructs an adapter (`adapters-only-via-composition-root`).

## Driving adapters

- `routes.ts` handlers ([http-fastify.md](http-fastify.md)).
- Job handlers registered with `container.jobs.register(kind, handler)`. The handler parses its
  payload and calls a service method. It holds no logic of its own.
- SSE streams (`runBus`) deliver events. They don't decide anything.

## Adding an external integration

```
- [ ] 1. Write the port: in vendor/shared/adapters.ts or modules/<m>/ports.ts, in domain terms.
- [ ] 2. Write the adapter: src/adapters/<tech>/<impl>.ts implements the port and maps errors.
- [ ] 3. Write the test double in src/adapters/mocks.ts.
- [ ] 4. Wire it: a lazy getter in platform/container.ts plus a ContainerOverrides field.
- [ ] 5. Inject it: the module's routes.ts passes container.<port> to the service constructor.
- [ ] 6. Test it: a service test with the mock, an adapter test only for the mapping.
```
