# onion-architecture — research notes and sources

Companion document for [SKILL.md](SKILL.md). It records how the skill was researched, which
architectural positions it takes and why, where the sources disagree, and every source the
rules cite.

## Contents
- Purpose and scope
- Skill layout
- Research method
- Architectural decisions
- Where the sources disagree
- Open questions
- Sources (O1–O16, T1–T15)
- Considered but not used
- Changelog

## Purpose and scope

The skill enforces **Onion Architecture** in the DevDigest backend (`server/`, including
`src/modules/repo-intel`) on the tools the backend uses: Fastify 5 with
`fastify-type-provider-zod`, Drizzle ORM on Postgres, Octokit, simple-git, the OpenAI and
Anthropic SDKs, ast-grep, dependency-cruiser, js-tiktoken, ripgrep, Vitest and Testcontainers.

"Enforce" means two things:
1. Rules an agent applies when it adds or reviews backend code.
2. A mechanical import check (dependency-cruiser) with a baseline that only shrinks.

Out of scope, because other skills cover it:
- `fastify-best-practices`: hooks, logging, security headers, performance.
- `drizzle-orm-patterns`: query syntax, relations, migrations workflow.
- `postgresql-table-design`: schema, types, indexes.
- `zod`: schema API.
- `security`: auth, injection, secrets.
- `reviewer-core/` internals: it is treated as an existing pure domain package.
- `client/`: see `frontend-architecture`.

## Skill layout

```
onion-architecture/
  SKILL.md                              # activation, vocabulary, where-does-it-go, core rules, workflow, DevDigest map
  README.md                             # this file
  rules/layers-and-dependency-rule.md   # rings, Dependency Rule, import matrix, boundaries, modules
  rules/domain-core.md                  # pure domain, contracts, domain errors
  rules/ports-and-adapters.md           # ports, one adapter per technology, driving adapters
  rules/application-services.md         # use cases, constructor injection, transactions, best-effort
  rules/persistence-drizzle.md          # repositories, mappers, workspace scoping, tx, migrations
  rules/http-fastify.md                 # routes as driving adapter, parse at the boundary, errors, encapsulation
  rules/composition-root.md             # container.ts, wiring a module, adding a dependency
  rules/testing.md                      # one test level per ring
  rules/enforcement.md                  # dependency-cruiser rules, baseline policy, review checklist
  scripts/onion.depcruise.cjs           # forbidden import rules
  scripts/known-violations.json         # legacy violations baseline (35 entries on 2026-10-21)
```

The layout follows `frontend-architecture` and Anthropic's skill-authoring guidance:
- SKILL.md is a short overview that links each rule file one level deep.
- Rule files are split by topic, so an agent loads only the one it needs.
- Every rule file starts with a table of contents.
- The vocabulary is fixed in SKILL.md.

## Research method

1. Read the server's own conventions first: root and `server/CLAUDE.md`,
   `server/docs/data-flow.md`, `server/INSIGHTS.md`. Then mapped every folder of `server/src`
   onto an onion ring and listed the places where the code departs from the rings.
2. Searched for primary sources on Onion and its siblings (Palermo, Cockburn, Martin, Graça,
   Fowler, Seemann), and for tool documentation (Fastify, Drizzle, fastify-type-provider-zod,
   dependency-cruiser, Zod, Testcontainers).
3. Fetched every cited page on 2026-10-21 to confirm the URL, author, date and the cited claim.
   One candidate returned 403 and was dropped (see "Considered but not used").
4. Wrote each rule only where a source or a documented repo convention supports it.
5. Ran the import rules against `server/src`, wrote the 35 existing violations to the baseline,
   then confirmed that a synthetic violation fails the check (exit 5) and that reverting it
   restores exit 0.

## Architectural decisions

| # | Decision | Rationale | Sources |
|---|---|---|---|
| D1 | **Onion vocabulary**, with Hexagonal and Clean treated as the same family | Palermo's tenets map directly onto the repo: shared contracts at the center, ports in the core, adapters outside | [O1] [O3] [O4] [O5] [O13] |
| D2 | **Modules are vertical slices with flat ring files** (`routes.ts → service.ts → repository.ts` plus `domain.ts`, `ports.ts`, `mappers.ts`), with no ring subfolders | Matches the documented naming conventions in root `CLAUDE.md`; domain-oriented modules that are layered internally | [O9] [O7] |
| D3 | **The domain ring is recognised by file name** (`domain.ts`, `domain/**`, `ports.ts`) | Makes the strictest rule mechanically checkable without guessing purity | [O3] |
| D4 | **Services take a narrow `Deps` object of ports**, never the `Container` | Explicit dependencies, container-free unit tests, checkable rule. Fowler tolerates a locator in-house; Seemann keeps the container at the root only | [O2] [O11] [O12] |
| D5 | **Keep the hand-written container**; no DI framework | Typed lazy getters plus `ContainerOverrides` already cover app scope and test injection; `@fastify/awilix` would add a second wiring style | [O12] [T6] |
| D6 | **`platform/errors.ts` is a shared kernel and the only error → status table** | Clean Architecture keeps HTTP out of the core; the repo's `AppError.statusCode` is a known deviation, contained in one file; services throw by meaning, never by number | [O5] [O13] |
| D7 | **Repositories implement core ports and map rows to domain types**; a route may construct its own repository only to inject it | "The database is not the center"; rows never cross inward | [O1] [O5] [O10] |
| D8 | **Transactions through a `TransactionRunner` port with an opaque `TxHandle`** | Keeps Drizzle out of services; typed handle instead of the `any` the source warns about | [T7] [T8] |
| D9 | **Parse at the edge with Zod**; Zod itself is allowed in the core | Contracts are domain types; a parsed value carries proof of validity | [O16] [T4] [T5] [T13] |
| D10 | **Enforce with dependency-cruiser `forbidden` rules and a shrinking baseline**; type-only imports count | The tool already ships with `server/`; module-by-module enforcement beats a big-bang refactor | [T9] [T10] [T11] [T12] |
| D11 | **No refactoring of legacy for its own sake**; touched files add no new violations | Onion pays off on long-lived, complex code; a rewrite would be unmanageable | [O1] [O15] [T12] |
| D12 | **Pure in-memory libraries (zod, graphology, p-queue) are not infrastructure** | They do no I/O; only I/O, network, native tooling and frameworks are banned from inner rings | [O3] |

## Where the sources disagree

| Topic | Positions | Skill's resolution |
|---|---|---|
| Service locator vs injection | Fowler: a locator is "not a big deal" inside one application, and the choice matters less than separating configuration from use [O11]. Seemann: only the composition root references the container [O12] | D4: injection for new services; legacy locators stay in the baseline |
| Where repository interfaces live | Palermo: the first ring around the domain model [O1]. Graça: the application layer, because the domain must not know about persistence [O6] | `modules/<m>/ports.ts`, between domain and service; both readings agree it is inside the core |
| How much layering | Goldberg: 3 tiers, and full clean architecture costs more than it returns for typical Node apps [O15]. Palermo: Onion is for long-lived business apps with complex behaviour, not small sites [O1] | D2 and D11: thin ring files inside each module; add `domain.ts`, `ports.ts` and `mappers.ts` only when needed |
| Naming | Microsoft treats Hexagonal, Ports-and-Adapters, Onion and Clean as one architecture [O13]. An open docs issue argues this misrepresents Clean Architecture [O14] | D1: use Onion's terms; cite Clean and Hexagonal for the shared rules only |
| Dependencies between outer rings | Palermo: code in the same outer ring may use each other directly (controller → `UserSession`) [O2]. Microsoft: UI and Infrastructure depend on the core, "not on one another (necessarily)" [O13] | Routes don't import adapters or Drizzle; the composition root is the one bridge |
| Test doubles vs real infrastructure | Wix: in-memory doubles, ~50× faster [T15]. Microsoft: integration-test infrastructure against its real dependencies [O13] | Both, per ring ([rules/testing.md](rules/testing.md)): fakes for services, Testcontainers for repositories |
| Errors and HTTP | Clean: no outer-ring knowledge in the core [O5]. Repo: `AppError` carries `statusCode` | D6 |

## Open questions

- Should the check move from `forbidden` to an `allowed` allow-list once the baseline is small?
  It is stricter and better suited to a clear architecture [T11].
- Should the check run from a `server` package script and a CI workflow? It is deliberately not
  wired yet; the skill runs it by command.
- `@ast-grep/napi` has no port (repo-intel imports `adapters/astgrep` functions). A
  `SymbolParser` port would clear 4 baseline entries.
- `DepGraph` and `Tokenizer` declare their interfaces in `src/adapters/`. Move them to the core
  when repo-intel is next refactored.

## Sources

Dates are publication dates (last-updated where the page shows one). All pages were fetched and
checked on 2026-10-21.

### Onion and related architectures
- **[O1]** Jeffrey Palermo — *The Onion Architecture: part 1*, 2008-07-29.
  https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/
  — concentric rings; "all coupling is toward the center"; repository interfaces in the ring
  around the domain model; "The database is not the center. It is external."; for long-lived
  apps with complex behaviour.
- **[O2]** Jeffrey Palermo — *The Onion Architecture: part 2*, 2008-07-30.
  https://jeffreypalermo.com/2008/07/the-onion-architecture-part-2/
  — the controller depends only on core interfaces; an IoC container injects implementations
  through the constructor; "all dependencies are toward the center".
- **[O3]** Jeffrey Palermo — *Onion Architecture: Part 4 – After Four Years*, 2013-08-19.
  https://jeffreypalermo.com/2013/08/onion-architecture-part-4-after-four-years/
  — the four tenets: independent object model; inner layers define interfaces, outer implement;
  coupling toward the center; core compiles and runs without infrastructure.
- **[O4]** Alistair Cockburn — *Hexagonal Architecture* (HaT Technical Report 2005.02),
  2005-09-04. https://alistair.cockburn.us/hexagonal-architecture/
  (index: https://alistaircockburn.com/Articles/Hexagonal-Architecture)
  — intent: driven equally by users, programs, tests or batch scripts, developed and tested in
  isolation from devices and databases; port = purposeful conversation; adapter = technology
  translation; in-memory DB through a secondary port.
- **[O5]** Robert C. Martin — *The Clean Architecture*, 2012-08-13.
  https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
  — the Dependency Rule ("source code dependencies can only point inwards"); simple data across
  boundaries; "don't cheat and pass Entities or Database rows".
- **[O6]** Herberto Graça — *Onion Architecture*, 2017-09-21 (updated 2017-11-18).
  https://herbertograca.com/2017/09/21/onion-architecture/
  — DIP at architectural level; outer layers may call any inner layer directly; repositories in
  the application layer (author's comment).
- **[O7]** Herberto Graça — *DDD, Hexagonal, Onion, Clean, CQRS, … How I put it all together*,
  2017-11-16 (updated 2020-03-20).
  https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together/
  — application vs domain layer; ports fit the core's needs, not the tool's API; primary/secondary
  adapters; components don't reference each other's internals.
- **[O8]** Khalil Stemmler — *Organizing App Logic with the Clean Architecture*, 2019-09-16.
  https://khalilstemmler.com/articles/software-design-architecture/organizing-app-logic/
  — six kinds of logic and their layers (presentation, infrastructure, use case, domain service,
  validation, entity).
- **[O9]** Martin Fowler — *Presentation Domain Data Layering*, 2015-08-26.
  https://martinfowler.com/bliki/PresentationDomainDataLayering.html
  — mapper between domain and data source inverts the dependency; "split your top level into
  domain oriented modules which are internally layered".
- **[O10]** Martin Fowler — *Repository* (Patterns of Enterprise Application Architecture).
  https://martinfowler.com/eaaCatalog/repository.html
  — "Mediates between the domain and data mapping layers using a collection-like interface for
  accessing domain objects."
- **[O11]** Martin Fowler — *Inversion of Control Containers and the Dependency Injection
  pattern*, 2004-01-23. https://martinfowler.com/articles/injection.html
  — constructor injection first; "separating service configuration from the use of services";
  a locator is acceptable inside one application.
- **[O12]** Mark Seemann — *Composition Root*, 2011-07-28.
  https://blog.ploeh.dk/2011/07/28/CompositionRoot/
  — a unique location close to the entry point where modules are composed; only applications
  have one; the container is referenced only there.
- **[O13]** Microsoft (Steve Smith) — *Common web application architectures* (.NET architecture
  e-book), 2021-12-12, updated 2026-07-08.
  https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures
  — Application Core / Infrastructure / UI; interfaces in the core, implementations in
  infrastructure; UI and infrastructure don't depend on each other; composition root; unit
  tests for the core, integration tests for infrastructure.
- **[O14]** GitHub issue — *Feedback on the Common web application architectures article*,
  opened 2024-09-23, open. https://github.com/dotnet/docs/issues/42689 (redirects to
  dotnet/AspNetCore.Docs #33840)
  — argues the article blurs Clean Architecture with Onion/Hexagonal.
- **[O15]** Yoni Goldberg et al. — *Node.js Best Practices*, §1.2 "Layer your app, keep Express
  within its boundaries".
  https://github.com/goldbergyoni/nodebestpractices/blob/master/sections/projectstructre/createlayers.md
  — entry-points / domain / data-access; domain takes and returns protocol-agnostic plain
  objects; repository returns plain objects; prefers 3 tiers over full clean architecture.
- **[O16]** Alexis King — *Parse, don't validate*, 2019-11-05.
  https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/
  — parse "at the boundary of your system, before any of the data is acted upon"; shotgun
  parsing as an antipattern.

### Tools in this stack
- **[T1]** Fastify docs — *Plugins Guide*. https://fastify.dev/docs/latest/Guides/Plugins-Guide/
  — `register` creates a context; decorators scoped to a plugin; `fastify-plugin` removes the
  boundary; plugins load in declaration order.
- **[T2]** Fastify docs — *Encapsulation* (v5). https://fastify.dev/docs/latest/Reference/Encapsulation/
  — children inherit from parents, not the reverse; root registrations reach every context.
- **[T3]** Fastify docs — *Testing*. https://fastify.dev/docs/latest/Guides/Testing/
  — separate `build()` from `listen()`; `app.inject()` for HTTP tests.
- **[T4]** Fastify docs — *Type Providers*. https://fastify.dev/docs/latest/Reference/Type-Providers/
  — infer handler types from schemas; Zod supported; providers don't propagate across
  encapsulated plugins, call `withTypeProvider` per scope.
- **[T5]** `fastify-type-provider-zod` README. https://github.com/turkerdev/fastify-type-provider-zod
  — `validatorCompiler` / `serializerCompiler`, `withTypeProvider<ZodTypeProvider>()`; Zod 3 →
  4.x, Zod 4 → 5.x–6.x, Zod 4.2+ → 7.x.
- **[T6]** `@fastify/awilix` README. https://github.com/fastify/fastify-awilix
  — app-level `diContainer`, request-scoped `diScope`, disposal hooks. Considered, not adopted (D5).
- **[T7]** Drizzle docs — *Transactions*. https://orm.drizzle.team/docs/transactions
  — `db.transaction(async (tx) => …)`, return values, `tx.rollback()` throws, nested savepoints,
  Postgres `isolationLevel` / `accessMode` / `deferrable`.
- **[T8]** Lazar Nikolov (Sentry) — *Atomic Repositories in Clean Architecture and TypeScript*,
  2024-10-03. https://blog.sentry.io/atomic-repositories-in-clean-architecture-and-typescript/
  — transaction-manager interface in the application layer, Drizzle implementation in
  infrastructure, repositories run on `tx ?? db`.
- **[T9]** dependency-cruiser — *Rules reference*.
  https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md
  — `forbidden` rules with `from`/`to`, `path`/`pathNot`, `$1` group matching; `allowed` rules.
- **[T10]** dependency-cruiser — *Command line interface*.
  https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md
  — `--ignore-known`, `err` / `err-long` exit codes, `--ts-pre-compilation-deps`. The `--baseline`
  flag on the main-branch docs is newer than the installed 17.4.3; see rules/enforcement.md.
- **[T11]** Jonathan Chaffer (Atomic Object) — *Dependency Cruiser: Restrict Imports in
  JavaScript*, 2024-10-24. https://spin.atomicobject.com/dependency-cruiser-imports/
  — forbidden vs allowed rules and when each fits.
- **[T12]** Antonino Gitto, Timothy Russo (lastminute.com) — *How We Enforce Architecture
  Boundaries at Scale on our App*, 2026-04-13.
  https://technology.lastminute.com/how-we-enforce-architecture-boundaries-at-scale-on-our-app/
  — dependency-cruiser in CI, domain/data/ui boundaries, opt-in per-module rollout instead of a
  big-bang PR.
- **[T13]** Zod docs — *Basic usage*. https://zod.dev/basics
  — `.parse` returns a typed value or throws `ZodError`; `.safeParse`; `z.infer`.
- **[T14]** Testcontainers for Node.js. https://node.testcontainers.org/
  — throwaway database instances for tests; PostgreSQL module.
- **[T15]** Natan Silnitsky (Wix Engineering) — *50x Faster and 100x Happier: How Wix Reinvented
  Integration Testing*, 2025-04-21.
  https://wix.engineering/post/50x-faster-and-100x-happier-how-wix-reinvented-integration-testing
  — hexagonal ports enable in-memory test adapters; contract tests keep them faithful to the
  real infrastructure.

## Considered but not used

- DZone — *Testing repository adapters with hexagonal architecture*: returned HTTP 403 on
  2026-10-21; claims couldn't be verified.
- `fastify-decorators`, `@tsclean/core`: decorator/framework DI; same reason as D5.
- `@setu-ts/database-plugin` (repository + unit-of-work adapters for Drizzle): an extra
  dependency for a pattern that takes ~20 lines here.

## Changelog

- **1.0.0** (2026-10-21): first version. 9 rule files, 8 import rules, baseline of 35 legacy
  violations.
