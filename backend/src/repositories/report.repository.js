// src/repositories/report.repository.js — T-054/T-055/T-056: report APIs R1 / R4 / R6 (UC-27/28/29)
// - weeklyBoarding (R1 / UC-27): อ่าน view v_report_boarding_alighting_week (T-053/T-054)
//   · view granularity = สัปดาห์ × เส้นทาง → SUM() รวมทุกเส้นทางของแต่ละ week_start (นับ "คน")
//   · week bounds คำนวณฝั่ง service (พ.ศ.→ค.ศ. + Monday ของสัปดาห์ที่ 1 ม.ค./31 ธ.ค.) → bind 2 ตัว
//   · route_id (optional) เป็น bind — ไม่มีวันที่ literal ใน SQL
// - listActiveRouteIds: รหัสเส้นทางที่ is_active = 1 (แกน route_ids ของ R4 + PIVOT column set)
// - dailyByRoute (R4 / UC-28): เทคนิคที่บังคับ = PIVOT
//   · สร้าง "รายการวันที่ทั้งช่วง" ก่อน (CONNECT BY LEVEL = calendar spine ตาม openapi
//     วันที่ไม่มีรอบเวลาต้องแสดง 0 ไม่ใช่ตัดแถว) แล้ว LEFT JOIN ผล pivot
//   · PIVOT SUM(customer_count) FOR route_id IN (subquery route is_active=1) — รหัสเส้นทางใหม่
//     ถูก pivot อัตโนมัติ ไม่ hardcode
//   · day_name = ฝั่ง service คำนวณเอง (จ/อ/พ/พฤ/ศ/ส/อา) — ไม่ใช้ TO_CHAR 'Day' ที่ค่าขึ้น NLS
// - driverWorkload (R6 / UC-29): เทคนิคที่บังคับ = Analytic + ROLLUP
//   · รายคนขับทุกคน (driver_assign → employee) LEFT JOIN view ตามช่วงวันที่
//     คนขับไม่มีรอบในช่วง → 0/0 (openapi) · SUM(NVL(...)) กัน NULL
//   · GROUP BY ROLLUP(emp_id, driver_name) + HAVING GROUPING ตรงกัน
//     → ตัดแถว subtotal ระดับ emp (มีแค่ระดับ driver + แถวรวม "driver_name IS NULL")
//   · RANK() OVER (ORDER BY total_trips DESC) = analytic (เทคนิคที่ UC-29 กำหนด)
// - READ ONLY: ไม่มี INSERT/UPDATE/DELETE — UC-30 (ไม่มีการเปลี่ยนแปลงข้อมูล)
// - ทุก query = bind variables เท่านั้น ห้าม interpolate วันที่/รหัส (P-04 ข้อ 18)
const { query } = require('../config/db');

// ------------------------------ R1 (UC-27 / T-054): GET /report/boarding-alighting-week ------------------------------
async function weeklyBoarding({ fromWeek, toWeek, routeId }) {
  const sql = `
    SELECT v.week_start, v.week_no,
           SUM(v.boarded)       AS boarded,
           SUM(v.alighted)      AS alighted,
           SUM(v.no_show_count) AS no_show_count
      FROM v_report_boarding_alighting_week v
     WHERE v.week_start BETWEEN TO_DATE(:fromWeek, 'YYYY-MM-DD')
                            AND TO_DATE(:toWeek, 'YYYY-MM-DD')
       AND (:routeId IS NULL OR v.route_id = :routeId)
     GROUP BY v.week_start, v.week_no
     ORDER BY v.week_start`;
  const result = await query(sql, { fromWeek, toWeek, routeId });
  return result.rows || [];
}

// รหัสเส้นทางที่ใช้งานอยู่ (R4: แกน route_ids + ชุดคอลัมน์ pivot)
async function listActiveRouteIds(routeId) {
  const sql = `
    SELECT route_id
      FROM route
     WHERE is_active = 1
       AND (:routeId IS NULL OR route_id = :routeId)
     ORDER BY route_id`;
  const result = await query(sql, { routeId });
  return (result.rows || []).map((row) => Number(row.ROUTE_ID ?? row.route_id));
}

// ------------------------------ R4 (UC-28 / T-055): GET /report/daily-by-route ------------------------------
async function dailyByRoute({ fromDate, toDate, routeId }) {
  const sql = `
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
     ORDER BY cal.service_date`;
  const result = await query(sql, { fromDate, toDate, routeId });
  return result.rows || [];
}

// ------------------------------ R6 (UC-29 / T-056): GET /report/driver-workload ------------------------------
async function driverWorkload({ fromDate, toDate }) {
  const sql = `
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
     ORDER BY (CASE WHEN x.driver_id IS NULL THEN 1 ELSE 0 END), x.rank_no, x.driver_id`;
  const result = await query(sql, { fromDate, toDate });
  return result.rows || [];
}

module.exports = {
  weeklyBoarding,
  listActiveRouteIds,
  dailyByRoute,
  driverWorkload,
};
