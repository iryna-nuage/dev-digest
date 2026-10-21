# Composition root

Source ids like `[O1]` refer to [../README.md](../README.md).

## Contents
- One place that knows concrete classes
- What lives in the container
- Wiring a module's service
- Adding a dependency
- What not to do

## One place that knows concrete classes

- A composition root is a (preferably) unique location, as close to the entry point as possible,
  where modules are composed together. Only applications have one, and the container is
  referenced only from there [O12].
- Separate the configuration of services from their use [O11]. Wiring implementation types to
  interfaces at startup is the composition root's job [O13].
- In DevDigest the root is `platform/container.ts` (`Container`, `ContainerOverrides`) plus
  `buildApp` in `app.ts`, which creates the container and registers modules from
  `modules/index.ts`.

## What lives in the container

- Config, `db`, `secrets`, `auth`, `jobs` (`JobRunner`), `runBus`.
- Lazy adapter getters: `git`, `codeIndex`, `depgraph`, `tokenizer`, `priceBook`, async
  `github()`, `llm(provider)`, `embedder()`. Adapters that need a secret are async and cached;
  `invalidateSecretCaches()` drops them after a key changes.
- Repositories for cross-cutting entities (`agentsRepo`, `reviewRepo`) and facades
  (`repoIntel`). They are built here so modules don't reach into each other's folders.
- Every getter honours `ContainerOverrides`, which is how tests inject doubles.

## Wiring a module's service

A module's `routes.ts` is its entry point, so it is where the module's service is assembled
from the container (Fastify registers it with `app.container` decorated by `buildApp`):

```ts
export default async function notesRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const service = new NotesService({
    notes: new NotesRepository(container.db),   // module-owned repository: built here
    github: () => container.github(),           // adapter: from the container, lazily
    jobs: container.jobs,
  });
  …
}
```

- A repository used by one module may be constructed in that module's routes. A repository used
  by two or more modules gets a getter in the container.
- The service file never sees `Container` (rule `inner-rings-no-container`).
- Job handlers registered in the plugin call the same `service` instance.

## Adding a dependency

```
- [ ] 1. Port (interface) in the core: vendor/shared/adapters.ts or modules/<m>/ports.ts.
- [ ] 2. Adapter in src/adapters/<tech>/.
- [ ] 3. Container: a private field, a lazy getter that returns the override if one is set,
         and a field in ContainerOverrides.
- [ ] 4. Test double in src/adapters/mocks.ts.
- [ ] 5. Inject it into the service from routes.ts.
```

## What not to do

- Don't pass `container` or `app` into a service, a domain function or an adapter.
- Don't import `platform/container.ts` from a service, executor or helper. `import type` counts.
- Don't construct an adapter outside the container (`adapters-only-via-composition-root`).
- Don't adopt a DI framework. `@fastify/awilix` offers app and request scopes [T6], but the
  hand-written container already gives typed lazy getters and test overrides (README, decision
  D5).
- Don't register modules by filesystem autoload. `modules/index.ts` is static on purpose.
