# Sprint 6 handoff — Sukhsorn

## Scope and ownership
- Task: T-028 (stop/route management per UC-11/UC-12: stop list/search/create/deactivate, route list, ordered-stops editor, API-computed total travel time BR-01, duplicate-stop rule BR-03, validation, phone/tablet tests).
- Owner: Sukhsorn (Flutter stream). Backend API/SQL (incl. T-029/T-039/T-053/T-055) remains owned by the backend stream; no peer workspace was read or edited. Client built against this workspace's `docs/api/openapi.yaml` (HEAD `b107da0`); API prefix `/api/v1`.
- Q-A, Q-B, Q-F, Q14, Q20, Q22, Q23, Q24 remain unresolved: no requirement answer was invented (details in "Blocked" section).
- Pre-existing unrelated dirty files preserved untouched: `database/02_seed_master.sql`, `docs/agile/sukhsorn-check-list.md`, plus all untracked files outside this batch.
- **No commit, push, merge, or PR was created** — coordinator handles reviewed delivery.

## CONTRACT-DRIFT-01 (coordinator integration review, 2026-10-08)
The two workspaces do **not** share an identical OpenAPI baseline. Recorded as directed; not resolved locally; no peer code rewritten; no endpoints invented.

| Aspect | Sukhsorn baseline (HEAD `b107da0`, this workspace) | Kaengkarn baseline (HEAD `1818593`, backend stream) |
|---|---|---|
| Field naming | camelCase: `routeId`, `routeName`, `totalMinutes`, `stopCount`, `stopSeq`, `includeStops`, `activeOnly` | snake_case: `route_id`, … |
| Route detail/update | client calls `PUT /routes/{routeId}` with embedded `stops[]`; repository also defines `GET /routes/{routeId}` (currently unused by UI) | route-level `GET/PUT /routes/{id}` **explicitly excluded** in `backend/src/routes/front.routes.js`; stop-order operations served as `GET/PUT /routes/{id}/stops` |
| Route creation | `POST /routes` with embedded `stops[]` | (to be reconciled by coordinator) |

### Exact local request/response shapes exercised by this client (mock-verified only)
- `GET /stops?activeOnly=true[&search=…]` → `200` **array** of `{stopId, stopName, address?, latitude, longitude, isActive}`; Bearer token required.
- `POST /stops` body `{stopName, address?, latitude?, longitude?}` (optional keys omitted when blank) → `201` stop object; `409 {code, message}` on duplicate name (message displayed verbatim).
- `PUT /stops/{stopId}` same body shape → stop object.
- `DELETE /stops/{stopId}` → `204`; `409 {code, message}` when still referenced (message displayed verbatim).
- `GET /routes?activeOnly=true&includeStops=true` → `200` **array** of `{routeId, routeName, description?, totalMinutes, isActive, stopCount, stops:[{stopSeq, stopId, stopName, travelMinutes}]}`.
- `POST /routes` body `{routeName, description?, totalMinutes, stops:[{stopId, travelMinutes}]}` (array order = displayed order; `description` omitted when empty) → `201` route object; `409`/`422 {code, message}` (e.g. `BR01_TOTAL_MISMATCH`).
- `PUT /routes/{routeId}` same body → `200` route object; `403 {code: FORBIDDEN, message}`, `409`, `422` displayed verbatim; page stays open on error.
- `totalMinutes` is computed client-side (live sum of `travelMinutes`, BR-01) and sent so the server can re-check; the user never types it.
- Local widget tests run against an in-process fake HTTP adapter shaped exactly as above. **No live-backend interoperability is claimed**; fixtures must eventually be pointed at the agreed actual API once the coordinator reconciles the two specs. No automatic merge performed.

## Changed files

### Models, API, providers
- `app/lib/features/front/front_models.dart`: `Stop`, `RouteStop`, `Route` (with `resolvedStopCount`), `parseStops`/`parseRoutes` shape guards (throw `ApiException` Thai message on non-array/malformed payloads).
- `app/lib/features/front/front_repository.dart`: `fetchStops` (query `activeOnly`/`search`), `createStop`, `updateStop`, `deactivateStop`, `fetchRoutes` (query `activeOnly`/`includeStops`), `fetchRoute` (defined, currently unused by UI), `createRoute`, `updateRoute`; response-shape guards `_stop`/`_route`.
- `app/lib/features/front/front_providers.dart`: `frontRepositoryProvider`, `stopsProvider` (autoDispose family by search string), `routesProvider`, `refreshStops(ref, {search})`, `refreshRoutes(ref)`.

### Screens (UC-11 / UC-12)
- `app/lib/features/front/stop_list_page.dart`: list with 350 ms search debounce (`GET` param `search`), create/edit dialog, deactivate confirm; gated by `ROUTE.EDIT` for mutations; keys `stop-search`, `stop-create`, `stop-{id}`, `stop-name`, `stop-address`, `stop-latitude`, `stop-longitude`, `stop-save`, `stop-save-error`.
- `app/lib/features/front/route_list_page.dart`: list with summary `route-summary-{id}` (`'{n} จุดจอด · {m} นาที'`), create/edit entry points gated by `ROUTE.EDIT`.
- `app/lib/features/front/route_editor_page.dart`: ordered-stops editor — per-row travel-minutes controllers with live total (`route-total`: `'เวลารวมทั้งเส้นทาง: {n} นาที'`), move up/down (order = PUT array order), remove, add-stop dialog excluding stops already in the route (BR-03), min-2-stops guard (`route-min-stops`, no POST/PUT sent), integer ≥0 minutes validation, server-error container `route-save-error` (403/409/422), read-only rendering without `ROUTE.EDIT`.
- `app/lib/features/front/front_page.dart`: **converted to `ConsumerStatefulWidget`** — own `TabController`, explicit `_tabIndex` state updated by `TabBar.onTap`, body = `IndexedStack` (both tabs built, state preserved, `SizedBox.expand` wrappers). See defect record below.

### Tests
- `app/test/sprint06_test.dart` (new): **18 tests** — model parse/shape-reject; `GET /stops` contract (Bearer, `activeOnly`, no `search` initially) + debounced `search` param (exactly 2 requests); create-stop empty-name block + `POST` body `{'stopName': …}` + 201 snackbar + reload; create 409 message in dialog (no reload); deactivate 204 (snackbar + reload, exactly 1 DELETE); deactivate 409 (message shown, no reload); `GET /routes` contract (Bearer, `includeStops`, `activeOnly`) + summary text; ordered editor (edit minutes → live total, reorder, add via dialog, `PUT /routes/1` exact body in displayed order, success, reload); create <2 stops blocked (0 and 1 stop, zero POSTs); dialog-flow (BR-03 exclusion asserted while menu open, negative minutes blocked, then `POST` 201 with exact body); non-integer minutes block with no PUT; 422 `BR01_TOTAL_MISMATCH` shown, page stays; 403 shown, page stays; `ROUTE.VIEW`-only read-only mode (no create/edit controls, disabled fields); no `ROUTE.VIEW` → `front-forbidden`, no tabs; phone 390 px NavigationBar + tab switch; tablet 800 px NavigationRail; **back-navigation regression** (create editor → type name → Back → list restored, no stale text, tab switch to stops and back works).
- `app/test/sprint06_probe_test.dart` (new): 4 regression probes for the framework defect below — create editor + typed name, create editor without typing, create editor with long settle time, edit existing route + typed name.
- `docs/agent-handoffs/sprint06-sukhsorn.md`: this record.

## Defect fixed in this batch: TabBarView build-phase exception
- **Symptom (before fix):** opening the *create* route editor raised `EXCEPTION CAUGHT BY AN ANIMATION LIBRARY` failures: `_TabBarViewState.didChangeDependencies` → `PageController.jumpToPage` → `TabController.offset=` → `_TabStyle.setState()` during build, flushed from a `LayoutBuilder` layout callback (`setState() or markNeedsBuild() called during build`). Reproduced by probeA/B/C; probeD (edit-existing flow) passed, isolating the trigger to the create flow, independent of text entry.
- **Fix (app-level, per coordinator directive):** `front_page.dart` no longer uses `TabBarView`. Explicit tab state (`_tabIndex`) + `IndexedStack` body, `TabBar.onTap` updates state, own `TabController` for the indicator only. Both tabs stay alive (state preserved across switches). No FlutterError/assertion suppression, no test weakening, no Flutter SDK edits.
- **Also fixed:** ordered-stops test was missing its `PUT /api/v1/routes/1` success handler (the visible `route-save-error` was the fake backend's legitimate no-route response); added the missing back-navigation + tab-switch regression test.

## Contract decisions (implementation choices made locally)
- Permission gating uses `ROUTE.VIEW` (read) and `ROUTE.EDIT` (mutations) from OpenAPI `x-permission`; UC-11/UC-12 text references `STOP.EDIT`, which does not exist in the OpenAPI permission list — `ROUTE.EDIT` chosen as the closest authoritative source, flagged here for reconciliation.
- OpenAPI's embedded-stops route operations (`POST /routes`, `PUT /routes/{routeId}` with `stops[]`) were followed over UC-12's stale `/routes/:id/stops` sub-resource endpoints — **which now matches what the peer backend actually implements** (see CONTRACT-DRIFT-01); the embedded `PUT /routes/{routeId}` call is therefore expected to 404 against the current peer backend.
- No separate `GET /routes/{routeId}` call was added to the editor UI (the list passes the route object in); repository method exists but is unused.
- Route editor reads/saves via `GET /routes` + `PUT /routes/{routeId}` only; stop CRUD via `/stops*` only.

## Review record
- This batch did not invoke a Codex consult; **no Codex approval is claimed.** Coordinator directives received during the session were applied: (1) app-level IndexedStack fix instead of SDK edits/suppression, (2) validate with all four probes + sprint06 + full regression/analyzer, (3) record CONTRACT-DRIFT-01, do not claim live interoperability, no automatic merge.
- Coordinator/procedure constraints honored: no Flutter SDK reads/edits this batch, no always-permissions requests, no subagents, no new dependencies, no commits/pushes.

## Verification record (this turn, from `app/`)
- `flutter analyze --no-pub`: **No issues found! (ran 9.2s)** — exit 0.
- `flutter test --no-pub test/sprint06_probe_test.dart -r expanded`: **4/4 passed** (`+4: All tests passed!`).
- `flutter test --no-pub test/sprint06_test.dart -r expanded`: **18/18 passed** (`+18: All tests passed!`).
- `flutter test --no-pub` (full suite, run after final format): **71/71 passed** (`00:29 +71: All tests passed!`) = prior 49 (sprint04 24 + widget 3 + adaptive_shell 6 + sprint05 16) + sprint06 18 + probes 4. Sprint 4/5 tests untouched and green.
- `dart format --output=none --set-exit-if-changed` on this batch's files (`lib/features/front/*`, `test/sprint06_test.dart`, `test/sprint06_probe_test.dart`): clean after formatting. Pre-existing deviations in `booking_page.dart`/`driver_page.dart`/`report_page.dart` (tracked, unmodified, committed at HEAD) were **left untouched** as out of scope.
- `git diff --check`: exit 0 (only pre-existing CRLF normalization warnings across tracked files).
- `git status --porcelain` (HEAD `b107da0`): batch files modified/untracked as listed above; `database/02_seed_master.sql` and `docs/agile/sukhsorn-check-list.md` dirty but untouched; no secrets staged; **no commit created**.
- **Not verified:** live backend integration, real database execution, interoperability with the peer backend (CONTRACT-DRIFT-01), human review, full requirement acceptance. All passing tests use the in-process fake HTTP adapter with local-spec-shaped payloads.

## Blocked acceptance criteria and unresolved checks
- Q-A, Q-B, Q-F, Q14, Q20, Q22, Q23, Q24 remain unresolved; none was used to invent behavior (Q22/Q24 constraints from sprint 5 still apply).
- **CONTRACT-DRIFT-01 blocks any live end-to-end claim** for T-028: until the coordinator reconciles the OpenAPI baselines (camelCase embedded-stops spec vs snake_case `/routes/{id}/stops` backend), the client's `PUT /routes/{routeId}` (and query/body naming generally) cannot be expected to work against the peer backend, and fixtures must be re-pointed to the agreed actual API rather than silently accepting the local spec.
- End-to-end UC-11/UC-12 acceptance (real payloads, referential 409 from actual DB state, permission enforcement by real server) requires the reconciled backend.
- Human review and reviewed delivery remain coordinator responsibilities.
