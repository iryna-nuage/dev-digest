---
name: engineering-insights
description: Reads and appends engineering insights in the per-module INSIGHTS.md files (server/ incl. repo-intel, client/, reviewer-core/, e2e/). Use at the start of every task to load the insights of the module the request touches or asks about. Use again, proactively and without being asked, when work uncovers something a future agent would otherwise relearn - a root cause, a failed approach, a fix that worked after a failed attempt, a user correction, an undocumented convention or trade-off decision, a dependency quirk, a repeated error, or an unverified suspicion. Run the wrap-up at the end of every non-trivial task before reporting it done, or when the user says "wrap up", "save insights", "what did we learn" or runs /engineering-insights. Entries go append-only under fixed sections - What Works, What Doesn't Work, Codebase Patterns, Tool & Library Notes, Recurring Errors & Fixes, Session Notes, Open Questions.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Edit(**/INSIGHTS.md)
  - Write(**/INSIGHTS.md)
  - Bash(node .claude/skills/engineering-insights/scripts/check-insights.mjs *)
---

# Engineering Insights

Goal: an agent opening a module's `INSIGHTS.md` reads one entry and knows what to do, without
re-investigating. The files are committed, shared, append-only, and reviewed by humans via `git diff`.

## Module map

| Code the request or insight is about | File |
|---|---|
| `server/**` (incl. `src/modules/repo-intel/**` → area `repo-intel`), `scripts/**` | `server/INSIGHTS.md` |
| `client/**` | `client/INSIGHTS.md` |
| `reviewer-core/**` | `reviewer-core/INSIGHTS.md` |
| `e2e/**` | `e2e/INSIGHTS.md` |

Pick the file by the code the insight is about, not by where you happened to be working. An insight
spanning two modules → full entry where the fix lives, plus a pointer entry in the other
(`What: see <module>/INSIGHTS.md · "<title>"`). File missing → create it from
[assets/insights-template.md](assets/insights-template.md).

## Read — at the start of every task (mandatory)

After the user's prompt and before acting, read in full the file of every module the request
touches or asks about — once per module per session; when the work moves to another module, read
its file too. Name the entries that apply in one line and follow them; if none apply, say nothing.

Treat entries as high-confidence guidance, but records go stale: before an entry drives a decision,
cheaply verify it (does the `Where:` code still look like that?). Stale → write a superseding entry.
Skip this step only for questions that are not about the code.

## Is it worth an entry?

All of these must hold:
- **Non-obvious** — a competent developer with the repo and `git log` would not know it.
- **Paid for** — it cost a failed attempt, a surprise, or tracing several files.
- **Recurs** — a future task in this module can hit it.
- **Stable** — not about code that is being rewritten right now.
- **Specific** — you can name the symbol, number, condition or exact error. If you can't yet,
  don't write it — at most an Open Question.

Never write: general programming knowledge, one-off typos, anything CLAUDE.md / README / docs /
specs / INSIGHTS.md already say, what you would do by default anyway, plans (record outcomes),
chat replay, secrets or tokens. Nothing qualifies → write nothing. Don't force it.

## Sections

| Section | Goes here |
|---|---|
| What Works | an approach that worked — especially after another one failed — and why |
| What Doesn't Work | a dead end, an antipattern, a mistake agents keep making, a user correction; name the thing not to retry. The most skipped and the most valuable section |
| Codebase Patterns | an undocumented convention or architectural decision, with its reason |
| Tool & Library Notes | a dependency or tooling quirk: version, flag, platform, duplicate instances |
| Recurring Errors & Fixes | exact error text or symptom → cause → fix |
| Session Notes | wrap-up only, and only when this session added another entry |
| Open Questions | suspected but unverified, or unresolved: what is known, what to check |

## Entry format

```
### YYYY-MM-DD · <area> · <the lesson stated as a rule>
What: <the fact: names, numbers, conditions, exact error text; for a dead end, what failed and why>
Do: <an imperative the next agent can be checked against: a verb, ALWAYS or NEVER>
Where: path:line · path:line
Status: open | fixed (YYYY-MM-DD) | by design | unverified | superseded by "<title>" (YYYY-MM-DD)
```

Session Notes entry:

```
### YYYY-MM-DD · <task>
<1–2 lines: what was done, which entries were added>
Where: path:line · path:line
```

**Every dated entry — Session Notes included — needs `Where:` with at least one `path:line`** (or
`path:start-end`) pointing at the code, test or spec it is about; for a Session Note, the task's main
artifacts. Never the line of the INSIGHTS entry itself. A missing or empty `Where:`, or one with paths
but no line number, fails the validator. Absolute dates; `Where:` paths relative to the module (another
module's file: from the repo root), forward slashes; field keys in English.

Bad → good:
- ❌ "Promises can be tricky." → ✅ "`Promise.all()` in the ingest pipeline times out after 30
  items — use `Promise.allSettled()` in batches of 10."
- ❌ "Be careful with async state." → ✅ "Checkout state always goes through Zustand
  (`cartStore.ts`): three components share the cart, so local state breaks it."
- ❌ "Migrations are flaky on Windows." → ✅ "On Windows `pnpm db:migrate` exits 0 without
  migrating: the entrypoint guard compares `import.meta.url` with `file://${argv[1]}`. Compare with
  `pathToFileURL(argv[1]).href`; confirm by the `✓ migrations applied` line."

## Write — append-only

1. Re-read the target file in full now; don't rely on what you read at the start.
2. Same insight already there → don't write; report it as skipped. New facts about an existing
   entry → a new entry that names the old title. Contradicts an existing entry → a new entry, append
   `→ superseded by "<new title>" (YYYY-MM-DD)` to the old entry's `Status:`, and tell the user.
3. Insert at the end of the chosen section. Never edit, reorder or delete other entries; the only
   permitted change to an old entry is appending to its `Status:` line. Sole exception: when the user
   explicitly authorizes a one-time compliance repair, an old entry's `Where:` may get missing
   `path:line` evidence — nothing else in it changes; validate that repair with
   `--skip-append-check` and commit it on its own.
4. Run `node .claude/skills/engineering-insights/scripts/check-insights.mjs <file>` and fix until it
   passes (it checks sections, entry fields, `path:line` evidence and append-only against HEAD).

## When to capture

Capture as soon as a fact is confirmed (fix verified, cause found), not "later".

Wrap-up: at the end of every non-trivial task, before reporting it done — not at session end, the
context may be cut first. Go through the task in this order: user corrections, failed attempts,
things that broke twice, surprising library or tool behaviour, decisions with trade-offs, loose ends.
Write at most 5 entries, strongest first. A trivial task (typo, quick answer) needs no wrap-up.

## Report

One line per entry: `<file> · <section> · <title>`, plus `Skipped: <title> (already documented)`.
Nothing written → say nothing about insights.
- The validator warns about size → tell the user the file needs consolidation. Don't prune it yourself.
- An entry every task in the module must obey → suggest promoting it to that module's CLAUDE.md.
  Don't edit CLAUDE.md yourself.

## Gotchas

- Never write insights into this skill's own files.
- Project knowledge goes to INSIGHTS.md (shared, in git), not to personal auto-memory.
- Insights about the do-not-touch dirs (`server/src/vendor/shared`, `server/src/db/migrations`) go
  to `server/INSIGHTS.md`; the dirs themselves are never edited for this.
- The validator is dependency-free Node; the repo guarantees Node ≥ 22, not Python. Its self-test:
  `node --test .claude/skills/engineering-insights/scripts/check-insights.test.mjs`.
