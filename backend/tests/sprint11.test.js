// backend/tests/sprint11.test.js — Sprint 11 (T-047 / T-052 / T-053) regression tests
// ครอบคลุม:
//   T-047 POST /driver/trip/{tripId}/complete (UC-26 · BR-10 · TX · TripSummary · guard TRIP.END)
//   T-052 database/04_seed_report_bulk.sql (non-destructive · FORALL · ปี 2568 · guard · verification)
//   T-053 database/05_views_report.sql (3 VIEW · R1/R4/R6 · เทคนิคที่บังคับ · ไม่มี DROP)
//   + repository SQL ของ complete (bind variables เท่านั้น · FOR UPDATE ไม่ใช่ NOWAIT)
//   + contract: openapi.yaml path/operationId/codes ตรงกับ route/service ที่ส่งมอบ
// โครง test: inject fake repos + fake connection เข้า createApp (ไม่ต้อง Oracle จริง) แบบ sprint08/09/10
//            transaction semantics เลียนแบบ (overlay → commit apply / rollback ทิ้ง) แล้ว assert ผ่าน HTTP + spy

process.env.JWT_SECRET = 'sprint11-test-secret-0123456789abcdef0123456789abcdef';
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
const driverRepo = require('../src/repositories/driver.repository');

const ADMIN_PASS = 'AdminPass123';
const VIEWER_PASS = 'ViewerPass123';
const DRIVER_PASS = 'DriverPass123';
const CUSTOMER_PASS = 'CustomerPass123';

const GUARD_MSG = 'ไม่มีสิทธิ์เข้าถึงส่วนนี้';
const NOT_FOUND_MSG = 'ไม่พบข้อมูลที่ต้องการ';
const FOREIGN_TRIP_MSG = 'คุณไม่ใช่คนขับที่ได้รับมอบหมายรอบนี้';
const ALREADY_COMPLETED_MSG = 'รอบนี้ปิดงานไปแล้ว';
const COMPLETE_OK_MSG = 'ปิดงานสำเร็จ';

const REPO_ROOT = path.join(__dirname, '..', '..');
const readText = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
const SEED_04 = () => readText('database/04_seed_report_bulk.sql');
const VIEWS_05 = () => readText('database/05_views_report.sql');
// ตัดบรรทัดคอมเมนต์ (-- ...) ออกก่อนวิเคราะห์ SQL — คอมเมนต์เป็นเอกสาร ไม่ใช่คำสั่ง
const stripComments = (text) =>
  text
    .split(/\r?\n/)
    .filter((line) => !/^\s*--/.test(line))
    .join('\n');

async function waitFor(check, timeoutMs = 500) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return check();
}

// ---------------------------------------------------------------- fake world (UC-26 เท่านั้น)
function createWorld() {
  const t0 = Date.now();
  const at = (min) => new Date(t0 + min * 60000);

  const profiles = new Map();
  const credentials = new Map();
  const permissions = new Map();
  const menus = new Map();
  const roles = new Map();
  const revoked = [];

  const custFull = { 7: 'มานี รักดี', 99: 'สมชาย มั่นคง' };
  const custLast = { 7: 'รักดี', 99: 'มั่นคง' };

  // round 60 = trip 60 running ของคนขับ 5 (ใช้ success path) · 61 = trip ปิดแล้ว (409)
  //           62 = trip running ของคนขับ 6 (403 ต่างคน)
  const rounds = [
    {
      SCHED_ID: 60,
      VEH_CAP: 9,
      bookings: [
        { BOOKING_ID: 50, CUST_ID: 7, SEATS: 2, STATUS: 'reserved' },
        { BOOKING_ID: 51, CUST_ID: 99, SEATS: 1, STATUS: 'reserved' },
        { BOOKING_ID: 52, CUST_ID: 7, SEATS: 1, STATUS: 'checked_in' },
        { BOOKING_ID: 53, CUST_ID: 99, SEATS: 1, STATUS: 'checked_in' },
        { BOOKING_ID: 54, CUST_ID: 7, SEATS: 1, STATUS: 'checked_in' },
        { BOOKING_ID: 55, CUST_ID: 7, SEATS: 1, STATUS: 'cancelled' },
      ],
    },
    { SCHED_ID: 61, VEH_CAP: 9, bookings: [] },
    { SCHED_ID: 62, VEH_CAP: 15, bookings: [] },
  ];

  const trips = [
    { TRIP_ID: 60, SCHED_ID: 60, DRIVER_ID: 5, VEH_ID: 1, START_TIME: at(-5), END_TIME: null, STATUS: 'running' },
    { TRIP_ID: 61, SCHED_ID: 61, DRIVER_ID: 5, VEH_ID: 1, START_TIME: at(-30), END_TIME: at(-20), STATUS: 'completed' },
    { TRIP_ID: 62, SCHED_ID: 62, DRIVER_ID: 6, VEH_ID: 2, START_TIME: at(-3), END_TIME: null, STATUS: 'running' },
  ];

  // trip_passenger ของ trip 60: boarded = 3 (มี checkin) · alighted = 1 (มี alight เฉพาะ 52)
  const tripPassengers = [
    { tripId: 60, bookingId: 52, checkinTime: at(-4), alightTime: at(-2) },
    { tripId: 60, bookingId: 53, checkinTime: at(-4), alightTime: null },
    { tripId: 60, bookingId: 54, checkinTime: at(-3), alightTime: null },
  ];

  // overlay จำลอง TX: update ลง overlay ก่อน — commit ค่อย apply ลง state, rollback ทิ้ง (ไม่มีสถานะครึ่งกลาง)
  const overlay = { bookingStatuses: new Map(), tripUpdates: new Map() };
  const commitPending = () => {
    for (const [id, status] of overlay.bookingStatuses) {
      const b = findBooking(id);
      if (b) b.STATUS = status;
    }
    for (const [id, patch] of overlay.tripUpdates) {
      const t = trips.find((x) => x.TRIP_ID === id);
      if (t) Object.assign(t, patch);
    }
    overlay.bookingStatuses.clear();
    overlay.tripUpdates.clear();
  };
  const rollbackPending = () => {
    overlay.bookingStatuses.clear();
    overlay.tripUpdates.clear();
  };

  const findBooking = (bookingId) => {
    for (const r of rounds) {
      const b = r.bookings.find((x) => x.BOOKING_ID === Number(bookingId));
      if (b) return b;
    }
    return null;
  };
  const effectiveStatus = (b) =>
    overlay.bookingStatuses.has(b.BOOKING_ID) ? overlay.bookingStatuses.get(b.BOOKING_ID) : b.STATUS;
  const roundOfSched = (schedId) => rounds.find((r) => r.SCHED_ID === Number(schedId)) || null;
  const tripById = (tripId) => trips.find((t) => t.TRIP_ID === Number(tripId)) || null;

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
    // ---- fake driver repo: เลียนแบบ SQL semantics ของ UC-26 (T-047) ----
    driver: {
      lockTripById: jest.fn(async (conn, tripId) => {
        const t = tripById(tripId);
        if (!t) return null;
        const patched = overlay.tripUpdates.get(t.TRIP_ID) || {};
        return {
          TRIP_ID: t.TRIP_ID,
          SCHED_ID: t.SCHED_ID,
          DRIVER_ID: t.DRIVER_ID,
          STATUS: patched.STATUS || t.STATUS,
        };
      }),
      updateTripComplete: jest.fn(async (conn, tripId) => {
        overlay.tripUpdates.set(Number(tripId), { STATUS: 'completed', END_TIME: new Date() });
        return { rowsAffected: 1 };
      }),
      markNoShow: jest.fn(async (conn, schedId) => {
        const r = roundOfSched(schedId);
        let n = 0;
        if (r) {
          for (const b of r.bookings) {
            if (effectiveStatus(b) === 'reserved') {
              overlay.bookingStatuses.set(b.BOOKING_ID, 'no_show');
              n += 1;
            }
          }
        }
        return { rowsAffected: n };
      }),
      summarizeTrip: jest.fn(async (conn, tripId) => {
        const t = tripById(tripId);
        if (!t) return null;
        const r = roundOfSched(t.SCHED_ID) || { bookings: [], VEH_CAP: null };
        const patched = overlay.tripUpdates.get(t.TRIP_ID) || {};
        const active = r.bookings.filter((b) => effectiveStatus(b) !== 'cancelled');
        return {
          TRIP_ID: t.TRIP_ID,
          SCHED_ID: t.SCHED_ID,
          STATUS: patched.STATUS || t.STATUS,
          START_TIME: t.START_TIME,
          END_TIME: patched.END_TIME || t.END_TIME,
          TOTAL_BOOKED: active.length,
          SEATS_BOOKED: active.reduce((sum, b) => sum + b.SEATS, 0),
          BOARDED: tripPassengers.filter((tp) => tp.tripId === t.TRIP_ID && tp.checkinTime).length,
          ALIGHTED: tripPassengers.filter((tp) => tp.tripId === t.TRIP_ID && tp.alightTime).length,
          NO_SHOW_COUNT: r.bookings.filter((b) => effectiveStatus(b) === 'no_show').length,
          CAPACITY: r.VEH_CAP,
        };
      }),
      listNoShowNames: jest.fn(async (conn, schedId) => {
        const r = roundOfSched(schedId);
        if (!r) return [];
        return r.bookings
          .filter((b) => effectiveStatus(b) === 'no_show')
          .map((b) => ({ full: custFull[b.CUST_ID], last: custLast[b.CUST_ID] || '' }))
          .sort((a, b) => (a.last < b.last ? -1 : a.last > b.last ? 1 : 0))
          .map((x) => x.full);
      }),
    },
  };

  addEmployee({ empId: 1, username: 'admin', fullName: 'ผู้ดูแล ระบบ', passwordHash: bcrypt.hashSync(ADMIN_PASS, 4), roles: ['ADMIN'], permissions: ['TRIP.START', 'QR.SCAN', 'BK.VIEW'], menus: [] });
  addEmployee({ empId: 2, username: 'viewer', fullName: 'เจ้าหน้าที่ ดูข้อมูล', passwordHash: bcrypt.hashSync(VIEWER_PASS, 4), roles: ['STAFF'], permissions: ['ROUTE.VIEW'], menus: [] });
  addEmployee({ empId: 5, username: 'somchai', fullName: 'สมชาย คนขับ', passwordHash: bcrypt.hashSync(DRIVER_PASS, 4), roles: ['DRIVER'], permissions: ['TRIP.START', 'TRIP.END', 'QR.SCAN'], menus: [] });
  addEmployee({ empId: 6, username: 'booncho', fullName: 'บุญช่วย มั่นคง', passwordHash: bcrypt.hashSync(DRIVER_PASS, 4), roles: ['DRIVER'], permissions: ['TRIP.START', 'TRIP.END', 'QR.SCAN'], menus: [] });
  addEmployee({ empId: 7, username: 'mai', fullName: 'มานี รักดี', passwordHash: bcrypt.hashSync(CUSTOMER_PASS, 4), roles: ['CUSTOMER'], permissions: ['BK.VIEW'], menus: [] });

  return {
    repos,
    state: { profiles, credentials, permissions, menus, roles, revoked, rounds, trips, tripPassengers, overlay },
    commitPending,
    rollbackPending,
  };
}

function makeConn(world) {
  return {
    commit: jest.fn(async () => world.commitPending()),
    rollback: jest.fn(async () => world.rollbackPending()),
    close: jest.fn(async () => {}),
    execute: jest.fn(async () => ({ rowsAffected: 1 })),
  };
}

function setup(world, overrides = {}) {
  const conn = makeConn(world);
  const fakePool = { getConnection: jest.fn(async () => conn) };
  const db = {
    query: jest.fn(),
    checkDbHealth: jest.fn(async () => ({ connected: true, latencyMs: 1 })),
    withTransaction: jest.fn(dbMock.createTransactionRunner(() => fakePool)),
  };
  const auditSink = overrides.auditSink || jest.fn();
  const app = createApp({
    healthCheck: async () => ({ connected: true, latencyMs: 1 }),
    auditSink,
    db,
    repos: world.repos,
  });
  return { app, conn, db, auditSink, fakePool };
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

// ================================================== T-047 POST /driver/trip/{tripId}/complete (UC-26)
describe('T-047 POST /api/v1/driver/trip/{tripId}/complete (UC-26 · BR-10 · TripSummary)', () => {
  let world;
  let app;
  let conn;
  let auditSink;
  let somchai;

  beforeEach(async () => {
    world = createWorld();
    ({ app, conn, auditSink } = setup(world));
    somchai = await tokenFor(app, 'somchai', DRIVER_PASS);
    auditSink.mockClear(); // เคลียร์ POST /auth/login
  });

  const complete = (tripId, tok = somchai) =>
    request(app).post(`/api/v1/driver/trip/${tripId}/complete`).set(authHeader(tok)).send({});
  const bookingOf = (id) => world.state.rounds.flatMap((r) => r.bookings).find((b) => b.BOOKING_ID === id);
  const tripOf = (id) => world.state.trips.find((t) => t.TRIP_ID === id);

  test('401 ไม่มี token; 403 ไม่มี TRIP.END — guard คนละตัวกับ TRIP.START (admin/viewer/mai)', async () => {
    const noAuth = await request(app).post('/api/v1/driver/trip/60/complete').send({});
    expect(noAuth.status).toBe(401);
    expect(noAuth.body.error).toMatchObject({ code: 'UNAUTHORIZED' });

    const viewer = await tokenFor(app, 'viewer', VIEWER_PASS);
    const res = await complete(60, viewer);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: 'FORBIDDEN', message: GUARD_MSG });

    // admin มี TRIP.START แต่ไม่มี TRIP.END → ต้องโดน completeGuard ปฏิเสธ (ไม่ใช่คนเดียวกับ schedule/start)
    const admin = await tokenFor(app, 'admin', ADMIN_PASS);
    const res2 = await complete(60, admin);
    expect(res2.status).toBe(403);
    expect(res2.body.error).toMatchObject({ code: 'FORBIDDEN', message: GUARD_MSG });

    const mai = await tokenFor(app, 'mai', CUSTOMER_PASS);
    const res3 = await complete(60, mai);
    expect(res3.status).toBe(403);

    expect(world.repos.driver.lockTripById).not.toHaveBeenCalled(); // guard ตัดก่อนเข้า service
  });

  test('200: TripSummary 12 ฟิลด์ + BR-10 reserved→no_show + ลำดับ TX lock→update→no_show→สรุป→COMMIT', async () => {
    const res = await complete(60);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe(COMPLETE_OK_MSG);

    const data = res.body.data;
    expect(Object.keys(data).sort()).toEqual(
      ['trip_id', 'sched_id', 'status', 'start_time', 'end_time', 'total_booked', 'boarded', 'alighted',
       'no_show_count', 'no_show_names', 'seats_booked', 'capacity'].sort(),
    );
    // ค่าจริงจาก fixture: จองไม่รวม cancelled = 5 · seats = 6 · เช็คอิน 3 · ลงรถ 1 · no_show 2 · รถ 9 ที่นั่ง
    expect(data).toMatchObject({
      trip_id: 60,
      sched_id: 60,
      status: 'completed',
      total_booked: 5,
      boarded: 3,
      alighted: 1,
      no_show_count: 2,
      seats_booked: 6,
      capacity: 9,
    });
    expect(data.start_time).toEqual(expect.any(String));
    expect(data.end_time).toEqual(expect.any(String));
    expect(data.no_show_names).toEqual(['สมชาย มั่นคง', 'มานี รักดี']); // เรียง last_name (มั่นคง < รักดี)

    // BR-10: reserved 2 รายการกลายเป็น no_show หลัง commit — checked_in/cancelled ไม่แตะ
    expect(bookingOf(50).STATUS).toBe('no_show');
    expect(bookingOf(51).STATUS).toBe('no_show');
    expect(bookingOf(52).STATUS).toBe('checked_in');
    expect(bookingOf(55).STATUS).toBe('cancelled');
    expect(tripOf(60).STATUS).toBe('completed');
    expect(tripOf(60).END_TIME).toBeInstanceOf(Date);

    // TX: commit ครั้งเดียว / ไม่ rollback + ลำดับขั้นตอนตาม openapi x-transaction
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    const d = world.repos.driver;
    expect(d.lockTripById).toHaveBeenCalledWith(conn, 60);
    expect(d.updateTripComplete).toHaveBeenCalledWith(conn, 60);
    expect(d.markNoShow).toHaveBeenCalledWith(conn, 60);
    expect(d.summarizeTrip).toHaveBeenCalledWith(conn, 60);
    expect(d.listNoShowNames).toHaveBeenCalledWith(conn, 60);
    expect(d.lockTripById.mock.invocationCallOrder[0]).toBeLessThan(d.updateTripComplete.mock.invocationCallOrder[0]);
    expect(d.updateTripComplete.mock.invocationCallOrder[0]).toBeLessThan(d.markNoShow.mock.invocationCallOrder[0]);
    expect(d.markNoShow.mock.invocationCallOrder[0]).toBeLessThan(d.summarizeTrip.mock.invocationCallOrder[0]);
    expect(d.summarizeTrip.mock.invocationCallOrder[0]).toBeLessThan(d.listNoShowNames.mock.invocationCallOrder[0]);
  });

  test('409 กดปิดซ้ำ (trip เคย completed) → TRIP_ALREADY_COMPLETED + rollback ไม่แตะ trip/booking', async () => {
    const res = await complete(61);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'TRIP_ALREADY_COMPLETED', message: ALREADY_COMPLETED_MSG });
    expect(world.repos.driver.updateTripComplete).not.toHaveBeenCalled();
    expect(world.repos.driver.markNoShow).not.toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalled();
    expect(tripOf(61).STATUS).toBe('completed'); // คงเดิม (overlay ถูกทิ้ง)
    expect(tripOf(61).END_TIME).toBeInstanceOf(Date); // ค่าเดิมไม่ถูกเขียนทับ
  });

  test('404: trip ไม่มีจริง → NOT_FOUND (rollback ใน TX); tripId ไม่ใช่ตัวเลข/≤0 → NOT_FOUND ก่อนเข้า TX', async () => {
    const missing = await complete(999);
    expect(missing.status).toBe(404);
    expect(missing.body.error).toMatchObject({ code: 'NOT_FOUND', message: NOT_FOUND_MSG });
    expect(world.repos.driver.lockTripById).toHaveBeenCalledWith(conn, 999);
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();

    for (const bad of ['abc', '-1']) {
      const res = await complete(bad);
      expect(res.status).toBe(404);
      expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', message: NOT_FOUND_MSG });
    }
    expect(world.repos.driver.lockTripById).toHaveBeenCalledTimes(1); // 'abc'/'-1' ไม่เข้า TX
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  test('403 ownership: คนขับอื่นปิดรอบเราไม่ได้ + 403 มาก่อน 409 (trip ปิดแล้วของคนอื่น)', async () => {
    // somchai (5) ปิด trip 62 ของ booncho (6) → 403
    const res = await complete(62);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: 'FORBIDDEN', message: FOREIGN_TRIP_MSG });
    expect(world.repos.driver.updateTripComplete).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalled();

    // booncho (6) ปิด trip 61 (ของคนขับ 5, status completed) → ต้อง 403 ก่อน 409 (ลำดับตรวจใน service)
    const res2 = await complete(61, await tokenFor(app, 'booncho', DRIVER_PASS));
    expect(res2.status).toBe(403);
    expect(res2.body.error).toMatchObject({ code: 'FORBIDDEN', message: FOREIGN_TRIP_MSG });
  });

  test('markNoShow ล้มเหลว → 500 + rollback ทั้ง TX: trip ยัง running + booking ยัง reserved (ไม่มีสถานะครึ่งกลาง)', async () => {
    world.repos.driver.markNoShow.mockRejectedValueOnce(new Error('update failed'));
    const res = await complete(60);
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
    // openapi: ห้ามมีรอบที่ปิดแล้วแต่ booking ค้าง reserved → ในทางกลับกันก็ห้าม booking ถูก flip ถ้า trip ไม่ปิด
    expect(tripOf(60).STATUS).toBe('running');
    expect(tripOf(60).END_TIME).toBeNull();
    expect(bookingOf(50).STATUS).toBe('reserved');
    expect(bookingOf(51).STATUS).toBe('reserved');
  });

  test('audit: POST complete → entry path/method/statusCode/empId + ts/durationMs', async () => {
    const res = await complete(60);
    expect(res.status).toBe(200);
    const ok = await waitFor(() => auditSink.mock.calls.some((c) => c[0].path === '/api/v1/driver/trip/60/complete'));
    expect(ok).toBe(true);
    const entry = auditSink.mock.calls.map((c) => c[0]).find((e) => e.path === '/api/v1/driver/trip/60/complete');
    expect(entry).toMatchObject({ method: 'POST', statusCode: 200, empId: 5 });
    expect(entry.ts).toEqual(expect.any(String));
    expect(entry.durationMs).toEqual(expect.any(Number));
    expect(JSON.stringify(entry)).not.toContain('qr'); // complete ไม่มี qr เกี่ยวข้อง
  });
});

// ================================================== repository SQL (complete TX)
describe('driver repository SQL (T-047): bind variables เท่านั้น + FOR UPDATE ไม่ใช่ NOWAIT', () => {
  test('lockTripById: SELECT trip ... FOR UPDATE (blocking) + bind tripId ไม่ฝังค่า', async () => {
    const conn = { execute: jest.fn(async () => ({ rows: [] })) };
    await driverRepo.lockTripById(conn, 777);
    const [sql, binds] = conn.execute.mock.calls[0];
    expect(sql).toContain('FROM trip');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).not.toContain('NOWAIT');
    expect(sql).toContain(':tripId');
    expect(sql).not.toContain('777');
    expect(binds).toEqual({ tripId: 777 });
  });

  test('updateTripComplete: UPDATE trip SET end_time = SYSTIMESTAMP, status = literal completed', async () => {
    const conn = { execute: jest.fn(async () => ({ rowsAffected: 1 })) };
    await driverRepo.updateTripComplete(conn, 8888);
    const [sql, binds] = conn.execute.mock.calls[0];
    expect(sql).toContain("UPDATE trip SET end_time = SYSTIMESTAMP, status = 'completed'");
    expect(sql).toContain(':tripId');
    expect(sql).not.toContain('8888');
    expect(binds).toEqual({ tripId: 8888 });
  });

  test('markNoShow (BR-10): UPDATE booking → no_show เฉพาะ status = reserved + bind schedId', async () => {
    const conn = { execute: jest.fn(async () => ({ rowsAffected: 2 })) };
    await driverRepo.markNoShow(conn, 9911);
    const [sql, binds] = conn.execute.mock.calls[0];
    expect(sql).toContain("UPDATE booking SET status = 'no_show'");
    expect(sql).toContain("WHERE sched_id = :schedId AND status = 'reserved'"); // เฉพาะ reserved เท่านั้น (BR-10)
    expect(binds).toEqual({ schedId: 9911 });
  });

  test('summarizeTrip: นับจาก 4 แหล่ง — ไม่ cancelled / checkin / alight / no_show + capacity + bind', async () => {
    const conn = { execute: jest.fn(async () => ({ rows: [] })) };
    await driverRepo.summarizeTrip(conn, 5555);
    const [sql, binds] = conn.execute.mock.calls[0];
    expect(sql).toContain("b.status <> 'cancelled'");       // total_booked + seats_booked
    expect(sql).toContain('tp.checkin_time IS NOT NULL');   // boarded
    expect(sql).toContain('tp.alight_time IS NOT NULL');    // alighted
    expect(sql).toContain("b.status = 'no_show'");          // no_show_count
    expect(sql).toContain('vt.capacity');                   // capacity
    expect(sql).toContain(':tripId');
    expect(sql).not.toContain('5555');
    expect(binds).toEqual({ tripId: 5555 });
  });

  test('listNoShowNames: JOIN employee + status = no_show + ORDER BY last_name + bind', async () => {
    const conn = { execute: jest.fn(async () => ({ rows: [{ PASSENGER_NAME: 'สมชาย มั่นคง' }] })) };
    const rows = await driverRepo.listNoShowNames(conn, 6666);
    expect(rows).toEqual(['สมชาย มั่นคง']);
    const [sql, binds] = conn.execute.mock.calls[0];
    expect(sql).toContain("b.status = 'no_show'");
    expect(sql).toContain('ORDER BY e.last_name, e.first_name');
    expect(sql).toContain(':schedId');
    expect(sql).not.toContain('6666');
    expect(binds).toEqual({ schedId: 6666 });
  });
});

// ================================================== T-052 04_seed_report_bulk.sql
describe('T-052 database/04_seed_report_bulk.sql (non-destructive · ปี 2568 · ≥ 50,000)', () => {
  let sql;
  beforeAll(() => {
    sql = SEED_04();
  });

  test('non-destructive: ไม่มี DROP/TRUNCATE/DELETE/UPDATE — มีแต่ INSERT + guard กันรันซ้ำ + COMMIT/ROLLBACK', () => {
    expect(sql).not.toMatch(/DROP\s+(TABLE|VIEW|SEQUENCE|INDEX)/i);
    expect(sql).not.toMatch(/TRUNCATE/i);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
    expect(sql).not.toMatch(/\bUPDATE\s+[a-z_]+\s+SET/i);
    expect(sql).toContain('RAISE_APPLICATION_ERROR(');
    expect(sql).toContain('-20001'); // guard: มีรอบปี 2568 แล้ว → abort ก่อน DML
    expect(sql).toContain("DATE '2025-01-01'");
    expect(sql).toContain("DATE '2025-12-31'");
    expect(sql).toContain('COMMIT;');
    expect(sql).toMatch(/WHEN OTHERS THEN[\s\S]*ROLLBACK/);
  });

  test('bulk ด้วย FORALL + เป้า 50,000 + verification block ต้องมี PASS/FAIL ทุกตาราง', () => {
    const forallCount = (sql.match(/FORALL/g) || []).length;
    expect(forallCount).toBeGreaterThanOrEqual(6);
    expect(sql).toContain('50000'); // c_target (Q10)
    expect(sql).toContain('BOOKING_SEED68'); // verification แยก data ชุดรายงาน
    expect(sql).toContain("'PASS'");
    expect(sql).toContain('5840');   // schedule / trip / assign
    expect(sql).toContain('26280');  // schedule_stop (4+5 จุด × 5,840 รอบ)
    expect(sql).toContain('SEED68'); // marker qr_token ของชุดข้อมูลปี 2568
  });

  test('BR checks ใน verification: BR-10/07/04/11/05 + สถานะ seed = completed/no_show/cancelled เท่านั้น', () => {
    expect(sql).toContain('BR-10');
    expect(sql).toContain('BR-07');
    expect(sql).toContain('BR-04');
    expect(sql).toContain('BR-11');
    expect(sql).toContain('BR-05');
    expect(sql).toContain("'completed'");
    expect(sql).toContain("'no_show'");
    expect(sql).toContain("'cancelled'");
    // ข้อมูลปีเก่าห้ามค้างสถานะ active — 'reserved' ห้ามปรากฏใน seed ชุดนี้
    expect(sql).not.toContain("'reserved'");
    // BR-07 verification: ที่นั่งรวม (ไม่รวม cancelled) ≤ capacity
    expect(sql).toContain('used_seats > capacity');
  });

  test('ตารางที่ INSERT ⊆ whitelist (ไม่แตะตาราง master/สิทธิ์/ระบบ)', () => {
    const allowed = new Set([
      'employee', 'employee_role', 'schedule', 'schedule_stop',
      'driver_assign', 'vehicle_assign', 'trip', 'booking', 'trip_passenger',
    ]);
    const targets = [...sql.matchAll(/INSERT\s+INTO\s+([a-z_]+)/gi)].map((m) => m[1].toLowerCase());
    expect(targets.length).toBeGreaterThanOrEqual(8);
    for (const t of targets) expect(allowed).toContain(t);
  });
});

// ================================================== T-053 05_views_report.sql
describe('T-053 database/05_views_report.sql (VIEW ช่วย Aggregate · R1/R4/R6)', () => {
  let sql;
  beforeAll(() => {
    sql = VIEWS_05();
  });

  test('non-destructive: CREATE OR REPLACE VIEW × 3 — ไม่มี DROP VIEW/TABLE, TRUNCATE, DELETE', () => {
    expect(sql).not.toMatch(/DROP\s+(VIEW|TABLE)/i);
    expect(sql).not.toMatch(/TRUNCATE\s+TABLE/i);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
    const sqlOnly = stripComments(sql); // นับเฉพาะคำสั่งจริง (หัวข้อไฟล์มีคำว่า CREATE OR REPLACE VIEW ในคอมเมนต์)
    expect((sqlOnly.match(/CREATE OR REPLACE VIEW/g) || []).length).toBe(3);
    expect(sql).toContain('v_report_boarding_alighting_week');
    expect(sql).toContain('v_report_daily_by_route');
    expect(sql).toContain('v_report_driver_workload');
  });

  test('R1 (UC-27): ISO week + CASE IS NOT NULL + EXISTS — และห้ามกับดัก COUNT(DISTINCT alight_time)', () => {
    expect(sql).toContain("TRUNC(s.service_date, 'IW')");
    expect(sql).toContain("TO_CHAR(s.service_date, 'IW')");
    expect(sql).toContain('EXISTS (SELECT 1 FROM trip');
    expect(sql).toContain('tp.checkin_time IS NOT NULL');
    expect(sql).toContain('tp.alight_time IS NOT NULL');
    expect(sql).toMatch(/COUNT\s*\(\s*DISTINCT\s+CASE\s+WHEN\s+b\.status\s*=\s*'no_show'/i); // no_show นับคน ไม่นับเวลา
    // ⛔ กับดัก: ห้าม COUNT(DISTINCT alight_time) — ตรวจเฉพาะคำสั่งจริง (คอมเมนต์ที่ "ห้ามใช้" ไม่นับ)
    expect(stripComments(sql)).not.toMatch(/COUNT\s*\(\s*DISTINCT\s+alight_time\s*\)/i);
  });

  test('R4 (UC-28): analytic day_total partition by service_date + GROUP BY วันเต็ม + ตัวอย่าง PIVOT', () => {
    expect(sql).toContain('OVER (PARTITION BY s.service_date)');
    expect(sql).toContain('day_total');
    expect(sql).toContain("TO_CHAR(s.service_date, 'Day')");
    expect(sql).toMatch(/GROUP\s+BY\s+s\.service_date/);
    expect(sql).toContain('PIVOT'); // เทคนิคที่ UC-28 กำหนด (ใช้โดย T-055)
    expect(sql).toContain('customer_count');
  });

  test('R6 (UC-29): TO_CHAR HH24 ก่อน/หลัง 17:00 + ตัวอย่าง ROLLUP แถวรวม', () => {
    expect(sql).toContain("TO_CHAR(s.depart_at, 'HH24') < '17'");
    expect(sql).toContain("TO_CHAR(s.depart_at, 'HH24') >= '17'");
    expect(sql).toContain('rounds_before_17');
    expect(sql).toContain('rounds_after_17');
    expect(sql).toContain('ROLLUP'); // แถว "รวมทั้งหมด" (query ของ T-056)
    expect(sql).toContain('GROUP BY ROLLUP(driver_name)');
  });

  test('ตารางที่อ้างอิง ⊆ whitelist (report views อ่านเฉพาะตารางรายงาน)', () => {
    const allowed = new Set([
      'schedule', 'booking', 'trip', 'trip_passenger', 'route', 'driver_assign', 'employee',
      'v_report_boarding_alighting_week', 'v_report_daily_by_route', 'v_report_driver_workload',
    ]);
    const refs = [...stripComments(sql).matchAll(/\b(?:FROM|JOIN)\s+([a-z_]+)/gi)].map((m) => m[1].toLowerCase());
    expect(refs.length).toBeGreaterThan(5);
    for (const t of refs) expect(allowed).toContain(t);
  });
});

// ================================================== contract: openapi ↔ route/service
describe('contract ปิดรอบ (openapi ↔ route ↔ service)', () => {
  test('openapi.yaml มี path + operationId + error code + message ที่ service ส่งมอบ', () => {
    const openapi = readText('docs/api/openapi.yaml');
    expect(openapi).toContain('/driver/trip/{tripId}/complete:');
    expect(openapi).toContain('operationId: "completeTrip"');
    expect(openapi).toContain('TRIP_ALREADY_COMPLETED');
    expect(openapi).toContain(ALREADY_COMPLETED_MSG); // example 409
    expect(openapi).toContain(COMPLETE_OK_MSG);       // example 200
    expect(openapi).toContain('TripSummary');
  });

  test('route ใช้ guard TRIP.END + ไม่มี path ชนกับ scan/manifest', () => {
    const routes = readText('backend/src/routes/driver.routes.js');
    expect(routes).toContain("requirePermission('TRIP.END')");
    expect(routes).toContain("'/trip/:tripId/complete'");
    expect(routes).toContain(COMPLETE_OK_MSG);
    const service = readText('backend/src/services/driver.service.js');
    expect(service).toContain('TRIP_ALREADY_COMPLETED');
    expect(service).toContain("markNoShow(conn, schedId)"); // BR-10 อยู่ใน TX เดียวกัน
    expect(service).toContain('BR-10');
  });
});
