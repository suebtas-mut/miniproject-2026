// src/services/rbac.service.js — T-019/T-020/T-021: business logic ของ UC-07/UC-08/UC-09
// - Role CRUD: 404 ไม่พบ · 409 ชื่อซ้ำ · 422 ยังมีพนักงานใช้บทบาทอยู่ (ลบไม่ได้)
// - Permission: GET/POST เท่านั้น (PUT/DELETE /permissions/{id} = Q24 ยังไม่มีในสเปก → ไม่สร้าง)
// - Permission matrix: MERGE สิทธิ์ใหม่ + DELETE ที่ถอดออก ใน withTransaction เดียว
//   ถ้า statement ใดล้ม → rollback ทั้งชุด ไม่ให้ตารางติ๊กอยู่ครึ่งกลาง (OpenAPI x-transaction)
// - ไม่มีการตัดสินสิทธิ์จากชื่อบทบาทใน service นี้ (dynamic RBAC ทำที่ middleware)
const { HttpError } = require('../middleware/errorHandler');
const { translateOracleError } = require('../utils/oracle');
const { parsePagination, buildMeta, intOrNull } = require('../utils/pagination');
const { toAppRole, toPermission, parseGrantedIds } = require('../utils/mappers');

const NOT_FOUND = () => new HttpError(404, 'ไม่พบข้อมูลที่ต้องการ', { code: 'NOT_FOUND' });

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function createRbacService({ db, repos }) {
  const { withTransaction } = db;

  // ============================ Roles (UC-07) ============================

  async function listRoles(query = {}) {
    const { page, limit, offset } = parsePagination(query);
    const isActive = intOrNull(query.is_active);
    const filters = isActive === 0 || isActive === 1 ? { isActive } : {};
    const [rows, total] = await Promise.all([
      repos.role.list({ ...filters, limit, offset }),
      repos.role.count(filters),
    ]);
    return {
      data: rows.map((row) => ({
        ...toAppRole(row),
        granted_perm_ids: parseGrantedIds(row.GRANTED_IDS),
      })),
      meta: buildMeta({ page, limit, total }),
    };
  }

  async function createRole(body) {
    const roleName = cleanString(body.role_name);
    if (await repos.role.findByName(roleName)) {
      throw new HttpError(409, 'ชื่อบทบาทนี้มีอยู่แล้ว', { code: 'DUPLICATED' });
    }
    const description = cleanString(body.description) || null;
    const isActive = body.is_active === undefined ? 1 : Number(body.is_active);
    let roleId;
    try {
      roleId = await withTransaction((conn) =>
        repos.role.insert(conn, { roleName, description, isActive }),
      );
    } catch (err) {
      throw (
        translateOracleError(err, { duplicate: { message: 'ชื่อบทบาทนี้มีอยู่แล้ว' } }) || err
      );
    }
    const created = await repos.role.findById(roleId);
    if (!created) throw new Error('insert role succeeded but row not found');
    return toAppRole(created);
  }

  async function updateRole(roleId, body) {
    const existing = await repos.role.findById(roleId);
    if (!existing) throw NOT_FOUND();
    const roleName = cleanString(body.role_name);
    const duplicate = await repos.role.findByName(roleName, roleId);
    if (duplicate) throw new HttpError(409, 'ชื่อบทบาทนี้มีอยู่แล้ว', { code: 'DUPLICATED' });
    const description = cleanString(body.description) || null;
    const isActive = body.is_active === undefined ? Number(existing.IS_ACTIVE) : Number(body.is_active);
    try {
      await withTransaction((conn) => repos.role.update(conn, { roleId, roleName, description, isActive }));
    } catch (err) {
      throw translateOracleError(err, { duplicate: { message: 'ชื่อบทบาทนี้มีอยู่แล้ว' } }) || err;
    }
    return toAppRole(await repos.role.findById(roleId));
  }

  async function deleteRole(roleId) {
    const existing = await repos.role.findById(roleId);
    if (!existing) throw NOT_FOUND();
    const busyMessage = 'ยังมีพนักงานที่ใช้บทบาทนี้อยู่ กรุณาปลดบทบาทออกก่อน';
    if ((await repos.role.countEmployeesWithRole(roleId)) > 0) {
      throw new HttpError(422, busyMessage, { code: 'HAS_DEPENDENT_DATA' });
    }
    try {
      await withTransaction((conn) => repos.role.remove(conn, { roleId }));
    } catch (err) {
      throw translateOracleError(err, { referenced: { message: busyMessage } }) || err;
    }
  }

  // ============================ Permissions (UC-08) ============================

  const PERMISSION_MODULES = ['master', 'front', 'booking', 'driver', 'report'];

  async function listPermissions(query = {}) {
    const { page, limit, offset } = parsePagination(query);
    const module = cleanString(query.module);
    const filters = PERMISSION_MODULES.includes(module) ? { module } : {};
    const [rows, total] = await Promise.all([
      repos.permission.list({ ...filters, limit, offset }),
      repos.permission.count(filters),
    ]);
    return { data: rows.map(toPermission), meta: buildMeta({ page, limit, total }) };
  }

  async function createPermission(body) {
    const permCode = cleanString(body.perm_code);
    if (await repos.permission.findByCode(permCode)) {
      throw new HttpError(409, 'รหัสสิทธิ์นี้มีอยู่แล้ว', { code: 'DUPLICATED' });
    }
    const permName = cleanString(body.perm_name);
    const module = cleanString(body.module);
    const screenKey = cleanString(body.screen_key) || null;
    const sortNo = body.sort_no === undefined ? 0 : Number(body.sort_no);
    let permId;
    try {
      permId = await withTransaction((conn) =>
        repos.permission.insert(conn, { permCode, permName, module, screenKey, sortNo }),
      );
    } catch (err) {
      throw translateOracleError(err, { duplicate: { message: 'รหัสสิทธิ์นี้มีอยู่แล้ว' } }) || err;
    }
    const created = await repos.permission.findById(permId);
    if (!created) throw new Error('insert permission succeeded but row not found');
    return toPermission(created);
  }

  // ============================ Permission Matrix (UC-09) ============================

  function normalizePermIds(raw) {
    if (!Array.isArray(raw)) {
      throw new HttpError(400, 'ข้อมูลที่ส่งมาไม่ถูกต้อง', {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'perm_ids', message: 'must be an array of positive integers' }],
      });
    }
    const permIds = [];
    for (const value of raw) {
      const n = intOrNull(value);
      if (n === null || n <= 0) {
        throw new HttpError(400, 'ข้อมูลที่ส่งมาไม่ถูกต้อง', {
          code: 'VALIDATION_ERROR',
          details: [{ field: 'perm_ids', message: 'must be an array of positive integers' }],
        });
      }
      if (!permIds.includes(n)) permIds.push(n);
    }
    return permIds;
  }

  async function savePermissionMatrix(body) {
    const roleId = intOrNull(body.role_id);
    const permIds = normalizePermIds(body.perm_ids);

    const role = await repos.role.findById(roleId);
    if (!role) throw NOT_FOUND();

    if (permIds.length > 0) {
      const found = await repos.permission.findByIds(permIds);
      const foundIds = new Set(found.map((row) => Number(row.PERM_ID)));
      if (permIds.some((permId) => !foundIds.has(permId))) {
        throw new HttpError(422, 'ข้อมูลอ้างอิงไม่ถูกต้อง (ไม่พบสิทธิ์ที่ระบุ)', {
          code: 'FK_VIOLATION',
        });
      }
    }

    // Transaction เดียว: DELETE สิทธิ์ที่ถอด + MERGE สิทธิ์ใหม่ — ล้มตัวใดล้มหนึ่ง = rollback ทั้งชุด
    await withTransaction(async (conn) => {
      await repos.role.deleteGrantsExcept(conn, { roleId, permIds });
      for (const permId of permIds) {
        await repos.role.mergeGrant(conn, { roleId, permId });
      }
    });

    return { role_id: roleId, granted_count: permIds.length };
  }

  return {
    listRoles,
    createRole,
    updateRole,
    deleteRole,
    listPermissions,
    createPermission,
    savePermissionMatrix,
  };
}

module.exports = { createRbacService };
