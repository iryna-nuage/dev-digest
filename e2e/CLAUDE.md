# e2e (@devdigest/e2e)

## Before answering
Search `e2e/docs/`, `e2e/INSIGHTS.md` first.

## Conventions (not obvious from code)
- `specs/*.flow.json` are executable flows, not documentation — don't put docs there.
- Deterministic locators only (`--url`, `--text`, `find`); never the AI `chat` command.

## Use when
- Flow format, running (hermetic vs own stack), coverage → read `e2e/README.md`
- Deep-dives → read `e2e/docs/` · findings → read `e2e/INSIGHTS.md`
