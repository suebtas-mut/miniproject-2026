// src/repositories/permission.repository.js — T-020: queries สำหรับตาราง permission
// กฎ: bind variables เสมอ, ไม่ใช้ SELECT *
// หมายเหตุ: มีเฉพาะ GET/POST (openapi ไม่ประกาศ PUT/DELETE /permissions/{id} — Q24 ค้างอาจารย์)
const oracledb = require('oracledb');
const { query } = require('../config/db');

const SELECT_COLUMNS = 'perm_id, perm_code, perm_name, module, screen_key, sort_no';

// OpenAPI: "ใช้ ORDER BY module, sort_no, perm_id ให้ลำดับนิ่ง"
async function list({ module, limit, offset } = {}) {
  const where = module ? ' WHERE module = :module' : '';
  const binds = { offset, limit };
  if (module) binds.module = module;
  const result = await query(
    `SELECT ${SELECT_COLUMNS}
       FROM permission${where}
      ORDER BY module, sort_no, perm_id
      OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
    binds,
  );
  return result.rows || [];
}

async function count({ module } = {}) {
  const where = module ? ' WHERE module = :module' : '';
  const binds = {};
  if (module) binds.module = module;
  const result = await query(`SELECT COUNT(*) AS total FROM permission${where}`, binds);
  return Number((result.rows && result.rows[0] && result.rows[0].TOTAL) || 0);
}

async function findById(permId) {
  const result = await query(`SELECT ${SELECT_COLUMNS} FROM permission WHERE perm_id = :permId`, {
    permId,
  });
  return result.rows[0] || null;
}

async function findByCode(permCode, excludePermId = null) {
  const sql = `SELECT ${SELECT_COLUMNS}
                 FROM permission
                WHERE perm_code = :permCode${excludePermId != null ? ' AND perm_id <> :excludePermId' : ''}`;
  const binds = excludePermId != null ? { permCode, excludePermId } : { permCode };
  const result = await query(sql, binds);
  return result.rows[0] || null;
}

// ตรวจ perm_ids ของ permission matrix ว่ามีอยู่จริงทั้งหมด (ก่อนเข้า transaction)
async function findByIds(permIds) {
  if (!permIds || permIds.length === 0) return [];
  const binds = {};
  const placeholders = permIds
    .map((permId, index) => {
      binds[`p${index}`] = permId;
      return `:p${index}`;
    })
    .join(', ');
  const result = await query(
    `SELECT ${SELECT_COLUMNS} FROM permission WHERE perm_id IN (${placeholders})`,
    binds,
  );
  return result.rows || [];
}

async function insert(conn, { permCode, permName, module, screenKey, sortNo }) {
  const result = await conn.execute(
    `INSERT INTO permission (perm_code, perm_name, module, screen_key, sort_no)
     VALUES (:permCode, :permName, :module, :screenKey, :sortNo)
     RETURNING perm_id INTO :newId`,
    {
      permCode,
      permName,
      module,
      screenKey,
      sortNo,
      newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    },
  );
  const out = result.outBinds && (result.outBinds.newId || result.outBinds[0]);
  return Array.isArray(out) ? out[0] : out;
}

module.exports = { list, count, findById, findByCode, findByIds, insert };
