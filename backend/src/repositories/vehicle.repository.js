// src/repositories/vehicle.repository.js — T-029: queries สำหรับ vehicle + vehicle_type (UC-13)
// กฎ: bind variables เสมอ, ไม่ใช้ SELECT * · join vehicle_type มาแสดง vtype_name/capacity
//     (17.5.2 ไม่มี CRUD ของ vehicle_type → อ่านผ่าน join ของ /vehicles เท่านั้น)
const oracledb = require('oracledb');
const { query } = require('../config/db');

function columns(prefix = 'v.') {
  return `${prefix}veh_id, ${prefix}plate_no, ${prefix}vtype_id, ${prefix}is_active, vt.vtype_name, vt.capacity`;
}

async function list({ isActive, vtypeId, limit, offset } = {}) {
  const where = [];
  const binds = { offset, limit };
  if (isActive === 0 || isActive === 1) {
    where.push('v.is_active = :isActive');
    binds.isActive = isActive;
  }
  if (vtypeId !== undefined && vtypeId !== null) {
    where.push('v.vtype_id = :vtypeId');
    binds.vtypeId = vtypeId;
  }
  const sql = `
    SELECT ${columns()}
      FROM vehicle v
      JOIN vehicle_type vt ON vt.vtype_id = v.vtype_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY v.veh_id
     OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
  const result = await query(sql, binds);
  return result.rows || [];
}

async function count({ isActive, vtypeId } = {}) {
  const where = [];
  const binds = {};
  if (isActive === 0 || isActive === 1) {
    where.push('is_active = :isActive');
    binds.isActive = isActive;
  }
  if (vtypeId !== undefined && vtypeId !== null) {
    where.push('vtype_id = :vtypeId');
    binds.vtypeId = vtypeId;
  }
  const result = await query(
    `SELECT COUNT(*) AS total FROM vehicle${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`,
    binds,
  );
  return Number((result.rows && result.rows[0] && result.rows[0].TOTAL) || 0);
}

async function findById(vehId) {
  const sql = `
    SELECT ${columns()}
      FROM vehicle v
      JOIN vehicle_type vt ON vt.vtype_id = v.vtype_id
     WHERE v.veh_id = :vehId`;
  const result = await query(sql, { vehId });
  return result.rows[0] || null;
}

// ตรวจ uq_vehicle_plate ก่อน insert (409) — ค่าเป็น bind ไม่ใช่ interpolation
async function findByPlate(plateNo) {
  const result = await query('SELECT veh_id FROM vehicle WHERE plate_no = :plateNo', { plateNo });
  return result.rows[0] || null;
}

async function findVtype(vtypeId) {
  const result = await query('SELECT vtype_id, vtype_name, capacity FROM vehicle_type WHERE vtype_id = :vtypeId', {
    vtypeId,
  });
  return result.rows[0] || null;
}

async function insert(conn, { plateNo, vtypeId, isActive }) {
  const result = await conn.execute(
    `INSERT INTO vehicle (plate_no, vtype_id, is_active)
     VALUES (:plateNo, :vtypeId, :isActive)
     RETURNING veh_id INTO :newId`,
    { plateNo, vtypeId, isActive, newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
  );
  const out = result.outBinds && (result.outBinds.newId || result.outBinds[0]);
  return Array.isArray(out) ? out[0] : out;
}

// ---- UC-16: ล็อกแถวรถตอนมอบหมาย (TX แรก = schedule → แล้วค่อยรถ กัน deadlock) ----
// คืน vehicle row + is_active (ให้ service ตอบ 422 VEHICLE_INACTIVE) / null = ไม่พบ (404)
async function lockById(conn, vehId) {
  const result = await conn.execute(
    'SELECT veh_id, plate_no, vtype_id, is_active FROM vehicle WHERE veh_id = :vehId FOR UPDATE',
    { vehId },
  );
  return (result.rows && result.rows[0]) || null;
}

module.exports = { list, count, findById, findByPlate, findVtype, insert, lockById };
