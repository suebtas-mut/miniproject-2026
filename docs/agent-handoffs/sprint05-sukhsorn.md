# Sprint 5 handoff — Sukhsorn

## Scope and ownership
- Task: T-023 (permission matrix + dynamic menu derived from server permissions; no hardcoded role shortcuts; hide unauthorized actions; handle 403/400).
- Owner: Sukhsorn (Flutter stream). Backend API/SQL (incl. T-029/T-039/T-053/T-055) remains owned by the backend stream; no peer workspace was read or edited. Client built against `docs/api/openapi.yaml` only; API prefix `/api/v1`.
- Q22/Q24 undecided: no requirement answer was invented. UC-08 permission add/edit/delete (Q24) is deliberately unavailable in the UI; UC-10 role-assignment acceptance (Q22) remains blocked.
- Pre-existing unrelated dirty files preserved untouched: `database/02_seed_master.sql`, `docs/agile/sukhsorn-check-list.md`, plus all untracked files outside this batch.

## Changed files

### Session permission model and menu
- `app/lib/features/auth/auth_models.dart`: added `kPermissionModules` (ordered: master, front, booking, driver, report) and `AuthStatePermissions` extension — `permCodes`, `can(code)`, `accessibleModules` (derived from server `modules` ∪ permission modules, intersected with known modules; unknown modules dropped).
- `app/lib/layout/adaptive_shell.dart`: converted to `ConsumerWidget`; `kShellDestinations` kept as full destination catalog; `shellDestinationsFor(AuthState)` builds the visible menu (home always + allowed modules); phone layout hides `NavigationBar` when fewer than 2 destinations (Material asserts `destinations.length >= 2`); tablet rail unchanged behaviorally.
- `app/lib/core/router/app_router.dart`: `StatefulShellBranches` generated dynamically from visible destinations; `_sessionMenuKey` select (status|modules|sorted perm codes) drives router recreation on session permission change without reacting to snackbar message changes; deep-link guard redirects unauthorized module paths from the catalog to `/`, while non-catalog paths (e.g. `/account/change-password`) stay reachable.
- `app/lib/features/dashboard/home_page.dart`: module cards filtered by `accessibleModules`.

### Permission matrix (UC-09)
- `app/lib/features/master/permission_matrix_page.dart` (new): role selector + grouped permission checkboxes; gated by `ROLE.EDIT` (otherwise key `matrix-forbidden`); loads `GET /permissions` + `GET /roles`, then `GET /roles/{roleId}/permissions` on selection; saves via `PUT /roles/{roleId}/permissions` with the full sorted `permIds` set; success message states the user must log in again for new permissions to take effect; role-list refetched after save; UI locked while saving (dropdown disabled, `onChanged: null`) and save completion applies only to the role the request was started for (race guard); no add/edit/delete-permission UI (Q24 has no endpoint).
- `app/lib/features/master/master_page.dart`: tabs = รายการพนักงาน (only with `EMP.VIEW`) + แผนก + ตำแหน่ง + สิทธิ์ (only with `ROLE.EDIT`, key `master-tab-permissions`).
- `app/lib/features/master/master_models.dart`: `Permission`, `RolePermissions` models.
- `app/lib/features/master/master_repository.dart`: `fetchPermissions()` (`GET /permissions?pageSize=200`), `fetchRolePermissions(roleId)`, `saveRolePermissions(roleId, permIds)`.
- `app/lib/features/master/master_providers.dart`: `permissionsProvider`.

### Unauthorized-action hiding (per module)
- `app/lib/features/master/employee_list_page.dart`: `EMP.EDIT` gates create/edit/deactivate controls; page self-closes with key `employee-forbidden` when `EMP.VIEW` is missing (no data fetch issued).
- `app/lib/features/master/department_list_page.dart`: `DEPT.EDIT` gates create + row edit/delete.
- `app/lib/features/master/position_list_page.dart`: `POS.EDIT` gates create + row edit/delete.
- `app/lib/features/master/widgets/list_states.dart`: `PagerBar` text wrapped in `Flexible` (fixed a real 16 px overflow at 390 px width exposed by phone-size tests).

### Tests
- `app/test/sprint05_test.dart` (new): 16 tests — session helper mapping; `shellDestinationsFor` unit; booking-only menu (home+booking, home cards hidden); no hardcoded role shortcut (`roles=[ADMIN]` with zero permissions sees only home); full 6-item menu order; deep-link guard (`/master` bounced, `/booking` kept); action hiding (no DEPT.EDIT/POS.EDIT/ROLE.EDIT → no create buttons/row icons/permission tab); matrix tab presence + OpenAPI call contract (Bearer, `pageSize=200`, roles fetched once, no role-permissions fetch before selection, no add/delete-permission UI, save disabled when clean); full save flow (select role, toggle, `PUT` body `{"permIds":[1,2,3]}`, success, save re-disabled, roles refetched); `PUT` 403 → server message shown, page stays; `PUT` 400 `ADMIN_PERM_INCOMPLETE` → message shown; standalone page without `ROLE.EDIT` → `matrix-forbidden`, no save button; department create with permission but server 403 → in-form error, dialog stays; delayed `PUT` → role switch locked during save and success applied to the originating role; TC-09-01 (no `EMP.VIEW` but `DEPT.EDIT` → no employee tab, `/employees` never called); standalone `EmployeeListPage` without `EMP.VIEW` → `employee-forbidden`.
- `app/test/sprint04_test.dart` (adapted): `authMe` mock now returns real edit permissions (`EMP.EDIT`/`DEPT.EDIT`/`POS.EDIT`, intentionally no `ROLE.EDIT` so the original 3-tab assertions still hold); loading-state test uses an `_EmployeeViewerAuth` stub because `EmployeeListPage` is now gated by `EMP.VIEW` (behavior-driven adaptation; original assertions preserved).
- `app/test/adaptive_shell_test.dart` (adapted): `authMe` mock given the full 5-module permission set so the original 6-destination assertions remain valid (behavior-driven adaptation).
- `docs/agent-handoffs/sprint05-sukhsorn.md`: this record.

## Contract decisions
- Endpoints per `docs/api/openapi.yaml`: `GET /permissions` (array; `pageSize=200` used), `GET /roles` (array of role summaries with `permCount`), `GET /roles/{roleId}/permissions` → `{roleId, roleName, permIds}`, `PUT /roles/{roleId}/permissions` body `{permIds}` → `{roleId, permCount}`. Page gate requires `ROLE.EDIT`.
- Errors: 403 `FORBIDDEN` and 400 `ADMIN_PERM_INCOMPLETE` display the response body `message` and keep the page open; the matrix save error and department-form error share this behavior. No silent failure.
- Menu/authorization derives solely from the session permission list (`permCode`) and server `modules` — no role-name checks anywhere; a session with `roles=[ADMIN]` but no permissions sees only home.
- `accessibleModules` = server `modules` ∪ permission-derived modules, restricted to the 5 known modules (single source of truth for menu + deep-link guard).
- UC-09 save semantics: full-set `PUT` (not delta); success text explicitly requires re-login; no claim that current session picks up new permissions.
- Q24: matrix page intentionally offers no permission create/edit/delete controls (no OpenAPI endpoint exists); listed as blocked, not implemented speculatively.

## Review record
- During implementation, Codex consult (`scripts/codex-consult.cjs`) was run once for T-023 and returned **revise** with two defects: (1) save/role-switch race in the matrix, (2) employee tab/list not gated by `EMP.VIEW`. Both were fixed as described above with dedicated regression tests (delayed-PUT lock test, TC-09-01 test, standalone `employee-forbidden` test).
- Per controller instruction for this resume turn, Codex was **not re-invoked**; no Codex approval is claimed for the final state.

## Verification record (this turn, from `app/`)
- Spec review (implementation turns): `docs/chapter-18-development-plan.md` T-023, `docs/api/openapi.yaml` permissions/roles paths and schemas, `docs/chapter-17-fullstack.md`, `docs/diagrams/usecase/usecase-spec.md` UC-07…UC-09, `database/01_schema.sql` app_role/permission/role_permission.
- `flutter analyze`: **No issues found! (ran 9.0s)** — exit 0.
- `flutter test`: **`00:17 +49: All tests passed!`** — exit 0 (24 `sprint04_test` + 3 `widget_test` + 6 `adaptive_shell_test` + 16 `sprint05_test`).
- `flutter test test/sprint05_test.dart -r expanded`: **16/16 passed** (test list captured during this turn).
- `dart format --output=none --set-exit-if-changed` on the 16 batch files: **16 files (0 changed)** — exit 0.
- `git diff --check`: exit 0 (only CRLF normalization warnings).
- `git status --porcelain` (HEAD `b107da0`): batch files modified/untracked as listed above; `database/02_seed_master.sql` and `docs/agile/sukhsorn-check-list.md` dirty but untouched by this batch; no secrets staged; **no commit or push created** (coordinator handles reviewed delivery).
- Passing local widget tests use an in-process fake HTTP adapter. **Not verified:** live backend integration, database execution, human review, or full requirement acceptance.

## Blocked acceptance criteria and unresolved checks
- Q-A, Q-B, Q-F, Q14, Q20, Q22, Q23, Q24 remain unresolved; none was used to invent behavior. Q22 blocks UC-10 employee role-assignment acceptance; Q24 blocks UC-08 permission CRUD (UI deliberately unavailable).
- Matrix end-to-end behavior against the real API (actual `/permissions`, `/roles` payloads, admin-permission completeness rule enforcement by server) depends on backend delivery; only the OpenAPI-shaped contract is exercised locally.
- Sprint-wide login/session flows depend on backend T-015/T-016 availability; not re-verified in this batch.
- Human review and reviewed delivery remain coordinator responsibilities.
