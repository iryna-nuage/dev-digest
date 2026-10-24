# L02 — Skills for review agents (client)

The Skills page (master-detail: list on the left, the selected skill's Config / Preview / Stats on
the right), the import drawer with a preview before saving, and the Skills tab of the Agent Editor
(attach / detach / drag to reorder). API, validation, import parsing, prompt assembly and trace
logging are defined in [`server/specs/L02-skills.md`](../../server/specs/L02-skills.md); the client
never parses archives and never decides which skills reach a prompt.

Status: **implemented** (2026-10-23). Design reference: the Skills Lab mockups
(Skills → Config / Preview / Stats; Agent Editor → Skills).

## Scope vs the mockups

| Mockup element | L02 |
|---|---|
| Skills list: search, cards (icon, name, toggle, description, type badge, source), Add Skill ▾ | ✅ |
| Card footer `3 agents · 71% pull · 74% accept` | only `N agents` |
| Detail header: icon, name, type badge, `v5` | ✅ (version is display-only) |
| Tabs Config · Preview · Stats | ✅ |
| Tabs Evals · Versions, button Run on evals | ❌ not rendered |
| Stats: Used by, Accept rate, Findings (30d), Agents using this skill | ✅ |
| Stats: Pull frequency | → **Runs (30d)** (no conditional pull — server spec → Stats) |
| Stats: Findings by category | ❌ not rendered |
| Agent Editor → Skills tab: counter, filter, rows with handle / checkbox / name / type badge | ✅ (checkbox = attach) |
| Agent cards `N skills` / runs / accept / cost | ❌ unchanged |

## Data the client reads

| Data | Endpoint | Hook (`src/lib/hooks/skills.ts`, new) |
|---|---|---|
| `SkillListItem[]` | `GET /skills` | `useSkills()` · key `["skills"]` |
| `Skill` | `GET /skills/:id` | `useSkill(id)` · key `["skill", id]` |
| create / update / delete | `POST /skills` · `PUT /skills/:id` · `DELETE /skills/:id` | `useCreateSkill` · `useUpdateSkill` · `useDeleteSkill` |
| `SkillAgentRef[]` using a skill | `GET /skills/:id/agents` | `useSkillAgents(id)` · key `["skill-agents", id]` |
| `SkillStats` | `GET /skills/:id/stats` | `useSkillStats(id)` · key `["skill-stats", id]` |
| `SkillImportPreview` | `POST /skills/import/preview` | `useImportSkillPreview()` (mutation, no cache) |
| `AgentSkillLink[]` | `GET` / `POST /agents/:id/skills` | `useAgentSkills(agentId)` · `useSetAgentSkills()` in `src/lib/hooks/agents.ts` · key `["agent-skills", agentId]` |

Invalidation: skill create / update / delete → `["skills"]`, `["skill", id]`; set agent skills →
`["agent-skills", agentId]`, `["skills"]` (agents_count), `["skill-agents"]`. Contracts from
`@devdigest/shared`; `client/src/vendor/shared` mirrors the server change (`SkillSource +
imported_file`, `SkillListItem`, `SkillAgentRef`, `SkillImportPreview`, the field limits and
`formatSkillForPrompt`).

## Routes and layout

| Route | Right pane |
|---|---|
| `/skills` | "Select a skill" empty state (existing `page.selectPrompt` keys); `EmptyState` with Create / Import when the workspace has no skills |
| `/skills/new` | Create form (Config tab in create mode) |
| `/skills/[id]?tab=config\|preview\|stats` | Selected skill. Unknown / missing `tab` → `config` (same pattern as `/agents/[id]`) |

`src/app/skills/layout.tsx` renders `AppShell` (crumb `Skills Lab › Skills`) and the
`SkillsListPane` once, so the list keeps its scroll and search when switching skills; pages render
only the right pane. This is the first nested layout in the app — chosen over copying the list into
every page (as `agents/[id]/page.tsx` does). Pages using `useSearchParams` stay under the existing
root `Suspense`.

Sidebar (`src/vendor/ui/nav.ts`): new group `SKILLS LAB` with **Skills** (`/skills`, `g s`) and
**Agents** (moved from WORKSPACE). `activeKeyFor` already maps `/skills`. Add `g s` to `SHORTCUTS`.

## Left pane — `SkillsListPane`

- Header `Skills` + **Add Skill ▾** (`Dropdown`, like `AgentsListView`): **Create skill** →
  `/skills/new`; **Import from file** → opens the import drawer.
- Search input: client-side filter on name + description (case-insensitive).
- `SkillCard` (pattern of `AgentCard`): type icon, `name` (mono), `Toggle` = global `enabled`
  (`PUT /skills/:id { enabled }` immediately, optimistic, toast + rollback on error; click doesn't
  select the card), description clamped to 1 line, type badge, source label (`Manual`, `Extracted`,
  `Community`, `Imported` for both `imported_url` and `imported_file`), footer `N agents`
  (`agents_count`, ICU plural; `0 agents` shown). Disabled skill → muted card. Active card
  highlighted.
- Loading → `Skeleton` cards; error → `ErrorState` with retry.

## Right pane — `SkillDetail`

Header: type icon, name, type badge, `v{version}` badge. Tabs (`Tabs`, `TABS` constant like
`AgentEditor`): **Config**, **Preview**, **Stats**; `?tab=` via `router.replace`. In create mode the
Stats tab is hidden and the header shows "New skill".

The form draft lives in `SkillDetail`, so Preview shows the current (possibly unsaved) text.

### Config tab — `SkillConfigTab`

Built from the same kit as the agent `ConfigTab`: `FormField`, `TextInput`, `SelectInput`,
`Textarea`, `Toggle`, `Button`.

- Title `Configuration` + `v{version}` badge; **Enabled** toggle on the right (part of the form,
  saved with Save — same as the agent `ConfigTab`).
- **Two Enabled controls, no overwrite.** The list card saves `{ enabled }` at once
  (`useSetSkillEnabled`, optimistic, writes the new skill into the `["skill", id]` and `["skills"]`
  caches). The form keeps a draft of **only the fields the user touched** (`src/lib/skill-fields.ts`):
  untouched fields always show the current saved value (so a list toggle shows up in the open form
  at once), and Save sends `buildSkillPatch(saved, draft)` = only the drafted fields that differ from
  the current saved values. A form that never touched Enabled therefore never sends it, and a form
  toggle that already matches the saved value is dropped. The server also writes only the fields in
  the `PUT` body.
- **Name*** — kebab-case hint; inline error for the pattern and for `409` ("A skill with this name
  already exists").
- **Description*** — hint under the field: "Write it as a directive: when the reviewer should apply
  this skill and what to check. Example: *Use when tests change: flag untested branches and missing
  edge cases.*" Counter `n / 300`.
- **Type** — `SelectInput` over `SkillType`.
- **Skill body*** — editor card: header `<name>.md`, `unsaved` badge when the draft differs from the
  saved skill, `≈N tokens` on the right (`ceil(chars / 4)`, the server tokenizer's fallback
  heuristic; the exact count is in the run trace). Body: a monospace `<textarea>` (the kit
  `Textarea` has no `onScroll`) with a line-number gutter (scroll-synced, `aria-hidden`). Heading
  lines (`# …` to `###### …`) are coloured `--accent-text` by an `aria-hidden` highlight layer
  under the textarea (same font, padding, line height; textarea text transparent, caret visible;
  scroll-synced). Counter against 20 000 chars.
- Client validation mirrors the API from the shared limits (`SKILL_NAME_PATTERN`,
  `SKILL_DESCRIPTION_MAX`, `SKILL_BODY_MAX`); errors show on touched fields, and on all fields
  after a Save attempt.
- Footer: **Save** (disabled while invalid or unchanged) · **Cancel** (reset draft) · **Delete**
  (danger) → `Modal`: "Delete <name>? It is attached to N agents and will be detached from them."
- Create mode: empty form, Enabled on, Save → `POST /skills` → `router.replace('/skills/<id>?tab=config')`.
- No unsaved-changes guard on navigation in L02 (the `unsaved` badge is the only signal).

### Preview tab — `SkillPreviewTab`

Title `Preview`, subtitle "Rendered as the reviewing agent receives it." Card renders the skill
**body** as a document (as in the design): `SkillMarkdown` (react-markdown + GFM) with styled
headings, lists, emphasis and code. The `### Skill: <name>` + description header that
`formatSkillForPrompt` adds for the agent is not repeated here. When the draft is unsaved: note "Showing unsaved
changes. Agents receive the saved version." Disabled skill: note "Disabled: agents don't receive
this skill."

Runtime values from the shared contracts (`formatSkillForPrompt`, `SkillType`, the limits) are
imported from `@devdigest/shared/contracts/knowledge`, not the package index: the index re-exports
with ESM `.js` specifiers that `next build` (webpack) cannot resolve; type-only imports are erased
and keep using `@devdigest/shared`.

### Stats tab — `SkillStatsTab`

- Tiles: **Used by** `N agents` (`useSkillAgents(id).length`) · **Runs (30d)** · **Accept rate**
  (`CircularScore` + `%`, `N accepted · M dismissed`; `—` while `accept_rate` is null) ·
  **Findings (30d)** — from `useSkillStats(id)`. Note under the tiles: counts are of runs whose
  prompt included the skill; a run with several skills counts for each.
- Card **Agents using this skill**: one row per agent — cpu icon, name, `disabled` badge if the
  agent is off, **Open** → `/agents/<id>?tab=skills`.
- Empty: "Not attached to any agent yet. Attach it from an agent's Skills tab."
- No Pull frequency or Findings by category, and no placeholder values.

## Import drawer — `ImportSkillDrawer`

`Drawer` (`import.*` keys; the old URL / community keys are removed).

1. **Choose file** — file input `accept=".md,.zip"`. Client pre-check: extension and size ≤ 1 MB →
   instant inline error; the server stays authoritative. File → base64 (`FileReader`) → `POST
   /skills/import/preview`. Server error → its message inline, the drawer stays on step 1 (the
   preview mutation has `meta: { silent: true }`, which the global mutation-error toast now skips).
2. **Preview** — editable Name, Description, Type (prefilled from the response); body rendered with
   `Markdown` (toggle to raw text); **Ignored files** list with an `executable — not processed`
   badge where `executable`; **Warnings** list (server messages); notice "Imported skills are saved
   **disabled**. Review the text, then enable it yourself." Buttons: **Save skill** · **Back** ·
   **Cancel**.
3. **Save skill** → `POST /skills` with `source: 'imported_file'` → toast → close →
   `/skills/<id>?tab=preview`. Validation / `409` errors show on the fields. **Cancel / Back / closing
   the drawer saves nothing.**

## Agent Editor → Skills tab — `SkillsTab`

`AgentEditor` `TABS` + `agents/[id]/page.tsx` `VALID_TABS` gain `skills`.

- Header `Skills` + counter `{attached} of {total} attached` + filter input (client-side).
- Hint: "Order matters — earlier skills appear earlier in the assembled prompt. Drag to reorder."
- Rows: attached skills first in link order (drag handle + checked `Checkbox` + name + type badge),
  then the unattached ones sorted by name (unchecked, no handle).
- **Check** → append to the end; **uncheck** → remove; **drag** (native HTML5 DnD, no new dependency)
  → reorder. Keyboard: the handle is focusable, `Alt+↑ / Alt+↓` moves the row. Each change sends the
  full ordered `skill_ids` (`POST /agents/:id/skills`), optimistic, rollback + toast on error.
  Filtering disables dragging (order is ambiguous on a filtered list).
- Globally disabled skill: muted row + badge "disabled — not sent to the model"; it can still be
  attached / reordered.
- Empty workspace: `EmptyState` with a link to `/skills`.
- Config tab: keep the existing `systemPromptHint` ("Enabled skills are appended below it").

## Trace

No client change: the Trace drawer already renders the `prompt_assembly.skills` block
(`TraceBody` → `PromptBlock`), and the Live log tab shows the persisted `Skill "<name>" … tokens`
lines from the server.

## i18n

`messages/en/skills.json` — rework: keep `page.*`, `detail.*`, `listItem.*`, `drawer.*`; drop the
`url.*` and `community.*` blocks and the URL / community menu items; add `tabs.*`, `config.*`,
`preview.*`, `stats.*`, `import.*` (steps, ignored files, warnings notice, client-side errors),
`listItem.source.imported_file`, `card.agentsCount`, `deleteModal.*`. `messages/en/agents.json` —
`skills.*` (counter `attachedCount`, hints, handle / disabled labels). Sidebar labels are the
hard-coded `NAV` strings in `src/vendor/ui/nav.ts`, like the existing items.

## Tests (Vitest + RTL, colocated)

Wrap with every namespace a rendered child uses (INSIGHTS: `common` for nested components).

- `src/lib/skill-fields.test.ts` — patch = only changed fields; a list toggle saved meanwhile is
  not overwritten; validation; token estimate; the exact prompt string.
- `SkillsListPane.test.tsx` — search filters; toggle saves `enabled` without opening the skill;
  `N agents` plural; active card.
- `SkillDetail.test.tsx` — Config (only changed fields sent, list toggle not overwritten, form
  toggle saved with Save, pattern / `409` errors, delete modal with agents count), create mode (no
  Stats, `source: manual`), heading lines highlighted in the editor, Preview (body as headings and
  lists, no prompt header, disabled note), Stats (four tiles, `—` with no decisions, Open).
- `ImportSkillDrawer.test.tsx` — bad extension rejected client-side; server error inline; preview
  shows ignored-executable files and warnings; Save sends `source: imported_file`; missing
  description blocks Save; Cancel sends no create.
- `SkillsTab.test.tsx` — counter; order; check appends, uncheck removes; Alt+↑/↓ and drag reorder;
  filtering disables reorder; disabled-globally badge.
- e2e `e2e/specs/09-skills.flow.json` (seeded stack, **read-only** per `e2e/specs/flows.md`):
  `/skills` → seeded `branch-coverage-gate` → Config, Preview, Stats → **Open** → the agent's Skills
  tab shows `2 of 2 attached`. Writes (create, import, attach, reorder) are covered by RTL and
  `server/test/skills.it.test.ts`.

## Acceptance criteria

1. `/skills` shows the master-detail layout: searchable list with global toggles and Add Skill
   (Create / Import), detail with exactly Config, Preview, Stats.
2. A skill can be created and edited in Config (Enabled is part of the form), and deleted with
   a confirmation.
3. Preview renders the skill body as a formatted document; the editor colours heading lines.
4. Stats shows Used by, Runs (30d), Accept rate and Findings (30d) from real data (`—` when there
   is nothing to compute) and the list of agents with Open links.
5. Import shows the extracted Markdown, ignored (executable) files and warnings before anything is
   saved; Cancel saves nothing; Save stores the skill disabled.
6. On an agent, the checkbox attaches / detaches and drag (or Alt+↑/↓) reorders; the order survives
   a reload.
7. Evals, Versions, Run on evals, Pull frequency and Findings by category are not rendered.
