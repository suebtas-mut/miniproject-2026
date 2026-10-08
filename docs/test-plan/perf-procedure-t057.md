# Performance Procedure — T-057 (Index Tuning + EXPLAIN PLAN + วัดผลรายงาน)

| งาน | T-057 · Sprint 13 · `@agent-data` |
|---|---|
| เป้าหมาย (DoD chapter-18) | รายงานทุก Query **< 3 วินาที** ที่ข้อมูล **≥ 50,000 แถว** |
| ร่วมกับ | `database/06_perf_indexes.sql` (index + EXPLAIN + คำสั่งวัด) |
| สถานะ | ⬜ **ยังไม่ได้รัน** — เครื่องพัฒนาไม่มี Oracle instance · ไม่มีผลวัดจริงในเอกสารใด ๆ |
| ทำซ้ำได้ | ✅ ขั้นตอนทั้งหมดด้านล่างทำซ้ำได้ 100% บน schema isolate ใหม่ |

> ⚠️ **อย่าเติมตัวเลขใน §5 โดยไม่ได้วัดจริง** — ตารางผลลัพธ์ต้องมาจากรัน `06_perf_indexes.sql` เท่านั้น
> (กันไม่ให้เอกสารอ้างผลที่ไม่มีหลักฐาน · ดู T-062 disclosure ใน handoff)

---

## 1. เงื่อนไขเริ่มต้น (Prerequisites)

1. Oracle instance (19c/21c — ตาม Q14 ที่ยังไม่ได้คำตอบ ใช้ตัวที่มีในเครื่องทดสอบ) + user/schema isolate
2. รันสคริปต์ในฐานเปล่าตามลำดับ:
   ```
   01_schema.sql → 02_seed_master.sql → 03_seed_front.sql
   → 04_seed_report_bulk.sql (T-052: booking ≥ 50,000 · trip_passenger ≥ 30,000)
   → 05_views_report.sql
   ```
3. SQL*Plus หรือ SQLcl (ตัวที่รัน 01–05 ได้) — คำสั่งในเอกสารเป็น syntax ของทั้งคู่
4. Backend รันได้ (ต่อฐานเดียวกัน) สำหรับ §4 ขั้นที่วัดผ่าน API

## 2. รัน Index Tuning (`database/06_perf_indexes.sql`)

```sql
@database/06_perf_indexes.sql
```

สิ่งที่ต้องเห็นในผลลัพธ์ (PART A):

- `created: ix_sched_service_date` (ครั้งแรก) หรือ `exists … skip` (รันซ้ำ)
- `created: ix_token_blacklist_emp_exp` (ครั้งแรก) หรือ `exists … skip`
- ตาราง user_indexes มี index ของ `SCHEDULE` / `TOKEN_BLACKLIST` ครบ

**หมายเหตุ:** idempotent — รันซ้ำได้ ไม่มี DROP/DELETE/TRUNCATE ใด ๆ (non-destructive ตามกฎ DB)

## 3. เก็บ EXPLAIN PLAN (PART B)

ในไฟล์เดียวกันหลัง PART A มี `EXPLAIN PLAN SET STATEMENT_ID = 'T057_R1/R4/R6'`
ของ SQL ทั้งสามตัว (คัดลอกจริงจาก `report.repository.js`) พร้อม `DBMS_XPLAN.DISPLAY`

บันทึกลง §5 ต่อ query:

| ดูอะไรใน plan | คำถามที่ต้องตอบ |
|---|---|
| Access ของ `schedule` | มี `INDEX RANGE SCAN` บน `ix_sched_service_date` ไหม (R4/R6) |
| Access ของ `booking` | ใช้ `ix_booking_sched_status` ไหม (join จาก view 1) |
| Views | Oracle push `service_date BETWEEN` เข้า view ได้ไหม (Predicate Pushing) |
| Cost / Rows | ลดลงเท่าไหร่เมื่อเทียบก่อน/หลัง PART A (ลบ index ใหม่ชั่วคราวแล้ว explain ซ้ำถ้าต้องการเปรียบเทียบ) |

> เทคนิคเปรียบเทียบก่อน/หลัง: `DROP INDEX ix_sched_service_date;` → explain → `@06_perf_indexes.sql` (สร้างใหม่) → explain → เทียบ
> — ทำใน schema ทดสอบเท่านั้น และรันจบต้องสร้าง index คืนเสมอ

## 4. วัดผลจริง (PART C)

### 4.1 ระดับ SQL (Oracle time ล้วน)

รัน PART C ของ `06_perf_indexes.sql` (`SET TIMING ON`):

- `SELECT COUNT(*) FROM booking` → ต้อง **≥ 50,000** (มิฉะนั้นยังวัดตามเกณฑ์ไม่ได้ — เติมด้วย `04_seed_report_bulk.sql`)
- Timing ของ query R1 / R4 / R6 → จดตัวเลขจาก `Elapsed:`

### 4.2 ระดับ API (รวม network + JSON serialization — เกณฑ์จริงของผู้ใช้)

```bash
# 1) login
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<admin>","password":"<password>"}' \
  | jq -r .data.access_token)

# 2) วัดด้วย curl -w (เวลาทั้งหมดหน่วยวินาที)
curl -s -o /dev/null -w "R1: %{time_total}s\n" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/report/boarding-alighting-week?year=2568"

curl -s -o /dev/null -w "R4: %{time_total}s\n" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/report/daily-by-route?from=2025-01-01&to=2025-12-31"

curl -s -o /dev/null -w "R6: %{time_total}s\n" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/report/driver-workload?from=2025-01-01&to=2025-12-31"
```

วัดอย่างน้อย 3 รอบต่อ endpoint แล้วใช้ค่ากลาง (กัน noise)

## 5. ตารางบันทึกผล (กรอกจากรันจริงเท่านั้น)

| Query | แถวจริง (`booking`) | EXPLAIN ก่อน index (Cost) | EXPLAIN หลัง index (Cost) | SQL time (s) | API time (s) | < 3 วิ? |
|---|---|---|---|---|---|---|
| R1 boarding-alighting-week | _ยังไม่ได้วัด_ | _ยังไม่ได้วัด_ | _ยังไม่ได้วัด_ | _ยังไม่ได้วัด_ | _ยังไม่ได้วัด_ | ⬜ |
| R4 daily-by-route | _ยังไม่ได้วัด_ | _ยังไม่ได้วัด_ | _ยังไม่ได้วัด_ | _ยังไม่ได้วัด_ | _ยังไม่ได้วัด_ | ⬜ |
| R6 driver-workload | _ยังไม่ได้วัด_ | _ยังไม่ได้วัด_ | _ยังไม่ได้วัด_ | _ยังไม่ได้วัด_ | _ยังไม่ได้วัด_ | ⬜ |

ผลลัพธ์สุดท้าย (กรอกเมื่อครบทุกแถว): ⬜ **ผ่าน / ไม่ผ่าน** ตามเกณฑ์ < 3 วินาที

## 6. Candidate indexes และเหตุผล (สรุปจาก PART A)

| Index | ตาราง (คอลัมน์) | query ที่รองรับ | สถานะปัจจุบันของ index อื่น |
|---|---|---|---|
| `ix_sched_service_date` | `schedule (service_date)` | `findAvailable` (equality) · R4/R6 range ผ่าน pushdown · `getMySchedule` | `ix_sched_route_date (route_id, service_date)` ใช้ไม่ได้เมื่อไม่กรอง route_id |
| `ix_token_blacklist_emp_exp` | `token_blacklist (emp_id, expires_at)` | `deleteExpiredBlacklist` (ทุกครั้งที่ login) | มีแค่ PK `jti` |

index เดิม 8 ตัวใน `01_schema.sql` (ตรวจแล้วครอบคลุม): `uq_booking_qr` (QR lookup) ·
`ix_booking_sched_status` · `ix_booking_book_time` · `ix_booking_cust` (`/booking/me`) ·
`ix_sched_route_date` · `ix_tp_trip` / `ix_tp_booking` · `ix_da_emp` · `ix_va_veh`
ข้อจำกัดที่ index ช่วยไม่ได้: `LIKE '%q%'` (ค้นชื่อกลาง — ต้อง full scan, ปริมาณข้อมูล master เล็กพอ)

## 7. ข้อจำกัด/สิ่งที่ยังค้าง

- ⬜ ยังไม่มีผลรันจริงทุกช่องใน §5 (ไม่มี Oracle ในเครื่องพัฒนา)
- ⬜ `EXPLAIN PLAN` ของ SQL ที่มี bind ใช้ bind เป็น placeholder — แผนจริงอาจเปลี่ยนเล็กน้อยตอน cursor peeking ด้วยค่าจริง (ยืนยันด้วย `V$SQL` หรือ SQL trace ถ้าต้องการความแม่นยำสูง)
- ⬜ Scalability เกณฑ์เสริม (chapter-17: เพิ่มเป็น 100,000 booking แล้วยัง < 3 วิ) — ยังไม่ได้ทดสอบ
- ⬜ ผลลัพธ์ต้องประชาสัมพันธ์ใน Stand-up/Retro Sprint 13 (AR-06) เมื่อได้วัดจริง
