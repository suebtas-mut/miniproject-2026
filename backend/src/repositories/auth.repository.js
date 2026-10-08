// src/repositories/auth.repository.js — T-015: queries สำหรับ login / สิทธิ์ / token blacklist
// กฎ: ใช้ bind variables เสมอ (ห้าม string interpolation), ไม่ใช้ SELECT *, ไม่ hardcode role
const { query } = require('../config/db');

const SELECT_LOGIN_USER = `
  SELECT e.emp_id, e.emp_code, e.first_name, e.last_name, e.phone, e.email,
         e.dept_id, d.dept_name, e.position_id, p.position_name,
         e.username, e.password_hash, e.is_active, e.created_at
    FROM employee e
    LEFT JOIN department d ON d.dept_id = e.dept_id
    LEFT JOIN job_position p ON p.position_id = e.position_id
   WHERE e.username = :username`;

const SELECT_CREDENTIAL_BY_ID = `
  SELECT e.emp_id, e.username, e.password_hash, e.is_active
    FROM employee e
   WHERE e.emp_id = :empId`;

// ดึงรหัสผ่านเฉพาะตอน login / change-password เท่านั้น — ห้ามเอาไปใช้ตอบ response
async function findLoginUser(username) {
  const result = await query(SELECT_LOGIN_USER, { username });
  return result.rows[0] || null;
}

async function findCredentialById(empId) {
  const result = await query(SELECT_CREDENTIAL_BY_ID, { empId });
  return result.rows[0] || null;
}

const SELECT_PERMISSIONS = `
  SELECT DISTINCT p.perm_code
    FROM employee e
    JOIN employee_role er ON er.emp_id = e.emp_id
    JOIN app_role r ON r.role_id = er.role_id
    JOIN role_permission rp ON rp.role_id = r.role_id
    JOIN permission p ON p.perm_id = rp.perm_id
   WHERE e.emp_id = :empId
     AND e.is_active = 1
     AND r.is_active = 1
   ORDER BY p.perm_code`;

async function loadPermissions(empId) {
  const result = await query(SELECT_PERMISSIONS, { empId });
  return (result.rows || []).map((row) => row.PERM_CODE);
}

const SELECT_MENUS = `
  SELECT DISTINCT p.screen_key, p.perm_name AS menu_label, p.sort_no
    FROM employee e
    JOIN employee_role er ON er.emp_id = e.emp_id
    JOIN app_role r ON r.role_id = er.role_id
    JOIN role_permission rp ON rp.role_id = r.role_id
    JOIN permission p ON p.perm_id = rp.perm_id
   WHERE e.emp_id = :empId
     AND e.is_active = 1
     AND r.is_active = 1
     AND p.screen_key IS NOT NULL
   ORDER BY p.sort_no, p.screen_key, p.perm_name`;

async function loadMenus(empId) {
  const result = await query(SELECT_MENUS, { empId });
  return (result.rows || []).map((row) => ({
    screen_key: row.SCREEN_KEY,
    menu_label: row.MENU_LABEL,
    sort_no: row.SORT_NO,
  }));
}

const SELECT_ROLES = `
  SELECT r.role_name
    FROM employee e
    JOIN employee_role er ON er.emp_id = e.emp_id
    JOIN app_role r ON r.role_id = er.role_id
   WHERE e.emp_id = :empId
     AND r.is_active = 1
   ORDER BY r.role_name`;

async function loadRoles(empId) {
  const result = await query(SELECT_ROLES, { empId });
  return (result.rows || []).map((row) => row.ROLE_NAME);
}

const SELECT_REVOKED = `
  SELECT jti, revoked_at, expires_at
    FROM token_blacklist
   WHERE jti IN (:jti, :markerJti)
     AND expires_at > SYSTIMESTAMP`;

async function findRevokedTokens(jti, markerJti) {
  const result = await query(SELECT_REVOKED, { jti, markerJti });
  return result.rows || [];
}

// MERGE = 1 statement (ตาม OpenAPI x-transaction) — commit ทันทีเมื่อไม่ได้อยู่ใน withTransaction
const MERGE_BLACKLIST = `
  MERGE INTO token_blacklist t
  USING (SELECT :jti AS jti FROM dual) s
     ON (t.jti = s.jti)
  WHEN MATCHED THEN
    UPDATE SET t.emp_id = :empId, t.expires_at = :expiresAt, t.revoked_at = SYSTIMESTAMP
  WHEN NOT MATCHED THEN
    INSERT (jti, emp_id, expires_at, revoked_at)
    VALUES (:jti, :empId, :expiresAt, SYSTIMESTAMP)`;

async function blacklistToken({ jti, empId, expiresAt }, conn = null) {
  const binds = { jti, empId, expiresAt };
  if (conn) {
    await conn.execute(MERGE_BLACKLIST, binds);
    return;
  }
  await query(MERGE_BLACKLIST, binds, { autoCommit: true });
}

const DELETE_EXPIRED = `
  DELETE FROM token_blacklist
   WHERE emp_id = :empId
     AND expires_at < SYSTIMESTAMP`;

async function deleteExpiredBlacklist(empId, conn) {
  await conn.execute(DELETE_EXPIRED, { empId });
}

module.exports = {
  findLoginUser,
  findCredentialById,
  loadPermissions,
  loadMenus,
  loadRoles,
  findRevokedTokens,
  blacklistToken,
  deleteExpiredBlacklist,
};
