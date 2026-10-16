# reviewer-core (@devdigest/reviewer-core)

## Before answering
Search `reviewer-core/docs/`, `reviewer-core/specs/`, `reviewer-core/INSIGHTS.md` first.

## Conventions (not obvious from code)
- No DB, filesystem, GitHub or network I/O; the only side effect is the injected `LLMProvider`.
- The only cross-package import is `@devdigest/shared` (alias → `../server/src/vendor/shared`).
- Uses npm, not pnpm.
- Untrusted text reaches the prompt only through `wrapUntrusted`.
- `INJECTION_GUARD` is the single prompt-injection defense; don't add keyword filters.

## Use when
- Pipeline, public API, tests → read `reviewer-core/README.md`
- Step-by-step data flow, boundaries, how the server calls it → read
  `reviewer-core/docs/pipeline.md`
- Engine invariants (mode, grounding, score, cost, cancellation, prompt safety, blockers) → read
  `reviewer-core/specs/review-engine.md`
- Findings → read `reviewer-core/INSIGHTS.md`
