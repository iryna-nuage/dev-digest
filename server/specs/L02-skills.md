# L02 — Skills for review agents (server)

Reusable, text-only review skills: CRUD in a new `skills` module, `.md` / `.zip` import with a
preview that never writes, attach / detach / reorder on an agent, and the active skills injected
into the real review prompt and visible in the run trace. UI (master-detail page, tabs, agent
Skills tab, import drawer) is in [`client/specs/L02-skills.md`](../../client/specs/L02-skills.md).

Status: **implemented** (2026-10-23); the control experiment is still to be run.

## Context — starting state

- **Tables exist** since `0000_init.sql`: `skills` (`name`, `description`, `type`, `source`, `body`,
  `enabled`, `version`, `evidence_files`, `workspace_id`), `skill_versions (skill_id, version,
  body)`, `agent_skills (agent_id, skill_id, order)` with cascade deletes. No unique index on
  `skills.name`. No per-link `enabled`.
- **Contracts exist** in `src/vendor/shared/contracts/knowledge.ts`: `Skill`, `SkillType`
  (`rubric | convention | security | custom`), `SkillSource` (`manual | imported_url | extracted |
  community`), `AgentSkillLink`.
- **Agent side exists**: `GET /agents/:id/skills`, `POST /agents/:id/skills` (`skill_ids` = replace
  the ordered set, or `skill_id` + `order` = link one) → `AgentsService.setSkills / linkSkill` →
  `AgentsRepository.setSkills` (delete + insert, **no transaction**, **no check that the skill ids
  belong to the agent's workspace**). `snapshotVersion` already records linked skill ids.
- **Engine supports skills**: `reviewPullRequest({ skills: string[] })` → `assemblePrompt` renders
  `## Skills / rules` (bodies joined by a blank line) in the user message and sets
  `prompt_assembly.skills`. **But `run-executor.ts` never passes `skills`**, so today no skill ever
  reaches a prompt.
- **There is no `/skills` route module.**
- Token counter: `container.tokenizer` (`js-tiktoken` `cl100k_base`, falls back to `ceil(chars/4)`).

## Decisions (agreed)

1. Agent checkbox = **attach / detach** (row in `agent_skills`). Order = `agent_skills.order`.
   No `agent_skills.enabled`.
2. `skills.enabled` = **global master switch**. A skill reaches a prompt iff it is attached to the
   agent **and** `skills.enabled = true`, in the agent's link order.
3. Import = **text extraction only**. Preview first; nothing is persisted before the user confirms.
   Saved with `source: 'imported_file'`, `enabled: false`.
4. Skill text is passed to the model **as instructions** — never wrapped in `<untrusted>` (the
   `INJECTION_GUARD` would make the model ignore it). Trust = the human review at preview.
5. **No migrations.** `imported_file` is a TS-level enum value (`skills.source` is `text`).
   Name uniqueness is enforced in the service.
6. One new agent: **Test Quality Reviewer**. No second agent.

## Non-goals

- Skill evals, "Run on evals", the Versions UI and any versions read endpoint.
- Pull frequency and findings by category (see "Stats" below).
- Import from URL, community catalog, `.skill` / `.tar` / other archive formats.
- Running, extracting to disk, or reading anything from an archive except `SKILL.md`.
- Changes to `assemblePrompt`, `PromptAssembly`, `RunTrace` or reviewer-core.
- Agent version bump on attach / detach / reorder (existing behaviour: links are snapshotted only
  when the agent's own config changes).
- Skill count / stats on agent cards.

## Contracts

Both copies — `server/src/vendor/shared` and `client/src/vendor/shared` — must change identically
(coordinated edit of the do-not-touch dir; `contracts.test.ts` covers the server copy).

| Contract (`contracts/knowledge.ts`) | Change |
|---|---|
| `SkillSource` | add `'imported_file'` (also in the Drizzle TS enum of `skills.source`; `pnpm db:generate` reports no schema change) |
| `SkillListItem` (new) | `Skill.extend({ agents_count: z.number().int() })` — row of `GET /skills` |
| `SkillAgentRef` (new) | `{ id, name, enabled }` — row of `GET /skills/:id/agents` (the skills module must not import the agents module's mapper) |
| `SkillImportPreview` (new) | `{ filename, name, description, type: SkillType, body, ignored_files: { path, executable: boolean }[], warnings: { code, message }[] }` |
| `SKILL_NAME_PATTERN`, `SKILL_NAME_MAX`, `SKILL_DESCRIPTION_MAX`, `SKILL_BODY_MAX` (new) | field rules, one definition for the API and the editor |
| `formatSkillForPrompt()` (new, pure) | the text one skill adds to a prompt (see Prompt assembly); used by the executor and the client Preview |

## Validation (create and update)

| Field | Rule |
|---|---|
| `name` | `^[a-z0-9][a-z0-9-]{1,63}$` (kebab-case, 2–64), unique per workspace → `409` |
| `description` | required, trimmed, 1–300 chars ("the skill's interface", directive) |
| `type` | `SkillType` |
| `body` | required, 1–20 000 chars |
| `enabled` | boolean; default `true` for `manual`, **forced `false` for `imported_file`** on create |
| `source` | create accepts only `manual` (default) or `imported_file`; not updatable |

Uniqueness is a service check (`findByName`) before the write. Trade-off: without a unique index
two concurrent creates with the same name can both pass — acceptable for a single-user local
studio. New `ConflictError` (409), `PayloadTooLargeError` (413) and `UnsupportedMediaTypeError`
(415) in `src/platform/errors.ts`, mapped by the existing error handler.

`PUT` sends only the fields present in the body to the store: toggling `enabled` never rewrites the
name, description, type or body (the client relies on this — client spec → Config tab).

## Routes

New module `src/modules/skills/` (onion layout): `routes.ts` → `service.ts` (depends on the
`SkillStore` port in `ports.ts`) → `repository.ts` + `mappers.ts`; pure rules in `domain.ts`
(`initialEnabled`, `nextVersion`); `import/` (pure parsers: `markdown.ts`, `archive.ts`,
`extract.ts`). The repository is exposed as `container.skillsRepo` (also read by the review
executor). Registered in `src/modules/index.ts`. Every route is workspace-scoped via
`getContext`; foreign ids → `404`.

| Route | Purpose | Notes |
|---|---|---|
| `GET /skills` | Left-pane list | `SkillListItem[]`, ordered by `name`. `agents_count` = one `GROUP BY` over `agent_skills` |
| `GET /skills/:id` | Detail (Config / Preview) | `Skill` |
| `POST /skills` | Create manually **or** save a confirmed import | `201` + `Skill`. Inserts `skill_versions` v1 in the same transaction |
| `PUT /skills/:id` | Edit fields, toggle `enabled` | Body change → `version + 1` and a `skill_versions` row, in one transaction. Other fields don't bump |
| `DELETE /skills/:id` | Delete | `{ ok: true }`; `agent_skills` and `skill_versions` cascade |
| `GET /skills/:id/agents` | Stats tab: who uses it | `SkillAgentRef[]` linked to this skill, ordered by name |
| `GET /skills/:id/stats` | Stats tab: runs and findings (30d) | `SkillStats`; read-only, see "Stats" |
| `POST /skills/import/preview` | Parse an uploaded file | **No DB write.** Route-level `bodyLimit: 2 MB` (base64 of a 1 MB file ≈ 1.34 MB; global limit is 1 MB) |

Changed (agents module, same paths):

| Route | Change |
|---|---|
| `POST /agents/:id/skills` | `skill_ids` path: reject duplicates (`422`, Zod refine), check every id belongs to the workspace (`404`, nothing changes), run delete + insert **in one transaction**. `skill_id` path: same workspace check. Response unchanged (`AgentSkillLink[]`) |
| `GET /agents/:id/skills` | unchanged |

Detach = `POST` the full `skill_ids` without that id. No new agent routes.

## Import preview

`POST /skills/import/preview` body: `{ filename: string, content_base64: string }`.

**Accepted:** `.md` (UTF-8 text) and `.zip`. Anything else → `415`, reason `unsupported_type`.

**`.md`:** optional YAML-style frontmatter between `---` lines. Only flat `key: value` scalars are
read (no YAML dependency): `name`, `description`, `type`. Other keys (e.g. `allowed-tools`,
`metadata`) are ignored and reported as a warning. Body = text after the frontmatter.

**`.zip`** (read in memory with `fflate`, the only new dependency — `pnpm add fflate`):
- Take `SKILL.md` (case-insensitive) from the archive root, or from one top-level folder; root
  wins. None → `no_skill_md`; several folder candidates → `ambiguous_skill_md`.
- Every other entry goes to `ignored_files`, never decompressed beyond listing. `executable: true`
  for `scripts/**` and extensions `.sh .bash .ps1 .bat .cmd .py .js .mjs .cjs .ts .rb .pl .exe .bin
  .so .dll`.
- Nothing is written to disk, nothing is executed, referenced files are not followed.

**Field fallbacks:** `name` ← the first of frontmatter → first `# H1` → folder → file name that
slugifies to a valid name, else `imported-skill`; `type` ← frontmatter if a valid `SkillType`,
else `custom` (+ `type_unknown`); `description` ← frontmatter, else empty plus warning
`description_missing` (the user must fill it before saving — normal create validation applies on
confirm). A description over 300 chars is kept as is, with `description_too_long`.

**Limits and errors** — body `{ error: { code, message, details: { reason } } }`; the message is
shown in the UI as is:

| Condition | Status · `details.reason` |
|---|---|
| Upload > 1 MB (decoded) | `413` · `file_too_large` |
| Not `.md` / `.zip` | `415` · `unsupported_type` |
| Invalid base64 / not UTF-8 text / contains NUL | `422` · `invalid_file` |
| Corrupt zip | `422` · `invalid_archive` |
| Zip: > 200 entries, or total declared uncompressed size > 5 MB (central directory, checked before inflating) | `413` · `archive_too_large` |
| `SKILL.md` / `.md` > 100 KB, or body > 20 000 chars | `413` · `skill_too_large` |
| No / several `SKILL.md` | `422` · `no_skill_md` / `ambiguous_skill_md` |
| Empty body | `422` · `empty_body` |

`422` uses the existing `validation_error` code (the repo's status for invalid input).

**Warnings** (informational, never block): `executable_ignored` (n files), `extra_files_ignored`,
`frontmatter_keys_ignored`, `type_unknown`, `description_missing`, `description_too_long`,
`contains_urls` (skills cannot fetch anything), `mentions_tools` (scripts / tools / shell
commands are not available to the agent), `suspicious_instructions` (e.g. "ignore previous
instructions", "system prompt"), `name_taken` (a skill with this name exists — rename before
saving).

Confirm = the client sends the (possibly edited) fields to `POST /skills` with
`source: 'imported_file'`; the server stores it disabled.

## Prompt assembly and trace

In `run-executor.ts`, before `reviewPullRequest`:

1. `activeSkillsForAgent(workspaceId, agentId)` (skills repository): `agent_skills ⋈ skills` where
   `skills.enabled = true` and `skills.workspace_id = workspaceId`, `ORDER BY agent_skills.order`.
2. Format each skill with `formatSkillForPrompt(skill)` (`@devdigest/shared`):
   ```
   ### Skill: <name>
   <description>

   <body>
   ```
   This is the single definition of "what the agent receives"; the client Preview renders the
   same function's output (client spec → Preview).
3. Pass `skills: string[]` to `reviewPullRequest` (omit when empty → section absent, prompt
   identical to today). `assemblePrompt` is unchanged; each skill is its own block inside
   `## Skills / rules`, and the joined text lands in `prompt_assembly.skills`.
4. Log through the existing `runLog`, so the lines are streamed and persisted in `trace.log`:
   - one `info` line per active skill: `Skill "<name>" v<version> attached (<tokens> tokens)`,
     tokens = `container.tokenizer.count(formatted block)`;
   - a summary: `Skills: <n> active, <total> tokens` or `Skills: none active`.
   Attached-but-globally-disabled skills produce **no** line and no prompt text.

No contract or engine change: the trace shows the block (`prompt_assembly.skills`) and the
per-skill tokens (log). Extending `RunTrace` with structured skill metadata is deferred until a UI
needs it.

## Stats

Agent usage: `agents_count` (`GET /skills`) and the agent list (`GET /skills/:id/agents`).

`GET /skills/:id/stats` → `SkillStats { window_days: 30, runs, findings, accepted, dismissed,
accept_rate }`, read from existing data only (no new table or migration):
- **runs** — `agent_runs` of the workspace with `ran_at` in the last 30 days whose
  `run_traces.trace.prompt_assembly.skills` contains `### Skill: <name>\n` (the first line of
  `formatSkillForPrompt`; `skillPromptMarker` in `domain.ts`).
- **findings / accepted / dismissed** — `findings` of those runs (`reviews.run_id`), counting
  `accepted_at` / `dismissed_at`.
- **accept_rate** — `round(accepted / (accepted + dismissed) × 100)`; `null` while nothing is decided.
- Limits: findings are per run, not attributed to a skill (a run with two skills counts for both);
  matching is by the current name, so runs from before a rename are not counted.

| Metric | Why excluded |
|---|---|
| Pull frequency | Every attached + enabled skill is sent on every run; there is no conditional "pull" to measure. Shown as **runs** instead |
| Findings by category | Out of scope for L02 |

## Seed and sample content

- `seed-prompts.ts`: `TEST_QUALITY_REVIEWER_PROMPT` (untested branches, missing edge / corner
  cases, over-mocking, flaky patterns; also contract tests for changed API signatures). Mirror in
  `docs/agent-prompts/test-quality-reviewer.md`. Same default provider / model as the other built-in
  agents.
- `seed.ts`: insert **Test Quality Reviewer** (idempotent by name) and two seeded skills attached in
  order: `branch-coverage-gate` (rubric), `mocking-discipline` (convention), `source: 'manual'`,
  enabled. Skills are idempotent by `(workspace, name)`; the links are written only while the agent
  has none, so a re-seed never undoes the user's attach / detach / order.
- Not seeded — created through the UI during the demo (full path):
  - `docs/skills/edge-case-checklist.md` → import as `.md`;
  - `docs/skills/api-contract-tests/` (`SKILL.md` + `scripts/check.sh`) → zipped and imported as
    `.zip`, proving the script is listed as ignored-executable and never run.
  Both are then enabled and attached on the agent's Skills tab.

## Control experiment

`docs/experiments/L02-skills-control.md` — a template with reproduction steps and **empty result
fields**; values are filled only from real runs (no invented findings). Two scenarios, both on Test
Quality Reviewer:

1. **Uncovered cases** — PR whose test covers only the happy path. Run with no skills attached, then
   with skills attached. Expectation to verify: the skilled run flags the uncovered branch and the
   edge case.
2. **API breaking change** — PR that changes a route signature. Same with / without. Expectation to
   verify: the skilled run (`api-contract-tests`) flags the breaking change / missing contract test.

Per run, record: PR, run id, attached skills, findings (title + severity), tokens in/out, the
`Skills:` log lines, and a screenshot of the trace's Skills block. The concrete GitHub PRs are
agreed separately.

## Tooling

`.claude/skills/pr-self-review/SKILL.md` had no `disable-model-invocation: true`, so the model could
auto-invoke it. That frontmatter line is added; manual `/pr-self-review` keeps working (and its
PreToolUse gate hook is unchanged).

## Tests

Unit (`test/*.test.ts`):
- `skills-import.test.ts` — `.md` with / without frontmatter, field fallbacks, ignored frontmatter
  keys; zip with `SKILL.md` at root / in one folder / missing / ambiguous; scripts listed as
  executable and not inflated; entry-count and size limits (incl. a zip bomb); corrupt input;
  warning codes; base64 decoding.
- `skills-service.test.ts` — `formatSkillForPrompt` exact output; domain rules; `SkillsService`
  against an in-memory `SkillStore` (conflicts, imported → disabled, partial updates, version bump,
  preview never writes, failure → error class); `skillPromptMarker` matches the format;
  `acceptRate`; `stats` window and marker.

Integration (`test/skills.it.test.ts`, Docker):
- CRUD; `409` on duplicate name; body change bumps `version` and writes `skill_versions`, other
  edits don't; delete cascades links; `imported_file` is stored disabled even if `enabled: true` is
  sent; foreign-workspace ids → `404`; preview writes nothing (row counts unchanged).
- `POST /agents/:id/skills`: order persisted; duplicates `422`; foreign skill `404` and the
  previous links stay intact.
- Executor: only attached ∧ enabled skills, in link order, reach `prompt_assembly.skills`; a
  disabled one is absent from the prompt and the log; no skills → no section. Stats count the run
  and its findings (accepted / dismissed) for the skills in its prompt only; foreign skill → `404`. Uses
  `overrides.llm.openrouter = MockLLMProvider` (see INSIGHTS: `.env` keys leak into tests).

## Acceptance criteria

1. A skill can be created, edited (body edit bumps the version) and deleted via the API; names are
   unique per workspace.
2. `POST /skills/import/preview` returns the extracted Markdown, ignored files and warnings for
   `.md` and `.zip`, writes nothing, never executes or writes archive content, and returns the error
   codes above for bad, oversized or unsupported files.
3. A confirmed import is stored with `source: imported_file`, `enabled: false`.
4. Attach / detach / reorder through `POST /agents/:id/skills` is workspace-safe and atomic.
5. A real run includes exactly the attached + enabled skills, in link order, as separate blocks in
   `prompt_assembly.skills`, and the trace log lists each with its token count; disabled ones appear
   nowhere.
6. Test Quality Reviewer is seeded with two attached skills; two more come in via UI import.
7. `pr-self-review` has auto-invocation disabled and still runs when invoked manually.
