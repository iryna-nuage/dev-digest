# L01 — Findings by severity (client)

HW1 criteria 16–23: severity counters and a severity filter in the expanded Review runs card,
non-clickable severity icons in the Timeline with a read-only findings preview on hover / focus, a
FINDINGS column with the same read-only "N FINDINGS IN THIS RUN" popover on the PR list, Accept /
Reject on finding cards, and findings in the Trace drawer (already present). The PR-list data rule ("this run") is defined in
[`server/specs/L01-findings-severity.md`](../../server/specs/L01-findings-severity.md). The client never
decides which run is the latest. It only counts and filters what it receives.

## Data the client reads

| Data | Endpoint / hook | Used by |
|---|---|---|
| `ReviewRecord[]` with `findings[]` and `run_id` | `GET /pulls/:id/reviews` · `usePrReviews` (the PR page already loads it) | Review runs cards, Timeline icons + popover, Trace drawer |
| `RunSummary[]` | `GET /pulls/:id/runs` · `usePrRuns` | Timeline rows (unchanged) |
| `PrMeta.latest_findings` (`PrFindingPreview[] \| null`) | `GET /repos/:id/pulls` · `usePulls` | PR list FINDINGS column + popover |

No new hooks, no new requests, no polling changes. Hover and filter clicks never hit the network or
an LLM. The contract comes from `@devdigest/shared`. `client/src/vendor/shared/contracts/platform.ts`
must mirror the server copy (server spec → Contracts).

## Shared: counting by severity

`src/components/severity-counts/` (used by all three placements, so the counting rule exists once):

- `SEVERITIES = ["CRITICAL", "WARNING", "SUGGESTION"]`: the display order everywhere.
- `countBySeverity(findings)` → `{ CRITICAL, WARNING, SUGGESTION }`: a simple tally of `severity`.
  Unknown values are ignored.
- `SeverityIconCounts`: icon + number for every **non-zero** severity, using the `SEV` tokens from
  `@devdigest/ui` (octagon / triangle / lightbulb). Icon and number together, never colour alone. It is
  not interactive and has an `aria-label` such as "2 critical, 1 warning".

## Shared: read-only findings preview popover

`src/components/findings-popover/` — `FindingsPopover` (used by the Timeline and the PR list, so the
preview exists once). It takes `findings: PrFindingPreview[]`; a `FindingRecord` is a superset, so the
PR page passes its persisted findings as they are.

- **Trigger:** `SeverityIconCounts` of `countBySeverity(findings)` — the icons are derived from the
  same array the popover lists, so they always match. A focusable `<span tabIndex=0>` with a dotted
  underline and the default cursor: **no `onClick`, no `button` role — it is not clickable.**
- **Opens** on hover **or keyboard focus**. **Closes** when the pointer leaves both the trigger and
  the popover (a short grace delay lets the pointer move into it), and on Escape, blur, page scroll or
  resize.
- **Header:** `N FINDINGS IN THIS RUN` (N = `findings.length`).
- **One read-only preview per finding**, in the order given: severity icon, title, category,
  `file:start-end` (`file:start` when equal), `NN% conf`, rationale as plain text clamped to 2 lines.
- **No buttons, links or inputs.** Accept / Reject exist only on the Review runs cards (criterion 22).
- Rendered through a portal with `position: fixed` under the trigger (the PR-list table card has
  `overflow: hidden`). Max height ~360 px with internal scroll. Clicks inside stop propagation, because
  React portals bubble to the host row's `onClick`.
- Pure props: hover / focus never fetches and never calls an LLM.

## Placement 1 — PR page → Agent runs → Review runs → expanded run card (criteria 16–18, 22)

`ReviewRunAccordion` body: `VerdictBanner` (verdict + PR SCORE), then `FindingsPanel`:

```
┌ Request changes · 3 findings · 2 blockers                       (38) PR SCORE ┐   ← VerdictBanner (unchanged)
[⊘ 2 CRITICAL] · [⚠ 1 WARNING]                                       ← SeverityPills
[⊘ Critical] [⚠ Warning] [💡 Suggestion]          Hide low confidence ○  ← SeverityFilterBar + existing toggle
┌ ⊘ Hardcoded Stripe secret key in commit  security  src/config.ts:12  98% conf ┐
│   … rationale / suggested fix …                         [✓ Accept] [✕ Reject] │   ← FindingCard
```

**One collection, one rule.** The pills and the filter work on the findings the card already shows:

```
eligible = visibleFindings(findings, hideLow)   // the card's existing visibility rules, incl. "Hide low confidence"
pills    = countBySeverity(eligible)
shown    = severity ? eligible.filter(f => f.severity === severity) : eligible
```

There is no separate rule for the counts. A pill's number always equals the number of cards of that
severity rendered below when no severity filter is active (criterion 17). Accepted and rejected
findings are cards too, so they count.

- **Pills row** (`FindingsPanel/_components/SeverityPills/`): `N CRITICAL · N WARNING · N SUGGESTION`
  in that order, **only severities with N > 0**. Each pill has the severity icon and colour, joined by
  `·`.
- **Filter buttons** (`FindingsPanel/_components/SeverityFilterBar/`): always the three buttons
  **Critical**, **Warning** and **Suggestion**, in the row under the pills, to the left of "Hide low
  confidence". Native `<button aria-pressed>`.
  - Clicking an inactive button leaves only that severity's cards. The others are hidden, not removed
    from the run.
  - Clicking the **active** button again clears the filter and brings back the run's full list.
  - Clicking another button switches the filter.
  - A button whose count is 0 is `disabled`, unless it is the active one (so it can still be cleared).
- Both rows render only when the run has at least one finding. A run with no findings keeps the
  existing empty state. If "Hide low confidence" hides everything, the pills row is empty, the
  buttons are disabled, and the existing "No findings match" state shows.
- The filter state is local to each card (one `useState` in `FindingsPanel`). It is not in the URL, and
  it resets when the card is collapsed (the panel unmounts).
- Keyboard: j/k focus resets to the first visible card when the filter changes. `a` / `d` act on the
  focused **visible** card.
- **Finding card actions (criterion 22):** buttons **Accept** and **Reject**. The tag on a rejected
  finding reads "rejected". Only the labels change: the action stays `dismiss`, the field stays
  `dismissed_at`, and the shortcut stays `d`. The card root gets `data-severity` (used by tests).

## Placement 2 — Timeline (criterion 16: icons without a click, preview on hover)

`RunHistory`, settled (`done`) run row, second line: `⊘2 ⚠1 · 2 blockers` instead of
"N finding(s)".

- Data: `FindingsTab` builds `findingsByRun` (`run_id → that run's review findings`) from the same
  `ReviewRecord[]` and passes it to `RunHistory`. These are all of the run's findings (the Timeline has
  no confidence toggle), ordered with the existing `visibleFindings(findings, false)` — the order of
  that run's Review runs card.
- The icons are the shared `FindingsPopover` trigger: hovering or focusing them opens the read-only
  `N FINDINGS IN THIS RUN` preview of **that run's** findings (shared section above).
- **Not clickable:** the icons have no click action. Clicking them does nothing — no jump to the
  review, no trace drawer, no filter. The agent-name link ("jump to this run's findings"), the trace
  icon and the cost badge keep their current behaviour.
- The run has no review (the review was deleted) → the existing "N finding(s)" text, no popover. A
  review with zero findings → the existing "0 finding(s)", no popover.
- `running`, `failed` and `cancelled` rows and commit rows are unchanged.

## Placement 3 — PR list, FINDINGS column (criteria 20–21)

`src/app/repos/[repoId]/pulls/` — `constants.ts` (`COLUMN_KEYS`, `GRID`), `styles.ts`, `PRRow`.

- New column **Findings** between *Score* and *Status* (the mock order).
- Cell: the shared `FindingsPopover` with `pr.latest_findings` (server order: severity, then
  confidence). `null` or `[]` → `—`, with no popover.
- Clicks inside the popover don't navigate (it stops propagation); clicking elsewhere in the row still
  opens the PR.
- No request on hover: everything comes from the `usePulls` payload.

## Placement 4 — Trace drawer (criterion 23, existing; regression only)

`page.tsx` passes the findings of the review whose `run_id` is the traced run to `RunTraceDrawer`
→ `TraceBody` → `FindingsSection`, next to the Stats (incl. COST). This feature doesn't change it
and doesn't touch the trace API. A regression test pins it.

## i18n (`messages/en/prReview.json`)

| Key | Value |
|---|---|
| `severity.CRITICAL` / `.WARNING` / `.SUGGESTION` | `Critical` / `Warning` / `Suggestion` (filter buttons) |
| `severity.pill.CRITICAL` / `.WARNING` / `.SUGGESTION` | `{count} CRITICAL` / `{count} WARNING` / `{count} SUGGESTION` |
| `severity.summaryLabel` | `{critical} critical, {warning} warning, {suggestion} suggestion` (aria-label) |
| `panel.filterBySeverity` | `Filter by severity` (button group label) |
| `list.columns.findings` | `Findings` |
| `findingsPopover.title` | `{count, plural, one {# FINDING} other {# FINDINGS}} IN THIS RUN` (shared popover; was `list.findingsPopover.title`) |
| `finding.dismiss` / `finding.dismissed` | `Reject` / `rejected` (were `Dismiss` / `dismissed`) |

Upper-case strings are literal, not CSS `text-transform`, so DOM text, `innerText` and e2e all see
"CRITICAL" and "FINDINGS IN THIS RUN".

## Out of scope

- Clickable Timeline icons (criterion 16 says no click) — the Timeline popover is hover / focus only.
- A page-level filter across runs; persisting the filter in the URL.
- Any change to the trace API or drawer layout.
- Unrelated L01 work (run cost, CLAUDE.md, package docs/specs) — covered by their own specs and docs.

## Acceptance criteria

| # | HW1 | Given | Then |
|---|---|---|---|
| FC1 | 16 | Expanded card with 2 CRITICAL + 1 WARNING | Under the verdict / PR SCORE: `2 CRITICAL · 1 WARNING`, no SUGGESTION pill |
| FC2 | 17 | Same card, with and without "Hide low confidence" | Each pill's number = cards of that severity rendered below |
| FC3 | 18 | Click **Critical**, then **Critical** again | Only CRITICAL cards, then the run's full list again |
| FC4 | 18 | Click **Critical**, then **Warning** | Only WARNING cards; Critical no longer pressed |
| FC5 | 16 | Timeline, `done` run with findings | Severity icons with counts; clicking them does nothing |
| FC12 | 16 | Timeline, hover or focus a run's icons | Popover `N FINDINGS IN THIS RUN` with **that run's** findings (icon, title, category, file:line, % conf, rationale); no buttons |
| FC6 | 20 | PR list, hover the FINDINGS icons | Popover titled `N FINDINGS IN THIS RUN` |
| FC7 | 21 | Same popover | Each preview shows icon, title, category, file:line, % conf, rationale; no buttons |
| FC8 | 20 | PR list, `latest_findings` `null` or `[]` | `—`, no popover |
| FC9 | 22 | Expanded finding card on the PR page | Buttons **Accept** and **Reject** |
| FC10 | 19 | Opening the page, toggling filters, hovering (PR list or Timeline) | No extra API request, no LLM call |
| FC11 | 23 | Trace drawer of a run | Its findings are listed (unchanged behaviour) |

## Tests (Vitest + RTL)

- `severity-counts`: `countBySeverity` (incl. unknown severity, empty input); `SeverityIconCounts`
  shows only non-zero severities and no `button`.
- `FindingsPanel/helpers.test.ts` (new): severity filtering on top of `visibleFindings`.
- `FindingsPanel.test.tsx`: FC1–FC4, pill count = `[data-severity=…]` cards (FC2, with "Hide low
  confidence" toggled), disabled zero-count button, j/k reset. `useFindingAction().mutate` and
  `fetch` are not called while filtering (FC10).
- `ReviewRunAccordion.test.tsx` (new): the pills follow the `VerdictBanner` in DOM order (FC1
  placement). The delete hook is mocked.
- `RunHistory.test.tsx`: icons + blockers for a `done` run (FC5); the icons are not a button and a
  click triggers neither `onGoToReview` nor `onOpenTrace`; hover / focus opens the popover with that
  run's findings only, no buttons, no `fetch` (FC12, FC10); fallback text without findings.
- `FindingCard.test.tsx`: the button reads "Reject" and still fires `"dismiss"` (FC9).
- `PRRow.test.tsx`: FINDINGS cell (FC8), hover → popover title and preview fields, no buttons inside
  (FC6–FC7). The provider needs the `common` namespace (`client/INSIGHTS.md`).
- `RunTraceDrawer.test.tsx`: a regression assertion that the passed findings render in the drawer
  (FC11).

## e2e (`e2e/specs/08-pr-severity-filter.flow.json`, seeded PR #482, no model call)

PR list → open PR #482 → Agent runs → `1 CRITICAL` and `1 WARNING` pills → click **Critical** →
`Hardcoded Stripe secret key in commit` still visible → click **Critical** again →
`N+1 query in user list endpoint` visible. The flow has no hover step and doesn't assert that a card
disappears: the PR-list popover (FC6–FC7) and card hiding (FC3) are covered by the RTL tests above.
