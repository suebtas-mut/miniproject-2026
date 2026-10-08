# Sprint 11 Handoff — T-050/T-051 (Sukhsorn / Flutter stream)

- **วันที่**: 2026-10-09
- **Branch**: `feature/sprint3-sukhsorn-autonomous` (HEAD `b107da0`, ไม่มี commit จาก worker)
- **ขอบเขตงาน**: Flutter client + เอกสารเท่านั้น — backend เป็นเจ้าของ API/SQL ทั้งหมด
  (T-029/T-039/T-053/T-055 ของสาย backend ไม่ได้แตะ)
- **สถานะ**: ทำงานในเครื่องเสร็จ + เทสต์ผ่านครบ — **ยังไม่มี human review, ยังไม่ได้ test กับ server จริง**

## 1. งานที่ทำ

### T-050 — สแกน QR เช็คอินขึ้นรถ (UC-25 · จอ D3)
- `POST /api/v1/driver/bookings/scan` (ตาม OpenAPI, x-permission `QR.SCAN`) body `{qrToken, tripId}` →
  200 `CheckinResult` (bookingCode, customerName, seats, boardStopName, checkinTime, boardSeq, message)
- Debounce 2 วินาที: `MobileScannerController(detectionTimeoutMs: 2000)` (ชั้นแรก) +
  `_lastCameraTokenAt` timestamp ใน `ScanQrScreen` (ชั้นสอง, inject `clock` สำหรับเทสต์)
- สถานะกล้อง: `starting` (แสดง `MobileScanner` จริง) / `denied` (`permissionDenied` error) /
  `unavailable` (`unsupported` error) / `failed` (error อื่น) — ทุกสถานะมีปุ่ม "ลองอีกครั้ง" (`scan-cam-retry`)
  และข้อความบอกทางเลือก "กรอก Token เอง"
- ผลลัพธ์จากเซิร์ฟเวอร์แสดง **verbatim** (ไม่แปล/แต่งข้อความใหม่):
  - 200: แบนเนอร์เขียว `scan-banner-ok` — `${message} — ${bookingCode} · ${customerName} · จุดลง ${boardStopName}`
    + รายละเอียด `เวลา ${checkinTime} · ลำดับขึ้นรถ ${boardSeq}`
  - 409 BR09_ALREADY_CHECKED_IN: แบนเนอร์แดง `scan-banner-error` — ข้อความเซิร์ฟเวอร์ + สแกนต่อได้
  - 409 ผิดรอบ (TC-25-01): ข้อความ "QR นี้ไม่ใช่รอบที่กำลังเดินรถ"
  - 404: ข้อความ "ไม่พบ QR Token นี้" (หรือข้อความจากเซิร์ฟเวอร์)
  - 403: ข้อความ "ไม่มีสิทธิ์สแกน QR" (หรือข้อความจากเซิร์ฟเวอร์)
- ทางสำรอง R5 (Emulator/กล้องเสีย): ปุ่ม `scan-manual-open` "กรอก Token เอง" →
  dialog `scan-manual-dialog` (form validation: ว่างถูกบล็อก, ไม่ส่ง POST) →
  `scan-manual-field` → `scan-manual-submit` "ยืนยัน" → `_submitToken(token)` → POST เหมือนกล้อง
- **Mock scanner platform สำหรับเทสต์**: `scanQrCameraBuilderProvider` + `ScanQrScreen.scannerBuilder`
  (inject ได้) — เทสต์ใช้ `fakeScannerBuilder` สร้าง widget จำลอง `MobileScanner` เรียก `onToken(raw)`
  โดยไม่พึ่งกล้องจริง · **การทดสอบกล้องบนเครื่อง Android จริงเป็นงานแยกต่างหาก**
- `dispose()` เรียก `unawaited(_msController?.dispose())` (คืน Future) — `MobileScannerController`
  สร้างแบบ lazy (`_msController ??=`) กัน leak เมื่อ state rebuild

### T-051 — ปิดรอบ + สรุป No Show (UC-25/UC-26 · จอ D4)
- **ปุ่มปิดรอบใน Manifest (D2)**: แสดงเฉพาะเมื่อ `can('TRIP.END')` และ `tripStatus == 'running'` —
  แตะเปิด `drv-end-dialog` ยืนยัน `drv-end-confirm` "ยืนยันปิดรอบ" →
  `POST /api/v1/driver/trips/{tripId}/end` (x-permission `TRIP.END`) body ว่าง →
  204 → `pushReplacement` ไป `TripSummaryScreen` (ไม่ pop กลับ — หลังปิดรอบ Manifest ไม่ใช้แล้ว)
  · ยกเลิก `drv-end-cancel` ไม่ส่ง POST · 409 (BR-10: ยังปิดไม่ได้) → `drv-end-error` ใน dialog, dialog ค้าง
  (ผู้ใช้ต้อง "ยกเลิก" เอง — ไม่ auto-dismiss)
- **หน้าสรุปหลังปิดรอบ (D4)**: `GET /api/v1/driver/trips/{tripId}/manifest` (เหมือน D2) →
  หัวข้อ `drv-sum-title` "สรุปการเดินทางรอบ HH:mm" + KPI 4 ตัว:
  - ขึ้นรถแล้ว `drv-sum-boarded`: `status ∈ {checked_in, completed}` (นับ checked_in ด้วย — BR-10
    reserved → no_show ตอน end แต่ถ้า end ก่อน checkin จะนับ as boarded)
  - ลงรถแล้ว `drv-sum-alighted`: `status == 'completed'`
  - No Show `drv-sum-noshow`: `status == 'no_show'`
  - ยกเลิก `drv-sum-cancelled`: `status == 'cancelled'`
  - รายชื่อ No Show `drv-sum-noshow-{bookingCode}` (ชื่อ + bookingCode + จุดขึ้น)
  - ไม่มี No Show → `drv-sum-noshow-empty` "ไม่มีผู้โดยสาร No Show" (ทางเลือก 5a)
  - 404 → ข้อความ + ปุ่ม "ลองอีกครั้ง" (`list-error-message`) → ได้ข้อมูล
- **การ์ดรอบเสร็จแล้วใน D1**: `tripStatus == 'completed'` → แตะ card →
  ถ้าทราบรอบจากเครื่องนี้ (`startedTripsProvider`) → เปิด `TripSummaryScreen` ·
  ไม่ทราบรอบ → แสดงข้อความข้อจำกัด `drv-conflict-gap` (tripId gap จาก T-048)
- **ปุ่มสแกนใน Manifest (D2)**: แสดงเฉพาะ `can('QR.SCAN')` และ `tripStatus == 'running'` —
  แตะเปิด `ScanQrScreen(tripId: ...)` ด้วย `Navigator.push` (ไม่ pushReplacement — กลับมาได้)

### Android permission + pubspec
- `app/android/app/src/main/AndroidManifest.xml`: เพิ่ม `<uses-permission android:name="android.permission.CAMERA"/>`
- `app/pubspec.yaml`: เพิ่ม `mobile_scanner: ^7.4.2` (lock ปรับ auto)

## 2. ไฟล์ที่เปลี่ยน/สร้าง

| ไฟล์ | สถานะ |
|---|---|
| `app/lib/features/driver/scan_qr_screen.dart` | ใหม่ — `ScanQrScreen`, `_ManualEntryDialog`, `kScanDebounce`, `scanQrCameraBuilderProvider` |
| `app/lib/features/driver/trip_summary_screen.dart` | ใหม่ — `TripSummaryScreen` (KPI + No Show list) |
| `app/lib/features/driver/manifest_screen.dart` | แก้ — + ปุ่มสแกน/ปิดรอบ + `_confirmEnd` + pushReplacement to summary |
| `app/lib/features/driver/driver_schedule_screen.dart` | แก้ — `_openTripDetail` completed → summary, `drv-conflict-gap` snackbar |
| `app/lib/features/driver/driver_models.dart` | แก้ — + `CheckinResult`/`parseCheckinResult` + summary getters (boardedCount/alightedCount/noShowCount/noShowPassengers/cancelledCount) |
| `app/lib/features/driver/driver_repository.dart` | แก้ — + `scanCheckin(qrToken, tripId)` |
| `app/lib/features/driver/driver_providers.dart` | แก้ — (ไม่เปลี่ยนโครงสร้าง, คง `startedTripsProvider` เดิม) |
| `app/android/app/src/main/AndroidManifest.xml` | แก้ — + CAMERA permission |
| `app/pubspec.yaml` | แก้ — + mobile_scanner 7.4.2 |
| `app/pubspec.lock` | แก้ — lock ปรับตาม pubspec |
| `app/test/sprint11_test.dart` | ใหม่ — 20 เทสต์ |

ไม่ได้แตะ: `backend/`, `database/`, `docs/api/openapi.yaml`, ไฟล์ dirty เดิม
(`database/02_seed_master.sql`, `docs/agile/sukhsorn-check-list.md` คงสภาพเดิม), automation scripts

## 3. ข้อตัดสินใจเรื่องสัญญา (Contract decisions)

1. **เส้นทาง API ตาม OpenAPI ไม่ใช่ usecase-spec**: usecase-spec UC-25 ระบุ
   `POST /driver/checkin` แต่ **OpenAPI จริงคือ `/driver/bookings/scan`** — ใช้ OpenAPI
   (ตามกติกาสัญญา "API prefix เป็น /api/v1 และ response contracts ต้องตรง OpenAPI")
2. **ข้อความเซิร์ฟเวอร์แสดง verbatim**: ไม่แปล/แต่งข้อความใหม่ —
   409/404/403 แสดง `message` จาก response body ตรงตัวอักษร (รวม "QR นี้ไม่ใช่รอบที่กำลังเดินรถ"
   และข้อความ BR09_ALREADY_CHECKED_IN)
3. **Debounce 2 ชั้น**: `MobileScannerController(detectionTimeoutMs: 2000)` (กัน onDetect เร็วเกิน)
   + `_lastCameraTokenAt` ใน state (กัน POST ซ้ำระหว่างรอ response หรือข้าม rebuild) —
   inject `clock` (default `DateTime.now`) สำหรับเทสต์
4. **BR-10: reserved → no_show ตอน end**: ข้อความใน mockup D4 "ผู้โดยสารที่ยังไม่ check-in
   จะถูกนับเป็น no_show" ขัดแย้งกับ OpenAPI `BookingStatus.no_show` (สถานะถูก set โดยเซิร์ฟเวอร์
   ตอน `POST /driver/trips/{id}/end`) — **ใช้ OpenAPI** ไม่ใช้ mockup text (บันทึก decision นี้)
5. **KPI นับจาก `status` หลัง end**: `boardedCount` = `checked_in` || `completed` (ไม่ใช่ `boardSeq != null`);
   `alightedCount` = `completed`; `noShowCount` = `no_show`; `cancelledCount` = `cancelled` —
   นับตรงไปตรงมา ไม่เดาจาก field อื่น
6. **ปุ่มสแกน/ปิดรอบแสดงเฉพาะ `tripStatus == 'running'`**: รอบเสร็จแล้ว (`completed`) ไม่แสดง
   ปุ่มสแกน/ปิดรอบ — manifest ยังดูได้ (ปุ่ม back ปกติ) แต่ไม่รับ input ใหม่
7. **`ScanQrScreen` ไม่ดู permission จาก auth**: mount ตรง (direct-mount) โดยไม่ผ่าน
   `authControllerProvider` — ต่างจาก `ManifestScreen` ที่ดู `can('QR.SCAN')` —
   เพราะสิทธิ์ถูกบังคับ server-side (403) และหน้าสแกนควรเปิดได้แม้ auth/me ยังไม่ตอบ
8. **`_ManualEntryDialog` เป็น StatefulWidget**: controller เป็น field ของ state
   (ไม่ใช่ local variable ใน `_openManualEntry`) — กัน `TextEditingController` ถูกใช้หลัง dispose
   ตอน dialog exit animation ยังรัน (root cause ของ framework assertion cascade ที่ทำให้
   R5 test fail 12 tests ในรันแรก)
9. **deferred: "สแกนจากรูป"** (เลือกรูปจากแกลเลอรี → decode QR): ไม่ได้ทำใน sprint นี้ —
   ไม่ระบุใน OpenAPI/acceptance criteria ชัดเจน, บันทึกเป็น backlog

## 4. คำสั่ง + ผลลัพธ์จริง

```
# workdir: D:\data\shuttle-sukhsorn\app
dart format test/sprint11_test.dart lib/features/driver/scan_qr_screen.dart
  → Formatted 2 files (0 changed) in 0.04s
flutter analyze --no-pub
  → Analyzing app... No issues found! (ran in 6.3s)
flutter test --no-pub test/sprint11_test.dart --plain-name "ทางสำรอง R5"
  → 00:02 +1: All tests passed!              [รันแรก fail: "A TextEditingController was used
                                               after being disposed" — แก้ด้วย _ManualEntryDialog
                                               StatefulWidget ที่ dispose เองใน dispose()]
flutter test --no-pub test/sprint11_test.dart
  → 00:05 +20: All tests passed!             [20/20]
flutter test --no-pub
  → 00:42 +159: All tests passed!            [139 เดิม + 20 ใหม่ — เทสต์เดิมไม่มีการอ่อนข้อ]

# workdir: D:\data\shuttle-sukhsorn
git status --porcelain
  → ไฟล์ dirty เดิมคงสภาพ (M database/02_seed_master.sql, M docs/agile/sukhsorn-check-list.md …)
    ไฟล์ใหม่เป็น untracked, ไม่มีอะไรถูก stage, HEAD ยังเป็น b107da0
git diff --check
  → เฉพาะ warning CRLF (ไม่มี whitespace error)
git diff --cached --name-only
  → (ว่าง — ไม่มีอะไรถูก stage)

# Codex consult (advisory)
node scripts\codex-consult.cjs --question-file <sprint11-question>
  → ไม่ได้รัน — sprint09/10 ได้ human_required (usage limit) — ยังไม่ได้ลอง sprint11
  → **ไม่มีการกล่าวอ้างว่า Codex อนุมัติงานชุดนี้**
```

## 5. เทสต์ที่เพิ่ม (`app/test/sprint11_test.dart` — 20 รายการ)

**Contract parsing (1)**
1. parse รับสัญญา OpenAPI ของ `CheckinResult` + reject รูปแบบผิด + นับ KPI สรุป
   (`boardedCount`/`alightedCount`/`noShowCount`/`cancelledCount`) จาก booking statuses ที่หลากหลาย

**T-050 Scan QR (8)**
2. สแกนสำเร็จ: POST /driver/bookings/scan {qrToken, tripId} + Bearer → แสดงชื่อผู้โดยสาร + จุดลง
3. debounce 2 วินาที: อ่านซ้ำภายใน 2s ไม่ส่ง POST (ใช้ `fakeClock` + advance) · เกิน 2s ส่งได้
4. กันส่งซ้ำระหว่าง POST ค้าง: ยิงซ้ำระหว่างรอ (delay response) → ไม่มี POST ที่สอง
5. 409 ซ้ำ (BR-09): ข้อความเซิร์ฟเวอร์ verbatim + สแกนต่อได้หลังล้มเหลว
6. 409 ผิดรอบ (TC-25-01): แสดง "QR นี้ไม่ใช่รอบที่กำลังเดินรถ" สีแดง
7. 404 ไม่พบ token + 403 ไม่มีสิทธิ์: ข้อความเซิร์ฟเวอร์ทั้งคู่
8. สถานะกล้อง: permission denied (`MobileScannerErrorCode.permissionDenied`) /
   ไม่รองรับ (`unsupported`) + ปุ่ม "ลองอีกครั้ง" (`scan-cam-retry`)
9. ทางสำรอง R5 "กรอก Token เอง": ว่างถูกบล็อก (validator) ไม่ส่ง POST · พิมพ์แล้วยืนยัน → ส่ง POST
   สำเร็จ

**Manifest → Scan/End (6)**
10. ปุ่มสแกน/ปิดรอบ แสดงตาม `QR.SCAN`/`TRIP.END` + `tripStatus=running` (รอบเสร็จแล้วไม่แสดง)
11. ไม่มี QR.SCAN → ไม่มีปุ่มสแกน · ไม่มี TRIP.END → ไม่มีปุ่มปิดรอบ
12. รอบเสร็จแล้ว (`tripStatus=completed`): ไม่มีปุ่มสแกน/ปิดรอบ
13. แตะปุ่มสแกนใน Manifest → เปิด `ScanQrScreen` → ยิงผ่านกล้องจำลอง (`fakeScannerBuilder`)
14. ปิดรอบ: dialog ยืนยัน BR-10 · "ยกเลิก" ไม่ส่ง POST
15. ปิดรอบสำเร็จ: POST /driver/trips/99/end → 204 → `pushReplacement` เปิดหน้าสรุป D4
16. ปิดรอบ 409 (BR-10 ยังปิดไม่ได้): ข้อความใน dialog (`drv-end-error`) · dialog ค้าง (ไม่ auto-dismiss)

**T-051 Summary D4 (3)**
17. KPI + รายชื่อ No Show + ยกเลิก: นับจากสถานะหลังปิดรอบ
    (`completed`/`no_show`/`cancelled`/`checked_in`) + `drv-sum-noshow-{bookingCode}`
18. ไม่มี No Show → `drv-sum-noshow-empty` "ไม่มีผู้โดยสาร No Show" (ทางเลือก 5a)
19. สรุป 404: ข้อความ + ปุ่ม "ลองอีกครั้ง" (`list-error-message`) → GET ซ้ำแล้วได้ข้อมูล

**D1 completed card (1)**
20. การ์ด "เสร็จแล้ว" แตะ → เปิดหน้าสรุปเมื่อทราบรอบจากเครื่องนี้ (`startedTripsProvider`) ·
    ไม่ทราบรอบ → ข้อความข้อจำกัด `drv-conflict-gap` (tripId gap)

## 6. Blocked acceptance criteria (ยังพิสูจน์ไม่ได้ — ห้ามถือว่าผ่าน)

- **alight KPI (T-051)**: `alightedCount` นับจาก `status == 'completed'` แต่ OpenAPI ไม่ระบุ
  ว่าเซิร์ฟเวอร์ set `completed` ตอนผู้โดยสารลงรถจริงหรือตอน end trip — ถ้าเซิร์ฟเวอร์
  set `completed` ตอน end trip ทุกคนที่ check-in จะนับ as alighted ทันที (ต้อง integration test
  กับ backend จริงเพื่อยืนยัน semantic)
- **tripId gap (T-048/T-049/T-051)**: `DriverTripBrief` ไม่มี `tripId` →
  "เปิดหน้าสรุปซ้ำ/ปิดรอบเก่าได้ทุกเครื่อง" ทำได้เฉพาะรอบที่เริ่มจากเครื่องนี้ในรอบใช้งานนี้ —
  ต้องแก้สัญญา OpenAPI (เพิ่ม tripId ใน DriverTripBrief หรือ endpoint ค้น trip ที่ running)
- **การทดสอบกล้องบนเครื่อง Android จริง**: ยังไม่ได้ทำ — งานแยกต่างหากตามคำสั่ง
  ("actual camera test is separate") · เทสต์ sprint11 ใช้ mock scanner platform ทั้งหมด
- **ข้อจำกัดเดิมที่ยังค้าง** (ไม่ถามซ้ำ): Q6 (cutoff ยกเลิก), Q7 (QR ใช้ซ้ำ/หมดอายุ),
  Q-C/Q19, mapping tab checked_in/no_show, Q-A/Q-B/Q-F/Q14/Q20/Q22/Q23/Q24, CONTRACT-DRIFT-01
- **ยังไม่มี**: human review, การรันกับ backend จริง/ฐานข้อมูลจริง, การยืนยัน DoD กับผู้สอน —
  เทสต์ทั้งหมดรันบน FakeBackend ที่จำลองตาม OpenAPI เท่านั้น
- Backend ต้องทำ `POST /driver/bookings/scan` (BR-09: 409 ซ้ำ/ผิดรอบ, 404, 403) และ
  `POST /driver/trips/{tripId}/end` (BR-10: reserved → no_show, 409 ยังปิดไม่ได้)
  (T-029/T-039/T-053/T-055 ของสาย backend) ก่อนจะ integration test ได้จริง

## 7. หมายเหตุให้ reviewer

- จุดที่ควรตรวจ: `scan_qr_screen.dart` `_onCameraToken`/`_submitToken` (debounce + กันซ้ำ),
  `_ManualEntryDialog` (controller lifecycle), `manifest_screen.dart` `_confirmEnd`
  (flow end → pushReplacement summary), `trip_summary_screen.dart` KPI counting logic
- เทสต์ scan/summary แบบ direct-mount (`pumpScan`/`pumpHost`) ใช้ container/backend ชุดเดียวกับแอป
  แต่ไม่ผ่าน shell — `ScanQrScreen` ไม่ดู permission จาก auth (server enforce 403),
  `ManifestScreen` ดู `can('QR.SCAN')`/`can('TRIP.END')` ผ่าน `_StubAuthController`
- `_StubAuthController extends AuthController` override `build()` คืน state สำเร็จรูป —
  กัน race กับ `Future.microtask(restoreSession)` ใน `AuthController.build()` ที่ยิง GET /auth/me
  ระหว่าง pump (ทำให้ framework assertion "Tried to build dirty widget in the wrong build scope")
- หลังจากนี้: stop ตามคำสั่ง — coordinator เป็นผู้ review และส่งมอบต่อ
