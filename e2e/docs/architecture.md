# e2e architecture

How the browser suite runs and what it depends on. The flow file format, env knobs and
commands are in [`../README.md`](../README.md); the contract each flow guarantees is in
[`../specs/flows.md`](../specs/flows.md).

## Runtime topology

```
run.ts ──execFile──▶ agent-browser CLI ──CDP──▶ headless Chrome (one shared session)
                                                      │ HTTP
                                                      ▼
                         client (Next.js, E2E_BASE_URL) ──REST──▶ server (Fastify) ──▶ Postgres (freshly seeded)
```

- **Runner (`run.ts`).** Loads every `specs/*.flow.json` in lexical filename order and runs each
  step as one `agent-browser` process (`execFile`, per-step timeout `E2E_STEP_TIMEOUT`).
  `{BASE}` in arguments is replaced with `E2E_BASE_URL` (`lib/assert.ts`, `resolveArgs`).
- **Browser session.** The agent-browser daemon keeps the page between invocations, so the steps
  of a flow, and consecutive flows, share one session. The runner closes it at the end, pass or fail.
- **Assertions.** A step passes when its command exits 0. `wait --text` / `wait --url` time out
  non-zero, so they serve as the assertions; `assert.stdoutIncludes` adds a substring check.
- **Failure.** The first failing step ends that flow. It writes a best-effort screenshot
  `test-results/<flow>-fail.png`, and the runner moves on to the next flow. Exit code 1 if any
  flow failed; the summary prints one PASS/FAIL line per flow.

## What the flows depend on

- **The whole stack, not mocks.** The flows drive the real client and server, so they also
  cover routing, i18n, API wiring and the seed. Unlike client unit tests, no `fetch` is mocked.
- **Seeded, read-only data.** `server/src/db/seed.ts` provides the demo repo
  `acme/payments-api`, PR #482 with a seeded review (1 CRITICAL, 1 WARNING) and the built-in
  agents. Flows never trigger a review, so no LLM or API key is involved.
- **A fresh DB.** The home redirect lands on the first repo, so other imported repos break the
  flows that start at `/`.

## Where it runs

| Mode | Stack | Entry |
|---|---|---|
| Hermetic (local) | `scripts/e2e.sh`: an ephemeral Postgres container + API + web on alternate ports, torn down afterwards | `npm run e2e:hermetic` |
| Own stack (local) | an already running `scripts/dev.sh` stack, only safe on a DB that holds just the seed | `npm test` |
| CI | `.github/workflows/e2e-web.yml`: Postgres container, server migrate + seed, `pnpm build` + `pnpm start` for the web app, then `npm test` | path-filtered on `client/**`, `server/**`, `e2e/**` |
