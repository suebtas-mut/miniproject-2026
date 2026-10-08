// src/repositories/employee.repository.js — T-016: queries สำหรับตารางพนักงาน
// กฎ: bind variables เสมอ, ไม่ใช้ SELECT *, ไม่ต่อค่าจาก user เข้า SQL (คอลัมน์มาจาก whitelist)
const oracledb = require('oracledb');
const { query } = require('../config/db');

const EMPLOYEE_COLUMNS = `
  e.emp_id, e.emp_code, e.first_name, e.last_name, e.phone, e.email,
  e.dept_id, d.dept_name, e.position_id, p.position_name,
  e.username, e.is_active, e.created_at`;

const EMPLOYEE_JOINS = `
  FROM employee e
  LEFT JOIN department d ON d.dept_id = e.dept_id
  LEFT JOIN job_position p ON p.position_id = e.position_id`;

const ROLES_SUBQUERY = `
  (SELECT LISTAGG(r.role_name, ',') WITHIN GROUP (ORDER BY r.role_name)
     FROM employee_role er
     JOIN app_role r ON r.role_id = er.role_id
    WHERE er.emp_id = e.emp_id) AS roles`;

async function findEmployeeById(empId) {
  const sql = `SELECT ${EMPLOYEE_COLUMNS}, ${ROLES_SUBQUERY} ${EMPLOYEE_JOINS} WHERE e.emp_id = :empId`;
  const result = await query(sql, { empId });
  return result.rows[0] || null;
}

function buildFilters({ q, deptId, isActive } = {}) {
  const clauses = [];
  const binds = {};
  if (q) {
    clauses.push(`(e.first_name LIKE :q ESCAPE '\\' OR e.last_name LIKE :q ESCAPE '\\'
              OR e.emp_code LIKE :q ESCAPE '\\' OR e.username LIKE :q ESCAPE '\\')`);
    // escape อักขระพิเศษของ LIKE ก่อนห่อ % — ค่าเป็น bind ห้ามต่อเข้า SQL
    binds.q = `%${String(q).replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
  }
  if (deptId !== undefined && deptId !== null && deptId !== '') {
    clauses.push('e.dept_id = :deptId');
    binds.deptId = deptId;
  }
  if (isActive !== undefined && isActive !== null && isActive !== '') {
    clauses.push('e.is_active = :isActive');
    binds.isActive = isActive;
  }
  return { where: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', binds };
}

async function listEmployees({ q, deptId, isActive, limit, offset } = {}) {
  const { where, binds } = buildFilters({ q, deptId, isActive });
  const sql = `
    SELECT ${EMPLOYEE_COLUMNS}, ${ROLES_SUBQUERY}
    ${EMPLOYEE_JOINS}${where}
    ORDER BY e.emp_id
    OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
  const result = await query(sql, { ...binds, offset, limit });
  return result.rows || [];
}

async function countEmployees({ q, deptId, isActive } = {}) {
  const { where, binds } = buildFilters({ q, deptId, isActive });
  const sql = `SELECT COUNT(*) AS total FROM employee e${where}`;
  const result = await query(sql, binds);
  return Number((result.rows && result.rows[0] && result.rows[0].TOTAL) || 0);
}

async function findByUsername(username, excludeEmpId = null) {
  const sql = `SELECT e.emp_id, e.username FROM employee e
                WHERE e.username = :username${excludeEmpId != null ? ' AND e.emp_id <> :excludeEmpId' : ''}`;
  const binds = excludeEmpId != null ? { username, excludeEmpId } : { username };
  const result = await query(sql, binds);
  return result.rows[0] || null;
}

async function findByEmpCode(empCode, excludeEmpId = null) {
  const sql = `SELECT e.emp_id, e.emp_code FROM employee e
                WHERE e.emp_code = :empCode${excludeEmpId != null ? ' AND e.emp_id <> :excludeEmpId' : ''}`;
  const binds = excludeEmpId != null ? { empCode, excludeEmpId } : { empCode };
  const result = await query(sql, binds);
  return result.rows[0] || null;
}

// colNames มาจาก whitelist ฝั่ง service เท่านั้น (ไม่ใช่ค่าจาก user) — ค่าเป็น bind ทั้งหมด
const INSERT_SQL = `
  INSERT INTO employee (emp_code, first_name, last_name, phone, email,
                        dept_id, position_id, username, password_hash, is_active)
  VALUES (:empCode, :firstName, :lastName, :phone, :email,
          :deptId, :positionId, :username, :passwordHash, :isActive)
  RETURNING emp_id INTO :newId`;

async function insertEmployee(conn, data) {
  const binds = {
    empCode: data.emp_code,
    firstName: data.first_name,
    lastName: data.last_name,
    phone: data.phone ?? null,
    email: data.email ?? null,
    deptId: data.dept_id ?? null,
    positionId: data.position_id ?? null,
    username: data.username,
    passwordHash: data.password_hash,
    isActive: data.is_active ?? 1,
    newId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
  };
  const result = await conn.execute(INSERT_SQL, binds);
  const out = result.outBinds && (result.outBinds.newId || result.outBinds[0]);
  return Array.isArray(out) ? out[0] : out;
}

const UPDATE_COLUMNS = {
  emp_code: 'emp_code',
  first_name: 'first_name',
  last_name: 'last_name',
  phone: 'phone',
  email: 'email',
  dept_id: 'dept_id',
  position_id: 'position_id',
  username: 'username',
  is_active: 'is_active',
};

async function updateEmployee(conn, { empId, data }) {
  const sets = [];
  const binds = { empId };
  for (const [key, colName] of Object.entries(UPDATE_COLUMNS)) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      sets.push(`${colName} = :v_${colName}`);
      binds[`v_${colName}`] = data[key];
    }
  }
  if (sets.length === 0) return 0;
  const sql = `UPDATE employee SET ${sets.join(', ')} WHERE emp_id = :empId`;
  const result = await conn.execute(sql, binds);
  return result.rowsAffected || 0;
}

const DELETE_SQL = 'DELETE FROM employee WHERE emp_id = :empId';

async function deleteEmployee(conn, empId) {
  const result = await conn.execute(DELETE_SQL, { empId });
  return result.rowsAffected || 0;
}

const UPDATE_PASSWORD_SQL = 'UPDATE employee SET password_hash = :passwordHash WHERE emp_id = :empId';

async function updatePassword(conn, { empId, passwordHash }) {
  await conn.execute(UPDATE_PASSWORD_SQL, { empId, passwordHash });
}

async function countBookingsForEmployee(empId) {
  const result = await query('SELECT COUNT(*) AS total FROM booking WHERE emp_id = :empId', { empId });
  return Number((result.rows && result.rows[0] && result.rows[0].TOTAL) || 0);
}

async function countInDepartment(deptId) {
  const result = await query('SELECT COUNT(*) AS total FROM employee WHERE dept_id = :deptId', { deptId });
  return Number((result.rows && result.rows[0] && result.rows[0].TOTAL) || 0);
}

async function countInPosition(positionId) {
  const result = await query('SELECT COUNT(*) AS total FROM employee WHERE position_id = :positionId', {
    positionId,
  });
  return Number((result.rows && result.rows[0] && result.rows[0].TOTAL) || 0);
}

module.exports = {
  findEmployeeById,
  listEmployees,
  countEmployees,
  findByUsername,
  findByEmpCode,
  insertEmployee,
  updateEmployee,
  deleteEmployee,
  updatePassword,
  countBookingsForEmployee,
  countInDepartment,
  countInPosition,
};
