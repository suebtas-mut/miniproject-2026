// src/services/master.service.js — T-016: business logic ของ UC-04/UC-05/UC-06
// ครอบคลุม: department / position / employee CRUD + pagination + rules ฝั่ง server
// - 404 เมื่อไม่พบแถว, 409 เมื่อซ้ำ, 422 เมื่อผิด FK / มีข้อมูลผูกอยู่
// - ทุก write ผ่าน withTransaction (commit/rollback ชัดเจน)
// - bcrypt.hash รหัสผ่านก่อนบันทึก ห้ามส่ง hash กลับไป (R-04)
const bcrypt = require('bcryptjs');
const { HttpError } = require('../middleware/errorHandler');
const { translateOracleError } = require('../utils/oracle');
const { parsePagination, buildMeta, intOrNull } = require('../utils/pagination');
const { toEmployeeProfile, toDepartment, toPosition } = require('../utils/mappers');
const { BCRYPT_ROUNDS } = require('./auth.service');

const NOT_FOUND = () => new HttpError(404, 'ไม่พบข้อมูลที่ต้องการ', { code: 'NOT_FOUND' });

// คอลัมน์ที่ PUT /employees/{id} อนุญาต ( whitelist — ห้ามรับคอลัมน์จาก user )
const EMPLOYEE_UPDATE_FIELDS = [
  'emp_code',
  'first_name',
  'last_name',
  'phone',
  'email',
  'dept_id',
  'position_id',
  'is_active',
];

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function createMasterService({ db, repos }) {
  const { withTransaction } = db;

  // ============================ Departments ============================

  async function listDepartments(query = {}) {
    const { page, limit, offset } = parsePagination(query);
    const q = cleanString(query.q);
    const filters = q ? { q } : {};
    const [rows, total] = await Promise.all([
      repos.department.list({ ...filters, limit, offset }),
      repos.department.count(filters),
    ]);
    return { data: rows.map(toDepartment), meta: buildMeta({ page, limit, total }) };
  }

  async function createDepartment(body) {
    const deptName = cleanString(body.dept_name);
    if (await repos.department.findByName(deptName)) {
      throw new HttpError(409, 'ชื่อแผนกนี้มีอยู่แล้ว', { code: 'DUPLICATED' });
    }
    let deptId;
    try {
      deptId = await withTransaction((conn) => repos.department.insert(conn, { deptName }));
    } catch (err) {
      throw (
        translateOracleError(err, {
          duplicate: { message: 'ชื่อแผนกนี้มีอยู่แล้ว' },
        }) || err
      );
    }
    const created = await repos.department.findById(deptId);
    if (!created) throw new Error('insert department succeeded but row not found');
    return toDepartment(created);
  }

  async function updateDepartment(deptId, body) {
    const existing = await repos.department.findById(deptId);
    if (!existing) throw NOT_FOUND();
    const deptName = cleanString(body.dept_name);
    const duplicate = await repos.department.findByName(deptName, deptId);
    if (duplicate) throw new HttpError(409, 'ชื่อแผนกนี้มีอยู่แล้ว', { code: 'DUPLICATED' });
    try {
      await withTransaction((conn) => repos.department.update(conn, { deptId, deptName }));
    } catch (err) {
      throw (
        translateOracleError(err, { duplicate: { message: 'ชื่อแผนกนี้มีอยู่แล้ว' } }) || err
      );
    }
    return toDepartment(await repos.department.findById(deptId));
  }

  async function deleteDepartment(deptId) {
    const existing = await repos.department.findById(deptId);
    if (!existing) throw NOT_FOUND();
    const busyMessage = 'ยังมีพนักงานสังกัดในแผนกนี้อยู่ กรุณาย้ายพนักงานออกก่อน';
    if ((await repos.employee.countInDepartment(deptId)) > 0) {
      throw new HttpError(422, busyMessage, { code: 'FK_VIOLATION' });
    }
    try {
      await withTransaction((conn) => repos.department.remove(conn, { deptId }));
    } catch (err) {
      throw translateOracleError(err, { referenced: { message: busyMessage, code: 'FK_VIOLATION' } }) || err;
    }
  }

  // ============================ Positions ============================

  async function listPositions(query = {}) {
    const { page, limit, offset } = parsePagination(query);
    const q = cleanString(query.q);
    const filters = q ? { q } : {};
    const [rows, total] = await Promise.all([
      repos.position.list({ ...filters, limit, offset }),
      repos.position.count(filters),
    ]);
    return { data: rows.map(toPosition), meta: buildMeta({ page, limit, total }) };
  }

  async function createPosition(body) {
    const positionName = cleanString(body.position_name);
    if (await repos.position.findByName(positionName)) {
      throw new HttpError(409, 'ชื่อตำแหน่งนี้มีอยู่แล้ว', { code: 'DUPLICATED' });
    }
    let positionId;
    try {
      positionId = await withTransaction((conn) => repos.position.insert(conn, { positionName }));
    } catch (err) {
      throw translateOracleError(err, { duplicate: { message: 'ชื่อตำแหน่งนี้มีอยู่แล้ว' } }) || err;
    }
    const created = await repos.position.findById(positionId);
    if (!created) throw new Error('insert position succeeded but row not found');
    return toPosition(created);
  }

  async function updatePosition(positionId, body) {
    const existing = await repos.position.findById(positionId);
    if (!existing) throw NOT_FOUND();
    const positionName = cleanString(body.position_name);
    const duplicate = await repos.position.findByName(positionName, positionId);
    if (duplicate) throw new HttpError(409, 'ชื่อตำแหน่งนี้มีอยู่แล้ว', { code: 'DUPLICATED' });
    try {
      await withTransaction((conn) => repos.position.update(conn, { positionId, positionName }));
    } catch (err) {
      throw translateOracleError(err, { duplicate: { message: 'ชื่อตำแหน่งนี้มีอยู่แล้ว' } }) || err;
    }
    return toPosition(await repos.position.findById(positionId));
  }

  async function deletePosition(positionId) {
    const existing = await repos.position.findById(positionId);
    if (!existing) throw NOT_FOUND();
    const busyMessage = 'ยังมีพนักงานสังกัดในตำแหน่งนี้อยู่ กรุณาย้ายพนักงานออกก่อน';
    if ((await repos.employee.countInPosition(positionId)) > 0) {
      throw new HttpError(422, busyMessage, { code: 'FK_VIOLATION' });
    }
    try {
      await withTransaction((conn) => repos.position.remove(conn, { positionId }));
    } catch (err) {
      throw translateOracleError(err, { referenced: { message: busyMessage, code: 'FK_VIOLATION' } }) || err;
    }
  }

  // ============================ Employees ============================

  function employeeFilters(query = {}) {
    const filters = {};
    const q = cleanString(query.q);
    if (q) filters.q = q;
    const deptId = intOrNull(query.dept_id);
    if (deptId !== null && deptId > 0) filters.deptId = deptId;
    const isActive = intOrNull(query.is_active);
    if (isActive === 0 || isActive === 1) filters.isActive = isActive;
    return filters;
  }

  async function listEmployees(query = {}) {
    const { page, limit, offset } = parsePagination(query);
    const filters = employeeFilters(query);
    const [rows, total] = await Promise.all([
      repos.employee.listEmployees({ ...filters, limit, offset }),
      repos.employee.countEmployees(filters),
    ]);
    return { data: rows.map((row) => toEmployeeProfile(row)), meta: buildMeta({ page, limit, total }) };
  }

  async function assertReferences({ deptId, positionId }) {
    if (deptId !== undefined && deptId !== null) {
      if (!(await repos.department.findById(deptId))) {
        throw new HttpError(422, 'ข้อมูลอ้างอิงไม่ถูกต้อง (ไม่พบแผนกที่ระบุ)', { code: 'FK_VIOLATION' });
      }
    }
    if (positionId !== undefined && positionId !== null) {
      if (!(await repos.position.findById(positionId))) {
        throw new HttpError(422, 'ข้อมูลอ้างอิงไม่ถูกต้อง (ไม่พบตำแหน่งที่ระบุ)', { code: 'FK_VIOLATION' });
      }
    }
  }

  async function createEmployee(body) {
    const deptId = intOrNull(body.dept_id);
    const positionId = intOrNull(body.position_id);
    if (deptId === null || positionId === null) {
      const details = [];
      if (deptId === null) details.push({ field: 'dept_id', message: 'ไม่ใส่ค่าได้' });
      if (positionId === null) details.push({ field: 'position_id', message: 'ไม่ใส่ค่าได้' });
      throw new HttpError(400, 'กรุณาระบุแผนกและตำแหน่งของพนักงาน', {
        code: 'VALIDATION_ERROR',
        details,
      });
    }

    if ((await repos.employee.findByUsername(body.username)) || (await repos.employee.findByEmpCode(body.emp_code))) {
      throw new HttpError(409, 'ชื่อผู้ใช้หรือรหัสพนักงานนี้ถูกใช้แล้ว', { code: 'DUPLICATED' });
    }
    await assertReferences({ deptId, positionId });

    const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
    let empId;
    try {
      empId = await withTransaction((conn) =>
        repos.employee.insertEmployee(conn, {
          emp_code: cleanString(body.emp_code),
          first_name: cleanString(body.first_name),
          last_name: cleanString(body.last_name),
          phone: body.phone ?? null,
          email: body.email ?? null,
          dept_id: deptId,
          position_id: positionId,
          username: cleanString(body.username),
          password_hash: passwordHash,
          is_active: body.is_active === undefined ? 1 : Number(body.is_active),
        }),
      );
    } catch (err) {
      throw (
        translateOracleError(err, {
          duplicate: { message: 'ชื่อผู้ใช้หรือรหัสพนักงานนี้ถูกใช้แล้ว' },
          foreignKey: { message: 'ข้อมูลอ้างอิงไม่ถูกต้อง (ไม่พบแผนกหรือตำแหน่ง)' },
        }) || err
      );
    }

    const created = await repos.employee.findEmployeeById(empId);
    if (!created) throw new Error('insert employee succeeded but row not found');
    return toEmployeeProfile(created);
  }

  async function updateEmployee(empId, body) {
    const existing = await repos.employee.findEmployeeById(empId);
    if (!existing) throw NOT_FOUND();

    const data = {};
    for (const field of EMPLOYEE_UPDATE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) data[field] = body[field];
    }
    if (data.emp_code !== undefined && cleanString(data.emp_code) !== existing.EMP_CODE) {
      if (await repos.employee.findByEmpCode(cleanString(data.emp_code), empId)) {
        throw new HttpError(409, 'ชื่อผู้ใช้หรือรหัสพนักงานนี้ถูกใช้แล้ว', { code: 'DUPLICATED' });
      }
    }

    if (Object.prototype.hasOwnProperty.call(data, 'dept_id')) data.dept_id = intOrNull(data.dept_id);
    if (Object.prototype.hasOwnProperty.call(data, 'position_id')) data.position_id = intOrNull(data.position_id);
    if (Object.prototype.hasOwnProperty.call(data, 'is_active')) data.is_active = Number(data.is_active);
    await assertReferences({ deptId: data.dept_id, positionId: data.position_id });

    try {
      await withTransaction((conn) => repos.employee.updateEmployee(conn, { empId, data }));
    } catch (err) {
      throw (
        translateOracleError(err, {
          duplicate: { message: 'ชื่อผู้ใช้หรือรหัสพนักงานนี้ถูกใช้แล้ว' },
          foreignKey: { message: 'ข้อมูลอ้างอิงไม่ถูกต้อง (ไม่พบแผนกหรือตำแหน่ง)' },
        }) || err
      );
    }

    const updated = await repos.employee.findEmployeeById(empId);
    return toEmployeeProfile(updated);
  }

  async function deleteEmployee(empId) {
    const existing = await repos.employee.findEmployeeById(empId);
    if (!existing) throw NOT_FOUND();
    const busyMessage = 'พนักงานคนนี้มีข้อมูลการจองผูกอยู่ กรุณาใช้การปิดใช้งานแทนการลบ';
    if ((await repos.employee.countBookingsForEmployee(empId)) > 0) {
      throw new HttpError(422, busyMessage, { code: 'HAS_DEPENDENT_DATA' });
    }
    try {
      await withTransaction((conn) => repos.employee.deleteEmployee(conn, empId));
    } catch (err) {
      throw translateOracleError(err, { referenced: { message: busyMessage } }) || err;
    }
  }

  return {
    listDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    listPositions,
    createPosition,
    updatePosition,
    deletePosition,
    listEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee,
  };
}

module.exports = { createMasterService, EMPLOYEE_UPDATE_FIELDS };
