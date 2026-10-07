# Sprint 3 Handoff — sukhsorn (T-013 + T-010)

**Author**: opencode agent (sukhsorn workspace) · **Date**: 2026-10-07  
**Branch**: `feature/sprint3-sukhsorn-autonomous` (base: `feature/sprint-3-backend-skeleton` @ `f452be7`)  
**Scope**: T-013 Flutter setup + T-010 DFD/Sequence + Codex review fixes — **ไม่แตะ backend/ database seeds**  
**Status**: ยังไม่ได้ commit/push — coordinator เป็นผู้เลือกไฟล์เอง

---

## 1. T-013 — Flutter Adaptive Shell ✅ (ไฟล์เสร็จ + ตรวจแล้ว)

| องค์ประกอบ | ไฟล์ | สถานะ |
|---|---|---|
| Entry point | `app/lib/main.dart` | ✅ ProviderScope + MaterialApp.router |
| Routing (GoRouter) | `app/lib/core/router/app_router.dart` | ✅ StatefulShellRoute 6 branches + `/login` + errorBuilder |
| Theme (Material 3) | `app/lib/core/theme/app_theme.dart` | ✅ light/dark จาก seed color |
| dio + interceptor | `app/lib/core/network/api_client.dart` | ✅ แนบ Bearer token, ล้าง token เมื่อ 401 |
| Secure storage | `app/lib/core/storage/token_storage.dart` | ✅ flutter_secure_storage (JWT เท่านั้น) |
| Providers | `app/lib/core/providers.dart` | ✅ `flutter_riverpod` (แก้จาก `riverpod` ตาม reviewer) |
| Adaptive shell | `app/lib/layout/adaptive_shell.dart` | ✅ `<600dp` → NavigationBar · `≥600` → NavigationRail · `≥1024` → extended |
| Pages | `features/{dashboard,auth,master,front,booking,driver,report}/*_page.dart` | ✅ Login จริง (POST /api/auth/login) + placeholder ตาม Sprint ถัดไป |
| Android platform | `app/android/` (สร้างด้วย `flutter create --platforms=android`) | ✅ |
| Material icons | `app/pubspec.yaml` → `flutter: uses-material-design: true` | ✅ (แก้ตาม Codex: ก่อนหน้าไอคอนแสดงเป็นกล่อง missing-glyph) |
| Widget tests | `app/test/widget_test.dart` (3) + `adaptive_shell_test.dart` (6) | ✅ 9 tests |

**Dependencies ที่แก้ใน `pubspec.yaml`**: `riverpod`→`flutter_riverpod` · ตัด `riverpod_annotation`, `riverpod_generator`, `go_router_builder`, `build_runner`, `flutter_svg` (ไม่ได้ใช้) · เก็บ `dio`, `go_router`, `flutter_secure_storage`, `fl_chart`, `intl`

### Android integration fix (Codex review #1)

| ไฟล์ | เนื้อหา |
|---|---|
| `app/android/app/src/main/AndroidManifest.xml` | `+ uses-permission INTERNET` (ทุก build type) — ไม่ใส่ cleartext ใด ๆ |
| `app/android/app/src/debug/AndroidManifest.xml` + `src/profile/...` | `+ android:networkSecurityConfig` (dev-only) |
| `app/android/app/src/{debug,profile}/res/xml/network_security_config.xml` | cleartext เฉพาะ `10.0.2.2` / `127.0.0.1` / `localhost` · base = deny |
| `app/.gitignore` | negation `!android/app/src/debug/**` + `!android/app/src/main/res/mipmap-*/ic_launcher.png` — แก้ root rules `debug/` และ `*.png` ที่ไปบัง source/launcher icon (root .gitignore ไม่แตะ) |

## 2. T-010 — ไดอะแกรม 9 ไฟล์ ✅

| Checklist | ไฟล์ |
|---|---|
| A2 Context | `docs/diagrams/dfd/dfd-00-context.puml` |
| A3 DFD Lv0 | `docs/diagrams/dfd/dfd-01-level0.puml` (6 processes · 4 data stores = ตารางจริง 20 ตาราง) |
| A3 DFD Lv1 | `docs/diagrams/dfd/dfd-02-level1.puml` (แตก P1/P4/P5) |
| A6 State | `docs/diagrams/dfd/booking-state.puml` (5 status ตาม `ck_booking_status`) |
| A5 Sequence 5 เรื่อง | `docs/diagrams/sequence/sequence-01-login / -02-booking / -03-cancel / -04-scan-qr / -05-complete-trip.puml` |

ข้อมูลทั้งหมดอ้างจาก `01_schema.sql` + `usecase-spec.md` + `openapi.yaml` ตรง ๆ (ไม่สมมติเอง · AR-08)

**Context fix (Codex review #2)** — `dfd-00-context.puml`: ลบ `database "Oracle ..."` + flow `SYS <--> DB` ออก (data store ภายในไม่ใช่ external entity), ย้ายคำอธิบาย D1..D4/20 ตาราง ไป note ในระบบ, เพิ่ม `Login` ใน flow ของ Staff, พร้อม **balance-check note ตรึงกับ Lv0**: Cust↔SYS = Cust↔P4 · Staff↔SYS = Staff↔P1+P2+P3+P6 · Driver↔SYS = Driver↔P5 · SYS↔DB แทนด้วย D1..D4 ภายในที่ Lv0

**UC label crosscheck (Codex review #3)** — against actual `usecase-spec.md`: Scan = **UC-25** (L445) · Complete Trip = **UC-26** (L463) · `openapi.yaml` `x-uc` = UC-25/UC-26 ตรงกัน → **sequence files ถูกต้องแล้ว ไม่แก้** (แผนเก่าที่เขียน D3=UC-26/D4=UC-27 ผิดจริง และพบค้างอยู่ใน `docs/kaengkarn-check-list.md` L84–86/L174–175 — เป็น checklist ของ peer จึงรายงานอย่างเดียว ไม่ไปแก้)

**Render evidence — ทั้ง 9 PNG สำเร็จ** (2026-10-07, `java -jar shuttle-kaengkarn/.agent-runtime/plantuml.jar -charset UTF-8 -SdefaultFontName=Tahoma -tpng`, exit=0):

| PNG (bytes) | PNG (bytes) |
|---|---|
| `dfd/dfd-00-context.png` (39,623) | `sequence/sequence-01-login.png` (48,096) |
| `dfd/dfd-01-level0.png` (64,441) | `sequence/sequence-02-booking.png` (63,203) |
| `dfd/dfd-02-level1.png` (186,424) | `sequence/sequence-03-cancel.png` (47,607) |
| `dfd/booking-state.png` (31,401) | `sequence/sequence-04-scan-qr.png` (51,098) |
|  | `sequence/sequence-05-complete-trip.png` (46,534) |

ตรวจภาพแล้ว: อักษรไทยไม่เป็นกล่อง (Tahoma) · context ไม่มี DB ภายนอกขอบเขต · sequence-04 แสดง UC-25/BR-09/ASM-07-3 ถูกต้อง · แก้ `@startuml` id ของ sequence-03 ให้ตรงชื่อไฟล์

## 3. Verification (ผลจริง 2026-10-07)

```
$ flutter analyze
No issues found! (ran in 11.2s)

$ flutter test --reporter compact
00:05 +9: All tests passed!          ← 9/9 (6 adaptive shell + 3 app smoke/nav)

$ flutter build apk --debug
Running Gradle task 'assembleDebug'... 57.4s
√ Built build\app\outputs\flutter-apk\app-debug.apk

$ flutter build apk --release
Running Gradle task 'assembleRelease'... 153.8s
√ Built build\app\outputs\flutter-apk\app-release.apk (49.4MB)
  Font asset "MaterialIcons-Regular.otf" was tree-shaken ... (1645184 → 3420 bytes)
  ← ฟอนต์ถูก bundle + tree-shake = uses-material-design ทำงานแล้ว
```

**Manifest checks (packaged, ออกจาก APK จริง)**

```
debug  packaged_manifest : INTERNET ✓ · android:networkSecurityConfig ✓
debug  apk zip           : res/xml/network_security_config.xml มี ✓
release packaged_manifest: INTERNET ✓ · ไม่มี networkSecurityConfig / usesCleartextTraffic ✓
release apk zip          : ไม่มี network_security_config.xml ✓  (release คงสถานะ secure)
git check-ignore         : debug manifest + config + ic_launcher.png → ?? untracked ✓
```

**Emulator (visual)**

```
$ adb install -r app-debug.apk → Success
$ adb shell am start -n com.example.shuttle_app/.MainActivity
$ adb shell pidof com.example.shuttle_app          → 9071
$ dumpsys activity → topResumedActivity = com.example.shuttle_app/.MainActivity
screenshot (2026-10-07): หน้า "ระบบรถรับส่ง" + Material icons (NavigationBar 6 ไอคอน,
ไอคอนการ์ด ข้อมูลหลัก/เส้นทาง/จองรถ, chevron) แสดงถูกต้อง ไม่มีกล่อง missing-glyph
```

- **Static analysis** = แยกจาก **emulator run** ตามที่กำหนด ทั้งสองผ่านจริง

## 4. Blockers / Open Questions

| # | เรื่อง | ต้องการ |
|---|---|---|
| 1 | Q22/Q23/Q24 (endpoint UC-10/14.2/08) | ยังรออาจารย์ — ไม่กระทบงานรอบนี้ |
| 2 | Backend base URL | ค่า default `http://10.0.2.2:3000` (emulator→host, cleartext อนุญาตเฉพาะ debug/profile) เปลี่ยนด้วย `--dart-define=API_BASE_URL=...` เมื่อ backend (T-011/T-012) เสร็จ |
| 3 | Auth guard | ยังไม่มี redirect → `/login` (ตั้งใจ — T-015/T-017 Sprint 4 จะเพิ่มเมื่อมี JWT จริง) |

## 5. งานที่เหลือ (นอก scope รอบนี้)

- **AR-02 peer review**: ส่งให้เก่งกาญ review (ผู้เขียนรีวิวงานตัวเองไม่ได้)
- **Peer doc discrepancy (รายงานอย่างเดียว ไม่แก้)**: `docs/kaengkarn-check-list.md` ยัง label D3=UC-26 / D4=UC-27 (ผิดจาก usecase-spec.md)
- หน้าจอจริงตาม Sprint 4–13 (T-017, T-018, T-023, …) — placeholder รอแทนที่
- Dynamic Menu กรองด้วย `permissions` จริง (T-023) — ตอนนี้เมนู 6 รายการ fix ไว้ก่อน
- ยังไม่ได้ commit/push — coordinator เลือกไฟล์เอง (งานอื่น ๆ ที่ค้างอยู่ใน worktree ห้ามแตะ)

## 6. ไฟล์ที่แก้/สร้าง (รายการสั้น)

```
app/pubspec.yaml                          (แก้ deps + uses-material-design: true)
app/lib/main.dart, core/*, layout/*, features/*   (สร้าง 14 ไฟล์)
app/test/widget_test.dart, adaptive_shell_test.dart (แทน counter test เดิม)
app/.gitignore                            (negation: src/debug/** + mipmap ic_launcher.png)
app/android/                              (flutter create + main/debug/profile manifest
                                           + {debug,profile}/res/xml/network_security_config.xml)
app/analysis_options.yaml, app/README.md
docs/diagrams/dfd/{dfd-00-context,dfd-01-level0,dfd-02-level1,booking-state}.puml + README.md
docs/diagrams/dfd/*.png                   (4 PNGs — render 2026-10-07)
docs/diagrams/sequence/sequence-01..05*.puml + README.md
docs/diagrams/sequence/*.png              (5 PNGs — render 2026-10-07)
docs/agent-handoffs/sprint3-sukhsorn.md    (ไฟล์นี้)
docs/agile/ai-credit-log.md                (เพิ่ม entry AR-04)
docs/agile/sukhsorn-check-list.md          (อัปเดต A2/A3/A5/A6 + Sprint 3 rows)
```
