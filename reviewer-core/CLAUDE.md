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
- Deep-dives → read `reviewer-core/docs/` · specs → read `reviewer-core/specs/` ·
  findings → read `reviewer-core/INSIGHTS.md`
