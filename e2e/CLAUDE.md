# e2e (@devdigest/e2e)

## Before answering
Search `e2e/docs/`, `e2e/INSIGHTS.md` first.

## Conventions (not obvious from code)
- `specs/*.flow.json` are executable flows (the runner loads only that suffix); `specs/flows.md`
  is their contract — update it together with the flows, keep prose out of the JSON.
- Deterministic locators only (`--url`, `--text`, `find`); never the AI `chat` command.

## Use when
- Flow format, running (hermetic vs own stack), coverage → read `e2e/README.md`
- Runner → agent-browser → stack topology, seed dependency, where it runs → read
  `e2e/docs/architecture.md`
- Flow file contract, runner guarantees, what each flow asserts → read `e2e/specs/flows.md`
- Findings → read `e2e/INSIGHTS.md`
