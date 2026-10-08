// src/repositories/position.repository.js — T-016: queries สำหรับตารางตำแหน่งงาน
// กฎ: bind variables เสมอ, ไม่ใช้ SELECT *, ค้นด้วย LIKE ต้องมี ESCAPE
const oracledb = require('oracledb');
const { query } = require('../config/db');

function likeValue(q) {
  return `%${String(q).replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

async function list({ q, limit, offset } = {}) {
  const where = q ? ' WHERE position_name LIKE :q ESCAPE \'\\\'' : '';
  const binds = { offset, limit };
  if (q) binds.q = likeValue(q);
  const sql = `
    SELECT position_id, position_name
      FROM job_position${where}
     ORDER BY position_id
     OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
  const result = await query(sql, binds);
  return result.rows || [];
}

async function count({ q } = {}) {
  const where = q ? ' WHERE position_name LIKE :q ESCAPE \'\\\'' : '';
  const binds = {};
  if (q) binds.q = likeValue(q);
  const result = await query(`SELECT COUNT(*) AS total FROM job_position${where}`, binds);
  return Number((result.rows && result.rows[0] && result.rows[0].TOTAL) || 0);
}

async function findById(positionId) {
  const result = await query('SELECT position_id, position_name FROM job_position WHERE position_id = :positionId', {
    positionId,
  });
  return result.rows[0] || null;
}

async function findByName(positionName, excludePositionId = null) {
  const sql = `SELECT position_id, position_name FROM job_position
                WHERE position_name = :positionName${
                  excludePositionId != null ? ' AND position_id <> :excludePositionId' : ''
                }`;
  const binds = excludePositionId != null ? { positionName, excludePositionId } : { positionName };
  const result = await query(sql, binds);
  return result.rows[0] || null;
}

async function insert(conn, { positionName }) {
  const result = await conn.execute(
    'INSERT INTO job_position (position_name) VALUES (:positionName) RETURNING position_id INTO :newId',
    { positionName, newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
  );
  const out = result.outBinds && (result.outBinds.newId || result.outBinds[0]);
  return Array.isArray(out) ? out[0] : out;
}

async function update(conn, { positionId, positionName }) {
  const result = await conn.execute(
    'UPDATE job_position SET position_name = :positionName WHERE position_id = :positionId',
    { positionId, positionName },
  );
  return result.rowsAffected || 0;
}

async function remove(conn, { positionId }) {
  const result = await conn.execute('DELETE FROM job_position WHERE position_id = :positionId', { positionId });
  return result.rowsAffected || 0;
}

module.exports = { list, count, findById, findByName, insert, update, remove };
