-- ==================================================================
--  03_seed_front.sql  —  กลุ่ม FRONT : เส้นทาง / รอบเวลา / ยานพาหนะ
--  ระบบรับส่งรถรับส่ง (Shuttle Bus System) สำนักงานเขตหนองจอก
-- ------------------------------------------------------------------
--  Task      : T-008 (Sprint 2) — เจ้าของ: นายเก่งกาญ เชี่ยวชาญ
--  แหล่งข้อมูล: PDF หน้า 2 (จุดจอด + นาที) และ หน้า 3, 10 (รอบ/คนขับ/รถ)
--  ตารางที่ใส่: 9 = stop · route · route_stop · vehicle_type · vehicle
--                    · schedule · schedule_stop · driver_assign · vehicle_assign
--
--  วิธีรัน
--    ต้องรัน 01_schema.sql และ 02_seed_master.sql มาก่อน
--    sqlplus shuttle_app/<รหัสผ่าน>@localhost:1521/XEPDB1 @03_seed_front.sql
--
--  ⛔ เส้นทางที่ 1 ยังไม่ถูก seed — ดูหัวข้อ 1) ด้านล่าง
-- ==================================================================


-- ==================================================================
--  1) ⛔ เส้นทางที่ 1 — ยังไม่ทำ เพราะข้อมูลขัดกับ BR-03
-- ------------------------------------------------------------------
--  PDF หน้า 2 ให้เส้นทาง 1 = 7 จุด รวม 30 นาที แต่มีชื่อจุดจอดซ้ำ 3 จุด:
--     1. มหาวิทยาลัยเทคโนโลยีมหานคร  →  ซ้ำกับลำดับ 7
--     2. โลตัสหนองจอก                  →  ซ้ำกับลำดับ 6
--     3. โรงพยาบาลหนองจอก              →  ซ้ำกับลำดับ 5
--
--  ขัดกับ constraint uq_route_stop_uk UNIQUE (route_id, stop_id)   [01_schema.sql:154]
--  ซึ่งมาจาก BR-03 "จุดจอดซ้ำในเส้นทางเดียวกันไม่ได้"
--  → ถ้า INSERT ตาม PDF จะได้ ORA-00001 ทันที
--
--  สังเกต: เส้นทาง 1 มีลักษณะ "ไป-กลับ" (เริ่มและจบที่มหาวิทยาลัยเหมือนกัน)
--    ซึ่งไม่เข้ากับแบบจำลองเส้นทางเชิงเส้นใน ER Mapping
--
--  ✅ การตัดสินใจของ Scrum Master (นายเก่งกาญ) เมื่อ 2026-09-29:
--     "ข้ามเส้นทาง 1 ไว้ก่อน ทำเส้นทาง 2 และ 3 ก่อน"
--     → เสีย DoD "เส้นทาง 1 = 7 จุด" ไปก่อน แล้วแก้ DoD ทีหลัง
--     → ต้องถามอาจารย์ (Q19) ก่อน seed เส้นทาง 1
--  ==================================================================


-- ==================================================================
--  2) stop  —  6 จุดจอด (ทะเบียนรวมของระบบ)
--  ชื่อและลำดับตาม PDF หน้า 2 · lat/long ไม่มีใน PDF → NULL
--  ⚠ "โรงพยาบาลหนองจอก" ถูกใส่ไว้แม้ยังไม่มีเส้นทางไหนใช้
--     เพราะเป็นจุดจอดของเส้นทาง 1 ที่จะเพิ่มภายหลัง
-- ==================================================================
INSERT INTO stop (stop_name, address) VALUES ('มหาวิทยาลัยเทคโนโลยีมหานคร', 'ถนนชลบุรี แขวงหนองจอก เขตหนองจอก กรุงเทพมหานคร');
INSERT INTO stop (stop_name, address) VALUES ('โลตัสหนองจอก',                 'แขวงหนองจอก เขตหนองจอก กรุงเทพมหานคร');
INSERT INTO stop (stop_name, address) VALUES ('โรงพยาบาลหนองจอก',             'ถนนสมานคล แขวงหนองจอก เขตหนองจอก กรุงเทพมหานคร');
INSERT INTO stop (stop_name, address) VALUES ('Big C หนองจอก',                 'ถนนกรุงเทพกรุง แขวงหนองจอก เขตหนองจอก กรุงเทพมหานคร');
INSERT INTO stop (stop_name, address) VALUES ('สวนสาธารณหนองจอก',             'แขวงหนองจอก เขตหนองจอก กรุงเทพมหานคร');
INSERT INTO stop (stop_name, address) VALUES ('ร้านส้มตำปูนาง',                'แขวงหนองจอก เขตหนองจอก กรุงเทพมหานคร');


-- ==================================================================
--  3) vehicle_type  —  3 ชนิด (PDF หน้า 10)
--  ⚠ BR-06 : จองได้สูงสุด 4 ที่นั่งต่อครั้ง
--     9 และ 15 จึงไม่ใช่ตัวจำกัด — ตัวจำกัดจริงคือ 4 ตาม ck_booking_seats
-- ==================================================================
INSERT INTO vehicle_type (vtype_name, capacity) VALUES ('รถตู้ 9 ที่นั่ง',      9);
INSERT INTO vehicle_type (vtype_name, capacity) VALUES ('รถมินิบัส 15 ที่นั่ง', 15);
INSERT INTO vehicle_type (vtype_name, capacity) VALUES ('รถบัส 20 ที่นั่ง',    20);


-- ==================================================================
--  4) vehicle  —  7 คัน (PDF หน้า 3 และหน้า 10)
-- ==================================================================
INSERT INTO vehicle (plate_no, vtype_id) VALUES ('สย 2591', (SELECT vtype_id FROM vehicle_type WHERE vtype_name = 'รถตู้ 9 ที่นั่ง'));
INSERT INTO vehicle (plate_no, vtype_id) VALUES ('สย 2599', (SELECT vtype_id FROM vehicle_type WHERE vtype_name = 'รถตู้ 9 ที่นั่ง'));
INSERT INTO vehicle (plate_no, vtype_id) VALUES ('ชย 7788', (SELECT vtype_id FROM vehicle_type WHERE vtype_name = 'รถตู้ 9 ที่นั่ง'));
INSERT INTO vehicle (plate_no, vtype_id) VALUES ('นน 5566', (SELECT vtype_id FROM vehicle_type WHERE vtype_name = 'รถมินิบัส 15 ที่นั่ง'));
INSERT INTO vehicle (plate_no, vtype_id) VALUES ('นม 8899', (SELECT vtype_id FROM vehicle_type WHERE vtype_name = 'รถมินิบัส 15 ที่นั่ง'));
INSERT INTO vehicle (plate_no, vtype_id) VALUES ('บก 1130', (SELECT vtype_id FROM vehicle_type WHERE vtype_name = 'รถบัส 20 ที่นั่ง'));
INSERT INTO vehicle (plate_no, vtype_id) VALUES ('กข 4455', (SELECT vtype_id FROM vehicle_type WHERE vtype_name = 'รถบัส 20 ที่นั่ง'));


-- ==================================================================
--  5) route  —  2 เส้นทาง (เส้นทาง 1 ถูกข้าม ดูหัวข้อ 1)
--  ⚠ BR-01 : total_minutes ต้อง = SUM(route_stop.travel_minutes)
--     จึงใส่ 0 ไว้ก่อน แล้วคำนวณจริงในหัวข้อ 8 — ห้าม hardcode
-- ==================================================================
INSERT INTO route (route_name, total_minutes, description) VALUES ('เส้นทางที่ 2', 0, 'มหาวิทยาลัยเทคโนโลยีมหานคร - โลตัส - สวนสาธารณ - ร้านส้มตำปูนาง');
INSERT INTO route (route_name, total_minutes, description) VALUES ('เส้นทางที่ 3', 0, 'Big C - โลตัส - สวนสาธารณ - ร้านส้มตำปูนาง - มหาวิทยาลัยเทคโนโลยีมหานคร');


-- ==================================================================
--  6) route_stop  —  จุดจอด + นาทีตาม PDF หน้า 2
--  stop_seq 1 = จุดเริ่มต้น → travel_minutes = 0 (PDF ไม่ได้ใส่ค่าไว้)
-- ------------------------------------------------------------------
--  เส้นทางที่ 2 : 5 + 3 + 5        = 13 นาที  ✅ ตรง PDF
--  เส้นทางที่ 3 : 5 + 3 + 5 + 2    = 15 นาที  🔴 PDF เขียน "12" = Q-B
-- ------------------------------------------------------------------
--  ⚠ TODO(Q-B) : ยังไม่ได้รับคำยืนยันจากอาจารย์
--     PDF หน้า 2 เขียน "เส้นทางที่ 3 เวลารวม 12 นาที" แต่ผลบวกของจุดจอดได้ 15
--     BR-01 บังคับให้ total_minutes = SUM(travel_minutes) → ค่าที่ถูกต้องคือ 15
--     → ที่นี่ใช้ 15 ตามหลัก "ข้อมูลที่ขัดแย้งห้ามให้ AI เดา" (AR-08)
--        และตามแผนสำรองใน sprint-02-plan.md หัวข้อ 7
--     → เส้นทาง 1 (5+3+6+3+3+10 = 30) และเส้นทาง 2 (5+3+5 = 13) ตรงกับ PDF
--        ทั้งคู่ สนับสนุนว่าเป็น typo ใน PDF ไม่ใช่ข้อมูลที่เราอ่านผิด
--     → ต้องแก้ DoD ของ T-008 จาก "12" เป็น "15" และแจ้งอาจารย์
-- ==================================================================
-- ---- เส้นทางที่ 2 : 4 จุด ----
INSERT INTO route_stop (route_id, stop_id, stop_seq, travel_minutes)
SELECT r.route_id, s.stop_id, v.seq, v.mins
FROM   route r, stop s,
       (SELECT 1 AS seq, 'มหาวิทยาลัยเทคโนโลยีมหานคร' AS stop_name, 0 AS mins FROM dual UNION ALL
        SELECT 2, 'โลตัสหนองจอก',                 5 FROM dual UNION ALL
        SELECT 3, 'สวนสาธารณหนองจอก',             3 FROM dual UNION ALL
        SELECT 4, 'ร้านส้มตำปูนาง',                5 FROM dual) v
WHERE  r.route_name = 'เส้นทางที่ 2'
AND    s.stop_name  = v.stop_name;

-- ---- เส้นทางที่ 3 : 5 จุด ----
INSERT INTO route_stop (route_id, stop_id, stop_seq, travel_minutes)
SELECT r.route_id, s.stop_id, v.seq, v.mins
FROM   route r, stop s,
       (SELECT 1 AS seq, 'Big C หนองจอก' AS stop_name, 0 AS mins FROM dual UNION ALL
        SELECT 2, 'โลตัสหนองจอก',                 5 FROM dual UNION ALL
        SELECT 3, 'สวนสาธารณหนองจอก',             3 FROM dual UNION ALL
        SELECT 4, 'ร้านส้มตำปูนาง',                5 FROM dual UNION ALL
        SELECT 5, 'มหาวิทยาลัยเทคโนโลยีมหานคร',    2 FROM dual) v
WHERE  r.route_name = 'เส้นทางที่ 3'
AND    s.stop_name  = v.stop_name;


-- ==================================================================
--  7) schedule  —  8 รอบ (2 เส้นทาง × 4 รอบ)
--  รอบเวลาตาม PDF หน้า 3 : 09:30 / 11:00 / 13:00 / 15:00
--  ⚠ ASM-03 : PDF ไม่ได้ให้ตารางรอบของเส้นทาง 3 และไม่ได้ระบุวันที่
--     → ทีมตั้งให้เส้นทาง 3 ใช้รอบเดียวกับเส้นทาง 2 (9.30/11.00/13.00/15.00)
--     → service_date = 2026-10-01 เป็นวันที่ตัวอย่างสำหรับทดสอบระบบ
--       (ระบบจริงต้องสร้างรอบตามวันที่ใช้บริการจริง)
-- ==================================================================
INSERT INTO schedule (route_id, service_date, depart_at)
SELECT r.route_id, DATE '2026-10-01', v.t
FROM   route r,
       (SELECT TIMESTAMP '2026-10-01 09:30:00' AS t FROM dual UNION ALL
        SELECT TIMESTAMP '2026-10-01 11:00:00' FROM dual UNION ALL
        SELECT TIMESTAMP '2026-10-01 13:00:00' FROM dual UNION ALL
        SELECT TIMESTAMP '2026-10-01 15:00:00' FROM dual) v
WHERE  r.route_name IN ('เส้นทางที่ 2', 'เส้นทางที่ 3');


-- ==================================================================
--  8) route.total_minutes  —  คำนวณจริงตาม BR-01
--  ห้าม hardcode เพราะข้อกำหนดระบุให้ระบบคำนวณเอง
-- ==================================================================
UPDATE route r
SET    r.total_minutes = (SELECT NVL(SUM(rs.travel_minutes), 0)
                          FROM   route_stop rs
                          WHERE  rs.route_id = r.route_id);


-- ==================================================================
--  9) schedule_stop  —  เวลาที่ถึงแต่ละจุดจอดในแต่ละรอบ
--  BR-02 : arrive_at = depart_at + SUM(travel_minutes ตั้งแต่ลำดับ 1 ถึงจุดนี้)
--  → คำนวณด้วย correlated subquery ไม่ hardcode เวลา
--  จำนวนแถวที่ได้ = (4 จุด × 4 รอบ) + (5 จุด × 4 รอบ) = 16 + 20 = 36
-- ==================================================================
INSERT INTO schedule_stop (sched_id, stop_id, stop_seq, arrive_at, dwell_minutes)
SELECT s.sched_id,
       rs.stop_id,
       rs.stop_seq,
       s.depart_at + NUMTODSINTERVAL(
           (SELECT NVL(SUM(rs2.travel_minutes), 0)
            FROM   route_stop rs2
            WHERE  rs2.route_id = s.route_id
            AND    rs2.stop_seq <= rs.stop_seq), 'MINUTE'),
       0
FROM   schedule s
JOIN   route_stop rs ON rs.route_id = s.route_id;


-- ==================================================================
--  10) driver_assign + vehicle_assign  —  จัดคู่คนขับและรถ
--  ⚠ BR-04 : คนขับ/รถคนเดียวกันห้ามถูกจัดในเวลาเดียวกัน
--     → ตรวจสอบท้ายไฟล์
-- ------------------------------------------------------------------
--  เส้นทางที่ 2 : ตาม PDF หน้า 3 (คนขับและรถมาจากตารางตัวอย่าง)
--  เส้นทางที่ 3 : ⚠ PDF ไม่มีตาราง → ทีมตั้งเอง (ASM-03)
--     ใช้คนขับที่เหลือ 4 คน และรถที่เหลือ 4 คัน เพื่อไม่ให้ชนกับเส้นทาง 2
-- ==================================================================
-- ---- เส้นทางที่ 2 ----
INSERT INTO driver_assign (sched_id, emp_id)
SELECT s.sched_id,
       CASE TO_CHAR(s.depart_at, 'HH24:MI')
            WHEN '09:30' THEN (SELECT emp_id FROM employee WHERE username = 'somkuan')  -- สมควร ใจงาม
            WHEN '11:00' THEN (SELECT emp_id FROM employee WHERE username = 'somkuan')  -- สมควร ใจงาม
            WHEN '13:00' THEN (SELECT emp_id FROM employee WHERE username = 'sommai')   -- สมหมาย ใจรัก
            WHEN '15:00' THEN (SELECT emp_id FROM employee WHERE username = 'sommai')   -- สมหมาย ใจรัก
       END
FROM   schedule s, route r
WHERE  s.route_id = r.route_id AND r.route_name = 'เส้นทางที่ 2';

INSERT INTO vehicle_assign (sched_id, veh_id)
SELECT s.sched_id, (SELECT veh_id FROM vehicle WHERE plate_no = 'สย 2599')
FROM   schedule s, route r
WHERE  s.route_id = r.route_id AND r.route_name = 'เส้นทางที่ 2';

-- ---- เส้นทางที่ 3 (ทีมตั้งเอง — ยังต้องยืนยันกับอาจารย์) ----
INSERT INTO driver_assign (sched_id, emp_id)
SELECT s.sched_id,
       CASE TO_CHAR(s.depart_at, 'HH24:MI')
            WHEN '09:30' THEN (SELECT emp_id FROM employee WHERE username = 'somchai')   -- สมชาย ใจดี
            WHEN '11:00' THEN (SELECT emp_id FROM employee WHERE username = 'aree')      -- อารีรัตน์ ศรีสุข
            WHEN '13:00' THEN (SELECT emp_id FROM employee WHERE username = 'worapong')  -- วรพล เทพทอง
            WHEN '15:00' THEN (SELECT emp_id FROM employee WHERE username = 'nantana')   -- นันทนา ใจตรง
       END
FROM   schedule s, route r
WHERE  s.route_id = r.route_id AND r.route_name = 'เส้นทางที่ 3';

INSERT INTO vehicle_assign (sched_id, veh_id)
SELECT s.sched_id,
       CASE TO_CHAR(s.depart_at, 'HH24:MI')
            WHEN '09:30' THEN (SELECT veh_id FROM vehicle WHERE plate_no = 'สย 2591')
            WHEN '11:00' THEN (SELECT veh_id FROM vehicle WHERE plate_no = 'ชย 7788')
            WHEN '13:00' THEN (SELECT veh_id FROM vehicle WHERE plate_no = 'บก 1130')
            WHEN '15:00' THEN (SELECT veh_id FROM vehicle WHERE plate_no = 'กข 4455')
       END
FROM   schedule s, route r
WHERE  s.route_id = r.route_id AND r.route_name = 'เส้นทางที่ 3';


-- ==================================================================
--  ตรวจสอบผลหลังรัน  (RESULT ต้องเป็น PASS ทุกแถว)
-- ==================================================================
COLUMN object_type FORMAT A20
COLUMN result       FORMAT A8
COLUMN detail       FORMAT A34
WITH actual AS (
  SELECT 'STOP' AS object_type, 6 AS expected,
         (SELECT COUNT(*) FROM stop) AS got FROM dual
  UNION ALL SELECT 'ROUTE (ไม่รวมเส้นทาง 1)', 2,
         (SELECT COUNT(*) FROM route) FROM dual
  UNION ALL SELECT 'VEHICLE_TYPE', 3,
         (SELECT COUNT(*) FROM vehicle_type) FROM dual
  UNION ALL SELECT 'VEHICLE', 7,
         (SELECT COUNT(*) FROM vehicle) FROM dual
  UNION ALL SELECT 'SCHEDULE (2 สาย x 4 รอบ)', 8,
         (SELECT COUNT(*) FROM schedule) FROM dual
  UNION ALL SELECT 'SCHEDULE_STOP', 36,
         (SELECT COUNT(*) FROM schedule_stop) FROM dual
  UNION ALL SELECT 'DRIVER_ASSIGN', 8,
         (SELECT COUNT(*) FROM driver_assign) FROM dual
  UNION ALL SELECT 'VEHICLE_ASSIGN', 8,
         (SELECT COUNT(*) FROM vehicle_assign) FROM dual
  -- ⛔ เส้นทาง 1 ต้องยังไม่มี
  UNION ALL SELECT 'ROUTE1_SKIPPED', 0,
         (SELECT COUNT(*) FROM route WHERE route_name = 'เส้นทางที่ 1') FROM dual
)
SELECT object_type, expected, got AS actual,
       CASE WHEN got = expected THEN 'PASS' ELSE 'FAIL' END AS result
FROM actual
ORDER BY object_type;

PROMPT
PROMPT === BR-01 : total_minutes ต้อง = SUM(travel_minutes) ===
COLUMN route_name FORMAT A14
COLUMN total_minutes FORMAT 9999
SELECT r.route_name, r.total_minutes,
       (SELECT SUM(rs.travel_minutes) FROM route_stop rs WHERE rs.route_id = r.route_id) AS sum_from_stops,
       (SELECT COUNT(*)       FROM route_stop rs WHERE rs.route_id = r.route_id) AS stop_count
FROM   route r
ORDER  BY r.route_id;

PROMPT
PROMPT === BR-04 : ต้องไม่มีคนขับ/รถชนกันในเวลาเดียวกัน (ทั้งคู่ต้องเป็น 0) ===
SELECT 'driver conflict' AS check_name, COUNT(*) AS bad_rows FROM (
  SELECT da.emp_id, s.depart_at
  FROM   driver_assign da JOIN schedule s ON s.sched_id = da.sched_id
  GROUP  BY da.emp_id, s.depart_at HAVING COUNT(*) > 1)
UNION ALL
SELECT 'vehicle conflict', COUNT(*) FROM (
  SELECT va.veh_id, s.depart_at
  FROM   vehicle_assign va JOIN schedule s ON s.sched_id = va.sched_id
  GROUP  BY va.veh_id, s.depart_at HAVING COUNT(*) > 1);

PROMPT
PROMPT === BR-02 : จุดสุดท้ายต้องถึงเวลา depart_at + total_minutes ===
COLUMN route_name FORMAT A14
COLUMN depart_at   FORMAT A22
COLUMN last_arrive FORMAT A22
SELECT r.route_name,
       TO_CHAR(MAX(s.depart_at), 'YYYY-MM-DD HH24:MI:SS') AS depart_at,
       TO_CHAR(MAX(ss.arrive_at),  'YYYY-MM-DD HH24:MI:SS') AS last_arrive,
       MAX(ss.arrive_at) - MAX(s.depart_at) AS actual_minutes,
       r.total_minutes
FROM   route r
JOIN   schedule s      ON s.route_id = r.route_id
JOIN   schedule_stop ss ON ss.sched_id = s.sched_id
GROUP  BY r.route_name, r.total_minutes
ORDER  BY r.route_name;

PROMPT
PROMPT === ตารางเวลารอบเช้าของวันที่ 2026-10-01 (ตรวจว่านาทีถูกต้อง) ===
COLUMN route_name FORMAT A14
COLUMN depart_at   FORMAT A10
COLUMN stop_seq    FORMAT 999
COLUMN stop_name   FORMAT A32
COLUMN arrive_at   FORMAT A10
SELECT r.route_name,
       TO_CHAR(s.depart_at, 'HH24:MI') AS depart_at,
       ss.stop_seq,
       st.stop_name,
       TO_CHAR(ss.arrive_at, 'HH24:MI:SS') AS arrive_at
FROM   schedule s
JOIN   route r          ON r.route_id  = s.route_id
JOIN   schedule_stop ss ON ss.sched_id = s.sched_id
JOIN   stop st          ON st.stop_id  = ss.stop_id
WHERE  s.service_date = DATE '2026-10-01'
AND    TO_CHAR(s.depart_at, 'HH24:MI') = '09:30'
ORDER  BY r.route_id, ss.stop_seq;

COMMIT;
