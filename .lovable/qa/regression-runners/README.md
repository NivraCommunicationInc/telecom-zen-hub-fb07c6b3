# QA Regression Runners — Index

Reusable end-to-end runners that back Nivra Core's non-regression suite.
Each runner is a service-role Edge Function that returns a standardized
JSON report with a top-level `ok: true|false` PASS/FAIL flag.

| Runner | Ticket | Scope | Doc |
|---|---|---|---|
| `qa-bug-core-001-e2e` | BUG-CORE-001 (CLOSED) | Field quote → payment link → email → shell materialization → capture → order/invoice/payment flip | [Details](./qa-bug-core-001-e2e.md) |

## Conventions

1. **Endpoint:** `POST /functions/v1/<runner-name>` with service-role Bearer.
2. **Response:** HTTP 200 + JSON `{ ok, correlation_id, ids, steps, ... }`.
   HTTP 500 only on uncaught fatal.
3. **PASS/FAIL:** automation reads `.ok` — nothing else.
4. **Isolation:** fixtures keyed by timestamp on the `@nivra-qa.local`
   domain; no real customer data is ever touched.
5. **Idempotency:** each run is independent; re-running is always safe.
