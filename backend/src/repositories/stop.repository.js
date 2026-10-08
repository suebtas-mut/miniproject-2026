// src/repositories/stop.repository.js — T-024: queries สำหรับตาราง stop (UC-11)
// กฎ: bind variables เสมอ, ไม่ใช้ SELECT *, ค้นด้วย LIKE ต้องมี ESCAPE
//     ลบได้ก็ต่อเมื่อไม่มี route_stop อ้างอยู่ (fk_rs_stop ไม่มี ON DELETE → ตรวจก่อนเสมอ)
const oracledb = require('oracledb');
const { query } = require('../config/db');

function likeValue(q) {
  return `%${String(q).replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

function buildWhere({ q, isActive } = {}) {
  const parts = [];
  const binds = {};
  if (q) {
    parts.push("stop_name LIKE :q ESCAPE '\\'");
    binds.q = likeValue(q);
  }
  if (isActive === 0 || isActive === 1) {
    parts.push('is_active = :isActive');
    binds.isActive = isActive;
  }
  return { where: parts.length ? ` WHERE ${parts.join(' AND ')}` : '', binds };
}

async function list({ q, isActive, limit, offset } = {}) {
  const { where, binds } = buildWhere({ q, isActive });
  const sql = `
    SELECT stop_id, stop_name, address, latitude, longitude, is_active
      FROM stop${where}
     ORDER BY stop_id
     OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
  const result = await query(sql, { ...binds, offset, limit });
  return result.rows || [];
}

async function count({ q, isActive } = {}) {
  const { where, binds } = buildWhere({ q, isActive });
  const result = await query(`SELECT COUNT(*) AS total FROM stop${where}`, binds);
  return Number((result.rows && result.rows[0] && result.rows[0].TOTAL) || 0);
}

async function findById(stopId) {
  const result = await query(
    'SELECT stop_id, stop_name, address, latitude, longitude, is_active FROM stop WHERE stop_id = :stopId',
    { stopId },
  );
  return result.rows[0] || null;
}

async function findByName(stopName, excludeStopId = null) {
  const sql = `SELECT stop_id, stop_name
                 FROM stop
                WHERE stop_name = :stopName${excludeStopId != null ? ' AND stop_id <> :excludeStopId' : ''}`;
  const binds = excludeStopId != null ? { stopName, excludeStopId } : { stopName };
  const result = await query(sql, binds);
  return result.rows[0] || null;
}

async function insert(conn, { stopName, address, latitude, longitude, isActive }) {
  const result = await conn.execute(
    `INSERT INTO stop (stop_name, address, latitude, longitude, is_active)
     VALUES (:stopName, :address, :latitude, :longitude, :isActive)
     RETURNING stop_id INTO :newId`,
    { stopName, address, latitude, longitude, isActive, newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
  );
  const out = result.outBinds && (result.outBinds.newId || result.outBinds[0]);
  return Array.isArray(out) ? out[0] : out;
}

async function update(conn, { stopId, stopName, address, latitude, longitude, isActive }) {
  const result = await conn.execute(
    `UPDATE stop
        SET stop_name = :stopName, address = :address, latitude = :latitude,
            longitude = :longitude, is_active = :isActive
      WHERE stop_id = :stopId`,
    { stopId, stopName, address, latitude, longitude, isActive },
  );
  return result.rowsAffected || 0;
}

async function remove(conn, { stopId }) {
  const result = await conn.execute('DELETE FROM stop WHERE stop_id = :stopId', { stopId });
  return result.rowsAffected || 0;
}

// ใช้ตรวจก่อน DELETE (schema ไม่มี ON DELETE ที่ fk_rs_stop → ให้ตอบ 422 แทน ORA-02292)
async function countRoutesUsingStop(stopId) {
  const result = await query('SELECT COUNT(*) AS total FROM route_stop WHERE stop_id = :stopId', { stopId });
  return Number((result.rows && result.rows[0] && result.rows[0].TOTAL) || 0);
}

// ตรวจว่า stop_id ทั้งหมดมีจริงก่อนเข้า transaction (คล้าย permission.findByIds)
async function findExistingIds(stopIds) {
  if (!stopIds || stopIds.length === 0) return [];
  const binds = {};
  stopIds.forEach((stopId, index) => {
    binds[`p${index}`] = stopId;
  });
  const inList = stopIds.map((_, index) => `:p${index}`).join(', ');
  const result = await query(`SELECT stop_id FROM stop WHERE stop_id IN (${inList})`, binds);
  return result.rows || [];
}

module.exports = {
  list,
  count,
  findById,
  findByName,
  insert,
  update,
  remove,
  countRoutesUsingStop,
  findExistingIds,
};
