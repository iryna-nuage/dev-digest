---
name: pr-self-review
description: "Pre-PR self-review of ALL local changes in DevDigest (branch commits + staged + unstaged + untracked vs main). Maps every changed file to the project skills that own it (client UI files → frontend-architecture, react-best-practices, next-best-practices, react-testing-library; server files → onion-architecture, fastify-best-practices, drizzle-orm-patterns, postgresql-table-design; zod, security, typescript-expert by path or content), runs the repo's deterministic gates (onion dependency-cruiser, contract parity, migrations, lock files, INSIGHTS validator, typecheck), independently verifies every CRITICAL, and writes a verdict that blocks `gh pr create`, `gh pr merge` and `git push` while a verified CRITICAL remains. Use before opening or updating a pull request, before pushing a branch, when the pr-self-review gate blocked a command, or when the user runs /pr-self-review or asks to self-review, pre-review or check their changes before a PR."
disable-model-invocation: true
metadata:
  version: 1.0.0
  tags: code-review, pre-pr, merge-gate, skills-routing, workflow
---

# PR Self Review

Reviews the local diff with the skills that own each file, then writes a verdict that a Claude
Code hook enforces. **Only a CRITICAL that an independent verifier confirmed blocks.**

Scripts are dependency-free Node ≥ 22 and run the same in PowerShell and Git Bash. Run them from
the repo root. Intermediate files go to `.git/devdigest/review/` (local, never committed).

## Workflow

```
- [ ] 1. Plan:   node .claude/skills/pr-self-review/scripts/collect-diff.mjs --out .git/devdigest/review/plan.json
- [ ] 2. Context: read INSIGHTS.md + CLAUDE.md of every package in plan.packages
- [ ] 3. Gates:  node .claude/skills/pr-self-review/scripts/run-checks.mjs --out .git/devdigest/review/checks.json
- [ ] 4. Review: one reviewer per skill bucket → .git/devdigest/review/llm.json
- [ ] 5. Verify: one independent verifier per CRITICAL (checks + llm) → add `verification`
- [ ] 6. Verdict: node .claude/skills/pr-self-review/scripts/write-verdict.mjs --findings .git/devdigest/review/checks.json --findings .git/devdigest/review/llm.json
- [ ] 7. Report to the user (format below)
```

Create `.git/devdigest/review/` first if it is missing. An empty `plan.files` → write an empty
`llm.json` (`[]`), run step 6 on it and report PASS.

### 1. Plan
`plan.json` holds `files` (path, status, changed `hunks` as `[start, end]` new-side line ranges),
`buckets` (`skill → files`), `packages` and `unmappedSkills`. The base is `origin/main`, else
`main`; pass `--base <ref>` to every script when the user names another base.
The file→skill mapping lives in `skill-map.json`, not here. Each item of `unmappedSkills` (a
project skill neither mapped nor ignored) → add a WARNING finding
`{skill:"pr-self-review", rule:"skill-map.json", severity:"WARNING", title:"Skill <name> is not mapped", source:"check:skill-map"}`
to `llm.json` and suggest the mapping to the user. Don't edit `skill-map.json` during a review.

### 3. Gates
`rules/repo-gates.md` lists the checks. Never pass `--skip-typecheck` unless the user asks.

### 4. Review per skill
For each bucket, review only that bucket's files with only that skill:
- Bucket with ≤ 3 files and ≤ 150 changed lines → review inline yourself.
- Otherwise one `general-purpose` subagent per bucket, all launched in one message. Prompt:
  ```
  Review ONLY the changed lines of these files against the <skill> skill. Read-only.
  Read first: .claude/skills/<skill>/SKILL.md and the rule files it points to for this code,
  <package>/CLAUDE.md, .claude/skills/pr-self-review/rules/severity-rubric.md.
  Files and changed line ranges: <bucket files with their hunks from plan.json>
  See the change: git diff <plan.base> -- <files>  (untracked files: read them whole).
  For onion-architecture also run its "Review checklist" (rules/enforcement.md); for
  frontend-architecture run its "Workflow: placing new code" checklist over each new or moved file.
  Return a JSON array of findings in the rubric's shape with "source": "llm". [] if nothing.
  ```
- Merge every reviewer's array into `.git/devdigest/review/llm.json`. Don't edit severities;
  duplicates are merged by `write-verdict.mjs`.

### 5. Verify every CRITICAL
Follow `rules/verification.md` exactly: fresh subagent per CRITICAL from both `checks.json` and
`llm.json`, given only the finding, its hunks and the rule. Write each answer verbatim into the
finding's `verification` field in its file. Skipping this leaves the verdict `incomplete`, which
blocks.

### 6. Verdict
`write-verdict.mjs` drops findings that are not on a changed line, merges duplicates, applies the
verifications and writes `.git/devdigest/pr-self-review.json`, bound to a hash of the whole diff:
- `pass`: no confirmed CRITICAL;
- `block`: at least one confirmed CRITICAL;
- `incomplete`: a CRITICAL without verification.
Any later edit changes the hash, so the gate demands a new review.

### 7. Report
Print the script's table (CRITICAL → WARNING → SUGGESTION, with finding ids), the checks that ran
or were not run, what verifiers rejected or downgraded and why, and the verdict line. For
`block`, give one concrete fix per CRITICAL. Don't fix code unless the user asks.

## The gate

`scripts/gate.mjs` is a PreToolUse hook in `.claude/settings.json` for the Bash and PowerShell
tools. It blocks the agent's `gh pr create`, `gh pr merge` and `git push` (not `--dry-run`,
`--delete` or tag pushes) unless the verdict for the **current** diff is `pass` or `override`.
When it blocks, run this skill, then retry the command.
- It acts on Claude Code tool calls only. Git, gh and IDEs outside Claude Code are not affected,
  and no git hook or git config is installed.
- Every other command passes untouched, even if the gate errors (fail-open); a gated command it
  cannot check is blocked with the reason (fail-closed).
- Quoted strings and heredoc bodies are data, not commands: `git commit -m "…; git push"` is not
  gated. The flip side: a push hidden in `bash -c "git push"` is not seen either. The gate guards
  routine agent actions; never route a push around it.

## Override (false positives)

A confirmed CRITICAL the user judges to be a false positive or an accepted risk can be overridden
**by the user**, with a reason:

```
node .claude/skills/pr-self-review/scripts/override.mjs --reason "<why, ≥ 20 chars>" --finding <id> [--finding <id> ...]
node .claude/skills/pr-self-review/scripts/override.mjs --reason "<why>" --all
```

- Works only on a `block` verdict whose diff is unchanged, and must name every blocking finding.
- Records `by` (git `user.name`), time, reason and ids in the verdict (`verdict: override`) and
  appends them to `.git/devdigest/pr-self-review-overrides.jsonl`. The gate then lets the command
  through and shows the override. A later edit voids it.
- NEVER run it on your own initiative or invent the reason. Run it only when the user asks for an
  override in this conversation and gives the reason; pass their words. Otherwise tell them the
  command (they can run it as `! node …`).
- A PR opened after an override gets a "Self-review override" section in its description: the
  finding ids, titles and the reason.

## Gotchas

- `server/clones/` and everything else gitignored is never reviewed.
- The verdict lives in `.git/devdigest/`, per clone and per worktree; it is never committed.
- The contract-parity gate is diff-scoped: pre-existing drift between the two `vendor/shared`
  copies does not block (`server/INSIGHTS.md`, "Contract copies have drifted").
- Grounding checks a finding's single `line` against the hunks; it never iterates a line range a
  model supplied (`reviewer-core/INSIGHTS.md`, grounding entry).
- The hook is registered in exec form (`node` + `${CLAUDE_PROJECT_DIR}` path, no shell), so it
  behaves the same whether Claude Code hooks run through Git Bash or PowerShell on Windows.
- Script self-test: `node --test .claude/skills/pr-self-review/scripts/*.test.mjs`.
