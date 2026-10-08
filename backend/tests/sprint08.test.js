// backend/tests/sprint08.test.js — Sprint 8 (T-034 / T-035 / T-036 / T-037) regression tests
// ครอบคลุม: GET /booking/available (UC-17 · BR-05/BR-07/BR-11/BR-12), POST /booking (UC-18 · BR-05/06/07
//           + FOR UPDATE NOWAIT + seq_booking_code + qr_token), GET /booking/{id}/qr (UC-20 · ownership/cancelled)
//           สิทธิ์ BK.VIEW / BK.CREATE (โหลดจาก DB ทุก request) · repository SQL แบบ bind variables
// สถาปัตยกรรม: inject fake repos + fake connection เข้า createApp (ไม่แตะ Oracle จริง)
//               transaction runner / SQL ของ repository เป็นโค้ดจริงที่ assert ผ่าน spy
// ขอบเขตเดิมไม่มี: GET /booking/me (T-039) · POST /booking/{id}/cancel (T-038) — เพิ่มใน sprint 9 (chapter-18)
//   → 2 test ด้านล่าง (wiring / "นอกขอบเขต") ถูกขยายตามขอบเขต sprint 9 ไม่ใช่การอ่อนข้อ test (ดู sprint09 handoff)

process.env.JWT_SECRET = 'sprint08-test-secret-0123456789abcdef0123456789abcdef';
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
const bookingRepo = require('../src/repositories/booking.repository');

const ADMIN_PASS = 'AdminPass123';
const VIEWER_PASS = 'ViewerPass123';
const CUSTOMER_PASS = 'CustomerPass123';
const OUTSIDER_PASS = 'OutsiderPass123';

const SEAT_FULL_MSG = 'ที่นั่งไม่เพียงพอ';
const LEAD_MSG = 'กรุณาจองล่วงหน้าอย่างน้อย 20 นาทีก่อนรถถึงจุดขึ้น';
const STOP_ORDER_MSG = 'จุดจอดลงต้องอยู่หลังจุดจอดขึ้น';
const STOP_NOT_IN_ROUTE_MSG = 'จุดจอดที่เลือกไม่อยู่ในเส้นทางของรอบเวลานี้';
const FOREIGN_QR_MSG = 'ไม่มีสิทธิ์ดู QR ของการจองนี้';
const GUARD_MSG = 'ไม่มีสิทธิ์เข้าถึงส่วนนี้';
const VALIDATION_TOP = 'ข้อมูลที่ส่งมาไม่ถูกต้อง';

function isPngBase64(value) {
  const buf = Buffer.from(value, 'base64');
  return buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
}

// ---------------------------------------------------------------- fake world
function createWorld() {
  const t0 = Date.now();
  const at = (min) => new Date(t0 + min * 60000);

  const profiles = new Map();
  const credentials = new Map();
  const permissions = new Map();
  const menus = new Map();
  const roles = new Map();
  const revoked = [];

  const DATE = at(45).toISOString().slice(0, 10); // วันของรอบหลัก (BR-05 ไม่ผูกกับปฏิทินจริง)
  const OTHER_DATE = '2027-01-01'; // วันที่มีรอบ 26/27 (ใช้ทดสอบ POST ไม่พึ่งวัน)
  const EMPTY_DATE = '2027-06-01'; // ไม่มีรอบเลย → BR-12 → data: []

  const stopName = (id) =>
    ({ 1: 'มหาวิทยาลัยเทคโนโลยีมหานคร', 2: 'โลตัสหนองจอก', 4: 'ร้านส้มตำปูนาง' })[id] || null;

  function mkStops(list) {
    return list.map(([stopId, seq, arriveAt]) => ({ STOP_ID: stopId, STOP_SEQ: seq, ARRIVE_AT: arriveAt, STOP_NAME: stopName(stopId) }));
  }

  // วัน DATE: 20 รอบสมบูรณ์ · 21 เกิน BR-05 (ถึงใน 15 นาที) · 22 เต็ม · 23 ปิดใช้ · 25 จุดลงก่อนจุดขึ้น
  // วัน OTHER_DATE: 26 เกิน BR-05 (ใช้ POST) · 27 เกือบเต็ม (ใช้ POST SEAT_FULL)
  const rounds = [
    {
      SCHED_ID: 20,
      ROUTE_ID: 2,
      ROUTE_NAME: 'เส้นทางที่ 2',
      SERVICE_DATE: DATE,
      DEPART_AT: at(45),
      IS_ACTIVE: 1,
      CAPACITY: 9,
      PLATE_NO: 'สย 2591',
      stops: mkStops([
        [1, 1, at(50)],
        [2, 2, at(55)],
        [4, 3, at(60)],
      ]),
      bookings: [
        // 1 = ของคนอื่น (403) · 2 = ยกเลิกแล้ว (404) · 3 = เช็คอินแล้ว (คืน status) · 4 = ของฉัน (200)
        { BOOKING_ID: 1, CUST_ID: 99, SEATS: 2, STATUS: 'reserved', BOOKING_CODE: 'BK1', QR_TOKEN: 'f'.repeat(32), BOOK_TIME: at(-30), CANCEL_TIME: null, BOARD_STOP_ID: 1, ALIGHT_STOP_ID: 4 },
        { BOOKING_ID: 2, CUST_ID: 7, SEATS: 1, STATUS: 'cancelled', BOOKING_CODE: 'BK2', QR_TOKEN: 'b'.repeat(32), BOOK_TIME: at(-30), CANCEL_TIME: at(-20), BOARD_STOP_ID: 1, ALIGHT_STOP_ID: 4 },
        { BOOKING_ID: 3, CUST_ID: 7, SEATS: 1, STATUS: 'checked_in', BOOKING_CODE: 'BK3', QR_TOKEN: 'c'.repeat(32), BOOK_TIME: at(-30), CANCEL_TIME: null, BOARD_STOP_ID: 1, ALIGHT_STOP_ID: 4 },
        { BOOKING_ID: 4, CUST_ID: 7, SEATS: 1, STATUS: 'reserved', BOOKING_CODE: 'BK4', QR_TOKEN: '0123456789abcdef0123456789abcdef', BOOK_TIME: at(-25), CANCEL_TIME: null, BOARD_STOP_ID: 1, ALIGHT_STOP_ID: 4 },
      ],
    },
    {
      SCHED_ID: 21,
      ROUTE_ID: 2,
      ROUTE_NAME: 'เส้นทางที่ 2',
      SERVICE_DATE: DATE,
      DEPART_AT: at(10),
      IS_ACTIVE: 1,
      CAPACITY: 9,
      PLATE_NO: 'สย 2592',
      stops: mkStops([
        [1, 1, at(15)],
        [2, 2, at(16)],
        [4, 3, at(17)],
      ]),
      bookings: [],
    },
    {
      SCHED_ID: 22,
      ROUTE_ID: 2,
      ROUTE_NAME: 'เส้นทางที่ 2',
      SERVICE_DATE: DATE,
      DEPART_AT: at(45),
      IS_ACTIVE: 1,
      CAPACITY: 4,
      PLATE_NO: 'สย 2592',
      stops: mkStops([
        [1, 1, at(50)],
        [2, 2, at(55)],
        [4, 3, at(60)],
      ]),
      bookings: [{ BOOKING_ID: 10, CUST_ID: 99, SEATS: 4, STATUS: 'reserved', BOOKING_CODE: 'BK10', QR_TOKEN: 'd'.repeat(32), BOOK_TIME: at(-30), CANCEL_TIME: null, BOARD_STOP_ID: 1, ALIGHT_STOP_ID: 4 }],
    },
    {
      SCHED_ID: 23,
      ROUTE_ID: 2,
      ROUTE_NAME: 'เส้นทางที่ 2',
      SERVICE_DATE: DATE,
      DEPART_AT: at(55),
      IS_ACTIVE: 0,
      CAPACITY: 9,
      PLATE_NO: 'สย 2591',
      stops: mkStops([
        [1, 1, at(60)],
        [2, 2, at(61)],
        [4, 3, at(62)],
      ]),
      bookings: [],
    },
    {
      SCHED_ID: 25,
      ROUTE_ID: 5,
      ROUTE_NAME: 'เส้นทางลำดับกลับ',
      SERVICE_DATE: DATE,
      DEPART_AT: at(35),
      IS_ACTIVE: 1,
      CAPACITY: 9,
      PLATE_NO: 'สย 2592',
      stops: mkStops([
        [4, 1, at(40)],
        [1, 2, at(45)],
        [2, 3, at(50)],
      ]),
      bookings: [],
    },
    {
      SCHED_ID: 26,
      ROUTE_ID: 2,
      ROUTE_NAME: 'เส้นทางที่ 2',
      SERVICE_DATE: OTHER_DATE,
      DEPART_AT: at(8),
      IS_ACTIVE: 1,
      CAPACITY: 9,
      PLATE_NO: 'สย 2591',
      stops: mkStops([
        [1, 1, at(12)],
        [2, 2, at(13)],
        [4, 3, at(14)],
      ]),
      bookings: [],
    },
    {
      SCHED_ID: 27,
      ROUTE_ID: 2,
      ROUTE_NAME: 'เส้นทางที่ 2',
      SERVICE_DATE: OTHER_DATE,
      DEPART_AT: at(55),
      IS_ACTIVE: 1,
      CAPACITY: 9,
      PLATE_NO: 'สย 2591',
      stops: mkStops([
        [1, 1, at(60)],
        [2, 2, at(61)],
        [4, 3, at(62)],
      ]),
      bookings: [
        { BOOKING_ID: 11, CUST_ID: 99, SEATS: 4, STATUS: 'reserved', BOOKING_CODE: 'BK11', QR_TOKEN: 'e'.repeat(32), BOOK_TIME: at(-30), CANCEL_TIME: null, BOARD_STOP_ID: 1, ALIGHT_STOP_ID: 4 },
        { BOOKING_ID: 12, CUST_ID: 99, SEATS: 4, STATUS: 'reserved', BOOKING_CODE: 'BK12', QR_TOKEN: '9'.repeat(32), BOOK_TIME: at(-30), CANCEL_TIME: null, BOARD_STOP_ID: 1, ALIGHT_STOP_ID: 4 },
      ],
    },
  ];

  let nextBookingId = 100;

  function reservedSum(round) {
    return round.bookings
      .filter((b) => b.STATUS === 'reserved')
      .reduce((sum, b) => sum + b.SEATS, 0);
  }

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
    // ---- fake booking repo: เลียนแบบ SQL semantics ของ booking.repository (BR-05/07/11/12) ----
    booking: {
      findStopPairSeqs: jest.fn(async ({ boardStopId, alightStopId, serviceDate }) => {
        const pairs = [];
        for (const r of rounds) {
          if (r.SERVICE_DATE !== serviceDate) continue;
          const b = r.stops.find((s) => s.STOP_ID === Number(boardStopId));
          const a = r.stops.find((s) => s.STOP_ID === Number(alightStopId));
          if (b && a) pairs.push({ BOARD_SEQ: b.STOP_SEQ, ALIGHT_SEQ: a.STOP_SEQ });
        }
        return pairs;
      }),
      findAvailable: jest.fn(async ({ boardStopId, alightStopId, serviceDate }) => {
        const rows = [];
        for (const r of rounds) {
          if (r.SERVICE_DATE !== serviceDate || Number(r.IS_ACTIVE) !== 1) continue;
          const b = r.stops.find((s) => s.STOP_ID === Number(boardStopId));
          const a = r.stops.find((s) => s.STOP_ID === Number(alightStopId));
          if (!b || !a || Number(b.STOP_SEQ) >= Number(a.STOP_SEQ)) continue; // BR-11 + BR-12
          if (b.ARRIVE_AT.getTime() - Date.now() < 20 * 60000) continue; // BR-05 (SYSTIMESTAMP)
          const reserved = reservedSum(r);
          if (r.CAPACITY - reserved <= 0) continue; // BR-07
          rows.push({
            SCHED_ID: r.SCHED_ID,
            ROUTE_ID: r.ROUTE_ID,
            ROUTE_NAME: r.ROUTE_NAME,
            SERVICE_DATE: r.SERVICE_DATE,
            DEPART_AT: r.DEPART_AT,
            BOARD_STOP_ID: b.STOP_ID,
            BOARD_SEQ: b.STOP_SEQ,
            BOARD_STOP_NAME: b.STOP_NAME,
            ALIGHT_STOP_ID: a.STOP_ID,
            ALIGHT_SEQ: a.STOP_SEQ,
            ALIGHT_STOP_NAME: a.STOP_NAME,
            BOARD_ARRIVE_AT: b.ARRIVE_AT,
            SEATS_TOTAL: r.CAPACITY,
            SEATS_RESERVED: reserved,
            PLATE_NO: r.PLATE_NO,
          });
        }
        return rows.sort((x, y) => x.DEPART_AT - y.DEPART_AT || x.SCHED_ID - y.SCHED_ID);
      }),
      findBookingContext: jest.fn(async ({ schedId, boardStopId, alightStopId }) => {
        const r = rounds.find((x) => x.SCHED_ID === Number(schedId));
        if (!r) return null;
        const b = r.stops.find((s) => s.STOP_ID === Number(boardStopId)) || null;
        const a = r.stops.find((s) => s.STOP_ID === Number(alightStopId)) || null;
        return {
          SCHED_ID: r.SCHED_ID,
          IS_ACTIVE: r.IS_ACTIVE,
          DEPART_AT: r.DEPART_AT,
          BOARD_SEQ: b ? b.STOP_SEQ : null,
          ALIGHT_SEQ: a ? a.STOP_SEQ : null,
          BOARD_ARRIVE_AT: b ? b.ARRIVE_AT : null,
        };
      }),
      lockSchedule: jest.fn(async (conn, schedId) => {
        const r = rounds.find((x) => x.SCHED_ID === Number(schedId));
        return r ? { SCHED_ID: r.SCHED_ID } : null;
      }),
      seatSummary: jest.fn(async (conn, schedId) => {
        const r = rounds.find((x) => x.SCHED_ID === Number(schedId));
        if (!r) return null;
        return { CAPACITY: r.CAPACITY, RESERVED: reservedSum(r) };
      }),
      insertBooking: jest.fn(async (conn, payload) => {
        const r = rounds.find((x) => x.SCHED_ID === Number(payload.schedId));
        const bookingId = nextBookingId;
        nextBookingId += 1;
        r.bookings.push({
          BOOKING_ID: bookingId,
          CUST_ID: payload.custId,
          SEATS: payload.seats,
          STATUS: 'reserved',
          BOOKING_CODE: `BK${bookingId}`,
          QR_TOKEN: payload.qrToken,
          BOOK_TIME: new Date(),
          CANCEL_TIME: null,
          BOARD_STOP_ID: payload.boardStopId,
          ALIGHT_STOP_ID: payload.alightStopId,
        });
        return bookingId;
      }),
      findDetails: jest.fn(async (bookingId) => {
        for (const r of rounds) {
          const b = r.bookings.find((x) => x.BOOKING_ID === Number(bookingId));
          if (!b) continue;
          return {
            BOOKING_ID: b.BOOKING_ID,
            BOOKING_CODE: b.BOOKING_CODE,
            CUST_ID: b.CUST_ID,
            SCHED_ID: r.SCHED_ID,
            BOARD_STOP_ID: b.BOARD_STOP_ID,
            BOARD_STOP_NAME: stopName(b.BOARD_STOP_ID),
            ALIGHT_STOP_ID: b.ALIGHT_STOP_ID,
            ALIGHT_STOP_NAME: stopName(b.ALIGHT_STOP_ID),
            SEATS: b.SEATS,
            STATUS: b.STATUS,
            BOOK_TIME: b.BOOK_TIME,
            CANCEL_TIME: b.CANCEL_TIME,
            QR_TOKEN: b.QR_TOKEN,
            DEPART_AT: r.DEPART_AT,
          };
        }
        return null;
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
    permissions: ['BK.VIEW', 'BK.CREATE', 'ROUTE.VIEW', 'EMP.VIEW'],
    menus: [{ SCREEN_KEY: 'BOOKING_NEW', MENU_LABEL: 'จองรถ', SORT_NO: 30 }],
  });
  addEmployee({
    empId: 2,
    username: 'viewer',
    empCode: 'EMP002',
    firstName: 'วิว',
    lastName: 'ผู้ชม',
    passwordHash: bcrypt.hashSync(VIEWER_PASS, 4),
    roles: ['STAFF'],
    permissions: ['BK.VIEW'],
    menus: [],
  });
  addEmployee({
    empId: 3,
    username: 'outsider',
    empCode: 'EMP003',
    firstName: 'นอก',
    lastName: 'กลุ่ม',
    passwordHash: bcrypt.hashSync(OUTSIDER_PASS, 4),
    roles: ['STAFF'],
    permissions: ['ROUTE.VIEW'],
    menus: [],
  });
  addEmployee({
    empId: 7,
    username: 'mai',
    empCode: 'EMP007',
    firstName: 'มานี',
    lastName: 'รักดี',
    passwordHash: bcrypt.hashSync(CUSTOMER_PASS, 4),
    roles: ['CUSTOMER'],
    permissions: ['BK.VIEW', 'BK.CREATE'],
    menus: [{ SCREEN_KEY: 'BOOKING_NEW', MENU_LABEL: 'จองรถ', SORT_NO: 30 }],
  });

  return {
    repos,
    state: { profiles, credentials, permissions, menus, roles, revoked, rounds, DATE, OTHER_DATE, EMPTY_DATE, addEmployee },
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
    withTransaction: jest.fn(dbMock.createTransactionRunner(() => fakePool)),
  };
  const auditSink = jest.fn();
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

async function tokenFor(app, username = 'admin', password = ADMIN_PASS) {
  const res = await request(app).post('/api/v1/auth/login').send({ username, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.access_token;
}

beforeEach(() => {
  resetLoginAttempts();
});

// ================================================== T-034 GET /booking/available (UC-17)
describe('T-034 GET /api/v1/booking/available (UC-17, BR-05/07/11/12)', () => {
  let world;
  let app;
  let token;

  beforeEach(async () => {
    world = createWorld();
    ({ app } = setup(world));
    token = await tokenFor(app, 'mai', CUSTOMER_PASS);
  });

  const url = (extra = {}) => {
    const q = new URLSearchParams({ board_stop: '1', alight_stop: '4', date: world.state.DATE, ...extra });
    return `/api/v1/booking/available?${q.toString()}`;
  };

  test('401: ไม่มี token → UNAUTHORIZED (ต้อง Login ก่อนจอง — B1 ข้อ 1)', async () => {
    const res = await request(app).get(url());
    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('403: ไม่มี BK.VIEW (outsider) → FORBIDDEN', async () => {
    const outsiderToken = await tokenFor(app, 'outsider', OUTSIDER_PASS);
    const res = await request(app).get(url()).set(authHeader(outsiderToken));
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: 'FORBIDDEN', message: GUARD_MSG });
  });

  test('400: ขาดพารามิเตอร์ / รูปแบบผิด / วันไม่มีจริง (2026-02-30) → VALIDATION_ERROR', async () => {
    const missing = await request(app)
      .get('/api/v1/booking/available?alight_stop=4&date=2026-10-02')
      .set(authHeader(token));
    expect(missing.status).toBe(400);
    expect(missing.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: VALIDATION_TOP });
    expect(missing.body.error.details).toEqual([{ field: 'board_stop', message: 'is required' }]);

    const badDate = await request(app).get(url({ date: '2026-13-40' })).set(authHeader(token));
    expect(badDate.status).toBe(400);
    expect(badDate.body.error.details).toEqual([{ field: 'date', message: 'must be a date (YYYY-MM-DD)' }]);

    const fakeDate = await request(app).get(url({ date: '2026-02-30' })).set(authHeader(token));
    expect(fakeDate.status).toBe(400);
    expect(fakeDate.body.error.details).toEqual([{ field: 'date', message: 'must be a date (YYYY-MM-DD)' }]);

    const badStop = await request(app).get(url({ board_stop: 'abc' })).set(authHeader(token));
    expect(badStop.status).toBe(400);
    expect(badStop.body.error.details).toEqual([{ field: 'board_stop', message: 'must be a positive integer' }]);
  });

  test('400 BR-11: ทุกคู่จุดขึ้น-ลง ในวันนั้นกลับด้าน → STOP_ORDER_INVALID (UC-17 3a)', async () => {
    world.repos.booking.findStopPairSeqs.mockResolvedValueOnce([{ BOARD_SEQ: 3, ALIGHT_SEQ: 1 }]);
    const res = await request(app).get(url()).set(authHeader(token));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'STOP_ORDER_INVALID', message: STOP_ORDER_MSG });
    expect(world.repos.booking.findAvailable).not.toHaveBeenCalled();
  });

  test('200: รูป AvailableSchedule ครบตาม openapi · ไม่มี meta · BR-05/BR-07/BR-11/BR-12 กรองแล้ว', async () => {
    const res = await request(app).get(url()).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.meta).toBeUndefined();
    // รอบ 20 เท่านั้นที่ผ่าน · 21 = BR-05 · 22 = BR-07 · 23 = inactive · 25 = BR-11
    expect(res.body.data.map((r) => r.sched_id)).toEqual([20]);
    const item = res.body.data[0];
    expect(item.route_id).toBe(2);
    expect(item.route_name).toBe('เส้นทางที่ 2');
    expect(item.service_date).toBe(world.state.DATE);
    expect(typeof item.depart_at).toBe('string');
    expect(item.board_stop).toEqual({ stop_id: 1, stop_name: 'มหาวิทยาลัยเทคโนโลยีมหานคร', stop_seq: 1 });
    expect(item.alight_stop).toEqual({ stop_id: 4, stop_name: 'ร้านส้มตำปูนาง', stop_seq: 3 });
    expect(typeof item.board_arrive_at).toBe('string');
    expect(Number.isInteger(item.minutes_until_board)).toBe(true);
    expect(item.minutes_until_board).toBeGreaterThanOrEqual(48);
    expect(item.minutes_until_board).toBeLessThanOrEqual(50);
    expect(item.seats_total).toBe(9);
    expect(item.seats_reserved).toBe(3); // reserved 2 + 1 (cancelled/check_in ไม่นับ)
    expect(item.seats_available).toBe(6);
    expect(item.plate_no).toBe('สย 2591');
  });

  test('BR-05: รอบที่ถึงจุดขึ้นใน 15 นาที (รอบ 21) ไม่ถูกแสดง', async () => {
    const res = await request(app).get(url()).set(authHeader(token));
    expect(res.body.data.map((r) => r.sched_id)).not.toContain(21);
  });

  test('BR-07: รอบเต็ม (รอบ 22 · capacity 4 / reserved 4) ไม่ถูกแสดง', async () => {
    const res = await request(app).get(url()).set(authHeader(token));
    expect(res.body.data.map((r) => r.sched_id)).not.toContain(22);
  });

  test('BR-11: รอบที่จุดลงอยู่ก่อนจุดขึ้น (รอบ 25) ไม่ถูกแสดง — คู่อื่นถูก → ไม่ยิง 400', async () => {
    const res = await request(app).get(url()).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.sched_id)).not.toContain(25);
  });

  test('BR-12: จุดจอดไม่อยู่ในเส้นทางใด / วันที่ไม่มีรอบ → 200 data: [] (UC-17 5a)', async () => {
    const noStop = await request(app).get(url({ board_stop: '99' })).set(authHeader(token));
    expect(noStop.status).toBe(200);
    expect(noStop.body.data).toEqual([]);

    const emptyDate = await request(app).get(url({ date: world.state.EMPTY_DATE })).set(authHeader(token));
    expect(emptyDate.status).toBe(200);
    expect(emptyDate.body.data).toEqual([]);
  });

  test('defense in depth: SQL คืนแถวเลยเวลา BR-05 → service ตัดทิ้ง', async () => {
    world.repos.booking.findAvailable.mockResolvedValueOnce([
      {
        SCHED_ID: 91,
        ROUTE_ID: 2,
        ROUTE_NAME: 'เส้นทางที่ 2',
        SERVICE_DATE: world.state.DATE,
        DEPART_AT: new Date(Date.now() + 10 * 60000),
        BOARD_STOP_ID: 1,
        BOARD_SEQ: 1,
        BOARD_STOP_NAME: 'มหาวิทยาลัยเทคโนโลยีมหานคร',
        ALIGHT_STOP_ID: 4,
        ALIGHT_SEQ: 3,
        ALIGHT_STOP_NAME: 'ร้านส้มตำปูนาง',
        BOARD_ARRIVE_AT: new Date(Date.now() + 19 * 60000), // เหลือ 19 นาที (< BR-05)
        SEATS_TOTAL: 9,
        SEATS_RESERVED: 0,
        PLATE_NO: 'สย 2591',
      },
    ]);
    const res = await request(app).get(url()).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('defense in depth: seats_available <= 0 (เต็ม/จองเกิน) → service ตัดทิ้ง', async () => {
    const base = {
      ROUTE_ID: 2,
      ROUTE_NAME: 'เส้นทางที่ 2',
      SERVICE_DATE: world.state.DATE,
      DEPART_AT: new Date(Date.now() + 60 * 60000),
      BOARD_STOP_ID: 1,
      BOARD_SEQ: 1,
      BOARD_STOP_NAME: 'มหาวิทยาลัยเทคโนโลยีมหานคร',
      ALIGHT_STOP_ID: 4,
      ALIGHT_SEQ: 3,
      ALIGHT_STOP_NAME: 'ร้านส้มตำปูนาง',
      BOARD_ARRIVE_AT: new Date(Date.now() + 65 * 60000),
      PLATE_NO: 'สย 2591',
    };
    world.repos.booking.findAvailable.mockResolvedValueOnce([
      { ...base, SCHED_ID: 92, SEATS_TOTAL: 9, SEATS_RESERVED: 9 }, // เต็มพอดี
      { ...base, SCHED_ID: 93, SEATS_TOTAL: 9, SEATS_RESERVED: 10 }, // จองเกิน (over-sell เดิม)
    ]);
    const res = await request(app).get(url()).set(authHeader(token));
    expect(res.body.data).toEqual([]);
  });

  test('defense in depth: แถว BR-11 กลับด้านที่หลุดมาจาก SQL → service ตัดทิ้ง (ไม่แตะแถวถูก)', async () => {
    world.repos.booking.findStopPairSeqs.mockResolvedValueOnce([{ BOARD_SEQ: 1, ALIGHT_SEQ: 3 }]);
    const good = {
      SCHED_ID: 94,
      ROUTE_ID: 2,
      ROUTE_NAME: 'เส้นทางที่ 2',
      SERVICE_DATE: world.state.DATE,
      DEPART_AT: new Date(Date.now() + 60 * 60000),
      BOARD_STOP_ID: 1,
      BOARD_SEQ: 1,
      BOARD_STOP_NAME: 'มหาวิทยาลัยเทคโนโลยีมหานคร',
      ALIGHT_STOP_ID: 4,
      ALIGHT_SEQ: 3,
      ALIGHT_STOP_NAME: 'ร้านส้มตำปูนาง',
      BOARD_ARRIVE_AT: new Date(Date.now() + 65 * 60000),
      SEATS_TOTAL: 9,
      SEATS_RESERVED: 1,
      PLATE_NO: 'สย 2591',
    };
    world.repos.booking.findAvailable.mockResolvedValueOnce([good, { ...good, SCHED_ID: 95, BOARD_SEQ: 3, ALIGHT_SEQ: 1 }]);
    const res = await request(app).get(url()).set(authHeader(token));
    expect(res.body.data.map((r) => r.sched_id)).toEqual([94]);
  });
});

// =============================================== T-035/036/037 POST /booking (UC-18)
describe('T-035/T-036/T-037 POST /api/v1/booking (UC-18, BR-05/06/07 + FOR UPDATE NOWAIT + QR)', () => {
  let world;
  let app;
  let conn;
  let db;
  let token;

  beforeEach(async () => {
    world = createWorld();
    ({ app, conn, db } = setup(world));
    token = await tokenFor(app, 'mai', CUSTOMER_PASS);
  });

  const book = (body, useToken) =>
    request(app).post('/api/v1/booking').set(authHeader(useToken || token)).send(body);

  test('401: ไม่มี token → UNAUTHORIZED', async () => {
    const res = await request(app).post('/api/v1/booking').send({ sched_id: 20 });
    expect(res.status).toBe(401);
  });

  test('403: มี BK.VIEW อย่างเดียว (viewer) ไม่มี BK.CREATE → 403', async () => {
    const viewerToken = await tokenFor(app, 'viewer', VIEWER_PASS);
    const res = await book({ sched_id: 20, board_stop_id: 1, alight_stop_id: 4, seats: 1 }, viewerToken);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: 'FORBIDDEN', message: GUARD_MSG });
    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  test('400: validate — ขาด field / seats ไม่ใช่ integer', async () => {
    const missing = await book({ sched_id: 20, board_stop_id: 1, alight_stop_id: 4 });
    expect(missing.status).toBe(400);
    expect(missing.body.error.details).toEqual([{ field: 'seats', message: 'is required' }]);

    const badType = await book({ sched_id: 20, board_stop_id: 1, alight_stop_id: 4, seats: 'two' });
    expect(badType.status).toBe(400);
    expect(badType.body.error.details[0].field).toBe('seats');
  });

  test('400 BR-06: seats นอกช่วง 1-4 → ตามตัวอย่าง openapi BadRequest (ไม่เข้า transaction)', async () => {
    for (const seats of [0, 5, -1]) {
      const res = await book({ sched_id: 20, board_stop_id: 1, alight_stop_id: 4, seats });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: VALIDATION_TOP });
      expect(res.body.error.details).toEqual([{ field: 'seats', message: 'ต้องมีค่าระหว่าง 1 ถึง 4 (BR-06)' }]);
    }
    expect(db.withTransaction).not.toHaveBeenCalled();
    expect(world.repos.booking.insertBooking).not.toHaveBeenCalled();
  });

  test('404: รอบไม่มีจริง / รอบถูกปิดใช้งาน → NOT_FOUND (ไม่เข้า transaction)', async () => {
    const missing = await book({ sched_id: 999, board_stop_id: 1, alight_stop_id: 4, seats: 1 });
    expect(missing.status).toBe(404);
    expect(missing.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'ไม่พบข้อมูลที่ต้องการ' });

    const inactive = await book({ sched_id: 23, board_stop_id: 1, alight_stop_id: 4, seats: 1 });
    expect(inactive.status).toBe(404);
    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  test('422 BR-12: จุดขึ้น/ลง ไม่อยู่ในเส้นทางของรอบนี้ → STOP_NOT_IN_ROUTE', async () => {
    const res = await book({ sched_id: 20, board_stop_id: 99, alight_stop_id: 4, seats: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: 'STOP_NOT_IN_ROUTE', message: STOP_NOT_IN_ROUTE_MSG });
    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  test('422 BR-11: จุดลงอยู่ก่อนจุดขึ้น → STOP_ORDER_INVALID', async () => {
    const res = await book({ sched_id: 25, board_stop_id: 1, alight_stop_id: 4, seats: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: 'STOP_ORDER_INVALID', message: STOP_ORDER_MSG });
    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  test('400 BR-05 ใน tx: เหลือเวลาไม่ถึง 20 นาที → LEAD_TIME_REQUIRED + rollback', async () => {
    const res = await book({ sched_id: 26, board_stop_id: 1, alight_stop_id: 4, seats: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'LEAD_TIME_REQUIRED', message: LEAD_MSG });
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(world.repos.booking.insertBooking).not.toHaveBeenCalled();
  });

  test('409 BR-07: ที่นั่งไม่พอ → SEAT_FULL พร้อมจำนวนที่เหลือ (ตามตัวอย่าง openapi) + rollback', async () => {
    const res = await book({ sched_id: 27, board_stop_id: 1, alight_stop_id: 4, seats: 2 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'SEAT_FULL', message: SEAT_FULL_MSG });
    expect(res.body.error.details).toEqual([{ field: 'seats', message: 'เหลือที่นั่งว่าง 1 ที่นั่ง' }]);
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(world.repos.booking.insertBooking).not.toHaveBeenCalled();
  });

  test('409 NOWAIT: ล็อกแถว schedule ไม่ได้ (ORA-00054) → SCHEDULE_LOCKED ไม่ค้าง + rollback', async () => {
    world.repos.booking.lockSchedule.mockImplementationOnce(async () => {
      const err = new Error('ORA-00054: resource busy');
      err.errorNum = 54;
      throw err;
    });
    const res = await book({ sched_id: 20, board_stop_id: 1, alight_stop_id: 4, seats: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'SCHEDULE_LOCKED' });
    expect(res.body.error.message).toContain('กรุณาลองอีกครั้ง');
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(world.repos.booking.insertBooking).not.toHaveBeenCalled();
  });

  test('201: จองสำเร็จ — รูป Booking + qr_token สุ่ม + qr_image PNG + commit + cust_id จาก JWT', async () => {
    const res = await book({ sched_id: 20, board_stop_id: 1, alight_stop_id: 4, seats: 2, cust_id: 99 });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('จองสำเร็จ');
    const d = res.body.data;
    expect(d).toMatchObject({
      booking_code: expect.stringMatching(/^BK\d+$/),
      cust_id: 7, // จาก token ไม่ใช่ body (กันจองแทนคนอื่น)
      sched_id: 20,
      board_stop_id: 1,
      board_stop_name: 'มหาวิทยาลัยเทคโนโลยีมหานคร',
      alight_stop_id: 4,
      alight_stop_name: 'ร้านส้มตำปูนาง',
      seats: 2,
      status: 'reserved',
      cancel_time: null,
    });
    expect(typeof d.booking_id).toBe('number');
    expect(Number.isNaN(Date.parse(d.book_time))).toBe(false);
    expect(d.qr_token).toMatch(/^[0-9a-f]{32}$/);
    expect(isPngBase64(d.qr_image)).toBe(true);

    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    const [insertConn, payload] = world.repos.booking.insertBooking.mock.calls[0];
    expect(insertConn).toBe(conn);
    expect(payload).toMatchObject({ custId: 7, schedId: 20, boardStopId: 1, alightStopId: 4, seats: 2 });
    expect(payload.qrToken).toBe(d.qr_token);
  });

  test('BR-07 accounting: จองทีละรอบเห็นผลทันที — เหลือ 6 จอง 4 แล้ว เหลือ 2 → รอบสองถูกปฏิเสธ', async () => {
    const first = await book({ sched_id: 20, board_stop_id: 1, alight_stop_id: 4, seats: 4 });
    expect(first.status).toBe(201);

    const second = await book({ sched_id: 20, board_stop_id: 1, alight_stop_id: 4, seats: 3 });
    expect(second.status).toBe(409);
    expect(second.body.error.details).toEqual([{ field: 'seats', message: 'เหลือที่นั่งว่าง 2 ที่นั่ง' }]);
    expect(world.repos.booking.insertBooking).toHaveBeenCalledTimes(1);
  });

  test('จอง 2 ครั้ง → qr_token ต่างกันทั้งคู่ (สุ่มจริง · uq_booking_qr กันซ้ำ)', async () => {
    const first = await book({ sched_id: 20, board_stop_id: 1, alight_stop_id: 4, seats: 1 });
    const second = await book({ sched_id: 20, board_stop_id: 1, alight_stop_id: 4, seats: 1 });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.qr_token).not.toBe(second.body.data.qr_token);
    expect(first.body.data.booking_code).not.toBe(second.body.data.booking_code);
  });

  test('oversell พร้อมกัน: 2 request ชนกัน → คนที่สองโดน NOWAIT 409 · INSERT ครั้งเดียว', async () => {
    let lockCalls = 0;
    world.repos.booking.lockSchedule.mockImplementation(async (connArg, schedId) => {
      lockCalls += 1;
      if (lockCalls === 2) {
        const err = new Error('ORA-00054: resource busy');
        err.errorNum = 54;
        throw err;
      }
      return { SCHED_ID: Number(schedId) };
    });

    const [a, b] = await Promise.all([
      book({ sched_id: 20, board_stop_id: 1, alight_stop_id: 4, seats: 2 }),
      book({ sched_id: 20, board_stop_id: 1, alight_stop_id: 4, seats: 2 }),
    ]);
    const statuses = [a.status, b.status].sort((x, y) => x - y);
    expect(statuses).toEqual([201, 409]);
    expect(world.repos.booking.insertBooking).toHaveBeenCalledTimes(1);

    // หลังจอง 1 ครั้ง reserved = 3 + 2 = 5 → BR-07 เห็นผล
    const check = await request(app)
      .get(`/api/v1/booking/available?board_stop=1&alight_stop=4&date=${world.state.DATE}`)
      .set(authHeader(token));
    const item = check.body.data.find((r) => r.sched_id === 20);
    expect(item.seats_reserved).toBe(5);
    expect(item.seats_available).toBe(4);
  });

  test('INSERT ล้มเหลว → 500 ไม่ leak ข้อความจริง + rollback ไม่ commit', async () => {
    world.repos.booking.insertBooking.mockImplementationOnce(async () => {
      throw new Error('ORA-00001: unique constraint (APP.UQ_BOOKING_CODE) violated');
    });
    const res = await book({ sched_id: 20, board_stop_id: 1, alight_stop_id: 4, seats: 1 });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง',
    });
    expect(JSON.stringify(res.body)).not.toContain('ORA-');
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
  });
});

// =================================================== T-037 GET /booking/{id}/qr (UC-20)
describe('T-037 GET /api/v1/booking/{id}/qr (UC-20 · ownership · cancelled)', () => {
  let world;
  let app;
  let token;

  beforeEach(async () => {
    world = createWorld();
    ({ app } = setup(world));
    token = await tokenFor(app, 'mai', CUSTOMER_PASS);
  });

  test('401: ไม่มี token → UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/v1/booking/4/qr');
    expect(res.status).toBe(401);
  });

  test('403 guard: ไม่มี BK.VIEW (outsider) → ข้อความ guard · 403 ownership: ของคนอื่น → ข้อความสิทธิ์ QR', async () => {
    const outsiderToken = await tokenFor(app, 'outsider', OUTSIDER_PASS);
    const guard = await request(app).get('/api/v1/booking/4/qr').set(authHeader(outsiderToken));
    expect(guard.status).toBe(403);
    expect(guard.body.error.message).toBe(GUARD_MSG);

    const foreign = await request(app).get('/api/v1/booking/1/qr').set(authHeader(token)); // booking 1 = cust 99
    expect(foreign.status).toBe(403);
    expect(foreign.body.error).toMatchObject({ code: 'FORBIDDEN', message: FOREIGN_QR_MSG });
  });

  test('404: ไม่มีการจอง / id ไม่ใช่ตัวเลข → NOT_FOUND', async () => {
    const missing = await request(app).get('/api/v1/booking/999/qr').set(authHeader(token));
    expect(missing.status).toBe(404);
    expect(missing.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'ไม่พบข้อมูลที่ต้องการ' });

    const badId = await request(app).get('/api/v1/booking/abc/qr').set(authHeader(token));
    expect(badId.status).toBe(404);
  });

  test('404 UC-20 A2: status = cancelled → ไม่มี QR ที่ใช้ได้', async () => {
    const res = await request(app).get('/api/v1/booking/2/qr').set(authHeader(token));
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND' });
  });

  test('200: BookingQr ครบ (qr_token + qr_image PNG + ชื่อจุดจอด + เวลาออกรอบ)', async () => {
    const r20 = world.state.rounds.find((r) => r.SCHED_ID === 20);
    const res = await request(app).get('/api/v1/booking/4/qr').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      booking_id: 4,
      booking_code: 'BK4',
      qr_token: '0123456789abcdef0123456789abcdef',
      qr_image: expect.any(String),
      status: 'reserved',
      seats: 1,
      board_stop_name: 'มหาวิทยาลัยเทคโนโลยีมหานคร',
      alight_stop_name: 'ร้านส้มตำปูนาง',
      depart_at: r20.DEPART_AT.toISOString(),
    });
    expect(isPngBase64(res.body.data.qr_image)).toBe(true);
  });

  test('200 UC-20 A2b: status = checked_in → คืน status ให้แอปแสดง "เช็คอินแล้ว"', async () => {
    const res = await request(app).get('/api/v1/booking/3/qr').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('checked_in');
    expect(res.body.data.qr_token).toBe('c'.repeat(32));
    expect(isPngBase64(res.body.data.qr_image)).toBe(true);
  });
});

// ============================================ T-034…T-037 สิทธิ์ + wiring (ไม่เดา endpoint ที่สเปกไม่ประกาศ)
describe('T-034…T-037 สิทธิ์ BK.VIEW/BK.CREATE + wiring', () => {
  let world;
  let app;
  let token;
  let maiToken;

  beforeEach(async () => {
    world = createWorld();
    ({ app } = setup(world));
    token = await tokenFor(app);
    maiToken = await tokenFor(app, 'mai', CUSTOMER_PASS);
  });

  const ALL_ENDPOINTS = [
    ['get', `/api/v1/booking/available?board_stop=1&alight_stop=4&date=${world ? '' : ''}`],
    ['post', '/api/v1/booking'],
    ['get', '/api/v1/booking/4/qr'],
  ];

  test('ไม่มี token → 401 ทั้ง 3 endpoint', async () => {
    for (const [method, path] of ALL_ENDPOINTS) {
      const res = await request(app)[method](path).send({});
      expect({ path, status: res.status }).toEqual({ path, status: 401 });
    }
  });

  test('ถอด BK.VIEW/BK.CREATE ระหว่าง session → 403 ทันที (โหลดสิทธิ์จาก DB ทุก request)', async () => {
    const before = await request(app)
      .get(`/api/v1/booking/available?board_stop=1&alight_stop=4&date=${world.state.DATE}`)
      .set(authHeader(maiToken));
    expect(before.status).toBe(200);

    world.state.permissions.set(7, []);

    const afterRead = await request(app)
      .get(`/api/v1/booking/available?board_stop=1&alight_stop=4&date=${world.state.DATE}`)
      .set(authHeader(maiToken));
    expect(afterRead.status).toBe(403);
    expect(afterRead.body.error.message).toBe(GUARD_MSG);

    const afterWrite = await request(app)
      .post('/api/v1/booking')
      .set(authHeader(maiToken))
      .send({ sched_id: 20, board_stop_id: 1, alight_stop_id: 4, seats: 1 });
    expect(afterWrite.status).toBe(403);
  });

  test('wiring: booking.routes.js มี 5 operations · guard ครบ BK.VIEW/BK.CREATE/BK.CANCEL (ขอบเขต sprint 9)', async () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/routes/booking.routes.js'), 'utf8');
    const operations = source.match(/router\.(get|post)\(/g) || [];
    expect(operations).toHaveLength(5);
    const guarded = source.match(/^\s+(viewGuard|createGuard|cancelGuard),\s*$/gm) || [];
    expect(guarded).toHaveLength(5);
    expect(source).toContain("requirePermission('BK.VIEW')");
    expect(source).toContain("requirePermission('BK.CREATE')");
    expect(source).toContain("requirePermission('BK.CANCEL')");
  });

  test('/booking/me · /booking/{id}/cancel ลงทะเบียนแล้ว (T-038/T-039 sprint 9) — ขาด token → 401 ไม่ใช่ 404', async () => {
    const me = await request(app).get('/api/v1/booking/me');
    expect(me.status).toBe(401);
    const cancel = await request(app).post('/api/v1/booking/4/cancel').send({});
    expect(cancel.status).toBe(401);
  });
});

// ============================================ repository SQL (bind ไม่ interpolation)
describe('repository SQL — bind variables, BR-05/07/11, FOR UPDATE NOWAIT, seq_booking_code', () => {
  let connStub;

  beforeEach(() => {
    dbMock.query.mockReset();
    connStub = {
      execute: jest.fn(async () => ({ rows: [], rowsAffected: 1, outBinds: { newId: [1] } })),
    };
  });

  test('findAvailable: BR-05 + BR-07 + BR-11/12 ใน query เดียว · bind ทั้งหมด · ไม่ SELECT *', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [] });
    const evilDate = "2026-10-02' OR 1=1--";
    await bookingRepo.findAvailable({ boardStopId: 1, alightStopId: 4, serviceDate: evilDate });
    const [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).not.toContain('SELECT *');
    expect(sql).toContain("bss.arrive_at - SYSTIMESTAMP >= INTERVAL '20' MINUTE"); // BR-05 จากจุดขึ้น
    expect(sql).toContain('ass.stop_seq > bss.stop_seq'); // BR-11
    expect(sql).toContain("TO_DATE(:serviceDate, 'YYYY-MM-DD')");
    expect(sql).toContain('NVL(SUM(bk.seats), 0)'); // BR-07
    expect(sql).toContain("bk.status = 'reserved'");
    expect(sql).toContain('ORDER BY s.depart_at, s.sched_id');
    expect(sql).not.toContain('OR 1=1');
    expect(binds).toEqual({ boardStop: 1, alightStop: 4, serviceDate: evilDate });
  });

  test('findStopPairSeqs/findBookingContext: bind · context ใช้ LEFT JOIN (แยก 404 ออกจาก 422)', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [] });
    await bookingRepo.findStopPairSeqs({ boardStopId: 1, alightStopId: 4, serviceDate: '2026-10-02' });
    const [pairSql, pairBinds] = dbMock.query.mock.calls[0];
    expect(pairSql).not.toContain('SELECT *');
    expect(pairSql).toContain('JOIN schedule_stop bss');
    expect(pairSql).toContain("TO_DATE(:serviceDate, 'YYYY-MM-DD')");
    expect(pairBinds).toEqual({ boardStop: 1, alightStop: 4, serviceDate: '2026-10-02' });

    dbMock.query.mockReset();
    dbMock.query.mockResolvedValueOnce({ rows: [] });
    await bookingRepo.findBookingContext({ schedId: 20, boardStopId: "' OR 1=1--", alightStopId: 4 });
    const [ctxSql, ctxBinds] = dbMock.query.mock.calls[0];
    expect(ctxSql).toContain('LEFT JOIN schedule_stop bss');
    expect(ctxSql).toContain('LEFT JOIN schedule_stop ass');
    expect(ctxSql).toContain('WHERE s.sched_id = :schedId');
    expect(ctxSql).not.toContain('OR 1=1');
    expect(ctxBinds).toEqual({ schedId: 20, boardStop: "' OR 1=1--", alightStop: 4 });
  });

  test('lockSchedule: FOR UPDATE NOWAIT เฉพาะแถว schedule (ไม่ใช่ aggregate — ไม่มี SUM/COUNT)', async () => {
    await bookingRepo.lockSchedule(connStub, 20);
    const [sql, binds] = connStub.execute.mock.calls[0];
    expect(sql).toContain('FROM schedule');
    expect(sql).toContain('FOR UPDATE NOWAIT');
    expect(sql).not.toContain('SUM');
    expect(sql).not.toContain('COUNT');
    expect(binds).toEqual({ schedId: 20 });
  });

  test('seatSummary: NVL(SUM) เฉพาะ status=reserved · ห้าม FOR UPDATE บน aggregate (ORA-02014)', async () => {
    await bookingRepo.seatSummary(connStub, 20);
    const [sql, binds] = connStub.execute.mock.calls[0];
    expect(sql).toContain('NVL(vt.capacity, 0)');
    expect(sql).toContain('NVL(SUM(b.seats), 0)');
    expect(sql).toContain("b.status = 'reserved'");
    expect(sql).not.toContain('FOR UPDATE');
    expect(binds).toEqual({ schedId: 20 });
  });

  test("insertBooking: 'BK' || seq_booking_code.NEXTVAL · qr_token อยู่ใน bind · RETURNING id", async () => {
    await bookingRepo.insertBooking(connStub, {
      custId: 7,
      schedId: 20,
      boardStopId: 1,
      alightStopId: 4,
      seats: 2,
      qrToken: 'deadbeef'.repeat(4),
    });
    const [sql, binds] = connStub.execute.mock.calls[0];
    expect(sql).toContain('INSERT INTO booking');
    expect(sql).toContain("'BK' || seq_booking_code.NEXTVAL");
    expect(sql).toContain('RETURNING booking_id INTO :newId');
    expect(sql).not.toContain('deadbeef');
    expect(Object.keys(binds)).toEqual(['custId', 'schedId', 'boardStopId', 'alightStopId', 'seats', 'qrToken', 'newId']);
    expect(binds.qrToken).toBe('deadbeef'.repeat(4));
  });

  test('findDetails: join stop/schedule/route · bind เท่านั้น · ไม่ SELECT *', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [] });
    await bookingRepo.findDetails(4);
    const [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).not.toContain('SELECT *');
    expect(sql).toContain('JOIN stop bs');
    expect(sql).toContain('JOIN schedule s');
    expect(sql).toContain('WHERE b.booking_id = :bookingId');
    expect(binds).toEqual({ bookingId: 4 });
  });
});
