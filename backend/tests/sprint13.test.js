// backend/tests/sprint13.test.js — Sprint 13 (T-057 · T-061 ส่วน backend · T-062) regression tests
// ครอบคลุม:
//   T-062.1 endpoint conformance: app /api/v1 ↔ docs/api/openapi.yaml (method+path+path-param สองทาง)
//   T-062.2 auth sweep: ทุก endpoint ยกเว้น POST /auth/login ปฏิเสธ request ไร้ token = 401 ErrorEnvelope
//   T-062.3 defect fix: body-parser errors (JSON พัง / body เกิน 1mb) → envelope มาตรฐาน + method ผิด → 404 JSON
//   T-062.4 SQL injection: query param ผ่าน bind เสมอ (real repos + mocked db.query) + validate ก่อนเรียก query
//   T-062.5 concurrency: ยกเลิกซ้ำ / สแกนซ้ำ แบบ parallel — ผลลัพธ์เดียวตาม semantics ของ row lock
//   T-061 ส่วน backend: ผล endpoint review จริง บันทึกลง handoff/docs (ไม่แตะเอกสาร stream อื่น)
// โครง test: inject fake repos เข้า createApp แบบ sprint08/09/10/12 (ไม่ต้อง Oracle จริง)
// หมายเหตุ Block E: withTransaction ของปลอม serialize ด้วย mutex — จำลองการบล็อกของ SELECT ... FOR UPDATE
//   (Oracle-level lock ตรวจด้วยตาใน repo SQL เท่านั้น ไม่มี instance ในเครื่องนี้ — ระบุไว้ใน handoff)

process.env.JWT_SECRET = 'sprint13-test-secret-0123456789abcdef0123456789abcdef';
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
const request = require('supertest');
const bcrypt = require('bcryptjs');

const { createApp } = require('../src/app');
const dbMock = require('../src/config/db');
const { resetLoginAttempts } = require('../src/middleware/auth');
const realRepos = require('../src/repositories');

const ADMIN_PASS = 'AdminPass123';
const CUSTOMER_PASS = 'CustomerPass123';
const DRIVER_PASS = 'DriverPass123';

const UNAUTHORIZED_MSG = 'กรุณาเข้าสู่ระบบใหม่';
const VALIDATION_MSG = 'ข้อมูลที่ส่งมาไม่ถูกต้อง';

const REPO_ROOT = path.join(__dirname, '..', '..');
const readText = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');

// ---------------------------------------------------------------- helpers: endpoint inventory
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
  return ops;
}

function apiV1Ops(app) {
  const norm = (p) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p);
  const set = new Set();
  for (const raw of walkRouteOps(app)) {
    if (!raw.includes(' /api/v1/')) continue;
    const [m, p] = raw.split(' ');
    const apiPath = norm(p.replace('/api/v1', '')).replace(/:([A-Za-z0-9_]+)/g, '{$1}');
    set.add(`${m} ${apiPath}`);
  }
  return [...set];
}

function openapiOps() {
  const lines = readText('docs/api/openapi.yaml').split(/\r?\n/);
  const ops = [];
  let inPaths = false;
  let cur = null;
  for (const line of lines) {
    if (/^paths:/.test(line)) {
      inPaths = true;
      continue;
    }
    if (!inPaths) continue;
    if (/^[a-zA-Z]/.test(line)) break;
    let m = line.match(/^  (\/\S*):\s*$/);
    if (m) {
      cur = m[1];
      continue;
    }
    m = line.match(/^    (get|post|put|delete|patch):\s*$/);
    if (m && cur) ops.push(`${m[1].toUpperCase()} ${cur}`);
  }
  return [...new Set(ops)];
}

const opUrl = (opPath) => '/api/v1' + opPath.replace(/\{[^}]+\}/g, '1');

// ---------------------------------------------------------------- helpers: auth
function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

async function tokenFor(app, username, password) {
  const res = await request(app).post('/api/v1/auth/login').send({ username, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.access_token;
}

// ---------------------------------------------------------------- helpers: TX mutex (จำลอง FOR UPDATE)
// withTransaction ของปลอมรันทีละ transaction เท่านั้น — ถ้า request ที่ 2 มาพร้อมกันจะรอจน
// transaction แรก commit เหมือน Oracle row lock (จริง = SELECT ... FOR UPDATE ใน repo SQL)
let txQueue = Promise.resolve();
function resetTxQueue() {
  txQueue = Promise.resolve();
}
function serializedWithTransaction(fn) {
  const run = txQueue.then(() => fn({}));
  txQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// ---------------------------------------------------------------- fake world (auth + booking + driver + real read repos)
function createWorld() {
  const t0 = Date.now();

  const profiles = new Map();
  const credentials = new Map();
  const permissions = new Map();
  const menus = new Map();
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
      IS_ACTIVE: 1,
      CREATED_AT: new Date(t0 - 86400000),
      ROLES: (o.roles || []).join(','),
    };
    profiles.set(row.EMP_ID, row);
    credentials.set(row.EMP_ID, { EMP_ID: row.EMP_ID, USERNAME: row.USERNAME, PASSWORD_HASH: o.passwordHash, IS_ACTIVE: 1 });
    permissions.set(row.EMP_ID, o.permissions || []);
    menus.set(row.EMP_ID, []);
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
  addEmployee({ empId: 3, username: 'driver', fullName: 'สมชาย ขับรถ', passwordHash: bcrypt.hashSync(DRIVER_PASS, 4), roles: ['DRIVER'], permissions: ['TRIP.START', 'QR.SCAN', 'TRIP.END'] });
  addEmployee({ empId: 7, username: 'mai', fullName: 'มานี รักดี', passwordHash: bcrypt.hashSync(CUSTOMER_PASS, 4), roles: ['CUSTOMER'], permissions: ['BK.VIEW', 'BK.CREATE', 'BK.CANCEL'] });

  // ---- booking state (UC-21 race): เก็บ row เดียว มีสถานะเปลี่ยนจริงระหว่าง TX ----
  const bookingRow = {
    BOOKING_ID: 1,
    BOOKING_CODE: 'BK0001',
    CUST_ID: 7,
    CUST_NAME: 'มานี รักดี',
    SCHED_ID: 20,
    BOARD_STOP_ID: 1,
    BOARD_STOP_NAME: 'หน้ามหาวิทยาลัย',
    ALIGHT_STOP_ID: 2,
    ALIGHT_STOP_NAME: 'โลตัส',
    SEATS: 1,
    STATUS: 'reserved',
    BOOK_TIME: new Date(t0 - 3600000),
    CANCEL_TIME: null,
    SERVICE_DATE: new Date(t0 + 5 * 86400000),
    DEPART_AT: new Date(t0 + 5 * 86400000 + 3600000),
    ROUTE_NAME: 'เส้นทาง 1',
    PLATE_NO: 'กข 1234',
    DRIVER_NAME: 'สมชาย ขับรถ',
    BOARD_ARRIVE_AT: new Date(t0 + 3600000), // ถึงจุดขึ้นอีก 60 นาที → ยกเลิกได้ (ASM-07-2)
  };

  // ---- trip + booking สำหรับ scan race (UC-25) ----
  const QR = 'q'.repeat(32);
  const scanTrip = { TRIP_ID: 9, SCHED_ID: 20, DRIVER_ID: 3, STATUS: 'running', ROUTE_NAME: 'เส้นทาง 1', PLATE_NO: 'กข 1234', DRIVER_NAME: 'สมชาย ขับรถ' };
  const scanBooking = {
    BOOKING_ID: 5,
    BOOKING_CODE: 'BK0005',
    PASSENGER_NAME: 'มานี รักดี',
    SCHED_ID: 20,
    STATUS: 'reserved',
    CHECKIN_TIME: null,
    BOARD_STOP_ID: 1,
  };
  const tripPassengers = [];

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
      loadMenus: jest.fn(async (empId) => []),
      loadRoles: jest.fn(async (empId) => [...(roles.get(Number(empId)) || [])]),
      findRevokedTokens: jest.fn(async (jti, marker) =>
        revoked.filter((r) => (r.JTI === jti || r.JTI === marker) && r.EXPIRES_AT > new Date()),
      ),
      blacklistToken: jest.fn(async () => {}),
      deleteExpiredBlacklist: jest.fn(async () => {}),
    },
    employee: {
      ...realRepos.employee, // listEmployees/countEmployees ใช้ของจริง (ผ่าน dbMock.query) สำหรับบล็อก SQLi
      findEmployeeById: jest.fn(async (empId) => profiles.get(Number(empId)) || null),
    },
    booking: {
      ...realRepos.booking,
      lockBooking: jest.fn(async (conn, bookingId) => {
        if (Number(bookingId) !== bookingRow.BOOKING_ID) return null;
        return { ...bookingRow };
      }),
      cancelBooking: jest.fn(async (conn, bookingId) => {
        if (Number(bookingId) === bookingRow.BOOKING_ID) {
          bookingRow.STATUS = 'cancelled';
          bookingRow.CANCEL_TIME = new Date();
        }
      }),
      findDetails: jest.fn(async (bookingId) =>
        Number(bookingId) === bookingRow.BOOKING_ID ? { ...bookingRow } : null,
      ),
      countMine: jest.fn(async () => 0),
      listMine: jest.fn(async () => []),
    },
    driver: {
      ...realRepos.driver,
      findTripById: jest.fn(async (tripId) => (Number(tripId) === scanTrip.TRIP_ID ? { ...scanTrip } : null)),
      lockBookingByQr: jest.fn(async (conn, qrToken, tripId) => {
        if (qrToken !== QR || Number(tripId) !== scanTrip.TRIP_ID) return null;
        return { ...scanBooking };
      }),
      findStopSeq: jest.fn(async () => ({ STOP_SEQ: 1 })),
      updateCheckin: jest.fn(async (conn, bookingId) => {
        if (Number(bookingId) === scanBooking.BOOKING_ID) {
          scanBooking.STATUS = 'checked_in';
          scanBooking.CHECKIN_TIME = new Date();
        }
      }),
      insertTripPassenger: jest.fn(async (conn, payload) => {
        tripPassengers.push(payload);
      }),
      findCheckin: jest.fn(async (conn, tripId, bookingId) =>
        Number(bookingId) === scanBooking.BOOKING_ID ? { CHECKIN_TIME: scanBooking.CHECKIN_TIME } : null,
      ),
    },
  };

  return {
    repos,
    state: { profiles, credentials, permissions, menus, roles, revoked, bookingRow, scanTrip, scanBooking, tripPassengers, QR },
  };
}

function setup(world) {
  dbMock.query.mockReset();
  dbMock.query.mockImplementation(async () => ({ rows: [] }));
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
  return { app, db, auditSink };
}

beforeEach(() => {
  resetLoginAttempts();
  resetTxQueue();
});

// ================================================== T-062.1 endpoint inventory ↔ openapi
describe('T-062 endpoint conformance: app /api/v1 ↔ docs/api/openapi.yaml', () => {
  let world;
  let app;

  beforeEach(() => {
    world = createWorld();
    ({ app } = setup(world));
  });

  test('สองทาง: ไม่มี endpoint ใน openapi ที่ app ไม่ทำ และไม่มี endpoint ที่ app ทำเกิน openapi (method+path+path param)', () => {
    const appOps = apiV1Ops(app);
    const specOps = openapiOps();
    const missing = specOps.filter((op) => !appOps.includes(op)).sort();
    const extra = appOps.filter((op) => !specOps.includes(op)).sort();

    expect(specOps.length).toBeGreaterThanOrEqual(59); // contract ณ วันนี้ = 59 ops (ล็อกไม่ให้หาย)
    expect(missing).toEqual([]); // openapi มี แต่ app ไม่ทำ = endpoint หาย
    expect(extra).toEqual([]); // app ทำเกิน openapi = endpoint ไม่มีในสัญญา
  });

  test('path param ตรงกันทุกเส้นทาง (app :id ↔ openapi {id}) — จับทั้งชื่อและตำแหน่ง', () => {
    const appOps = apiV1Ops(app);
    const specParamOps = openapiOps().filter((op) => op.includes('{'));
    expect(specParamOps.length).toBeGreaterThan(0);
    for (const op of specParamOps) {
      expect(appOps).toContain(op);
    }
  });
});

// ================================================== T-062.2 auth sweep
describe('T-062 auth sweep: ทุก /api/v1 endpoint ปฏิเสธ request ไร้ token', () => {
  let world;
  let app;

  beforeEach(() => {
    world = createWorld();
    ({ app } = setup(world));
  });

  test('ทุก op ยกเว้น POST /auth/login → 401 UNAUTHORIZED ErrorEnvelope (ไม่มีตัวไหน 500/HTML/รั่ว)', async () => {
    const appOps = apiV1Ops(app);
    const sweepable = appOps.filter((op) => op !== 'POST /auth/login');
    const specCount = openapiOps().filter((op) => op !== 'POST /auth/login').length;
    expect(sweepable.length).toBe(specCount); // inventory ตรงก่อน sweep
    expect(sweepable.length).toBeGreaterThanOrEqual(50);

    const failures = [];
    for (const op of sweepable) {
      const [method, opPath] = op.split(' ');
      const res = await request(app)[method.toLowerCase()](opUrl(opPath));
      const ok =
        res.status === 401 &&
        res.body.success === false &&
        res.body.error &&
        res.body.error.code === 'UNAUTHORIZED' &&
        res.body.error.message === UNAUTHORIZED_MSG;
      if (!ok) failures.push(`${op} → ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`);
    }
    expect(failures).toEqual([]);
  });
});

// ================================================== T-062.3 defect fix: body errors + wrong method
describe('T-062 defect fix: body-parser errors → envelope มาตรฐาน', () => {
  let world;
  let app;

  beforeEach(async () => {
    world = createWorld();
    ({ app } = setup(world));
  });

  test('JSON พัง → 400 VALIDATION_ERROR ข้อความไทยตาม openapi BadRequest (ไม่ leak ข้อความ raw)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"username": invalid');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe(VALIDATION_MSG);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.message).toBe(VALIDATION_MSG);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('Unexpected token'); // ห้าม leak ข้อความ body-parser
    expect(res.body.stack).toBeUndefined();
  });

  test('body เกิน 1mb → 413 PAYLOAD_TOO_LARGE envelope (ไม่ใช่ INTERNAL_ERROR/อังกฤษ) — 413 ไม่มีใน openapi = deviation จดไว้', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send(`{"username":"${'x'.repeat(1024 * 1024 + 100)}"}`);
    expect(res.status).toBe(413); // HTTP ตาม body-parser — openapi ไม่ระบุ 413 (บันทึกใน endpoint review)
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(res.body.error.message).toBe('ข้อมูลมีขนาดใหญ่เกินไป');
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('INTERNAL_ERROR');
    expect(raw).not.toContain('entity.too.large');
    expect(res.body.stack).toBeUndefined();
  });

  test('method ผิดบน path ที่มี (มี token) → 404 JSON envelope ไม่ใช่ HTML/500', async () => {
    const admin = await tokenFor(app, 'admin', ADMIN_PASS);
    const probes = [
      ['delete', '/api/v1/booking/available'],
      ['patch', '/api/v1/report/driver-workload'],
    ];
    for (const [method, url] of probes) {
      const res = await request(app)[method](url).set(authHeader(admin));
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(typeof res.body.error.message).toBe('string');
      expect(res.body.stack).toBeUndefined();
    }
  });
});

// ================================================== T-062.4 SQL injection
describe('T-062 SQL injection: query param ผ่าน bind เสมอ', () => {
  let world;
  let app;
  let admin;

  beforeEach(async () => {
    world = createWorld();
    ({ app } = setup(world));
    admin = await tokenFor(app, 'admin', ADMIN_PASS);
  });

  const PAYLOAD = "x' OR '1'='1'; DROP TABLE employee; --";

  test('ค้นหาด้วย payload (departments/employees/stops) → 200 · payload อยู่ใน binds ไม่ใช่ตัว SQL · LIKE มี ESCAPE', async () => {
    dbMock.query.mockClear();
    const probes = [
      `/api/v1/departments?q=${encodeURIComponent(PAYLOAD)}`,
      `/api/v1/employees?q=${encodeURIComponent(PAYLOAD)}`,
      `/api/v1/stops?q=${encodeURIComponent(PAYLOAD)}`,
    ];
    for (const url of probes) {
      const res = await request(app).get(url).set(authHeader(admin));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }

    const calls = dbMock.query.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(6); // 3 endpoints × (count + list) อย่างน้อย

    const inBind = calls.some(([, binds]) => JSON.stringify(binds || {}).includes(PAYLOAD));
    expect(inBind).toBe(true); // payload ต้องถูกส่งเป็นค่า bind เท่านั้น

    for (const [sql, binds] of calls) {
      expect(sql).not.toContain(PAYLOAD);
      expect(sql).not.toContain('DROP TABLE');
      expect(sql).not.toContain("'1'='1'");
      expect(sql).not.toContain('OR 1=1');
      expect(typeof binds === 'object' || typeof binds === 'string').toBe(true);
    }

    const likeCalls = calls.filter(([sql]) => /\bLIKE\b/i.test(sql));
    expect(likeCalls.length).toBeGreaterThan(0);
    for (const [sql] of likeCalls) expect(sql).toContain('ESCAPE');
  });

  test('parameter ผิดรูป (status/date) → 400 validate ก่อนเรียก db.query (ไม่ยิง SQL เลย)', async () => {
    const customer = await tokenFor(app, 'mai', CUSTOMER_PASS);
    const driver = await tokenFor(app, 'driver', DRIVER_PASS);
    const BAD = "not-a-date'; DROP TABLE booking; --";
    dbMock.query.mockClear();

    const probes = [
      [customer, `/api/v1/booking/me?status=${encodeURIComponent(BAD)}`],
      [customer, `/api/v1/booking/available?board_stop=1&alight_stop=2&date=${encodeURIComponent(BAD)}`],
      [driver, `/api/v1/driver/schedule?date=${encodeURIComponent(BAD)}`],
    ];
    for (const [tok, url] of probes) {
      const res = await request(app).get(url).set(authHeader(tok));
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain('DROP TABLE');
    }
    expect(dbMock.query).not.toHaveBeenCalled();
  });
});

// ================================================== T-062.5 concurrency
describe('T-062 concurrency: race ยกเลิกซ้ำ / สแกนซ้ำ (parallel requests)', () => {
  let world;
  let app;

  beforeEach(() => {
    world = createWorld();
    ({ app } = setup(world));
  });

  test('POST /booking/1/cancel พร้อมกัน 2 → 200 หนึ่ง + 409 INVALID_STATUS หนึ่ง · UPDATE ครั้งเดียว', async () => {
    const customer = await tokenFor(app, 'mai', CUSTOMER_PASS);
    const send = () => request(app).post('/api/v1/booking/1/cancel').set(authHeader(customer));

    const [r1, r2] = await Promise.all([send(), send()]);
    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);

    const winner = r1.status === 200 ? r1 : r2;
    const loser = r1.status === 200 ? r2 : r1;
    expect(winner.body.success).toBe(true);
    expect(winner.body.data.status).toBe('cancelled');
    expect(loser.body.error.code).toBe('INVALID_STATUS');

    expect(world.repos.booking.cancelBooking).toHaveBeenCalledTimes(1);
    expect(world.state.bookingRow.STATUS).toBe('cancelled');
    expect(world.state.bookingRow.CANCEL_TIME).not.toBeNull();
  });

  test('POST /driver/trip/scan พร้อมกัน 2 → checked_in + already_checked_in · trip_passenger แถวเดียว', async () => {
    const driver = await tokenFor(app, 'driver', DRIVER_PASS);
    const body = { trip_id: 9, qr_token: world.state.QR };
    const send = () => request(app).post('/api/v1/driver/trip/scan').set(authHeader(driver)).send(body);

    const [r1, r2] = await Promise.all([send(), send()]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const results = [r1.body.data.result, r2.body.data.result].sort();
    expect(results).toEqual(['already_checked_in', 'checked_in']);

    expect(world.repos.driver.updateCheckin).toHaveBeenCalledTimes(1);
    expect(world.state.tripPassengers).toHaveLength(1);
    expect(world.state.scanBooking.STATUS).toBe('checked_in');
  });
});
