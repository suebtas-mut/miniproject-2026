// src/repositories/route.repository.js — T-025/T-026/T-027: queries สำหรับ route + route_stop (UC-12)
// กฎ: bind variables เสมอ, ไม่ใช้ SELECT *, total_minutes คำนวณจาก route_stop เท่านั้น (BR-01)
//     - insert ไม่รับ total_minutes จากผู้ใช้ (column list ไม่มี → DEFAULT 0)
//     - saveStops = DELETE เดิม + INSERT ใหม่ + UPDATE total ใน transaction เดียว (OpenAPI x-transaction)
//     - recalculateTotal = UPDATE 1 _statement (correlated SUM) — ไม่ต้องเปิด transaction (OpenAPI ระบุ)
const oracledb = require('oracledb');
const { query } = require('../config/db');

const ROUTE_COLUMNS = 'r.route_id, r.route_name, r.total_minutes, r.description, r.is_active';

const SELECT_ROUTES = `
  SELECT ${ROUTE_COLUMNS},
         (SELECT COUNT(*) FROM route_stop rs WHERE rs.route_id = r.route_id) AS stop_count
    FROM route r
    {where}
   ORDER BY r.route_id
   OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;

const SELECT_ROUTE_BY_ID = `
  SELECT route_id, route_name, total_minutes, description, is_active
    FROM route
   WHERE route_id = :routeId`;

async function list({ isActive, limit, offset } = {}) {
  const where = isActive === 0 || isActive === 1 ? ' WHERE r.is_active = :isActive' : '';
  const binds = { offset, limit };
  if (where) binds.isActive = isActive;
  const result = await query(SELECT_ROUTES.replace('{where}', where), binds);
  return result.rows || [];
}

async function count({ isActive } = {}) {
  const where = isActive === 0 || isActive === 1 ? ' WHERE is_active = :isActive' : '';
  const binds = {};
  if (where) binds.isActive = isActive;
  const result = await query(`SELECT COUNT(*) AS total FROM route${where}`, binds);
  return Number((result.rows && result.rows[0] && result.rows[0].TOTAL) || 0);
}

async function findById(routeId) {
  const result = await query(SELECT_ROUTE_BY_ID, { routeId });
  return result.rows[0] || null;
}

async function insert(conn, { routeName, description, isActive }) {
  // ไม่ใส่ total_minutes — BR-01: service เป็นคนคำนวณจาก route_stop เท่านั้น
  const result = await conn.execute(
    `INSERT INTO route (route_name, description, is_active)
     VALUES (:routeName, :description, :isActive)
     RETURNING route_id INTO :newId`,
    { routeName, description, isActive, newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
  );
  const out = result.outBinds && (result.outBinds.newId || result.outBinds[0]);
  return Array.isArray(out) ? out[0] : out;
}

// จุดจอดในเส้นทาง เรียงตาม stop_seq + join stop_name มาแสดงผล
async function listStops(routeId) {
  const sql = `
    SELECT rs.route_id, rs.stop_id, rs.stop_seq, rs.travel_minutes, s.stop_name
      FROM route_stop rs
      JOIN stop s ON s.stop_id = rs.stop_id
     WHERE rs.route_id = :routeId
     ORDER BY rs.stop_seq`;
  const result = await query(sql, { routeId });
  return result.rows || [];
}

async function countStops(routeId) {
  const result = await query('SELECT COUNT(*) AS total FROM route_stop WHERE route_id = :routeId', { routeId });
  return Number((result.rows && result.rows[0] && result.rows[0].TOTAL) || 0);
}

// ---- รายการขาเข้าของ PUT /routes/:id/stops (ทั้งหมดใน transaction เดียว) ----

async function deleteAllStops(conn, routeId) {
  const result = await conn.execute('DELETE FROM route_stop WHERE route_id = :routeId', { routeId });
  return result.rowsAffected || 0;
}

async function insertStop(conn, { routeId, stopId, stopSeq, travelMinutes }) {
  const result = await conn.execute(
    `INSERT INTO route_stop (route_id, stop_id, stop_seq, travel_minutes)
     VALUES (:routeId, :stopId, :stopSeq, :travelMinutes)`,
    { routeId, stopId, stopSeq, travelMinutes },
  );
  return result.rowsAffected || 0;
}

async function updateTotalMinutes(conn, { routeId, totalMinutes }) {
  const result = await conn.execute(
    'UPDATE route SET total_minutes = :totalMinutes WHERE route_id = :routeId',
    { routeId, totalMinutes },
  );
  return result.rowsAffected || 0;
}

// ---- POST /routes/:id/recalculate — 1 statement, correlated subquery ตาม BR-01 ----
// OpenAPI: "1 statement จึงไม่ต้องเปิด Transaction แยก" → autoCommit:true ในตัวเอง
// (project default คือ autoCommit:false — ถ้าไม่ระบุ UPDATE จะถูก rollback ตอน conn.close())

async function recalculateTotal(routeId) {
  const result = await query(
    `UPDATE route
        SET total_minutes = (SELECT NVL(SUM(travel_minutes), 0)
                               FROM route_stop
                              WHERE route_id = :routeId)
      WHERE route_id = :routeId
      RETURNING total_minutes INTO :newTotal`,
    { routeId, newTotal: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
    { autoCommit: true },
  );
  const out = result.outBinds && (result.outBinds.newTotal || result.outBinds[0]);
  const total = Array.isArray(out) ? out[0] : out;
  return Number(total || 0);
}

module.exports = {
  list,
  count,
  findById,
  insert,
  listStops,
  countStops,
  deleteAllStops,
  insertStop,
  updateTotalMinutes,
  recalculateTotal,
};
