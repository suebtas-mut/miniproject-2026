// src/repositories/role.repository.js — T-019/T-021: queries สำหรับ app_role + role_permission + employee_role
// กฎ: bind variables เสมอ, ไม่ใช้ SELECT *, ไม่ hardcode ชื่อบทบาทใน SQL (P-12)
//     role_permission: DELETE ที่ถอดออก + MERGE สิทธิ์ใหม่ ใน transaction เดียว (OpenAPI x-transaction)
const oracledb = require('oracledb');
const { query } = require('../config/db');

// granted_perm_ids: LISTAGG จาก role_permission — UC-09 ใช้วาดตารางติ๊ก (ไม่มี GET /permission-matrix)
const SELECT_ROLES = `
  SELECT r.role_id, r.role_name, r.description, r.is_active,
         (SELECT LISTAGG(rp.perm_id, ',') WITHIN GROUP (ORDER BY rp.perm_id)
            FROM role_permission rp
           WHERE rp.role_id = r.role_id) AS granted_ids
    FROM app_role r
    {where}
   ORDER BY r.role_id
   OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;

const SELECT_ROLE_BY_ID = `
  SELECT role_id, role_name, description, is_active
    FROM app_role
   WHERE role_id = :roleId`;

async function list({ isActive, limit, offset } = {}) {
  const where =
    isActive === 0 || isActive === 1 ? ' WHERE r.is_active = :isActive' : '';
  const binds = { offset, limit };
  if (where) binds.isActive = isActive;
  const result = await query(SELECT_ROLES.replace('{where}', where), binds);
  return result.rows || [];
}

async function count({ isActive } = {}) {
  const where = isActive === 0 || isActive === 1 ? ' WHERE is_active = :isActive' : '';
  const binds = {};
  if (where) binds.isActive = isActive;
  const result = await query(`SELECT COUNT(*) AS total FROM app_role${where}`, binds);
  return Number((result.rows && result.rows[0] && result.rows[0].TOTAL) || 0);
}

async function findById(roleId) {
  const result = await query(SELECT_ROLE_BY_ID, { roleId });
  return result.rows[0] || null;
}

async function findByName(roleName, excludeRoleId = null) {
  const sql = `SELECT role_id, role_name, description, is_active
                 FROM app_role
                WHERE role_name = :roleName${excludeRoleId != null ? ' AND role_id <> :excludeRoleId' : ''}`;
  const binds = excludeRoleId != null ? { roleName, excludeRoleId } : { roleName };
  const result = await query(sql, binds);
  return result.rows[0] || null;
}

async function insert(conn, { roleName, description, isActive }) {
  const result = await conn.execute(
    `INSERT INTO app_role (role_name, description, is_active)
     VALUES (:roleName, :description, :isActive)
     RETURNING role_id INTO :newId`,
    { roleName, description, isActive, newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
  );
  const out = result.outBinds && (result.outBinds.newId || result.outBinds[0]);
  return Array.isArray(out) ? out[0] : out;
}

async function update(conn, { roleId, roleName, description, isActive }) {
  const result = await conn.execute(
    `UPDATE app_role
        SET role_name = :roleName, description = :description, is_active = :isActive
      WHERE role_id = :roleId`,
    { roleId, roleName, description, isActive },
  );
  return result.rowsAffected || 0;
}

async function remove(conn, { roleId }) {
  const result = await conn.execute('DELETE FROM app_role WHERE role_id = :roleId', { roleId });
  return result.rowsAffected || 0;
}

// UC-07: ลบได้ต่อเมื่อไม่มีพนักงานใช้บทบาทนั้น (employee_role มี ON DELETE CASCADE — ต้องตรวจก่อนเสมอ)
async function countEmployeesWithRole(roleId) {
  const result = await query('SELECT COUNT(*) AS total FROM employee_role WHERE role_id = :roleId', {
    roleId,
  });
  return Number((result.rows && result.rows[0] && result.rows[0].TOTAL) || 0);
}

// UC-09 step "DELETE สิทธิ์ที่ถอดออก" — คงเฉพาะ perm_ids ที่ติ๊ก (ว่าง = ถอดทั้งหมด)
async function deleteGrantsExcept(conn, { roleId, permIds }) {
  if (!permIds || permIds.length === 0) {
    await conn.execute('DELETE FROM role_permission WHERE role_id = :roleId', { roleId });
    return;
  }
  const binds = { roleId };
  const placeholders = permIds
    .map((permId, index) => {
      binds[`p${index}`] = permId;
      return `:p${index}`;
    })
    .join(', ');
  await conn.execute(
    `DELETE FROM role_permission
      WHERE role_id = :roleId
        AND perm_id NOT IN (${placeholders})`,
    binds,
  );
}

// UC-09 step "MERGE สิทธิ์ใหม่" — มีแล้วไม่ทำอะไร, ค่าเป็น bind ทั้งหมด
const MERGE_GRANT = `
  MERGE INTO role_permission rp
  USING (SELECT :roleId AS role_id, :permId AS perm_id FROM dual) s
     ON (rp.role_id = s.role_id AND rp.perm_id = s.perm_id)
  WHEN NOT MATCHED THEN
    INSERT (role_id, perm_id) VALUES (s.role_id, s.perm_id)`;

async function mergeGrant(conn, { roleId, permId }) {
  await conn.execute(MERGE_GRANT, { roleId, permId });
}

module.exports = {
  list,
  count,
  findById,
  findByName,
  insert,
  update,
  remove,
  countEmployeesWithRole,
  deleteGrantsExcept,
  mergeGrant,
};
