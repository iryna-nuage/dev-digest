# Severity rubric

The same scale and anti-inflation rule as the server reviewer prompts
(`docs/agent-prompts/general-reviewer.md` "Severity", `docs/agent-prompts/README.md`
"Required conventions"), so a self-review and a DevDigest review of the same change agree.
The enum is exactly `server/src/vendor/shared/contracts/findings.ts` `Severity`.

## Levels

- **CRITICAL**: the only level that blocks. One of:
  - a defect that, once merged, can cause a security breach, data loss or corruption, incorrect
    results, a crash, or a broken contract that callers depend on;
  - a breach of a rule the repo marks mandatory and checks mechanically (`rules/repo-gates.md`);
  - a breach of a rule a skill or a `CLAUDE.md` states as MUST/NEVER **for new code**, when the
    changed line is the breach and the effect is concrete (e.g. a server service importing
    Drizzle: onion `inner-rings-no-framework-or-db`). Name the rule.
- **WARNING**: a real problem worth fixing that does not block: a missed edge case, degraded
  behaviour, a maintainability or performance risk, an architecture rule bent but not broken, a
  convention drift.
- **SUGGESTION**: a minor improvement or nit; safe to merge without it.

## Anti-inflation

- Assign the severity you would defend to the author's face.
- Speculative wording ("might", "could potentially", "if X isn't handled elsewhere") is at most
  WARNING, never CRITICAL.
- Legacy code that the change does not touch is never a finding. Legacy patterns the onion
  baseline tolerates (`onion-architecture/SKILL.md` "Legacy patterns") are not findings unless the
  changed lines add a new instance.
- Style, naming and "I would have done it differently" are SUGGESTION at most.
- If you would dismiss your own finding as a likely false positive, do not report it.
- There is no quota: zero findings is a good answer. No duplicates.

## Finding shape

```json
{
  "skill": "onion-architecture",
  "rule": "[O5] rules/application-services.md",
  "severity": "CRITICAL",
  "file": "server/src/modules/pulls/service.ts",
  "line": 42,
  "title": "Service imports drizzle-orm",
  "evidence": "the changed line 42: import { eq } from 'drizzle-orm'",
  "fix": "Move the query into repository.ts behind a port",
  "source": "llm"
}
```

- `file` is the repo-relative POSIX path, `line` a **changed** line of that file (in the plan's
  `hunks`). Findings off the changed lines are dropped as ungrounded.
- `rule` is checkable: a source id and/or a rule file of the skill, or a CLAUDE.md section.
- `evidence` quotes or describes the changed code; `fix` is one concrete step.
