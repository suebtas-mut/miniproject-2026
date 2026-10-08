// src/repositories/department.repository.js — T-016: queries สำหรับตารางแผนก
// กฎ: bind variables เสมอ, ไม่ใช้ SELECT *, ค้นด้วย LIKE ต้องมี ESCAPE
const oracledb = require('oracledb');
const { query } = require('../config/db');

function likeValue(q) {
  return `%${String(q).replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

async function list({ q, limit, offset } = {}) {
  const where = q ? ' WHERE dept_name LIKE :q ESCAPE \'\\\'' : '';
  const binds = { offset, limit };
  if (q) binds.q = likeValue(q);
  const sql = `
    SELECT dept_id, dept_name, created_at
      FROM department${where}
     ORDER BY dept_id
     OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
  const result = await query(sql, binds);
  return result.rows || [];
}

async function count({ q } = {}) {
  const where = q ? ' WHERE dept_name LIKE :q ESCAPE \'\\\'' : '';
  const binds = {};
  if (q) binds.q = likeValue(q);
  const result = await query(`SELECT COUNT(*) AS total FROM department${where}`, binds);
  return Number((result.rows && result.rows[0] && result.rows[0].TOTAL) || 0);
}

async function findById(deptId) {
  const result = await query('SELECT dept_id, dept_name, created_at FROM department WHERE dept_id = :deptId', {
    deptId,
  });
  return result.rows[0] || null;
}

async function findByName(deptName, excludeDeptId = null) {
  const sql = `SELECT dept_id, dept_name FROM department
                WHERE dept_name = :deptName${excludeDeptId != null ? ' AND dept_id <> :excludeDeptId' : ''}`;
  const binds = excludeDeptId != null ? { deptName, excludeDeptId } : { deptName };
  const result = await query(sql, binds);
  return result.rows[0] || null;
}

async function insert(conn, { deptName }) {
  const result = await conn.execute(
    'INSERT INTO department (dept_name) VALUES (:deptName) RETURNING dept_id INTO :newId',
    { deptName, newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
  );
  const out = result.outBinds && (result.outBinds.newId || result.outBinds[0]);
  return Array.isArray(out) ? out[0] : out;
}

async function update(conn, { deptId, deptName }) {
  const result = await conn.execute('UPDATE department SET dept_name = :deptName WHERE dept_id = :deptId', {
    deptId,
    deptName,
  });
  return result.rowsAffected || 0;
}

async function remove(conn, { deptId }) {
  const result = await conn.execute('DELETE FROM department WHERE dept_id = :deptId', { deptId });
  return result.rowsAffected || 0;
}

module.exports = { list, count, findById, findByName, insert, update, remove };
