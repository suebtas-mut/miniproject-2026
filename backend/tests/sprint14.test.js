// backend/tests/sprint14.test.js — Sprint 14 cybersecurity baseline (SEC14-01..08) regression tests
// ครอบคลุม:
//   SEC14-01 attack-surface inventory: ทุก route ที่ app เปิด = /api/v1 (59 op ตาม openapi) + /health + /echo เท่านั้น
//   SEC14-02 authentication hardening: alg=none / ลายเซ็นผิด / issuer ผิด / claim ขาด → 401 · timing เท่ากัน
//     (unknown user ยังรัน bcrypt) · disabled account ไม่ฟ้องโดยไม่ต้องรู้รหัสผ่าน · marker revoke เซสชันเก่าทั้งหมด
//   SEC14-03 authorization: identity override จาก query/body ไม่เปลี่ยน owner (cust_id มาจาก JWT เท่านั้น) ·
//     เพิกถอนสิทธิ์มีผลทันทีต่อ request ถัดไป (behavioral)
//   SEC14-04 input & SQL binding: path param เป็น injection payload → 400/404 ไม่มี SQL รั่ว · type confusion → 400 ·
//     prototype pollution body ไม่ทำลาย Object prototype · repo รับ payload เฉพาะใน bind (defense-in-depth)
//   SEC14-05 sensitive output: ทุก class error ไม่มี stack/ORA-/$2b$/query · logger ไม่บันทึก password/token ·
//     ไม่มี x-powered-by และไม่ตอบ ACAO กับ Origin ใด ๆ (ไม่มี CORS เปิด)
//   SEC14-06 business state: TX fail ระหว่าง cancel → rollback + สถานะไม่เปลี่ยน + ตอบ 500 ที่ sanitize แล้ว
//   SEC14-07 supply chain: prod dependencies ถูก pin ใน package-lock (lockfileVersion 3, integrity sha512)
//   SEC14-08 automation scripts: review แบบ read-only → บันทึกใน docs/security/sprint14-baseline-audit.md (ไม่มี test)
// โครง test: inject fake repos เข้า createApp แบบ sprint08/09/10/12/13 (ไม่มี Oracle จริง — ไม่ใช้คำว่า certified)
// stateful fakes: blacklist/listMine/cancel เก็บ state จริงระหว่าง test · TX mutex จำลอง row lock (แบบ sprint13)

process.env.JWT_SECRET = 'sprint14-test-secret-0123456789abcdef0123456789abcdef';
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

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const bcrypt = require('bcryptjs');

const { createApp } = require('../src/app');
const dbMock = require('../src/config/db');
const env = require('../src/config/env');
const { resetLoginAttempts } = require('../src/middleware/auth');
const realRepos = require('../src/repositories');

const ADMIN_PASS = 'AdminPass123';
const CUSTOMER_PASS = 'CustomerPass123';
const DISABLED_PASS = 'DisabledPass123';
const NEW_PASS = 'NewPass45678';

const UNAUTHORIZED_MSG = 'กรุณาเข้าสู่ระบบใหม่';
const INVALID_CRED_MSG = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
const GUARD_MSG = 'ไม่มีสิทธิ์เข้าถึงส่วนนี้';

const REPO_ROOT = path.join(__dirname, '..', '..');
const readText = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

// ---------------------------------------------------------------- helpers: route inventory
function walkRouteOps(app) {
  const ops = [];
  const mountPath = (layer) => {
    if (layer.regexp && layer.regexp.fast_slash) return '';
    return layer.regexp.source
      .replace(/^\^/, '')
      .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '')
      .replace(/\\\//g, '/');
  };
  const walk = (layers, prefix) => {
    for (const layer of layers || []) {
      if (layer.route) {
        const p = prefix + layer.route.path;
        for (const m of Object.keys(layer.route.methods)) ops.push(`${m.toUpperCase()} ${p}`);
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        walk(layer.handle.stack, prefix + mountPath(layer));
      }
    }
  };
  walk(app._router && app._router.stack, '');
  return [...new Set(ops)];
}

// ---------------------------------------------------------------- helpers: auth
function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

async function tokenFor(app, username, password) {
  const res = await request(app).post('/api/v1/auth/login').send({ username, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.access_token;
}

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

// ---------------------------------------------------------------- helpers: TX mutex (จำลอง FOR UPDATE แบบ sprint13)
let txQueue = Promise.resolve();
let activeConn = null;
function resetTxQueue() {
  txQueue = Promise.resolve();
}
function makeConn() {
  return {
    execute: jest.fn(async () => ({ rows: [], rowsAffected: 1 })),
    commit: jest.fn(async () => {}),
    rollback: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
  };
}
function serializedWithTransaction(fn) {
  // ทำหน้าที่เท่า withTransaction จริง: สำเร็จ → commit · พัง → rollback · ปิด connection เสมอ
  const run = txQueue.then(async () => {
    try {
      const result = await fn(activeConn);
      await activeConn.commit();
      return result;
    } catch (err) {
      await activeConn.rollback();
      throw err;
    } finally {
      await activeConn.close();
    }
  });
  txQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// ---------------------------------------------------------------- fake world (stateful blacklist + listMine + cancel)
function createWorld() {
  const t0 = Date.now();

  const profiles = new Map();
  const credentials = new Map();
  const permissions = new Map();
  const roles = new Map();
  const revoked = [];

  function addEmployee(o) {
    const row = {
      EMP_ID: o.empId,
      EMP_CODE: `EMP${String(o.empId).padStart(3, '0')}`,
      FIRST_NAME: (o.fullName || '').split(' ')[0] || 'พนักงาน',
      LAST_NAME: (o.fullName || '').split(' ')[1] || 'ทดสอบ',
      PHONE: null,
      EMAIL: null,
      DEPT_ID: null,
      DEPT_NAME: null,
      POSITION_ID: null,
      POSITION_NAME: null,
      USERNAME: o.username,
      IS_ACTIVE: o.isActive === undefined ? 1 : o.isActive,
      CREATED_AT: new Date(t0 - 86400000),
      ROLES: (o.roles || []).join(','),
    };
    profiles.set(row.EMP_ID, row);
    credentials.set(row.EMP_ID, { EMP_ID: row.EMP_ID, USERNAME: row.USERNAME, PASSWORD_HASH: o.passwordHash, IS_ACTIVE: row.IS_ACTIVE });
    permissions.set(row.EMP_ID, o.permissions || []);
    roles.set(row.EMP_ID, o.roles || []);
    return row;
  }

  const ADMIN_PERMS = [
    'DEPT.EDIT', 'POS.EDIT', 'EMP.VIEW', 'EMP.EDIT', 'ROLE.EDIT',
    'ROUTE.VIEW', 'ROUTE.EDIT', 'VEH.EDIT', 'SCHED.EDIT',
    'BK.VIEW', 'BK.CREATE', 'BK.CANCEL', 'TRIP.START', 'QR.SCAN', 'TRIP.END',
    'RPT.R1', 'RPT.R2', 'RPT.R3', 'RPT.R4', 'RPT.R5', 'RPT.R6', 'RPT.R7',
  ];

  addEmployee({ empId: 1, username: 'admin', fullName: 'ผู้ดูแล ระบบ', passwordHash: bcrypt.hashSync(ADMIN_PASS, 4), roles: ['ADMIN'], permissions: ADMIN_PERMS });
  addEmployee({ empId: 5, username: 'fived', fullName: 'อดีต พนักงาน', passwordHash: bcrypt.hashSync(DISABLED_PASS, 4), roles: ['CUSTOMER'], permissions: ['BK.VIEW'], isActive: 0 });
  addEmployee({ empId: 7, username: 'mai', fullName: 'มานี รักดี', passwordHash: bcrypt.hashSync(CUSTOMER_PASS, 4), roles: ['CUSTOMER'], permissions: ['BK.VIEW', 'BK.CREATE', 'BK.CANCEL'] });

  // ---- booking rows (stateful): BK1 = ของ mai (ใช้ cancel + identity test), BK2 = ของคนอื่น, BK3 = จบแล้ว ----
  const booking1 = {
    BOOKING_ID: 1, BOOKING_CODE: 'BK0001', CUST_ID: 7, CUST_NAME: 'มานี รักดี',
    SCHED_ID: 20, BOARD_STOP_ID: 1, BOARD_STOP_NAME: 'หน้ามหาวิทยาลัย',
    ALIGHT_STOP_ID: 2, ALIGHT_STOP_NAME: 'โลตัส', SEATS: 1, STATUS: 'reserved',
    BOOK_TIME: new Date(t0 - 3600000), CANCEL_TIME: null,
    SERVICE_DATE: new Date(t0 + 5 * 86400000), DEPART_AT: new Date(t0 + 5 * 86400000 + 3600000),
    ROUTE_NAME: 'เส้นทาง 1', PLATE_NO: 'กข 1234', DRIVER_NAME: 'สมชาย ขับรถ',
    BOARD_ARRIVE_AT: new Date(t0 + 3600000), // ถึงจุดขึ้นอีก 60 นาที → ยกเลิกได้
  };
  const booking2 = {
    ...booking1, BOOKING_ID: 2, BOOKING_CODE: 'BK0002', CUST_ID: 99, CUST_NAME: 'คนอื่น ทดสอบ',
  };
  const booking3 = {
    ...booking1, BOOKING_ID: 3, BOOKING_CODE: 'BK0003', STATUS: 'completed',
    SERVICE_DATE: new Date(t0 - 2 * 86400000), DEPART_AT: new Date(t0 - 2 * 86400000 + 3600000),
    BOARD_ARRIVE_AT: new Date(t0 - 2 * 86400000),
  };
  const allBookings = [booking1, booking2, booking3];

  const today = new Date(t0);
  today.setHours(0, 0, 0, 0);
  function mineRows({ custId, status }) {
    let rows = allBookings.filter((r) => r.CUST_ID === Number(custId));
    if (status === 'upcoming') rows = rows.filter((r) => r.STATUS === 'reserved' && r.SERVICE_DATE >= today);
    else if (status === 'completed') rows = rows.filter((r) => r.STATUS === 'completed');
    else if (status === 'cancelled') rows = rows.filter((r) => r.STATUS === 'cancelled');
    return rows;
  }

  const repos = {
    ...realRepos,
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
      loadMenus: jest.fn(async () => []),
      loadRoles: jest.fn(async (empId) => [...(roles.get(Number(empId)) || [])]),
      findRevokedTokens: jest.fn(async (jti, marker) =>
        revoked.filter((r) => (r.JTI === jti || r.JTI === marker) && r.EXPIRES_AT > new Date()),
      ),
      // stateful: แถว blacklist จริงเหมือน MERGE (logout + change-password marker)
      blacklistToken: jest.fn(async (payload) => {
        revoked.push({ JTI: payload.jti, REVOKED_AT: new Date(), EXPIRES_AT: payload.expiresAt });
      }),
      deleteExpiredBlacklist: jest.fn(async () => {}),
    },
    employee: {
      ...realRepos.employee,
      findEmployeeById: jest.fn(async (empId) => profiles.get(Number(empId)) || null),
      // stateful: UPDATE password_hash จริงใน fake DB → รหัสผ่านเดิมใช้ไม่ได้หลัง change-password
      updatePassword: jest.fn(async (conn, { empId, passwordHash }) => {
        const cred = credentials.get(Number(empId));
        if (cred) cred.PASSWORD_HASH = passwordHash;
      }),
    },
    booking: {
      ...realRepos.booking,
      lockBooking: jest.fn(async (conn, bookingId) => {
        if (Number(bookingId) !== booking1.BOOKING_ID) return null;
        return { ...booking1 };
      }),
      cancelBooking: jest.fn(async (conn, bookingId) => {
        if (Number(bookingId) === booking1.BOOKING_ID) {
          booking1.STATUS = 'cancelled';
          booking1.CANCEL_TIME = new Date();
        }
      }),
      findDetails: jest.fn(async (bookingId) =>
        Number(bookingId) === booking1.BOOKING_ID ? { ...booking1 } : null,
      ),
      countMine: jest.fn(async ({ custId, status }) => mineRows({ custId, status }).length),
      listMine: jest.fn(async ({ custId, status, limit, offset }) =>
        mineRows({ custId, status }).slice(offset, offset + limit),
      ),
    },
  };

  return {
    repos,
    state: { profiles, credentials, permissions, roles, revoked, allBookings, booking1, ADMIN_PERMS },
  };
}

function setup(world) {
  dbMock.query.mockReset();
  dbMock.query.mockImplementation(async () => ({ rows: [] }));
  activeConn = makeConn();
  const db = {
    query: dbMock.query,
    checkDbHealth: jest.fn(async () => ({ connected: true, latencyMs: 1 })),
    withTransaction: jest.fn(serializedWithTransaction),
  };
  const auditSink = jest.fn();
  const app = createApp({
    healthCheck: async () => ({ connected: true, latencyMs: 1 }),
    auditSink,
    db,
    repos: world.repos,
  });
  return { app, db, auditSink, conn: activeConn };
}

beforeEach(() => {
  resetLoginAttempts();
  resetTxQueue();
});

// ================================================== SEC14-01 attack-surface inventory
describe('SEC14-01 attack-surface inventory: ทุก route ที่ app เปิด', () => {
  let world;
  let app;

  beforeEach(() => {
    world = createWorld();
    ({ app } = setup(world));
  });

  test('ทางเข้าทั้งหมด = /api/v1 (59 op ตาม openapi) + /health + /echo — ไม่มี route ลับเพิ่ม', () => {
    const ops = walkRouteOps(app);
    const apiOps = ops.filter((o) => o.includes(' /api/v1/'));
    const nonApi = ops.filter((o) => !o.includes(' /api/v1/')).sort();

    expect(apiOps.length).toBe(59); // ตรง conformance ของ sprint13 — ล็อกไม่ให้ surface ขยายเอง
    expect(nonApi).toEqual(['GET /health', 'POST /echo']); // /echo ไม่มี auth (T-012 อนุมัติ) → บันทึกเป็น finding SEC14-F006
  });
});

// ================================================== SEC14-02 authentication hardening
describe('SEC14-02 authentication hardening', () => {
  let world;
  let app;

  beforeEach(() => {
    world = createWorld();
    ({ app } = setup(world));
  });

  test('ปฏิเสธ token ที่ยัด algorithm (none) / ลายเซ็นผิด secret / issuer ผิด → 401 UNAUTHORIZED เดียวกัน', async () => {
    const now = Math.floor(Date.now() / 1000);
    const claims = { empId: 1, jti: 'attacker-jti', iat: now, exp: now + 3600, iss: env.jwt.issuer };

    const algNone = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(claims)}.`;
    const wrongSecret = jwt.sign({ empId: 1, jti: 'attacker-jti' }, 'attacker-secret-not-the-real-one', {
      expiresIn: '1h',
      issuer: env.jwt.issuer,
    });
    const wrongIssuer = jwt.sign({ empId: 1, jti: 'attacker-jti' }, process.env.JWT_SECRET, {
      expiresIn: '1h',
      issuer: 'evil-issuer',
    });

    for (const token of [algNone, wrongSecret, wrongIssuer]) {
      const res = await request(app).get('/api/v1/auth/me').set(authHeader(token));
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe(UNAUTHORIZED_MSG);
    }
  });

  test('token ที่เซ็นถูกต้องแต่ขาด claim (jti / empId) → 401 ไม่ใช่ 500', async () => {
    const missingEmpId = jwt.sign({ jti: 'no-emp' }, process.env.JWT_SECRET, { expiresIn: '1h', issuer: env.jwt.issuer });
    const missingJti = jwt.sign({ empId: 1 }, process.env.JWT_SECRET, { expiresIn: '1h', issuer: env.jwt.issuer });

    for (const token of [missingEmpId, missingJti]) {
      const res = await request(app).get('/api/v1/auth/me').set(authHeader(token));
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  test('timing เท่ากัน: unknown user ก็รัน bcrypt เทียบ DUMMY_HASH · บัญชีปิดไม่ฟ้องโดยไม่รู้รหัสผ่าน (SEC14-F001/F002)', async () => {
    const spy = jest.spyOn(bcrypt, 'compare');
    try {
      // 1) ไม่มี user จริง → ยังรัน bcrypt compare (จำนวนครั้งเท่ากับ "มี user แต่รหัสผ่านผิด")
      spy.mockClear();
      const ghost = await request(app).post('/api/v1/auth/login').send({ username: 'ghost-user-sec14', password: 'Whatever123' });
      expect(ghost.status).toBe(401);
      expect(ghost.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][1]).toMatch(/^\$2b\$/);

      // 2) มี user แต่รหัสผ่านผิด → bcrypt compare 1 ครั้ง + ข้อความเดียวกัน
      spy.mockClear();
      const wrongPass = await request(app).post('/api/v1/auth/login').send({ username: 'mai', password: 'WrongPass999' });
      expect(wrongPass.status).toBe(401);
      expect(wrongPass.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(wrongPass.body.error.message).toBe(INVALID_CRED_MSG);
      expect(spy).toHaveBeenCalledTimes(1);

      // 3) บัญชีถูกปิด + รหัสผ่านผิด → ต้องตอบ INVALID_CREDENTIALS (ไม่ใช่ ACCOUNT_DISABLED) ห้าม leak สถานะบัญชี
      spy.mockClear();
      const disabledWrong = await request(app).post('/api/v1/auth/login').send({ username: 'fived', password: 'WrongPass999' });
      expect(disabledWrong.status).toBe(401);
      expect(disabledWrong.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(spy).toHaveBeenCalledTimes(1);

      // 4) บัญชีถูกปิด + รหัสผ่านถูก → ACCOUNT_DISABLED (พฤติกรรมที่ sprint04 approve ไว้ ยังอยู่)
      const disabledRight = await request(app).post('/api/v1/auth/login').send({ username: 'fived', password: DISABLED_PASS });
      expect(disabledRight.status).toBe(401);
      expect(disabledRight.body.error.code).toBe('ACCOUNT_DISABLED');
    } finally {
      spy.mockRestore();
    }
  });

  test('เปลี่ยนรหัสผ่าน → revoke ทุกเซสชันเก่า (jti ตรงตัว + marker < iat) และเซสชันใหม่ใช้ได้', async () => {
    const tokenA = await tokenFor(app, 'mai', CUSTOMER_PASS);
    // เซสชัน B อายุ 2 นาที (iat เก่ากว่า marker ที่จะถูกสร้างตอน change-password)
    const past = Math.floor(Date.now() / 1000) - 120;
    const tokenB = jwt.sign({ empId: 7, jti: 'session-b', iat: past, exp: past + 7200 }, process.env.JWT_SECRET, {
      issuer: env.jwt.issuer,
    });

    const before = await request(app).get('/api/v1/auth/me').set(authHeader(tokenB));
    expect(before.status).toBe(200); // เซสชัน B ยังใช้ได้ก่อนเปลี่ยนรหัสผ่าน

    const change = await request(app)
      .post('/api/v1/auth/change-password')
      .set(authHeader(tokenA))
      .send({ old_password: CUSTOMER_PASS, new_password: NEW_PASS, confirm_password: NEW_PASS });
    expect(change.status).toBe(200);
    expect(change.body.success).toBe(true);

    // เซสชันที่ใช้ change-password (jti ตรงตัว) → 401 TOKEN_REVOKED
    const afterA = await request(app).get('/api/v1/auth/me').set(authHeader(tokenA));
    expect(afterA.status).toBe(401);
    expect(afterA.body.error.code).toBe('TOKEN_REVOKED');

    // เซสชัน B ที่ออกก่อน (iat < marker REVOKED_AT) → 401 TOKEN_REVOKED เช่นกัน
    const afterB = await request(app).get('/api/v1/auth/me').set(authHeader(tokenB));
    expect(afterB.status).toBe(401);
    expect(afterB.body.error.code).toBe('TOKEN_REVOKED');

    // รหัสผ่านเดิมใช้ไม่ได้แล้ว · รหัสผ่านใหม่เข้าได้ + token ใหม่ใช้ได้
    const oldLogin = await request(app).post('/api/v1/auth/login').send({ username: 'mai', password: CUSTOMER_PASS });
    expect(oldLogin.status).toBe(401);
    expect(oldLogin.body.error.code).toBe('INVALID_CREDENTIALS');

    const freshToken = await tokenFor(app, 'mai', NEW_PASS);
    const freshMe = await request(app).get('/api/v1/auth/me').set(authHeader(freshToken));
    expect(freshMe.status).toBe(200);
    expect(freshMe.body.data.employee.emp_id).toBe(7);
  });
});

// ================================================== SEC14-03 authorization
describe('SEC14-03 authorization: owner + permission จาก server-side เท่านั้น', () => {
  let world;
  let app;

  beforeEach(() => {
    world = createWorld();
    ({ app } = setup(world));
  });

  test('identity override: ?cust_id / ?emp_id ที่ยัดเข้ามาไม่เปลี่ยน owner — custId มาจาก JWT เท่านั้น', async () => {
    const token = await tokenFor(app, 'mai', CUSTOMER_PASS);

    const res = await request(app)
      .get('/api/v1/booking/me?cust_id=99&emp_id=99&status=upcoming')
      .set(authHeader(token));
    expect(res.status).toBe(200);

    // repo ถูกเรียกด้วย custId = 7 (จาก token) เท่านั้น
    expect(world.repos.booking.listMine).toHaveBeenCalled();
    const args = world.repos.booking.listMine.mock.calls[0][0];
    expect(args.custId).toBe(7);

    // เฉพาะ booking ของ mai เท่านั้น — BK0002 (cust 99) ไม่มีทางหลุดออกมา
    const codes = (res.body.data || []).map((r) => r.booking_code);
    expect(codes).toContain('BK0001');
    expect(codes).not.toContain('BK0002');
    expect((res.body.data || []).every((r) => r.cust_id === 7)).toBe(true);
  });

  test('เพิกถอนสิทธิ์ใน DB → request ถัดไป 403 ทันที และคืนสิทธิ์ → 200 อีกครั้ง (behavioral, ไม่มี cache)', async () => {
    const token = await tokenFor(app, 'admin', ADMIN_PASS);

    const before = await request(app).get('/api/v1/employees').set(authHeader(token));
    expect(before.status).toBe(200);

    world.state.permissions.set(1, []); // ถอดสิทธิ์ทั้งหมด (จำลองการเพิกถอนจาก RBAC)
    const denied = await request(app).get('/api/v1/employees').set(authHeader(token));
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
    expect(denied.body.error.message).toBe(GUARD_MSG);

    world.state.permissions.set(1, world.state.ADMIN_PERMS);
    const restored = await request(app).get('/api/v1/employees').set(authHeader(token));
    expect(restored.status).toBe(200);
  });
});

// ================================================== SEC14-04 input & SQL binding
describe('SEC14-04 input validation & SQL binding', () => {
  let world;
  let app;

  beforeEach(() => {
    world = createWorld();
    ({ app } = setup(world));
  });

  test('path param เป็น injection payload → 400/404 envelope ปกติ ไม่มี SQL fragment ในคำตอบ', async () => {
    const admin = await tokenFor(app, 'admin', ADMIN_PASS);
    const mai = await tokenFor(app, 'mai', CUSTOMER_PASS);

    const cancel = await request(app)
      .post(`/api/v1/booking/${encodeURIComponent("1' OR '1'='1")}/cancel`)
      .set(authHeader(mai));
    expect([400, 404]).toContain(cancel.status);
    expect(cancel.body.success).toBe(false);
    expect(cancel.body.error.code).toMatch(/NOT_FOUND|VALIDATION_ERROR/);

    const del = await request(app)
      .delete(`/api/v1/schedules/${encodeURIComponent('1; DROP TABLE schedule;--')}`)
      .set(authHeader(admin));
    expect([400, 404]).toContain(del.status);
    expect(del.body.success).toBe(false);

    const raw = JSON.stringify(cancel.body) + JSON.stringify(del.body);
    expect(raw).not.toMatch(/ORA-\d/);
    expect(raw).not.toMatch(/DROP TABLE/i);
    expect(raw).not.toMatch(/SELECT\s/i);
  });

  test('type confusion ใน body login (object/array/number) → 400 ไม่ใช่ 500', async () => {
    const payloads = [
      { username: { evil: 1 }, password: CUSTOMER_PASS },
      { username: ['mai'], password: CUSTOMER_PASS },
      { username: 'mai', password: { evil: 1 } },
    ];
    for (const body of payloads) {
      const res = await request(app).post('/api/v1/auth/login').send(body);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  test('prototype pollution body (__proto__ / constructor.prototype) → login ผ่านปกติ แต่ Object prototype ไม่ถูกแตะ', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send(
        '{"username":"mai","password":"CustomerPass123","__proto__":{"pwned":true},"constructor":{"prototype":{"pwned2":true}}}',
      );

    expect([200, 400]).toContain(res.status); // ถ้า validate ตัดทิ้งก็ได้ 400 — ห้าม 500
    expect(({}).pwned).toBeUndefined();
    expect(({}).pwned2).toBeUndefined();
    expect(Object.prototype.pwned).toBeUndefined();
    expect(Object.prototype.pwned2).toBeUndefined();
    if (res.status === 200) expect(res.body.data.access_token).toBeTruthy();
  });

  test('repo defense-in-depth: ค่าที่รับมาจาก user อยู่ใน bind เท่านั้น — SQL ไม่มี payload · isActive ผ่าน 0/1 whitelist', async () => {
    const fromPayload = "2025-01-01' OR '1'='1";
    const routePayload = '1; DROP TABLE schedule--';

    await realRepos.schedule.list({ from: fromPayload, to: fromPayload, routeId: routePayload, isActive: 9, limit: 5, offset: 0 });

    expect(dbMock.query).toHaveBeenCalledTimes(1);
    const [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).toContain('TO_DATE(:fromDate');
    expect(sql).toContain('TO_DATE(:toDate');
    expect(sql).toContain(':routeId');
    expect(sql).not.toContain(fromPayload);
    expect(sql).not.toContain('DROP TABLE');
    expect(sql).not.toContain("OR '1'='1");
    expect(binds.fromDate).toBe(fromPayload);
    expect(binds.toDate).toBe(fromPayload);
    expect(binds.routeId).toBe(routePayload);
    expect(binds.isActive).toBeUndefined(); // isActive=9 ไม่ผ่าน whitelist 0/1 → ไม่เข้า SQL เลย
  });
});

// ================================================== SEC14-05 sensitive output
describe('SEC14-05 sensitive output: error ไม่รั่ว · logger ไม่บันทึกของลับ · headers', () => {
  let world;
  let app;

  beforeEach(() => {
    world = createWorld();
    ({ app } = setup(world));
  });

  test('ทุก class error (400/401/403/404/500) ไม่มี stack / ORA- / SELECT / $2b$ / secret ในคำตอบ', async () => {
    const mai = await tokenFor(app, 'mai', CUSTOMER_PASS);
    const admin = await tokenFor(app, 'admin', ADMIN_PASS);

    const probes = [
      { name: '401 no token', res: await request(app).get('/api/v1/auth/me'), want: 401 },
      { name: '403 missing permission', res: await request(app).get('/api/v1/employees').set(authHeader(mai)), want: 403 },
      { name: '400 validation', res: await request(app).post('/api/v1/auth/login').send({ username: 'mai', password: 'short' }), want: 400 },
      { name: '404 unknown path', res: await request(app).get('/api/v1/no-such-path').set(authHeader(admin)), want: 404 },
    ];
    // 500: บังคับให้ DB layer พังด้วย error ที่มีคำว่า ORA- อยู่ใน message — คำตอบต้องไม่มีส่วนนั้น
    world.repos.auth.loadPermissions.mockRejectedValueOnce(new Error('simulated ORA-00942: table or view does not exist'));
    probes.push({ name: '500 internal', res: await request(app).get('/api/v1/employees').set(authHeader(admin)), want: 500 });

    const LEAKS = [/ORA-\d/, /node_modules/, /\$2b\$/, /JWT_SECRET/, /password_hash/i, /SELECT\s/i, /stack/i];
    for (const probe of probes) {
      expect(`${probe.name} → ${probe.res.status}`).toBe(`${probe.name} → ${probe.want}`);
      expect(probe.res.body.success).toBe(false);
      expect(probe.res.body.error.code).toBeTruthy();
      expect(probe.res.body.stack).toBeUndefined();
      const raw = JSON.stringify(probe.res.body);
      for (const leak of LEAKS) expect(`${probe.name}: ${raw}`).not.toMatch(leak);
    }
  });

  test('logger ไม่บันทึก password หรือ access_token ลง console (method/path/status เท่านั้น)', async () => {
    const lines = [];
    const spies = ['log', 'warn', 'error'].map((m) =>
      jest.spyOn(console, m).mockImplementation((...args) => lines.push(args.join(' '))),
    );
    try {
      const secretProbe = 'Sec14LogProbe999';
      await request(app).post('/api/v1/auth/login').send({ username: 'mai', password: secretProbe }); // 401
      const token = await tokenFor(app, 'admin', ADMIN_PASS);
      await request(app).post('/api/v1/auth/logout').set(authHeader(token));
      await request(app).get('/api/v1/auth/me').set(authHeader(token));
    } finally {
      spies.forEach((s) => s.mockRestore());
    }

    expect(lines.length).toBeGreaterThanOrEqual(3); // เก็บ log จริงก่อนตัดสิน
    const all = lines.join('\n');
    expect(all).not.toContain('Sec14LogProbe999');
    expect(all).not.toMatch(/Bearer\s+\S/);
    expect(all).not.toContain('AdminPass123');
    for (const line of lines) expect(line).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/); // ไม่มี raw JWT ใน log
  });

  test('headers: ไม่มี x-powered-by และไม่มี Access-Control-Allow-Origin แม้ส่ง Origin มา (ไม่มี CORS เปิด)', async () => {
    const health = await request(app).get('/health').set('Origin', 'http://evil.example');
    expect(health.status).toBe(200);
    expect(health.headers['x-powered-by']).toBeUndefined();
    expect(health.headers['access-control-allow-origin']).toBeUndefined();

    const err = await request(app).get('/api/v1/auth/me').set('Origin', 'http://evil.example');
    expect(err.status).toBe(401);
    expect(err.headers['x-powered-by']).toBeUndefined();
    expect(err.headers['access-control-allow-origin']).toBeUndefined();
    expect(err.headers['content-type']).toMatch(/json/);
  });
});

// ================================================== SEC14-06 business state
describe('SEC14-06 business state integrity: TX fail ต้อง rollback', () => {
  let world;
  let app;
  let conn;

  beforeEach(() => {
    world = createWorld();
    ({ app, conn } = setup(world));
  });

  test('cancel แล้ว TX พัง (ORA-01555) → 500 ที่ sanitize · booking ยัง reserved · rollback ถูกเรียก ไม่ commit', async () => {
    world.repos.booking.cancelBooking = jest.fn(async () => {
      throw new Error('simulated ORA-01555: snapshot too old');
    });
    const mai = await tokenFor(app, 'mai', CUSTOMER_PASS);

    const res = await request(app).post('/api/v1/booking/1/cancel').set(authHeader(mai));
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('ORA-01555');
    expect(JSON.stringify(res.body)).not.toMatch(/node_modules/);

    // สถานะ business ไม่เปลี่ยนหลัง failure
    expect(world.state.booking1.STATUS).toBe('reserved');
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.close).toHaveBeenCalled();
  });
});

// ================================================== SEC14-07 supply chain
describe('SEC14-07 supply chain: dependency pinning', () => {
  test('prod dependencies ถูก pin แบบ exact ใน package-lock (lockfileVersion 3 + integrity sha512)', () => {
    const pkg = JSON.parse(readText('backend/package.json'));
    const lock = JSON.parse(readText('backend/package-lock.json'));

    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      'bcryptjs', 'dotenv', 'express', 'jsonwebtoken', 'oracledb', 'qrcode',
    ]);
    expect(lock.lockfileVersion).toBe(3);

    for (const name of Object.keys(pkg.dependencies)) {
      expect(pkg.dependencies[name]).not.toContain('*'); // ไม่มี wildcard range
      const entry = lock.packages[`node_modules/${name}`];
      expect(entry).toBeDefined();
      expect(entry.version).toMatch(/^\d+\.\d+\.\d+/);
      expect(String(entry.integrity)).toMatch(/^sha512-/);
    }
  });
});
