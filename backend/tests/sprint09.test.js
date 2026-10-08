// backend/tests/sprint09.test.js — Sprint 9 (T-036 / T-038 / T-039 / T-042) regression tests
// ครอบคลุม: GET /booking/me (UC-19 · StatusParam · cust_id จาก JWT · PaginationMeta), POST /booking/{id}/cancel
//           (UC-21 · BR-08 คืนที่นั่ง · 404/403/409/422 · ASM-07-2 20 นาที), BR-06 Service + CHECK CONSTRAINT
//           (ORA-02290 → 400 · ck_booking_seats), T-042 audit_log (schema + insert + redaction + write-only)
//           สิทธิ์ BK.VIEW / BK.CANCEL (โหลดจาก DB ทุก request) · repository SQL แบบ bind variables
// สถาปัตยกรรม: inject fake repos + fake connection เข้า createApp (ไม่แตะ Oracle จริง) — แบบ sprint08
//               transaction runner / SQL ของ repository เป็นโค้ดจริงที่ assert ผ่าน spy
// หมายเหตุ: 2 test ใน sprint08 (wiring 3→5 ops · /me+/cancel 404→401) ถูกขยายตามขอบเขตนี้ ไม่ใช่การอ่อนข้อ

process.env.JWT_SECRET = 'sprint09-test-secret-0123456789abcdef0123456789abcdef';
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
const { redactPath } = require('../src/middleware/audit');
const bookingRepo = require('../src/repositories/booking.repository');
const { createAuditRepository } = require('../src/repositories/audit.repository');

const ADMIN_PASS = 'AdminPass123';
const VIEWER_PASS = 'ViewerPass123';
const CUSTOMER_PASS = 'CustomerPass123';
const OUTSIDER_PASS = 'OutsiderPass123';

const GUARD_MSG = 'ไม่มีสิทธิ์เข้าถึงส่วนนี้';
const VALIDATION_TOP = 'ข้อมูลที่ส่งมาไม่ถูกต้อง';
const FOREIGN_CANCEL_MSG = 'ยกเลิกได้เฉพาะรายการของตัวเองเท่านั้น';
const ALREADY_CANCELLED_MSG = 'การจองนี้ถูกยกเลิกไปแล้ว';
const CANCEL_TOO_LATE_MSG = 'เลยกำหนดเวลายกเลิกแล้ว';
const CANCEL_SUCCESS_MSG = 'ยกเลิกการจองสำเร็จ ที่นั่งถูกคืนเข้ารอบแล้ว';
const CHECKED_IN_MSG = 'การจองนี้เช็คอินไปแล้ว จึงยกเลิกไม่ได้';
const COMPLETED_MSG = 'การจองนี้เดินทางเสร็จแล้ว จึงยกเลิกไม่ได้';
const NOT_FOUND_MSG = 'ไม่พบข้อมูลที่ต้องการ';
const BR06_DETAILS = 'ต้องมีค่าระหว่าง 1 ถึง 4 (BR-06)';
const SCHEMA_PATH = path.join(__dirname, '..', '..', 'database', '01_schema.sql');

async function waitFor(check, timeoutMs = 500) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return check();
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

  const DATE = at(45).toISOString().slice(0, 10);
  const OTHER_DATE = '2027-01-01';
  const EMPTY_DATE = '2027-06-01';

  const stopName = (id) =>
    ({ 1: 'มหาวิทยาลัยเทคโนโลยีมหานคร', 2: 'โลตัสหนองจอก', 4: 'ร้านส้มตำปูนาง' })[id] || null;
  const custName = (id) => ({ 1: 'ระบบ ผู้ดูแลระบบ', 7: 'มานี รักดี', 99: 'คนอื่น ใจดี' })[id] || null;

  function mkStops(list) {
    return list.map(([stopId, seq, arriveAt]) => ({ STOP_ID: stopId, STOP_SEQ: seq, ARRIVE_AT: arriveAt, STOP_NAME: stopName(stopId) }));
  }

  // วัน DATE: 20 รอบหลัก (จอง 4 ของฉัน + 6 เสร็จแล้ว) · 21 ถึงใน 15 นาที (จอง 5 — CANCEL_TOO_LATE)
  //           22 เต็ม · 23 ปิดใช้ · 25 จุดลงก่อนจุดขึ้น · 28 วันในอดีต (จอง 7 — upcoming ต้องไม่เอา)
  // วัน OTHER_DATE: 26/27 (ของคนอื่น)
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
      DRIVER_NAME: 'สมชาย ขับรถ',
      stops: mkStops([
        [1, 1, at(50)],
        [2, 2, at(55)],
        [4, 3, at(60)],
      ]),
      bookings: [
        // 1 = ของคนอื่น (403) · 2 = ยกเลิกแล้ว (409 ซ้ำ) · 3 = เช็คอินแล้ว (422) · 4 = ของฉัน (ยกเลิกได้)
        // 6 = เสร็จแล้ว (422 · completed filter)
        { BOOKING_ID: 1, CUST_ID: 99, SEATS: 2, STATUS: 'reserved', BOOKING_CODE: 'BK1', QR_TOKEN: 'f'.repeat(32), BOOK_TIME: at(-30), CANCEL_TIME: null, BOARD_STOP_ID: 1, ALIGHT_STOP_ID: 4 },
        { BOOKING_ID: 2, CUST_ID: 7, SEATS: 1, STATUS: 'cancelled', BOOKING_CODE: 'BK2', QR_TOKEN: 'b'.repeat(32), BOOK_TIME: at(-30), CANCEL_TIME: at(-20), BOARD_STOP_ID: 1, ALIGHT_STOP_ID: 4 },
        { BOOKING_ID: 3, CUST_ID: 7, SEATS: 1, STATUS: 'checked_in', BOOKING_CODE: 'BK3', QR_TOKEN: 'c'.repeat(32), BOOK_TIME: at(-30), CANCEL_TIME: null, BOARD_STOP_ID: 1, ALIGHT_STOP_ID: 4 },
        { BOOKING_ID: 4, CUST_ID: 7, SEATS: 1, STATUS: 'reserved', BOOKING_CODE: 'BK4', QR_TOKEN: '0123456789abcdef0123456789abcdef', BOOK_TIME: at(-25), CANCEL_TIME: null, BOARD_STOP_ID: 1, ALIGHT_STOP_ID: 4 },
        { BOOKING_ID: 6, CUST_ID: 7, SEATS: 1, STATUS: 'completed', BOOKING_CODE: 'BK6', QR_TOKEN: '6'.repeat(32), BOOK_TIME: at(-40), CANCEL_TIME: null, BOARD_STOP_ID: 1, ALIGHT_STOP_ID: 4 },
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
      DRIVER_NAME: 'สมชาย ขับรถ',
      stops: mkStops([
        [1, 1, at(15)],
        [2, 2, at(16)],
        [4, 3, at(17)],
      ]),
      // 5 = ของฉัน แต่ถึงจุดขึ้นใน 15 นาที → CANCEL_TOO_LATE (ASM-07-2)
      bookings: [
        { BOOKING_ID: 5, CUST_ID: 7, SEATS: 2, STATUS: 'reserved', BOOKING_CODE: 'BK5', QR_TOKEN: '1'.repeat(32), BOOK_TIME: at(-10), CANCEL_TIME: null, BOARD_STOP_ID: 1, ALIGHT_STOP_ID: 4 },
      ],
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
      DRIVER_NAME: 'สมชาย ขับรถ',
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
      DRIVER_NAME: 'สมชาย ขับรถ',
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
      DRIVER_NAME: 'สมชาย ขับรถ',
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
      DRIVER_NAME: 'สมชาย ขับรถ',
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
      DRIVER_NAME: 'สมชาย ขับรถ',
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
    {
      // วันในอดีต — reserved ก็ไม่ใช่ "upcoming" อีกต่อไป (กรองด้วย service_date >= วันนี้)
      SCHED_ID: 28,
      ROUTE_ID: 2,
      ROUTE_NAME: 'เส้นทางที่ 2',
      SERVICE_DATE: '2020-01-01',
      DEPART_AT: new Date('2020-01-01T01:30:00Z'),
      IS_ACTIVE: 1,
      CAPACITY: 9,
      PLATE_NO: 'สย 2591',
      DRIVER_NAME: 'สมชาย ขับรถ',
      stops: mkStops([
        [1, 1, new Date('2020-01-01T01:35:00Z')],
        [2, 2, new Date('2020-01-01T01:40:00Z')],
        [4, 3, new Date('2020-01-01T01:45:00Z')],
      ]),
      bookings: [
        { BOOKING_ID: 7, CUST_ID: 7, SEATS: 1, STATUS: 'reserved', BOOKING_CODE: 'BK7', QR_TOKEN: '7'.repeat(32), BOOK_TIME: new Date('2020-01-01T01:00:00Z'), CANCEL_TIME: null, BOARD_STOP_ID: 1, ALIGHT_STOP_ID: 4 },
      ],
    },
  ];

  let nextBookingId = 100;

  function reservedSum(round) {
    return round.bookings
      .filter((b) => b.STATUS === 'reserved')
      .reduce((sum, b) => sum + b.SEATS, 0);
  }

  function mineRow(round, b) {
    return {
      BOOKING_ID: b.BOOKING_ID,
      BOOKING_CODE: b.BOOKING_CODE,
      CUST_ID: b.CUST_ID,
      CUST_NAME: custName(b.CUST_ID),
      SCHED_ID: round.SCHED_ID,
      BOARD_STOP_ID: b.BOARD_STOP_ID,
      BOARD_STOP_NAME: stopName(b.BOARD_STOP_ID),
      ALIGHT_STOP_ID: b.ALIGHT_STOP_ID,
      ALIGHT_STOP_NAME: stopName(b.ALIGHT_STOP_ID),
      SEATS: b.SEATS,
      STATUS: b.STATUS,
      BOOK_TIME: b.BOOK_TIME,
      CANCEL_TIME: b.CANCEL_TIME,
      SERVICE_DATE: round.SERVICE_DATE,
      DEPART_AT: round.DEPART_AT,
      ROUTE_NAME: round.ROUTE_NAME,
      PLATE_NO: round.PLATE_NO,
      DRIVER_NAME: round.DRIVER_NAME,
    };
  }

  // เลียนแบบ WHERE ของ listMine/countMine: upcoming = reserved + service_date >= วันนี้ (TRUNC(SYSDATE))
  function mineRows(custId, status) {
    const today = new Date().toISOString().slice(0, 10);
    const out = [];
    for (const r of rounds) {
      for (const b of r.bookings) {
        if (Number(b.CUST_ID) !== Number(custId)) continue;
        if (status === 'upcoming' && !(b.STATUS === 'reserved' && r.SERVICE_DATE >= today)) continue;
        if (status === 'completed' && b.STATUS !== 'completed') continue;
        if (status === 'cancelled' && b.STATUS !== 'cancelled') continue;
        out.push(mineRow(r, b));
      }
    }
    return out.sort((x, y) => x.DEPART_AT - y.DEPART_AT || x.BOOKING_ID - y.BOOKING_ID);
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
    // ---- fake booking repo: เลียนแบบ SQL semantics ของ booking.repository (BR-05/07/11/12 + UC-19/21) ----
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
          if (!b || !a || Number(b.STOP_SEQ) >= Number(a.STOP_SEQ)) continue;
          if (b.ARRIVE_AT.getTime() - Date.now() < 20 * 60000) continue;
          const reserved = reservedSum(r);
          if (r.CAPACITY - reserved <= 0) continue;
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
            ...mineRow(r, b),
            QR_TOKEN: b.QR_TOKEN,
          };
        }
        return null;
      }),
      // ---- UC-21: TX lock (blocking FOR UPDATE) + UPDATE status ----
      lockBooking: jest.fn(async (conn, bookingId) => {
        for (const r of rounds) {
          const b = r.bookings.find((x) => x.BOOKING_ID === Number(bookingId));
          if (!b) continue;
          const board = r.stops.find((s) => s.STOP_ID === b.BOARD_STOP_ID);
          return {
            BOOKING_ID: b.BOOKING_ID,
            CUST_ID: b.CUST_ID,
            STATUS: b.STATUS,
            SCHED_ID: r.SCHED_ID,
            SEATS: b.SEATS,
            BOARD_ARRIVE_AT: board ? board.ARRIVE_AT : null,
          };
        }
        return null;
      }),
      cancelBooking: jest.fn(async (conn, bookingId) => {
        for (const r of rounds) {
          const b = r.bookings.find((x) => x.BOOKING_ID === Number(bookingId));
          if (!b) continue;
          b.STATUS = 'cancelled';
          b.CANCEL_TIME = new Date();
        }
        return { rowsAffected: 1 };
      }),
      // ---- UC-19: cust_id มาจาก JWT · status 4 แบบ · offset/limit ตาม parsePagination ----
      listMine: jest.fn(async ({ custId, status, limit, offset }) =>
        mineRows(custId, status).slice(offset, offset + limit),
      ),
      countMine: jest.fn(async ({ custId, status }) => mineRows(custId, status).length),
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
    permissions: ['BK.VIEW', 'BK.CREATE', 'BK.CANCEL', 'ROUTE.VIEW', 'EMP.VIEW'],
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
    permissions: ['BK.VIEW', 'BK.CREATE', 'BK.CANCEL'],
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

function setup(world, overrides = {}) {
  const conn = makeConn();
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

async function tokenFor(app, username = 'admin', password = ADMIN_PASS) {
  const res = await request(app).post('/api/v1/auth/login').send({ username, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.access_token;
}

beforeEach(() => {
  resetLoginAttempts();
});

// ================================================== T-039 GET /booking/me (UC-19)
describe('T-039 GET /api/v1/booking/me (UC-19 · StatusParam · cust_id จาก JWT · meta)', () => {
  let world;
  let app;
  let token;

  beforeEach(async () => {
    world = createWorld();
    ({ app } = setup(world));
    token = await tokenFor(app, 'mai', CUSTOMER_PASS);
  });

  const ids = (body) => body.data.map((b) => b.booking_id);

  test('401: ไม่มี token → UNAUTHORIZED · 403: ไม่มี BK.VIEW (outsider) → FORBIDDEN', async () => {
    const noAuth = await request(app).get('/api/v1/booking/me');
    expect(noAuth.status).toBe(401);
    expect(noAuth.body.error).toMatchObject({ code: 'UNAUTHORIZED' });

    const outsiderToken = await tokenFor(app, 'outsider', OUTSIDER_PASS);
    const res = await request(app).get('/api/v1/booking/me').set(authHeader(outsiderToken));
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: 'FORBIDDEN', message: GUARD_MSG });
  });

  test('200 default = upcoming: ของฉันที่ยัง reserved + วันยังไม่ผ่าน เรียงตาม depart_at · meta ครบ', async () => {
    const res = await request(app).get('/api/v1/booking/me').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(ids(res.body)).toEqual([5, 4]); // รอบ 21 (10 นาที) ก่อนรอบ 20 (45 นาที) · จอง 7 (ปี 2020) ถูกกรอง
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 2, total_pages: 1 });
  });

  test('200 รูป item = openapi Booking: ครบ 14 ฟิลด์ + schedule object 5 ฟิลด์ (ไม่มี qr_token)', async () => {
    const res = await request(app).get('/api/v1/booking/me').set(authHeader(token));
    const item = res.body.data[0];
    expect(Object.keys(item).sort()).toEqual([
      'alight_stop_id',
      'alight_stop_name',
      'board_stop_id',
      'board_stop_name',
      'booking_code',
      'booking_id',
      'book_time',
      'cancel_time',
      'cust_id',
      'cust_name',
      'sched_id',
      'schedule',
      'seats',
      'status',
    ].sort());
    expect(item.cust_id).toBe(7);
    expect(item.cust_name).toBe('มานี รักดี');
    expect(item.status).toBe('reserved');
    expect(item.book_time).toEqual(expect.any(String));
    expect(item.cancel_time).toBeNull();
    expect(Object.keys(item.schedule).sort()).toEqual(
      ['depart_at', 'driver_name', 'plate_no', 'route_name', 'service_date'].sort(),
    );
    expect(item.schedule.route_name).toBe('เส้นทางที่ 2');
    expect(item.schedule.plate_no).toBe('สย 2592');
    expect(item.schedule.driver_name).toBe('สมชาย ขับรถ');
    expect(JSON.stringify(item)).not.toContain('qr_token');
  });

  test('status=completed → [6] · cancelled → [2] · all → ทุกสถานะรวมวันอดีต [7,5,2,3,4,6]', async () => {
    const completed = await request(app).get('/api/v1/booking/me?status=completed').set(authHeader(token));
    expect(ids(completed.body)).toEqual([6]);

    const cancelled = await request(app).get('/api/v1/booking/me?status=cancelled').set(authHeader(token));
    expect(ids(cancelled.body)).toEqual([2]);
    expect(cancelled.body.data[0].cancel_time).toEqual(expect.any(String));

    const all = await request(app).get('/api/v1/booking/me?status=all').set(authHeader(token));
    expect(ids(all.body)).toEqual([7, 5, 2, 3, 4, 6]);
    expect(all.body.meta.total).toBe(6);
  });

  test('status ผิด enum → 400 VALIDATION_ERROR details field=status (ตาม openapi enum)', async () => {
    const res = await request(app).get('/api/v1/booking/me?status=foo').set(authHeader(token));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: VALIDATION_TOP });
    expect(res.body.error.details).toEqual([
      { field: 'status', message: 'must be one of upcoming, completed, cancelled, all' },
    ]);
  });

  test('?cust_id=99 ถูกละเลย — cust_id มาจาก JWT เท่านั้น (openapi: ห้ามรับจาก query)', async () => {
    const res = await request(app).get('/api/v1/booking/me?cust_id=99').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.every((b) => b.cust_id === 7)).toBe(true);
    expect(ids(res.body)).toEqual([5, 4]);
  });

  test('admin (คนละคน) เห็นแต่ของตัวเอง — cust 1 ไม่มีรายการ → data: [] meta.total = 0', async () => {
    const adminToken = await tokenFor(app, 'admin', ADMIN_PASS);
    const res = await request(app).get('/api/v1/booking/me?status=all').set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 0, total_pages: 0 });
  });

  test('pagination: limit=1&page=2 → แถวที่สอง + meta · page/limit ผิดรูปถูก clamp (ไม่ตอบ 400)', async () => {
    const page2 = await request(app).get('/api/v1/booking/me?limit=1&page=2').set(authHeader(token));
    expect(page2.status).toBe(200);
    expect(ids(page2.body)).toEqual([4]);
    expect(page2.body.meta).toEqual({ page: 2, limit: 1, total: 2, total_pages: 2 });

    const clamped = await request(app).get('/api/v1/booking/me?page=0&limit=999').set(authHeader(token));
    expect(clamped.status).toBe(200);
    expect(clamped.body.meta).toEqual({ page: 1, limit: 100, total: 2, total_pages: 1 });
    expect(ids(clamped.body)).toEqual([5, 4]);
  });

  test('pagination: page เกินจริง → data: [] แต่ meta.total ยังถูกต้อง (ไม่ 400/404)', async () => {
    const res = await request(app).get('/api/v1/booking/me?page=99').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta).toEqual({ page: 99, limit: 20, total: 2, total_pages: 1 });
  });
});

// ================================================== T-038 POST /booking/{id}/cancel (UC-21)
describe('T-038 POST /api/v1/booking/{id}/cancel (UC-21 · BR-08 · 404/403/409/422)', () => {
  let world;
  let app;
  let token;
  let conn;
  let auditSink;

  beforeEach(async () => {
    world = createWorld();
    ({ app, conn, auditSink } = setup(world));
    token = await tokenFor(app, 'mai', CUSTOMER_PASS);
    auditSink.mockClear(); // ตัด POST /auth/login ที่ login ไปแล้วออก
  });

  const cancel = (id, tok = token) => request(app).post(`/api/v1/booking/${id}/cancel`).set(authHeader(tok)).send({});

  test('401: ไม่มี token → UNAUTHORIZED', async () => {
    const res = await request(app).post('/api/v1/booking/4/cancel').send({});
    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('403 guard: ไม่มี BK.CANCEL (outsider + viewer มี BK.VIEW อย่างเดียว) → ข้อความ guard', async () => {
    const outsiderToken = await tokenFor(app, 'outsider', OUTSIDER_PASS);
    const outsider = await cancel(4, outsiderToken);
    expect(outsider.status).toBe(403);
    expect(outsider.body.error).toMatchObject({ code: 'FORBIDDEN', message: GUARD_MSG });

    const viewerToken = await tokenFor(app, 'viewer', VIEWER_PASS);
    const viewer = await cancel(4, viewerToken);
    expect(viewer.status).toBe(403);
    expect(viewer.body.error).toMatchObject({ code: 'FORBIDDEN', message: GUARD_MSG });
    expect(world.repos.booking.lockBooking).not.toHaveBeenCalled();
  });

  test('404: ไม่มีการจอง → lock ใน tx แล้วค่อย 404 · id ไม่ใช่ตัวเลข → 404 ก่อนเข้า tx', async () => {
    const missing = await cancel(999);
    expect(missing.status).toBe(404);
    expect(missing.body.error).toMatchObject({ code: 'NOT_FOUND', message: NOT_FOUND_MSG });
    expect(world.repos.booking.lockBooking).toHaveBeenCalledTimes(1);
    expect(world.repos.booking.cancelBooking).not.toHaveBeenCalled();

    world.repos.booking.lockBooking.mockClear();
    const badId = await cancel('abc');
    expect(badId.status).toBe(404);
    expect(world.repos.booking.lockBooking).not.toHaveBeenCalled();
  });

  test('403: ยกเลิกการจองของคนอื่น → ข้อความ openapi (ownership ตรวจก่อนสถานะ/เวลา)', async () => {
    const res = await cancel(1);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: 'FORBIDDEN', message: FOREIGN_CANCEL_MSG });
    expect(world.repos.booking.cancelBooking).not.toHaveBeenCalled();
  });

  test('409 ซ้ำ: cancel booking ที่ cancelled แล้ว → INVALID_STATUS (repeated cancellation)', async () => {
    const res = await cancel(2);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'INVALID_STATUS', message: ALREADY_CANCELLED_MSG });
    expect(world.repos.booking.cancelBooking).not.toHaveBeenCalled();
  });

  test('422: checked_in → ข้อความ openapi · completed → 422 ห้ามยกเลิก (สถานะก่อนเวลา)', async () => {
    const checkedIn = await cancel(3);
    expect(checkedIn.status).toBe(422);
    expect(checkedIn.body.error).toMatchObject({ code: 'INVALID_STATUS', message: CHECKED_IN_MSG });

    const completed = await cancel(6);
    expect(completed.status).toBe(422);
    expect(completed.body.error).toMatchObject({ code: 'INVALID_STATUS', message: COMPLETED_MSG });

    expect(world.repos.booking.cancelBooking).not.toHaveBeenCalled();
  });

  test('409 CANCEL_TOO_LATE: ถึงจุดขึ้นใน 15 นาที (< ASM-07-2 20 นาที) → ไม่แตะ UPDATE', async () => {
    const res = await cancel(5);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'CANCEL_TOO_LATE', message: CANCEL_TOO_LATE_MSG });
    expect(world.repos.booking.cancelBooking).not.toHaveBeenCalled();
    const row = world.state.rounds.find((r) => r.SCHED_ID === 21).bookings[0];
    expect(row.STATUS).toBe('reserved');
  });

  test('200: ยกเลิกสำเร็จ — สถานะ+cancel_time เปลี่ยนจริง · ข้อความ/รูปตาม openapi · เข้า tx+commit', async () => {
    const res = await cancel(4);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe(CANCEL_SUCCESS_MSG);
    expect(res.body.data).toMatchObject({
      booking_id: 4,
      booking_code: 'BK4',
      cust_id: 7,
      cust_name: 'มานี รักดี',
      sched_id: 20,
      status: 'cancelled',
      seats: 1,
    });
    expect(res.body.data.cancel_time).toEqual(expect.any(String));
    expect(res.body.data.schedule).toMatchObject({ route_name: 'เส้นทางที่ 2', plate_no: 'สย 2591' });
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    const row = world.state.rounds.find((r) => r.SCHED_ID === 20).bookings.find((b) => b.BOOKING_ID === 4);
    expect(row.STATUS).toBe('cancelled');
    expect(row.CANCEL_TIME).toBeInstanceOf(Date);
    const called = await waitFor(() =>
      auditSink.mock.calls.some((c) => c[0].path === '/api/v1/booking/4/cancel'),
    );
    expect(called).toBe(true);
    const entry = auditSink.mock.calls.find((c) => c[0].path === '/api/v1/booking/4/cancel')[0];
    expect(entry).toMatchObject({ method: 'POST', statusCode: 200, empId: 7 });
  });

  test('BR-08: ยกเลิก 1 ที่นั่ง → ที่นั่งว่าง 6 → 7 ทันที + /me cancelled เห็นรายการ + QR หลังยกเลิก → 404', async () => {
    const before = await request(app)
      .get(`/api/v1/booking/available?board_stop=1&alight_stop=4&date=${world.state.DATE}`)
      .set(authHeader(token));
    const round20Before = before.body.data.find((r) => r.sched_id === 20);
    expect(round20Before.seats_available).toBe(6); // capacity 9 - reserved (1 จากคนอื่น + 1 จอง 4)

    const res = await cancel(4);
    expect(res.status).toBe(200);

    const after = await request(app)
      .get(`/api/v1/booking/available?board_stop=1&alight_stop=4&date=${world.state.DATE}`)
      .set(authHeader(token));
    const round20After = after.body.data.find((r) => r.sched_id === 20);
    expect(round20After.seats_available).toBe(7);
    expect(round20After.seats_reserved).toBe(2);

    const cancelled = await request(app).get('/api/v1/booking/me?status=cancelled').set(authHeader(token));
    expect(cancelled.body.data.map((b) => b.booking_id)).toContain(4);

    const qr = await request(app).get('/api/v1/booking/4/qr').set(authHeader(token));
    expect(qr.status).toBe(404);
  });

  test('dynamic RBAC: ถอด BK.CANCEL ระหว่าง session → 403 ทันที (โหลดสิทธิ์ทุก request)', async () => {
    const ok = await cancel(4);
    expect(ok.status).toBe(200);

    world.state.permissions.set(7, ['BK.VIEW', 'BK.CREATE']);
    const blocked = await cancel(5);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toMatchObject({ code: 'FORBIDDEN', message: GUARD_MSG });
  });
});

// ================================================== T-036 BR-06: Service + CHECK CONSTRAINT
describe('T-036 BR-06: Service check + ck_booking_seats CHECK (DoD: จอง 5 ที่นั่ง → ปฏิเสธทั้งสองชั้น)', () => {
  let world;
  let app;
  let token;
  let conn;

  beforeEach(async () => {
    world = createWorld();
    ({ app, conn } = setup(world));
    token = await tokenFor(app, 'mai', CUSTOMER_PASS);
  });

  const post = (seats) =>
    request(app)
      .post('/api/v1/booking')
      .set(authHeader(token))
      .send({ sched_id: 20, board_stop_id: 1, alight_stop_id: 4, seats });

  test('ชั้น Service: seats=5 → 400 BR-06 ก่อนเข้า transaction (INSERT ไม่ถูกเรียก)', async () => {
    const res = await post(5);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: VALIDATION_TOP });
    expect(res.body.error.details).toEqual([{ field: 'seats', message: BR06_DETAILS }]);
    expect(world.repos.booking.lockSchedule).not.toHaveBeenCalled();
    expect(world.repos.booking.insertBooking).not.toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
  });

  test('ชั้น CHECK CONSTRAINT: INSERT คืน ORA-02290 → 400 BR-06 (ไม่ใช่ 500) + rollback', async () => {
    world.repos.booking.insertBooking.mockRejectedValueOnce(
      Object.assign(new Error('ORA-02290: integrity constraint (APP.CK_BOOKING_SEATS) violated'), { errorNum: 2290 }),
    );
    const res = await post(2);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: VALIDATION_TOP });
    expect(res.body.error.details).toEqual([{ field: 'seats', message: BR06_DETAILS }]);
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(res.body.error.message).not.toContain('ORA-02290');
  });

  test('schema static: ck_booking_seats ประกาศ CHECK (seats BETWEEN 1 AND 4) ที่คอลัมน์ booking.seats', () => {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    expect(schema).toContain('CONSTRAINT ck_booking_seats CHECK (seats BETWEEN 1 AND 4)');
    const bookingBlock = schema.match(/CREATE TABLE booking \(([\s\S]*?)\);/);
    expect(bookingBlock).toBeTruthy();
    expect(bookingBlock[1]).toContain('ck_booking_seats');
    expect(schema).toContain('BR-06');
  });
});

// ================================================== T-042 audit_log + API logging
describe('T-042 Audit Log: sink ทุก write request · redaction · schema static · wiring', () => {
  let world;
  let app;
  let token;
  let auditSink;

  beforeEach(async () => {
    world = createWorld();
    ({ app, auditSink } = setup(world));
    token = await tokenFor(app, 'mai', CUSTOMER_PASS);
    auditSink.mockClear(); // ตัด POST /auth/login ที่ login ไปแล้วออก
  });

  test('POST (write) → เรียก sink 1 ครั้ง พร้อม entry ครบ 7 คีย์ + empId จาก JWT + statusCode จริง', async () => {
    const res = await request(app).post('/api/v1/auth/logout').set(authHeader(token));
    expect(res.status).toBe(200);
    const called = await waitFor(() => auditSink.mock.calls.length > 0);
    expect(called).toBe(true);
    const entry = auditSink.mock.calls[0][0];
    expect(Object.keys(entry).sort()).toEqual(
      ['durationMs', 'empId', 'ip', 'method', 'path', 'statusCode', 'ts'].sort(),
    );
    expect(entry).toMatchObject({
      method: 'POST',
      path: '/api/v1/auth/logout',
      statusCode: 200,
      empId: 7,
    });
    expect(typeof entry.ts).toBe('string');
    expect(typeof entry.durationMs).toBe('number');
    expect(typeof entry.ip).toBe('string');
  });

  test('GET → ไม่เรียก sink (write-methods-only — ล็อกโดย middleware.test.js)', async () => {
    const res = await request(app).get('/api/v1/booking/me').set(authHeader(token));
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(auditSink).not.toHaveBeenCalled();
  });

  test('POST /auth/login (ยังไม่มี JWT) → sink ถูกเรียกแต่ empId = null', async () => {
    await request(app).post('/api/v1/auth/login').send({ username: 'mai', password: CUSTOMER_PASS });
    const called = await waitFor(() => auditSink.mock.calls.length > 0);
    expect(called).toBe(true);
    expect(auditSink.mock.calls[0][0]).toMatchObject({ method: 'POST', path: '/api/v1/auth/login', empId: null });
  });

  test('redaction: ค่า query ของ password/token/qr_token/access_token ถูก mask ก่อนถึง sink', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout?password=TopSecret1&token=abc123&qr_token=deadbeef&access_token=zzz&keep=1')
      .set(authHeader(token));
    expect(res.status).toBe(200);
    const called = await waitFor(() => auditSink.mock.calls.length > 0);
    expect(called).toBe(true);
    expect(auditSink.mock.calls[0][0].path).toBe(
      '/api/v1/auth/logout?password=***&token=***&qr_token=***&access_token=***&keep=1',
    );
    expect(JSON.stringify(auditSink.mock.calls[0][0])).not.toContain('TopSecret1');
    expect(JSON.stringify(auditSink.mock.calls[0][0])).not.toContain('deadbeef');

    expect(redactPath('/api/v1/booking/5/qr?refresh_token=s3cret')).toBe('/api/v1/booking/5/qr?refresh_token=***');
    expect(redactPath('/api/v1/booking/me?limit=5')).toBe('/api/v1/booking/me?limit=5');
    expect(redactPath(null)).toBe('');
  });

  test('sink ที่ reject (DB ล่ม) → response ของลูกค้าไม่กระทบ + ไม่มี unhandledRejection', async () => {
    const rejecting = setup(world, { auditSink: jest.fn(() => Promise.reject(new Error('db down'))) });
    const t = await tokenFor(rejecting.app, 'mai', CUSTOMER_PASS);
    const before = process.listenerCount('unhandledRejection');
    const res = await request(rejecting.app).post('/api/v1/auth/logout').set(authHeader(t));
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(process.listenerCount('unhandledRejection')).toBe(before);
  });

  test('schema static: CREATE TABLE audit_log ครบ 8 คอลัมน์ · ไม่มี body/header/password · ไม่มี FK · นับจำนวนอัปเดต', () => {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    expect(schema).toContain('CREATE TABLE audit_log (');
    expect(schema).toContain('CONSTRAINT pk_audit_log PRIMARY KEY (audit_id)');
    expect(schema).toContain('COMMENT ON TABLE  audit_log');

    const block = schema.match(/CREATE TABLE audit_log \(([\s\S]*?)\);/);
    expect(block).toBeTruthy();
    const columns = block[1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^[a-z_]+\s+[A-Z]/.test(line))
      .map((line) => line.split(/\s+/)[0]);
    expect(columns).toEqual(['audit_id', 'method', 'path', 'status_code', 'duration_ms', 'emp_id', 'ip', 'created_at']);
    expect(block[1]).not.toMatch(/FOREIGN KEY/i);

    expect(schema).toContain('ตาราง 21 · คอลัมน์ 110');
    expect(schema).toContain('Constraint 78 = PK 21 + UNIQUE 18 + CHECK 12 + FK 27');
    expect(schema).toContain('COMMENT ON 131 = TABLE 21 + COLUMN 110');
    expect(schema).toContain('AS object_type, 21 AS expected');
    expect(schema).toContain("UNION ALL SELECT 'COLUMN',    110");
    expect(schema).toContain("UNION ALL SELECT 'T_COMMENT',  21");
    expect(schema).toContain("UNION ALL SELECT 'C_COMMENT', 110");
  });

  test('wiring static: app.js ต่อ default sink = audit.repository insert · audit.js mask path ก่อนส่ง sink', () => {
    const appSrc = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
    expect(appSrc).toContain("require('./repositories/audit.repository')");
    expect(appSrc).toContain('createAuditRepository(db)');
    expect(appSrc).toContain('auditSink ||');

    const auditSrc = fs.readFileSync(path.join(__dirname, '../src/middleware/audit.js'), 'utf8');
    expect(auditSrc).toContain('redactPath(req.originalUrl)');
    expect(auditSrc).toContain('WRITE_METHODS');
    expect(auditSrc).not.toContain('req.body');
  });

  test('audit.repository insert: SQL/bind ครบ 6 ฟิลด์ + autoCommit:true + ตัดความยาวเกิน', async () => {
    const spy = jest.fn(async () => ({ rowsAffected: 1 }));
    const repo = createAuditRepository({ query: spy });
    await repo.insert({
      ts: '2026-10-08T00:00:00.000Z', // ts ไม่ถูก insert — created_at DEFAULT SYSTIMESTAMP
      method: 'DELETE',
      path: 'x'.repeat(600),
      statusCode: 404,
      durationMs: 12,
      empId: 7,
      ip: '::1',
    });
    const [sql, binds, options] = spy.mock.calls[0];
    expect(sql).toContain('INSERT INTO audit_log (method, path, status_code, duration_ms, emp_id, ip)');
    expect(sql).toContain('VALUES (:method, :path, :statusCode, :durationMs, :empId, :ip)');
    expect(sql).not.toContain('ts');
    expect(binds).toEqual({ method: 'DELETE', path: 'x'.repeat(500), statusCode: 404, durationMs: 12, empId: 7, ip: '::1' });
    expect(options).toEqual({ autoCommit: true });

    await repo.insert({ method: 'POST', path: '/p', statusCode: 200, durationMs: null, empId: null, ip: null });
    expect(spy.mock.calls[1][1]).toEqual({ method: 'POST', path: '/p', statusCode: 200, durationMs: null, empId: null, ip: null });
  });
});

// ============================================ repository SQL (bind ไม่ interpolation)
describe('repository SQL — lockBooking/cancelBooking/listMine/countMine/findDetails (UC-19/21)', () => {
  let connStub;

  beforeEach(() => {
    dbMock.query.mockReset();
    connStub = {
      execute: jest.fn(async () => ({ rows: [], rowsAffected: 1 })),
    };
  });

  test('lockBooking: blocking FOR UPDATE (ไม่ใช่ NOWAIT) + scalar subquery เวลาถึงจุดขึ้น · bind เท่านั้น', async () => {
    await bookingRepo.lockBooking(connStub, 4);
    const [sql, binds] = connStub.execute.mock.calls[0];
    expect(sql).toContain('FOR UPDATE');
    expect(sql).not.toContain('NOWAIT');
    expect(sql).toContain('(SELECT sst.arrive_at FROM schedule_stop sst');
    expect(sql).toContain('WHERE b.booking_id = :bookingId');
    expect(binds).toEqual({ bookingId: 4 });
  });

  test('cancelBooking: UPDATE status+cancel_time (BR-08) · bind เท่านั้น · ไม่แตะคอลัมน์ seats', async () => {
    await bookingRepo.cancelBooking(connStub, 7);
    const [sql, binds] = connStub.execute.mock.calls[0];
    expect(sql).toContain("SET status = 'cancelled', cancel_time = SYSTIMESTAMP");
    expect(sql).toContain('WHERE booking_id = :bookingId');
    expect(sql).not.toContain('seats');
    expect(binds).toEqual({ bookingId: 7 });
  });

  test('listMine: 4 สถานะกรองได้ · cust_id/limit/offset เป็น bind · OFFSET/FETCH · ไม่ SELECT *', async () => {
    const base = { custId: 7, limit: 20, offset: 0 };

    dbMock.query.mockResolvedValueOnce({ rows: [] });
    await bookingRepo.listMine({ ...base, status: 'upcoming' });
    let [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).toContain("b.status = 'reserved' AND s.service_date >= TRUNC(SYSDATE)"); // upcoming
    expect(sql).toContain('WHERE b.cust_id = :custId');
    expect(sql).toContain('OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY');
    expect(sql).toContain('ORDER BY s.depart_at, b.booking_id');
    expect(sql).not.toContain('SELECT *');
    expect(binds).toEqual({ custId: 7, limit: 20, offset: 0 });

    dbMock.query.mockResolvedValueOnce({ rows: [] });
    await bookingRepo.listMine({ ...base, status: 'completed' });
    expect(dbMock.query.mock.calls[1][0]).toContain("b.status = 'completed'");

    dbMock.query.mockResolvedValueOnce({ rows: [] });
    await bookingRepo.listMine({ ...base, status: 'cancelled' });
    expect(dbMock.query.mock.calls[2][0]).toContain("b.status = 'cancelled'");

    dbMock.query.mock.calls = [];
    dbMock.query.mockResolvedValue({ rows: [] });
    await bookingRepo.listMine({ ...base, status: 'all' });
    expect(dbMock.query.mock.calls[0][0]).toContain('1 = 1');
    expect(dbMock.query.mock.calls[0][0]).not.toContain('status = ');
  });

  test('listMine: ค่า cust_id แปลก ๆ ไม่ถูก interpolate (P-04) — อยู่ใน bind ล้วน', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [] });
    await bookingRepo.listMine({ custId: "7' OR 1=1--", status: 'upcoming', limit: 20, offset: 0 });
    const [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).not.toContain('OR 1=1');
    expect(binds.custId).toBe("7' OR 1=1--");
  });

  test('countMine: COUNT(*) กับ WHERE ชุดเดียวกับ listMine · bind เฉพาะ custId', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [{ TOTAL: 2 }] });
    const total = await bookingRepo.countMine({ custId: 7, status: 'upcoming' });
    const [sql, binds] = dbMock.query.mock.calls[0];
    expect(total).toBe(2);
    expect(sql).toContain('SELECT COUNT(*) AS total');
    expect(sql).toContain("b.status = 'reserved' AND s.service_date >= TRUNC(SYSDATE)");
    expect(sql).not.toContain('SELECT *');
    expect(binds).toEqual({ custId: 7 });
  });

  test('findDetails: ขยายครบ — cust_name (join employee) + driver_assign MIN subquery + vehicle + ทุกจุดจอด', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [] });
    await bookingRepo.findDetails(4);
    const [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).toContain("c.first_name || ' ' || c.last_name AS cust_name");
    expect(sql).toContain('JOIN employee c ON c.emp_id = b.cust_id');
    expect(sql).toContain('driver_assign');
    expect(sql).toContain("d.first_name || ' ' || d.last_name AS driver_name");
    expect(sql).toContain('board_stop_name');
    expect(sql).toContain('alight_stop_name');
    expect(sql).toContain('qr_token');
    expect(binds).toEqual({ bookingId: 4 });
    expect(sql).not.toContain('SELECT *');
  });
});
