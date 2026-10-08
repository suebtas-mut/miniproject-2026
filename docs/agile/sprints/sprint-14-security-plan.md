# Sprint 14 — Kaengkarn cybersecurity audit, round 1

Owner: Kaengkarn. Authorized by the user on 2026-10-09. Scope: all backend,
API, Oracle SQL/schema/seed/report scripts, configuration examples, dependency
manifests, and associated tests/documentation delivered through Sprint 13.
Audit automation scripts as a read-only trust-boundary review; propose fixes
to the coordinator rather than modifying the running supervisor. Flutter
implementation remains Sukhsorn's scope. This sprint does not certify security.

## Execution boundaries

Run against the local application with injected test repositories and synthetic
users/data. Do not load real credentials, read `.env`, expose tokens/passwords,
connect tests to shared Oracle, scan external hosts, perform denial-of-service
tests, or change deployment settings. Network advisory lookup may use public
package metadata only; report unavailable checks as blocked, never clean.
Do not run `npm audit fix`, install/upgrade dependencies, execute schema/seed
scripts, or alter business requirements as part of a scan. Preserve existing
dirty work. Proven in-scope code defects may be fixed with regression tests;
record before/after evidence and any compatibility effect. No worker commits.

## Round 1: basic coverage

| ID | Area | Minimum evidence |
|---|---|---|
| SEC14-01 | Inventory and trust boundaries | Map implemented routes, data flows, protected assets, middleware, repositories and SQL scripts; reconcile against Sprint 13 handoff and OpenAPI. |
| SEC14-02 | Authentication/session | Missing, malformed, expired and incorrectly signed JWTs; logout revocation, disabled accounts, password/hash non-disclosure, password-change rules. |
| SEC14-03 | Authorization | Unauthenticated/insufficient-permission cases; synthetic user A must not read or mutate user B's booking/QR; assigned-driver boundaries; no role-name bypass. |
| SEC14-04 | Input and SQL | Invalid IDs, types, ranges and unexpected fields; deterministic injection-shaped inputs must remain bound data; inspect dynamic SQL identifiers and allowlists. Mock evidence is not live Oracle proof. |
| SEC14-05 | Sensitive output/configuration | Error responses, logs and audit events avoid secrets/stack/SQL disclosure; body limits, CORS, headers, debug routes and sample configuration reviewed. Missing controls become findings, not invented requirements. |
| SEC14-06 | Business-state controls | QR replay, repeated cancellation/start/complete actions, ownership and transaction rollback checks; review concurrency guarantees without load attacks. |
| SEC14-07 | Supply chain and data scripts | Inventory exact lockfile versions; advisory check if available, with source/date/reachability assessment; inspect SQL privileges, binds and destructive operations without executing them. |
| SEC14-08 | Automation boundary review | Read-only review of approval scope, provider routing, stored logs and command execution; report weaknesses to coordinator. Do not read credentials or change supervisor configuration. |

Use the existing test suite as the baseline, identify gaps, and add meaningful
negative/regression tests in `backend/tests/sprint14.test.js`. Run
`npm.cmd test -- --runInBand` from `backend`. Each area must be marked
pass/fail/blocked/not-applicable, with a reason and concrete file/test evidence.
Do not duplicate existing tests merely to increase the count.

## Required outputs and exit criteria

1. `docs/security/sprint14-baseline-audit.md`: scope, tested revision plus dirty
   file inventory, environment, commands/exit codes, baseline/full-suite results,
   coverage table, limitations, and findings register. Findings use SEC14-F001
   etc., affected path/endpoint, prerequisites, synthetic reproduction,
   expected/actual behavior, impact and likelihood with rationale, remediation,
   owner, and retest status. Redact secret values. Preserve unresolved findings.
2. `backend/tests/sprint14.test.js`: meaningful executable security regression
   coverage. Fix confirmed local defects where the approved contract is clear;
   otherwise record the blocker. Never weaken assertions to obtain a pass.
3. `docs/security/next-security-sprint-plan.md`: a revised, evidence-driven
   next-sprint proposal, not a claim that later testing occurred.
4. `docs/agent-handoffs/sprint14-kaengkarn.md`: concise results, changed files,
   exact verification, residual risks and handoff to the coordinator.

A green test run means only that the tested controls passed. Open high-impact
findings and live-integration gaps remain visible and block any claim of release
security readiness. The supervisor checks artifacts and regressions; it cannot
provide independent security sign-off.

## Replan after every round

At the end of round 1, rank findings by demonstrated impact, likelihood and
coverage gaps. For every next-round item specify linked finding/test IDs,
target assets, attack hypothesis, fixture/environment, bounded method, expected
result, owner, effort/timebox, prerequisites and measurable exit criteria.

Suggested sequence, to revise based on actual results:

- Round 2 / proposed Sprint 15: retest confirmed fixes first, then deepen
  authentication, object/function authorization and response-contract checks.
- Round 3: isolated Oracle integration, transaction races and business-flow abuse
  using disposable data and an agreed test environment.
- Round 4: application/API integration with Sukhsorn, deployment configuration,
  independent review and residual-risk decision.

Only Sprint 14 is added to execution now. Later sprints are proposals until their
scope and environment are established; do not automatically run them. If serious
findings appear, prioritize their remediation/retest over a broader next round.
If no findings appear, deepen the weakest evidence areas instead of declaring
the system secure. Unresolved instructor/business questions remain unresolved.

## Reference

[OWASP API Security Top 10 2023](https://api-security.owasp.org/editions/2023/en/0x03-introduction/)
is an awareness reference for the API coverage, not a certification checklist.
Use application-specific risk reasoning as described in
[OWASP API Security Risks](https://api-security.owasp.org/editions/2023/en/0x10-api-security-risks/).
