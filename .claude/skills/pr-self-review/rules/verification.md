# Verification pass (every CRITICAL)

A CRITICAL blocks only after an **independent second check**. `write-verdict.mjs` enforces it:
a CRITICAL without a `verification` object makes the verdict `incomplete`, which the gate blocks
like `block`. So skipping this pass never unblocks anything.

## Independence

- One fresh subagent per CRITICAL (`subagent_type: "general-purpose"`, never `fork`, never the
  reviewer that produced it). Launch all verifiers in one message, in parallel. More than 6
  CRITICALs → one verifier per file, each handling that file's CRITICALs.
- The verifier gets only what is listed below. Never pass the reviewer's reasoning, the other
  findings, or your own opinion of the finding.

## Verifier prompt (fill the `<…>` parts)

```
You are an independent verifier for a pre-PR self-review of the repo at <repo root>
(read-only: do not edit files, do not run git commands that change state).

Finding to verify (JSON):
<the finding, without any verification field>

Changed line ranges of <file> in this diff: <hunks for the file>
Rule it cites: read <path to the skill's SKILL.md / rule file / CLAUDE.md section>.
Severity rubric: read .claude/skills/pr-self-review/rules/severity-rubric.md.

Do:
1. Read <file> around line <line> yourself. Confirm the cited line is one of the changed
   ranges and that it says what the evidence claims.
2. For a `check:*` finding, re-run or re-read the evidence (e.g. compare both contract copies,
   read the depcruise rule) instead of trusting the output text.
3. Decide whether the rule really applies to this code and whether the effect meets CRITICAL
   in the rubric, not just WARNING. Speculation is not CRITICAL.

Answer with JSON only:
{"status": "confirmed" | "downgraded" | "rejected",
 "severity": "WARNING" | "SUGGESTION"   // only for downgraded
 "reason": "<one or two sentences with the concrete fact you checked>",
 "verifier": "independent-subagent"}
- confirmed: the code is as described and it is genuinely CRITICAL.
- downgraded: the issue is real but not CRITICAL.
- rejected: the evidence is wrong, the line is not changed code, or the rule does not apply.
```

## Recording

Copy the verifier's answer verbatim into the finding as `"verification": {…}` before calling
`write-verdict.mjs`. Never edit a verifier's status or reason. A verifier that fails or returns
invalid JSON → run it once more; still nothing → leave the finding unverified (verdict
`incomplete`) and tell the user.
