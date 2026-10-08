# Continuous OpenCode execution: Sprints 4–13

Authorized by the user on 2026-10-07. This is an execution plan and live-run guide, not a completion certificate.

Controller: `scripts/autopilot.mjs`, stages: `scripts/sprint-roadmap.mjs`.
Run ID: `sprints-04-13-20261007`. Each worker has a fresh OpenCode session to avoid replaying the large Sprint 3 conversation.

| Sprint | Backend/Oracle stream (Kaengkarn) | Flutter/documentation stream (Sukhsorn) |
| --- | --- | --- |
| 4 | Authentication, employee/department/position APIs | Login/session handling and employee forms |
| 5 | Roles, permissions and dynamic RBAC | Permission matrix and dynamic menu |
| 6 | Stops, routes and travel-time calculation | Stop/route editors |
| 7 | Vehicles, schedules and assignment conflicts | Schedule/vehicle/assignment UI |
| 8 | Available trips, locked booking transactions, QR tokens | Booking flow |
| 9 | Cancellation, my bookings and audit persistence | Tickets, QR and cancellation |
| 10 | Driver work, start, manifest and QR validation | Driver work and manifest |
| 11 | Complete/no-show, bulk-seed and report-view scripts | QR scanner and completion summary |
| 12 | R1/R4/R6 report APIs and business-rule tests | R1 charts and test traceability |
| 13 | Regression/security/performance procedures and documentation | R4/R6, export, regression, APK and traceability |

Operational ownership groups all server/SQL changes in Kaengkarn, including T-029/T-039/T-053/T-055 originally assigned to Sukhsorn in the human plan. Human explanation/review ownership is not fabricated or reassigned. Both workers use the existing `/api/v1` OpenAPI contract; neither edits the peer workspace.

## Gates and limits

- Each stage requires its own `sprintNN-<agent>.md` handoff and regression test file, plus the full existing test suite. A passing gate is recorded as **local checks passed, review pending**. It is not proof that every requirement or integration works.
- The controller advances independently to the next stage after local checks. Codex coordinator reviews the implementation and integration separately. Workers may not mark human ceremonies or AR-02 reviews complete.
- Free provider metadata is checked before dispatch. No paid OpenCode provider fallback; no OpenChat/ChatGPT billing through OpenCode. Ollama supplies local repair advice.
- Codex rescue remains capped across the entire run: two calls total, one per worker, at most ten minutes each. Stage changes do not replenish counters. Calls use VS Code's bundled runtime and the authenticated account's quota.
- Six free repair submissions per worker/stage and a 45-minute active-turn timeout bound runaway loops. Hard failures or important pending approvals preserve files for review.
- Q-A/Q-B/Q-F/Q14/Q20/Q22/Q23/Q24 remain unresolved unless trusted answers are supplied. Implement unaffected work and record blocked acceptance criteria. Do not invent endpoints or modify disputed sample data to claim completion.
- Bulk seed and performance scripts can be authored; existing shared database data must not be overwritten for tests. Actual large-data and camera checks must be reported separately from mocked tests.
- No automatic commits, pushes, main-branch merges or deployment by workers. The coordinator reviews and selects task files for the already authorized task-branch delivery.

## Observe and resume

Local configuration: `.agent-runtime/config.json`.
Progress and durable budgets: `.agent-runtime/autopilot-state.json`.
Events: `.agent-runtime/autopilot.jsonl`; process errors: `.agent-runtime/roadmap-stderr.log`.

Use VS Code `OpenCode: attach kaengkarn` / `OpenCode: attach sukhsorn` from Kaengkarn to see the new sessions. The existing terminal may still show the previous Sprint 3 session. `OpenCode: autonomous supervisor` resumes saved progress; do not start a duplicate while the lock is held.

Create `.agent-runtime/STOP-AUTOPILOT` to stop dispatching further work at the next loop boundary. This does not interrupt an already running worker turn. Resume only after the process has exited and the stop marker is removed. Do not delete an active lock or reset rescue counters.

Machine shutdown, stopped OpenCode server, exhausted free-model availability and pending human decisions can interrupt progress. The state file preserves the last stage; no claim of Sprint 13 completion should be made until real review and required integration evidence exist.
