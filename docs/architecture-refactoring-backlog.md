# Architecture & refactoring backlog

A project-wide audit of DevDigest against the repo's skills, with a prioritized refactoring
backlog. The first section records the small subset implemented in this iteration. Everything
after it is the open backlog.

- **Date:** 2026-10-21
- **Skills applied:**
  - `frontend-architecture` (`.claude/skills/frontend-architecture/`)
  - `react-best-practices`, `next-best-practices`, `react-testing-library`
  - `fastify-best-practices`, `drizzle-orm-patterns`, `postgresql-table-design`
  - `zod`, `security`, `typescript-expert`
- **Precedence:** project conventions override skill defaults (the `frontend-architecture`
  precedence rule). Deliberate conventions are not reported as findings: per-component
  `index.ts`, the documented hooks barrel `client/src/lib/hooks/index.ts`, and client-side
  fetching through `src/lib/api.ts`.
- **Method:**
  - Three read-only audits: client · server (incl. repo-intel) · reviewer-core / e2e / CI / tooling.
  - The known items from every package's `INSIGHTS.md` were re-checked.
  - Items marked ✔ were re-verified by reading the code.
  - Line numbers are as of the audit date; re-read each `Where` before starting a fix.

**Legend**
- **Severity:** H (high) / M (medium) / L (low).
- **Status:** `open` · `partial` (first step done) · `done`.
- **Skill tags:**
  - `[FA:<rule>]` frontend-architecture rule file
  - `[RBP]` react-best-practices · `[NBP]` next-best-practices · `[RTL]` react-testing-library
  - `[FST]` fastify · `[DRZ]` drizzle · `[PG]` postgresql
  - `[ZOD]` · `[SEC]` security · `[TS]` typescript-expert

## Contents
- Implemented in this iteration
- 1. Frontend-architecture findings (client)
- 2. Client: React / Next.js / testing
- 3. Server
- 4. reviewer-core
- 5. e2e, CI, tooling, cross-package
- Open decisions
- Proposed phases
- Considered and deliberately not done now

---

## Implemented in this iteration

Chosen because each has a clear benefit, is low-risk, touches few files, doesn't change
behavior, and can be checked with focused tests.

| ID | Change | Why | Files | Backlog item → status |
|---|---|---|---|---|
| I-1 | PR-list filtering, sorting and the open / needs-review counts moved from the page into pure helpers (`filterPulls`, `sortPulls`, `countOpen`, `countNeedsReview`). `OPEN_STATUSES` moved into the route's `constants.ts`. The misleading header comment fixed | [FA:business-logic] business rules are pure domain code · [FA:nextjs-architecture] thin `page.tsx` · [FA:constants-and-config] | `client/src/app/repos/[repoId]/pulls/{page.tsx,helpers.ts,constants.ts}`, new `helpers.test.ts` | §1 A2 → `partial` (helpers done; thin server page is still decision 1) |
| I-2 | RunHistory's outcome rule (`outcomeOf`, `Outcome`) and `tsOf` moved verbatim into a colocated `helpers.ts` | [FA:business-logic] · [FA:component-boundaries] folder anatomy (`helpers.ts` beside the component) | `…/[number]/_components/RunHistory/{RunHistory.tsx,helpers.ts}`, new `helpers.test.ts` | §1 A4 → `partial` (rule extracted; component split still open) |
| I-3 | `rangeIntersects` in grounding now loops over the hunk line set instead of the model-supplied `start..end` range. Same result for every input, but O(hunk lines) instead of O(range) | [SEC] untrusted model output · [ZOD] never trust model output: a range like `-2e9..2e9` blocked the event loop | `reviewer-core/src/grounding.ts`, new `reviewer-core/test/grounding.test.ts` | §4 RC-1 → `partial` (loop fixed; schema bounds / wide-range policy still open) |

Verification results are in the final report for this iteration. Scope: focused unit tests,
then the client, reviewer-core and server unit suites, then type checks.

---

## 1. Frontend-architecture findings (client)

DevDigest mapping:

| Skill term | DevDigest location |
|---|---|
| route-local | `_components/` |
| shared | `src/components/` |
| API layer | `src/lib/api.ts` + `src/lib/hooks/*` |
| data model | HTTP-API (all fetching in the browser) |

| ID | Sev | Rule | Finding | Where | Fix direction | Status |
|---|---|---|---|---|---|---|
| A1 | **H** | FA:constants-and-config | UI copy written inline instead of in next-intl catalogs (also breaks `client/CLAUDE.md`). Hand-made plurals | `FindingsTab.tsx`, `PrDetailHeader.tsx`, `ReviewRunAccordion.tsx:97-98`, `AddRepoView.tsx`, `DiffTab.tsx:60,65`, `app/page.tsx`, `agents/[id]/page.tsx`, `app-shell/helpers.ts:12` | Move to namespaces with ICU plurals; new `addRepo` namespace | open |
| A2 | M | FA:business-logic, FA:nextjs-architecture | PR-list filter, sort and counts inline in the page; `needs_review` count duplicated in the shell | `pulls/page.tsx`, `useShellContext.ts:75` | Pure helpers + tests; thin page | **partial (I-1)** |
| A3 | M | FA:state-and-server-data | Query keys repeated as string literals; the page invalidates queries itself | `[number]/page.tsx:44-58`, `lib/hooks/{reviews,core}.ts` | `lib/hooks/keys.ts` key factory; `useRunSettled(prId)` hook | open |
| A4 | M | FA:business-logic, FA:component-boundaries | RunHistory: 249 lines holding the outcome rule, timestamp helper, style objects and two row layouts | `RunHistory.tsx` | `helpers.ts` (+tests), `styles.ts`, `_components/{RunRow,CommitRow}`, `index.ts` | **partial (I-2)** |
| A5 | M | FA:component-boundaries | Same concept defined several times, and the copies drift: verdict colors (`--warn` vs `--info`), `SEV_COLOR` vs `@devdigest/ui` `SEV`, PR status colors, `PROVIDER_OPTIONS` ×2, `lineLabel` ×2 | `ReviewRunAccordion.tsx:15-19`, `VerdictBanner/constants.ts`, `FindingCard/constants.ts`, `PrDetailHeader.tsx:31-36`, `ConfigTab/constants`, `CreateAgentModal/constants` | One source per concept at the lowest common ancestor | open |
| A6 | M | FA:constants-and-config | Runtime values can't be imported from `@devdigest/shared` (webpack can't resolve the `.js` re-exports), so constants are mirrored and responses are cast with `as T` | `lib/feature-models.ts:4-11`, `api.ts:62` | `resolve.extensionAlias {'.js':['.ts','.js']}` in `next.config`, then remove the copies | open |
| A7 | M | FA:business-logic | **H ✔** Blocker count computed in the view, so it can disagree with the server's `run.blockers` (which respects `ci_fail_on`) | `ReviewRunAccordion.tsx:56` vs `RunHistory.tsx` | Use the server value, or one tested domain helper | open |
| A8 | M | FA:state-and-server-data | Query data copied into 9 `useState`s plus a reset effect | `ConfigTab.tsx:18-39` | `key={agent.id}` remount + a draft held in `useReducer` | open |
| A9 | M | FA:module-boundaries | A component imports a sibling component's internal helpers | `FindingsTab.tsx:6,8` (`../FindingsPanel/helpers`) | Import via the sibling's `index.ts`, or promote the helper | open |
| A10 | M | (contracts) | Contract types redefined by hand (breaks `client/CLAUDE.md`) | `lib/hooks/reviews.ts:99-105` (= `PrCommentInput`), `RunTraceDrawer/helpers.ts:4` (= `RunEvent`), `ActiveRun`, `CreateAgentInput` | Import from `@devdigest/shared`; add any missing ones to both vendored copies | open |
| A11 | L | FA:state-and-server-data | The page comment said search and sort live in the URL; they are `useState` and are lost on reload | `pulls/page.tsx` | Comment fixed in I-1; moving them to `searchParams` is still open | partial |
| A12 | L | FA:state-and-server-data | The GitHub-syncing `usePulls` poll runs on every page, because AppShell uses it for the badge | `useShellContext.ts:28` | Lightweight counts hook/endpoint (pairs with B-5) | open |
| A13 | L | FA:module-boundaries | 26 files use relative imports 4–7 levels deep; 16 use `@/` | client-wide | Use `@/` for imports that cross areas | open |
| A14 | L | FA:project-structure | Speculative or dead shared code: `components/mermaid-diagram` (0 consumers), `PrRowView`, `useRepoIntelStatus` / `useResyncRepoIntel` | `src/components/mermaid-diagram`, `lib/types.ts:38`, `lib/hooks/repo-intel.ts` | Delete, unless a later lesson needs it (decision 5) | open |
| A15 | L | FA:helpers-and-utils | `lib/hooks/reviews.ts` (216 lines) mixes runs, reviews, findings, PR comments and SSE | `lib/hooks/reviews.ts` | Split into `runs.ts` + `pr-comments.ts`; the barrel stays as is | open |

**Already done well:**
- No cross-route `_components` imports, and no shared → route imports.
- `api.ts` is the only `fetch`; hooks own the invalidation.
- Most components follow the folder anatomy; `/agents` and `/settings` have thin server entry pages.

## 2. Client: React / Next.js / testing

| ID | Sev | Finding | Where | Fix | Skill | Status |
|---|---|---|---|---|---|---|
| C-1 | **H ✔** | j/k/a/d shortcuts use one `window` listener per mounted panel, so `a`/`d` acts on every open run. There is no modifier or `g`-prefix check (`g a`, Ctrl+A accept a finding) | `FindingsPanel.tsx:49-61` | Scope to the focused panel, ignore modifier keys; test with two panels mounted | RBP | open |
| C-2 | **H ✔** | Errors toast twice: the global `MutationCache.onError` plus a local `notify.error` or inline error | `providers.tsx:41-43`, `DiffTab.tsx:37`, `AddRepoView.tsx:37`, `SettingsApiKeys.tsx:48` | `meta: { silent: true }`, checked in the cache handler | RBP | open |
| C-3 | M ✔ | Trace drawer never receives `running`, so its live-log branch is dead code | `[number]/page.tsx:175-181`, `RunTraceDrawer.tsx:41-64` | `running={liveRunIds.includes(traceRunId)}` | RBP | open |
| C-4 | M | `onDone` fires on every re-render after a run ends; EventSource closes on any transient error | `RunStatus.tsx:23-26`, `lib/hooks/reviews.ts:200-204` | Fire once, on the terminal event; let EventSource reconnect | RBP | open |
| C-5 | M | An effect driven by a `targetNonce` prop with eslint-disable (an event modeled as an effect) | `ReviewRunAccordion.tsx:47-53` | Handle in the click handler with controlled open state | RBP | open |
| C-6 | M | Index keys on stateful items | `DiffViewer.tsx:28`, `FileCard.tsx:83` | `key={f.path}`, line-number keys | RBP | open |
| C-7 | M | Clickable `div`/`span` elements (no keyboard support, can't open in a new tab) | `PRRow.tsx:23-27`, `RunHistory.tsx`, `FindingCard.tsx:56`, `AddRepoView.tsx:221` | `next/link`, `<button>` | RBP (a11y) | open |
| C-8 | M | No `error.tsx`, `global-error.tsx`, `not-found.tsx` or `loading.tsx` | `src/app/` | Add root-level ones | NBP | open |
| C-9 | L | Unhandled `mutateAsync` rejections | `CreateAgentModal.tsx:24`, `RunReviewDropdown.tsx:41-49` | `mutate(…, {onSuccess})` or catch | RBP | open |
| C-10 | L | All 18 message namespaces are serialized into every page | `layout.tsx:16,26` | Send only the namespaces in use | NBP | open |
| C-11 | L | `any` in props, needless casts, `!` on `Record<string>` maps | `FindingsTab.tsx:21`, `ReviewRunAccordion.tsx:141`, `PRRow.tsx:19,46` | Narrow the types; `Record<Union, …>` | TS | open |
| C-12 | M | Untested pure logic: `parsePatch`, `diff-viewer/comments.ts`, `activeKeyFor`, `api.ts` errors, `useRunEvents`; several components | `src/components/diff-viewer/*`, … | Unit tests for helpers first | RTL | open (PR-list and RunHistory helpers covered by I-1/I-2) |
| C-13 | M | `@testing-library/user-event` not installed; 33× `fireEvent`, 22× `getByTestId` | client tests | Add via pnpm; prefer role/text queries | RTL | open |

## 3. Server

### 3a. Security and stability
| ID | Sev | Finding | Where | Fix | Skill | Status |
|---|---|---|---|---|---|---|
| S-1 | **H ✔** | A repo URL can cause path traversal and an `rm -rf` outside the clone dir. The regex is unanchored and the owner part accepts `..` / `\`; `rm(dest,{recursive})` runs when `.git` is missing | `repos/constants.ts:18`, `adapters/git/simple-git.ts:38,58-64` | Parse with `URL`, require host `github.com`, owner/name `^[\w.-]+$` (no `.`/`..`), check `dest` stays inside `cloneDir`, clone the canonical URL | SEC | open |
| S-2 | **H** | Any host or `file://` URL can be cloned (SSRF); the raw URL is passed to git | `repos/service.ts:55,98` | As S-1 | SEC | open |
| S-3 | **H ✔** | A failed job rejects the `done` promise, nothing handles it, and the process crashes | `platform/jobs.ts:59,96` | `done.catch(()=>{})` in `enqueue` + a process-level log handler | FST | open |
| S-4 | M ✔ | API listens on `0.0.0.0` with no authentication | `server.ts:29` | Default `HOST=127.0.0.1` | SEC | open |
| S-5 | M | Workspace scoping missing on run / trace / cancel / resync and on agent-skill links | `reviews/routes.ts:52,115-123`, `run.repo.ts:94,193`, `repo-intel/routes.ts:38-53`, `agents/repository.ts:208-235` | Scope by `workspace_id` | SEC / convention | open |
| S-6 | M | GitHub token persisted in `<clone>/.git/config` | `repos/helpers.ts:29-35` | `-c http.extraHeader` per command, or reset the remote | SEC | open |
| S-7 | M | Diff-path file reads follow symlinks | `repo-intel/pipeline/incremental.ts:154`, `repo-intel/service.ts:762`, `astgrep/index.ts:621`, `ripgrep.ts:141` | `safeReadInClone` (`lstat` + `realpath` containment check) | SEC | open |
| S-8 | M | The 500 handler returns `e.message` (Postgres text leaks); `agentId` isn't validated as a uuid | `app.ts:159-163`, `reviews/routes.ts:32`, `contracts/platform.ts:283` | Generic 5xx message; `schema.body` | FST / SEC | open |
| S-9 | L | Test-connection saves the key before testing it | `settings/routes.ts:83` | Test first, then save | — | open |

### 3b. Data layer
| ID | Sev | Finding | Where | Fix | Skill | Status |
|---|---|---|---|---|---|---|
| D-1 | **H ✔** | No `db.transaction` anywhere. Non-atomic multi-write units: review + findings + run completion; `pr_files` delete + reinsert on GET; reindex; agent + snapshot; setSkills | `run-executor.ts:218-254`, `pulls/routes.ts:246-280`, `pipeline/full.ts:204-247`, `agents/repository.ts:85-105,229-235` | `db.transaction` per unit | DRZ | open |
| D-2 | M | Agent version bump is read-modify-write; a concurrent PUT drops a snapshot | `agents/repository.ts:117-166` | `version = version + 1 … RETURNING` in a transaction | DRZ | open |
| D-3 | M | Missing indexes on FK and filter columns: `reviews(pr_id, run_id)`, `findings(review_id)`, `agent_runs(workspace_id, pr_id)`, `pr_files/pr_commits(pr_id)`, `agents/jobs(workspace_id)` | `db/schema/*.ts` | New migration via `pnpm db:generate` | PG | open |
| D-4 | M | `reviews.run_id` / `agent_id` have no FK | `schema/reviews.ts:17,19` | FK with CASCADE / SET NULL | PG | open |
| D-5 | L | Free-text status/severity columns; `cost_usd` is a double | `schema/runs.ts:22,28`, `schema/pulls.ts:25` | CHECK / NOT NULL; `numeric` | PG | open |
| D-6 | L | N+1 queries: PR upsert loop, agent-name lookups, `findingContext` ×3, settings per-key upsert | `pulls/routes.ts:48-76`, `reviews/service.ts:170`, `review.repo.ts:299-313`, `settings/routes.ts:52` | Batch / join | DRZ | open |

### 3c. Architecture and Fastify
| ID | Sev | Finding | Where | Fix | Skill | Status |
|---|---|---|---|---|---|---|
| B-1 | M | Routes query Drizzle beyond the documented legacy exception (settings, workspace); PR-list GET holds ~190 lines of aggregation; the polling upsert copy omits `openedAt` | `settings/routes.ts:30-66`, `workspace/routes.ts:18-22`, `pulls/routes.ts`, `polling/routes.ts:31-47` | Service + repository; one shared `upsertMany` | convention / FA:business-logic (by analogy) | open |
| B-2 | M | Graceful shutdown closes only the DB | `app.ts:173` | `onClose`: drain the queue, track runs, mark them cancelled | FST | open |
| B-3 | M | Reviews have no queue or concurrency cap; no per-route rate limits on expensive endpoints | `reviews/service.ts:138`, `pulls/routes.ts`, `polling`, `repos` | Run reviews via the JobRunner with a cap; per-route limits | FST | open |
| B-4 | M | No response schemas anywhere | src-wide | `response:` schemas, starting with the PR list and trace | FST / ZOD | open |
| B-5 | M | `GET /repos/:id/pulls` syncs with GitHub on every poll | `pulls/routes.ts:45-113` | Split read from sync | FST | open |
| B-6 | M | Synchronous napi parsing blocks the event loop; `withTimeout` can't interrupt it | `pipeline/full.ts:125-161` | worker_threads | — | open |
| B-7 | L | Inconsistent DI; the auth adapter imports the seed script | `repo-intel/service.ts:22-28`, `adapters/auth/local.ts:5` | Wire through the container; move constants to `db/constants.ts` | convention | open |
| B-8 | L | `app.log` instead of `req.log`; no pino `redact`; `requestTimeout` = 0 | `pulls/routes.ts:40…`, `app.ts:46-60` | Fix each | FST | open |
| B-9 | L | Duplicated code: enclosing-symbol lookup ×3, failure persistence ×2 | `repo-intel/service.ts:531,736,751`, `run-executor.ts:75,299` | Extract helpers | FA:helpers-and-utils (by analogy) | open |
| B-10 | L | Unused platform modules | `platform/model-router.ts`, `trace-builder.ts`, `prompts.ts` | Keep if scaffolding for a later lesson (decision 5) | — | open |

### 3d. Known items from `server/INSIGHTS.md` (still open)
- Windows migrate/seed guard (`db/migrate.ts:36`, `db/seed.ts:226`) → `pathToFileURL`.
- cancelRun doesn't stop a live run (`reviews/service.ts:86-91`, `run.repo.ts:168-182`).
- PR title/author outside `<untrusted>` (`reviews/helpers.ts:84`).
- `.env` keys reach tests (`platform/config.ts:1`); tests read the real `~/.devdigest/secrets.json` (`config.ts:74`).
- `indexer-pipeline.test.ts:142` → `path.dirname`.
- RunBus maps never cleared (`platform/sse.ts:103`).
- Empty `catch {}` hides a missing index handler (`repos/service.ts:73,134`).

### 3e. Server tests
- **T-1 (M):** no tests for the repo URL and clone helpers (they would catch S-1/S-2), the
  JobRunner, RunBus/cancel, `withRetry`/`withTimeout`, the 5xx path, `PUT /settings`, or the
  DELETE routes.
- **T-2 (L):** tests overwrite private fields (`repo-intel-resync.test.ts:51`) → inject the
  repository through the constructor.

## 4. reviewer-core

| ID | Sev | Finding | Where | Fix | Skill | Status |
|---|---|---|---|---|---|---|
| RC-1 | **H ✔** | Grounding looped over the model-supplied `start..end` range; the line fields are unbounded | `src/grounding.ts:41-46`, `vendor/shared/contracts/findings.ts:53-54` | Loop over the hunk line set (**done, I-3**). Still open: schema `.min(1)`, `start<=end`, max span (contract change in both vendored copies) | ZOD / SEC | **partial (I-3)** |
| RC-2 | M | The LLM's own `kind: 'hook'\|'phantom'` skips line grounding | `src/grounding.ts:59-69` | Force `kind='finding'` for LLM output | SEC | open |
| RC-3 | M | Map-reduce chunking matches paths by substring | `src/review/reduce.ts:63-64` | Parse the `diff --git` header; compare paths exactly | — | open |
| RC-4 | M | `wrapUntrusted` escapes only the exact lowercase `</untrusted>` | `src/prompt.ts:32` | Case/whitespace-insensitive regex; neutralize forged opening tags | SEC | open |
| RC-5 | M | Token/cost usage is lost when structured output fails or a later chunk throws | `src/llm/openrouter.ts:98-115`, `run.ts:174-185` | Typed error that carries usage | — | open |
| RC-6 | M | Invariants E1/E4/E5 untested; the server's "map-reduce" test actually runs single-pass | `test/`, `server/test/reviews.it.test.ts:163` | `run.map-reduce.test.ts`; rename the server test | — | open (E2 now covered in reviewer-core by `test/grounding.test.ts`) |
| RC-7 | M ✔ | A test imports server mocks across packages | `test/run.test.ts:3` | Local `test/fixtures.ts` | FA:module-boundaries | open |
| RC-8 | L | `listModels` has no timeout; `req.timeoutMs` ignored; tests not type-checked; `--passWithNoTests`; `Record<string,…>` ranks; internals exported; skills/memory not wrapped (L02) | `openrouter.ts:69-124`, `tsconfig.json`, `package.json:10`, `reduce.ts:33`, `index.ts`, `prompt.ts:88-110` | Small fixes | TS / FA:module-boundaries | open |
| RC-9 | M | `diff-parser` counts `\ No newline` and the trailing `''` as context lines; an added `++…` line is read as a header | `server/src/adapters/git/diff-parser.ts:39,70-73` | Only `' '` counts as context; ignore `+++`/`---` inside a hunk | — | open |

Known items, by design: the verdict is kept after grounding (`run.ts:208`); single-pass mode
has one cancel checkpoint (`run.ts:164`).

## 5. e2e, CI, tooling, cross-package

| ID | Sev | Finding | Where | Fix | Status |
|---|---|---|---|---|---|
| X-1 | **H ✔** | Vendored contracts have drifted (5 files) with no automated check | `server/src/vendor/shared` ↔ `client/src/vendor/shared` | `scripts/sync-shared.sh --check` + `shared-drift.yml`; later alias the client to the server copy (needs A6) | open |
| X-2 | M | Path filters: e2e and server-integration don't watch `reviewer-core/**`; e2e doesn't watch `docker-compose.yml`; reviewer-core doesn't watch `server/src/adapters/**` | `.github/workflows/*.yml` | Add the paths | open |
| X-3 | M | Actions pinned by tag, not SHA; `agent-browser` unpinned; no dependabot | workflows | Pin SHAs/versions; add `dependabot.yml` | open |
| X-4 | M | Postgres published on all interfaces with default credentials; floating image tag | `docker-compose.yml:5-13` | `127.0.0.1:5432:5432`; pin the tag/digest | open |
| X-5 | M | `pnpm install` not frozen in the scripts (can rewrite lockfiles) | `scripts/dev.sh:73`, `scripts/e2e.sh:110` | `--frozen-lockfile` | open |
| X-6 | M | No linter (misses floating promises, cross-package imports, ESM extensions, import boundaries) | repo-wide | Biome or typescript-eslint + a boundaries rule + a CI lint job | open |
| X-7 | M | The severity-filter flow passes even if the filter does nothing; no "run a review" flow | `e2e/specs/08-pr-severity-filter.flow.json` | Negative assertion; mock-LLM review flow | open |
| X-8 | L | e2e typecheck not in CI; no `timeout-minutes`, cache or log artifacts; no `engines`/`packageManager` | workflows, `package.json`s | Small fixes | open |
| X-9 | L | `e2e:hermetic` / cleanup broken on Windows; `pg_isready` without `-h`; hermetic run uses `next dev`; flow JSON not validated | `e2e/package.json:9`, `scripts/e2e.sh`, `e2e/run.ts:96` | Fix each | open |
| X-10 | L | Docs drift: README omits `OPENROUTER_API_KEY`; reviewer-core README lists wrong export names; `.gitignore` misses `.env.*` | `README.md:69,113`, `reviewer-core/README.md:40-42`, `.gitignore` | Update | open |

## Open decisions (default in parentheses)
1. Thin server `page.tsx` + `_components/<X>View` for the remaining `"use client"` pages. The
   skill recommends it, but `client/docs/ui-architecture.md` documents those pages as client
   pages. (Yes, as a documented convention change.)
2. Query-key factory (`lib/hooks/keys.ts`) as a client convention. (Yes, documented in
   `ui-architecture.md`.)
3. Runtime imports from `@devdigest/shared` in the client via webpack `extensionAlias`. (Yes,
   after a spike.)
4. Recompute the verdict after grounding. (No change; keep as an open question.)
5. Dead or scaffolding code (mermaid-diagram, `useRepoIntelStatus`, unused platform modules).
   (Keep anything a later lesson needs; delete the rest.)

## Proposed phases
Each phase is its own change set, reviewed before the next one starts.
1. **Security and crashes:** S-1, S-2, S-3, S-4, S-8, RC-1 (remainder), RC-2, RC-4, X-4, each with
   a regression test using the audit's attack inputs.
2. **Correctness:**
   - client: C-1…C-4, A7
   - server: D-1, D-2, the cancel bug, PR-title wrapping, the Windows migrate guard
   - engine: RC-3, RC-5, RC-9
3. **Frontend-architecture refactors:**
   - A1 (i18n copy), A3 (key factory), A4 (split, remainder), A5, A6, A8–A10, A13–A15
   - thin pages, if decision 1 is accepted
4. **Backend structure:** S-5…S-7, B-1…B-9, D-3…D-6. Migrations only via `pnpm db:generate`.
5. **Tests and tooling:** C-12, C-13, T-1, T-2, RC-6, RC-7, X-1…X-3, X-5…X-10.

Rules for every phase:
- Never hand-edit `server/src/db/migrations/` or the lockfiles.
- Contract changes land in both vendored copies.
- Dependencies change only through each package's own manager.
- Run the `engineering-insights` wrap-up after each phase.

## Considered and deliberately not done now
- **`lineLabel` de-duplication (A5):** only two copies, and the skill's "abstract late" rule says
  extract on the third. One copy is route-local (`FindingCard`) and one is shared
  (`findings-popover`), so pointing one at the other would be a sideways import.
- **Reusing `countNeedsReview` in the shell (A2):** `useShellContext` is shared code. Importing a
  route's helpers from it would reverse the one-way dependency rule. Two copies; wait.
- **The C-1 / C-2 / A7 bug fixes:** high value, but each changes visible behavior. Out of scope
  for a no-behavior-change iteration; they lead phase 2.
- **Schema bounds on finding lines (RC-1 remainder):** a contract change (both vendored copies)
  that would reject model output that is accepted today.
