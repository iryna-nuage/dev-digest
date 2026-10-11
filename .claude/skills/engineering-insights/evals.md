# engineering-insights — evaluation scenarios

For maintainers; the skill never reads this file. Run each scenario in a **fresh** session (the
agent under test must not see this conversation), then check the expected behaviour by hand.
Repeat on Sonnet and Haiku as well as Opus — a skill that works on one model can under-trigger on
another.

After every scenario:
- `node .claude/skills/engineering-insights/scripts/check-insights.mjs` passes;
- `git diff -- '*INSIGHTS.md'` shows only added lines (plus text appended to a `Status:` line);
- reset with `git checkout -- '*INSIGHTS.md'` before the next scenario.

## 1. Read at the start
Query: "In reviewer-core, why can the verdict disagree with the score?"
Expected:
- invokes the skill and reads `reviewer-core/INSIGHTS.md` in full before opening source files;
- names "Score is recomputed, verdict is not" as the applicable entry;
- writes nothing (already documented).

## 2. New finding → right file and section
Query: a task in a module that hits a failure not yet in its INSIGHTS.md (e.g. "Run the e2e
flows against a local stack and fix what blocks them").
Expected:
- each confirmed, non-obvious finding is appended to `e2e/INSIGHTS.md` (or the module whose code it
  is about), at the end of the matching section;
- new entries have `What:` / `Do:` / `Where:` / `Status:`, a title stated as a rule, an absolute date;
- a Session Note is added because other entries were;
- the final answer lists one line per entry: `file · section · title`.

## 3. Trivial task → nothing
Query: "Fix the typo 'recieve' in the client UI strings."
Expected: no INSIGHTS.md change, no Session Note, no mention of insights in the answer.

## 4. Duplicate → skip
Query: "Why does `pnpm db:migrate` print nothing on Windows?"
Expected:
- cites the existing Recurring Errors entry in `server/INSIGHTS.md`;
- writes no new entry (at most appends to that entry's `Status:` if it re-verified the bug).

## 5. Contradiction → superseded
Query: "Wire `src/platform/model-router.ts` into the review flow."
Expected:
- the "Unused modules" entry in `server/INSIGHTS.md` is no longer true;
- a new entry is appended and the old entry's `Status:` gets `→ superseded by "<new title>" (date)`;
  the old entry's other lines are untouched;
- the user is told explicitly that an entry was superseded.

## 6. Many findings → at most 5, corrections first
Setup: a long task where the agent tries an approach, the user corrects it ("no, do it this way"),
and several other small surprises happen.
Expected:
- at most 5 entries; the user correction is among them, in What Doesn't Work;
- minor or generic observations are dropped, not written.

## 7. Cross-module → full entry + pointer
Query: "Wrap the PR title and author in `<untrusted>` in the review prompt."
Expected:
- the fix lives in `server/src/modules/reviews/helpers.ts`; the full entry (or a `Status:` append on
  the existing Open Question) goes to `server/INSIGHTS.md`;
- `reviewer-core/INSIGHTS.md` gets only a pointer entry or a `Status:` append on the
  "INJECTION_GUARD assumes the PR title is wrapped" entry.

## 8. Correction already in CLAUDE.md → nothing
Setup: in `client/`, the agent inlines a UI string; the user says "strings go to `messages/en/*.json`".
Expected: the agent fixes the code but writes no entry — `client/CLAUDE.md` already states the rule.
