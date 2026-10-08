// backend/tests/sprint12.test.js — Sprint 12 (T-054 / T-055 / T-056 / T-060) regression tests
// ครอบคลุม:
//   T-054 GET /report/boarding-alighting-week (UC-27 · R1 · year พ.ศ.→ค.ศ. · week bounds · RPT.R1)
//   T-055 GET /report/daily-by-route           (UC-28 · R4 · PIVOT/calendar spine · day_name/total · RPT.R4)
//   T-056 GET /report/driver-workload          (UC-29 · R6 · ROLLUP/RANK · แถวรวม null · RPT.R6)
//        + 4 endpoints 501 REPORT_NOT_SELECTED (R2/R3/R5/R7 · guard ของรายงานนั้น ๆ)
//   T-060 (ส่วน script): repo SQL static (bind · PIVOT · ROLLUP+RANK · calendar spine · whitelist)
//            + contract openapi ↔ routes ↔ views ↔ seed permission
// โครง test: inject fake repos เข้า createApp (ไม่ต้อง Oracle จริง) แบบ sprint08/09/10/11

process.env.JWT_SECRET = 'sprint12-test-secret-0123456789abcdef0123456789abcdef';
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
const reportRepo = require('../src/repositories/report.repository');
const { NOT_IMPLEMENTED_MESSAGE } = require('../src/routes/report.routes');

const ADMIN_PASS = 'AdminPass123';
const VIEWER_PASS = 'ViewerPass123';
const CUSTOMER_PASS = 'CustomerPass123';

const GUARD_MSG = 'ไม่มีสิทธิ์เข้าถึงส่วนนี้';
const VALIDATION_MSG = 'ข้อมูลที่ส่งมาไม่ถูกต้อง';

const REPO_ROOT = path.join(__dirname, '..', '..');
const readText = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const OPENAPI = () => readText('docs/api/openapi.yaml');
const VIEWS_05 = () => readText('database/05_views_report.sql');
const SEED_02 = () => readText('database/02_seed_master.sql');
const APP_JS = () => readText('backend/src/app.js');
const ROUTES_FILE = () => readText('backend/src/routes/report.routes.js');
// ตัดบรรทัดคอมเมนต์ (-- ...) ออกก่อนวิเคราะห์ SQL — คอมเมนต์เป็นเอกสาร ไม่ใช่คำสั่ง
const stripComments = (text) =>
  text
    .split(/\r?\n/)
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');

// ---------------------------------------------------------------- fake world (report APIs — auth + report)
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
    menus.set(row.EMP_ID, o.menus || []);
    roles.set(row.EMP_ID, o.roles || []);
    return row;
  }

  const RPT_ALL = ['RPT.R1', 'RPT.R2', 'RPT.R3', 'RPT.R4', 'RPT.R5', 'RPT.R6', 'RPT.R7'];

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
    },
    // ---- fake report repo: คืน fixture ตาม SQL semantics ของ T-054/T-055/T-056 ----
    report: {
      weeklyBoarding: jest.fn(async () => [
        { WEEK_START: '2025-01-06', WEEK_NO: '02', ROUTE_ID: 2, BOARDED: 12, ALIGHTED: 11, NO_SHOW_COUNT: 1 },
        { WEEK_START: '2025-12-29', WEEK_NO: '01', ROUTE_ID: 3, BOARDED: 15, ALIGHTED: 15, NO_SHOW_COUNT: 0 },
      ]),
      listActiveRouteIds: jest.fn(async (routeId) => (routeId ? [routeId] : [2, 3])),
      dailyByRoute: jest.fn(async () => [
        { SERVICE_DATE: '2025-09-01', '2': 7, '3': 4 },
        { SERVICE_DATE: '2025-09-02', '2': 0, '3': null }, // วันไม่มีรอบ/ไม่มีคน → 0 (openapi: แสดง 0 ไม่ใช่ตัดแถว)
        { SERVICE_DATE: '2025-09-03', '2': 2, '3': 5 },
      ]),
      driverWorkload: jest.fn(async () => [
        { DRIVER_ID: 5, DRIVER_NAME: 'ประเสริฐ ขับรถ', TOTAL_TRIPS: 8, BEFORE_17: 5, AFTER_17: 3, RANK_NO: 1 },
        { DRIVER_ID: 6, DRIVER_NAME: 'บุญช่วย พวงมาลัย', TOTAL_TRIPS: 0, BEFORE_17: 0, AFTER_17: 0, RANK_NO: 2 },
        { DRIVER_ID: null, DRIVER_NAME: null, TOTAL_TRIPS: 8, BEFORE_17: 5, AFTER_17: 3, RANK_NO: 1 },
      ]),
    },
  };

  addEmployee({ empId: 1, username: 'admin', fullName: 'ผู้ดูแล ระบบ', passwordHash: bcrypt.hashSync(ADMIN_PASS, 4), roles: ['ADMIN'], permissions: RPT_ALL, menus: [] });
  addEmployee({ empId: 2, username: 'viewer', fullName: 'เจ้าหน้าที่ ดูข้อมูล', passwordHash: bcrypt.hashSync(VIEWER_PASS, 4), roles: ['STAFF'], permissions: ['ROUTE.VIEW'], menus: [] });
  addEmployee({ empId: 7, username: 'mai', fullName: 'มานี รักดี', passwordHash: bcrypt.hashSync(CUSTOMER_PASS, 4), roles: ['CUSTOMER'], permissions: ['BK.VIEW'], menus: [] });

  return { repos, state: { profiles, credentials, permissions, menus, roles, revoked } };
}

function setup(world) {
  const db = {
    query: jest.fn(),
    checkDbHealth: jest.fn(async () => ({ connected: true, latencyMs: 1 })),
    withTransaction: jest.fn(async () => {
      throw new Error('report APIs are read-only');
    }),
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

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

async function tokenFor(app, username, password) {
  const res = await request(app).post('/api/v1/auth/login').send({ username, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.access_token;
}

beforeEach(() => {
  resetLoginAttempts();
});

// ================================================== T-054 R1 UC-27 GET /report/boarding-alighting-week
describe('T-054 GET /api/v1/report/boarding-alighting-week (UC-27 · R1)', () => {
  let world;
  let app;
  let admin;

  beforeEach(async () => {
    world = createWorld();
    ({ app } = setup(world));
    admin = await tokenFor(app, 'admin', ADMIN_PASS);
  });

  const get = (qs, tok = admin) => {
    const r = request(app).get('/api/v1/report/boarding-alighting-week');
    return (qs ? r.query(qs) : r).set(authHeader(tok));
  };

  test('200: keys ครบตาม openapi ReportBoardingAlightingWeek + แปลง พ.ศ. 2568 → ขอบสัปดาห์ ค.ศ. 2025', async () => {
    const res = await get({ year: 2568 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBeUndefined(); // 200 = { success, data } เท่านั้น (openapi ไม่มี message)

    // year conversion: 2568-543 = 2025 → fromWeek = จันทร์ของสัปดาห์ที่มี 1 ม.ค. 2025 (พุธ) = 2024-12-30
    //                 toWeek   = จันทร์ของสัปดาห์ที่มี 31 ธ.ค. 2025 (พุธ) = 2025-12-29
    expect(world.repos.report.weeklyBoarding).toHaveBeenCalledWith({
      fromWeek: '2024-12-30',
      toWeek: '2025-12-29',
      routeId: null,
    });

    const data = res.body.data;
    expect(Object.keys(data).sort()).toEqual(['chart', 'rows', 'total_weeks', 'year'].sort());
    expect(data.year).toBe(2568); // คืนค่าปีที่ผู้ใช้เลือก (พ.ศ.) — ไม่ใช่ ค.ศ.
    expect(data.total_weeks).toBe(2); // "จำนวนสัปดาห์ที่มีข้อมูล"

    expect(data.rows).toHaveLength(2);
    expect(Object.keys(data.rows[0]).sort()).toEqual(['alight_count', 'board_count', 'week_no', 'week_start'].sort());
    expect(data.rows[0]).toMatchObject({
      week_no: 2, // '02' ของ Oracle → number
      week_start: '2025-01-06',
      board_count: 12,
      alight_count: 11,
    });

    expect(data.chart.type).toBe('bar_grouped');
    expect(data.chart.labels).toEqual(['สัปดาห์ 2', 'สัปดาห์ 1']);
    expect(data.chart.datasets).toEqual([
      { label: 'จำนวนคนขึ้น', data: [12, 15] },
      { label: 'จำนวนคนลง', data: [11, 15] },
    ]);
  });

  test('400 year: ขาด / ไม่ใช่ 4 หลัก / นอกช่วง 2500–2600 / ส่งซ้ำ 2 ค่า — ไม่เรียก repo', async () => {
    const missing = await get();
    expect(missing.status).toBe(400);
    expect(missing.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: VALIDATION_MSG,
      details: [{ field: 'year', message: 'is required' }],
    });

    for (const year of ['abc', '25.5', '2499', '2601', '0000']) {
      const res = await get({ year });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details[0].field).toBe('year');
    }
    const duplicated = await get({ year: [2568, 2569] }); // repeated query → array → ไม่ผ่าน regex
    expect(duplicated.status).toBe(400);

    expect(world.repos.report.weeklyBoarding).not.toHaveBeenCalled();
  });

  test('200: ขอบเขต year 2500/2600 ผ่าน + route_id ที่ส่งมาถูกส่งต่อ / ผิดรูป → 400', async () => {
    for (const year of [2500, 2600]) {
      const res = await get({ year });
      expect(res.status).toBe(200);
      expect(res.body.data.year).toBe(year);
    }
    expect(world.repos.report.weeklyBoarding).toHaveBeenLastCalledWith(
      expect.objectContaining({ fromWeek: expect.any(String), toWeek: expect.any(String), routeId: null }),
    );

    const filtered = await get({ year: 2568, route_id: 3 });
    expect(filtered.status).toBe(200);
    expect(world.repos.report.weeklyBoarding).toHaveBeenLastCalledWith(
      expect.objectContaining({ routeId: 3 }),
    );

    const emptyRoute = await get({ year: 2568, route_id: '' });
    expect(emptyRoute.status).toBe(200);
    expect(world.repos.report.weeklyBoarding).toHaveBeenLastCalledWith(
      expect.objectContaining({ routeId: null }),
    );

    for (const routeId of ['abc', '0', '-1', '1.5']) {
      const res = await get({ year: 2568, route_id: routeId });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0]).toMatchObject({ field: 'route_id', message: 'must be a positive integer' });
    }
  });

  test('401 ไม่มี token; 403 ไม่มี RPT.R1 (viewer/mai) — guard ก่อนเข้า service', async () => {
    const noAuth = await request(app).get('/api/v1/report/boarding-alighting-week').query({ year: 2568 });
    expect(noAuth.status).toBe(401);
    expect(noAuth.body.error).toMatchObject({ code: 'UNAUTHORIZED' });

    for (const [username, password] of [['viewer', VIEWER_PASS], ['mai', CUSTOMER_PASS]]) {
      const tok = await tokenFor(app, username, password);
      const res = await get({ year: 2568 }, tok);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatchObject({ code: 'FORBIDDEN', message: GUARD_MSG });
    }
    expect(world.repos.report.weeklyBoarding).not.toHaveBeenCalled();
  });
});

// ================================================== T-055 R4 UC-28 GET /report/daily-by-route
describe('T-055 GET /api/v1/report/daily-by-route (UC-28 · R4 · PIVOT)', () => {
  let world;
  let app;
  let admin;

  beforeEach(async () => {
    world = createWorld();
    ({ app } = setup(world));
    admin = await tokenFor(app, 'admin', ADMIN_PASS);
  });

  const get = (qs, tok = admin) =>
    request(app).get('/api/v1/report/daily-by-route').query(qs).set(authHeader(tok));

  test('200: keys ครบ + day_name ไทย + route_counts + total + stacked_bar chart', async () => {
    const res = await get({ from: '2025-09-01', to: '2025-09-03' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(world.repos.report.listActiveRouteIds).toHaveBeenCalledWith(null);
    expect(world.repos.report.dailyByRoute).toHaveBeenCalledWith({
      fromDate: '2025-09-01',
      toDate: '2025-09-03',
      routeId: null,
    });

    const data = res.body.data;
    expect(Object.keys(data).sort()).toEqual(['chart', 'from', 'route_ids', 'rows', 'to'].sort());
    expect(data.from).toBe('2025-09-01');
    expect(data.to).toBe('2025-09-03');
    expect(data.route_ids).toEqual([2, 3]); // route is_active = 1 (ปลอม = 2 รหัส)

    expect(data.rows).toHaveLength(3);
    expect(Object.keys(data.rows[0]).sort()).toEqual(['day_name', 'route_counts', 'service_date', 'total'].sort());
    // 2025-09-01 = จันทร์ / 09-02 = อังคาร / 09-03 = พุธ — day_name คำนวณเอง ไม่พึ่ง NLS ของ Oracle
    expect(data.rows.map((r) => r.day_name)).toEqual(['จ', 'อ', 'พ']);
    expect(data.rows[0]).toMatchObject({
      service_date: '2025-09-01',
      route_counts: { 2: 7, 3: 4 },
      total: 11, // รวมทั้งวัน = ผลรวม route_counts
    });
    // วันคอลัมน์ pivot เป็น NULL → แสดง 0 (openapi: วันไหนไม่มีข้อมูลแสดง 0 ไม่ใช่ตัดแถว)
    expect(data.rows[1]).toMatchObject({ route_counts: { 2: 0, 3: 0 }, total: 0 });

    expect(data.chart.type).toBe('stacked_bar');
    expect(data.chart.labels).toEqual(['2025-09-01', '2025-09-02', '2025-09-03']);
    expect(data.chart.datasets).toEqual([
      { label: 'เส้นทาง 2', data: [7, 0, 2] },
      { label: 'เส้นทาง 3', data: [4, 0, 5] },
    ]);
  });

  test('200 route_id=2: route_ids = [2] + เฉพาะเส้นทางนั้น + repo รับ routeId=2', async () => {
    world.repos.report.dailyByRoute.mockResolvedValueOnce([
      { SERVICE_DATE: '2025-09-01', '2': 7 },
      { SERVICE_DATE: '2025-09-02', '2': 3 },
    ]);
    const res = await get({ from: '2025-09-01', to: '2025-09-03', route_id: 2 });
    expect(res.status).toBe(200);
    expect(world.repos.report.listActiveRouteIds).toHaveBeenCalledWith(2);
    expect(world.repos.report.dailyByRoute).toHaveBeenCalledWith(
      expect.objectContaining({ routeId: 2 }),
    );
    const data = res.body.data;
    expect(data.route_ids).toEqual([2]);
    expect(data.chart.datasets).toEqual([{ label: 'เส้นทาง 2', data: [7, 3] }]);
  });

  test('400: from/to ขาด · รูปแบบผิด · วันไม่มีจริง · from > to · route_id ผิด — ไม่เรียก repo', async () => {
    const missingFrom = await request(app).get('/api/v1/report/daily-by-route').query({ to: '2025-09-03' }).set(authHeader(admin));
    expect(missingFrom.status).toBe(400);
    expect(missingFrom.body.error.details[0].field).toBe('from');

    const missingTo = await get({ from: '2025-09-01' });
    expect(missingTo.status).toBe(400);
    expect(missingTo.body.error.details[0].field).toBe('to');

    for (const [from, to] of [
      ['2025-02-30', '2025-03-01'], // ก.พ. 30 — Date.parse rollover ต้องไม่ผ่าน
      ['2025-13-01', '2025-12-01'],
      ['abc', '2025-12-01'],
      ['2025-09-01', '2025-09-99'],
    ]) {
      const res = await get({ from, to });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(['from', 'to']).toContain(res.body.error.details[0].field);
    }

    const reversed = await get({ from: '2025-09-03', to: '2025-09-01' }); // from > to
    expect(reversed.status).toBe(400);
    expect(reversed.body.error.details[0]).toMatchObject({ field: 'from', message: 'must be on or before to' });

    const badRoute = await get({ from: '2025-09-01', to: '2025-09-03', route_id: 'abc' });
    expect(badRoute.status).toBe(400);
    expect(badRoute.body.error.details[0].field).toBe('route_id');

    expect(world.repos.report.listActiveRouteIds).not.toHaveBeenCalled();
    expect(world.repos.report.dailyByRoute).not.toHaveBeenCalled();
  });

  test('401 ไม่มี token; 403 ไม่มี RPT.R4 — guard ก่อนเข้า service', async () => {
    const noAuth = await request(app).get('/api/v1/report/daily-by-route').query({ from: '2025-09-01', to: '2025-09-03' });
    expect(noAuth.status).toBe(401);

    const tok = await tokenFor(app, 'viewer', VIEWER_PASS);
    const res = await get({ from: '2025-09-01', to: '2025-09-03' }, tok);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: 'FORBIDDEN', message: GUARD_MSG });
    expect(world.repos.report.dailyByRoute).not.toHaveBeenCalled();
  });
});

// ================================================== T-056 R6 UC-29 GET /report/driver-workload
describe('T-056 GET /api/v1/report/driver-workload (UC-29 · R6 · ROLLUP/Analytic)', () => {
  let world;
  let app;
  let admin;

  beforeEach(async () => {
    world = createWorld();
    ({ app } = setup(world));
    admin = await tokenFor(app, 'admin', ADMIN_PASS);
  });

  const get = (qs, tok = admin) =>
    request(app).get('/api/v1/report/driver-workload').query(qs).set(authHeader(tok));

  test('200: keys ครบ + แถวรวม ROLLUP (null) ท้ายสุด + คนขับไม่มีรอบ = 0/0 + กราฟไม่รวมแถวรวม', async () => {
    const res = await get({ from: '2026-10-01', to: '2026-10-31' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(world.repos.report.driverWorkload).toHaveBeenCalledWith({
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
    });

    const data = res.body.data;
    expect(Object.keys(data).sort()).toEqual(['chart', 'from', 'rows', 'to'].sort());
    expect(data.from).toBe('2026-10-01');
    expect(data.to).toBe('2026-10-31');

    expect(data.rows).toHaveLength(3);
    // openapi: required = total_trips/before_17/after_17 — rank_no เป็น internal ห้ามหลุดออกจาก schema
    expect(Object.keys(data.rows[0]).sort()).toEqual(
      ['after_17', 'before_17', 'driver_id', 'driver_name', 'total_trips'].sort(),
    );
    expect(data.rows[0]).toMatchObject({
      driver_id: 5,
      driver_name: 'ประเสริฐ ขับรถ',
      total_trips: 8,
      before_17: 5,
      after_17: 3,
    });
    // คนขับที่ไม่มีรอบงานในช่วง → 0 / 0 (openapi)
    expect(data.rows[1]).toMatchObject({ driver_id: 6, total_trips: 0, before_17: 0, after_17: 0 });
    // แถวรวม ROLLUP = driver_id/driver_name null, อยู่ท้ายสุด (ตัวอย่าง openapi)
    expect(data.rows[2]).toEqual({
      driver_id: null,
      driver_name: null,
      total_trips: 8,
      before_17: 5,
      after_17: 3,
    });

    expect(data.chart.type).toBe('bar_grouped');
    expect(data.chart.labels).toEqual(['ประเสริฐ ขับรถ', 'บุญช่วย พวงมาลัย']); // ไม่รวมแถวรวม
    expect(data.chart.datasets).toEqual([
      { label: 'ก่อน 17:00', data: [5, 0] },
      { label: 'หลัง 17:00', data: [3, 0] },
    ]);
  });

  test('400: from/to ขาด · รูปแบบผิด · from > to — ไม่เรียก repo', async () => {
    const missing = await get({});
    expect(missing.status).toBe(400);
    expect(missing.body.error.details[0].field).toBe('from');

    const missingTo = await get({ from: '2026-10-01' });
    expect(missingTo.status).toBe(400);
    expect(missingTo.body.error.details[0].field).toBe('to');

    for (const [from, to] of [
      ['2026-02-30', '2026-03-01'],
      ['not-a-date', '2026-10-31'],
      ['2026-10-31', 'not-a-date'],
    ]) {
      const res = await get({ from, to });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }

    const reversed = await get({ from: '2026-10-31', to: '2026-10-01' });
    expect(reversed.status).toBe(400);
    expect(reversed.body.error.details[0]).toMatchObject({ field: 'from', message: 'must be on or before to' });

    expect(world.repos.report.driverWorkload).not.toHaveBeenCalled();
  });

  test('401 ไม่มี token; 403 ไม่มี RPT.R6 — guard ก่อนเข้า service', async () => {
    const noAuth = await request(app).get('/api/v1/report/driver-workload').query({ from: '2026-10-01', to: '2026-10-31' });
    expect(noAuth.status).toBe(401);

    const tok = await tokenFor(app, 'viewer', VIEWER_PASS);
    const res = await get({ from: '2026-10-01', to: '2026-10-31' }, tok);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: 'FORBIDDEN', message: GUARD_MSG });
    expect(world.repos.report.driverWorkload).not.toHaveBeenCalled();
  });
});

// ================================================== 501 endpoints (R2/R3/R5/R7 — ไม่ได้เลือกทำจริง)
describe('501 REPORT_NOT_SELECTED: R2/R3/R5/R7 (17.5.2 · openapi NotImplemented)', () => {
  let world;
  let app;
  let admin;

  const STUBS = [
    ['annual-booking-stats', 'RPT.R2'],
    ['user-behavior', 'RPT.R3'],
    ['stop-usage', 'RPT.R5'],
    ['vehicle-usage', 'RPT.R7'],
  ];

  beforeEach(async () => {
    world = createWorld();
    ({ app } = setup(world));
    admin = await tokenFor(app, 'admin', ADMIN_PASS);
  });

  test('ทั้ง 4 endpoints → 501 + code/message ตรงตัวอย่าง openapi — ไม่ validate query (ไม่ส่ง query ก็ได้ 501)', async () => {
    for (const [p] of STUBS) {
      const res = await request(app).get(`/api/v1/report/${p}`).set(authHeader(admin));
      expect(res.status).toBe(501);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toEqual({
        code: 'REPORT_NOT_SELECTED',
        message: 'รายงานนี้ไม่ได้อยู่ในชุดที่ทีมเลือกทำจริง (R1 + R4 + R6)',
      });
      expect(res.body.status).toBe('error');
      expect(res.body.code).toBe('REPORT_NOT_SELECTED');
      expect(res.body.message).toBe('รายงานนี้ไม่ได้อยู่ในชุดที่ทีมเลือกทำจริง (R1 + R4 + R6)');
    }
    expect(world.repos.report.weeklyBoarding).not.toHaveBeenCalled();
    expect(world.repos.report.dailyByRoute).not.toHaveBeenCalled();
    expect(world.repos.report.driverWorkload).not.toHaveBeenCalled();
  });

  test('401 ไม่มี token; 403 ไม่มีสิทธิ์รายงานนั้น ๆ (viewer ไม่มี RPT.R2/R3/R5/R7)', async () => {
    for (const [p] of STUBS) {
      const noAuth = await request(app).get(`/api/v1/report/${p}`);
      expect(noAuth.status).toBe(401);
      expect(noAuth.body.error).toMatchObject({ code: 'UNAUTHORIZED' });
    }

    const tok = await tokenFor(app, 'viewer', VIEWER_PASS);
    for (const [p] of STUBS) {
      const res = await request(app).get(`/api/v1/report/${p}`).set(authHeader(tok));
      expect(res.status).toBe(403);
      expect(res.body.error).toMatchObject({ code: 'FORBIDDEN', message: GUARD_MSG });
    }
  });

  test('guard เป็นคนละสิทธิ์กัน: admin มีทั้ง 7 ตัว → ผ่าน guard ทุกตัว (501) · mai ไม่มีสิทธิ์รายงานเลย → 403 ทุกตัว', async () => {
    const mai = await tokenFor(app, 'mai', CUSTOMER_PASS);
    for (const [p] of STUBS) {
      const res = await request(app).get(`/api/v1/report/${p}`).set(authHeader(mai));
      expect(res.status).toBe(403);
    }
    const adminRes = await request(app).get('/api/v1/report/annual-booking-stats').set(authHeader(admin));
    expect(adminRes.status).toBe(501); // ผ่าน RPT.R2 guard แล้วค่อย 501
  });
});

// ================================================== repository SQL static (T-054/055/056 + T-060 ส่วน script)
describe('report.repository.js SQL static (bind variables · เทคนิคที่บังคับ · READ ONLY)', () => {
  let sql;
  let binds;

  async function capture(fn, args) {
    dbMock.query.mockReset();
    dbMock.query.mockResolvedValue({ rows: [] });
    await fn(args);
    expect(dbMock.query).toHaveBeenCalledTimes(1);
    [sql, binds] = dbMock.query.mock.calls[0];
    return sql;
  }

  test('weeklyBoarding (R1): view + SUM + week binds + ORDER BY — ไม่มีวันที่ literal', async () => {
    await capture(reportRepo.weeklyBoarding, { fromWeek: '2024-12-30', toWeek: '2025-12-29', routeId: null });
    expect(sql).toContain('FROM v_report_boarding_alighting_week');
    expect(sql).toContain('SUM(v.boarded)');
    expect(sql).toContain('SUM(v.alighted)');
    expect(sql).toContain('SUM(v.no_show_count)');
    expect(sql).toMatch(/week_start\s+BETWEEN\s+TO_DATE\(:fromWeek/);
    expect(sql).toContain("TO_DATE(:toWeek, 'YYYY-MM-DD')");
    expect(sql).toContain('AND (:routeId IS NULL OR v.route_id = :routeId)');
    expect(sql).toMatch(/GROUP\s+BY\s+v\.week_start,\s*v\.week_no/);
    expect(sql).toMatch(/ORDER\s+BY\s+v\.week_start/);
    expect(binds).toEqual({ fromWeek: '2024-12-30', toWeek: '2025-12-29', routeId: null });
    expect(sql).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/); // วันที่ทั้งหมดอยู่ใน bind
    expect(sql).not.toMatch(/\b(DROP|DELETE|UPDATE|INSERT)\b/i);
  });

  test('listActiveRouteIds (R4): is_active = 1 + optional route_id bind + map เป็น number[]', async () => {
    dbMock.query.mockReset();
    dbMock.query.mockResolvedValue({ rows: [{ ROUTE_ID: 2 }, { ROUTE_ID: 3 }] });
    const ids = await reportRepo.listActiveRouteIds(null);
    expect(ids).toEqual([2, 3]);
    [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).toContain('WHERE is_active = 1');
    expect(sql).toContain('AND (:routeId IS NULL OR route_id = :routeId)');
    expect(sql).toMatch(/ORDER\s+BY\s+route_id/);
    expect(binds).toEqual({ routeId: null });
  });

  test('dailyByRoute (R4): PIVOT (IN subquery) + calendar spine (CONNECT BY) + LEFT JOIN + 3 binds', async () => {
    await capture(reportRepo.dailyByRoute, { fromDate: '2025-09-01', toDate: '2025-09-03', routeId: null });
    // เทคนิค UC-28: PIVOT + IN (subquery route is_active=1) — ไม่ hardcode รหัสเส้นทาง
    expect(sql).toContain('PIVOT (SUM(customer_count)');
    expect(sql).toContain('FOR route_id IN (SELECT route_id FROM route WHERE is_active = 1)');
    // openapi: สร้างรายการวันที่ทั้งช่วงก่อน แล้ว LEFT JOIN — วันไม่มีข้อมูลต้องแสดง 0 ไม่ใช่ตัดแถว
    expect(sql).toContain('CONNECT BY LEVEL <=');
    expect(sql).toMatch(/TO_DATE\(:fromDate/);
    expect(sql).toMatch(/TO_DATE\(:toDate/);
    expect(sql).toContain('LEFT JOIN piv p ON p.d = cal.service_date');
    expect(sql).toContain('FROM v_report_daily_by_route v');
    expect(binds).toEqual({ fromDate: '2025-09-01', toDate: '2025-09-03', routeId: null });
    expect(sql).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
    expect(sql).not.toMatch(/\b(DROP|DELETE|UPDATE|INSERT)\b/i);
  });

  test('driverWorkload (R6): ROLLUP + HAVING GROUPING + RANK() analytic + 0-drivers LEFT JOIN + binds', async () => {
    await capture(reportRepo.driverWorkload, { fromDate: '2026-10-01', toDate: '2026-10-31' });
    expect(sql).toContain('GROUP BY ROLLUP(d.emp_id, d.driver_name)');
    expect(sql).toContain('HAVING GROUPING(d.emp_id) = GROUPING(d.driver_name)'); // ตัดแถว subtotal ระดับ emp
    expect(sql).toContain('RANK() OVER (ORDER BY SUM(NVL(v.total_rounds, 0)) DESC)'); // analytic (UC-29)
    expect(sql).toContain('LEFT JOIN v_report_driver_workload v'); // คนขับไม่มีรอบ → 0/0
    expect(sql).toContain('SUM(NVL(v.rounds_before_17, 0))');
    expect(sql).toContain('SUM(NVL(v.rounds_after_17, 0))');
    expect(sql).toContain('FROM driver_assign da');
    // แถวรวมต้องอยู่ท้ายสุด (driver_id null) + analytic rank
    expect(sql).toMatch(/ORDER\s+BY\s+\(CASE\s+WHEN\s+x\.driver_id\s+IS\s+NULL\s+THEN\s+1\s+ELSE\s+0\s+END\)/);
    expect(binds).toEqual({ fromDate: '2026-10-01', toDate: '2026-10-31' });
    expect(sql).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
    expect(sql).not.toMatch(/\b(DROP|DELETE|UPDATE|INSERT)\b/i);
  });

  test('ตารางที่อ้างอิงใน SQL ทั้ง 4 ตัว ⊆ whitelist (รายงานอ่านเฉพาะตารางรายงาน)', async () => {
    const allowed = new Set([
      'dual', 'route', 'employee', 'driver_assign',
      'v_report_boarding_alighting_week', 'v_report_daily_by_route', 'v_report_driver_workload',
    ]);
    const queries = [
      { fn: reportRepo.weeklyBoarding, args: { fromWeek: '2024-12-30', toWeek: '2025-12-29', routeId: null } },
      { fn: reportRepo.listActiveRouteIds, args: null },
      { fn: reportRepo.dailyByRoute, args: { fromDate: '2025-09-01', toDate: '2025-09-03', routeId: null } },
      { fn: reportRepo.driverWorkload, args: { fromDate: '2026-10-01', toDate: '2026-10-31' } },
    ];
    for (const { fn, args } of queries) {
      dbMock.query.mockReset();
      dbMock.query.mockResolvedValue({ rows: [] });
      await fn(args);
      const text = stripComments(dbMock.query.mock.calls[0][0]);
      // ตัดชื่อ CTE (WITH ... AS) ออก — ไม่ใช่ตารางจริง
      const cteNames = [...text.matchAll(/\b([a-z_]+)\s+AS\s*\(/gi)].map((m) => m[1].toLowerCase());
      const refs = [...text.matchAll(/\b(?:FROM|JOIN)\s+([a-z_]+)/gi)]
        .map((m) => m[1].toLowerCase())
        .filter((t) => !cteNames.includes(t));
      expect(refs.length).toBeGreaterThan(0);
      for (const t of refs) expect(allowed).toContain(t);
    }
  });
});

// ================================================== contract: openapi ↔ routes ↔ views ↔ seed (T-060 ส่วน script)
describe('contract: openapi ↔ report routes ↔ 05 views ↔ 02 seed', () => {
  test('openapi มี path/operationId ครบ 7 รายงาน + ตัวอย่าง 501 ตรงค่าที่ routes คืนจริง', () => {
    const spec = OPENAPI();
    const paths = [
      '/report/boarding-alighting-week',
      '/report/annual-booking-stats',
      '/report/user-behavior',
      '/report/daily-by-route',
      '/report/stop-usage',
      '/report/driver-workload',
      '/report/vehicle-usage',
    ];
    for (const p of paths) expect(spec).toContain(`  ${p}:`);
    for (const op of [
      'reportBoardingAlightingWeek', 'reportAnnualBookingStats', 'reportUserBehavior',
      'reportDailyByRoute', 'reportStopUsage', 'reportDriverWorkload', 'reportVehicleUsage',
    ]) {
      expect(spec).toContain(`operationId: "${op}"`);
    }
    // ค่า 501 ที่ route ส่งจริง = ตัวอย่าง openapi components/responses/NotImplemented
    expect(spec).toContain(NOT_IMPLEMENTED_MESSAGE);
    expect(ROUTES_FILE()).toContain(NOT_IMPLEMENTED_MESSAGE);
    expect(spec).toContain('code: "REPORT_NOT_SELECTED"');
    expect(spec).toContain('$ref: "#/components/responses/NotImplemented"');
  });

  test('routes ผูก guard ครบ 7 สิทธิ์ (RPT.R1..R7) + app.js mount /report + seed มี permission ครบ 7 ตัว', () => {
    const routes = ROUTES_FILE();
    for (const perm of ['RPT.R1', 'RPT.R2', 'RPT.R3', 'RPT.R4', 'RPT.R5', 'RPT.R6', 'RPT.R7']) {
      expect(routes).toContain(`requirePermission('${perm}')`);
    }
    // 3 รายงานจริง + 4 stub — ครบตาม 17.5.2 (R1+R4+R6 ทำจริง)
    expect(routes).toContain("router.get(\n    '/boarding-alighting-week'");
    expect(routes).toContain("router.get(\n    '/daily-by-route'");
    expect(routes).toContain("router.get(\n    '/driver-workload'");
    expect(routes).toContain("router.get('/annual-booking-stats'");
    expect(routes).toContain("router.get('/user-behavior'");
    expect(routes).toContain("router.get('/stop-usage'");
    expect(routes).toContain("router.get('/vehicle-usage'");

    const appJs = APP_JS();
    expect(appJs).toContain("require('./routes/report.routes')");
    expect(appJs).toContain("api.use('/report'");

    const seed = SEED_02();
    for (const perm of ['RPT.R1', 'RPT.R2', 'RPT.R3', 'RPT.R4', 'RPT.R5', 'RPT.R6', 'RPT.R7']) {
      expect(seed).toContain(`'${perm}'`);
    }
    expect(seed).toContain("'report'"); // module = report
  });

  test('05 views พร้อมสำหรับ T-054/T-055: view1 มี route_id (GROUP BY) · view2 metric = 3 สถานะ openapi', () => {
    const views = VIEWS_05();
    const sqlOnly = stripComments(views);
    expect((sqlOnly.match(/CREATE OR REPLACE VIEW/g) || []).length).toBe(3);

    // T-054: view รายสัปดาห์ต้องแยกตามเส้นทางเพื่อให้ API กรอง route_id ได้ (SUM กลับรายสัปดาห์)
    expect(sqlOnly).toContain('s.route_id,');
    expect(sqlOnly).toMatch(
      /GROUP\s+BY\s+TRUNC\(s\.service_date,\s*'IW'\),\s*TO_CHAR\(s\.service_date,\s*'IW'\),\s*s\.route_id/,
    );

    // R4 metric (openapi ReportDailyByRoute): นับ cust_id สถานะ reserved/checked_in/completed — no_show ไม่นับ
    expect(sqlOnly).toMatch(
      /COUNT\(DISTINCT\s+CASE\s+WHEN\s+b\.status\s+IN\s+\('reserved',\s*'checked_in',\s*'completed'\)\s+THEN\s+b\.cust_id\s+END\)/,
    );
    expect(sqlOnly).toContain('OVER (PARTITION BY s.service_date)');

    // non-destructive
    expect(sqlOnly).not.toMatch(/DROP\s+(VIEW|TABLE)/i);
    expect(sqlOnly).not.toMatch(/TRUNCATE\s+TABLE/i);
    expect(sqlOnly).not.toMatch(/DELETE\s+FROM/i);
  });
});
