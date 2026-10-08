-- ==================================================================
--  05_views_report.sql  —  Oracle VIEW ช่วย Aggregate สำหรับรายงาน R1 / R4 / R6
--  ระบบรับส่งรถรับส่ง (Shuttle Bus System) สำนักงานเขตหนองจอก
-- ------------------------------------------------------------------
--  Task      : T-053 (Sprint 11) — backend/SQL stream รับช่วงต่อ (ตาม
--              docs/agent-handoffs/sprints04-13-execution.md: operational
--              ownership รวมงาน SQL ทั้งหมดไว้ที่สายนี้)
--              เดิมแผนมนุษย์กำหนดให้ สุขสรร / @agent-data — ไม่ได้แต่งสิทธิ์
--              อธิบาย/ตรวจของมนุษย์แต่อย่างใด
--              Sprint 12 (T-054/T-055/T-056) แก้ view 1 (+route_id) และ
--              view 2 (metric customer_count ตามนิยาม openapi R4) — ไฟล์นี้
--              ยังเป็นไฟล์ใหม่ที่ยังไม่ commit / ยังไม่เคยรันที่ไหน
--  รายงาน    : R1 (UC-27) · R4 (UC-28) · R6 (UC-29) — ทั้งสามเป็น VIEW ล้วน
--              อ่านอย่างเดียว ไม่แก้ข้อมูล (UC-30: Postcondition = ไม่มีการ
--              เปลี่ยนแปลงข้อมูล)
--
--  ⛔ ข้อบังคับ
--    · CREATE OR REPLACE VIEW เท่านั้น — ไม่มี DROP / TRUNCATE / DELETE
--    · ห้ามรันบนฐานข้อมูลร่วมกันโดยไม่ผ่านการทบทวนของ coordinator
--    · รันได้บนฐาน isolate หลังรัน 01 → 02 → 03 → 04 เท่านั้น
--      (ข้อมูลปี 2568 มาจาก 04_seed_report_bulk.sql)
--
--  วิธีรัน (ฐานข้อมูล isolate เท่านั้น — ยังไม่ได้รันที่ไหนเลย ณ วันที่เขียนไฟล์)
--    sqlplus shuttle_app/<รหัสผ่าน>@localhost:1521/XEPDB1 @05_views_report.sql
-- ==================================================================

PROMPT
PROMPT === T-053 : สร้าง VIEW รายงาน R1 / R4 / R6 ===

-- ==================================================================
--  VIEW 1 — R1 (UC-27): จำนวนคนขึ้น/ลง รายสัปดาห์ (ปี พ.ศ. 2568 = ค.ศ. 2025)
--  เทคนิคที่บังคับ (usecase-spec.md UC-27):
--    · TRUNC(service_date, 'IW') + TO_CHAR(..., 'IW')  → สัปดาห์แบบ ISO
--    · CASE WHEN ... IS NOT NULL
--    · EXISTS
--    ⛔ ห้าม COUNT(DISTINCT alight_time) — ต้องนับ "คน" (booking_id) ไม่ใช่ "เวลา"
--       ผู้โดยสาร 3 คนลงพร้อมกัน 17:30 ต้องได้ 3 ไม่ใช่ 1
--  แถวผลลัพธ์ (granularity = สัปดาห์ × เส้นทาง): week_start | week_no |
--    route_id | คนขึ้น | คนลง | ไม่ขึ้นรถ
--    → T-054 (Sprint 12) แกนของ API คือ "รายสัปดาห์" จึง SUM() แถวทุกเส้นทาง
--      ของแต่ละ week_start กลับ (นับ "คน" ไม่ใช่ "รอบ" — ผู้โดยสาร 1 คน
--      เดินทางหลายวันในสัปดาห์เดียวกันถูกนับคนเดียวตาม COUNT DISTINCT เดิม
--      ของ view ก่อนรวม)
--  ตัวกรองปี + ตัวกรอง route_id (optional) ทำที่ API (T-054):
--    WHERE week_start BETWEEN จันทร์แรกของปี และ จันทร์สุดท้ายของปี
-- ==================================================================
CREATE OR REPLACE VIEW v_report_boarding_alighting_week AS
SELECT TRUNC(s.service_date, 'IW') AS week_start,
       TO_CHAR(s.service_date, 'IW') AS week_no,
       s.route_id,                                        -- T-054: ตัวกรองเส้นทาง (PIVOT-free)
       COUNT(DISTINCT CASE WHEN tp.checkin_time IS NOT NULL
                           THEN tp.booking_id END) AS boarded,
       COUNT(DISTINCT CASE WHEN tp.alight_time IS NOT NULL
                           THEN tp.booking_id END) AS alighted,
       COUNT(DISTINCT CASE WHEN b.status = 'no_show'
                           THEN b.booking_id END)  AS no_show_count
FROM   schedule s
       LEFT JOIN booking b         ON b.sched_id = s.sched_id
       LEFT JOIN trip t            ON t.sched_id = s.sched_id
       LEFT JOIN trip_passenger tp ON tp.trip_id = t.trip_id
                                  AND tp.booking_id = b.booking_id
WHERE  EXISTS (SELECT 1 FROM trip te WHERE te.sched_id = s.sched_id)  -- มีรถวิ่งจริงในรอบนั้น
GROUP  BY TRUNC(s.service_date, 'IW'), TO_CHAR(s.service_date, 'IW'), s.route_id;


-- ==================================================================
--  VIEW 2 — R4 (UC-28): สรุปยอดผู้ใช้รายวัน × เส้นทาง + คอลัมน์รวมทั้งวัน
--  เทคนิคที่บังคับ (usecase-spec.md UC-28):
--    · SUM(...) OVER (PARTITION BY service_date)  → คอลัมน์ "รวมทั้งวัน"
--      (หรือ GROUPING SETS — เลือกใช้ analytic เพราะให้ day_total ต่อแถว)
--    · GROUP BY s.service_date = วันเต็ม → วันจันทร์หลายสัปดาห์ในช่วงที่เลือก
--      ถูกรวมเป็นแถวเดียวอัตโนมัติ (ตามกับดัก UC-28)
--    · ตัวอย่าง PIVOT (เทคนิคที่เอกสารกำหนด) สำหรับ T-055 มีในคอมเมนต์ท้ายบล็อกนี้
--  แถวผลลัพธ์: วันที่ | วัน | เส้นทาง | ชื่อเส้นทาง | ยอดจอง | ลูกค้า(ไม่ซ้ำ) | รวมทั้งวัน
--  ⚠ metric หลักของ R4 (openapi ReportDailyByRoute) = customer_count =
--    "นับจำนวนคนไม่ซ้ำ (cust_id) สถานะ reserved / checked_in / completed"
--    — ตรงตาม openapi.yaml ReportDailyByRoute + นิยามรายวัน (no_show ถูกคัดออก
--    เพราะไม่ใช่ "ผู้ใช้ที่ใช้บริการ" — BR-10 ปิดรอบแล้วไม่นับ · ตัดสินโดยสเปก
--    openapi มีอำนาจเหนือสมมติ Q-REPORT-4 เดิม) · booked_count (<> cancelled)
--    เก็บไว้เป็น metric สำรองสำหรับตรวจสอบ/รายงานอื่น
--  ตัวกรองช่วงวันที่ ทำที่ API (T-055): WHERE service_date BETWEEN :from AND :to
-- ==================================================================
CREATE OR REPLACE VIEW v_report_daily_by_route AS
SELECT s.service_date,
       TO_CHAR(s.service_date, 'Day')  AS day_name,
       r.route_id,
       r.route_name,
       COUNT(DISTINCT CASE WHEN b.status <> 'cancelled'
                           THEN b.booking_id END) AS booked_count,
       COUNT(DISTINCT CASE WHEN b.status IN ('reserved', 'checked_in', 'completed')
                           THEN b.cust_id END)    AS customer_count,
       SUM(COUNT(DISTINCT CASE WHEN b.status IN ('reserved', 'checked_in', 'completed')
                               THEN b.cust_id END))
         OVER (PARTITION BY s.service_date)       AS day_total
FROM   schedule s
       JOIN route r       ON r.route_id = s.route_id
       LEFT JOIN booking b ON b.sched_id = s.sched_id
GROUP  BY s.service_date,
          TO_CHAR(s.service_date, 'Day'),
          r.route_id,
          r.route_name;

--  ตัวอย่าง (ใช้โดย T-055) — PIVOT สร้างคอลัมน์ตามรหัสเส้นทางที่ใช้งานอยู่:
--  SELECT * FROM (
--    SELECT v.service_date AS d, v.route_id, v.customer_count
--      FROM v_report_daily_by_route v
--     WHERE v.service_date BETWEEN DATE '2025-09-01' AND DATE '2025-09-30')
--  PIVOT (SUM(customer_count) FOR route_id IN (SELECT route_id FROM route WHERE is_active = 1));
--  (จุดข้อมูล: seed มีเส้นทางให้บริการ 2 รหัส — รหัสใหม่ที่เปิดใช้ภายหลัง
--   ถูก pivot เป็นคอลัมน์อัตโนมัติเพราะ IN ใช้ subquery ไม่ hardcode)


-- ==================================================================
--  VIEW 3 — R6 (UC-29): สรุปการมอบหมายงานคนขับ (ก่อน/หลัง 17:00)
--  เทคนิคที่บังคับ (usecase-spec.md UC-29):
--    · CASE WHEN TO_CHAR(depart_at, 'HH24') < 17  → ก่อน 17:00
--    · หลัง 17:00 = depart_at ตั้งแต่ 17:00 เป็นต้นไป (รวม 17:00)
--    · ROLLUP (แถว "รวมทั้งหมด" — driver_name IS NULL) → ใช้ที่ query ของ T-056
--      เพราะ view ต้องรองรับตัวกรอง from/to แบบ parameterized ทุกช่วงวันที่
--  แถวผลลัพธ์ (ระดับต่ำสุด): คนขับ × วันที่ | รวมรอบ | ก่อน 17:00 | หลัง 17:00
--  ตัวกรองช่วงวันที่ + แถวรวม ทำที่ API (T-056) ดังตัวอย่างท้ายบล็อกนี้
-- ==================================================================
CREATE OR REPLACE VIEW v_report_driver_workload AS
SELECT da.emp_id,
       e.first_name || ' ' || e.last_name AS driver_name,
       s.service_date,
       COUNT(*)                                AS total_rounds,
       SUM(CASE WHEN TO_CHAR(s.depart_at, 'HH24') < '17'
                THEN 1 ELSE 0 END)             AS rounds_before_17,
       SUM(CASE WHEN TO_CHAR(s.depart_at, 'HH24') >= '17'
                THEN 1 ELSE 0 END)             AS rounds_after_17
FROM   driver_assign da
       JOIN schedule s ON s.sched_id = da.sched_id
       JOIN employee e ON e.emp_id   = da.emp_id
GROUP  BY da.emp_id,
          e.first_name || ' ' || e.last_name,
          s.service_date;

--  ตัวอย่าง (ใช้โดย T-056) — ROLLUP ให้แถว "รวมทั้งหมด" (driver_name IS NULL):
--  SELECT CASE WHEN GROUPING(driver_name) = 1 THEN 'รวมทั้งหมด'
--              ELSE driver_name END            AS driver_name,
--         SUM(total_rounds)                    AS total_rounds,
--         SUM(rounds_before_17)                AS rounds_before_17,
--         SUM(rounds_after_17)                 AS rounds_after_17
--    FROM v_report_driver_workload
--   WHERE service_date BETWEEN DATE '2025-01-01' AND DATE '2025-12-31'
--   GROUP BY ROLLUP(driver_name)
--   ORDER BY total_rounds DESC;


-- ==================================================================
--  VERIFICATION — ทุก query ต้องรันได้บนฐาน isolate หลัง 01→05 ครบ
--  (ดูตัวเลขจริงด้วยตา — ไฟล์นี้ยังไม่เคยถูกรันที่ไหน)
-- ==================================================================
PROMPT
PROMPT === R1 : แถว/สัปดาห์ + ยอดรวมคนขึ้น/ลง (ต้องมากกว่า 0) ===
SELECT COUNT(*) AS week_rows,
       SUM(boarded)    AS total_boarded,
       SUM(alighted)   AS total_alighted,
       SUM(no_show_count) AS total_no_show
FROM   v_report_boarding_alighting_week;

PROMPT
PROMPT === R4 : แถว (วันที่ × เส้นทาง) + ยอดรวม (ต้องมากกว่า 0) ===
SELECT COUNT(*) AS day_route_rows,
       COUNT(DISTINCT service_date) AS distinct_days,
       SUM(booked_count)    AS total_booked,
       SUM(customer_count)  AS total_customers
FROM   v_report_daily_by_route;

PROMPT
PROMPT === R6 : แถว (คนขับ × วัน) + ยอดรวมรอบ (ต้องมากกว่า 0) ===
SELECT COUNT(*) AS driver_day_rows,
       COUNT(DISTINCT emp_id) AS distinct_drivers,
       SUM(total_rounds)      AS total_rounds,
       SUM(rounds_before_17)  AS before_17,
       SUM(rounds_after_17)   AS after_17
FROM   v_report_driver_workload;

PROMPT
PROMPT === ตรวจสอบ R6: ก่อน 17:00 + หลัง 17:00 ต้องเท่ากับ รวมรอบ (0 = ผ่าน) ===
SELECT 'rounds_before+after <> total' AS check_name, COUNT(*) AS bad_rows
FROM   v_report_driver_workload
WHERE  rounds_before_17 + rounds_after_17 <> total_rounds;
