# L02 — Skills control experiment

Does attaching skills change what the **Test Quality Reviewer** finds? Each scenario runs the same
agent on the same PR twice: **without skills** and **with skills**. Everything else (model, system
prompt, PR head, repo-intel setting) stays the same.

> Fill the result tables **only from real runs**. Do not paste expected or invented findings.
> Empty cells mean "not run yet".

Spec: [`server/specs/L02-skills.md`](../../server/specs/L02-skills.md) → Control experiment.

## Setup (once)

1. Fresh stack: `./scripts/dev.sh` (migrate + seed). The seed creates **Test Quality Reviewer**
   with `branch-coverage-gate` and `mocking-discipline` attached.
2. Skills → Add Skill → **Import from file**:
   - `docs/skills/edge-case-checklist.md`;
   - `api-contract-tests.zip` built from `docs/skills/api-contract-tests/` (see
     [`docs/skills/README.md`](../skills/README.md)). The preview must list
     `scripts/check.sh` as *executable — not processed*.
3. Enable both imported skills (Config → Enabled → Save). They are saved disabled.
4. Note the agent's model: Agents → Test Quality Reviewer → Config.

## Procedure (per scenario)

1. **Without skills** — Agents → Test Quality Reviewer → **Skills**: uncheck every skill
   (`0 of N attached`). On the PR page: Run Review → Test Quality Reviewer.
2. **With skills** — check the scenario's skills, in the order listed below. Run the review again
   on the same PR head.
3. For each run, open **View trace**:
   - **Prompt assembly → Skills (dynamic)**: present only in the "with" run; one
     `### Skill: <name>` block per attached skill, in the tab's order;
   - **Live log**: `Skill "<name>" v<N> attached (<tokens> tokens)` per skill and
     `Skills: <n> active, <total> tokens` (or `Skills: none active`);
   - **Stats**: tokens in/out, cost; **Findings**.
4. Copy the values into the table and save a screenshot of the Skills block of the "with" run.

## Scenario 1 — uncovered cases (happy-path-only test)

PR: a function with a new branch / error path whose test covers only the happy path.

| | Without skills | With skills |
|---|---|---|
| PR (repo#number, head SHA) | | |
| Run id | | |
| Attached skills (in order) | — | `branch-coverage-gate`, `edge-case-checklist`, `mocking-discipline` |
| `Skills:` log line | | |
| Tokens in / out | | |
| Findings (title · severity · file:line) | | |
| Uncovered branch flagged? | | |
| Edge case flagged? | | |

## Scenario 2 — API breaking change (route signature change)

PR: a route whose request or response shape changes (renamed / now-required field, changed status),
with callers or tests not updated.

| | Without skills | With skills |
|---|---|---|
| PR (repo#number, head SHA) | | |
| Run id | | |
| Attached skills (in order) | — | `api-contract-tests`, `branch-coverage-gate` |
| `Skills:` log line | | |
| Tokens in / out | | |
| Findings (title · severity · file:line) | | |
| Breaking change flagged? | | |
| Missing / stale contract test flagged? | | |

## Notes

- A disabled skill (global Enabled off) stays attached but must not appear in the Skills block or
  the log — check it once by disabling one skill and re-running.
- LLM output varies between runs: if a result looks borderline, run the pair again and record both.
