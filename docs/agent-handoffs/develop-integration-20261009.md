# Develop integration — 2026-10-09

The user authorized pushing both completed task branches, merging them into
`develop`, and resolving conflicts. Integration was performed in a separate
worktree, preserving unrelated changes in both original workspaces. This is a
development integration, not a production deployment or security sign-off.

## Source deliveries

- Kaengkarn: `fea0c9e` (backend Sprints 4–15 plus automation), followed by
  `942790c` (audit schema and report permission seed required by the backend).
- Sukhsorn: `97fe549` (Flutter Sprints 4–13 and verification records).
- Integration started from `origin/develop` at `9b28697`.

Explicitly selected application sources, tests, sprint handoffs, security reports
and related automation were committed. Unrelated checklists, session artifacts,
temporary scripts, local model/provider settings and credentials were excluded.
No schema or seed script was executed against Oracle.

## Conflict resolution

Git reported no unmerged text conflicts, but the first combined backend test run
failed eight tests. Integration uncovered a semantic API-contract conflict and
missing database deliverables:

- Keep `docs/api/openapi.yaml` from the backend delivery, matching its route and
  regression tests. Preserve the Flutter branch's differing proposal separately
  as `docs/api/flutter-proposed-openapi.yaml`; it is not the canonical server
  contract. No test assertion was weakened to accommodate the merge.
- Include the reviewed `audit_log` schema and RPT.R4 permission seed changes from
  Kaengkarn. They are required by the backend's existing tests and features.
- Preserve both streams' application implementations and their test suites.
- Normalize CRLF when reading source text in Sprint 12's static route test;
  assertions and protected route expectations remain unchanged.
- Fix a revocation boundary defect uncovered by the combined run: new JWTs carry
  signed millisecond issuance time, and a password-change marker revokes tokens
  issued at or before its timestamp. Legacy second-resolution tokens fail closed
  for the ambiguous same-second case. Two additional regression tests cover
  before/equal/after boundaries and legacy tokens. Cross-host clock consistency
  still requires verification in the real Oracle deployment.

## Verification

- Source backend: 15 suites, 387 tests passed.
- Source Flutter: analyzer clean, 193 tests passed.
- Automation: 26 tests passed.
- Combined Flutter worktree: analyzer clean, 193 tests passed, dependencies
  resolved offline using the installed cache.
- Combined backend after conflict resolution: 16 suites, **389 tests passed**.
  Combined automation: **26 tests passed**. Initial failures described above
  were resolved before publishing the integration.

## Open integration/release blockers

- **CONTRACT-DRIFT-01 remains open.** Flutter models/repositories use the client
  proposal, including camelCase fields and some different paths/envelopes;
  backend uses its snake_case contract. Mock-based Flutter tests do not prove
  that a real client can authenticate or complete end-to-end workflows against
  this backend. An explicit adapter/contract reconciliation and E2E tests are
  required before release. Keeping both specs is evidence preservation, not a
  claim that the mismatch is fixed.
- Sprint 15's RT-F001/RT-F002/RT-F003 findings remain unresolved. Some red-team
  tests deliberately demonstrate vulnerable behavior; their passing results do
  not mean the vulnerabilities were repaired. See the red-team report for
  prerequisites and remediation proposals; live Oracle assumptions still need
  independent verification.
- Live Oracle transaction/concurrency/performance evidence, real-device camera
  checks, export-to-device behavior, unresolved business/instructor questions,
  and independent security review remain outside this merge's validation.

Do not deploy this branch as a security-approved release based only on the test
counts above. The next development work should reconcile the API contract and
remediate/retest the confirmed security findings.
