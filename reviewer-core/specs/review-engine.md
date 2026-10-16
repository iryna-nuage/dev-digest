# Review engine contract

Behaviour of `reviewPullRequest()` and the helpers the server relies on, which must stay true.
Data flow: [`../docs/pipeline.md`](../docs/pipeline.md). Tests: `test/run.test.ts`,
`test/prompt.test.ts`, `test/to-review.test.ts`.

## Inputs / outputs

| | Contract |
|---|---|
| Required input | `systemPrompt`, `model`, `diff: UnifiedDiff`, `llm: LLMProvider` |
| Optional input | `strategy` (`auto` default), `repoMap`, `callers`, `prDescription`, `task`, `skills`, `memory`, `specs`, `maxRetries` (default 2), `mapThresholdLines` (default 400), `sessionId`, `onEvent`, `checkCancelled` |
| Output | `ReviewOutcome { review, grounding, dropped, mode, assembly, chunks, tokensIn, tokensOut, costUsd, raw }` |
| Side effects | only `llm.completeStructured()` calls — no DB, filesystem, GitHub or network access |

## Invariants

| # | Rule | Pinned by |
|---|---|---|
| E1 | **Mode:** `single-pass` → one LLM call with the whole diff. `map-reduce` → one call per file, but only for multi-file diffs. `auto` → `map-reduce` only when the diff has > `mapThresholdLines` changed lines **and** > 1 file. | `run.test.ts` (single-pass); `run.ts` `selectMode` (map-reduce: no test yet) |
| E2 | **Grounding:** a finding is kept only if its file is in the diff and `[start_line, end_line]` intersects a hunk's new-side lines. `secret_leak`, `lethal_trifecta`, `phantom`, `hook` findings only need the file to be in the diff. Every dropped finding is returned in `dropped` with a reason. | `run.test.ts` ("drops the hallucinated finding", `grounding = "1/2 passed"`) |
| E3 | **Score** = `clamp(100 − 35·CRITICAL − 12·WARNING − 3·SUGGESTION, 0, 100)` over the **kept** findings; the model's score is ignored. No findings → 100. | `run.test.ts` (65 for one CRITICAL; clean approve = 100) |
| E4 | **Verdict** is the model's (the worst across chunks); grounding does not change it. | `reduce.ts` (`VERDICT_RANK`) |
| E5 | **Cost:** `costUsd` = sum of per-call costs; `null` as soon as any call's cost is unknown. Tokens always sum. | `run.ts` |
| E6 | **Cancellation:** `checkCancelled()` runs before every LLM call; if it throws, no further call is made and the error propagates unchanged. | `run.test.ts` ("aborts before the LLM call") |
| E7 | **Sessions:** `sessionId`, when given, is forwarded on every LLM call. | `run.test.ts` |
| E8 | **Prompt safety:** the system prompt is the agent prompt + `INJECTION_GUARD`; PR description, repo map, callers and diff are wrapped by `wrapUntrusted()` (a literal `</untrusted>` inside is escaped); the PR description is truncated to 4,000 chars; empty slots are omitted. | `prompt.test.ts` (guard, PR description wrap/omit, 4k cap); `prompt.ts` (other slots, escaping) |
| E9 | **Blockers:** `countBlockers(findings, failOn)` counts findings with severity rank ≥ the policy floor (`critical` → CRITICAL, `warning` → WARNING+, `any` → all, `never` → 0) and agrees with `gateTriggered`. | `to-review.test.ts` |

## Not in the contract

- Which provider or model runs. The caller injects `llm`.
- Persistence, run status, SSE and traces. These belong to the server (`server/specs/`).
