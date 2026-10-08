// src/repositories/schedule.repository.js — T-030/T-031/T-032: schedule, schedule_stop,
//   driver_assign, vehicle_assign (UC-14…UC-16)
// กฎ: bind variables เสมอ, ไม่ใช้ SELECT * · BR-02 ใช้ depart_at + NUMTODSINTERVAL(offset,'MINUTE')
//     · BR-04 conflict query อ่านช่วงเวลาของรอบอื่นที่คนขับ/รถคนเดิมถูกมอบหมาย
//     · TX assign: ล็อก schedule (FOR UPDATE) ก่อนเสมอ → แล้วค่อยล็อก employee/vehicle
//       (กัน deadlock · ห้าม FOR UPDATE กับ aggregate — ORA-02014, ch.17 UC-18)
const oracledb = require('oracledb');
const { query } = require('../config/db');

// คอลัมน์ของ Schedule — driver = คนแรกที่มอบหมาย (MIN assign_id) · 1 รอบมี 1 รถ (UC-16)
const SCHEDULE_SELECT = `
  SELECT s.sched_id, s.route_id, r.route_name, s.service_date, s.depart_at, s.is_active,
         r.total_minutes,
         (SELECT COUNT(*) FROM schedule_stop ss WHERE ss.sched_id = s.sched_id) AS stop_count,
         de.emp_id AS driver_emp_id, de.first_name AS driver_first_name, de.last_name AS driver_last_name,
         v.veh_id, v.plate_no, vt.vtype_name, vt.capacity,
         (SELECT NVL(SUM(b.seats), 0) FROM booking b
           WHERE b.sched_id = s.sched_id AND b.status = 'reserved') AS seats_reserved
    FROM schedule s
    JOIN route r ON r.route_id = s.route_id
    LEFT JOIN driver_assign da
           ON da.sched_id = s.sched_id
          AND da.assign_id = (SELECT MIN(da2.assign_id) FROM driver_assign da2 WHERE da2.sched_id = s.sched_id)
    LEFT JOIN employee de ON de.emp_id = da.emp_id
    LEFT JOIN vehicle_assign va
           ON va.sched_id = s.sched_id
          AND va.assign_id = (SELECT MIN(va2.assign_id) FROM vehicle_assign va2 WHERE va2.sched_id = s.sched_id)
    LEFT JOIN vehicle v ON v.veh_id = va.veh_id
    LEFT JOIN vehicle_type vt ON vt.vtype_id = v.vtype_id`;

// WHERE ที่ใช้ร่วมกันของ list/count — ทุกค่าเป็น bind (TO_DATE ชัดเจน ไม่พึ่ง NLS_DATE_FORMAT)
function buildWhere({ routeId, from, to, isActive } = {}) {
  const parts = [];
  const binds = {};
  if (routeId !== undefined && routeId !== null) {
    parts.push('s.route_id = :routeId');
    binds.routeId = routeId;
  }
  if (from) {
    parts.push("s.service_date >= TO_DATE(:fromDate, 'YYYY-MM-DD')");
    binds.fromDate = from;
  }
  if (to) {
    parts.push("s.service_date <= TO_DATE(:toDate, 'YYYY-MM-DD')");
    binds.toDate = to;
  }
  if (isActive === 0 || isActive === 1) {
    parts.push('s.is_active = :isActive');
    binds.isActive = isActive;
  }
  return { where: parts.length ? `WHERE ${parts.join(' AND ')}` : '', binds };
}

async function list({ routeId, from, to, isActive, limit, offset } = {}) {
  const { where, binds } = buildWhere({ routeId, from, to, isActive });
  const sql = `${SCHEDULE_SELECT}
    ${where}
   ORDER BY s.service_date, s.depart_at, s.sched_id
   OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
  const result = await query(sql, { ...binds, offset, limit });
  return result.rows || [];
}

async function count(filters = {}) {
  const { where, binds } = buildWhere(filters);
  const result = await query(`SELECT COUNT(*) AS total FROM schedule s${where}`, binds);
  return Number((result.rows && result.rows[0] && result.rows[0].TOTAL) || 0);
}

async function findById(schedId) {
  const result = await query(`${SCHEDULE_SELECT} WHERE s.sched_id = :schedId`, { schedId });
  return result.rows[0] || null;
}

// ตารางเวลาถึงจุดจอดของรอบ (BR-02) — arrive_at ถูกสร้างตอน POST /schedules
async function findStops(schedId) {
  const sql = `
    SELECT ss.sched_stop_id, ss.sched_id, ss.stop_id, ss.stop_seq, ss.arrive_at, ss.dwell_minutes, s.stop_name
      FROM schedule_stop ss
      JOIN stop s ON s.stop_id = ss.stop_id
     WHERE ss.sched_id = :schedId
     ORDER BY ss.stop_seq`;
  const result = await query(sql, { schedId });
  return result.rows || [];
}

// ตรวจอ Unique (route_id, depart_at) ก่อน insert — uq_route_depart → 409
async function findDuplicate(routeId, departAt) {
  const result = await query('SELECT sched_id FROM schedule WHERE route_id = :routeId AND depart_at = :departAt', {
    routeId,
    departAt,
  });
  return result.rows[0] || null;
}

async function countBookings(schedId) {
  const result = await query('SELECT COUNT(*) AS total FROM booking WHERE sched_id = :schedId', { schedId });
  return Number((result.rows && result.rows[0] && result.rows[0].TOTAL) || 0);
}

async function countDriverAssigns(schedId) {
  const result = await query('SELECT COUNT(*) AS total FROM driver_assign WHERE sched_id = :schedId', { schedId });
  return Number((result.rows && result.rows[0] && result.rows[0].TOTAL) || 0);
}

async function countVehicleAssigns(schedId) {
  const result = await query('SELECT COUNT(*) AS total FROM vehicle_assign WHERE sched_id = :schedId', { schedId });
  return Number((result.rows && result.rows[0] && result.rows[0].TOTAL) || 0);
}

// ---- TX: POST /schedules (T-030) ----

async function insert(conn, { routeId, serviceDate, departAt, isActive }) {
  const result = await conn.execute(
    `INSERT INTO schedule (route_id, service_date, depart_at, is_active)
     VALUES (:routeId, TO_DATE(:serviceDate, 'YYYY-MM-DD'), :departAt, :isActive)
     RETURNING sched_id INTO :newId`,
    {
      routeId,
      serviceDate,
      departAt,
      isActive,
      newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    },
  );
  const out = result.outBinds && (result.outBinds.newId || result.outBinds[0]);
  return Array.isArray(out) ? out[0] : out;
}

// BR-02: arrive_at = depart_at + ผลรวมนาทีถึงจุดนี้ (offsetMin) — ตามสูตรใน ch.17/01_schema
async function insertStop(conn, { schedId, stopId, stopSeq, departAt, offsetMin }) {
  const result = await conn.execute(
    `INSERT INTO schedule_stop (sched_id, stop_id, stop_seq, arrive_at, dwell_minutes)
     VALUES (:schedId, :stopId, :stopSeq, :departAt + NUMTODSINTERVAL(:offsetMin, 'MINUTE'), 0)`,
    { schedId, stopId, stopSeq, departAt, offsetMin },
  );
  return result.rowsAffected || 0;
}

async function deleteById(conn, schedId) {
  const result = await conn.execute('DELETE FROM schedule WHERE sched_id = :schedId', { schedId });
  return result.rowsAffected || 0;
}

// ---- TX: assign (T-031/T-032) — FOR UPDATE บน schedule row ก่อน (ไม่ใช่ aggregate) ----

async function lockSchedule(conn, schedId) {
  const result = await conn.execute(
    `SELECT sched_id, route_id, service_date, depart_at, is_active
       FROM schedule
      WHERE sched_id = :schedId
      FOR UPDATE`,
    { schedId },
  );
  return (result.rows && result.rows[0]) || null;
}

// ล็อกแถว employee ด้วย — serialize การมอบหมายคนขับคนเดียวกัน 2 TX พร้อมกัน
async function lockEmployee(conn, empId) {
  const result = await conn.execute(
    `SELECT emp_id, first_name, last_name
       FROM employee
      WHERE emp_id = :empId
      FOR UPDATE`,
    { empId },
  );
  return (result.rows && result.rows[0]) || null;
}

// UC-15: ต้องมี Role = DRIVER — ตรวจจาก employee_role + app_role (dynamic ไม่ hardcode role)
async function isDriver(conn, empId) {
  const result = await conn.execute(
    `SELECT COUNT(*) AS total
       FROM employee_role er
       JOIN app_role ar ON ar.role_id = er.role_id
      WHERE er.emp_id = :empId AND ar.role_name = :roleName`,
    { empId, roleName: 'DRIVER' },
  );
  return Number((result.rows && result.rows[0] && result.rows[0].TOTAL) || 0) > 0;
}

// BR-04: ช่วงเวลาของรอบอื่นที่คนขับ/รถคนเดิมถูกมอบหมายอยู่ (ASM-07-1 เทียบ overlap จริง)
async function findDriverConflicts(conn, empId, excludeSchedId) {
  const result = await conn.execute(
    `SELECT s.sched_id, s.service_date, s.depart_at, r.total_minutes
       FROM driver_assign da
       JOIN schedule s ON s.sched_id = da.sched_id
       JOIN route r ON r.route_id = s.route_id
      WHERE da.emp_id = :empId
        AND da.sched_id <> :excludeSchedId`,
    { empId, excludeSchedId },
  );
  return result.rows || [];
}

async function findVehicleConflicts(conn, vehId, excludeSchedId) {
  const result = await conn.execute(
    `SELECT s.sched_id, s.service_date, s.depart_at, r.total_minutes
       FROM vehicle_assign va
       JOIN schedule s ON s.sched_id = va.sched_id
       JOIN route r ON r.route_id = s.route_id
      WHERE va.veh_id = :vehId
        AND va.sched_id <> :excludeSchedId`,
    { vehId, excludeSchedId },
  );
  return result.rows || [];
}

// uq_driver_sched / uq_vehicle_sched — รอบนี้มีคนขับ/รถคนนี้แล้วหรือไม่ (409 ก่อนชน unique)
async function countDriverAssignment(conn, schedId, empId) {
  const result = await conn.execute(
    'SELECT COUNT(*) AS total FROM driver_assign WHERE sched_id = :schedId AND emp_id = :empId',
    { schedId, empId },
  );
  return Number((result.rows && result.rows[0] && result.rows[0].TOTAL) || 0) > 0;
}

async function countVehicleAssignment(conn, schedId) {
  const result = await conn.execute(
    'SELECT COUNT(*) AS total FROM vehicle_assign WHERE sched_id = :schedId',
    { schedId },
  );
  return Number((result.rows && result.rows[0] && result.rows[0].TOTAL) || 0) > 0;
}

async function insertDriverAssign(conn, { schedId, empId }) {
  const result = await conn.execute(
    `INSERT INTO driver_assign (sched_id, emp_id)
     VALUES (:schedId, :empId)
     RETURNING assign_id INTO :newId`,
    { schedId, empId, newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
  );
  const out = result.outBinds && (result.outBinds.newId || result.outBinds[0]);
  return Array.isArray(out) ? out[0] : out;
}

async function insertVehicleAssign(conn, { schedId, vehId }) {
  const result = await conn.execute(
    `INSERT INTO vehicle_assign (sched_id, veh_id)
     VALUES (:schedId, :vehId)
     RETURNING assign_id INTO :newId`,
    { schedId, vehId, newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
  );
  const out = result.outBinds && (result.outBinds.newId || result.outBinds[0]);
  return Array.isArray(out) ? out[0] : out;
}

async function deleteDriverAssigns(conn, schedId) {
  const result = await conn.execute('DELETE FROM driver_assign WHERE sched_id = :schedId', { schedId });
  return result.rowsAffected || 0;
}

async function deleteVehicleAssigns(conn, schedId) {
  const result = await conn.execute('DELETE FROM vehicle_assign WHERE sched_id = :schedId', { schedId });
  return result.rowsAffected || 0;
}

module.exports = {
  list,
  count,
  findById,
  findStops,
  findDuplicate,
  countBookings,
  countDriverAssigns,
  countVehicleAssigns,
  insert,
  insertStop,
  deleteById,
  lockSchedule,
  lockEmployee,
  isDriver,
  findDriverConflicts,
  findVehicleConflicts,
  countDriverAssignment,
  countVehicleAssignment,
  insertDriverAssign,
  insertVehicleAssign,
  deleteDriverAssigns,
  deleteVehicleAssigns,
};
