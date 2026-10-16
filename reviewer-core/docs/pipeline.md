# reviewer-core pipeline

How one call to `reviewPullRequest()` (`src/review/run.ts`) turns a diff into a grounded review.
Public API overview: [`../README.md`](../README.md) · invariants: [`../specs/review-engine.md`](../specs/review-engine.md).

## Boundaries

- **In:** an already-parsed `UnifiedDiff`, the agent's system prompt + model id, an injected
  `LLMProvider`, optional prompt slots (`repoMap`, `callers`, `prDescription`, `task`, `skills`,
  `memory`, `specs`), optional `onEvent` / `checkCancelled` callbacks.
- **Out:** a `ReviewOutcome` — grounded `Review`, grounding summary, dropped findings with reasons,
  mode, prompt assembly, chunk labels, tokens, `costUsd`, raw model output.
- **No I/O of its own:** no DB, filesystem, GitHub or network; the only side effect is
  `llm.completeStructured()`. Contracts (`Review`, `Finding`, `UnifiedDiff`, `LLMProvider`) come
  from `@devdigest/shared` (`../server/src/vendor/shared`).
- **Consumer:** the server's `server/src/modules/reviews/run-executor.ts`, which imports the TypeScript source
  through a tsconfig alias, gathers the slots (repo map, callers, PR body) and persists the outcome.

## Steps

```
selectMode ─▶ chunks ─▶ for each chunk: checkCancelled → assemblePrompt → llm.completeStructured
                                                                              │ (tokens, cost)
            ◀──────────────────────────────────────────────── partial Review ◀┘
reduceReviews(partials) ─▶ groundFindings(diff) ─▶ score = scoreFromFindings(kept) ─▶ ReviewOutcome
```

1. **Mode** (`selectMode`): `single-pass` = one chunk with the whole diff; `map-reduce` = one
   chunk per changed file (`sliceDiff`). The server passes the agent's `strategy`, defaulting to
   `single-pass` (`REVIEW_STRATEGY` in `server/src/modules/reviews/constants.ts`).
2. **Prompt** (`src/prompt.ts`, `assemblePrompt`): system = agent prompt + `INJECTION_GUARD`;
   user = ordered sections (PR description, skills, memory, repo skeleton, project context,
   callers, diff). Untrusted text is fenced with `wrapUntrusted()`; empty slots are omitted.
3. **LLM call** (`src/llm/structured.ts`): Zod `Review` schema → JSON Schema, parse with repair
   and up to `maxRetries` re-prompts. Tokens and cost are summed across chunks.
4. **Reduce** (`src/review/reduce.ts`, `reduceReviews`): concatenate findings, keep the worst
   verdict, average the model scores (single-pass: one partial, unchanged).
5. **Grounding** (`src/grounding.ts`, `groundFindings`): drop findings whose cited lines don't hit
   the diff; dropped ones are reported, never silently lost.
6. **Score**: recomputed from the surviving findings (`scoreFromFindings`); the model's score is
   discarded.

`onEvent` reports each step (`info` / `tool` / `result` messages) — the server forwards these to
the run's SSE stream and trace log.

## Other exports

- `countBlockers` / `gateTriggered` (`src/output/to-review.ts`): severity-vs-policy gate used by
  the server for the run's `blockers` count.
- `toReviewPayload`: grounded review → GitHub review payload (CI path, not used by the studio yet).
- `OpenRouterProvider` (`src/llm/openrouter.ts`): the OpenAI-compatible structured provider the
  server uses for `openrouter` agents.
