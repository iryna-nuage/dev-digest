---
name: edge-case-checklist
description: Use when a diff adds or changes tests for a function that takes input — flag the corner cases the tests skip (empty, null, boundaries, invalid input, failing dependency).
type: rubric
---

# Edge-case checklist

For each function whose tests the diff adds or changes, check that the tests cover
the cases that apply to its inputs. Report each missing case that could hide a real
bug as one finding, citing the production line that handles (or should handle) it.

## Inputs
- Empty value: `''`, `[]`, `{}`, a file with no lines.
- Absent value: `null`, `undefined`, a missing optional field.
- Boundaries: `0`, `1`, the maximum allowed, one past the maximum, negative numbers.
- Duplicates and ordering: the same item twice, unsorted input.
- Invalid input: wrong type, malformed string, value outside an enum.

## Outcomes
- The error path: what the function throws or returns, and the HTTP status a route
  sends for it.
- A failing dependency: the database, network or LLM call rejects or times out.

Do not ask for cases that cannot occur given the function's types and its callers.
