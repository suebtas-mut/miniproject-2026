# Sprint 4 handoff — Sukhsorn

## Scope and ownership
- Tasks: T-017 (Flutter login, password change, logout/session restoration, auth redirects) and T-018 (Flutter employee/department/position lists and forms).
- Owner: Sukhsorn (Flutter stream). Backend API/SQL implementations remain owned by the backend stream; no peer workspace was read or edited. Client built against `docs/api/openapi.yaml` only (`backend/src` is empty).
- Acceptance criteria addressed: `/api/v1` base prefix; OpenAPI `LoginResponse` (`token`, `user`, `roles`, `permissions`, `modules`) and `PagedEmployeeList` (`items`, `total`, `page`, `pageSize`); regression coverage for model mapping, pagination, field validation, and async list loading/error states; authenticated route guards and forced re-login after password change.
- Pre-existing unrelated work was preserved untouched, notably `database/02_seed_master.sql` and `docs/agile/sukhsorn-check-list.md` (dirty before this batch) plus all other untracked files outside this batch.

## Changed files
### T-017 — auth
- `app/lib/core/network/api_client.dart`: base URL from dart defines (see contract decisions), injectable `baseUrl`, `onUnauthorized` callback, 401 → clear token.
- `app/lib/core/network/api_error.dart` (new): `describeFailure`/`messageFromDio` extract OpenAPI `{code, message}` body message first, fall back to generic Thai text; handles timeout/Dio error types.
- `app/lib/features/auth/auth_models.dart`, `auth_controller.dart` (new): login/`/auth/me` payload validation (rejects responses missing `user` or `permissions`), session restore with `AuthStatus.restoring → authenticated/unauthenticated`, `copyWith` message semantics.
- `app/lib/features/auth/login_page.dart`, `change_password_page.dart`, `session_restoring_page.dart`, `account_menu.dart` (new): login form, change-password with forced re-login message `เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่`, splash restore, account menu (keys `account-menu`, `change-password`, `logout`).
- `app/lib/core/router/app_router.dart`: `routerProvider` watches auth status; redirect `restoring → /splash`, `unauthenticated → /login` (incl. `/master` guard), `authenticated → /`.
- `app/lib/features/dashboard/home_page.dart`, `app/lib/layout/adaptive_shell.dart`, `app/lib/layout/module_placeholder.dart`: `AccountMenu` added to app bars / rail trailing.

### T-018 — master data
- `app/lib/features/master/master_models.dart`, `master_repository.dart`, `master_providers.dart` (new): models per OpenAPI, repository with `page`/`pageSize`, `EmployeeQuery`, list/detail providers and refresh helpers.
- `app/lib/features/master/master_page.dart`: three tabs พนักงาน/แผนก/ตำแหน่ง + `AccountMenu`.
- `app/lib/features/master/employee_list_page.dart`, `department_list_page.dart`, `position_list_page.dart` (new): paginated lists with debounce search (350 ms, key `employee-search`), create buttons (`employee-create`, `department-create`, `position-create`), loading/error states.
- `app/lib/features/master/widgets/list_states.dart` (new): `PagerBar` (keys `pager-info`, tooltips `ก่อนหน้า`/`ถัดไป`), error state with key `list-error-message` and retry `ลองอีกครั้ง`.
- `app/lib/features/master/employee_form_dialog.dart` (new): validated create/edit form (deptName/positionName ≤100, empCode ≤20, first/last ≤50, username ≤50, phone ≤20, email ≤120 + regex, password ≥8; department + position + ≥1 role required), role chips, 409 handling (message `รหัสพนักงานนี้มีอยู่แล้ว` shown, dialog stays open, keys `employee-save-error`/`employee-role-error`).

### Tests
- `app/test/sprint04_test.dart` (new): 24 tests — 7 pre-existing contract/model tests preserved verbatim + 17 new (auth redirect, `/auth/me` Bearer, login success, login 401 message, session-expired 401 + token clear, logout POST + Bearer, change-password success/error, `/master` guard, employees page/pageSize/Bearer contract, page=2, 500 error + retry, validation-no-POST, create body + refresh, 409 conflict, department create, position create).
- `app/test/support/fake_backend.dart` (new): `FakeTokenStorage`, `FakeBackend implements HttpClientAdapter` with `on()`/`requestsFor()`/404 `NO_FAKE_ROUTE`, `RecordedRequest.matches()`, `ShuttleHarness` with bounded `pumpFrames` and provider overrides (`tokenStorageProvider`, `apiClientProvider`).
- `app/test/widget_test.dart` (3 tests), `app/test/adaptive_shell_test.dart` (6 tests): adapted to an authenticated harness because the new auth redirect sends unauthenticated users to `/login`; all original assertions preserved. This is a behavior-driven adaptation, documented here as required.
- `docs/agent-handoffs/sprint04-sukhsorn.md`: this record.

## Contract decisions
- OpenAPI is authoritative for response keys; successful auth has `token`, `user`, `roles`, `permissions`, and `modules`. Client endpoint paths remain relative to `/api/v1`.
- Base URL: `String.fromEnvironment('API_URL')` (chapter-17 lines 1257/1435) with nested fallback to `String.fromEnvironment('API_BASE_URL')` (sprint3 handoff), default `http://10.0.2.2:3000/api/v1` — supports both documented defines without breaking either.
- `GET /employees` uses `page` and `pageSize` (default 50, max 200) and returns the `PagedEmployeeList` object. Department/position list endpoints return arrays.
- Error display uses the response body `message` (or generic Thai fallback), not the raw Dio message.
- Employee form includes role selection; roles are sent on edit only if changed. Assignment semantics for UC-10 remain blocked by Q22 and must not be treated as verified.
- Department assignment is nullable in the Employee response schema; the form still requires department and position under the written M1 business rule. No requirement answer was invented.

## Verification record
- Spec review: `docs/chapter-18-development-plan.md` T-017/T-018, `docs/api/openapi.yaml` auth/master schemas, `docs/chapter-17-fullstack.md` base URL, `docs/diagrams/usecase/usecase-spec.md` UC-01…UC-06, `database/01_schema.sql` employee/department/position.
- `flutter analyze` (from `app/`): **No issues found! (ran 13.8s)** — run after all edits; earlier rounds also clean after lint fixes.
- `flutter test` (from `app/`): **All tests passed! — 33/33** (`00:20 +33: All tests passed!`): 24 in `sprint04_test.dart` + 3 in `widget_test.dart` + 6 in `adaptive_shell_test.dart`. Includes the original 7 sprint04 contract tests and all original widget/shell assertions (adapted to authenticated harness as noted above).
- `dart format` on the 25 changed/new batch files: 15 needed reformatting, applied; final state format-clean.
- `git status` reviewed: only batch files + preserved pre-existing dirty files; no secrets; no commit or push created (coordinator handles delivery).
- No database execution, live API integration, human review, or backend implementation was performed or verified.
- Codex consult (`scripts/codex-consult.cjs`) was **not run** (reserved for coordinator flow); no Codex approval is claimed.

## Blocked acceptance criteria and unresolved checks
- Q-A, Q-B, Q-F, Q14, Q20, Q22, Q23, and Q24 remain unresolved as recorded in project checklists; none was used to invent behavior. Q22 specifically blocks confirmation of employee role-assignment acceptance.
- Sprint-wide end-to-end login/logout/revocation and CRUD success depend on backend T-015/T-016 implementations and an available API service; not verified here (widget tests exercise an in-process fake HTTP adapter, not a real server).
- Human review and reviewed delivery remain coordinator responsibilities.
