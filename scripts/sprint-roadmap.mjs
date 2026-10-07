// Execution batches, not claims that human Scrum ceremonies or sign-offs occurred.
const scopes = [
  [4, 'T-015/T-016: JWT login/logout/me/change-password, token_blacklist; employee/department/position CRUD. Enforce authentication, input validation, password hashing, disabled users, rollback and no password/hash disclosure.', 'T-017/T-018: working login/password change/logout/session restoration and auth redirects; employee/department/position forms and paginated lists with loading/error/validation states.'],
  [5, 'T-019..T-022: role CRUD, defined permission endpoints and transactional permission matrix; dynamic DB-backed RBAC on every protected API, no role-name bypass. Q22/Q24 undefined endpoints remain explicitly blocked.', 'T-023: permission matrix and dynamic menu from server permissions; no hardcoded role shortcuts; hide unauthorized actions and handle 403. Q22/Q24 undecided actions remain clearly unavailable.'],
  [6, 'T-024..T-027: stop/route CRUD, ordered route-stop replacement and total_minutes recalculation in one transaction. Validate order, duplicates, positive travel times and referenced rows against the existing schema.', 'T-028: stop and route management, ordered stops editor, API-computed total travel time; validation and phone/tablet tests.'],
  [7, 'T-029..T-032: vehicle/type APIs, schedule generation with schedule_stop offsets and transactional driver/vehicle assignment conflict checks. Enforce overlap boundaries and locking. Do not invent Q23 departure-edit API.', 'T-033: schedule calendar/list, vehicles, driver/vehicle assignment and conflict messages using documented APIs. Q23 unresolved departure-edit action must remain unavailable.'],
  [8, 'T-034/T-035/T-037: available trips with BR-05 cutoff; booking transaction with FOR UPDATE NOWAIT, interval seat accounting, ownership and cryptographic QR token generation. Enforce BR-06 max four already as prerequisite; test concurrent oversell and rollback.', 'T-040: boarding/alighting selection, available trips, seat count 1..4, booking confirmation and cutoff/full-seat errors. Use real repository/API abstraction, never local fake success.'],
  [9, 'T-036/T-038/T-039/T-042: booking limit and ownership, cancel plus atomic seat release, my bookings filters, QR access control, persisted audit logging without secrets. Test repeated cancellation and unauthorized access.', 'T-041: my bookings filters, QR display and cancellation confirmation/error/reload flows with meaningful widget/repository tests.'],
  [10, 'T-043..T-046: assigned driver daily work, start trip state transition, LISTAGG manifest and QR validation. Check caller assignment, trip/QR identity, repeat scan and allowed booking states atomically.', 'T-048/T-049: daily assigned work, start trip, conflict feedback, grouped boarding/alighting manifest; permission and lifecycle tests.'],
  [11, 'T-047/T-052/T-053: complete trip, mark no-show and summary atomically; author non-destructive bulk seed for year 2568 (>=50000 rows) and report views matching real schema. Do not execute bulk writes on the existing shared database or destructive DDL. Record isolated integration prerequisites honestly.', 'T-050/T-051: mobile_scanner QR flow with debounce, camera permission states, server validation and duplicate feedback; complete-trip confirmation and no-show summary. Add Android permission, mock scanner platform in tests; actual camera test is separate.'],
  [12, 'T-054/T-055/T-056/T-060: R1 weekly boarding/alighting, R4 daily route pivot with daily total, R6 driver workload before/after 17:00 with analytics/ROLLUP. Bind date filters, validate ranges/year conversion and report permissions. BR-01..12 test plan.', 'T-058/T-060: R1 chart and table, year 2568/date filters, loading/empty/error states; test plan and traceability to implemented BRs.'],
  [13, 'T-057/T-061/T-062: review all server endpoints against OpenAPI, regression/security/concurrency tests, explain-plan/index scripts and reproducible performance procedure; documentation and truthful integration results. Never claim <3s or 50000-row Oracle execution without measurement. Fix defects across earlier batches.', 'T-059/T-061/T-062: R4/R6 charts/tables/date filters and specified export; replace remaining in-scope placeholder pages, regression/widget/integration tests, build Android APK and final implementation/requirements traceability. Report missing real-device/E2E checks honestly.'],
];

export const roadmap = scopes.map(([sprint, backend, flutter]) => ({
  sprint,
  kaengkarn: backend,
  sukhsorn: flutter,
}));

export function roadmapJob(agent, index, base) {
  const stage = roadmap[index];
  if (!stage || !['kaengkarn', 'sukhsorn'].includes(agent)) throw Error('Invalid roadmap stage or agent');
  const n = String(stage.sprint).padStart(2, '0');
  const handoff = `docs/agent-handoffs/sprint${n}-${agent}.md`;
  const test = agent === 'kaengkarn' ? `backend/tests/sprint${n}.test.js` : `app/test/sprint${n}_test.dart`;
  return { ...base, sprint: stage.sprint, scope: `Sprint ${stage.sprint}: ${stage[agent]}
Read only relevant sections of docs/chapter-18-development-plan.md, docs/api/openapi.yaml, docs/chapter-17-fullstack.md, usecase-spec and database/01_schema.sql. API prefix is /api/v1 and response contracts must match OpenAPI. Preserve existing dirty files. Backend stream owns all API/SQL implementations (including T-029/T-039/T-053/T-055); Flutter stream owns client and documentation. Do not edit peer workspace. Existing unresolved Q-A/Q-B/Q-F/Q14/Q20/Q22/Q23/Q24 are not permission to invent requirements; implement unaffected work and list blocked acceptance criteria in the handoff, without repeatedly asking already-pending questions.
Add meaningful regression tests in ${test}; do not use trivial existence tests or weaken existing tests. Complete ${handoff} with tasks, changed files, exact commands/results, contract decisions and unresolved checks. Record real results only; passing local tests does not mean human review, live integration or all requirements passed. No commits or pushes by worker; coordinator handles reviewed delivery. Stop after THIS sprint batch; the controller dispatches the next one.`,
    required: [...base.required, test, handoff],
  };
}

export function enterStage(state, index, runId) {
  // Keep lifetime Codex counters: advancing sprints must not replenish paid quota.
  state.roadmapId = runId;
  state.stageIndex = index;
  state.rounds = 0;
  state.modelIndex = 0;
  state.phase = 'queued';
  delete state.reason;
}
