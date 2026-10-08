// src/repositories/booking.repository.js — T-034…T-039: booking (UC-17…UC-21 · B1/B2/B3)
// - ทุกค่าจาก query string/body เป็น bind variable เสมอ (P-04 ข้อ 18 · openapi ห้าม string ใน SQL)
// - BR-05: schedule_stop.arrive_at (จุดขึ้นรถ) - SYSTIMESTAMP >= INTERVAL '20' MINUTE
// - BR-07: capacity - NVL(SUM(booking.seats),0) เฉพาะ status = 'reserved'
// - BR-11: ass.stop_seq > bss.stop_seq · BR-12: JOIN ทั้งสองจุดใน schedule_stop ของรอบนั้น
// - TX booking: SELECT schedule ... FOR UPDATE NOWAIT (ล็อกก่อนนับ aggregate — กัน ORA-02014/ORA-00054)
// - TX cancel: SELECT booking ... FOR UPDATE (ตาม openapi x-transaction ไม่ใช่ NOWAIT) → UPDATE status
// - booking_code = 'BK' || seq_booking_code.NEXTVAL ใน INSERT (chapter-17 17.5.5 · ห้าม pad เอง)
// - UC-19 listMine/countMine: cust_id มาจาก JWT เท่านั้น (openapi ห้ามรับจาก query string)
const oracledb = require('oracledb');
const { query } = require('../config/db');

// ------------------------------ UC-17: GET /booking/available ------------------------------
// กรอง BR-05/BR-07/BR-11/BR-12 ใน query เดียว · ไม่มีรอบที่ผ่าน → คืน array ว่าง (UC-17 5a)
async function findAvailable({ boardStopId, alightStopId, serviceDate }) {
  const sql = `
    SELECT s.sched_id, s.route_id, r.route_name, s.service_date, s.depart_at,
           bss.stop_id AS board_stop_id, bss.stop_seq AS board_seq, bs.stop_name AS board_stop_name,
           ass.stop_id AS alight_stop_id, ass.stop_seq AS alight_seq, als.stop_name AS alight_stop_name,
           bss.arrive_at AS board_arrive_at,
           vt.capacity AS seats_total,
           (SELECT NVL(SUM(bk.seats), 0) FROM booking bk
             WHERE bk.sched_id = s.sched_id AND bk.status = 'reserved') AS seats_reserved,
           v.plate_no
      FROM schedule s
      JOIN route r ON r.route_id = s.route_id
      JOIN schedule_stop bss ON bss.sched_id = s.sched_id AND bss.stop_id = :boardStop
      JOIN schedule_stop ass ON ass.sched_id = s.sched_id AND ass.stop_id = :alightStop
      JOIN stop bs ON bs.stop_id = bss.stop_id
      JOIN stop als ON als.stop_id = ass.stop_id
      LEFT JOIN vehicle_assign va
             ON va.sched_id = s.sched_id
            AND va.assign_id = (SELECT MIN(va2.assign_id) FROM vehicle_assign va2 WHERE va2.sched_id = s.sched_id)
      LEFT JOIN vehicle v ON v.veh_id = va.veh_id
      LEFT JOIN vehicle_type vt ON vt.vtype_id = v.vtype_id
     WHERE s.service_date = TO_DATE(:serviceDate, 'YYYY-MM-DD')
       AND s.is_active = 1
       AND bss.arrive_at - SYSTIMESTAMP >= INTERVAL '20' MINUTE
       AND ass.stop_seq > bss.stop_seq
       AND NVL(vt.capacity, 0) - (SELECT NVL(SUM(bk.seats), 0) FROM booking bk
                                   WHERE bk.sched_id = s.sched_id AND bk.status = 'reserved') > 0
     ORDER BY s.depart_at, s.sched_id`;
  const result = await query(sql, { boardStop: boardStopId, alightStop: alightStopId, serviceDate });
  return result.rows || [];
}

// BR-11 pre-check: คู่ (board_seq, alight_seq) ของทุกรอบในวันนั้น — ถ้าทุกคู่กลับด้าน → 400 STOP_ORDER_INVALID
async function findStopPairSeqs({ boardStopId, alightStopId, serviceDate }) {
  const sql = `
    SELECT bss.stop_seq AS board_seq, ass.stop_seq AS alight_seq
      FROM schedule s
      JOIN schedule_stop bss ON bss.sched_id = s.sched_id AND bss.stop_id = :boardStop
      JOIN schedule_stop ass ON ass.sched_id = s.sched_id AND ass.stop_id = :alightStop
     WHERE s.service_date = TO_DATE(:serviceDate, 'YYYY-MM-DD')`;
  const result = await query(sql, { boardStop: boardStopId, alightStop: alightStopId, serviceDate });
  return result.rows || [];
}

// ------------------------------ UC-18: POST /booking ------------------------------
// pre-tx: รอบ + จุดขึ้น/ลง (LEFT JOIN → แยก 404 "รอบไม่มี" ออกจาก 422 "จุดจอดไม่อยู่ในรอบ")
async function findBookingContext({ schedId, boardStopId, alightStopId }) {
  const sql = `
    SELECT s.sched_id, s.is_active, s.depart_at,
           bss.stop_seq AS board_seq, ass.stop_seq AS alight_seq, bss.arrive_at AS board_arrive_at
      FROM schedule s
      LEFT JOIN schedule_stop bss ON bss.sched_id = s.sched_id AND bss.stop_id = :boardStop
      LEFT JOIN schedule_stop ass ON ass.sched_id = s.sched_id AND ass.stop_id = :alightStop
     WHERE s.sched_id = :schedId`;
  const result = await query(sql, { schedId, boardStop: boardStopId, alightStop: alightStopId });
  return result.rows[0] || null;
}

// TX step 1: ล็อกแถวรอบแบบ NOWAIT — มีคนจองพร้อมกัน → ORA-00054 ทันที ไม่ค้าง (UC-18 5a → 409)
async function lockSchedule(conn, schedId) {
  const result = await conn.execute(
    `SELECT sched_id FROM schedule WHERE sched_id = :schedId FOR UPDATE NOWAIT`,
    { schedId },
  );
  return (result.rows && result.rows[0]) || null;
}

// TX step 2: BR-07 — นับหลังล็อกแล้วเท่านั้น · aggregate ห้ามมี FOR UPDATE (ORA-02014)
//   · NVL ทั้ง capacity (ยังไม่มีรถ) และ SUM (ไม่มีแถว) — Oracle คืน NULL ไม่ใช่ 0
async function seatSummary(conn, schedId) {
  const result = await conn.execute(
    `SELECT NVL(vt.capacity, 0) AS capacity,
            (SELECT NVL(SUM(b.seats), 0) FROM booking b
              WHERE b.sched_id = s.sched_id AND b.status = 'reserved') AS reserved
       FROM schedule s
       LEFT JOIN vehicle_assign va
              ON va.sched_id = s.sched_id
             AND va.assign_id = (SELECT MIN(va2.assign_id) FROM vehicle_assign va2 WHERE va2.sched_id = s.sched_id)
       LEFT JOIN vehicle v ON v.veh_id = va.veh_id
       LEFT JOIN vehicle_type vt ON vt.vtype_id = v.vtype_id
      WHERE s.sched_id = :schedId`,
    { schedId },
  );
  const row = (result.rows && result.rows[0]) || null;
  if (!row) return null;
  return { CAPACITY: Number(row.CAPACITY || 0), RESERVED: Number(row.RESERVED || 0) };
}

// TX step 3: INSERT — booking_code มาจาก sequence ใน SQL · qr_token รับจาก service (สุ่มแล้ว)
async function insertBooking(conn, { custId, schedId, boardStopId, alightStopId, seats, qrToken }) {
  const result = await conn.execute(
    `INSERT INTO booking
       (booking_code, cust_id, sched_id, board_stop_id, alight_stop_id, seats, status, qr_token)
     VALUES ('BK' || seq_booking_code.NEXTVAL, :custId, :schedId, :boardStopId, :alightStopId,
             :seats, 'reserved', :qrToken)
     RETURNING booking_id INTO :newId`,
    {
      custId,
      schedId,
      boardStopId,
      alightStopId,
      seats,
      qrToken,
      newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    },
  );
  const out = result.outBinds && (result.outBinds.newId || result.outBinds[0]);
  return Array.isArray(out) ? out[0] : out;
}

// ------------------------------ UC-18 / UC-20 / UC-21: อ่านรายละเอียดการจอง ------------------------------
// ใช้หลัง commit (ตอบ POST/cancel) และตอน GET /booking/{id}/qr — join ชื่อผู้จอง + จุดจอด + เส้นทาง + รถ + คนขับ
async function findDetails(bookingId) {
  const sql = `
    SELECT b.booking_id, b.booking_code, b.cust_id,
           c.first_name || ' ' || c.last_name AS cust_name,
           b.sched_id,
           b.board_stop_id, bs.stop_name AS board_stop_name,
           b.alight_stop_id, als.stop_name AS alight_stop_name,
           b.seats, b.status, b.book_time, b.cancel_time, b.qr_token,
           s.depart_at, s.service_date, r.route_name, v.plate_no,
           d.first_name || ' ' || d.last_name AS driver_name
      FROM booking b
      JOIN employee c ON c.emp_id = b.cust_id
      JOIN stop bs ON bs.stop_id = b.board_stop_id
      JOIN stop als ON als.stop_id = b.alight_stop_id
      JOIN schedule s ON s.sched_id = b.sched_id
      JOIN route r ON r.route_id = s.route_id
      LEFT JOIN vehicle_assign va
             ON va.sched_id = s.sched_id
            AND va.assign_id = (SELECT MIN(va2.assign_id) FROM vehicle_assign va2 WHERE va2.sched_id = s.sched_id)
      LEFT JOIN vehicle v ON v.veh_id = va.veh_id
      LEFT JOIN driver_assign da
             ON da.sched_id = s.sched_id
            AND da.assign_id = (SELECT MIN(da2.assign_id) FROM driver_assign da2 WHERE da2.sched_id = s.sched_id)
      LEFT JOIN employee d ON d.emp_id = da.emp_id
     WHERE b.booking_id = :bookingId`;
  const result = await query(sql, { bookingId });
  return result.rows[0] || null;
}

// ------------------------------ UC-19: GET /booking/me ------------------------------
// WHERE กลาง — cust_id จาก JWT เสมอ · status กรอง 4 แบบ (upcoming เริ่มจาก reserved + วันยังไม่ผ่าน)
function mineWhere(status) {
  if (status === 'completed') return `b.status = 'completed'`;
  if (status === 'cancelled') return `b.status = 'cancelled'`;
  if (status === 'upcoming') {
    return `b.status = 'reserved' AND s.service_date >= TRUNC(SYSDATE)`;
  }
  return `1 = 1`; // 'all'
}

const MINE_FROM = `
    FROM booking b
    JOIN schedule s ON s.sched_id = b.sched_id
    JOIN employee c ON c.emp_id = b.cust_id
    JOIN stop bs ON bs.stop_id = b.board_stop_id
    JOIN stop als ON als.stop_id = b.alight_stop_id
    JOIN route r ON r.route_id = s.route_id
    LEFT JOIN vehicle_assign va
           ON va.sched_id = s.sched_id
          AND va.assign_id = (SELECT MIN(va2.assign_id) FROM vehicle_assign va2 WHERE va2.sched_id = s.sched_id)
    LEFT JOIN vehicle v ON v.veh_id = va.veh_id
    LEFT JOIN driver_assign da
           ON da.sched_id = s.sched_id
          AND da.assign_id = (SELECT MIN(da2.assign_id) FROM driver_assign da2 WHERE da2.sched_id = s.sched_id)
    LEFT JOIN employee d ON d.emp_id = da.emp_id`;

async function listMine({ custId, status, limit, offset }) {
  const sql = `
    SELECT b.booking_id, b.booking_code, b.cust_id,
           c.first_name || ' ' || c.last_name AS cust_name,
           b.sched_id, b.board_stop_id, bs.stop_name AS board_stop_name,
           b.alight_stop_id, als.stop_name AS alight_stop_name,
           b.seats, b.status, b.book_time, b.cancel_time,
           s.service_date, s.depart_at, r.route_name, v.plate_no,
           d.first_name || ' ' || d.last_name AS driver_name
    ${MINE_FROM}
     WHERE b.cust_id = :custId
       AND ${mineWhere(status)}
     ORDER BY s.depart_at, b.booking_id
     OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
  const result = await query(sql, { custId, limit, offset });
  return result.rows || [];
}

async function countMine({ custId, status }) {
  const sql = `
    SELECT COUNT(*) AS total
    ${MINE_FROM}
     WHERE b.cust_id = :custId
       AND ${mineWhere(status)}`;
  const result = await query(sql, { custId });
  const row = (result.rows && result.rows[0]) || {};
  return Number(row.TOTAL ?? row.total ?? 0);
}

// ------------------------------ UC-21: POST /booking/{id}/cancel ------------------------------
// TX step 1: ล็อกแถวการจองแบบ blocking FOR UPDATE (ตาม openapi x-transaction — ไม่ใช่ NOWAIT)
//   · scalar subquery เอาเวลาถึงจุดขึ้นมาตรวจ BR-08/ASM-07-2 (20 นาที) โดยไม่ lock ตารางอื่น
async function lockBooking(conn, bookingId) {
  const result = await conn.execute(
    `SELECT b.booking_id, b.cust_id, b.status, b.sched_id, b.seats,
            (SELECT sst.arrive_at FROM schedule_stop sst
              WHERE sst.sched_id = b.sched_id AND sst.stop_id = b.board_stop_id) AS board_arrive_at
       FROM booking b
      WHERE b.booking_id = :bookingId
        FOR UPDATE`,
    { bookingId },
  );
  return (result.rows && result.rows[0]) || null;
}

// TX step 2: BR-08 — คืนที่นั่งทันทีด้วยการตัด status (SUM นับเฉพาะ 'reserved' อยู่แล้ว ไม่ต้องแก้คอลัมน์ที่นั่ง)
async function cancelBooking(conn, bookingId) {
  return conn.execute(
    `UPDATE booking
        SET status = 'cancelled', cancel_time = SYSTIMESTAMP
      WHERE booking_id = :bookingId`,
    { bookingId },
  );
}

module.exports = {
  findAvailable,
  findStopPairSeqs,
  findBookingContext,
  lockSchedule,
  seatSummary,
  insertBooking,
  findDetails,
  listMine,
  countMine,
  lockBooking,
  cancelBooking,
};
