// backend/tests/sprint05.test.js — Sprint 5 (T-019 / T-020 / T-021 / T-022) regression tests
// ครอบคลุม: Role CRUD (UC-07), Permission GET/POST (UC-08), Permission Matrix แบบ transaction
//           (UC-09), Dynamic RBAC ทุก protected endpoint ไม่มี role-name bypass, P-12 static scan,
//           และ SQL แบบ bind variables ไม่ใช้ SELECT * ไม่ hardcode ชื่อบทบาท
// Q22 (UC-10 employee_role write) / Q24 (PUT/DELETE /permissions/{id}) — endpoint ไม่มีในสเปก
//           → มี test ยืนยันว่า "ไม่ถูกสร้าง" (blocked ตามที่บันทึกไว้)
// สถาปัตยกรรม: inject fake repos + fake connection เข้า createApp (ไม่แตะ Oracle จริง)
//               แต่ transaction runner / SQL ของ repository เป็นโค้ดจริงที่ assert ผ่าน spy

process.env.JWT_SECRET = 'sprint05-test-secret-0123456789abcdef0123456789abcdef';
process.env.JWT_EXPIRES_IN = '2h';
process.env.JWT_ISSUER = 'shuttle-bus-test-issuer';

jest.mock('../src/config/db', () => {
  const actual = jest.requireActual('../src/config/db');
  return {
    ...actual,
    query: jest.fn(),
    checkDbHealth: jest.fn(async () => ({ connected: true, latencyMs: 1 })),
  };
});

const request = require('supertest');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const { createApp } = require('../src/app');
const dbMock = require('../src/config/db');
const { resetLoginAttempts } = require('../src/middleware/auth');
const authRepo = require('../src/repositories/auth.repository');
const roleRepo = require('../src/repositories/role.repository');
const permissionRepo = require('../src/repositories/permission.repository');

const ADMIN_PASS = 'AdminPass123';
const VIEWER_PASS = 'ViewerPass123';
const GHOST_PASS = 'GhostPass123';

// ---------------------------------------------------------------- fake world
function createWorld() {
  const profiles = new Map();
  const credentials = new Map();
  const permissions = new Map();
  const menus = new Map();
  const roles = new Map();
  const revoked = [];

  const appRoles = [
    { ROLE_ID: 1, ROLE_NAME: 'ADMIN', DESCRIPTION: 'ผู้ดูแลระบบ', IS_ACTIVE: 1 },
    { ROLE_ID: 2, ROLE_NAME: 'STAFF', DESCRIPTION: 'พนักงานสำนักงาน', IS_ACTIVE: 1 },
    { ROLE_ID: 3, ROLE_NAME: 'DRIVER', DESCRIPTION: 'ผู้ขับรถ', IS_ACTIVE: 1 },
    { ROLE_ID: 4, ROLE_NAME: 'LEGACY', DESCRIPTION: 'บทบาทปิดใช้งาน', IS_ACTIVE: 0 },
  ];
  const permissionRows = [
    { PERM_ID: 1, PERM_CODE: 'EMP.VIEW', PERM_NAME: 'ดูข้อมูลพนักงาน', MODULE: 'master', SCREEN_KEY: 'EMP_LIST', SORT_NO: 10 },
    { PERM_ID: 2, PERM_CODE: 'ROLE.EDIT', PERM_NAME: 'จัดการบทบาทและสิทธิ์', MODULE: 'master', SCREEN_KEY: 'ROLE_MATRIX', SORT_NO: 14 },
    { PERM_ID: 3, PERM_CODE: 'ROUTE.VIEW', PERM_NAME: 'ดูเส้นทางและรอบเวลา', MODULE: 'front', SCREEN_KEY: 'ROUTE_LIST', SORT_NO: 20 },
    { PERM_ID: 4, PERM_CODE: 'BK.CREATE', PERM_NAME: 'จองรถ', MODULE: 'booking', SCREEN_KEY: 'BK_FORM', SORT_NO: 30 },
  ];
  const grants = new Map(); // roleId -> Set(permId)
  grants.set(1, new Set([1, 2, 3, 4]));
  grants.set(2, new Set([1]));
  grants.set(3, new Set([3]));
  grants.set(4, new Set());
  const roleHeadcount = new Map(); // roleId -> จำนวนพนักงานที่ใช้บทบาทนี้
  let nextRoleId = 50;
  let nextPermId = 50;

  function addEmployee(o) {
    const row = {
      EMP_ID: o.empId,
      EMP_CODE: o.empCode || `EMP${String(o.empId).padStart(3, '0')}`,
      FIRST_NAME: o.firstName || 'ทดสอบ',
      LAST_NAME: o.lastName || 'ระบบ',
      PHONE: null,
      EMAIL: null,
      DEPT_ID: null,
      DEPT_NAME: null,
      POSITION_ID: null,
      POSITION_NAME: null,
      USERNAME: o.username,
      IS_ACTIVE: o.isActive === undefined ? 1 : o.isActive,
      CREATED_AT: new Date('2026-01-05T08:00:00.000Z'),
      ROLES: (o.roles || []).join(','),
    };
    profiles.set(row.EMP_ID, row);
    credentials.set(row.EMP_ID, {
      EMP_ID: row.EMP_ID,
      USERNAME: row.USERNAME,
      PASSWORD_HASH: o.passwordHash,
      IS_ACTIVE: row.IS_ACTIVE,
    });
    permissions.set(row.EMP_ID, o.permissions || []);
    menus.set(row.EMP_ID, o.menus || []);
    roles.set(row.EMP_ID, o.roles || []);
    return row;
  }

  const repos = {
    auth: {
      findLoginUser: jest.fn(async (username) => {
        for (const cred of credentials.values()) {
          if (cred.USERNAME === username) {
            const profile = profiles.get(cred.EMP_ID);
            if (!profile) return null;
            return { ...profile, PASSWORD_HASH: cred.PASSWORD_HASH };
          }
        }
        return null;
      }),
      findCredentialById: jest.fn(async (empId) => credentials.get(Number(empId)) || null),
      loadPermissions: jest.fn(async (empId) => [...(permissions.get(Number(empId)) || [])]),
      loadMenus: jest.fn(async (empId) => (menus.get(Number(empId)) || []).map((m) => ({ ...m }))),
      loadRoles: jest.fn(async (empId) => [...(roles.get(Number(empId)) || [])]),
      findRevokedTokens: jest.fn(async (jti, marker) =>
        revoked.filter((r) => (r.JTI === jti || r.JTI === marker) && r.EXPIRES_AT > new Date()),
      ),
      blacklistToken: jest.fn(async () => {}),
      deleteExpiredBlacklist: jest.fn(async () => {}),
    },
    employee: {
      findEmployeeById: jest.fn(async (empId) => profiles.get(Number(empId)) || null),
      findByUsername: jest.fn(async () => null),
      findByEmpCode: jest.fn(async () => null),
      listEmployees: jest.fn(async () => []),
      countEmployees: jest.fn(async () => 0),
      countBookingsForEmployee: jest.fn(async () => 0),
      countInDepartment: jest.fn(async () => 0),
      countInPosition: jest.fn(async () => 0),
      insertEmployee: jest.fn(async () => 99),
      updateEmployee: jest.fn(async () => 1),
      deleteEmployee: jest.fn(async () => 1),
      updatePassword: jest.fn(async () => {}),
    },
    role: {
      list: jest.fn(async ({ isActive, limit, offset } = {}) =>
        appRoles
          .filter((r) => isActive === undefined || r.IS_ACTIVE === Number(isActive))
          .slice(offset, offset + limit)
          .map((r) => ({
            ...r,
            GRANTED_IDS:
              [...(grants.get(r.ROLE_ID) || [])].sort((a, b) => a - b).join(',') || null,
          })),
      ),
      count: jest.fn(
        async ({ isActive } = {}) =>
          appRoles.filter((r) => isActive === undefined || r.IS_ACTIVE === Number(isActive)).length,
      ),
      findById: jest.fn(async (roleId) => appRoles.find((r) => r.ROLE_ID === Number(roleId)) || null),
      findByName: jest.fn(
        async (roleName, excludeRoleId) =>
          appRoles.find((r) => r.ROLE_NAME === roleName && r.ROLE_ID !== excludeRoleId) || null,
      ),
      insert: jest.fn(async (conn, { roleName, description, isActive }) => {
        const roleId = nextRoleId;
        nextRoleId += 1;
        appRoles.push({
          ROLE_ID: roleId,
          ROLE_NAME: roleName,
          DESCRIPTION: description ?? null,
          IS_ACTIVE: isActive,
        });
        grants.set(roleId, new Set());
        return roleId;
      }),
      update: jest.fn(async (conn, { roleId, roleName, description, isActive }) => {
        const row = appRoles.find((r) => r.ROLE_ID === Number(roleId));
        row.ROLE_NAME = roleName;
        row.DESCRIPTION = description;
        row.IS_ACTIVE = isActive;
        return 1;
      }),
      remove: jest.fn(async (conn, { roleId }) => {
        const idx = appRoles.findIndex((r) => r.ROLE_ID === Number(roleId));
        if (idx >= 0) appRoles.splice(idx, 1);
        grants.delete(Number(roleId));
        return 1;
      }),
      countEmployeesWithRole: jest.fn(async (roleId) => roleHeadcount.get(Number(roleId)) || 0),
      deleteGrantsExcept: jest.fn(async (conn, { roleId, permIds }) => {
        const set = grants.get(Number(roleId)) || new Set();
        if (!permIds || permIds.length === 0) {
          grants.set(Number(roleId), new Set());
          return;
        }
        for (const permId of [...set]) {
          if (!permIds.includes(permId)) set.delete(permId);
        }
      }),
      mergeGrant: jest.fn(async (conn, { roleId, permId }) => {
        const set = grants.get(Number(roleId)) || new Set();
        set.add(Number(permId));
        grants.set(Number(roleId), set);
      }),
    },
    permission: {
      list: jest.fn(async ({ module, limit, offset } = {}) =>
        permissionRows
          .filter((p) => !module || p.MODULE === module)
          .slice()
          .sort(
            (a, b) =>
              a.MODULE.localeCompare(b.MODULE) || a.SORT_NO - b.SORT_NO || a.PERM_ID - b.PERM_ID,
          )
          .slice(offset, offset + limit),
      ),
      count: jest.fn(
        async ({ module } = {}) => permissionRows.filter((p) => !module || p.MODULE === module).length,
      ),
      findById: jest.fn(async (permId) => permissionRows.find((p) => p.PERM_ID === Number(permId)) || null),
      findByCode: jest.fn(
        async (permCode, excludePermId) =>
          permissionRows.find((p) => p.PERM_CODE === permCode && p.PERM_ID !== excludePermId) || null,
      ),
      findByIds: jest.fn(async (permIds) => permissionRows.filter((p) => permIds.includes(p.PERM_ID))),
      insert: jest.fn(async (conn, { permCode, permName, module, screenKey, sortNo }) => {
        const permId = nextPermId;
        nextPermId += 1;
        permissionRows.push({
          PERM_ID: permId,
          PERM_CODE: permCode,
          PERM_NAME: permName,
          MODULE: module,
          SCREEN_KEY: screenKey,
          SORT_NO: sortNo,
        });
        return permId;
      }),
    },
  };

  addEmployee({
    empId: 1,
    username: 'admin',
    empCode: 'EMP001',
    firstName: 'ระบบ',
    lastName: 'ผู้ดูแลระบบ',
    passwordHash: bcrypt.hashSync(ADMIN_PASS, 4),
    roles: ['ADMIN'],
    permissions: ['EMP.VIEW', 'ROLE.EDIT', 'DEPT.EDIT'],
    menus: [{ SCREEN_KEY: 'ROLE_MATRIX', MENU_LABEL: 'บทบาทและสิทธิ์', SORT_NO: 14 }],
  });
  addEmployee({
    empId: 2,
    username: 'viewer',
    empCode: 'EMP002',
    firstName: 'วิว',
    lastName: 'ผู้ชม',
    passwordHash: bcrypt.hashSync(VIEWER_PASS, 4),
    roles: ['STAFF'],
    permissions: ['EMP.VIEW'],
    menus: [{ SCREEN_KEY: 'EMP_LIST', MENU_LABEL: 'พนักงาน', SORT_NO: 10 }],
  });
  // ผู้ใช้ที่ "ชื่อบทบาทไม่ใช่ ADMIN เลย" แต่มีสิทธิ์ ROLE.EDIT — พิสูจน์ว่าไม่มี role-name bypass
  addEmployee({
    empId: 5,
    username: 'ghost',
    empCode: 'EMP005',
    firstName: 'ผี',
    lastName: 'บทบาท',
    passwordHash: bcrypt.hashSync(GHOST_PASS, 4),
    roles: ['WEIRD_ROLE_NAME'],
    permissions: ['ROLE.EDIT'],
    menus: [{ SCREEN_KEY: 'ROLE_MATRIX', MENU_LABEL: 'บทบาทและสิทธิ์', SORT_NO: 14 }],
  });

  return {
    repos,
    state: { profiles, credentials, permissions, menus, roles, revoked, appRoles, permissionRows, grants, roleHeadcount, addEmployee },
  };
}

function makeConn() {
  return {
    commit: jest.fn(async () => {}),
    rollback: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
    execute: jest.fn(async () => ({ rowsAffected: 1 })),
  };
}

function setup(world) {
  const conn = makeConn();
  const fakePool = { getConnection: jest.fn(async () => conn) };
  const db = {
    query: jest.fn(),
    checkDbHealth: jest.fn(async () => ({ connected: true, latencyMs: 1 })),
    withTransaction: dbMock.createTransactionRunner(() => fakePool),
  };
  const auditSink = jest.fn();
  const app = createApp({
    healthCheck: async () => ({ connected: true, latencyMs: 1 }),
    auditSink,
    db,
    repos: world.repos,
  });
  return { app, conn, auditSink, fakePool };
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

async function tokenFor(app, username = 'admin', password = ADMIN_PASS) {
  const res = await request(app).post('/api/v1/auth/login').send({ username, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.access_token;
}

beforeEach(() => {
  resetLoginAttempts();
});

// ================================================================ UC-07 roles
describe('T-019 GET/POST /api/v1/roles (UC-07)', () => {
  let world;
  let app;
  let conn;
  let token;

  beforeEach(async () => {
    world = createWorld();
    ({ app, conn } = setup(world));
    token = await tokenFor(app);
  });

  test('GET 200: รูป OpenAPI — snake_case + granted_perm_ids (LISTAGG) + meta ครบ', async () => {
    const res = await request(app).get('/api/v1/roles').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(4);
    expect(res.body.data[0]).toEqual({
      role_id: 1,
      role_name: 'ADMIN',
      description: 'ผู้ดูแลระบบ',
      is_active: 1,
      granted_perm_ids: [1, 2, 3, 4],
    });
    expect(res.body.data[3]).toMatchObject({
      role_id: 4,
      role_name: 'LEGACY',
      is_active: 0,
      granted_perm_ids: [],
    });
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 4, total_pages: 1 });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  test('GET ?is_active=1 กรองได้ · page/limit clamp · ค่าผิดถูกละเลย (ไม่ตอบ 400)', async () => {
    const active = await request(app).get('/api/v1/roles?is_active=1').set(authHeader(token));
    expect(active.status).toBe(200);
    expect(active.body.data.every((r) => r.is_active === 1)).toBe(true);
    expect(active.body.meta.total).toBe(3);

    const clamped = await request(app)
      .get('/api/v1/roles?page=0&limit=9999')
      .set(authHeader(token));
    expect(clamped.body.meta).toEqual({ page: 1, limit: 100, total: 4, total_pages: 1 });
    expect(world.repos.role.list).toHaveBeenLastCalledWith({ limit: 100, offset: 0 });

    const bogus = await request(app).get('/api/v1/roles?is_active=9').set(authHeader(token));
    expect(bogus.status).toBe(200);
    expect(bogus.body.meta.total).toBe(4);
  });

  test('POST 201 สร้างผ่าน transaction จริง (insert ได้ conn จาก withTransaction)', async () => {
    const res = await request(app)
      .post('/api/v1/roles')
      .set(authHeader(token))
      .send({ role_name: ' SUPERVISOR ', description: 'หัวหน้างาน', is_active: 1 });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('เพิ่มบทบาทสำเร็จ');
    expect(res.body.data).toEqual({
      role_id: 50,
      role_name: 'SUPERVISOR',
      description: 'หัวหน้างาน',
      is_active: 1,
    });
    expect(world.repos.role.insert.mock.calls[0][0]).toBe(conn);
    expect(world.repos.role.insert.mock.calls[0][1]).toEqual({
      roleName: 'SUPERVISOR',
      description: 'หัวหน้างาน',
      isActive: 1,
    });
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
  });

  test('POST ชื่อซ้ำ (รวมค่ามีช่องว่าง) → 409 · ไม่เรียก insert', async () => {
    const res = await request(app)
      .post('/api/v1/roles')
      .set(authHeader(token))
      .send({ role_name: '  ADMIN  ' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('ชื่อบทบาทนี้มีอยู่แล้ว');
    expect(world.repos.role.insert).not.toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
  });

  test('POST ไม่มี role_name → 400 details · is_active ผิด enum → 400', async () => {
    const missing = await request(app).post('/api/v1/roles').set(authHeader(token)).send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('VALIDATION_ERROR');
    expect(missing.body.error.details).toEqual([{ field: 'role_name', message: 'is required' }]);

    const badEnum = await request(app)
      .post('/api/v1/roles')
      .set(authHeader(token))
      .send({ role_name: 'X', is_active: 7 });
    expect(badEnum.status).toBe(400);
    expect(badEnum.body.error.details[0].field).toBe('is_active');
  });
});

// ================================================================ UC-07 role by id
describe('T-019 PUT/DELETE /api/v1/roles/{id} (UC-07)', () => {
  let world;
  let app;
  let conn;
  let token;

  beforeEach(async () => {
    world = createWorld();
    ({ app, conn } = setup(world));
    token = await tokenFor(app);
  });

  test('PUT: ไม่พบ → 404 · ชื่อซ้ำของรายการอื่น → 409 · สำเร็จ → 200 เปลี่ยนจริง', async () => {
    const missing = await request(app)
      .put('/api/v1/roles/999')
      .set(authHeader(token))
      .send({ role_name: 'NEWNAME' });
    expect(missing.status).toBe(404);

    const conflict = await request(app)
      .put('/api/v1/roles/3')
      .set(authHeader(token))
      .send({ role_name: 'ADMIN' });
    expect(conflict.status).toBe(409);

    const ok = await request(app)
      .put('/api/v1/roles/2')
      .set(authHeader(token))
      .send({ role_name: 'OFFICER', description: 'เจ้าหน้าที่', is_active: 1 });
    expect(ok.status).toBe(200);
    expect(ok.body.message).toBe('แก้ไขบทบาทสำเร็จ มีผลกับการเข้าสู่ระบบครั้งถัดไป');
    expect(ok.body.data).toEqual({ role_id: 2, role_name: 'OFFICER', description: 'เจ้าหน้าที่', is_active: 1 });
    expect(world.state.appRoles.find((r) => r.ROLE_ID === 2).ROLE_NAME).toBe('OFFICER');
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  test('PUT ไม่ส่ง is_active → คงค่าเดิม (ไม่พลิก is_active ของบทบาทที่ปิดอยู่)', async () => {
    const res = await request(app)
      .put('/api/v1/roles/4')
      .set(authHeader(token))
      .send({ role_name: 'LEGACY2' });
    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(0);
  });

  test('DELETE: ยังมีพนักงานใช้ → 422 ไม่ลบ · ไม่พบ → 404 · ว่าง → 200 ลบจริง', async () => {
    world.state.roleHeadcount.set(2, 3);
    const blocked = await request(app).delete('/api/v1/roles/2').set(authHeader(token));
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.message).toBe('ยังมีพนักงานที่ใช้บทบาทนี้อยู่ กรุณาปลดบทบาทออกก่อน');
    expect(world.repos.role.remove).not.toHaveBeenCalled();

    const missing = await request(app).delete('/api/v1/roles/999').set(authHeader(token));
    expect(missing.status).toBe(404);

    world.state.roleHeadcount.set(2, 0);
    const ok = await request(app).delete('/api/v1/roles/2').set(authHeader(token));
    expect(ok.status).toBe(200);
    expect(ok.body.message).toBe('ลบบทบาทสำเร็จ');
    expect(world.state.appRoles.find((r) => r.ROLE_ID === 2)).toBeUndefined();
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });
});

// ================================================================ UC-08 permissions
describe('T-020 GET/POST /api/v1/permissions (UC-08)', () => {
  let world;
  let app;
  let conn;
  let token;

  beforeEach(async () => {
    world = createWorld();
    ({ app, conn } = setup(world));
    token = await tokenFor(app);
  });

  test('GET 200: ลำดับคงที่ module→sort_no→perm_id + meta + snake_case', async () => {
    const res = await request(app).get('/api/v1/permissions').set(authHeader(token));
    expect(res.status).toBe(200);
    // ORDER BY module, sort_no, perm_id → booking < front < master (alphabetical)
    expect(res.body.data.map((p) => p.perm_id)).toEqual([4, 3, 1, 2]);
    const roleEdit = res.body.data.find((p) => p.perm_code === 'ROLE.EDIT');
    expect(roleEdit).toEqual({
      perm_id: 2,
      perm_code: 'ROLE.EDIT',
      perm_name: 'จัดการบทบาทและสิทธิ์',
      module: 'master',
      screen_key: 'ROLE_MATRIX',
      sort_no: 14,
    });
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 4, total_pages: 1 });
  });

  test('GET ?module=front กรองได้ · module ผิด enum → เมิน (ไม่ 400) · clamp', async () => {
    const front = await request(app).get('/api/v1/permissions?module=front').set(authHeader(token));
    expect(front.status).toBe(200);
    expect(front.body.data.map((p) => p.perm_code)).toEqual(['ROUTE.VIEW']);
    expect(world.repos.permission.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ module: 'front' }),
    );

    const bogus = await request(app).get('/api/v1/permissions?module=bogus').set(authHeader(token));
    expect(bogus.status).toBe(200);
    expect(bogus.body.meta.total).toBe(4);
    expect(world.repos.permission.list).not.toHaveBeenCalledWith(
      expect.objectContaining({ module: 'bogus' }),
    );

    const clamped = await request(app)
      .get('/api/v1/permissions?page=-3&limit=1000')
      .set(authHeader(token));
    expect(clamped.body.meta).toEqual({ page: 1, limit: 100, total: 4, total_pages: 1 });
  });

  test('POST 201 + commit จริง · dup perm_code → 409 · 400 ตาม validate', async () => {
    const ok = await request(app)
      .post('/api/v1/permissions')
      .set(authHeader(token))
      .send({ perm_code: 'ROUTE.EDIT', perm_name: 'จัดการเส้นทาง', module: 'front', screen_key: 'ROUTE_FORM', sort_no: 21 });
    expect(ok.status).toBe(201);
    expect(ok.body.message).toBe('เพิ่มสิทธิ์สำเร็จ');
    expect(ok.body.data).toEqual({
      perm_id: 50,
      perm_code: 'ROUTE.EDIT',
      perm_name: 'จัดการเส้นทาง',
      module: 'front',
      screen_key: 'ROUTE_FORM',
      sort_no: 21,
    });
    expect(world.repos.permission.insert.mock.calls[0][0]).toBe(conn);
    expect(conn.commit).toHaveBeenCalledTimes(1);

    const dup = await request(app)
      .post('/api/v1/permissions')
      .set(authHeader(token))
      .send({ perm_code: 'EMP.VIEW', perm_name: 'ซ้ำ', module: 'master' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toBe('รหัสสิทธิ์นี้มีอยู่แล้ว');

    const badModule = await request(app)
      .post('/api/v1/permissions')
      .set(authHeader(token))
      .send({ perm_code: 'X.Y', perm_name: 'ทดสอบ', module: 'nope' });
    expect(badModule.status).toBe(400);
    expect(badModule.body.error.details[0].field).toBe('module');
    expect(badModule.body.error.details[0].message).toContain('must be one of');

    const missing = await request(app)
      .post('/api/v1/permissions')
      .set(authHeader(token))
      .send({ perm_name: 'ไม่มี code', module: 'master' });
    expect(missing.status).toBe(400);
    expect(missing.body.error.details[0].field).toBe('perm_code');
  });
});

// ================================================================ UC-09 permission matrix
describe('T-021 PUT /api/v1/permission-matrix (UC-09)', () => {
  let world;
  let app;
  let conn;
  let token;

  beforeEach(async () => {
    world = createWorld();
    ({ app, conn } = setup(world));
    token = await tokenFor(app);
  });

  test('200: DELETE สิทธิ์ที่ถอด + MERGE สิทธิ์ใหม่ ใน transaction เดียว + ข้อความตามสเปก', async () => {
    const res = await request(app)
      .put('/api/v1/permission-matrix')
      .set(authHeader(token))
      .send({ role_id: 2, perm_ids: [1, 3] });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('บันทึกแล้ว มีผลกับการ Login ครั้งถัดไป');
    expect(res.body.data).toEqual({ role_id: 2, granted_count: 2 });

    expect(world.repos.role.deleteGrantsExcept).toHaveBeenCalledTimes(1);
    expect(world.repos.role.deleteGrantsExcept.mock.calls[0][0]).toBe(conn);
    expect(world.repos.role.deleteGrantsExcept.mock.calls[0][1]).toEqual({
      roleId: 2,
      permIds: [1, 3],
    });
    expect(world.repos.role.mergeGrant).toHaveBeenCalledTimes(2);
    expect(world.repos.role.mergeGrant.mock.calls[0][0]).toBe(conn);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    expect([...world.state.grants.get(2)]).toEqual([1, 3]);
  });

  test('perm_ids ซ้ำ → นับครั้งเดียว · ว่าง = ถอดทั้งหมด (ไม่เรียก MERGE)', async () => {
    const dedup = await request(app)
      .put('/api/v1/permission-matrix')
      .set(authHeader(token))
      .send({ role_id: 3, perm_ids: [3, 3, 1] });
    expect(dedup.status).toBe(200);
    expect(dedup.body.data.granted_count).toBe(2);

    const revokeAll = await request(app)
      .put('/api/v1/permission-matrix')
      .set(authHeader(token))
      .send({ role_id: 2, perm_ids: [] });
    expect(revokeAll.status).toBe(200);
    expect(revokeAll.body.data).toEqual({ role_id: 2, granted_count: 0 });
    expect(world.repos.role.deleteGrantsExcept).toHaveBeenLastCalledWith(conn, {
      roleId: 2,
      permIds: [],
    });
    expect([...world.state.grants.get(2)]).toEqual([]);
  });

  test('role ไม่พบ → 404 · perm ไม่พบ → 422 ไม่แตะ transaction', async () => {
    const noRole = await request(app)
      .put('/api/v1/permission-matrix')
      .set(authHeader(token))
      .send({ role_id: 999, perm_ids: [1] });
    expect(noRole.status).toBe(404);

    const noPerm = await request(app)
      .put('/api/v1/permission-matrix')
      .set(authHeader(token))
      .send({ role_id: 2, perm_ids: [1, 9999] });
    expect(noPerm.status).toBe(422);
    expect(noPerm.body.error.message).toBe('ข้อมูลอ้างอิงไม่ถูกต้อง (ไม่พบสิทธิ์ที่ระบุ)');
    expect(world.repos.role.deleteGrantsExcept).not.toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
  });

  test('perm_ids ผิดรูป → 400 details · ไม่เข้า transaction', async () => {
    const items = await request(app)
      .put('/api/v1/permission-matrix')
      .set(authHeader(token))
      .send({ role_id: 2, perm_ids: ['x', 2.5] });
    expect(items.status).toBe(400);
    expect(items.body.error.code).toBe('VALIDATION_ERROR');
    expect(items.body.error.details[0]).toEqual({
      field: 'perm_ids',
      message: 'must be an array of positive integers',
    });

    const notArray = await request(app)
      .put('/api/v1/permission-matrix')
      .set(authHeader(token))
      .send({ role_id: 2, perm_ids: 'nope' });
    expect(notArray.status).toBe(400);
    expect(notArray.body.error.details[0].field).toBe('perm_ids');

    const missing = await request(app)
      .put('/api/v1/permission-matrix')
      .set(authHeader(token))
      .send({ role_id: 2 });
    expect(missing.status).toBe(400);
    expect(conn.commit).not.toHaveBeenCalled();
  });

  test('statement ใดล้ม → rollback ทั้งชุด + 500 sanitized ไม่ leak · ตารางติ๊กเดิมคงอยู่', async () => {
    world.repos.role.deleteGrantsExcept.mockRejectedValueOnce(new Error('OraBoom-SENSITIVE'));
    const res = await request(app)
      .put('/api/v1/permission-matrix')
      .set(authHeader(token))
      .send({ role_id: 2, perm_ids: [1, 2, 3] });
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).toBe('เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง');
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('OraBoom-SENSITIVE');
    expect(raw).not.toContain('stack');
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect([...world.state.grants.get(2)]).toEqual([1]);
  });
});

// ================================================================ T-022 dynamic RBAC
describe('T-022 Dynamic RBAC ทุก protected endpoint (ไม่มี role-name bypass)', () => {
  let world;
  let app;
  let conn;
  let adminToken;

  beforeEach(async () => {
    world = createWorld();
    ({ app, conn } = setup(world));
    adminToken = await tokenFor(app);
  });

  const PROTECTED = [
    ['get', '/api/v1/roles'],
    ['post', '/api/v1/roles'],
    ['put', '/api/v1/roles/1'],
    ['delete', '/api/v1/roles/1'],
    ['get', '/api/v1/permissions'],
    ['post', '/api/v1/permissions'],
    ['put', '/api/v1/permission-matrix'],
  ];

  test('ไม่มี token → 401 ทั้ง 7 endpoint', async () => {
    for (const [method, path] of PROTECTED) {
      const res = await request(app)[method](path).send({});
      expect([method, path, res.status]).toEqual([method, path, 401]);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  test('มี token แต่ไม่มี ROLE.EDIT → 403 ทั้ง 7 endpoint', async () => {
    const viewerToken = await tokenFor(app, 'viewer', VIEWER_PASS);
    for (const [method, path] of PROTECTED) {
      const res = await request(app)[method](path).set(authHeader(viewerToken)).send({});
      expect([method, path, res.status]).toEqual([method, path, 403]);
      expect(res.body.error.message).toBe('ไม่มีสิทธิ์เข้าถึงส่วนนี้');
    }
    expect(world.repos.role.insert).not.toHaveBeenCalled();
    expect(conn?.commit).not.toHaveBeenCalled();
  });

  test('สิทธิ์อ่านจาก DB ทุก request — ถอดสิทธิ์ระหว่าง session → 403 ทันที ไม่ต้อง login ใหม่', async () => {
    const before = await request(app).get('/api/v1/roles').set(authHeader(adminToken));
    expect(before.status).toBe(200);

    world.state.permissions.set(1, ['EMP.VIEW']); // ถอด ROLE.EDIT ออกจากผู้ใช้ 1

    const after = await request(app).get('/api/v1/roles').set(authHeader(adminToken));
    expect(after.status).toBe(403);
    expect(world.repos.auth.loadPermissions).toHaveBeenCalled();
    const calls = world.repos.auth.loadPermissions.mock.calls.filter((c) => c[0] === 1);
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  test('ชื่อบทบาทไม่มีผล — มีสิทธิ์ ROLE.EDIT แม้ role ไม่ใช่ ADMIN ก็ผ่าน', async () => {
    const ghostToken = await tokenFor(app, 'ghost', GHOST_PASS);
    const res = await request(app).get('/api/v1/roles').set(authHeader(ghostToken));
    expect(res.status).toBe(200);
    // ในขณะเดียวกันผู้ใช้ที่มี role เป็น STAFF (ชื่อเหมือนในระบบ) แต่ไม่มีสิทธิ์ → 403 (test ข้างบน)
  });

  test('ขอบเขตสิทธิ์ไม่เบียดกัน — viewer ยังใช้ /employees (EMP.VIEW) ได้ แต่ /roles ไม่ได้', async () => {
    const viewerToken = await tokenFor(app, 'viewer', VIEWER_PASS);
    const allowed = await request(app).get('/api/v1/employees').set(authHeader(viewerToken));
    expect(allowed.status).toBe(200);
    const denied = await request(app).get('/api/v1/roles').set(authHeader(viewerToken));
    expect(denied.status).toBe(403);
  });

  test('P-12 static scan: ไม่มีการตัดสินสิทธิ์จากชื่อบทบาทในไฟล์ src ใด ๆ', () => {
    const srcRoot = path.join(__dirname, '..', 'src');
    const files = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.js')) files.push(full);
      }
    })(srcRoot);
    expect(files.length).toBeGreaterThan(15);
    const hardcodePattern = /role\s*===?\s*['"]|isAdmin|isStaff/i;
    const offenders = [];
    for (const file of files) {
      fs.readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (hardcodePattern.test(line)) {
            offenders.push(`${path.basename(file)}:${index + 1}: ${line.trim()}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });

  test('T-022 wiring: requirePermission อ่าน DB ทุก request + rbac routes ใช้ ROLE.EDIT', () => {
    const authSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'middleware', 'auth.js'), 'utf8');
    expect(authSource).toContain('repos.auth.loadPermissions(req.user.empId)');
    const rbacSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'rbac.routes.js'), 'utf8');
    expect(rbacSource).toContain("requirePermission('ROLE.EDIT')");
    const rbacLines = rbacSource.split('\n').filter((l) => l.includes('router.'));
    expect(rbacLines.length).toBeGreaterThanOrEqual(7);
  });

  test('Q22/Q24 ยัง blocked — ไม่มี endpoint ที่สเปกไม่ได้ประกาศ', async () => {
    const blocked = [
      ['put', '/api/v1/permissions/1', { perm_name: 'x' }],
      ['delete', '/api/v1/permissions/1', undefined],
      ['put', '/api/v1/employees/1/roles', { role_ids: [1] }],
      ['post', '/api/v1/employees/1/roles', { role_id: 1 }],
      ['get', '/api/v1/permission-matrix', undefined],
    ];
    for (const [method, path, body] of blocked) {
      const res = await request(app)[method](path).set(authHeader(adminToken)).send(body);
      expect([method, path, res.status]).toEqual([method, path, 404]);
    }
  });
});

// ================================================================ repository SQL
describe('repository SQL — bind variables, ไม่ใช้ SELECT *, ไม่ hardcode ชื่อบทบาท', () => {
  beforeEach(() => {
    dbMock.query.mockReset();
  });

  const NO_SELECT_STAR = /SELECT\s+\*/i;

  test('role.list: OFFSET/FETCH + isActive เป็น bind, ไม่กรองเมื่อไม่ส่งค่า', async () => {
    dbMock.query.mockResolvedValue({ rows: [] });
    await roleRepo.list({ isActive: 1, limit: 10, offset: 5 });
    let [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).not.toMatch(NO_SELECT_STAR);
    expect(sql).toContain('ORDER BY r.role_id');
    expect(sql).toContain(':offset');
    expect(sql).toContain(':limit');
    expect(binds).toEqual({ offset: 5, limit: 10, isActive: 1 });

    dbMock.query.mockClear();
    await roleRepo.list({ limit: 20, offset: 0 });
    [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).not.toContain(':isActive');
    expect(binds).toEqual({ offset: 0, limit: 20 });
  });

  test('role.insert: RETURNING id + ค่าเป็น bind (กัน interpolation)', async () => {
    const conn = { execute: jest.fn(async () => ({ outBinds: { newId: 7 } })) };
    await roleRepo.insert(conn, {
      roleName: "X' OR '1'='1",
      description: null,
      isActive: 1,
    });
    const [sql, binds] = conn.execute.mock.calls[0];
    expect(sql).toContain('RETURNING role_id INTO :newId');
    expect(binds.roleName).toBe("X' OR '1'='1");
    expect(sql).not.toContain("'1'='1'");
    expect(binds.newId).toMatchObject({ dir: expect.any(Number) });
  });

  test('role.count/findById/countEmployeesWithRole: bind + ไม่ SELECT *', async () => {
    dbMock.query.mockResolvedValue({ rows: [{ TOTAL: 0 }] });
    await roleRepo.count({ isActive: 0 });
    expect(dbMock.query.mock.calls[0][1]).toEqual({ isActive: 0 });

    await roleRepo.findById(3);
    expect(dbMock.query.mock.calls[1]).toEqual([
      expect.stringContaining('WHERE role_id = :roleId'),
      { roleId: 3 },
    ]);

    await roleRepo.countEmployeesWithRole(4);
    expect(dbMock.query.mock.calls[2][1]).toEqual({ roleId: 4 });
    for (const [sql] of dbMock.query.mock.calls) expect(sql).not.toMatch(NO_SELECT_STAR);
  });

  test('deleteGrantsExcept: NOT IN ด้วย bind p0,p1 — ค่าไม่ต่อเข้า SQL · ว่าง = ลบทั้งหมด', async () => {
    const conn = { execute: jest.fn(async () => ({ rowsAffected: 0 })) };
    await roleRepo.deleteGrantsExcept(conn, { roleId: 2, permIds: [777, 888] });
    let [sql, binds] = conn.execute.mock.calls[0];
    expect(sql).toContain(':p0');
    expect(sql).toContain(':p1');
    expect(sql).not.toContain('777');
    expect(sql).not.toContain('888');
    expect(binds).toEqual({ roleId: 2, p0: 777, p1: 888 });

    await roleRepo.deleteGrantsExcept(conn, { roleId: 2, permIds: [] });
    [sql, binds] = conn.execute.mock.calls[1];
    expect(sql).toContain('DELETE FROM role_permission WHERE role_id = :roleId');
    expect(binds).toEqual({ roleId: 2 });
  });

  test('mergeGrant: MERGE bind :roleId/:permId — ไม่มีค่าจริงใน SQL', async () => {
    const conn = { execute: jest.fn(async () => ({ rowsAffected: 1 })) };
    await roleRepo.mergeGrant(conn, { roleId: 777, permId: 888 });
    const [sql, binds] = conn.execute.mock.calls[0];
    expect(sql).toContain('MERGE INTO role_permission');
    expect(sql).not.toContain('777');
    expect(sql).not.toContain('888');
    expect(binds).toEqual({ roleId: 777, permId: 888 });
  });

  test('permission.list: ORDER BY module, sort_no, perm_id + module bind ไม่ SELECT *', async () => {
    dbMock.query.mockResolvedValue({ rows: [] });
    await permissionRepo.list({ module: 'front', limit: 10, offset: 0 });
    const [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).toContain('ORDER BY module, sort_no, perm_id');
    expect(sql).not.toMatch(NO_SELECT_STAR);
    expect(binds).toEqual({ module: 'front', offset: 0, limit: 10 });
  });

  test('permission.insert: RETURNING id + bind · findByIds: bind p0,p1 ไม่ interpolation', async () => {
    const conn = { execute: jest.fn(async () => ({ outBinds: { newId: 9 } })) };
    await permissionRepo.insert(conn, {
      permCode: 'ROUTE.EDIT',
      permName: 'แก้ไขเส้นทาง',
      module: 'front',
      screenKey: null,
      sortNo: 21,
    });
    const [insertSql, insertBinds] = conn.execute.mock.calls[0];
    expect(insertSql).toContain('RETURNING perm_id INTO :newId');
    expect(insertBinds.permCode).toBe('ROUTE.EDIT');
    expect(insertBinds.screenKey).toBeNull();

    dbMock.query.mockResolvedValue({ rows: [] });
    await permissionRepo.findByIds([777, 888]);
    const [findSql, findBinds] = dbMock.query.mock.calls[0];
    expect(findSql).not.toContain('777');
    expect(findSql).not.toContain('888');
    expect(findBinds).toEqual({ p0: 777, p1: 888 });
  });

  test('loadPermissions: DISTINCT + กรอง is_active + ไม่ hardcode ชื่อบทบาทใน SQL', async () => {
    dbMock.query.mockResolvedValue({ rows: [] });
    await authRepo.loadPermissions(1);
    const [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).toContain('DISTINCT');
    expect(sql).toContain('e.is_active = 1');
    expect(sql).toContain('r.is_active = 1');
    expect(binds).toEqual({ empId: 1 });
    expect(sql).not.toMatch(NO_SELECT_STAR);
    expect(sql).not.toMatch(/'(ADMIN|STAFF|DRIVER|CUSTOMER)'/);
  });
});
