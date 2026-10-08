// backend/tests/sprint04.test.js — Sprint 4 (T-015 / T-016) regression tests
// ครอบคลุม: JWT login/logout/me/change-password + token_blacklist, RBAC จาก DB,
//           employee/department/position CRUD, validation, bcrypt, disabled account,
//           transaction rollback, error envelope (OpenAPI + legacy), และ SQL แบบ bind variables
// สถาปัตยกรรม: inject fake repos + fake connection เข้า createApp (ไม่แตะ Oracle จริง)
//               แต่ transaction runner / SQL ของ repository เป็นโค้ดจริงที่ assert ผ่าน spy

process.env.JWT_SECRET = 'sprint04-test-secret-0123456789abcdef0123456789abcdef';
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
const jwt = require('jsonwebtoken');

const { createApp } = require('../src/app');
const env = require('../src/config/env');
const dbMock = require('../src/config/db');
const { resetLoginAttempts } = require('../src/middleware/auth');
const { signToken, verifyToken, markerJti } = require('../src/utils/token');
const authRepo = require('../src/repositories/auth.repository');
const employeeRepo = require('../src/repositories/employee.repository');
const departmentRepo = require('../src/repositories/department.repository');

const ADMIN_PERMISSIONS = ['EMP.VIEW', 'EMP.EDIT', 'DEPT.EDIT', 'POS.EDIT'];
const ADMIN_MENUS = [
  { SCREEN_KEY: 'EMP_LIST', MENU_LABEL: 'พนักงาน', SORT_NO: 10 },
  { SCREEN_KEY: 'DEPT_LIST', MENU_LABEL: 'แผนก', SORT_NO: 12 },
];

const ADMIN_PASS = 'AdminPass123';
const VIEWER_PASS = 'ViewerPass123';

// ---------------------------------------------------------------- fake world
function createWorld() {
  const profiles = new Map();
  const credentials = new Map();
  const permissions = new Map();
  const menus = new Map();
  const roles = new Map();
  const revoked = [];
  const departments = [
    { DEPT_ID: 1, DEPT_NAME: 'ฝ่ายบริหาร', CREATED_AT: new Date('2026-01-05T08:00:00.000Z') },
    { DEPT_ID: 2, DEPT_NAME: 'ฝ่ายวิศวกรรม', CREATED_AT: new Date('2026-01-05T08:00:01.000Z') },
  ];
  const positions = [
    { POSITION_ID: 1, POSITION_NAME: 'ผู้ดูแลระบบ' },
    { POSITION_ID: 2, POSITION_NAME: 'วิศวกร' },
  ];
  const bookings = new Map();
  const deptHeadcount = new Map();
  const posHeadcount = new Map();
  let nextEmpId = 100;
  let nextDeptId = 50;
  let nextPosId = 50;

  function addEmployee(o) {
    const row = {
      EMP_ID: o.empId,
      EMP_CODE: o.empCode || `EMP${String(o.empId).padStart(3, '0')}`,
      FIRST_NAME: o.firstName || 'ทดสอบ',
      LAST_NAME: o.lastName || 'ระบบ',
      PHONE: o.phone ?? null,
      EMAIL: o.email ?? null,
      DEPT_ID: o.deptId ?? null,
      DEPT_NAME: o.deptName ?? null,
      POSITION_ID: o.positionId ?? null,
      POSITION_NAME: o.positionName ?? null,
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

  function matchQ(row, q, columns) {
    if (!q) return true;
    const needle = String(q).toLowerCase();
    return columns.some((col) => String(row[col] ?? '').toLowerCase().includes(needle));
  }

  function filterEmployees({ q, deptId, isActive } = {}) {
    return [...profiles.values()].filter((row) => {
      if (!matchQ(row, q, ['FIRST_NAME', 'LAST_NAME', 'EMP_CODE', 'USERNAME'])) return false;
      if (deptId !== undefined && row.DEPT_ID !== Number(deptId)) return false;
      if (isActive !== undefined && row.IS_ACTIVE !== Number(isActive)) return false;
      return true;
    });
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
      blacklistToken: jest.fn(async ({ jti, empId, expiresAt }) => {
        const existing = revoked.find((r) => r.JTI === jti);
        if (existing) {
          existing.EXPIRES_AT = expiresAt;
          existing.REVOKED_AT = new Date();
        } else {
          revoked.push({ JTI: jti, EMP_ID: empId, EXPIRES_AT: expiresAt, REVOKED_AT: new Date() });
        }
      }),
      deleteExpiredBlacklist: jest.fn(async (empId) => {
        for (let i = revoked.length - 1; i >= 0; i -= 1) {
          if (revoked[i].EMP_ID === Number(empId) && revoked[i].EXPIRES_AT < new Date()) revoked.splice(i, 1);
        }
      }),
    },
    employee: {
      findEmployeeById: jest.fn(async (empId) => profiles.get(Number(empId)) || null),
      listEmployees: jest.fn(async ({ q, deptId, isActive, limit, offset } = {}) =>
        filterEmployees({ q, deptId, isActive }).slice(offset, offset + limit),
      ),
      countEmployees: jest.fn(async (filters = {}) => filterEmployees(filters).length),
      findByUsername: jest.fn(
        async (username, excludeEmpId) =>
          [...profiles.values()].find((r) => r.USERNAME === username && r.EMP_ID !== excludeEmpId) || null,
      ),
      findByEmpCode: jest.fn(
        async (empCode, excludeEmpId) =>
          [...profiles.values()].find((r) => r.EMP_CODE === empCode && r.EMP_ID !== excludeEmpId) || null,
      ),
      insertEmployee: jest.fn(async (conn, data) => {
        const empId = nextEmpId;
        nextEmpId += 1;
        const dept = departments.find((d) => d.DEPT_ID === Number(data.dept_id));
        const pos = positions.find((p) => p.POSITION_ID === Number(data.position_id));
        profiles.set(empId, {
          EMP_ID: empId,
          EMP_CODE: data.emp_code,
          FIRST_NAME: data.first_name,
          LAST_NAME: data.last_name,
          PHONE: data.phone ?? null,
          EMAIL: data.email ?? null,
          DEPT_ID: Number(data.dept_id),
          DEPT_NAME: dept ? dept.DEPT_NAME : null,
          POSITION_ID: Number(data.position_id),
          POSITION_NAME: pos ? pos.POSITION_NAME : null,
          USERNAME: data.username,
          IS_ACTIVE: data.is_active === undefined ? 1 : data.is_active,
          CREATED_AT: new Date('2026-02-01T00:00:00.000Z'),
          ROLES: '',
        });
        credentials.set(empId, {
          EMP_ID: empId,
          USERNAME: data.username,
          PASSWORD_HASH: data.password_hash,
          IS_ACTIVE: data.is_active === undefined ? 1 : data.is_active,
        });
        permissions.set(empId, []);
        menus.set(empId, []);
        roles.set(empId, []);
        return empId;
      }),
      updateEmployee: jest.fn(async (conn, { empId, data }) => {
        const row = profiles.get(Number(empId));
        const columnByKey = {
          emp_code: 'EMP_CODE',
          first_name: 'FIRST_NAME',
          last_name: 'LAST_NAME',
          phone: 'PHONE',
          email: 'EMAIL',
          dept_id: 'DEPT_ID',
          position_id: 'POSITION_ID',
          username: 'USERNAME',
          is_active: 'IS_ACTIVE',
        };
        for (const [key, column] of Object.entries(columnByKey)) {
          if (Object.prototype.hasOwnProperty.call(data, key)) row[column] = data[key];
        }
        const cred = credentials.get(Number(empId));
        if (cred && Object.prototype.hasOwnProperty.call(data, 'is_active')) cred.IS_ACTIVE = data.is_active;
        return 1;
      }),
      deleteEmployee: jest.fn(async (conn, empId) => {
        profiles.delete(Number(empId));
        credentials.delete(Number(empId));
        permissions.delete(Number(empId));
        menus.delete(Number(empId));
        roles.delete(Number(empId));
        return 1;
      }),
      updatePassword: jest.fn(async (conn, { empId, passwordHash }) => {
        credentials.get(Number(empId)).PASSWORD_HASH = passwordHash;
      }),
      countBookingsForEmployee: jest.fn(async (empId) => bookings.get(Number(empId)) || 0),
      countInDepartment: jest.fn(async (deptId) => deptHeadcount.get(Number(deptId)) || 0),
      countInPosition: jest.fn(async (positionId) => posHeadcount.get(Number(positionId)) || 0),
    },
    department: {
      list: jest.fn(async ({ q, limit, offset } = {}) =>
        departments
          .filter((d) => !q || d.DEPT_NAME.includes(q))
          .slice(offset, offset + limit),
      ),
      count: jest.fn(async ({ q } = {}) => departments.filter((d) => !q || d.DEPT_NAME.includes(q)).length),
      findById: jest.fn(async (deptId) => departments.find((d) => d.DEPT_ID === Number(deptId)) || null),
      findByName: jest.fn(
        async (deptName, excludeDeptId) =>
          departments.find((d) => d.DEPT_NAME === deptName && d.DEPT_ID !== excludeDeptId) || null,
      ),
      insert: jest.fn(async (conn, { deptName }) => {
        const deptId = nextDeptId;
        nextDeptId += 1;
        departments.push({ DEPT_ID: deptId, DEPT_NAME: deptName, CREATED_AT: new Date('2026-02-01T00:00:00.000Z') });
        return deptId;
      }),
      update: jest.fn(async (conn, { deptId, deptName }) => {
        departments.find((d) => d.DEPT_ID === Number(deptId)).DEPT_NAME = deptName;
        return 1;
      }),
      remove: jest.fn(async (conn, { deptId }) => {
        const idx = departments.findIndex((d) => d.DEPT_ID === Number(deptId));
        if (idx >= 0) departments.splice(idx, 1);
        return 1;
      }),
    },
    position: {
      list: jest.fn(async ({ q, limit, offset } = {}) =>
        positions.filter((p) => !q || p.POSITION_NAME.includes(q)).slice(offset, offset + limit),
      ),
      count: jest.fn(async ({ q } = {}) => positions.filter((p) => !q || p.POSITION_NAME.includes(q)).length),
      findById: jest.fn(async (positionId) => positions.find((p) => p.POSITION_ID === Number(positionId)) || null),
      findByName: jest.fn(
        async (positionName, excludePositionId) =>
          positions.find((p) => p.POSITION_NAME === positionName && p.POSITION_ID !== excludePositionId) || null,
      ),
      insert: jest.fn(async (conn, { positionName }) => {
        const positionId = nextPosId;
        nextPosId += 1;
        positions.push({ POSITION_ID: positionId, POSITION_NAME: positionName });
        return positionId;
      }),
      update: jest.fn(async (conn, { positionId, positionName }) => {
        positions.find((p) => p.POSITION_ID === Number(positionId)).POSITION_NAME = positionName;
        return 1;
      }),
      remove: jest.fn(async (conn, { positionId }) => {
        const idx = positions.findIndex((p) => p.POSITION_ID === Number(positionId));
        if (idx >= 0) positions.splice(idx, 1);
        return 1;
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
    permissions: ADMIN_PERMISSIONS,
    menus: ADMIN_MENUS,
    deptId: 1,
    deptName: 'ฝ่ายบริหาร',
    positionId: 1,
    positionName: 'ผู้ดูแลระบบ',
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
    deptId: 2,
    deptName: 'ฝ่ายวิศวกรรม',
    positionId: 2,
    positionName: 'วิศวกร',
  });
  addEmployee({
    empId: 3,
    username: 'disabled1',
    empCode: 'EMP003',
    firstName: 'ปิด',
    lastName: 'ใช้งาน',
    isActive: 0,
    passwordHash: bcrypt.hashSync('DisabledPass123', 4),
    permissions: ['EMP.VIEW'],
  });
  addEmployee({
    empId: 4,
    username: 'noperm',
    empCode: 'EMP004',
    firstName: 'ไม่มี',
    lastName: 'สิทธิ์',
    passwordHash: bcrypt.hashSync('NoPermPass123', 4),
  });

  return {
    repos,
    state: { profiles, credentials, permissions, menus, roles, revoked, departments, positions, bookings, deptHeadcount, posHeadcount, addEmployee },
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

async function waitFor(check, timeoutMs = 500) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return check();
}

beforeEach(() => {
  resetLoginAttempts();
});

// ================================================================ UC-01 login
describe('T-015 POST /api/v1/auth/login (UC-01)', () => {
  let world;
  let app;

  beforeEach(() => {
    world = createWorld();
    ({ app } = setup(world));
  });

  test('สำเร็จ: คืน access_token, expires_in=7200, employee, permissions, menus โดยไม่มี password/hash ใน response', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: ADMIN_PASS });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('เข้าสู่ระบบสำเร็จ');
    expect(res.body.data.token_type).toBe('Bearer');
    expect(res.body.data.expires_in).toBe(7200);
    expect(res.body.data.employee).toMatchObject({ emp_id: 1, username: 'admin', is_active: 1, roles: ['ADMIN'] });
    expect(res.body.data.permissions).toEqual(expect.arrayContaining(ADMIN_PERMISSIONS));
    expect(res.body.data.menus[0]).toEqual({ screen_key: 'EMP_LIST', label: 'พนักงาน', icon: null, sort_no: 10 });

    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/password/i);
    expect(raw).not.toContain('$2b$');

    const payload = verifyToken(res.body.data.access_token);
    expect(payload.empId).toBe(1);
    expect(payload.jti).toEqual(expect.any(String));
    expect(payload.exp - payload.iat).toBe(7200);
    expect(payload.iss).toBe(env.jwt.issuer);
  });

  test('ผู้ใช้ไม่ทราบรหัสผ่าน vs รหัสผ่านผิด → 401 ข้อความเดียวกันทั้งคู่ (ไม่บอกว่าอะไรผิด)', async () => {
    const unknown = await request(app).post('/api/v1/auth/login').send({ username: 'ghost', password: 'Whatever123' });
    const wrong = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'WrongPass123' });

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error).toEqual({ code: 'INVALID_CREDENTIALS', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    expect(wrong.body.error).toEqual({ code: 'INVALID_CREDENTIALS', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    expect(wrong.body.success).toBe(false);
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
  });

  test('บัญชีถูกปิดใช้งาน (is_active=0) → 401 ACCOUNT_DISABLED แม้รหัสผ่านถูกต้อง', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ username: 'disabled1', password: 'DisabledPass123' });
    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({ code: 'ACCOUNT_DISABLED', message: 'บัญชีถูกปิดใช้งาน' });
  });

  test('password_hash รูปแบบผิด (เช่น placeholder ของ seed) → 401 ไม่ใช่ 500', async () => {
    world.state.addEmployee({
      empId: 55,
      username: 'brokenhash',
      empCode: 'EMP055',
      passwordHash: '$2b$10$SEEDPLACEHOLDERNOTAVALIDHASH',
    });
    const res = await request(app).post('/api/v1/auth/login').send({ username: 'brokenhash', password: 'Whatever123' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('password สั้นกว่า 8 ตัว → 400 VALIDATION_ERROR พร้อม details และ legacy errors', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0]).toMatchObject({ field: 'password' });
    expect(res.body.errors[0]).toContain('password');
  });

  test('rate limit: ผิด 5 ครั้งติด → ครั้งที่ 6 ตอบ 429 ก่อนถึง DB และ reset ได้', async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'BadPass9999' });
      expect(res.status).toBe(401);
    }
    const blocked = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: ADMIN_PASS });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_ATTEMPTS');
    expect(blocked.body.error.message).toBe('พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่');
    expect(world.repos.auth.findLoginUser).toHaveBeenCalledTimes(5);

    resetLoginAttempts();
    const afterReset = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: ADMIN_PASS });
    expect(afterReset.status).toBe(200);
  });

  test('ผู้ใช้ไม่มีสิทธิ์เลย → 200 แต่ permissions/menus ว่าง (UC-01 A3)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ username: 'noperm', password: 'NoPermPass123' });
    expect(res.status).toBe(200);
    expect(res.body.data.permissions).toEqual([]);
    expect(res.body.data.menus).toEqual([]);
  });
});

// ============================================================ token lifecycle
describe('T-015 /auth/me, /auth/logout, token blacklist (UC-02)', () => {
  let world;
  let app;

  beforeEach(() => {
    world = createWorld();
    ({ app } = setup(world));
  });

  test('GET /auth/me ไม่มี token → 401 UNAUTHORIZED (envelope + legacy)', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      status: 'error',
      code: 'UNAUTHORIZED',
      error: { code: 'UNAUTHORIZED', message: 'กรุณาเข้าสู่ระบบใหม่' },
    });
  });

  test('GET /auth/me มี token → 200 คืน employee/permissions/menus โดยไม่มี password/hash', async () => {
    const token = await tokenFor(app);
    const res = await request(app).get('/api/v1/auth/me').set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.employee).toMatchObject({ emp_id: 1, username: 'admin' });
    expect(res.body.data.permissions).toEqual(expect.arrayContaining(ADMIN_PERMISSIONS));
    expect(res.body.data.menus).toHaveLength(2);
    expect(res.body.data.employee.roles).toEqual(['ADMIN']);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/password/i);
    expect(raw).not.toContain('$2b$');
  });

  test('POST /auth/logout → 200 และ token เดิมใช้ต่อไม่ได้ (เจอใน blacklist)', async () => {
    const token = await tokenFor(app);
    const payload = verifyToken(token);

    const logout = await request(app).post('/api/v1/auth/logout').set(authHeader(token));
    expect(logout.status).toBe(200);
    expect(logout.body).toMatchObject({ success: true, message: 'ออกจากระบบสำเร็จ' });

    const call = world.repos.auth.blacklistToken.mock.calls[0][0];
    expect(call.jti).toBe(payload.jti);
    expect(call.empId).toBe(1);
    expect(call.expiresAt).toBeInstanceOf(Date);
    expect(call.expiresAt.getTime()).toBe(payload.exp * 1000);

    const me = await request(app).get('/api/v1/auth/me').set(authHeader(token));
    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe('TOKEN_REVOKED');
  });

  test('logout ของผู้ใช้หนึ่งไม่กระทบ token ของอีกผู้ใช้', async () => {
    const adminToken = await tokenFor(app);
    const viewerToken = await tokenFor(app, 'viewer', VIEWER_PASS);

    await request(app).post('/api/v1/auth/logout').set(authHeader(adminToken));

    const viewerMe = await request(app).get('/api/v1/auth/me').set(authHeader(viewerToken));
    expect(viewerMe.status).toBe(200);
    const adminMe = await request(app).get('/api/v1/auth/me').set(authHeader(adminToken));
    expect(adminMe.status).toBe(401);
  });

  test('token หมดอายุ / ถูกดัดแปลง / ไม่ใช่ JWT → 401', async () => {
    const expired = jwt.sign({ empId: 1, jti: 'expired-jti' }, process.env.JWT_SECRET, {
      expiresIn: -60,
      issuer: env.jwt.issuer,
    });
    const valid = await tokenFor(app);
    const tampered = `${valid}x`;

    for (const bad of [expired, tampered, 'not-a-jwt']) {
      const res = await request(app).get('/api/v1/auth/me').set(authHeader(bad));
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  test('token ของพนักงานที่ถูกลบ/ไม่มีอยู่ → 401', async () => {
    const ghost = signToken({ empId: 999, jti: 'ghost-jti' });
    const res = await request(app).get('/api/v1/auth/me').set(authHeader(ghost));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('token ยังใช้ได้แต่บัญชีถูกปิดทีหลัง → 403 FORBIDDEN บัญชีถูกปิดใช้งาน', async () => {
    const token = signToken({ empId: 3, jti: 'disabled-jti' });
    const res = await request(app).get('/api/v1/auth/me').set(authHeader(token));
    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({ code: 'FORBIDDEN', message: 'บัญชีถูกปิดใช้งาน' });
  });

  test('audit sink ได้ empId จาก JWT ของผู้เรียก (รวม Sprint 3 + 4)', async () => {
    const { app: app2, auditSink } = setup(world);
    const token = await tokenFor(app2);
    await request(app2).post('/api/v1/auth/logout').set(authHeader(token));
    const seen = await waitFor(() => auditSink.mock.calls.some((c) => c[0].path === '/api/v1/auth/logout'));
    expect(seen).toBe(true);
    const entry = auditSink.mock.calls.find((c) => c[0].path === '/api/v1/auth/logout')[0];
    expect(entry).toMatchObject({ method: 'POST', statusCode: 200, empId: 1 });
  });
});

// ============================================================ RBAC enforcement
describe('T-015/016 authentication + permission enforcement (R-03 / UC-09)', () => {
  let world;
  let app;

  beforeEach(() => {
    world = createWorld();
    ({ app } = setup(world));
  });

  test('ทุก endpoint ใต้ /api/v1 (ยกเว้น login) ต้องมี token', async () => {
    for (const [method, path] of [
      ['get', '/api/v1/employees'],
      ['get', '/api/v1/departments'],
      ['get', '/api/v1/positions'],
      ['get', '/api/v1/auth/me'],
      ['post', '/api/v1/auth/logout'],
      ['put', '/api/v1/employees/1'],
      ['delete', '/api/v1/departments/1'],
    ]) {
      const res = await request(app)[method](path);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  test('มี token แต่ไม่มีสิทธิ์ที่ต้องใช้ → 403 ไม่มีสิทธิ์เข้าถึงส่วนนี้', async () => {
    const viewerToken = await tokenFor(app, 'viewer', VIEWER_PASS);

    const departments = await request(app).get('/api/v1/departments').set(authHeader(viewerToken));
    expect(departments.status).toBe(403);
    expect(departments.body.error).toEqual({ code: 'FORBIDDEN', message: 'ไม่มีสิทธิ์เข้าถึงส่วนนี้' });

    const createEmployee = await request(app)
      .post('/api/v1/employees')
      .set(authHeader(viewerToken))
      .send({ emp_code: 'EMP900', first_name: 'ก', last_name: 'ข', dept_id: 1, position_id: 1, username: 'x', password: 'Password123' });
    expect(createEmployee.status).toBe(403);

    const viewerList = await request(app).get('/api/v1/employees').set(authHeader(viewerToken));
    expect(viewerList.status).toBe(200);
  });

  test('สิทธิ์ถูกโหลดจาก DB ทุก request ไม่มี cache (โหลด 2 ครั้งสำหรับ 2 คำขอ)', async () => {
    const token = await tokenFor(app);
    world.repos.auth.loadPermissions.mockClear();

    await request(app).get('/api/v1/employees').set(authHeader(token));
    await request(app).get('/api/v1/employees').set(authHeader(token));

    expect(world.repos.auth.loadPermissions).toHaveBeenCalledTimes(2);
  });

  test('path ที่ไม่มีจริงใต้ /api/v1 (มี token) → 404 envelope', async () => {
    const token = await tokenFor(app);
    const res = await request(app).get('/api/v1/no-such-path').set(authHeader(token));
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ============================================================ UC-03 change-password
describe('T-015 POST /api/v1/auth/change-password (UC-03 / R-04)', () => {
  let world;
  let app;
  let conn;
  let token;

  beforeEach(async () => {
    world = createWorld();
    ({ app, conn } = setup(world));
    token = await tokenFor(app);
  });

  test('confirm ไม่ตรง → 400 พร้อม details field confirm_password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set(authHeader(token))
      .send({ old_password: ADMIN_PASS, new_password: 'NewPass4567', confirm_password: 'OtherPass4567' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0]).toMatchObject({ field: 'confirm_password' });
  });

  test('new_password สั้นกว่า 8 ตัว → 400 validation', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set(authHeader(token))
      .send({ old_password: ADMIN_PASS, new_password: 'short', confirm_password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('รหัสผ่านเดิมผิด → 401 INVALID_CREDENTIALS รหัสผ่านเดิมไม่ถูกต้อง', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set(authHeader(token))
      .send({ old_password: 'WrongOld123', new_password: 'NewPass4567', confirm_password: 'NewPass4567' });
    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({ code: 'INVALID_CREDENTIALS', message: 'รหัสผ่านเดิมไม่ถูกต้อง' });
  });

  test('สำเร็จ: hash ใหม่ด้วย bcrypt + revoke jti เดิมและ token ทั้งหมดของพนักงานใน transaction เดียว + login ใหม่ได้', async () => {
    const payload = verifyToken(token);
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set(authHeader(token))
      .send({ old_password: ADMIN_PASS, new_password: 'NewPass4567', confirm_password: 'NewPass4567' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่' });

    const [[updateConn, updatePayload]] = world.repos.employee.updatePassword.mock.calls;
    expect(updateConn).toBe(conn);
    expect(updatePayload.empId).toBe(1);
    expect(updatePayload.passwordHash).not.toBe('NewPass4567');
    expect(bcrypt.compareSync('NewPass4567', updatePayload.passwordHash)).toBe(true);

    const blacklistCalls = world.repos.auth.blacklistToken.mock.calls;
    expect(blacklistCalls).toHaveLength(2);
    expect(blacklistCalls[0][0]).toMatchObject({ jti: payload.jti, empId: 1 });
    expect(blacklistCalls[1][0]).toMatchObject({ jti: markerJti(1), empId: 1 });
    expect(blacklistCalls[0][1]).toBe(conn);
    expect(world.repos.auth.deleteExpiredBlacklist).toHaveBeenCalledWith(1, conn);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();

    const oldTokenMe = await request(app).get('/api/v1/auth/me').set(authHeader(token));
    expect(oldTokenMe.status).toBe(401);

    const oldLogin = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: ADMIN_PASS });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'NewPass4567' });
    expect(newLogin.status).toBe(200);
  });

  test('ขั้นตอนท้าย transaction ล้มเหลว → rollback, commit ไม่เกิด, ตอบ 500 sanitized ไม่ leak ข้อความภายใน', async () => {
    world.repos.auth.deleteExpiredBlacklist = jest.fn(async () => {
      throw new Error('simulated step-4 failure');
    });

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set(authHeader(token))
      .send({ old_password: ADMIN_PASS, new_password: 'NewPass4567', confirm_password: 'NewPass4567' });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false, status: 'error', code: 'INTERNAL_ERROR' });
    expect(res.body.error).toEqual({ code: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง' });
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('simulated step-4');
    expect(raw).not.toContain('stack');

    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.close).toHaveBeenCalledTimes(1);
  });
});

// ============================================================ UC-05 departments
describe('T-016 /api/v1/departments (UC-05)', () => {
  let world;
  let app;
  let conn;
  let token;

  beforeEach(async () => {
    world = createWorld();
    ({ app, conn } = setup(world));
    token = await tokenFor(app);
  });

  test('GET → 200 พร้อม data + meta (ORDER/limit/offset ถูก delegate ไป repository)', async () => {
    const res = await request(app).get('/api/v1/departments').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toEqual({
      dept_id: 1,
      dept_name: 'ฝ่ายบริหาร',
      created_at: '2026-01-05T08:00:00.000Z',
    });
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 2, total_pages: 1 });

    await request(app).get('/api/v1/departments?page=2&limit=10').set(authHeader(token));
    expect(world.repos.department.list).toHaveBeenLastCalledWith({ limit: 10, offset: 10 });

    await request(app).get('/api/v1/departments?page=0&limit=9999').set(authHeader(token));
    expect(world.repos.department.list).toHaveBeenLastCalledWith({ limit: 100, offset: 0 });
  });

  test('q ค้นหาถูกส่งต่อทั้ง list และ count', async () => {
    const res = await request(app).get('/api/v1/departments?q=บริหาร').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(world.repos.department.list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'บริหาร' }));
    expect(world.repos.department.count).toHaveBeenLastCalledWith({ q: 'บริหาร' });
  });

  test('POST ถูกต้อง → 201 + สร้างผ่าน transaction จริง (insert ได้ conn จาก withTransaction)', async () => {
    const res = await request(app)
      .post('/api/v1/departments')
      .set(authHeader(token))
      .send({ dept_name: 'ฝ่ายการเงิน' });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('เพิ่มแผนกสำเร็จ');
    expect(res.body.data).toMatchObject({ dept_id: expect.any(Number), dept_name: 'ฝ่ายการเงิน' });
    expect(world.repos.department.insert.mock.calls[0][0]).toBe(conn);
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  test('POST ชื่อซ้ำ → 409 DUPLICATED', async () => {
    const res = await request(app)
      .post('/api/v1/departments')
      .set(authHeader(token))
      .send({ dept_name: 'ฝ่ายบริหาร' });
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({ code: 'DUPLICATED', message: 'ชื่อแผนกนี้มีอยู่แล้ว' });
    expect(world.repos.department.insert).not.toHaveBeenCalled();
  });

  test('POST ไม่มี dept_name → 400 validation ชี้ field', async () => {
    const res = await request(app).post('/api/v1/departments').set(authHeader(token)).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toMatchObject({ field: 'dept_name' });
  });

  test('PUT ไม่พบ id → 404; PUT ชื่อซ้ำของรายการอื่น → 409; PUT สำเร็จ → 200 เปลี่ยนจริง', async () => {
    const missing = await request(app).put('/api/v1/departments/999').set(authHeader(token)).send({ dept_name: 'ใหม่' });
    expect(missing.status).toBe(404);
    expect(missing.body.error.message).toBe('ไม่พบข้อมูลที่ต้องการ');

    const duplicated = await request(app)
      .put('/api/v1/departments/1')
      .set(authHeader(token))
      .send({ dept_name: 'ฝ่ายวิศวกรรม' });
    expect(duplicated.status).toBe(409);

    const ok = await request(app)
      .put('/api/v1/departments/1')
      .set(authHeader(token))
      .send({ dept_name: 'ฝ่ายบริหารงาน' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.dept_name).toBe('ฝ่ายบริหารงาน');
    expect(world.state.departments.find((d) => d.DEPT_ID === 1).DEPT_NAME).toBe('ฝ่ายบริหารงาน');
  });

  test('DELETE ที่ยังมีพนักงานสังกัด → 422 FK_VIOLATION และไม่ลบ; ไม่มีคน → 200 ลบจริง', async () => {
    world.state.deptHeadcount.set(1, 3);
    const blocked = await request(app).delete('/api/v1/departments/1').set(authHeader(token));
    expect(blocked.status).toBe(422);
    expect(blocked.body.error).toEqual({
      code: 'FK_VIOLATION',
      message: 'ยังมีพนักงานสังกัดในแผนกนี้อยู่ กรุณาย้ายพนักงานออกก่อน',
    });
    expect(world.repos.department.remove).not.toHaveBeenCalled();

    const ok = await request(app).delete('/api/v1/departments/2').set(authHeader(token));
    expect(ok.status).toBe(200);
    expect(ok.body.message).toBe('ลบแผนกสำเร็จ');
    expect(world.repos.department.remove.mock.calls[0][0]).toBe(conn);
    expect(world.state.departments.find((d) => d.DEPT_ID === 2)).toBeUndefined();

    const missing = await request(app).delete('/api/v1/departments/999').set(authHeader(token));
    expect(missing.status).toBe(404);
  });
});

// ============================================================ UC-06 positions
describe('T-016 /api/v1/positions (UC-06)', () => {
  let world;
  let app;
  let token;

  beforeEach(async () => {
    world = createWorld();
    ({ app } = setup(world));
    token = await tokenFor(app);
  });

  test('GET ต้องมีสิทธิ์ POS.EDIT; viewer → 403; admin → 200 พร้อม meta', async () => {
    const viewerToken = await tokenFor(app, 'viewer', VIEWER_PASS);
    const denied = await request(app).get('/api/v1/positions').set(authHeader(viewerToken));
    expect(denied.status).toBe(403);

    const res = await request(app).get('/api/v1/positions').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { position_id: 1, position_name: 'ผู้ดูแลระบบ' },
      { position_id: 2, position_name: 'วิศวกร' },
    ]);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 2, total_pages: 1 });
  });

  test('POST ซ้ำ → 409; สำเร็จ → 201', async () => {
    const duplicated = await request(app)
      .post('/api/v1/positions')
      .set(authHeader(token))
      .send({ position_name: 'วิศวกร' });
    expect(duplicated.status).toBe(409);
    expect(duplicated.body.error.message).toBe('ชื่อตำแหน่งนี้มีอยู่แล้ว');

    const ok = await request(app).post('/api/v1/positions').set(authHeader(token)).send({ position_name: 'ช่างเทคนิค' });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ position_id: expect.any(Number), position_name: 'ช่างเทคนิค' });
  });

  test('DELETE มีคนสังกัด → 422; ไม่พบ → 404; ไม่มีคนแล้ว → 200 ลบจริง', async () => {
    world.state.posHeadcount.set(2, 1);
    const blocked = await request(app).delete('/api/v1/positions/2').set(authHeader(token));
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.message).toBe('ยังมีพนักงานสังกัดในตำแหน่งนี้อยู่ กรุณาย้ายพนักงานออกก่อน');
    expect(world.repos.position.remove).not.toHaveBeenCalled();

    const missing = await request(app).delete('/api/v1/positions/999').set(authHeader(token));
    expect(missing.status).toBe(404);

    world.state.posHeadcount.set(2, 0);
    const ok = await request(app).delete('/api/v1/positions/2').set(authHeader(token));
    expect(ok.status).toBe(200);
    expect(ok.body.message).toBe('ลบตำแหน่งสำเร็จ');
    expect(world.state.positions.find((p) => p.POSITION_ID === 2)).toBeUndefined();
  });
});

// ============================================================ UC-04 employees
describe('T-016 /api/v1/employees (UC-04)', () => {
  let world;
  let app;
  let conn;
  let token;

  beforeEach(async () => {
    world = createWorld();
    ({ app, conn } = setup(world));
    token = await tokenFor(app);
  });

  test('GET คืนโปรไฟล์ครบ (roles แยกเป็น array) โดยไม่มี password/hash และกรอง/แบ่งหน้าถูกส่งต่อ', async () => {
    const res = await request(app).get('/api/v1/employees').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(4);
    expect(res.body.data[0]).toMatchObject({ emp_id: 1, username: 'admin', roles: ['ADMIN'], dept_name: 'ฝ่ายบริหาร' });
    expect(res.body.data[1].roles).toEqual(['STAFF']);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 4, total_pages: 1 });
    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/password/i);
    expect(raw).not.toContain('$2b$');

    await request(app)
      .get('/api/v1/employees?q=EMP001&dept_id=1&is_active=1&page=1&limit=10')
      .set(authHeader(token));
    expect(world.repos.employee.listEmployees).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'EMP001', deptId: 1, isActive: 1, limit: 10, offset: 0 }),
    );
    expect(world.repos.employee.countEmployees).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'EMP001', deptId: 1, isActive: 1 }),
    );
  });

  test('พารามิเตอร์กรองที่ผิดรูปถูกละเว้น (ไม่ throw, ไม่ส่งค่าผิดไป SQL)', async () => {
    await request(app).get('/api/v1/employees?dept_id=abc&is_active=5').set(authHeader(token));
    const arg = world.repos.employee.listEmployees.mock.calls[0][0];
    expect(arg).not.toHaveProperty('deptId');
    expect(arg).not.toHaveProperty('isActive');
  });

  test('POST ไม่ระบุ dept_id/position_id → 400 ตามข้อความ OpenAPI พร้อม details ทั้งสอง field', async () => {
    const res = await request(app)
      .post('/api/v1/employees')
      .set(authHeader(token))
      .send({ emp_code: 'EMP015', first_name: 'มานี', last_name: 'รักดี', username: 'manee', password: 'Password123' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('กรุณาระบุแผนกและตำแหน่งของพนักงาน');
    expect(res.body.error.details).toEqual([
      { field: 'dept_id', message: 'ไม่ใส่ค่าได้' },
      { field: 'position_id', message: 'ไม่ใส่ค่าได้' },
    ]);
    expect(world.repos.employee.insertEmployee).not.toHaveBeenCalled();
  });

  test('POST username ซ้ำ / emp_code ซ้ำ → 409 DUPLICATED', async () => {
    const dupUser = await request(app)
      .post('/api/v1/employees')
      .set(authHeader(token))
      .send({ emp_code: 'EMP099', first_name: 'ก', last_name: 'ข', dept_id: 1, position_id: 1, username: 'admin', password: 'Password123' });
    expect(dupUser.status).toBe(409);
    expect(dupUser.body.error.message).toBe('ชื่อผู้ใช้หรือรหัสพนักงานนี้ถูกใช้แล้ว');

    const dupCode = await request(app)
      .post('/api/v1/employees')
      .set(authHeader(token))
      .send({ emp_code: 'EMP001', first_name: 'ก', last_name: 'ข', dept_id: 1, position_id: 1, username: 'newbie99', password: 'Password123' });
    expect(dupCode.status).toBe(409);
    expect(world.repos.employee.insertEmployee).not.toHaveBeenCalled();
  });

  test('POST อ้างอิงแผนกที่ไม่มีจริง → 422 FK_VIOLATION; email ผิดรูป → 400; is_active ผิดค่า → 400', async () => {
    const badRef = await request(app)
      .post('/api/v1/employees')
      .set(authHeader(token))
      .send({ emp_code: 'EMP077', first_name: 'ก', last_name: 'ข', dept_id: 999, position_id: 1, username: 'ref99', password: 'Password123' });
    expect(badRef.status).toBe(422);
    expect(badRef.body.error.code).toBe('FK_VIOLATION');

    const badEmail = await request(app)
      .post('/api/v1/employees')
      .set(authHeader(token))
      .send({ emp_code: 'EMP078', first_name: 'ก', last_name: 'ข', dept_id: 1, position_id: 1, username: 'ref98', password: 'Password123', email: 'not-an-email' });
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.error.details[0]).toMatchObject({ field: 'email', message: 'must be a valid email address' });

    const badActive = await request(app)
      .post('/api/v1/employees')
      .set(authHeader(token))
      .send({ emp_code: 'EMP079', first_name: 'ก', last_name: 'ข', dept_id: 1, position_id: 1, username: 'ref97', password: 'Password123', is_active: 2 });
    expect(badActive.status).toBe(400);
    expect(badActive.body.error.details[0]).toMatchObject({ field: 'is_active' });
  });

  test('POST ถูกต้อง → 201 และบันทึกเป็น bcrypt hash เท่านั้น (ไม่มี plaintext/hash ใน response)', async () => {
    const res = await request(app)
      .post('/api/v1/employees')
      .set(authHeader(token))
      .send({
        emp_code: 'EMP015',
        first_name: 'มานี',
        last_name: 'รักดี',
        phone: '0899999999',
        email: 'manee@example.com',
        dept_id: 1,
        position_id: 2,
        username: 'manee',
        password: 'Password123',
        is_active: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('เพิ่มพนักงานสำเร็จ');
    expect(res.body.data).toMatchObject({
      emp_id: expect.any(Number),
      username: 'manee',
      emp_code: 'EMP015',
      dept_name: 'ฝ่ายบริหาร',
      position_name: 'วิศวกร',
      roles: [],
      is_active: 1,
    });

    const insertArgs = world.repos.employee.insertEmployee.mock.calls[0];
    expect(insertArgs[0]).toBe(conn);
    expect(insertArgs[1].password_hash).not.toBe('Password123');
    expect(bcrypt.compareSync('Password123', insertArgs[1].password_hash)).toBe(true);

    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('Password123');
    expect(raw).not.toContain('$2b$');
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  test('PUT ไม่พบ → 404; สำเร็จ → 200 เปลี่ยนเฉพาะ field ที่อนุญาต (whitelist) และใช้ transaction', async () => {
    const missing = await request(app)
      .put('/api/v1/employees/999')
      .set(authHeader(token))
      .send({ first_name: 'ก', last_name: 'ข' });
    expect(missing.status).toBe(404);

    const res = await request(app)
      .put('/api/v1/employees/2')
      .set(authHeader(token))
      .send({ first_name: 'วิวใหม่', last_name: 'ผู้ชม', is_active: 0, password: 'hacked999' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('แก้ไขข้อมูลพนักงานสำเร็จ');
    expect(res.body.data).toMatchObject({ emp_id: 2, first_name: 'วิวใหม่', is_active: 0 });

    const updatePayload = world.repos.employee.updateEmployee.mock.calls[0][1];
    expect(updatePayload.data).not.toHaveProperty('password');
    expect(updatePayload.data).not.toHaveProperty('username');
    expect(world.state.profiles.get(2).FIRST_NAME).toBe('วิวใหม่');
    expect(bcrypt.compareSync(VIEWER_PASS, world.state.credentials.get(2).PASSWORD_HASH)).toBe(true);
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  test('PUT emp_code ที่ซ้ำของคนอื่น → 409', async () => {
    const res = await request(app)
      .put('/api/v1/employees/2')
      .set(authHeader(token))
      .send({ first_name: 'วิว', last_name: 'ผู้ชม', emp_code: 'EMP001' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATED');
  });

  test('DELETE ที่มี booking ผูก → 422 HAS_DEPENDENT_DATA ไม่ลบ; ไม่มีผูก → 200 ลบจริง; ไม่พบ → 404', async () => {
    world.state.bookings.set(1, 2);
    const blocked = await request(app).delete('/api/v1/employees/1').set(authHeader(token));
    expect(blocked.status).toBe(422);
    expect(blocked.body.error).toEqual({
      code: 'HAS_DEPENDENT_DATA',
      message: 'พนักงานคนนี้มีข้อมูลการจองผูกอยู่ กรุณาใช้การปิดใช้งานแทนการลบ',
    });
    expect(world.repos.employee.deleteEmployee).not.toHaveBeenCalled();

    const ok = await request(app).delete('/api/v1/employees/3').set(authHeader(token));
    expect(ok.status).toBe(200);
    expect(ok.body.message).toBe('ลบพนักงานสำเร็จ');
    expect(world.repos.employee.deleteEmployee.mock.calls[0][0]).toBe(conn);
    expect(world.state.profiles.has(3)).toBe(false);

    const missing = await request(app).delete('/api/v1/employees/999').set(authHeader(token));
    expect(missing.status).toBe(404);
  });
});

// ============================================================ transaction runner
describe('createTransactionRunner (โค้ดจริงจาก config/db)', () => {
  test('fn สำเร็จ → commit + close และคืนค่า', async () => {
    const conn = makeConn();
    const runner = dbMock.createTransactionRunner(() => ({ getConnection: async () => conn }));
    const out = await runner(async (c) => {
      expect(c).toBe(conn);
      return 42;
    });
    expect(out).toBe(42);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.close).toHaveBeenCalledTimes(1);
  });

  test('fn throw → rollback + close แล้วโยน error ต่อ (ไม่ commit)', async () => {
    const conn = makeConn();
    const runner = dbMock.createTransactionRunner(() => ({ getConnection: async () => conn }));
    await expect(
      runner(async () => {
        throw new Error('insert failed');
      }),
    ).rejects.toThrow('insert failed');
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.close).toHaveBeenCalledTimes(1);
  });

  test('pool ยังไม่พร้อม → โยน error ชัดเจนโดยไม่แตะ connection', async () => {
    const runner = dbMock.createTransactionRunner(() => null);
    await expect(runner(async () => {})).rejects.toThrow(/pool not initialized/);
  });
});

// ============================================================ repository SQL
describe('repository SQL — bind variables, ไม่ใช้ SELECT *, ไม่ hardcode สิทธิ์', () => {
  beforeEach(() => {
    dbMock.query.mockReset();
  });

  test('findLoginUser: bind :username, ไม่ interpolate ค่าจาก user, ไม่มี SELECT *', async () => {
    dbMock.query.mockResolvedValue({ rows: [{ EMP_ID: 9 }] });
    const row = await authRepo.findLoginUser("admin' OR '1'='1");
    expect(row).toEqual({ EMP_ID: 9 });

    const [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).toContain(':username');
    expect(sql).not.toMatch(/SELECT\s+\*/i);
    expect(sql).not.toContain("OR '1'='1");
    expect(binds).toEqual({ username: "admin' OR '1'='1" });
  });

  test('loadPermissions: อ่านจาก role_permission และกรอง is_active — ไม่ hardcode ชื่อบทบาทใน SQL', async () => {
    dbMock.query.mockResolvedValue({ rows: [{ PERM_CODE: 'EMP.VIEW' }, { PERM_CODE: 'EMP.EDIT' }] });
    const perms = await authRepo.loadPermissions(5);
    expect(perms).toEqual(['EMP.VIEW', 'EMP.EDIT']);

    const [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).toContain('role_permission');
    expect(sql).toContain('permission p');
    expect(sql).toContain('is_active = 1');
    expect(sql).not.toMatch(/\b(ADMIN|STAFF|DRIVER|CUSTOMER|SUPERVISOR)\b/);
    expect(binds).toEqual({ empId: 5 });
  });

  test('findRevokedTokens: ผูก jti + marker และกรอง expires_at ด้วย SYSTIMESTAMP', async () => {
    dbMock.query.mockResolvedValue({ rows: [{ JTI: 'jti-1', REVOKED_AT: new Date() }] });
    const rows = await authRepo.findRevokedTokens('jti-1', markerJti(1));
    expect(rows).toHaveLength(1);

    const [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).toContain('token_blacklist');
    expect(sql).toContain('expires_at > SYSTIMESTAMP');
    expect(binds).toEqual({ jti: 'jti-1', markerJti: 'REVOKE_ALL:1' });
    expect(sql).not.toContain('jti-1');
  });

  test('blacklistToken: MERGE 1 statement + autoCommit เมื่อไม่ได้อยู่ใน transaction; ค่าเป็น bind', async () => {
    await authRepo.blacklistToken({ jti: 'secret-jti-123', empId: 4, expiresAt: new Date('2027-01-01T00:00:00Z') });
    const [sql, binds, options] = dbMock.query.mock.calls[0];
    expect(sql).toContain('MERGE INTO token_blacklist');
    expect(options).toEqual({ autoCommit: true });
    expect(sql).not.toContain('secret-jti-123');
    expect(binds.jti).toBe('secret-jti-123');
    expect(binds.empId).toBe(4);
    expect(binds.expiresAt).toBeInstanceOf(Date);
  });

  test('blacklistToken: ได้ conn จาก transaction → ใช้ conn.execute และไม่เรียก query แยก', async () => {
    const conn = { execute: jest.fn(async () => ({})) };
    await authRepo.blacklistToken({ jti: 'in-tx', empId: 1, expiresAt: new Date() }, conn);
    expect(conn.execute).toHaveBeenCalledTimes(1);
    expect(dbMock.query).not.toHaveBeenCalled();
  });

  test('deleteExpiredBlacklist: DELETE ด้วย bind :empId บน conn ที่ได้รับ', async () => {
    const conn = { execute: jest.fn(async () => ({ rowsAffected: 0 })) };
    await authRepo.deleteExpiredBlacklist(9, conn);
    const [sql, binds] = conn.execute.mock.calls[0];
    expect(sql).toContain('DELETE FROM token_blacklist');
    expect(sql).toContain(':empId');
    expect(binds).toEqual({ empId: 9 });
  });

  test('department.list: LIKE มี ESCAPE + escape ค่าใน bind, ORDER BY/OFFSET คงที่, ไม่ต่อค่าเข้า SQL', async () => {
    dbMock.query.mockResolvedValue({ rows: [] });
    await departmentRepo.list({ q: '50%', limit: 10, offset: 20 });
    const [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).toContain("ESCAPE '\\'");
    expect(sql).toContain('ORDER BY dept_id');
    expect(sql).toContain('OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY');
    expect(sql).not.toContain('50%');
    expect(binds).toEqual({ q: '%50\\%%', limit: 10, offset: 20 });
  });

  test('department.insert: RETURNING id + bind ชื่อค่า ไม่ interpolation', async () => {
    const conn = { execute: jest.fn(async () => ({ outBinds: { newId: 77 } })) };
    const id = await departmentRepo.insert(conn, { deptName: 'ฝ่ายบัญชี' });
    expect(id).toBe(77);
    const [sql, binds] = conn.execute.mock.calls[0];
    expect(sql).toContain('RETURNING dept_id INTO :newId');
    expect(binds.deptName).toBe('ฝ่ายบัญชี');
    expect(sql).not.toContain('ฝ่ายบัญชี');
  });

  test('employee.listEmployees: ระบุคอลัมน์ชัดเจน (ไม่มี password), ORDER BY emp_id, binds ครบ', async () => {
    dbMock.query.mockResolvedValue({ rows: [] });
    await employeeRepo.listEmployees({ q: 'EMP0%', deptId: 2, isActive: 1, limit: 10, offset: 0 });
    const [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).not.toMatch(/password/i);
    expect(sql).not.toMatch(/SELECT\s+\*/i);
    expect(sql).toContain('ORDER BY e.emp_id');
    expect(sql).toContain('OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY');
    expect(sql).not.toContain('EMP0');
    expect(binds).toEqual({ q: '%EMP0\\%%', deptId: 2, isActive: 1, limit: 10, offset: 0 });
  });

  test('employee.findEmployeeById: ไม่เลือก password_hash', async () => {
    dbMock.query.mockResolvedValue({ rows: [] });
    await employeeRepo.findEmployeeById(3);
    const [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).toContain('WHERE e.emp_id = :empId');
    expect(sql).not.toMatch(/password/i);
    expect(binds).toEqual({ empId: 3 });
  });

  test('employee.insertEmployee: hash อยู่ใน bind เท่านั้น ไม่โผล่ใน SQL', async () => {
    const conn = { execute: jest.fn(async () => ({ outBinds: { newId: 88 } })) };
    const id = await employeeRepo.insertEmployee(conn, {
      emp_code: 'EMP9',
      first_name: 'ก',
      last_name: 'ข',
      phone: null,
      email: null,
      dept_id: 1,
      position_id: 1,
      username: 'gg',
      password_hash: '$2b$10$abcdefghijklmnopqrstuv',
      is_active: 1,
    });
    expect(id).toBe(88);
    const [sql, binds] = conn.execute.mock.calls[0];
    expect(sql).toContain('INSERT INTO employee');
    expect(sql).toContain('RETURNING emp_id INTO :newId');
    expect(sql).not.toContain('$2b$');
    expect(binds.passwordHash).toBe('$2b$10$abcdefghijklmnopqrstuv');
    expect(binds.newId).toMatchObject({ dir: expect.any(Number) });
  });

  test('employee.updateEmployee: สร้าง SET จาก whitelist เท่านั้น — key ที่ไม่อนุญาตถูกเมิน ค่าไม่ถูกต่อเข้า SQL', async () => {
    const conn = { execute: jest.fn(async () => ({ rowsAffected: 1 })) };
    const data = {
      first_name: "Robert'); DROP TABLE employee;--",
      password_hash: 'stolen-hash',
      is_active: 0,
    };
    await employeeRepo.updateEmployee(conn, { empId: 7, data });
    const [sql, binds] = conn.execute.mock.calls[0];
    expect(sql).toContain('first_name = :v_first_name');
    expect(sql).toContain('is_active = :v_is_active');
    expect(sql).toContain('WHERE emp_id = :empId');
    expect(sql).not.toMatch(/password_hash/i);
    expect(sql).not.toContain('DROP TABLE');
    expect(binds.v_first_name).toBe("Robert'); DROP TABLE employee;--");
    expect(binds.v_is_active).toBe(0);
    expect(binds).not.toHaveProperty('password_hash');
    expect(binds.empId).toBe(7);
  });
});
