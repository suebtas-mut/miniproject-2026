// src/repositories/driver.repository.js — T-043..T-047: driver daily work / trip / manifest / QR scan / complete (UC-22..UC-26)
// - listMyRounds (UC-22): driver_assign JOIN schedule JOIN route + LEFT JOIN trip/vehicle_assign/vehicle
//   · passenger_count = COUNT booking rows status='reserved' (openapi: "นับ booking ที่ status='reserved'")
//   · pending_trip_id = รอบอื่นของคนขับคนนี้ที่ยัง status='running' (UC-23 3b) — scalar subquery, ROWNUM=1
//   · service_date: :serviceDate IS NULL → TRUNC(SYSDATE) (openapi: ถ้าไม่ส่ง = วันนี้ตาม schedule.service_date)
// - startTrip TX (openapi x-transaction): SELECT schedule FOR UPDATE (plain — ไม่ใช่ NOWAIT ตาม contract)
//   → driver/vehicle assignment → trip ของรอบนี้ → trip running อื่นของคนขับ → INSERT trip
// - manifest (UC-24): LISTAGG รายชื่อตาม last_name รายจุดจอด เรียง stop_seq
//   · ตาราง trip_passenger ไม่มี alight_stop_id → ผู้ลงนับจาก alight_seq = stop_seq AND alight_time IS NOT NULL
// - scan (UC-25 / BR-09): SELECT booking WHERE qr_token = :qrToken FOR UPDATE เสมอ (bind variable เท่านั้น ห้ามต่อ string)
//   · JOIN employee เพื่อเอาชื่อผู้โดยสาร + FOR UPDATE OF b.booking_id ล็อกเฉพาะแถว booking
// - completeTrip TX (UC-26 / BR-10 · T-047): SELECT trip FOR UPDATE → UPDATE trip (end_time+completed)
//   → UPDATE booking reserved → no_show (สูตร openapi x-transaction) → อ่านสรุปใน TX เดียวกัน → COMMIT
const oracledb = require('oracledb');
const { query } = require('../config/db');

// ------------------------------ UC-22: GET /driver/schedule ------------------------------
async function listMyRounds({ empId, serviceDate }) {
  const sql = `
    SELECT s.sched_id, s.service_date, s.depart_at, s.route_id, r.route_name, r.total_minutes,
           va.veh_id, v.plate_no,
           t.trip_id AS trip_id,
           (SELECT COUNT(*) FROM booking b
             WHERE b.sched_id = s.sched_id AND b.status = 'reserved') AS passenger_count,
           (SELECT p.trip_id FROM trip p
             WHERE p.driver_id = :empId AND p.status = 'running' AND p.sched_id <> s.sched_id
               AND ROWNUM = 1) AS pending_trip_id,
           (SELECT p.sched_id FROM trip p
             WHERE p.driver_id = :empId AND p.status = 'running' AND p.sched_id <> s.sched_id
               AND ROWNUM = 1) AS pending_sched_id
      FROM driver_assign da
      JOIN schedule s ON s.sched_id = da.sched_id
      JOIN route r ON r.route_id = s.route_id
      LEFT JOIN trip t ON t.sched_id = s.sched_id
      LEFT JOIN vehicle_assign va
             ON va.sched_id = s.sched_id
            AND va.assign_id = (SELECT MIN(va2.assign_id) FROM vehicle_assign va2 WHERE va2.sched_id = s.sched_id)
      LEFT JOIN vehicle v ON v.veh_id = va.veh_id
     WHERE da.emp_id = :empId
       AND s.service_date = CASE WHEN :serviceDate IS NULL THEN TRUNC(SYSDATE)
                                 ELSE TO_DATE(:serviceDate, 'YYYY-MM-DD') END
     ORDER BY s.depart_at, s.sched_id`;
  const result = await query(sql, { empId, serviceDate });
  return result.rows || [];
}

// ------------------------------ UC-23: POST /driver/trip/{schedId}/start ------------------------------
// TX step 1: ล็อกแถว schedule (plain FOR UPDATE ตาม x-transaction — ไม่ aggregate จึงไม่เสี่ยง ORA-02014)
async function lockSchedule(conn, schedId) {
  const result = await conn.execute(
    `SELECT sched_id FROM schedule WHERE sched_id = :schedId FOR UPDATE`,
    { schedId },
  );
  return (result.rows && result.rows[0]) || null;
}

// ผู้ขับทุกคนของรอบนี้ (uq_driver_sched อนุญาตคนขับสำรอง → ทุกแถวมีสิทธิ์เริ่มงาน)
async function findDriverAssignments(conn, schedId) {
  const result = await conn.execute(
    `SELECT emp_id FROM driver_assign WHERE sched_id = :schedId ORDER BY assign_id`,
    { schedId },
  );
  return (result.rows || []).map((row) => Number(row.EMP_ID ?? row.emp_id));
}

// รถของรอบนี้ (MIN assign_id = คันหลัก ตาม convention เดิม)
async function findVehicleAssignment(conn, schedId) {
  const result = await conn.execute(
    `SELECT veh_id FROM vehicle_assign WHERE sched_id = :schedId ORDER BY assign_id`,
    { schedId },
  );
  const rows = result.rows || [];
  if (rows.length === 0) return null;
  return Number(rows[0].VEH_ID ?? rows[0].veh_id);
}

// UC-23 3c: 1 รอบ = 1 trip (uq_trip_sched)
async function findTripBySched(conn, schedId) {
  const result = await conn.execute(
    `SELECT trip_id, status FROM trip WHERE sched_id = :schedId`,
    { schedId },
  );
  return (result.rows && result.rows[0]) || null;
}

// UC-23 3b: งานค้างของคนขับคนนี้ (รอบอื่นที่ยัง running) — เรียกหลัง 3c แล้วจึงยกเว้นรอบตัวเอง
async function findDriverRunningTrip(conn, empId, exceptSchedId) {
  const result = await conn.execute(
    `SELECT trip_id, sched_id FROM trip
      WHERE driver_id = :empId AND status = 'running' AND sched_id <> :exceptSchedId
        AND ROWNUM = 1`,
    { empId, exceptSchedId },
  );
  return (result.rows && result.rows[0]) || null;
}

// INSERT → COMMIT: start_time = SYSTIMESTAMP, status = 'running' (ค่าเริ่มต้นตามคอลัมน์)
async function insertTrip(conn, { schedId, driverId, vehId }) {
  const result = await conn.execute(
    `INSERT INTO trip (sched_id, driver_id, veh_id, start_time, status)
     VALUES (:schedId, :driverId, :vehId, SYSTIMESTAMP, 'running')
     RETURNING trip_id INTO :newId`,
    {
      schedId,
      driverId,
      vehId,
      newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    },
  );
  const out = result.outBinds && (result.outBinds.newId || result.outBinds[0]);
  return Array.isArray(out) ? out[0] : out;
}

// ------------------------------ UC-24 / UC-25: trip lookup ------------------------------
// เทียบ BR-09 ด้วย trip_id ที่ client ส่งมา (ห้าม join ด้วย sched_id — usecase-spec UC-25 สูตร Oracle)
async function findTripById(tripId) {
  const sql = `
    SELECT t.trip_id, t.sched_id, t.driver_id, t.veh_id, t.start_time, t.end_time, t.status,
           r.route_name, v.plate_no,
           d.first_name || ' ' || d.last_name AS driver_name
      FROM trip t
      JOIN schedule s ON s.sched_id = t.sched_id
      JOIN route r ON r.route_id = s.route_id
      LEFT JOIN vehicle v ON v.veh_id = t.veh_id
      LEFT JOIN employee d ON d.emp_id = t.driver_id
     WHERE t.trip_id = :tripId`;
  const result = await query(sql, { tripId });
  return (result.rows && result.rows[0]) || null;
}

// UC-24: รายชื่อขึ้น-ลงรายจุดจอดด้วย LISTAGG (DoD Sprint 10) เรียง stop_seq
async function findManifestStops(tripId) {
  const sql = `
    SELECT ss.stop_id, st.stop_name, ss.stop_seq, ss.arrive_at,
           (SELECT COUNT(*) FROM trip_passenger tp
             WHERE tp.trip_id = :tripId
               AND tp.checkin_stop_id = ss.stop_id
               AND tp.checkin_time IS NOT NULL) AS board_count,
           (SELECT LISTAGG(e.first_name || ' ' || e.last_name, ', ')
                      WITHIN GROUP (ORDER BY e.last_name)
              FROM trip_passenger tp
              JOIN booking b ON b.booking_id = tp.booking_id
              JOIN employee e ON e.emp_id = b.cust_id
             WHERE tp.trip_id = :tripId
               AND tp.checkin_stop_id = ss.stop_id
               AND tp.checkin_time IS NOT NULL) AS board_names,
           (SELECT COUNT(*) FROM trip_passenger tp
             WHERE tp.trip_id = :tripId
               AND tp.alight_seq = ss.stop_seq
               AND tp.alight_time IS NOT NULL) AS alight_count,
           (SELECT LISTAGG(e.first_name || ' ' || e.last_name, ', ')
                      WITHIN GROUP (ORDER BY e.last_name)
              FROM trip_passenger tp
              JOIN booking b ON b.booking_id = tp.booking_id
              JOIN employee e ON e.emp_id = b.cust_id
             WHERE tp.trip_id = :tripId
               AND tp.alight_seq = ss.stop_seq
               AND tp.alight_time IS NOT NULL) AS alight_names
      FROM schedule_stop ss
      JOIN stop st ON st.stop_id = ss.stop_id
     WHERE ss.sched_id = (SELECT t.sched_id FROM trip t WHERE t.trip_id = :tripId)
     ORDER BY ss.stop_seq`;
  const result = await query(sql, { tripId });
  return result.rows || [];
}

// ------------------------------ UC-25: POST /driver/trip/scan ------------------------------
// TX step 1: SELECT booking ... FOR UPDATE (openapi x-transaction) — qr_token เป็น bind variable เสมอ
//   JOIN employee เอาชื่อผู้โดยสาร + checkin_time เดิมของ trip นี้ (กรณี already_checked_in)
async function lockBookingByQr(conn, qrToken, tripId) {
  const result = await conn.execute(
    `SELECT b.booking_id, b.booking_code, b.cust_id, b.sched_id, b.status, b.seats, b.board_stop_id,
            e.first_name || ' ' || e.last_name AS passenger_name,
            (SELECT tp.checkin_time FROM trip_passenger tp
              WHERE tp.trip_id = :tripId AND tp.booking_id = b.booking_id) AS checkin_time
       FROM booking b
       JOIN employee e ON e.emp_id = b.cust_id
      WHERE b.qr_token = :qrToken
        FOR UPDATE OF b.booking_id`,
    { qrToken, tripId },
  );
  return (result.rows && result.rows[0]) || null;
}

// จุดขึ้นจริง: board_seq = ลำดับจุดจอดใน schedule_stop ของรอบ trip (ใช้ทำรายงาน R1/R5)
async function findStopSeq(conn, schedId, stopId) {
  const result = await conn.execute(
    `SELECT stop_seq FROM schedule_stop WHERE sched_id = :schedId AND stop_id = :stopId`,
    { schedId, stopId },
  );
  return (result.rows && result.rows[0]) || null;
}

// UC-25 4a: UPDATE booking → checked_in + INSERT trip_passenger ใน TX เดียวกัน (atomic กันสแกนซ้ำ)
async function updateCheckin(conn, bookingId) {
  return conn.execute(
    `UPDATE booking SET status = 'checked_in' WHERE booking_id = :bookingId`,
    { bookingId },
  );
}

async function insertTripPassenger(conn, { tripId, bookingId, checkinStopId, boardSeq }) {
  return conn.execute(
    `INSERT INTO trip_passenger (trip_id, booking_id, checkin_stop_id, checkin_time, board_seq)
     VALUES (:tripId, :bookingId, :checkinStopId, SYSTIMESTAMP, :boardSeq)`,
    { tripId, bookingId, checkinStopId, boardSeq },
  );
}

// อ่านค่า checkin_time จริงหลัง insert (ยังอยู่ใน TX เดียวกัน)
async function findCheckin(conn, tripId, bookingId) {
  const result = await conn.execute(
    `SELECT checkin_time FROM trip_passenger WHERE trip_id = :tripId AND booking_id = :bookingId`,
    { tripId, bookingId },
  );
  return (result.rows && result.rows[0]) || null;
}

// ------------------------------ UC-26: POST /driver/trip/{tripId}/complete (T-047 / BR-10) ------------------------------
// TX step 1 (openapi x-transaction): SELECT trip ... FOR UPDATE — plain ไม่ใช่ NOWAIT
async function lockTripById(conn, tripId) {
  const result = await conn.execute(
    `SELECT trip_id, sched_id, driver_id, veh_id, start_time, end_time, status
       FROM trip
      WHERE trip_id = :tripId
        FOR UPDATE`,
    { tripId },
  );
  return (result.rows && result.rows[0]) || null;
}

// TX step 2: UPDATE trip SET end_time = SYSTIMESTAMP, status = 'completed' (ตาม openapi)
async function updateTripComplete(conn, tripId) {
  return conn.execute(
    `UPDATE trip SET end_time = SYSTIMESTAMP, status = 'completed' WHERE trip_id = :tripId`,
    { tripId },
  );
}

// TX step 3 (BR-10 สูตร openapi): UPDATE booking SET status = 'no_show' WHERE sched_id = :schedId AND status = 'reserved'
async function markNoShow(conn, schedId) {
  return conn.execute(
    `UPDATE booking SET status = 'no_show' WHERE sched_id = :schedId AND status = 'reserved'`,
    { schedId },
  );
}

// TX step 4: สรุปยอดหลัง mark no_show (ยังอยู่ใน TX → เห็นค่าที่ยังไม่ commit)
//   total_booked/seats = booking ที่ยังไม่ cancelled (openapi TripSummary)
//   boarded/alighted    = trip_passenger checkin_time/alight_time IS NOT NULL
//   capacity            = vehicle_type.capacity ของรถรอบนี้
async function summarizeTrip(conn, tripId) {
  const result = await conn.execute(
    `SELECT t.trip_id, t.sched_id, t.status, t.start_time, t.end_time,
            (SELECT COUNT(*)
               FROM booking b
              WHERE b.sched_id = t.sched_id
                AND b.status <> 'cancelled') AS total_booked,
            (SELECT NVL(SUM(b.seats), 0)
               FROM booking b
              WHERE b.sched_id = t.sched_id
                AND b.status <> 'cancelled') AS seats_booked,
            (SELECT COUNT(*)
               FROM trip_passenger tp
              WHERE tp.trip_id = t.trip_id
                AND tp.checkin_time IS NOT NULL) AS boarded,
            (SELECT COUNT(*)
               FROM trip_passenger tp
              WHERE tp.trip_id = t.trip_id
                AND tp.alight_time IS NOT NULL) AS alighted,
            (SELECT COUNT(*)
               FROM booking b
              WHERE b.sched_id = t.sched_id
                AND b.status = 'no_show') AS no_show_count,
            (SELECT vt.capacity
               FROM vehicle v
               JOIN vehicle_type vt ON vt.vtype_id = v.vtype_id
              WHERE v.veh_id = t.veh_id) AS capacity
       FROM trip t
      WHERE t.trip_id = :tripId`,
    { tripId },
  );
  return (result.rows && result.rows[0]) || null;
}

// รายชื่อคนไม่มา (no_show) เรียง last_name — คืน array ใน TripSummary.no_show_names
async function listNoShowNames(conn, schedId) {
  const result = await conn.execute(
    `SELECT e.first_name || ' ' || e.last_name AS passenger_name
       FROM booking b
       JOIN employee e ON e.emp_id = b.cust_id
      WHERE b.sched_id = :schedId
        AND b.status = 'no_show'
      ORDER BY e.last_name, e.first_name`,
    { schedId },
  );
  return (result.rows || []).map((row) => row.PASSENGER_NAME ?? row.passenger_name ?? null);
}

module.exports = {
  listMyRounds,
  lockSchedule,
  findDriverAssignments,
  findVehicleAssignment,
  findTripBySched,
  findDriverRunningTrip,
  insertTrip,
  findTripById,
  findManifestStops,
  lockBookingByQr,
  findStopSeq,
  updateCheckin,
  insertTripPassenger,
  findCheckin,
  lockTripById,
  updateTripComplete,
  markNoShow,
  summarizeTrip,
  listNoShowNames,
};
