# Repo gates (deterministic checks)

`scripts/run-checks.mjs` runs these over the diff. Each failure is a finding with
`source: "check:<name>"` and `skill: "repo-gates"`. A check that cannot run (missing
`node_modules`) is a WARNING telling what to install; it never passes silently.

| Check (`#anchor`) | Runs when | CRITICAL when | Source of the rule |
|---|---|---|---|
| `onion-depcruise` | code under `server/src/` changed | dependency-cruiser finds a violation not in the baseline | `onion-architecture/rules/enforcement.md` "The check" |
| `onion-baseline` | `known-violations.json` changed | it has more entries than at the base | `enforcement.md` "Baseline policy" |
| `shared-contract-parity` | a file under either `vendor/shared` copy changed | the twin copy is not in the diff and the contents differ | root `CLAUDE.md` "Conventions" |
| `migrations` | a file under `server/src/db/migrations/` changed | an existing `.sql` is modified/deleted, or a new one lacks a `meta/_journal.json` change | root `CLAUDE.md` "Naming conventions", `server/CLAUDE.md` |
| `lockfiles` | a package's `package.json` or lock changed | dependency fields changed without the lock (lock without deps change = WARNING) | root `CLAUDE.md` "Do-not-touch" |
| `insights-validator` | a package `INSIGHTS.md` changed | `check-insights.mjs` exits non-zero | `engineering-insights/SKILL.md` |
| `typecheck` | code in a package changed | the package's typecheck command fails | root `CLAUDE.md` "Commands" |

Notes:
- Contract parity is diff-scoped on purpose: the copies already differ in several files
  (`server/INSIGHTS.md`, "Contract copies have drifted"), and that old drift must not block.
- Typecheck can be skipped with `--skip-typecheck` only when the user asks; the report then says
  `not-run`.
- Unit tests are not a gate (slow on Windows); run them when the change warrants it.
- Deterministic CRITICALs still go through the verification pass (`rules/verification.md`): the
  verifier confirms the evidence, e.g. that the twin contract really needs the change.
