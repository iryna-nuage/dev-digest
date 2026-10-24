# e2e flow contract

What a flow file must look like, how the runner treats it, and what each flow guarantees.
This file is documentation: the runner only loads `*.flow.json` (`run.ts`, `loadFlows`).
Runtime: [`../docs/architecture.md`](../docs/architecture.md).

## Flow file

`specs/NN-<kebab-name>.flow.json`. `NN` sets the run order (lexical).

```jsonc
{
  "name": "…",                      // required, printed in the summary
  "description": "…",               // optional: purpose + preconditions
  "steps": [
    { "cmd": ["open", "{BASE}/"],    // required: agent-browser argv; {BASE} → E2E_BASE_URL
      "label": "…",                  // optional log label (default: the joined cmd)
      "assert": { "stdoutIncludes": "…" } }   // optional extra stdout check
  ]
}
```

Types: `Flow` / `Step` in `lib/assert.ts`.

## Runner guarantees

| # | Rule |
|---|---|
| R1 | A step passes when its command exits 0 and, if `assert.stdoutIncludes` is set, its stdout contains that text. |
| R2 | The first failing step stops its flow (later steps don't run); the next flow still runs. |
| R3 | The run exits 0 only if every flow passed; with no flow files at all it exits 1. |
| R4 | The browser session is shared by all flows and closed at the end, pass or fail. |

## Authoring rules

- Deterministic locators only: `wait --url`, `wait --text`, `find role|text|label …`. Never the
  AI `chat` command.
- Read-only seeded data only: never submit a form that writes, never start a review. No LLM call
  and no API key.
- Assume a freshly seeded DB where `acme/payments-api` is the only repo; put any other
  precondition in `description`.

## Coverage — what each flow asserts

| Flow | Starts at | Asserts |
|---|---|---|
| `01-app-boot` | `/` | redirect to `/pulls`; heading "Pull Requests" |
| `02-repo-pulls-detail` | `/` | seeded PR row → `/pulls/482` shows its title |
| `03-agents` | `/agents` | seeded agent "Security Reviewer" |
| `04-pr-findings` | `/` | PR #482 → Agent runs (`tab=findings`): "request changes", "2 findings", the seeded CRITICAL finding card |
| `05-pr-diff` | `/` | PR #482 → Files changed (`tab=diff`): `src/config.ts` in the diff viewer |
| `06-onboarding` | `/onboarding` | "Add a repository" form with "Repository URL" (not submitted) |
| `07-settings` | `/settings/api-keys`, `/settings/models` | sections "API Keys" and "Feature Models" |
| `08-pr-severity-filter` | `/` | PR #482 → Agent runs: pills "1 CRITICAL", "1 WARNING"; **Critical** filter keeps the CRITICAL card; clicking it again brings back the WARNING card |
| `09-skills` | `/skills` | "Select a skill"; seeded `branch-coverage-gate` → Config ("Configuration"), Preview (rendered body), Stats ("Test Quality Reviewer"); **Open** → agent Skills tab "2 of 2 attached" |

A UI change that breaks one of these assertions changes this contract: update the flow and this
table together.
