# Sprint 3 automation and implementation review

Date: 2026-10-07. Reviewer: Codex coordinator (AI review, not a human AR-02 sign-off).

## Delivered scope

- Kaengkarn: T-011/T-012 backend skeleton, Oracle pool, health endpoint and middleware.
- Sukhsorn: T-013 Flutter adaptive shell and T-010 DFD/state/sequence sources and PNGs.
- Controller: free OpenCode models first, local Ollama advice, bounded Codex App Server rescue using the VS Code extension runtime. No separate CLI installation.

Kaengkarn commits: `9efe339` (automation), `b23f08e` (backend), on `feature/sprint3-kaengkarn-autonomous`.

Sukhsorn commit: `b107da01b1e070ce33951ec5cffc16bf16fe5893`, on `feature/sprint3-sukhsorn-autonomous` (64 task files, including nine rendered diagrams). The handoff's pre-commit status is superseded by this record.

## Verified evidence

- Controller: 11 automated tests passed, including permission boundaries, zero-price model checks, prompt bounds, rescue budgets and mock App Server failures.
- Backend: 22 Jest tests passed in three suites. A separate real Oracle connection check returned HTTP 200 from `/health` with database connected; it used a read-only query.
- Flutter: analyzer passed and nine tests passed, covering navigation and phone/tablet breakpoints. Debug and release APKs built. The debug APK was installed and launched on emulator-5554; the final screenshot shows the Thai home page and Material icons correctly.
- Android merged manifests: INTERNET permission present in debug and release. Development cleartext policy is attached only to debug/profile, with local development hosts explicitly listed.
- All nine PlantUML diagrams rendered using PlantUML 1.2026.8, UTF-8 and Tahoma; Thai glyphs were visually checked. The context diagram keeps the database inside the system boundary.
- Codex App Server authentication/model discovery and one short read-only inference smoke test succeeded. Real repair fallback was not needed in this run; its protocol and budget handling were also tested with mocks.

Review corrections included Oracle autocommit defaults and connection cleanup, sanitizing health errors, catching rejected audit sinks, bundling Material icons, Android networking configuration and preserving required Android source assets through Git ignore rules.

## Cost and operation

OpenCode reported zero model cost in the session usage snapshot at `.agent-runtime/opencode-usage-snapshot.json`; this is provider metadata, not a billing statement. Existing session history is included. Ollama runs locally. The Codex smoke test and this coordinating Codex conversation use their respective account quota.

Automatic Codex repair is capped at two calls total, one per agent, ten minutes per call, low reasoning and bounded input context. These are not a hard monetary or token cap. Durable counters prevent routine restarts from replenishing the budget. Unknown permissions and unresolved requirements remain pending for a human; only narrowly defined routine answers and read-only permissions are automated.

Use the VS Code task `OpenCode: autonomous supervisor` in Kaengkarn. Runtime configuration and logs are local under `.agent-runtime/`. The controller stops when the assigned checks pass; it does not claim all project sprints are complete or automatically start a new scope.

## Delivery boundary

GitHub push was rejected by automatic approval review because the exact destination was not established by trusted user authorization. Pending destination: `https://github.com/suebtas-mut/miniproject-2026.git`, task branches only. No push, merge to main or production deployment was performed. Existing unrelated dirty files were preserved.

Formal human/peer sign-off, instructor requirement answers and later-sprint business features remain separate. The Flutter shell includes intentional placeholders; this delivery is not a completed production application.
