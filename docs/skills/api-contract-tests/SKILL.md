---
name: api-contract-tests
description: Use when a diff changes an HTTP route's path, params, body or response — flag breaking changes for callers and missing or stale contract tests.
type: custom
allowed-tools: Bash(scripts/check.sh)
---

# API contract tests

When the diff changes a route (path, method, params, query, body schema, response
shape or status codes):

1. Decide whether the change is **breaking** for existing callers:
   - a renamed or removed field, a field that became required, a narrowed type;
   - a changed path, method or status code;
   - a response field that can now be `null` or is gone.
2. For a breaking change, report it with the callers that would break (the client
   hook or the other service that calls the route), unless the diff updates them too.
3. Check that a test asserts the new contract: request validation (the rejected
   input and its status) and the response shape. A test that still sends the old
   body or asserts the old shape is stale — report it.

A non-breaking addition (a new optional field) needs only a test for the new field.
