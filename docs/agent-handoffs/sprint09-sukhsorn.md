# Sprint 9 handoff — Sukhsorn

## Scope and ownership
- Task: T-041 (My Bookings list with status filters, QR display, cancellation confirm/error/reload flows; UC-19/UC-20/UC-21, mockup C4/C5; chapter-18 line 523, `@agent-ui`). Owner: Sukhsorn (Flutter stream). Backend API/SQL (incl. T-029/T-039/T-053/T-055) remains owned by the backend stream; no peer workspace was read or edited. Client built against this workspace's `docs/api/openapi.yaml` (HEAD `b107da0`, branch `feature/sprint3-sukhsorn-autonomous`); API prefix `/api/v1`.
- Q-A, Q-B, Q-F, Q14, Q20, Q22, Q23, Q24 remain unresolved from earlier sprints; Q6 (cancel cutoff) and Q7 (QR reuse/expiry) remain unresolved from this feature area; **checked_in/no_show tab placement is newly blocked this batch** (see Blocked). No requirement answer was invented.
- Pre-existing dirty files preserved untouched: `database/02_seed_master.sql`, `docs/agile/sukhsorn-check-list.md`, all tracked modifications from earlier batches (incl. `app/pubspec.yaml`/`app/pubspec.lock` before this batch's `qr_flutter` add), and all untracked files outside this batch.
- **No commit, push, merge, or PR was created** — coordinator handles reviewed delivery.

## CONTRACT-DRIFT-01 (carry-forward, unchanged)
The two workspaces do not share an identical OpenAPI baseline (Sukhsorn: camelCase embedded-stops spec; Kaengkarn backend: snake_case sub-resources). All T-041 fixtures mock this workspace's camelCase spec only; **no live-backend interoperability is claimed**, no endpoints invented, no automatic merge.

## Exact local request/response shapes exercised by this client (mock-verified only)
- `GET /bookings?status=reserved|completed|cancelled` (tab switch) → `200` **array** of Booking `{bookingId, bookingCode, custId, customerName, schedId, boardStopId, alightStopId, seats, status, bookTime, cancelTime, qrToken, routeName, departAt, serviceDate, boardStopName, alightStopName, …}`; Bearer required; tab 1 (default) sends `status=reserved`.
- `GET /bookings/{bookingCode}` → `200 Booking` detail (qrToken source for UC-20); `403` message rendered verbatim (จองของผู้อื่น).
- `POST /bookings/{bookingCode}/cancel` with **no body**, Bearer → `204` empty (success: snackbar 'ยกเลิกการจองแล้ว' + reload list), `409 CANCEL_NOT_ALLOWED` message shown in dialog (dialog stays, no reload).
- QR rendering is local (`qr_flutter 4.1.0` `QrImageView` from `qrToken`); the stale usecase-spec `GET /booking/:id/qr` was NOT implemented (see decisions).
- Local widget tests run against an in-process fake HTTP adapter shaped exactly as above. **No live-backend interoperability is claimed.**

## Changed files

### Models, API, providers (new/extended)
- `app/lib/features/booking/booking_models.dart`: `BookingRecord` extended with `custId`/`customerName`/`cancelTime`; `parseBookings` throws Thai `ApiException` on non-array/non-map payloads.
- `app/lib/features/booking/booking_repository.dart`: `fetchMyBookings({status})`, `fetchBooking({bookingCode})`, `cancelBooking({bookingCode})` (no body) — all `/api/v1`, shape-guarded.
- `app/lib/features/booking/booking_providers.dart`: `myBookingsProvider` (family by status, `''` = unfiltered), `bookingDetailProvider` (family by bookingCode).

### Screens
- `app/lib/features/booking/my_bookings_page.dart` (new): UC-19/21 — 3 tabs `mybk-tab-0/1/2` (กำลังจะถึง→`reserved`, เดินทางแล้ว→`completed`, ยกเลิก→`cancelled`), list `mybk-list` with cards (`mybk-card/title/meta/stops/status/qr`), empty/error/retry via shared `AsyncSection` states, cancel button `mybk-cancel-{code}` only when `status == reserved && can('BK.CANCEL')`, confirm dialog `mybk-cancel-dialog` with keys `mybk-cancel-back`/`mybk-cancel-confirm`/`mybk-cancel-error`. **Dialog hardening (Codex r1 revise):** `barrierDismissible: false` + `PopScope(canPop: !submitting)` around the AlertDialog inside `StatefulBuilder`; a `cancelSucceeded` flag is set **only on HTTP 204**, and list invalidation + snackbar run **after the dialog returns, keyed to that flag — not to the dialog result**; confirm button disabled while the POST is in flight.
- `app/lib/features/booking/booking_qr_page.dart` (new): UC-20 — detail via `bookingDetailProvider`; QR `qr-code` shown only for `reserved`/`checked_in` with non-empty `qrToken`; `qr-checked-in` chip for `checked_in`; `qr-cancelled` for cancelled; `qr-not-available` for `completed`/`no_show`; `qr-missing` when token empty; `qr-hint`/`qr-info`/`qr-booking-code`. Comment neutral about QR reuse/expiry (Q7 pending — no expiry claim).
- `app/lib/features/booking/booking_page.dart`: AppBar action `book-my-trips` (entry to My Bookings) and success-view button `book-view-qr` (deep-link to the QR page of the new booking).

### Dependency
- `app/pubspec.yaml` + `app/pubspec.lock`: `qr_flutter 4.1.0` (added via `flutter pub add qr_flutter`).

### Tests
- `app/test/sprint09_test.dart` (new): **17 tests** —
  1. `parseBookings` accepts array of Booking, rejects malformed payload;
  2. entry from booking flow: AppBar `book-my-trips` → `GET /bookings?status=reserved` (Bearer, correct query), card texts complete, location stays `/booking`;
  3. tab switching sends `status=completed`/`cancelled` in order; cancel button exists only on `reserved`;
  4. empty tab → `list-empty`;
  5. list 500 → `list-error-message` with server text; retry issues a second `status=reserved` GET;
  6. QR page: `GET /bookings/{code}` (Bearer) → `QrImageView` from provider `qrToken`, detail texts complete;
  7. UC-20 2a: cancelled booking → no QR (`qr-cancelled`);
  8. QR page 403 → server message verbatim;
  9. cancel happy path: confirm → `POST /bookings/{code}/cancel` (Bearer, **no body**) → 204 → snackbar 'ยกเลิกการจองแล้ว' + reload (2nd `status=reserved` GET → `list-empty`);
  10. cancel 409 `CANCEL_NOT_ALLOWED` → message in dialog, dialog stays, **no** reload;
  11. no `BK.CANCEL` → list/QR viewable, no cancel button;
  12. booking success → `book-view-qr` → QR page shows provider token `tok-abcdef123456`;
  13. **pending-POST dialog hardening** (4000 ms in-flight): confirm disabled; ancestor `PopScope(canPop:false)` present; `handlePopRoute` (real back) leaves dialog + list intact; `Navigator.maybePop` on the dialog's navigator leaves dialog + list intact after settle; barrier tap no-op; second confirm tap → still exactly 1 POST; then 204 → snackbar + reload + `list-empty`;
  14. `checked_in` detail → QR + chip 'เช็คอินแล้ว';
  15. `completed` detail → `qr-not-available`;
  16. `qrToken` null → `qr-missing` regardless of status;
  17. **QR encoder proof**: pixels from the real page's `QrPainter` (rendered via `tester.runAsync` — `Picture.toImage` hangs under fake async) equal pixels of an independently constructed `QrImageView` for the expected token.
- `app/test/sprint08_test.dart` and all earlier test files: **not modified, not weakened**.

## Contract decisions (implementation choices made locally)
- **OpenAPI wins over stale docs:** usecase-spec `GET /booking/:id/qr` was NOT implemented; QR uses `GET /bookings/{bookingCode}`'s `qrToken` per OpenAPI + chapter-18:523 flow (same drift pattern as sprints 6–8).
- **Entry point = pushed page `book-my-trips` from the booking flow AppBar** — mockup C5's bottom-nav 'รายการ' item is not feasible with the shell's module gating (`adaptive_shell` bottom navigation is module-driven; sprint-9 scope does not change shell navigation). Noted as a mockup deviation, not a requirement change.
- **Three tabs = `reserved` / `completed` / `cancelled`** (chapter-18:523 wording 'กำลังจะถึง/เดินทางแล้ว/ยกเลิก'): `checked_in` and `no_show` have **no tab** (Blocked below); they are still handled on the QR page (tests 14/15).
- **No client-side cancel cutoff:** Q6 unresolved → client sends cancel whenever the button is shown (`status==reserved`); server remains authoritative (any 409 message rendered verbatim). No cutoff time invented or displayed.
- **No BR-09 expiry/reuse text:** Q7 unresolved → the "สแกนซ้ำ" hint is a neutral note; no expiry claim made anywhere.
- **QR shown only for `reserved`/`checked_in` with non-empty token**; hidden (with explicit state keys) for `cancelled`/`completed`/`no_show`/empty-token — chosen conservatively so a dead booking never shows a scannable code.
- **No from/to date-filter UI** (UC-19's service_date filter is not in the client contract; see Blocked).
- **Cancel button permission-gated** on `BK.CANCEL` (OpenAPI `x-permission`), read-only flows need no permission.
- **`maybePop` return-value assertion replaced by behavioral assertions** — this Flutter checkout's `NavigatorState.maybePop` returns `true` for `RoutePopDisposition.doNotPop` as well (`packages/flutter/lib/src/widgets/navigator.dart:5611-5613`: consumed ≠ popped). Test 13 therefore proves the veto by observable outcome (dialog and list survive well past animation time, inside the in-flight POST window) — discriminating: without the PopScope the dialog would be gone after the settle. Documented in a Thai comment at the assertion.
- Conventions kept: sprint-7/8 harness patterns (`pumpShuttle`/`FakeBackend.on`/`jsonResponse`/`emptyResponse`/`pumpFrames`/`tapKey`), `AsyncSection` list states + 'ลองอีกครั้ง' retry, `authState.can()` permission checks, fixture helpers local to `sprint09_test.dart` (date-relative `isoAt`).

## Review record (Codex consult — round 1 completed, round 2 attempted/unavailable, via `node scripts\codex-consult.cjs --question-file <UTF-8 temp file>` from workspace root)
- **Round 1 → `human_required` with REVISE items:** (1) dialog dismiss race during in-flight cancel POST — **fixed** (`barrierDismissible:false` + `PopScope(canPop:!submitting)` + invalidate keyed to HTTP 204, not dialog result); (2) QR pixel-level proof missing — **fixed** (test 17 via `QrPainter.toImage` in `runAsync`); (3) status-branch tests missing — **fixed** (tests 14/15/16); (4) a source comment claimed 'สแกนซ้ำ' behavior not in contract — **fixed** (neutral Q7-pending wording); (5) checked_in/no_show tab mapping + UC-19 service_date confirmation → **recorded as blocked, not invented**.
- **Round 2 attempted → tool unavailable:** Codex returned usage-limit error (resets 23:12). **No round-2 verdict exists; no Codex approval of T-041 completion is claimed.** The round-1 REVISE items above were implemented and are verified only by the local evidence below.

## Verification record (this batch, from `D:\data\shuttle-sukhsorn\app`, single-command invocations)
- `flutter analyze --no-pub`: **No issues found! (ran 5.6s)** — final run after the last edits (earlier runs after each fix round also clean).
- `dart format` on changed files: applied (`0 changed` on final pass — already formatted).
- `flutter test --no-pub test/sprint09_test.dart`: **17/17 passed** (`00:09 +17: All tests passed!`) — run after the test-13 rewrite (earlier intermediate states: 12/12 before the 5 Codex-r1 tests were added, then a failing test 13 at `expect(didPop, isFalse)` diagnosed as the SDK semantics issue above).
- `flutter test --no-pub` (full suite): **124/124 passed** (`00:33 +124: All tests passed!`) — 107 baseline (sprints 4–8 + widget + adaptive_shell + probes) + sprint09 17. No existing test weakened or modified.
- `git diff --check`: clean (only pre-existing LF/CRLF normalization warnings on tracked files).
- `git status --porcelain` (HEAD `b107da0`): batch files as listed above (`booking_page.dart`, `booking_models/repository/providers.dart`, `pubspec.yaml/lock` modified; `booking_qr_page.dart`, `my_bookings_page.dart`, `sprint09_test.dart` untracked); `database/02_seed_master.sql` and `docs/agile/sukhsorn-check-list.md` dirty but untouched; no probe/diagnostic files left behind (temp probe file created during test-13 diagnosis was deleted); no secrets staged; **no commit created**.
- **Not verified:** live backend integration, real database execution, emulator run, interoperability with the peer backend (CONTRACT-DRIFT-01), human review, full requirement acceptance. All passing tests use the in-process fake HTTP adapter with local-spec-shaped payloads; passing local tests ≠ human review or live integration.

## Blocked acceptance criteria and unresolved checks
- **checked_in/no_show have no tab (new this batch):** chapter-18:523's three tabs cannot represent `checked_in`/`no_show` bookings, and UC-19's `service_date` from/to filter is not exposed in this workspace's OpenAPI. Current behavior: those statuses are reachable only via the booking-success → QR flow (tests 14/15); list placement/filtering awaits instructor confirmation. User directed: record as blocked, do not re-ask.
- **Q6 (cancel cutoff):** client-side cutoff not implemented; server authority assumed (any rejection message displayed verbatim). Acceptance of exact cutoff semantics unresolved.
- **Q7 (QR reuse/expiry):** no reuse/expiry claim made anywhere (neutral hint only); mockup C4's "สแกนซ้ำ" wording not implemented as behavior.
- Q-A, Q-B, Q-F, Q14, Q20, Q22, Q23, Q24 remain unresolved from earlier sprints; none was used to invent behavior. (Q-C/Q19 remains open from sprint 8.)
- **CONTRACT-DRIFT-01 blocks any live end-to-end claim** for T-041: booking/QR/cancel calls (camelCase paths) cannot be expected to work against the peer backend until the coordinator reconciles the OpenAPI baselines.
- End-to-end UC-19/20/21 acceptance (real permission enforcement, real 409 cutoff, real QR scans on device) requires the reconciled backend; emulator/device verification not run.
- Human review and reviewed delivery remain coordinator responsibilities.
