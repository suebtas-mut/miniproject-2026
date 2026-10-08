-- =====================================================================
--  database/06_perf_indexes.sql — T-057: Index Tuning + EXPLAIN PLAN + ขั้นตอนวัดผล
--  =====================================================================
--  ทำอะไร:
--    PART A — candidate indexes ใหม่ 2 ตัว (idempotent: มีแล้วข้าม รันซ้ำได้)
--    PART B — EXPLAIN PLAN ของ Query รายงาน R1 / R4 / R6
--             (SQL ถูกคัดลอกมาจาก backend/src/repositories/report.repository.js ทีละตัว)
--    PART C — คำสั่งวัดผลจริง (TIMING + ตรวจนับข้อมูล) สำหรับบันทึกลงเอกสาร
--
--  เป้าหมาย (จาก docs/chapter-18-development-plan.md T-057 DoD):
--    "ทุก Query < 3 วินาที ที่ข้อมูล 50,000 แถว"
--
--  ⚠️ สถานะไฟล์นี้ (สำคัญ — ห้ามอ้างเกินหลักฐาน):
--    · ยังไม่เคยถูกรันที่ไหน — เครื่องที่พัฒนาไม่มี Oracle instance
--    · ยังไม่มีผล EXPLAIN / เวลาวัดจริงในเอกสารใด ๆ — ห้ามเติมตัวเลขที่ไม่ได้วัด
--    · ขั้นตอนทั้งหมดทำซ้ำได้ ดูวิธีรันที่ docs/test-plan/perf-procedure-t057.md
--
--  รันบน schema isolate หลัง 01 → 05 ครบ + 04_seed_report_bulk.sql (T-052: booking ≥ 50,000)
--  (ไม่แตะข้อมูลที่มีอยู่ — คำสั่งทั้งหมดเป็น CREATE INDEX / EXPLAIN / SELECT ล้วน)
-- =====================================================================

SET VERIFY OFF
SET SERVEROUTPUT ON
SET TIMING OFF

PROMPT =====================================================================
PROMPT  PART A — candidate indexes (idempotent)
PROMPT =====================================================================

-- ---------------------------------------------------------------------
-- A1: ix_sched_service_date ON schedule (service_date)
-- เหตุผล:
--   · schedule.service_date ถูกค้นแบบ range/equality โดยทุก query หลัก:
--       - booking.findAvailable       WHERE s.service_date = TO_DATE(:serviceDate,...)
--       - R4/R6 (predicate pushdown จาก view ผ่าน WHERE service_date BETWEEN ...)
--       - getMySchedule (คนขับ)       WHERE s.service_date = TRUNC(SYSDATE)
--   · index ที่มีอยู่ ix_sched_route_date (route_id, service_date) ใช้ไม่ได้เมื่อไม่กรอง route_id
--     (leading column = route_id) — เป็นช่องว่างเดียวของตาราง schedule
-- ---------------------------------------------------------------------
DECLARE
  n NUMBER;
BEGIN
  SELECT COUNT(*) INTO n
    FROM user_indexes
   WHERE index_name = 'IX_SCHED_SERVICE_DATE';
  IF n = 0 THEN
    EXECUTE IMMEDIATE 'CREATE INDEX ix_sched_service_date ON schedule (service_date)';
    DBMS_OUTPUT.PUT_LINE('created: ix_sched_service_date');
  ELSE
    DBMS_OUTPUT.PUT_LINE('exists : ix_sched_service_date — skip');
  END IF;
END;
/

-- ---------------------------------------------------------------------
-- A2: ix_token_blacklist_emp_exp ON token_blacklist (emp_id, expires_at)
-- เหตุผล:
--   · auth.deleteExpiredBlacklist ทุกครั้งที่ login:
--       DELETE FROM token_blacklist WHERE emp_id = :empId AND expires_at < SYSTIMESTAMP
--   · ปัจจุบันหา row ได้เฉพาะ PK (jti) — predicate emp_id + range expires_at ไม่มี index รองรับ
--   · composite (equality บน emp_id + range บน expires_at) ตามหลักการเลือก index
-- ---------------------------------------------------------------------
DECLARE
  n NUMBER;
BEGIN
  SELECT COUNT(*) INTO n
    FROM user_indexes
   WHERE index_name = 'IX_TOKEN_BLACKLIST_EMP_EXP';
  IF n = 0 THEN
    EXECUTE IMMEDIATE 'CREATE INDEX ix_token_blacklist_emp_exp ON token_blacklist (emp_id, expires_at)';
    DBMS_OUTPUT.PUT_LINE('created: ix_token_blacklist_emp_exp');
  ELSE
    DBMS_OUTPUT.PUT_LINE('exists : ix_token_blacklist_emp_exp — skip');
  END IF;
END;
/

PROMPT
PROMPT --- ตรวจนับ index ทั้งหมดของ schema (ต้องเห็น 8 เดิม + 2 ใหม่ = 10 + PK/UK) ---
SELECT index_name,
       table_name,
       UNIQUENESS,
       num_rows
  FROM user_indexes
 WHERE table_name IN ('SCHEDULE', 'TOKEN_BLACKLIST', 'BOOKING', 'TRIP_PASSENGER',
                      'DRIVER_ASSIGN', 'VEHICLE_ASSIGN')
 ORDER BY table_name, index_name;


PROMPT =====================================================================
PROMPT  PART B — EXPLAIN PLAN: R1 / R4 / R6 (SQL จริงจาก report.repository.js)
PROMPT  วิธีอ่าน: ดู Operation แรกว่ามี INDEX RANGE SCAN บน ix_sched_service_date
PROMPT            (หรือ ix_sched_route_date เมื่อกรอง route_id) และCost/Rows เปลี่ยนอย่างไร
PROMPT =====================================================================

DELETE FROM plan_table;

-- ------------------------------ R1 (T-054 / UC-27) ------------------------------
PROMPT
PROMPT === EXPLAIN R1: GET /report/boarding-alighting-week (weeklyBoarding) ===
EXPLAIN PLAN SET STATEMENT_ID = 'T057_R1' FOR
    SELECT v.week_start, v.week_no,
           SUM(v.boarded)       AS boarded,
           SUM(v.alighted)      AS alighted,
           SUM(v.no_show_count) AS no_show_count
      FROM v_report_boarding_alighting_week v
     WHERE v.week_start BETWEEN TO_DATE(:fromWeek, 'YYYY-MM-DD')
                            AND TO_DATE(:toWeek, 'YYYY-MM-DD')
       AND (:routeId IS NULL OR v.route_id = :routeId)
     GROUP BY v.week_start, v.week_no
     ORDER BY v.week_start;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, 'T057_R1', 'BASIC +ROWS +BYTES +COST'));

-- ------------------------------ R4 (T-055 / UC-28) ------------------------------
PROMPT
PROMPT === EXPLAIN R4: GET /report/daily-by-route (dailyByRoute — calendar spine + PIVOT) ===
EXPLAIN PLAN SET STATEMENT_ID = 'T057_R4' FOR
    WITH cal AS (
      SELECT TO_DATE(:fromDate, 'YYYY-MM-DD') + LEVEL - 1 AS service_date
        FROM dual
       CONNECT BY LEVEL <= TO_DATE(:toDate, 'YYYY-MM-DD') - TO_DATE(:fromDate, 'YYYY-MM-DD') + 1
    ),
    piv AS (
      SELECT *
        FROM (SELECT v.service_date AS d, v.route_id, v.customer_count
                FROM v_report_daily_by_route v
               WHERE v.service_date BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD')
                                        AND TO_DATE(:toDate, 'YYYY-MM-DD')
                 AND (:routeId IS NULL OR v.route_id = :routeId))
       PIVOT (SUM(customer_count)
              FOR route_id IN (SELECT route_id FROM route WHERE is_active = 1))
    )
    SELECT cal.service_date, p.*
      FROM cal
      LEFT JOIN piv p ON p.d = cal.service_date
     ORDER BY cal.service_date;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, 'T057_R4', 'BASIC +ROWS +BYTES +COST'));

-- ------------------------------ R6 (T-056 / UC-29) ------------------------------
PROMPT
PROMPT === EXPLAIN R6: GET /report/driver-workload (driverWorkload — analytic + ROLLUP) ===
EXPLAIN PLAN SET STATEMENT_ID = 'T057_R6' FOR
    WITH drv AS (
      SELECT DISTINCT e.emp_id, e.first_name || ' ' || e.last_name AS driver_name
        FROM driver_assign da
        JOIN employee e ON e.emp_id = da.emp_id
    )
    SELECT x.driver_id, x.driver_name, x.total_trips, x.before_17, x.after_17, x.rank_no
      FROM (SELECT d.emp_id AS driver_id,
                   d.driver_name,
                   SUM(NVL(v.total_rounds, 0))     AS total_trips,
                   SUM(NVL(v.rounds_before_17, 0)) AS before_17,
                   SUM(NVL(v.rounds_after_17, 0))  AS after_17,
                   RANK() OVER (ORDER BY SUM(NVL(v.total_rounds, 0)) DESC) AS rank_no
              FROM drv d
              LEFT JOIN v_report_driver_workload v
                     ON v.emp_id = d.emp_id
                    AND v.service_date BETWEEN TO_DATE(:fromDate, 'YYYY-MM-DD')
                                           AND TO_DATE(:toDate, 'YYYY-MM-DD')
             GROUP BY ROLLUP(d.emp_id, d.driver_name)
            HAVING GROUPING(d.emp_id) = GROUPING(d.driver_name)
           ) x
     ORDER BY (CASE WHEN x.driver_id IS NULL THEN 1 ELSE 0 END), x.rank_no, x.driver_id;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, 'T057_R6', 'BASIC +ROWS +BYTES +COST'));


PROMPT =====================================================================
PROMPT  PART C — วัดผลจริง (บันทึกลง docs/test-plan/perf-procedure-t057.md เท่านั้น)
PROMPT =====================================================================

-- C1) ตรวจเงื่อนไขข้อมูลก่อนวัด — ต้อง >= 50,000 (T-052 / Q10)
SET TIMING ON
SELECT COUNT(*) AS booking_rows FROM booking;
SELECT COUNT(*) AS trip_passenger_rows FROM trip_passenger;

-- C2) วัดเวลา SELECT ตรง (ผลลัพธ์ = "Oracle time" — ยังไม่รวม network/Jackson)
--     ใช้ query เดียวกับ PART B (ใส่ค่า bind จริงแทน :bind)
PROMPT === วัด R1 (year 2568 → 2024-12-30 .. 2025-12-29) ===
SELECT v.week_start, v.week_no,
       SUM(v.boarded) AS boarded, SUM(v.alighted) AS alighted,
       SUM(v.no_show_count) AS no_show_count
  FROM v_report_boarding_alighting_week v
 WHERE v.week_start BETWEEN DATE '2024-12-30' AND DATE '2025-12-29'
 GROUP BY v.week_start, v.week_no
 ORDER BY v.week_start;

PROMPT === วัด R4 (2025-01-01 .. 2025-12-31) ===
SELECT COUNT(*) AS r4_rows FROM (
  SELECT v.service_date, v.route_id
    FROM v_report_daily_by_route v
   WHERE v.service_date BETWEEN DATE '2025-01-01' AND DATE '2025-12-31'
   GROUP BY v.service_date, v.route_id);

PROMPT === วัด R6 (2025-01-01 .. 2025-12-31) ===
SELECT COUNT(*) AS r6_rows FROM (
  SELECT v.emp_id, v.service_date
    FROM v_report_driver_workload v
   WHERE v.service_date BETWEEN DATE '2025-01-01' AND DATE '2025-12-31'
   GROUP BY v.emp_id, v.service_date);
SET TIMING OFF

-- C3) ผ่าน API จริง (รวม network + JSON) — ดูวิธีใน perf-procedure-t057.md §4
--     curl -H "Authorization: Bearer $TOKEN" \
--          "http://localhost:3000/api/v1/report/boarding-alighting-week?year=2568"

PROMPT
PROMPT === จบ 06_perf_indexes.sql — คัดลอกผล PART B/C ไปบันทึกใน perf-procedure-t057.md ===
PROMPT === (เว้นว่างไว้จนกว่าจะได้รันจริง — ห้ามเติมตัวเลขที่ไม่ได้วัด) ===
