// backend/tests/sprint10.test.js — Sprint 10 (T-043..T-046) regression tests
// ครอบคลุม: GET /driver/schedule (UC-22 · can_start 3b/3c · passenger_count · ?date=),
//           POST /driver/trip/{schedId}/start (UC-23 · caller assignment · NOT_ASSIGNED/403/409 ทั้งสองแบบ · TX),
//           GET /driver/trip/{tripId}/manifest (UC-24 · LISTAGG · ownership · is_passed),
//           POST /driver/trip/scan (UC-25 · BR-09 ผิดรอบ · สถานะจอง · สแกนซ้ำ atomic · board_seq)
//           + repository SQL (bind variables เท่านั้น, FOR UPDATE ไม่ใช่ NOWAIT, LISTAGG WITHIN GROUP)
// permission: TRIP.START (schedule/start/manifest) / QR.SCAN (scan) จาก seed — dynamic RBAC ทุก request
// โครง test: inject fake repos + fake connection เข้า createApp (ไม่ต้อง Oracle จริง) แบบ sprint08/09
//            transaction/SQL semantics เลียนแบบ repository จริง แล้ว assert ผ่าน HTTP + spy

process.env.JWT_SECRET = 'sprint10-test-secret-0123456789abcdef0123456789abcdef';
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

const { createApp } = require('../src/app');
const dbMock = require('../src/config/db');
const { resetLoginAttempts } = require('../src/middleware/auth');
const driverRepo = require('../src/repositories/driver.repository');

const ADMIN_PASS = 'AdminPass123';
const VIEWER_PASS = 'ViewerPass123';
const DRIVER_PASS = 'DriverPass123';
const CUSTOMER_PASS = 'CustomerPass123';

const GUARD_MSG = 'ไม่มีสิทธิ์เข้าถึงส่วนนี้';
const VALIDATION_TOP = 'ข้อมูลที่ส่งมาไม่ถูกต้อง';
const NOT_FOUND_MSG = 'ไม่พบข้อมูลที่ต้องการ';
const NOT_ASSIGNED_MSG = 'รอบนี้ยังไม่ได้มอบหมายคนขับและรถ';
const FOREIGN_TRIP_MSG = 'คุณไม่ใช่คนขับที่ได้รับมอบหมายรอบนี้';
const ALREADY_STARTED_MSG = 'รอบนี้เริ่มงานไปแล้ว';
const TRIP_PENDING_MSG = 'ยังมีรอบงานค้างอยู่ที่ยังไม่ปิดงาน ต้องปิดรอบเดิมก่อน';
const TRIP_NOT_RUNNING_MSG = 'รอบนี้ปิดงานไปแล้ว';
const QR_NOT_FOUND_MSG = 'ไม่พบ QR นี้ในระบบ';
const WRONG_TRIP_MSG = 'QR นี้ไม่ใช่ของรอบที่กำลังเดิน';
const CANCELLED_MSG = 'การจองนี้ถูกยกเลิกแล้ว';
const ALREADY_CHECKED_MSG = 'เช็คอินไปแล้ว';
const CHECKED_IN_MSG = 'เช็คอินสำเร็จ';
const START_OK_MSG = 'เริ่มงานสำเร็จ';
const BLOCKED_STARTED = 'รอบนี้เริ่มงานไปแล้ว';
const BLOCKED_PENDING = 'ยังมีรอบงานค้างอยู่ที่ยังไม่ปิดงาน';

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

  // DATE ต้องเป็นวัน UTC วันเดียวกับที่ fake repo ใช้เป็นค่า default (new Date().toISOString())
  // — เดิมใช้ at(45) (now+45min) ซึ่งข้ามเที่ยงคืน UTC ในช่วง 23:15–24:00 แล้วค่าว่างเปล่า (flaky)
  const DATE = new Date(t0).toISOString().slice(0, 10);
  const OTHER_DATE = '2027-01-01';

  const stopNames = {
    1: 'มหาวิทยาลัยเทคโนโลยีมหานคร',
    2: 'สถานีรถไฟฟ้าบางนา',
    4: 'ห้างสรรพสินค้าเซ็นทรัล',
  };
  const custFull = { 7: 'มานี รักดี', 99: 'สมชาย มั่นคง' };
  const custLast = { 7: 'รักดี', 99: 'มั่นคง' };
  const empFull = { 1: 'ผู้ดูแล ระบบ', 2: 'เจ้าหน้าที่ ดูข้อมูล', 5: 'สมชาย คนขับ', 6: 'บุญช่วย มั่นคง', 7: 'มานี รักดี', 8: 'ประเสริฐ ขับรถ' };

  const mkStops = (list) =>
    list.map(([stopId, seq, arriveAt]) => ({ STOP_ID: stopId, STOP_SEQ: seq, ARRIVE_AT: arriveAt, STOP_NAME: stopNames[stopId] }));

  // rounds: 30/31/33 = คนขับ 5 (เริ่มได้ / เคยเริ่มแล้ว-trip completed / ไม่มีรถ), 36 = อีกวัน
  //         32/32b = คนขับ 6 (มี trip running ค้าง / รอบถัดไปที่ติด 3b), 35 = ไม่มีคนขับ
  //         40 = คนขับ 8 (trip 50 running — manifest/scan), 41 = รอบจองผิด (BR-09), 42 = คนขับ 8 (trip 52 ปิดแล้ว)
  const rounds = [
    {
      SCHED_ID: 30, ROUTE_ID: 2, ROUTE_NAME: 'เส้นทาง 2', TOTAL_MINUTES: 13,
      SERVICE_DATE: DATE, DEPART_AT: at(60), VEH_ID: 1, PLATE_NO: 'สย 2591', drivers: [5],
      stops: mkStops([[1, 1, at(70)], [2, 2, at(75)], [4, 3, at(80)]]),
      bookings: [
        { BOOKING_ID: 20, CUST_ID: 7, SEATS: 2, STATUS: 'reserved', BOOKING_CODE: 'BK20', QR_TOKEN: '2'.repeat(32), BOARD_STOP_ID: 1 },
        { BOOKING_ID: 21, CUST_ID: 7, SEATS: 1, STATUS: 'cancelled', BOOKING_CODE: 'BK21', QR_TOKEN: 'q'.repeat(32), BOARD_STOP_ID: 1 },
        { BOOKING_ID: 22, CUST_ID: 99, SEATS: 1, STATUS: 'checked_in', BOOKING_CODE: 'BK22', QR_TOKEN: 'w'.repeat(32), BOARD_STOP_ID: 1 },
      ],
    },
    {
      SCHED_ID: 31, ROUTE_ID: 2, ROUTE_NAME: 'เส้นทาง 2', TOTAL_MINUTES: 13,
      SERVICE_DATE: DATE, DEPART_AT: at(30), VEH_ID: 1, PLATE_NO: 'สย 2591', drivers: [5],
      stops: mkStops([[1, 1, at(35)], [2, 2, at(40)], [4, 3, at(45)]]),
      bookings: [],
    },
    {
      SCHED_ID: 33, ROUTE_ID: 2, ROUTE_NAME: 'เส้นทาง 2', TOTAL_MINUTES: 13,
      SERVICE_DATE: DATE, DEPART_AT: at(90), VEH_ID: null, PLATE_NO: null, drivers: [5],
      stops: mkStops([[1, 1, at(95)], [2, 2, at(100)], [4, 3, at(105)]]),
      bookings: [],
    },
    {
      SCHED_ID: 36, ROUTE_ID: 2, ROUTE_NAME: 'เส้นทาง 2', TOTAL_MINUTES: 13,
      SERVICE_DATE: OTHER_DATE, DEPART_AT: at(20), VEH_ID: 1, PLATE_NO: 'สย 2591', drivers: [5],
      stops: mkStops([[1, 1, at(25)], [2, 2, at(26)], [4, 3, at(27)]]),
      bookings: [],
    },
    {
      SCHED_ID: 32, ROUTE_ID: 2, ROUTE_NAME: 'เส้นทาง 2', TOTAL_MINUTES: 13,
      SERVICE_DATE: DATE, DEPART_AT: at(15), VEH_ID: 2, PLATE_NO: 'สย 2592', drivers: [6],
      stops: mkStops([[1, 1, at(20)], [2, 2, at(22)], [4, 3, at(24)]]),
      bookings: [],
    },
    {
      SCHED_ID: 321, ROUTE_ID: 2, ROUTE_NAME: 'เส้นทาง 2', TOTAL_MINUTES: 13,
      SERVICE_DATE: DATE, DEPART_AT: at(120), VEH_ID: 2, PLATE_NO: 'สย 2592', drivers: [6],
      stops: mkStops([[1, 1, at(125)], [2, 2, at(127)], [4, 3, at(129)]]),
      bookings: [],
    },
    {
      SCHED_ID: 35, ROUTE_ID: 2, ROUTE_NAME: 'เส้นทาง 2', TOTAL_MINUTES: 13,
      SERVICE_DATE: DATE, DEPART_AT: at(150), VEH_ID: 1, PLATE_NO: 'สย 2591', drivers: [],
      stops: mkStops([[1, 1, at(155)], [2, 2, at(157)], [4, 3, at(159)]]),
      bookings: [],
    },
    {
      SCHED_ID: 40, ROUTE_ID: 2, ROUTE_NAME: 'เส้นทาง 2', TOTAL_MINUTES: 13,
      SERVICE_DATE: DATE, DEPART_AT: at(45), VEH_ID: 1, PLATE_NO: 'สย 2591', drivers: [8],
      stops: mkStops([[1, 1, at(-10)], [2, 2, at(-5)], [4, 3, at(30)]]),
      bookings: [
        { BOOKING_ID: 30, CUST_ID: 7, SEATS: 1, STATUS: 'checked_in', BOOKING_CODE: 'BK30', QR_TOKEN: 'f'.repeat(32), BOARD_STOP_ID: 1 },
        { BOOKING_ID: 31, CUST_ID: 99, SEATS: 1, STATUS: 'checked_in', BOOKING_CODE: 'BK31', QR_TOKEN: 'g'.repeat(32), BOARD_STOP_ID: 1 },
        { BOOKING_ID: 40, CUST_ID: 7, SEATS: 2, STATUS: 'reserved', BOOKING_CODE: 'BK40', QR_TOKEN: 'a'.repeat(32), BOARD_STOP_ID: 1 },
        { BOOKING_ID: 42, CUST_ID: 99, SEATS: 1, STATUS: 'cancelled', BOOKING_CODE: 'BK42', QR_TOKEN: 'c'.repeat(32), BOARD_STOP_ID: 1 },
        { BOOKING_ID: 43, CUST_ID: 7, SEATS: 1, STATUS: 'checked_in', BOOKING_CODE: 'BK43', QR_TOKEN: 'd'.repeat(32), BOARD_STOP_ID: 2 },
        { BOOKING_ID: 45, CUST_ID: 99, SEATS: 1, STATUS: 'reserved', BOOKING_CODE: 'BK45', QR_TOKEN: 'e'.repeat(32), BOARD_STOP_ID: 1 },
      ],
    },
    {
      SCHED_ID: 41, ROUTE_ID: 2, ROUTE_NAME: 'เส้นทาง 2', TOTAL_MINUTES: 13,
      SERVICE_DATE: DATE, DEPART_AT: at(50), VEH_ID: 1, PLATE_NO: 'สย 2593', drivers: [],
      stops: mkStops([[1, 1, at(55)], [2, 2, at(57)], [4, 3, at(59)]]),
      bookings: [
        { BOOKING_ID: 41, CUST_ID: 7, SEATS: 1, STATUS: 'reserved', BOOKING_CODE: 'BK41', QR_TOKEN: 'b'.repeat(32), BOARD_STOP_ID: 1 },
      ],
    },
    {
      SCHED_ID: 42, ROUTE_ID: 2, ROUTE_NAME: 'เส้นทาง 2', TOTAL_MINUTES: 13,
      SERVICE_DATE: DATE, DEPART_AT: at(75), VEH_ID: 1, PLATE_NO: 'สย 2591', drivers: [8],
      stops: mkStops([[1, 1, at(80)], [2, 2, at(82)], [4, 3, at(84)]]),
      bookings: [],
    },
  ];

  const trips = [
    { TRIP_ID: 41, SCHED_ID: 31, DRIVER_ID: 5, VEH_ID: 1, START_TIME: at(-100), END_TIME: at(-80), STATUS: 'completed' },
    { TRIP_ID: 42, SCHED_ID: 32, DRIVER_ID: 6, VEH_ID: 2, START_TIME: at(-20), END_TIME: null, STATUS: 'running' },
    { TRIP_ID: 50, SCHED_ID: 40, DRIVER_ID: 8, VEH_ID: 1, START_TIME: at(-12), END_TIME: null, STATUS: 'running' },
    { TRIP_ID: 52, SCHED_ID: 42, DRIVER_ID: 8, VEH_ID: 1, START_TIME: at(-60), END_TIME: at(-30), STATUS: 'completed' },
  ];

  const tripPassengers = [
    { TP_ID: 900, tripId: 50, bookingId: 30, checkinStopId: 1, boardSeq: 1, checkinTime: at(-8), alightSeq: 2, alightTime: at(-4) },
    { TP_ID: 901, tripId: 50, bookingId: 31, checkinStopId: 1, boardSeq: 1, checkinTime: at(-7), alightSeq: null, alightTime: null },
    { TP_ID: 902, tripId: 50, bookingId: 43, checkinStopId: 2, boardSeq: 2, checkinTime: at(-6), alightSeq: null, alightTime: null },
  ];

  let nextTripId = 100;
  let nextTpId = 1000;

  // overlay จำลอง TX จริง: update/insert ลง overlay ก่อน — commit ค่อย apply ลง state, rollback ทิ้ง (ไม่มีสถานะครึ่งกลาง)
  const overlay = { statuses: new Map(), newTps: [] };
  const commitPending = () => {
    for (const [id, status] of overlay.statuses) {
      const found = findBooking(id);
      if (found) found.booking.STATUS = status;
    }
    for (const row of overlay.newTps) tripPassengers.push(row);
    overlay.statuses.clear();
    overlay.newTps.length = 0;
  };
  const rollbackPending = () => {
    overlay.statuses.clear();
    overlay.newTps.length = 0;
  };

  const roundOf = (schedId) => rounds.find((r) => r.SCHED_ID === Number(schedId)) || null;
  const tripOfSched = (schedId) => trips.find((t) => t.SCHED_ID === Number(schedId)) || null;
  const findBooking = (bookingId) => {
    for (const r of rounds) {
      const b = r.bookings.find((x) => x.BOOKING_ID === Number(bookingId));
      if (b) return { round: r, booking: b };
    }
    return null;
  };
  const findByQr = (qrToken) => {
    for (const r of rounds) {
      const b = r.bookings.find((x) => x.QR_TOKEN === qrToken);
      if (b) return { round: r, booking: b };
    }
    return null;
  };
  const namesFor = (bookingIds) => {
    const rows = bookingIds
      .map((id) => {
        const found = findBooking(id);
        if (!found) return null;
        const cust = found.booking.CUST_ID;
        return { full: custFull[cust] || null, last: custLast[cust] || '' };
      })
      .filter((row) => row && row.full)
      .sort((a, b) => (a.last < b.last ? -1 : a.last > b.last ? 1 : 0))
      .map((row) => row.full);
    return rows.length > 0 ? rows.join(', ') : null;
  };

  function addEmployee(o) {
    const row = {
      EMP_ID: o.empId,
      EMP_CODE: o.empCode || `EMP${String(o.empId).padStart(3, '0')}`,
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
    // ---- fake driver repo: เลียนแบบ SQL semantics ของ driver.repository (UC-22..UC-25) ----
    driver: {
      // listMyRounds: เฉพาะ driver_assign ของ empId + service_date (null = วันนี้)
      listMyRounds: jest.fn(async ({ empId, serviceDate }) => {
        const date = serviceDate || new Date().toISOString().slice(0, 10);
        const mine = rounds
          .filter((r) => r.SERVICE_DATE === date && r.drivers.includes(Number(empId)))
          .sort((a, b) => a.DEPART_AT - b.DEPART_AT || a.SCHED_ID - b.SCHED_ID);
        const running = trips.filter((t) => t.DRIVER_ID === Number(empId) && t.STATUS === 'running');
        return mine.map((r) => {
          const trip = tripOfSched(r.SCHED_ID);
          const pending = running.find((t) => t.SCHED_ID !== r.SCHED_ID) || null;
          return {
            SCHED_ID: r.SCHED_ID,
            SERVICE_DATE: r.SERVICE_DATE,
            DEPART_AT: r.DEPART_AT,
            ROUTE_ID: r.ROUTE_ID,
            ROUTE_NAME: r.ROUTE_NAME,
            TOTAL_MINUTES: r.TOTAL_MINUTES,
            VEH_ID: r.VEH_ID,
            PLATE_NO: r.PLATE_NO,
            TRIP_ID: trip ? trip.TRIP_ID : null,
            PASSENGER_COUNT: r.bookings.filter((b) => b.STATUS === 'reserved').length,
            PENDING_TRIP_ID: pending ? pending.TRIP_ID : null,
            PENDING_SCHED_ID: pending ? pending.SCHED_ID : null,
          };
        });
      }),
      lockSchedule: jest.fn(async (conn, schedId) => {
        const r = roundOf(schedId);
        return r ? { SCHED_ID: r.SCHED_ID } : null;
      }),
      findDriverAssignments: jest.fn(async (conn, schedId) => {
        const r = roundOf(schedId);
        return r ? [...r.drivers] : [];
      }),
      findVehicleAssignment: jest.fn(async (conn, schedId) => {
        const r = roundOf(schedId);
        return r && r.VEH_ID != null ? r.VEH_ID : null;
      }),
      findTripBySched: jest.fn(async (conn, schedId) => {
        const t = tripOfSched(schedId);
        return t ? { TRIP_ID: t.TRIP_ID, STATUS: t.STATUS } : null;
      }),
      findDriverRunningTrip: jest.fn(async (conn, empId, exceptSchedId) => {
        const t = trips.find(
          (x) => x.DRIVER_ID === Number(empId) && x.STATUS === 'running' && x.SCHED_ID !== Number(exceptSchedId),
        );
        return t ? { TRIP_ID: t.TRIP_ID, SCHED_ID: t.SCHED_ID } : null;
      }),
      insertTrip: jest.fn(async (conn, { schedId, driverId, vehId }) => {
        const id = nextTripId;
        nextTripId += 1;
        trips.push({ TRIP_ID: id, SCHED_ID: schedId, DRIVER_ID: driverId, VEH_ID: vehId, START_TIME: new Date(), END_TIME: null, STATUS: 'running' });
        return id;
      }),
      findTripById: jest.fn(async (tripId) => {
        const t = trips.find((x) => x.TRIP_ID === Number(tripId));
        if (!t) return null;
        const r = roundOf(t.SCHED_ID);
        return {
          TRIP_ID: t.TRIP_ID,
          SCHED_ID: t.SCHED_ID,
          DRIVER_ID: t.DRIVER_ID,
          VEH_ID: t.VEH_ID,
          START_TIME: t.START_TIME,
          END_TIME: t.END_TIME,
          STATUS: t.STATUS,
          ROUTE_NAME: r ? r.ROUTE_NAME : null,
          PLATE_NO: r ? r.PLATE_NO : null,
          DRIVER_NAME: empFull[t.DRIVER_ID] || null,
        };
      }),
      // findManifestStops: ขึ้น = checkin_stop_id + checkin_time, ลง = alight_seq + alight_time (ตามสคีมา)
      findManifestStops: jest.fn(async (tripId) => {
        const t = trips.find((x) => x.TRIP_ID === Number(tripId));
        if (!t) return [];
        const r = roundOf(t.SCHED_ID);
        if (!r) return [];
        return r.stops.map((s) => {
          const boards = tripPassengers
            .filter((tp) => tp.tripId === t.TRIP_ID && tp.checkinStopId === s.STOP_ID && tp.checkinTime)
            .map((tp) => tp.bookingId);
          const alights = tripPassengers
            .filter((tp) => tp.tripId === t.TRIP_ID && tp.alightSeq === s.STOP_SEQ && tp.alightTime)
            .map((tp) => tp.bookingId);
          return {
            STOP_ID: s.STOP_ID,
            STOP_NAME: s.STOP_NAME,
            STOP_SEQ: s.STOP_SEQ,
            ARRIVE_AT: s.ARRIVE_AT,
            BOARD_COUNT: boards.length,
            BOARD_NAMES: namesFor(boards),
            ALIGHT_COUNT: alights.length,
            ALIGHT_NAMES: namesFor(alights),
          };
        });
      }),
      lockBookingByQr: jest.fn(async (conn, qrToken, tripId) => {
        const found = findByQr(qrToken);
        if (!found) return null;
        const b = found.booking;
        const tp = tripPassengers.find((x) => x.tripId === Number(tripId) && x.bookingId === b.BOOKING_ID);
        const effectiveStatus = overlay.statuses.has(b.BOOKING_ID) ? overlay.statuses.get(b.BOOKING_ID) : b.STATUS;
        return {
          BOOKING_ID: b.BOOKING_ID,
          BOOKING_CODE: b.BOOKING_CODE,
          CUST_ID: b.CUST_ID,
          SCHED_ID: found.round.SCHED_ID,
          STATUS: effectiveStatus,
          SEATS: b.SEATS,
          BOARD_STOP_ID: b.BOARD_STOP_ID,
          PASSENGER_NAME: custFull[b.CUST_ID] || null,
          CHECKIN_TIME: tp ? tp.checkinTime : null,
        };
      }),
      findStopSeq: jest.fn(async (conn, schedId, stopId) => {
        const r = roundOf(schedId);
        const s = r && r.stops.find((x) => x.STOP_ID === Number(stopId));
        return s ? { STOP_SEQ: s.STOP_SEQ } : null;
      }),
      updateCheckin: jest.fn(async (conn, bookingId) => {
        overlay.statuses.set(Number(bookingId), 'checked_in');
        return { rowsAffected: 1 };
      }),
      insertTripPassenger: jest.fn(async (conn, { tripId, bookingId, checkinStopId, boardSeq }) => {
        const id = nextTpId;
        nextTpId += 1;
        overlay.newTps.push({ TP_ID: id, tripId, bookingId, checkinStopId, boardSeq, checkinTime: new Date(), alightSeq: null, alightTime: null });
        return { rowsAffected: 1 };
      }),
      findCheckin: jest.fn(async (conn, tripId, bookingId) => {
        const pendingRow = overlay.newTps.find((x) => x.tripId === Number(tripId) && x.bookingId === Number(bookingId));
        if (pendingRow) return { CHECKIN_TIME: pendingRow.checkinTime };
        const tp = tripPassengers.find((x) => x.tripId === Number(tripId) && x.bookingId === Number(bookingId));
        return tp ? { CHECKIN_TIME: tp.checkinTime } : null;
      }),
    },
  };

  addEmployee({ empId: 1, username: 'admin', fullName: 'ผู้ดูแล ระบบ', passwordHash: bcrypt.hashSync(ADMIN_PASS, 4), roles: ['ADMIN'], permissions: ['TRIP.START', 'QR.SCAN', 'BK.VIEW'], menus: [] });
  addEmployee({ empId: 2, username: 'viewer', fullName: 'เจ้าหน้าที่ ดูข้อมูล', passwordHash: bcrypt.hashSync(VIEWER_PASS, 4), roles: ['STAFF'], permissions: ['ROUTE.VIEW'], menus: [] });
  addEmployee({ empId: 5, username: 'somchai', fullName: 'สมชาย คนขับ', passwordHash: bcrypt.hashSync(DRIVER_PASS, 4), roles: ['DRIVER'], permissions: ['TRIP.START', 'TRIP.END', 'QR.SCAN'], menus: [] });
  addEmployee({ empId: 6, username: 'booncho', fullName: 'บุญช่วย มั่นคง', passwordHash: bcrypt.hashSync(DRIVER_PASS, 4), roles: ['DRIVER'], permissions: ['TRIP.START', 'TRIP.END', 'QR.SCAN'], menus: [] });
  addEmployee({ empId: 7, username: 'mai', fullName: 'มานี รักดี', passwordHash: bcrypt.hashSync(CUSTOMER_PASS, 4), roles: ['CUSTOMER'], permissions: ['BK.VIEW'], menus: [] });
  addEmployee({ empId: 8, username: 'prakai', fullName: 'ประเสริฐ ขับรถ', passwordHash: bcrypt.hashSync(DRIVER_PASS, 4), roles: ['DRIVER'], permissions: ['TRIP.START', 'TRIP.END', 'QR.SCAN'], menus: [] });

  return {
    repos,
    state: { profiles, credentials, permissions, menus, roles, revoked, rounds, trips, tripPassengers, DATE, OTHER_DATE },
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

// ================================================== T-043 GET /driver/schedule (UC-22)
describe('T-043 GET /api/v1/driver/schedule (UC-22 · can_start/blocked_reason · ?date=)', () => {
  let world;
  let app;
  let somchai;

  beforeEach(async () => {
    world = createWorld();
    ({ app } = setup(world));
    somchai = await tokenFor(app, 'somchai', DRIVER_PASS);
  });

  const ids = (body) => body.data.map((s) => s.sched_id);

  test('401 ไม่มี token → UNAUTHORIZED; 403 ไม่มี TRIP.START (viewer/mai) → FORBIDDEN กันทุก endpoint', async () => {
    const noAuth = await request(app).get('/api/v1/driver/schedule');
    expect(noAuth.status).toBe(401);
    expect(noAuth.body.error).toMatchObject({ code: 'UNAUTHORIZED' });

    const viewer = await tokenFor(app, 'viewer', VIEWER_PASS);
    const res = await request(app).get('/api/v1/driver/schedule').set(authHeader(viewer));
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: 'FORBIDDEN', message: GUARD_MSG });

    const mai = await tokenFor(app, 'mai', CUSTOMER_PASS);
    const res2 = await request(app).get('/api/v1/driver/schedule').set(authHeader(mai));
    expect(res2.status).toBe(403);
    expect(res2.body.error).toMatchObject({ code: 'FORBIDDEN' });
  });

  test('200 default = วันนี้: เรียง depart_at + item = openapi DriverSchedule 13 ฟิลด์ + end_at = depart+total_minutes + passenger_count นับ reserved', async () => {
    const res = await request(app).get('/api/v1/driver/schedule').set(authHeader(somchai));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(ids(res.body)).toEqual([31, 30, 33]); // 30m/60m/90m — รอบวันอื่น (36) ไม่เข้า
    expect(res.body).not.toHaveProperty('meta'); // openapi = data array เปล่า ๆ

    const item = res.body.data.find((s) => s.sched_id === 30);
    expect(Object.keys(item).sort()).toEqual(
      ['sched_id', 'service_date', 'depart_at', 'end_at', 'route_id', 'route_name', 'total_minutes', 'veh_id', 'plate_no', 'passenger_count', 'trip_id', 'can_start', 'blocked_reason'].sort(),
    );
    expect(item.service_date).toBe(world.state.DATE);
    expect(new Date(item.end_at).getTime() - new Date(item.depart_at).getTime()).toBe(13 * 60000);
    expect(item.total_minutes).toBe(13);
    expect(item.plate_no).toBe('สย 2591');
    // passenger_count = COUNT booking reserved เท่านั้น (30 มี reserved 1 / cancelled 1 / checked_in 1)
    expect(item.passenger_count).toBe(1);
    expect(item.trip_id).toBeNull();
    expect(item.can_start).toBe(true);
    expect(item.blocked_reason).toBeNull();

    const started = res.body.data.find((s) => s.sched_id === 31);
    expect(started.trip_id).toBe(41);
    expect(started.can_start).toBe(false);
    expect(started.blocked_reason).toBe(BLOCKED_STARTED);
  });

  test('can_start=false แบบ 3b: วันนี้มี trip running ค้าง (คนขับ 6) → รอบที่ยังไม่เริ่มติด blocked_reason งานค้าง', async () => {
    const token = await tokenFor(app, 'booncho', DRIVER_PASS);
    const res = await request(app).get('/api/v1/driver/schedule').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(ids(res.body)).toEqual([32, 321]); // 15m / 120m
    expect(res.body.data[0]).toMatchObject({ trip_id: 42, can_start: false, blocked_reason: BLOCKED_STARTED });
    expect(res.body.data[1]).toMatchObject({ trip_id: null, can_start: false, blocked_reason: BLOCKED_PENDING });
  });

  test('?date=2027-01-01 → [36]; ?date= (ว่าง) = default วันนี้; วันที่ไม่มีรอบ → data: []', async () => {
    const other = await request(app).get('/api/v1/driver/schedule?date=2027-01-01').set(authHeader(somchai));
    expect(other.status).toBe(200);
    expect(ids(other.body)).toEqual([36]);
    expect(other.body.data[0].service_date).toBe('2027-01-01');

    const empty = await request(app).get('/api/v1/driver/schedule?date=').set(authHeader(somchai));
    expect(empty.status).toBe(200);
    expect(ids(empty.body)).toEqual([31, 30, 33]);

    const none = await request(app).get('/api/v1/driver/schedule?date=2027-06-01').set(authHeader(somchai));
    expect(none.status).toBe(200);
    expect(none.body.data).toEqual([]);
  });

  test('date ผิดรูป/วันที่ไม่มีจริง → 400 VALIDATION_ERROR details field=date (ไม่ใช่ 404/500)', async () => {
    for (const bad of ['abc', '2027-13-45', '2027-02-30']) {
      const res = await request(app).get(`/api/v1/driver/schedule?date=${bad}`).set(authHeader(somchai));
      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: VALIDATION_TOP });
      expect(res.body.error.details).toEqual([{ field: 'date', message: 'must be a date (YYYY-MM-DD)' }]);
    }
  });

  test('เห็นเฉพาะรอบที่ตัวเองถูกมอบหมาย (driver_assign) — ไม่เห็นรอบคนอื่น/ไม่มีคนขับ; คนไม่มีรอบ → []', async () => {
    const res = await request(app).get('/api/v1/driver/schedule').set(authHeader(somchai));
    expect(ids(res.body)).not.toContain(32); // คนขับ 6
    expect(ids(res.body)).not.toContain(40); // คนขับ 8
    expect(ids(res.body)).not.toContain(35); // ไม่มีคนขับ
    expect(ids(res.body)).not.toContain(41); // ไม่มีคนขับ

    const admin = await tokenFor(app, 'admin', ADMIN_PASS); // มี TRIP.START แต่ไม่มี driver_assign
    const res2 = await request(app).get('/api/v1/driver/schedule').set(authHeader(admin));
    expect(res2.status).toBe(200);
    expect(res2.body.data).toEqual([]);
  });
});

// ================================================== T-044 POST /driver/trip/{schedId}/start (UC-23)
describe('T-044 POST /api/v1/driver/trip/{schedId}/start (UC-23 · assignment · 409 ทั้งสองแบบ · TX)', () => {
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

  const start = (schedId, tok = somchai) => request(app).post(`/api/v1/driver/trip/${schedId}/start`).set(authHeader(tok)).send({});

  test('401 ไม่มี token; 403 ไม่มี TRIP.START (viewer)', async () => {
    const noAuth = await request(app).post('/api/v1/driver/trip/30/start').send({});
    expect(noAuth.status).toBe(401);
    expect(noAuth.body.error).toMatchObject({ code: 'UNAUTHORIZED' });

    const viewer = await tokenFor(app, 'viewer', VIEWER_PASS);
    const res = await start(30, viewer);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: 'FORBIDDEN', message: GUARD_MSG });
  });

  test('201: insert trip (sched รถคนขับ ครบ) → Trip 7 ฟิลด์ + commit ครั้งเดียว + bind args ถูกต้อง', async () => {
    const res = await start(30);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe(START_OK_MSG);
    const trip = res.body.data;
    expect(Object.keys(trip).sort()).toEqual(
      ['trip_id', 'sched_id', 'driver_id', 'veh_id', 'start_time', 'end_time', 'status'].sort(),
    );
    expect(trip).toMatchObject({ trip_id: 100, sched_id: 30, driver_id: 5, veh_id: 1, status: 'running' });
    expect(trip.start_time).toEqual(expect.any(String));
    expect(trip.end_time).toBeNull();
    expect(world.repos.driver.insertTrip).toHaveBeenCalledWith(conn, { schedId: 30, driverId: 5, vehId: 1 });
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(world.repos.driver.lockSchedule).toHaveBeenCalledWith(conn, 30);
  });

  test('กดเริ่มซ้ำ (3c) → 409 TRIP_ALREADY_STARTED + details trip_id; TX rollback ไม่ insert ซ้ำ', async () => {
    const first = await start(30);
    expect(first.status).toBe(201);
    const again = await start(30);
    expect(again.status).toBe(409);
    expect(again.body.error).toMatchObject({ code: 'TRIP_ALREADY_STARTED', message: ALREADY_STARTED_MSG });
    expect(again.body.error.details).toEqual([{ field: 'trip_id', message: 'trip_id = 100' }]);
    expect(world.repos.driver.insertTrip).toHaveBeenCalledTimes(1);
    expect(conn.rollback).toHaveBeenCalled();
    expect(world.state.trips.filter((t) => t.SCHED_ID === 30)).toHaveLength(1);
  });

  test('404: sched ไม่มีจริง (rollback) + schedId ไม่ใช่ตัวเลข → NOT_FOUND ไม่ leak SQL', async () => {
    const missing = await start(999);
    expect(missing.status).toBe(404);
    expect(missing.body.error).toMatchObject({ code: 'NOT_FOUND', message: NOT_FOUND_MSG });
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();

    const badId = await start('abc');
    expect(badId.status).toBe(404);
    expect(badId.body.error).toMatchObject({ code: 'NOT_FOUND' });
  });

  test('422 NOT_ASSIGNED: รอบไม่มีรถ (33) และรอบไม่มีคนขับ (35) — openapi 422 ทั้งคู่', async () => {
    const noVeh = await start(33);
    expect(noVeh.status).toBe(422);
    expect(noVeh.body.error).toMatchObject({ code: 'NOT_ASSIGNED', message: NOT_ASSIGNED_MSG });

    const noDriver = await start(35);
    expect(noDriver.status).toBe(422);
    expect(noDriver.body.error).toMatchObject({ code: 'NOT_ASSIGNED', message: NOT_ASSIGNED_MSG });
    expect(world.repos.driver.insertTrip).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalled();
  });

  test('403: รอบมอบหมายคนขับอื่น (คนขับ 5 ไปกดรอบ 32 ของคนขับ 6) → FORBIDDEN + rollback', async () => {
    const res = await start(32);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: 'FORBIDDEN', message: FOREIGN_TRIP_MSG });
    expect(world.repos.driver.insertTrip).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalled();
  });

  test('409 TRIP_PENDING (3b): คนขับ 6 มี trip 42 running → เริ่มรอบ 321 ไม่ได้ + details trip_id/sched_id', async () => {
    const token = await tokenFor(app, 'booncho', DRIVER_PASS);
    const res = await start(321, token);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'TRIP_PENDING', message: TRIP_PENDING_MSG });
    expect(res.body.error.details).toEqual([
      { field: 'trip_id', message: 'trip_id = 42' },
      { field: 'sched_id', message: 'sched_id = 32' },
    ]);
    expect(world.repos.driver.insertTrip).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalled();
  });

  test('audit (T-042 ต่อเนื่อง): POST start → sink entry path/method/status/empId; GET ไม่ audit; qr/secret ไม่เข้า path', async () => {
    const getRes = await request(app).get('/api/v1/driver/schedule').set(authHeader(somchai));
    expect(getRes.status).toBe(200);
    await new Promise((r) => setTimeout(r, 30));
    expect(auditSink).not.toHaveBeenCalled();

    const res = await start(30);
    expect(res.status).toBe(201);
    const ok = await waitFor(() => auditSink.mock.calls.some((c) => c[0].path === '/api/v1/driver/trip/30/start'));
    expect(ok).toBe(true);
    const entry = auditSink.mock.calls.map((c) => c[0]).find((e) => e.path === '/api/v1/driver/trip/30/start');
    expect(entry).toMatchObject({ method: 'POST', statusCode: 201, empId: 5 });
    expect(entry.ts).toEqual(expect.any(String));
    expect(entry.durationMs).toEqual(expect.any(Number));
  });
});

// ================================================== T-045 GET /driver/trip/{tripId}/manifest (UC-24)
describe('T-045 GET /api/v1/driver/trip/{tripId}/manifest (UC-24 · LISTAGG · ownership)', () => {
  let world;
  let app;
  let prakai;

  beforeEach(async () => {
    world = createWorld();
    ({ app } = setup(world));
    prakai = await tokenFor(app, 'prakai', DRIVER_PASS);
  });

  test('401; 403 ไม่มี TRIP.START (viewer); 403 ไม่ใช่คนขับของ trip (somchai กับ trip 50); 404 ไม่พบ trip/ไม่ใช่ตัวเลข', async () => {
    const noAuth = await request(app).get('/api/v1/driver/trip/50/manifest');
    expect(noAuth.status).toBe(401);

    const viewer = await tokenFor(app, 'viewer', VIEWER_PASS);
    const guard = await request(app).get('/api/v1/driver/trip/50/manifest').set(authHeader(viewer));
    expect(guard.status).toBe(403);
    expect(guard.body.error).toMatchObject({ code: 'FORBIDDEN', message: GUARD_MSG });

    const foreign = await request(app).get('/api/v1/driver/trip/50/manifest').set(authHeader(await tokenFor(app, 'somchai', DRIVER_PASS)));
    expect(foreign.status).toBe(403);
    expect(foreign.body.error).toMatchObject({ code: 'FORBIDDEN', message: FOREIGN_TRIP_MSG });

    const missing = await request(app).get('/api/v1/driver/trip/999/manifest').set(authHeader(prakai));
    expect(missing.status).toBe(404);
    expect(missing.body.error).toMatchObject({ code: 'NOT_FOUND', message: NOT_FOUND_MSG });

    const badId = await request(app).get('/api/v1/driver/trip/abc/manifest').set(authHeader(prakai));
    expect(badId.status).toBe(404);
  });

  test('200: header 7 ฟิลด์ + stops เรียง stop_seq + รายชื่อ LISTAGG (board/alight) + is_passed ตามเวลาถึง', async () => {
    const res = await request(app).get('/api/v1/driver/trip/50/manifest').set(authHeader(prakai));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(Object.keys(data).sort()).toEqual(
      ['trip_id', 'sched_id', 'route_name', 'plate_no', 'driver_name', 'status', 'stops'].sort(),
    );
    expect(data).toMatchObject({
      trip_id: 50,
      sched_id: 40,
      route_name: 'เส้นทาง 2',
      plate_no: 'สย 2591',
      driver_name: 'ประเสริฐ ขับรถ',
      status: 'running',
    });
    expect(data.stops).toHaveLength(3);
    expect(data.stops.map((s) => s.stop_seq)).toEqual([1, 2, 3]);

    for (const s of data.stops) {
      expect(Object.keys(s).sort()).toEqual(
        ['stop_id', 'stop_name', 'stop_seq', 'arrive_at', 'board_count', 'board_names', 'alight_count', 'alight_names', 'is_passed'].sort(),
      );
    }
    const [s1, s2, s3] = data.stops;
    expect(s1.stop_name).toBe('มหาวิทยาลัยเทคโนโลยีมหานคร');
    expect(s1).toMatchObject({ board_count: 2, alight_count: 0, alight_names: null, is_passed: true });
    expect(s1.board_names).toBe('สมชาย มั่นคง, มานี รักดี'); // WITHIN GROUP ORDER BY last_name (มั่นคง < รักดี)
    expect(s2).toMatchObject({ board_count: 1, board_names: 'มานี รักดี', alight_count: 1, alight_names: 'มานี รักดี', is_passed: true });
    expect(s3).toMatchObject({ board_count: 0, board_names: null, alight_count: 0, alight_names: null, is_passed: false }); // arrive_at ยังไม่ถึง
    expect(s3.arrive_at).toEqual(expect.any(String));
  });

  test('trip ปิดแล้ว (completed) → 200 status=completed (openapi enum อนุญาต) — manifest ไม่ผูกกับ running เท่านั้น', async () => {
    const res = await request(app).get('/api/v1/driver/trip/52/manifest').set(authHeader(prakai));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.stops).toHaveLength(3); // ไม่มีใครขึ้น → counts 0
    expect(res.body.data.stops.every((s) => s.board_count === 0 && s.board_names === null)).toBe(true);
  });

  test('สแกนเช็คอินแล้ว manifest เห็นทันที (booking 40 → stop 1) — ข้อมูลมาจาก trip_passenger จริง', async () => {
    const scan = await request(app)
      .post('/api/v1/driver/trip/scan')
      .set(authHeader(prakai))
      .send({ trip_id: 50, qr_token: 'a'.repeat(32) });
    expect(scan.status).toBe(200);

    const res = await request(app).get('/api/v1/driver/trip/50/manifest').set(authHeader(prakai));
    const s1 = res.body.data.stops[0];
    expect(s1.board_count).toBe(3); // 30, 31 เดิม + 40 ที่เพิ่งเช็คอิน
    expect(s1.board_names).toBe('สมชาย มั่นคง, มานี รักดี, มานี รักดี'); // LISTAGG นับแถว (40 = มานี รักดี ซ้ำชื่อ) เรียง last_name
    expect(s1.board_names.split(', ')).toHaveLength(3);
  });
});

// ================================================== T-046 POST /driver/trip/scan (UC-25 / BR-09)
describe('T-046 POST /api/v1/driver/trip/scan (UC-25 · BR-09 · สแกนซ้ำ atomic)', () => {
  let world;
  let app;
  let conn;
  let auditSink;
  let prakai;

  beforeEach(async () => {
    world = createWorld();
    ({ app, conn, auditSink } = setup(world));
    prakai = await tokenFor(app, 'prakai', DRIVER_PASS);
    auditSink.mockClear();
  });

  const scan = (body, tok = prakai) => request(app).post('/api/v1/driver/trip/scan').set(authHeader(tok)).send(body);
  const tpOf = (bookingId) => world.state.tripPassengers.filter((tp) => tp.tripId === 50 && tp.bookingId === bookingId);
  const bookingOf = (bookingId) => {
    for (const r of world.state.rounds) {
      const b = r.bookings.find((x) => x.BOOKING_ID === bookingId);
      if (b) return b;
    }
    return null;
  };

  test('401; 403 ไม่มี QR.SCAN (viewer); 403 ไม่ใช่คนขับ trip นี้ (somchai); 400 validate qr_token/trip_id', async () => {
    const noAuth = await request(app).post('/api/v1/driver/trip/scan').send({ trip_id: 50, qr_token: 'a'.repeat(32) });
    expect(noAuth.status).toBe(401);

    const viewer = await tokenFor(app, 'viewer', VIEWER_PASS);
    const guard = await scan({ trip_id: 50, qr_token: 'a'.repeat(32) }, viewer);
    expect(guard.status).toBe(403);
    expect(guard.body.error).toMatchObject({ code: 'FORBIDDEN', message: GUARD_MSG });

    const foreign = await scan({ trip_id: 50, qr_token: 'a'.repeat(32) }, await tokenFor(app, 'somchai', DRIVER_PASS));
    expect(foreign.status).toBe(403);
    expect(foreign.body.error).toMatchObject({ code: 'FORBIDDEN', message: FOREIGN_TRIP_MSG });

    const noQr = await scan({ trip_id: 50 });
    expect(noQr.status).toBe(400);
    expect(noQr.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: VALIDATION_TOP });
    expect(noQr.body.error.details).toEqual([{ field: 'qr_token', message: 'is required' }]);

    const badTrip = await scan({ trip_id: 'abc', qr_token: 'a'.repeat(32) });
    expect(badTrip.status).toBe(400);
    expect(badTrip.body.error.details).toEqual([{ field: 'trip_id', message: 'must be integer, got string' }]);

    const longToken = await scan({ trip_id: 50, qr_token: 'x'.repeat(65) });
    expect(longToken.status).toBe(400);
    expect(longToken.body.error.details).toEqual([{ field: 'qr_token', message: 'must be at most 64 characters' }]);
  });

  test('404: trip ไม่มีจริง / qr_token ไม่มีในระบบ → QR_NOT_FOUND ตาม openapi responses', async () => {
    const noTrip = await scan({ trip_id: 999, qr_token: 'a'.repeat(32) });
    expect(noTrip.status).toBe(404);
    expect(noTrip.body.error).toMatchObject({ code: 'NOT_FOUND', message: NOT_FOUND_MSG });

    const noQr = await scan({ trip_id: 50, qr_token: 'z'.repeat(32) });
    expect(noQr.status).toBe(404);
    expect(noQr.body.error).toMatchObject({ code: 'QR_NOT_FOUND', message: QR_NOT_FOUND_MSG });
    expect(conn.rollback).toHaveBeenCalled(); // TX lock คืน null → rollback ไม่ค้าง
  });

  test('409 TRIP_NOT_RUNNING: trip ปิดแล้วของคนขับตัวเอง → ไม่รับสแกน (UC-25 precondition)', async () => {
    const res = await scan({ trip_id: 52, qr_token: 'a'.repeat(32) });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'TRIP_NOT_RUNNING', message: TRIP_NOT_RUNNING_MSG });
  });

  test('4b BR-09 (TC-25-01): QR ของรอบอื่น (booking 41 · sched 41) สแกนกับ trip 50 → wrong_trip ห้ามขึ้นรถ + ไม่แก้สถานะ/ไม่แทรก trip_passenger', async () => {
    const res = await scan({ trip_id: 50, qr_token: 'b'.repeat(32) });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      result: 'wrong_trip',
      message: WRONG_TRIP_MSG,
      booking_code: 'BK41',
      passenger_name: 'มานี รักดี',
    });
    expect(bookingOf(41).STATUS).toBe('reserved');
    expect(tpOf(41)).toHaveLength(0);
    expect(conn.commit).toHaveBeenCalledTimes(1); // ตอบ 200 แล้ว commit (ไม่ค้าง lock)
  });

  test('4c: booking ยกเลิกแล้ว (รอบเดียวกัน) → result cancelled + สถานะเดิมคงอยู่', async () => {
    const res = await scan({ trip_id: 50, qr_token: 'c'.repeat(32) });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      result: 'cancelled',
      message: CANCELLED_MSG,
      booking_code: 'BK42',
      passenger_name: 'สมชาย มั่นคง',
    });
    expect(bookingOf(42).STATUS).toBe('cancelled');
    expect(tpOf(42)).toHaveLength(0);
  });

  test('4d ASM-07-3: เคยเช็คอินแล้ว (booking 43) → already_checked_in + checkin_time เดิม + ไม่แทรกแถวซ้ำ', async () => {
    const before = tpOf(43).length;
    const res = await scan({ trip_id: 50, qr_token: 'd'.repeat(32) });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      result: 'already_checked_in',
      message: ALREADY_CHECKED_MSG,
      booking_id: 43,
      booking_code: 'BK43',
      passenger_name: 'มานี รักดี',
      checkin_time: expect.any(String),
    });
    expect(res.body.data).not.toHaveProperty('seats');
    expect(tpOf(43)).toHaveLength(before);
    expect(conn.rollback).not.toHaveBeenCalled();
  });

  test('4a: booking reserved → checked_in + insert trip_passenger (checkin_stop=จุดจอง, board_seq=ลำดับจุด) + commit', async () => {
    const res = await scan({ trip_id: 50, qr_token: 'a'.repeat(32) });
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(Object.keys(data).sort()).toEqual(
      ['result', 'message', 'booking_id', 'booking_code', 'passenger_name', 'seats', 'checkin_time', 'board_seq'].sort(),
    );
    expect(data).toMatchObject({
      result: 'checked_in',
      message: CHECKED_IN_MSG,
      booking_id: 40,
      booking_code: 'BK40',
      passenger_name: 'มานี รักดี',
      seats: 2,
      board_seq: 1,
      checkin_time: expect.any(String),
    });
    expect(bookingOf(40).STATUS).toBe('checked_in');
    expect(tpOf(40)).toHaveLength(1);
    expect(tpOf(40)[0]).toMatchObject({ checkinStopId: 1, boardSeq: 1 });
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    // atomic: lock (FOR UPDATE) → update → insert ภายใน tx เดียว
    expect(world.repos.driver.lockBookingByQr).toHaveBeenCalledWith(conn, 'a'.repeat(32), 50);
    expect(world.repos.driver.updateCheckin).toHaveBeenCalledWith(conn, 40);
    expect(world.repos.driver.insertTripPassenger).toHaveBeenCalledWith(conn, {
      tripId: 50,
      bookingId: 40,
      checkinStopId: 1,
      boardSeq: 1,
    });
    expect(world.repos.driver.lockBookingByQr.mock.invocationCallOrder[0]).toBeLessThan(
      world.repos.driver.updateCheckin.mock.invocationCallOrder[0],
    );
  });

  test('สแกนซ้ำ QR เดิมทันที (ASM-07-3) → already_checked_in และ trip_passenger ยัง 1 แถว (atomic ผ่าน FOR UPDATE)', async () => {
    const first = await scan({ trip_id: 50, qr_token: 'a'.repeat(32) });
    expect(first.body.data.result).toBe('checked_in');
    const second = await scan({ trip_id: 50, qr_token: 'a'.repeat(32) });
    expect(second.status).toBe(200);
    expect(second.body.data).toMatchObject({ result: 'already_checked_in', message: ALREADY_CHECKED_MSG, booking_id: 40 });
    expect(second.body.data.checkin_time).toEqual(expect.any(String));
    expect(tpOf(40)).toHaveLength(1);
    expect(conn.commit).toHaveBeenCalledTimes(2);
  });

  test('checkin_stop_id ที่ส่งมาแทนค่าจองได้ ( booking 45 จุดขึ้น 1 → ส่ง 4 ) → board_seq ของจุด 4 = 3', async () => {
    const res = await scan({ trip_id: 50, qr_token: 'e'.repeat(32), checkin_stop_id: 4 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ result: 'checked_in', booking_id: 45, board_seq: 3 });
    expect(tpOf(45)).toHaveLength(1);
    expect(tpOf(45)[0]).toMatchObject({ checkinStopId: 4, boardSeq: 3 });
  });

  test('insert trip_passenger ล้มเหลว → 500 + rollback ทั้ง TX: booking ยัง reserved ไม่มีสถานะครึ่ง ๆ กลาง ๆ', async () => {
    world.repos.driver.insertTripPassenger.mockRejectedValueOnce(new Error('insert failed'));
    const res = await scan({ trip_id: 50, qr_token: 'a'.repeat(32) });
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
    expect(bookingOf(40).STATUS).toBe('reserved'); // ไม่ถูกเช็คอินครึ่งทาง
    expect(tpOf(40)).toHaveLength(0);
  });

  test('audit: scan (POST) → entry path/method/empId และไม่มี qr_token หลุดเข้าไปใน entry', async () => {
    const res = await scan({ trip_id: 50, qr_token: 'a'.repeat(32) });
    expect(res.status).toBe(200);
    const ok = await waitFor(() => auditSink.mock.calls.some((c) => c[0].path === '/api/v1/driver/trip/scan'));
    expect(ok).toBe(true);
    const entry = auditSink.mock.calls.map((c) => c[0]).find((e) => e.path === '/api/v1/driver/trip/scan');
    expect(entry).toMatchObject({ method: 'POST', statusCode: 200, empId: 8 });
    expect(JSON.stringify(entry)).not.toContain('a'.repeat(32));
  });
});

// ================================================== repository SQL (bind variables / LISTAGG / FOR UPDATE)
describe('driver repository SQL: bind variables เท่านั้น + FOR UPDATE (ไม่ NOWAIT) + LISTAGG', () => {
  beforeEach(() => {
    dbMock.query.mockReset();
  });

  test('listMyRounds: driver_assign JOIN + TRUNC(SYSDATE) default + passenger_count = reserved — empId/serviceDate เป็น bind', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [] });
    await driverRepo.listMyRounds({ empId: 555, serviceDate: null });
    const [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).toContain('FROM driver_assign');
    expect(sql).toContain('JOIN schedule');
    expect(sql).toContain('TRUNC(SYSDATE)');
    expect(sql).toContain("b.status = 'reserved'");
    expect(sql).toContain('pending_trip_id');
    expect(sql).toContain(':empId');
    expect(sql).toContain(':serviceDate');
    expect(sql).not.toContain('555'); // ไม่ต่อค่าลง SQL
    expect(binds).toEqual({ empId: 555, serviceDate: null });

    dbMock.query.mockResolvedValueOnce({ rows: [] });
    await driverRepo.listMyRounds({ empId: 7, serviceDate: '2027-01-01' });
    const [sql2, binds2] = dbMock.query.mock.calls[1];
    expect(sql2).toContain('TO_DATE(:serviceDate, \'YYYY-MM-DD\')');
    expect(sql2).not.toContain('2027-01-01');
    expect(binds2).toEqual({ empId: 7, serviceDate: '2027-01-01' });
  });

  test('lockSchedule: SELECT ... FOR UPDATE (blocking ตาม x-transaction) ไม่ใช่ NOWAIT + bind schedId', async () => {
    const conn = { execute: jest.fn(async () => ({ rows: [{ SCHED_ID: 30 }] })) };
    await driverRepo.lockSchedule(conn, 333);
    const [sql, binds] = conn.execute.mock.calls[0];
    expect(sql).toContain('FROM schedule');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).not.toContain('NOWAIT');
    expect(sql).not.toContain('333');
    expect(binds).toEqual({ schedId: 333 });
  });

  test('insertTrip: INSERT + RETURNING — sched/driver/veh ทุกตัวเป็น bind ไม่มีค่าฝังใน SQL', async () => {
    const conn = { execute: jest.fn(async () => ({ outBinds: { newId: 101 } })) };
    const id = await driverRepo.insertTrip(conn, { schedId: 4444, driverId: 5555, vehId: 6666 });
    expect(id).toBe(101);
    const [sql, binds] = conn.execute.mock.calls[0];
    expect(sql).toContain('INSERT INTO trip');
    expect(sql).toContain('RETURNING trip_id');
    expect(sql).toContain('SYSTIMESTAMP');
    expect(sql).not.toContain('4444');
    expect(sql).not.toContain('5555');
    expect(sql).not.toContain('6666');
    expect(binds).toMatchObject({ schedId: 4444, driverId: 5555, vehId: 6666 });
  });

  test('lockBookingByQr: FOR UPDATE แถว booking + qr_token/tripId เป็น bind (ห้าม token ลง SQL — ASM-07-3/sanitizer)', async () => {
    const token = 'f00d'.repeat(8);
    const conn = { execute: jest.fn(async () => ({ rows: [] })) };
    await driverRepo.lockBookingByQr(conn, token, 777);
    const [sql, binds] = conn.execute.mock.calls[0];
    expect(sql).toContain('FROM booking');
    expect(sql).toContain('FOR UPDATE OF b.booking_id');
    expect(sql).toContain(':qrToken');
    expect(sql).toContain(':tripId');
    expect(sql).not.toContain('f00df00d'); // ไม่ต่อ token ลง SQL
    expect(sql).not.toContain('777');
    expect(binds).toEqual({ qrToken: token, tripId: 777 });
  });

  test('findManifestStops: LISTAGG + WITHIN GROUP (ORDER BY last_name) + ORDER BY stop_seq + bind tripId', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [] });
    await driverRepo.findManifestStops(777);
    const [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).toContain('LISTAGG');
    expect(sql).toContain('WITHIN GROUP (ORDER BY e.last_name)');
    expect(sql).toContain('ORDER BY ss.stop_seq');
    expect(sql).toContain('checkin_time IS NOT NULL');
    expect(sql).toContain('alight_time IS NOT NULL');
    expect(sql).not.toContain('777');
    expect(binds).toEqual({ tripId: 777 });
  });

  test('updateCheckin/insertTripPassenger: ค่า status เป็น literal ตาม contract แต่ id ทุกตัวเป็น bind', async () => {
    const conn = { execute: jest.fn(async () => ({ rowsAffected: 1 })) };
    await driverRepo.updateCheckin(conn, 8888);
    const [uSql, uBinds] = conn.execute.mock.calls[0];
    expect(uSql).toContain("status = 'checked_in'");
    expect(uSql).not.toContain('8888');
    expect(uBinds).toEqual({ bookingId: 8888 });

    await driverRepo.insertTripPassenger(conn, { tripId: 1111, bookingId: 2222, checkinStopId: 3333, boardSeq: 4 });
    const [iSql, iBinds] = conn.execute.mock.calls[1];
    expect(iSql).toContain('INSERT INTO trip_passenger');
    expect(iSql).toContain('SYSTIMESTAMP');
    expect(iSql).not.toContain('1111');
    expect(iSql).not.toContain('2222');
    expect(iBinds).toEqual({ tripId: 1111, bookingId: 2222, checkinStopId: 3333, boardSeq: 4 });
  });
});
