// backend/tests/sprint07.test.js — Sprint 7 (T-029 / T-030 / T-031 / T-032) regression tests
// ครอบคลุม: Vehicle GET/POST (UC-13), Schedule CRUD + auto-generate schedule_stop (BR-02, UC-14),
//           Driver/Vehicle assignment + conflict check แบบ overlap จริง + FOR UPDATE locking (BR-04, UC-15/16)
//           ทุก endpoint คุม VEH.EDIT / ROUTE.VIEW / SCHED.EDIT (โหลดจาก DB ทุก request)
// ไม่มี: PUT /schedules/{id} (Q23 ยังค้าง — มี test ยืนยัน 404) · PUT/DELETE /vehicles/{id} · /vehicle-types CRUD
//        (17.5.2/openapi ไม่ประกาศ)
// สถาปัตยกรรม: inject fake repos + fake connection เข้า createApp (ไม่แตะ Oracle จริง)
//               transaction runner / SQL ของ repository เป็นโค้ดจริงที่ assert ผ่าน spy

process.env.JWT_SECRET = 'sprint07-test-secret-0123456789abcdef0123456789abcdef';
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
const vehicleRepo = require('../src/repositories/vehicle.repository');
const scheduleRepo = require('../src/repositories/schedule.repository');

const ADMIN_PASS = 'AdminPass123';
const VIEWER_PASS = 'ViewerPass123';
const OUTSIDER_PASS = 'OutsiderPass123';

const DUP_PLATE = 'ทะเบียนรถนี้มีอยู่แล้ว';
const VTYPE_REF = 'ข้อมูลอ้างอิงไม่ถูกต้อง (ไม่พบประเภทรถที่ระบุ)';
const NOT_A_DRIVER = 'พนักงานคนนี้ไม่ได้มีบทบาท DRIVER';
const VEHICLE_INACTIVE = 'รถคันนี้ถูกปิดใช้งานอยู่';
const DRIVER_CONFLICT_MSG = 'คนขับคนนี้ชนกับรอบเวลาอื่นอยู่';
const VEHICLE_CONFLICT_MSG = 'รถคันนี้ถูกมอบหมายในรอบเวลาที่ทับกันอยู่';
const DRIVER_ALREADY = 'คนขับคนนี้ถูกรอบนี้มอบหมายอยู่แล้ว';
const VEHICLE_ALREADY = 'รอบนี้มีรถมอบหมายอยู่แล้ว';
const INCOMPLETE = 'กรุณาเรียงจุดจอดของเส้นทางให้ครบก่อนสร้างรอบเวลา';
const CONFLICT_DETAIL = 'ชนกับรอบ 10 วันที่ 2026-10-02 เวลา 09:30-09:39';

// ---------------------------------------------------------------- fake world
function createWorld() {
  const profiles = new Map();
  const credentials = new Map();
  const permissions = new Map();
  const menus = new Map();
  const roles = new Map();
  const revoked = [];

  const stops = [
    { STOP_ID: 1, STOP_NAME: 'มหาวิทยาลัยเทคโนโลยีมหานคร', ADDRESS: null, LATITUDE: null, LONGITUDE: null, IS_ACTIVE: 1 },
    { STOP_ID: 2, STOP_NAME: 'โลตัสหนองจอก', ADDRESS: null, LATITUDE: null, LONGITUDE: null, IS_ACTIVE: 1 },
    { STOP_ID: 4, STOP_NAME: 'ร้านส้มตำปูนาง', ADDRESS: null, LATITUDE: null, LONGITUDE: null, IS_ACTIVE: 1 },
  ];

  // route2 = ปกติ (total 9 = sum 0+5+4) · route3 = ไม่มีจุดจอด · route4 = total เก่า (99 ≠ 9)
  // route5 = ลำดับขาด (1,3) — ใช้ทดสอบ422 ของ POST /schedules
  const routes = [
    { ROUTE_ID: 2, ROUTE_NAME: 'เส้นทางที่ 2', TOTAL_MINUTES: 9, DESCRIPTION: null, IS_ACTIVE: 1 },
    { ROUTE_ID: 3, ROUTE_NAME: 'เส้นทางที่ 3', TOTAL_MINUTES: 15, DESCRIPTION: null, IS_ACTIVE: 0 },
    { ROUTE_ID: 4, ROUTE_NAME: 'เส้นทางยอดเก่า', TOTAL_MINUTES: 99, DESCRIPTION: null, IS_ACTIVE: 1 },
    { ROUTE_ID: 5, ROUTE_NAME: 'เส้นทางลำดับขาด', TOTAL_MINUTES: 6, DESCRIPTION: null, IS_ACTIVE: 1 },
  ];

  const routeStops = new Map([
    [
      2,
      [
        { ROUTE_ID: 2, STOP_ID: 1, STOP_SEQ: 1, TRAVEL_MINUTES: 0 },
        { ROUTE_ID: 2, STOP_ID: 2, STOP_SEQ: 2, TRAVEL_MINUTES: 5 },
        { ROUTE_ID: 2, STOP_ID: 4, STOP_SEQ: 3, TRAVEL_MINUTES: 4 },
      ],
    ],
    [3, []],
    [
      4,
      [
        { ROUTE_ID: 4, STOP_ID: 1, STOP_SEQ: 1, TRAVEL_MINUTES: 0 },
        { ROUTE_ID: 4, STOP_ID: 2, STOP_SEQ: 2, TRAVEL_MINUTES: 5 },
        { ROUTE_ID: 4, STOP_ID: 4, STOP_SEQ: 3, TRAVEL_MINUTES: 4 },
      ],
    ],
    [
      5,
      [
        { ROUTE_ID: 5, STOP_ID: 1, STOP_SEQ: 1, TRAVEL_MINUTES: 3 },
        { ROUTE_ID: 5, STOP_ID: 2, STOP_SEQ: 3, TRAVEL_MINUTES: 3 },
      ],
    ],
  ]);

  const vehicleTypes = [
    { VTYPE_ID: 1, VTYPE_NAME: 'รถตู้ 9 ที่นั่ง', CAPACITY: 9 },
    { VTYPE_ID: 2, VTYPE_NAME: 'รถบัส 15 ที่นั่ง', CAPACITY: 15 },
  ];
  const vehicles = [
    { VEH_ID: 1, PLATE_NO: 'สย 2591', VTYPE_ID: 1, IS_ACTIVE: 1 },
    { VEH_ID: 2, PLATE_NO: 'สย 2592', VTYPE_ID: 1, IS_ACTIVE: 1 },
    { VEH_ID: 3, PLATE_NO: 'กข 3333', VTYPE_ID: 2, IS_ACTIVE: 0 },
  ];

  // รอบ 10: มีคนขับ emp5 + รถ veh1 + booking (จอง 3 ที่นั่ง · ยกเลิกรวมอีก 2 ไม่นับ BR-07)
  // รอบ 11: [09:35,09:44] ทับรอบ 10 · รอบ 12: [09:39,09:48] ชนชิดขอบ (boundary)
  // รอบ 13: ว่าง + วันอื่น · รอบ 14: ปิดใช้ + route3
  const schedules = [
    { SCHED_ID: 10, ROUTE_ID: 2, SERVICE_DATE: '2026-10-02', DEPART_AT: new Date('2026-10-02T09:30:00.000Z'), IS_ACTIVE: 1 },
    { SCHED_ID: 11, ROUTE_ID: 2, SERVICE_DATE: '2026-10-02', DEPART_AT: new Date('2026-10-02T09:35:00.000Z'), IS_ACTIVE: 1 },
    { SCHED_ID: 12, ROUTE_ID: 2, SERVICE_DATE: '2026-10-02', DEPART_AT: new Date('2026-10-02T09:39:00.000Z'), IS_ACTIVE: 1 },
    { SCHED_ID: 13, ROUTE_ID: 2, SERVICE_DATE: '2026-10-05', DEPART_AT: new Date('2026-10-05T11:00:00.000Z'), IS_ACTIVE: 1 },
    { SCHED_ID: 14, ROUTE_ID: 3, SERVICE_DATE: '2026-10-06', DEPART_AT: new Date('2026-10-06T13:00:00.000Z'), IS_ACTIVE: 0 },
  ];

  const scheduleStops = new Map([
    [
      10,
      [
        { SCHED_STOP_ID: 100, SCHED_ID: 10, STOP_ID: 1, STOP_SEQ: 1, ARRIVE_AT: new Date('2026-10-02T09:30:00.000Z'), DWELL_MINUTES: 0 },
        { SCHED_STOP_ID: 101, SCHED_ID: 10, STOP_ID: 2, STOP_SEQ: 2, ARRIVE_AT: new Date('2026-10-02T09:35:00.000Z'), DWELL_MINUTES: 0 },
        { SCHED_STOP_ID: 102, SCHED_ID: 10, STOP_ID: 4, STOP_SEQ: 3, ARRIVE_AT: new Date('2026-10-02T09:39:00.000Z'), DWELL_MINUTES: 0 },
      ],
    ],
  ]);

  const driverAssigns = [{ ASSIGN_ID: 201, SCHED_ID: 10, EMP_ID: 5, ASSIGN_AT: new Date('2026-09-28T01:00:00.000Z') }];
  const vehicleAssigns = [{ ASSIGN_ID: 401, SCHED_ID: 10, VEH_ID: 1, ASSIGN_AT: new Date('2026-09-28T01:05:00.000Z') }];
  const bookings = [
    { BOOKING_ID: 1, SCHED_ID: 10, SEATS: 2, STATUS: 'reserved' },
    { BOOKING_ID: 2, SCHED_ID: 10, SEATS: 1, STATUS: 'reserved' },
    { BOOKING_ID: 3, SCHED_ID: 10, SEATS: 2, STATUS: 'cancelled' },
  ];

  let nextStopId = 50;
  let nextRouteId = 60;
  let nextVehicleId = 50;
  let nextSchedId = 70;
  let nextSchedStopId = 500;
  let nextDriverAssignId = 300;
  let nextVehicleAssignId = 400;

  function withStopName(rows) {
    return rows.map((row) => {
      const stop = stops.find((s) => s.STOP_ID === row.STOP_ID);
      return { ...row, STOP_NAME: stop ? stop.STOP_NAME : null };
    });
  }

  function withVehicleType(vehicleRow) {
    const vtype = vehicleTypes.find((t) => t.VTYPE_ID === vehicleRow.VTYPE_ID);
    return { ...vehicleRow, VTYPE_NAME: vtype ? vtype.VTYPE_NAME : null, CAPACITY: vtype ? vtype.CAPACITY : null };
  }

  // แถวรูปเดียวกับ SCHEDULE_SELECT (join route + driver คนแรก + รถ + seats_reserved)
  function joinedSchedule(sched) {
    const route = routes.find((r) => r.ROUTE_ID === sched.ROUTE_ID);
    const stopsOfSched = scheduleStops.get(sched.SCHED_ID) || [];
    const driver = driverAssigns
      .filter((d) => d.SCHED_ID === sched.SCHED_ID)
      .sort((a, b) => a.ASSIGN_ID - b.ASSIGN_ID)[0];
    const profile = driver ? profiles.get(driver.EMP_ID) : null;
    const assign = vehicleAssigns
      .filter((v) => v.SCHED_ID === sched.SCHED_ID)
      .sort((a, b) => a.ASSIGN_ID - b.ASSIGN_ID)[0];
    const vehicleRow = assign ? vehicles.find((v) => v.VEH_ID === assign.VEH_ID) : null;
    const vtype = vehicleRow ? vehicleTypes.find((t) => t.VTYPE_ID === vehicleRow.VTYPE_ID) : null;
    const reserved = bookings
      .filter((b) => b.SCHED_ID === sched.SCHED_ID && b.STATUS === 'reserved')
      .reduce((sum, b) => sum + b.SEATS, 0);
    return {
      SCHED_ID: sched.SCHED_ID,
      ROUTE_ID: sched.ROUTE_ID,
      ROUTE_NAME: route ? route.ROUTE_NAME : null,
      SERVICE_DATE: sched.SERVICE_DATE,
      DEPART_AT: sched.DEPART_AT,
      IS_ACTIVE: sched.IS_ACTIVE,
      TOTAL_MINUTES: route ? Number(route.TOTAL_MINUTES) : 0,
      STOP_COUNT: stopsOfSched.length,
      DRIVER_EMP_ID: driver ? driver.EMP_ID : null,
      DRIVER_FIRST_NAME: profile ? profile.FIRST_NAME : null,
      DRIVER_LAST_NAME: profile ? profile.LAST_NAME : null,
      VEH_ID: vehicleRow ? vehicleRow.VEH_ID : null,
      PLATE_NO: vehicleRow ? vehicleRow.PLATE_NO : null,
      VTYPE_NAME: vtype ? vtype.VTYPE_NAME : null,
      CAPACITY: vtype ? vtype.CAPACITY : null,
      SEATS_RESERVED: reserved,
    };
  }

  function conflictRow(sched) {
    const route = routes.find((r) => r.ROUTE_ID === sched.ROUTE_ID);
    return {
      SCHED_ID: sched.SCHED_ID,
      SERVICE_DATE: sched.SERVICE_DATE,
      DEPART_AT: sched.DEPART_AT,
      TOTAL_MINUTES: route ? Number(route.TOTAL_MINUTES) : 0,
    };
  }

  function filterSchedules({ routeId, from, to, isActive } = {}) {
    return schedules
      .filter((s) => (routeId === undefined || routeId === null ? true : s.ROUTE_ID === Number(routeId)))
      .filter((s) => (from ? s.SERVICE_DATE >= from : true))
      .filter((s) => (to ? s.SERVICE_DATE <= to : true))
      .filter((s) => (isActive === undefined || isActive === null ? true : s.IS_ACTIVE === Number(isActive)))
      .sort((a, b) => a.SERVICE_DATE.localeCompare(b.SERVICE_DATE) || a.DEPART_AT - b.DEPART_AT || a.SCHED_ID - b.SCHED_ID);
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
      CREATED_AT: new Date('2026-01-05T08:00:00.000Z'),
      ROLES: (o.roles || []).join(','),
    };
    profiles.set(row.EMP_ID, row);
    credentials.set(row.EMP_ID, {
      EMP_ID: row.EMP_ID,
      USERNAME: row.USERNAME,
      PASSWORD_HASH: o.passwordHash,
      IS_ACTIVE: 1,
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
    },
    stop: {
      list: jest.fn(async () => stops.slice()),
      count: jest.fn(async () => stops.length),
      findById: jest.fn(async (stopId) => stops.find((s) => s.STOP_ID === Number(stopId)) || null),
      findByName: jest.fn(async () => null),
      insert: jest.fn(async () => nextStopId++),
      update: jest.fn(async () => 1),
      remove: jest.fn(async () => 1),
      countRoutesUsingStop: jest.fn(async () => 0),
      findExistingIds: jest.fn(async (stopIds) =>
        stops.filter((s) => stopIds.includes(s.STOP_ID)).map((s) => ({ STOP_ID: s.STOP_ID })),
      ),
    },
    route: {
      list: jest.fn(async () => routes.map((r) => ({ ...r, STOP_COUNT: (routeStops.get(r.ROUTE_ID) || []).length }))),
      count: jest.fn(async () => routes.length),
      findById: jest.fn(async (routeId) => routes.find((r) => r.ROUTE_ID === Number(routeId)) || null),
      insert: jest.fn(async () => nextRouteId++),
      listStops: jest.fn(async (routeId) =>
        withStopName((routeStops.get(Number(routeId)) || []).slice().sort((a, b) => a.STOP_SEQ - b.STOP_SEQ)),
      ),
      countStops: jest.fn(async (routeId) => (routeStops.get(Number(routeId)) || []).length),
      deleteAllStops: jest.fn(async () => 0),
      insertStop: jest.fn(async () => 1),
      updateTotalMinutes: jest.fn(async () => 1),
      recalculateTotal: jest.fn(async () => 0),
    },
    vehicle: {
      list: jest.fn(async ({ isActive, vtypeId, limit, offset } = {}) =>
        vehicles
          .filter((v) => (isActive === undefined || isActive === null ? true : v.IS_ACTIVE === Number(isActive)))
          .filter((v) => (vtypeId === undefined || vtypeId === null ? true : v.VTYPE_ID === Number(vtypeId)))
          .slice(offset, offset + limit)
          .map(withVehicleType),
      ),
      count: jest.fn(
        async ({ isActive, vtypeId } = {}) =>
          vehicles
            .filter((v) => (isActive === undefined || isActive === null ? true : v.IS_ACTIVE === Number(isActive)))
            .filter((v) => (vtypeId === undefined || vtypeId === null ? true : v.VTYPE_ID === Number(vtypeId)))
            .length,
      ),
      findById: jest.fn(async (vehId) => {
        const row = vehicles.find((v) => v.VEH_ID === Number(vehId));
        return row ? withVehicleType(row) : null;
      }),
      findByPlate: jest.fn(async (plateNo) => vehicles.find((v) => v.PLATE_NO === plateNo) || null),
      findVtype: jest.fn(async (vtypeId) => vehicleTypes.find((t) => t.VTYPE_ID === Number(vtypeId)) || null),
      insert: jest.fn(async (conn, payload) => {
        const vehId = nextVehicleId;
        nextVehicleId += 1;
        vehicles.push({ VEH_ID: vehId, PLATE_NO: payload.plateNo, VTYPE_ID: payload.vtypeId, IS_ACTIVE: payload.isActive });
        return vehId;
      }),
      lockById: jest.fn(async (conn, vehId) => {
        const row = vehicles.find((v) => v.VEH_ID === Number(vehId));
        if (!row) return null;
        return { VEH_ID: row.VEH_ID, PLATE_NO: row.PLATE_NO, VTYPE_ID: row.VTYPE_ID, IS_ACTIVE: row.IS_ACTIVE };
      }),
    },
    schedule: {
      list: jest.fn(async ({ routeId, from, to, isActive, limit, offset } = {}) =>
        filterSchedules({ routeId, from, to, isActive }).slice(offset, offset + limit).map(joinedSchedule),
      ),
      count: jest.fn(async (filters = {}) => filterSchedules(filters).length),
      findById: jest.fn(async (schedId) => {
        const row = schedules.find((s) => s.SCHED_ID === Number(schedId));
        return row ? joinedSchedule(row) : null;
      }),
      findStops: jest.fn(async (schedId) =>
        withStopName((scheduleStops.get(Number(schedId)) || []).slice().sort((a, b) => a.STOP_SEQ - b.STOP_SEQ)),
      ),
      findDuplicate: jest.fn(
        async (routeId, departAt) =>
          schedules.find((s) => s.ROUTE_ID === Number(routeId) && s.DEPART_AT.getTime() === departAt.getTime()) || null,
      ),
      countBookings: jest.fn(async (schedId) => bookings.filter((b) => b.SCHED_ID === Number(schedId)).length),
      countDriverAssigns: jest.fn(async (schedId) => driverAssigns.filter((d) => d.SCHED_ID === Number(schedId)).length),
      countVehicleAssigns: jest.fn(async (schedId) => vehicleAssigns.filter((v) => v.SCHED_ID === Number(schedId)).length),
      insert: jest.fn(async (conn, payload) => {
        const schedId = nextSchedId;
        nextSchedId += 1;
        schedules.push({
          SCHED_ID: schedId,
          ROUTE_ID: Number(payload.routeId),
          SERVICE_DATE: payload.serviceDate,
          DEPART_AT: payload.departAt,
          IS_ACTIVE: payload.isActive,
        });
        return schedId;
      }),
      insertStop: jest.fn(async (conn, { schedId, stopId, stopSeq, departAt, offsetMin }) => {
        const rows = scheduleStops.get(Number(schedId)) || [];
        rows.push({
          SCHED_STOP_ID: nextSchedStopId,
          SCHED_ID: Number(schedId),
          STOP_ID: Number(stopId),
          STOP_SEQ: Number(stopSeq),
          ARRIVE_AT: new Date(departAt.getTime() + Number(offsetMin) * 60000),
          DWELL_MINUTES: 0,
        });
        nextSchedStopId += 1;
        scheduleStops.set(Number(schedId), rows);
        return 1;
      }),
      deleteById: jest.fn(async (conn, schedId) => {
        const idx = schedules.findIndex((s) => s.SCHED_ID === Number(schedId));
        if (idx >= 0) schedules.splice(idx, 1);
        scheduleStops.delete(Number(schedId));
        return 1;
      }),
      lockSchedule: jest.fn(async (conn, schedId) => {
        const row = schedules.find((s) => s.SCHED_ID === Number(schedId));
        if (!row) return null;
        return {
          SCHED_ID: row.SCHED_ID,
          ROUTE_ID: row.ROUTE_ID,
          SERVICE_DATE: row.SERVICE_DATE,
          DEPART_AT: row.DEPART_AT,
          IS_ACTIVE: row.IS_ACTIVE,
        };
      }),
      lockEmployee: jest.fn(async (conn, empId) => profiles.get(Number(empId)) || null),
      isDriver: jest.fn(async (conn, empId) => (roles.get(Number(empId)) || []).includes('DRIVER')),
      findDriverConflicts: jest.fn(async (conn, empId, excludeSchedId) =>
        driverAssigns
          .filter((d) => d.EMP_ID === Number(empId) && d.SCHED_ID !== Number(excludeSchedId))
          .map((d) => schedules.find((s) => s.SCHED_ID === d.SCHED_ID))
          .filter(Boolean)
          .map(conflictRow),
      ),
      findVehicleConflicts: jest.fn(async (conn, vehId, excludeSchedId) =>
        vehicleAssigns
          .filter((v) => v.VEH_ID === Number(vehId) && v.SCHED_ID !== Number(excludeSchedId))
          .map((v) => schedules.find((s) => s.SCHED_ID === v.SCHED_ID))
          .filter(Boolean)
          .map(conflictRow),
      ),
      countDriverAssignment: jest.fn(
        async (conn, schedId, empId) =>
          driverAssigns.some((d) => d.SCHED_ID === Number(schedId) && d.EMP_ID === Number(empId)),
      ),
      countVehicleAssignment: jest.fn(async (conn, schedId) => vehicleAssigns.some((v) => v.SCHED_ID === Number(schedId))),
      insertDriverAssign: jest.fn(async (conn, { schedId, empId }) => {
        const assignId = nextDriverAssignId;
        nextDriverAssignId += 1;
        driverAssigns.push({ ASSIGN_ID: assignId, SCHED_ID: Number(schedId), EMP_ID: Number(empId), ASSIGN_AT: new Date() });
        return assignId;
      }),
      insertVehicleAssign: jest.fn(async (conn, { schedId, vehId }) => {
        const assignId = nextVehicleAssignId;
        nextVehicleAssignId += 1;
        vehicleAssigns.push({ ASSIGN_ID: assignId, SCHED_ID: Number(schedId), VEH_ID: Number(vehId), ASSIGN_AT: new Date() });
        return assignId;
      }),
      deleteDriverAssigns: jest.fn(async (conn, schedId) => {
        const before = driverAssigns.length;
        for (let i = driverAssigns.length - 1; i >= 0; i -= 1) {
          if (driverAssigns[i].SCHED_ID === Number(schedId)) driverAssigns.splice(i, 1);
        }
        return before - driverAssigns.length;
      }),
      deleteVehicleAssigns: jest.fn(async (conn, schedId) => {
        const before = vehicleAssigns.length;
        for (let i = vehicleAssigns.length - 1; i >= 0; i -= 1) {
          if (vehicleAssigns[i].SCHED_ID === Number(schedId)) vehicleAssigns.splice(i, 1);
        }
        return before - vehicleAssigns.length;
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
    permissions: ['ROUTE.VIEW', 'ROUTE.EDIT', 'VEH.EDIT', 'SCHED.EDIT', 'EMP.VIEW'],
    menus: [{ SCREEN_KEY: 'SCHED_GRID', MENU_LABEL: 'ตารางเวลา', SORT_NO: 23 }],
  });
  addEmployee({
    empId: 2,
    username: 'viewer',
    empCode: 'EMP002',
    firstName: 'วิว',
    lastName: 'ผู้ชม',
    passwordHash: bcrypt.hashSync(VIEWER_PASS, 4),
    roles: ['STAFF'],
    permissions: ['ROUTE.VIEW'],
    menus: [{ SCREEN_KEY: 'ROUTE_LIST', MENU_LABEL: 'เส้นทาง', SORT_NO: 20 }],
  });
  addEmployee({
    empId: 3,
    username: 'outsider',
    empCode: 'EMP003',
    firstName: 'นอก',
    lastName: 'กลุ่ม',
    passwordHash: bcrypt.hashSync(OUTSIDER_PASS, 4),
    roles: ['STAFF'],
    permissions: ['EMP.VIEW'],
    menus: [],
  });
  addEmployee({
    empId: 5,
    username: 'somchai',
    empCode: 'EMP005',
    firstName: 'สมชาย',
    lastName: 'ขับรถ',
    passwordHash: bcrypt.hashSync('DriverPass123', 4),
    roles: ['DRIVER'],
    permissions: [],
    menus: [],
  });
  addEmployee({
    empId: 6,
    username: 'sompet',
    empCode: 'EMP006',
    firstName: 'สมพิธ',
    lastName: 'พนักงาน',
    passwordHash: bcrypt.hashSync('StaffPass123', 4),
    roles: ['STAFF'],
    permissions: [],
    menus: [],
  });

  return {
    repos,
    state: {
      profiles,
      credentials,
      permissions,
      menus,
      roles,
      revoked,
      stops,
      routes,
      routeStops,
      vehicleTypes,
      vehicles,
      schedules,
      scheduleStops,
      driverAssigns,
      vehicleAssigns,
      bookings,
      addEmployee,
    },
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

// ============================================================ T-029 /vehicles
describe('T-029 GET/POST /api/v1/vehicles (UC-13)', () => {
  let world;
  let app;
  let conn;
  let db;
  let token;

  beforeEach(async () => {
    world = createWorld();
    ({ app, conn, db } = setup(world));
    token = await tokenFor(app);
  });

  test('GET 200: รูป Vehicle ครบ (join vehicle_type) + meta + เรียง veh_id + seats_available = null', async () => {
    const res = await request(app).get('/api/v1/vehicles').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data[0]).toEqual({
      veh_id: 1,
      plate_no: 'สย 2591',
      vtype_id: 1,
      vtype_name: 'รถตู้ 9 ที่นั่ง',
      capacity: 9,
      is_active: 1,
      seats_available: null,
    });
    expect(res.body.data.map((v) => v.veh_id)).toEqual([1, 2, 3]);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 3, total_pages: 1 });
  });

  test('GET 200: กรอง is_active / vtype_id · ค่า filter ผิดถูกละ · clamp page/limit', async () => {
    const active = await request(app).get('/api/v1/vehicles?is_active=1').set(authHeader(token));
    expect(active.body.data.map((v) => v.veh_id)).toEqual([1, 2]);

    const byType = await request(app).get('/api/v1/vehicles?vtype_id=2').set(authHeader(token));
    expect(byType.body.data.map((v) => v.veh_id)).toEqual([3]);

    const ignored = await request(app).get('/api/v1/vehicles?is_active=99&vtype_id=abc').set(authHeader(token));
    expect(ignored.body.data).toHaveLength(3);

    const paged = await request(app).get('/api/v1/vehicles?page=0&limit=999').set(authHeader(token));
    expect(paged.body.meta).toEqual({ page: 1, limit: 100, total: 3, total_pages: 1 });
  });

  test('POST 201: insert ใน transaction จริง + commit + ข้อความตามสเปก', async () => {
    const res = await request(app)
      .post('/api/v1/vehicles')
      .set(authHeader(token))
      .send({ plate_no: 'มก 7777', vtype_id: 1, is_active: 1 });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('เพิ่มรถสำเร็จ');
    expect(res.body.data).toEqual({
      veh_id: 50,
      plate_no: 'มก 7777',
      vtype_id: 1,
      vtype_name: 'รถตู้ 9 ที่นั่ง',
      capacity: 9,
      is_active: 1,
      seats_available: null,
    });
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(world.repos.vehicle.insert.mock.calls[0][0]).toBe(conn);
  });

  test('POST 409: plate_no ซ้ำ (uq_vehicle_plate) — ไม่เข้า transaction', async () => {
    const res = await request(app)
      .post('/api/v1/vehicles')
      .set(authHeader(token))
      .send({ plate_no: 'สย 2591', vtype_id: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'DUPLICATED', message: DUP_PLATE });
    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  test('POST 422: vtype_id ไม่มีจริง (fk_vehicle_type) — ไม่เข้า transaction', async () => {
    const res = await request(app)
      .post('/api/v1/vehicles')
      .set(authHeader(token))
      .send({ plate_no: 'ใหม่ 0001', vtype_id: 99 });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: 'FK_VIOLATION', message: VTYPE_REF });
    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  test('POST 400: details ระดับ field — plate_no required/ยาวเกิน · vtype_id ชนิด/required · is_active enum', async () => {
    const missing = await request(app).post('/api/v1/vehicles').set(authHeader(token)).send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error.details.map((d) => d.field)).toEqual(['plate_no', 'vtype_id']);

    const tooLong = await request(app)
      .post('/api/v1/vehicles')
      .set(authHeader(token))
      .send({ plate_no: 'x'.repeat(21), vtype_id: 1 });
    expect(tooLong.status).toBe(400);

    const badType = await request(app)
      .post('/api/v1/vehicles')
      .set(authHeader(token))
      .send({ plate_no: 'abc', vtype_id: 'x' });
    expect(badType.status).toBe(400);

    const badEnum = await request(app)
      .post('/api/v1/vehicles')
      .set(authHeader(token))
      .send({ plate_no: 'abc', vtype_id: 1, is_active: 5 });
    expect(badEnum.status).toBe(400);
    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  test('ไม่มี endpoint นอกสเปก: PUT/DELETE /vehicles/{id} และ /vehicle-types ทั้งหมด → 404', async () => {
    const putRes = await request(app).put('/api/v1/vehicles/1').set(authHeader(token)).send({ plate_no: 'x' });
    const delRes = await request(app).delete('/api/v1/vehicles/1').set(authHeader(token));
    const listRes = await request(app).get('/api/v1/vehicle-types').set(authHeader(token));
    const postRes = await request(app).post('/api/v1/vehicle-types').set(authHeader(token)).send({ vtype_name: 'x', capacity: 9 });
    expect(putRes.status).toBe(404);
    expect(delRes.status).toBe(404);
    expect(listRes.status).toBe(404);
    expect(postRes.status).toBe(404);
  });
});

// ====================================================== T-030 /schedules CRUD
describe('T-030 GET/POST /api/v1/schedules (UC-14, BR-02)', () => {
  let world;
  let app;
  let conn;
  let db;
  let token;

  beforeEach(async () => {
    world = createWorld();
    ({ app, conn, db } = setup(world));
    token = await tokenFor(app);
  });

  test('GET 200: รูป Schedule ครบ (end_at จาก total_minutes · driver/vehicle · seats BR-07) + เรียงวันที่', async () => {
    const res = await request(app).get('/api/v1/schedules').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.map((s) => s.sched_id)).toEqual([10, 11, 12, 13, 14]);
    expect(res.body.data[0]).toEqual({
      sched_id: 10,
      route_id: 2,
      route_name: 'เส้นทางที่ 2',
      service_date: '2026-10-02',
      depart_at: '2026-10-02T09:30:00.000Z',
      end_at: '2026-10-02T09:39:00.000Z',
      is_active: 1,
      stop_count: 3,
      driver: { emp_id: 5, first_name: 'สมชาย', last_name: 'ขับรถ' },
      vehicle: { veh_id: 1, plate_no: 'สย 2591', vtype_name: 'รถตู้ 9 ที่นั่ง', capacity: 9 },
      seats_total: 9,
      seats_reserved: 3,
      seats_available: 6,
    });
    const empty = res.body.data.find((s) => s.sched_id === 11);
    expect(empty.driver).toBeNull();
    expect(empty.vehicle).toBeNull();
    expect(empty.seats_total).toBeNull();
    expect(empty.seats_reserved).toBe(0);
    expect(empty.seats_available).toBeNull();
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 5, total_pages: 1 });
  });

  test('GET 200: กรอง route_id / from / to / is_active · ค่าผิดถูกละ · clamp', async () => {
    const byRoute = await request(app).get('/api/v1/schedules?route_id=3').set(authHeader(token));
    expect(byRoute.body.data.map((s) => s.sched_id)).toEqual([14]);

    const range = await request(app).get('/api/v1/schedules?from=2026-10-05').set(authHeader(token));
    expect(range.body.data.map((s) => s.sched_id)).toEqual([13, 14]);

    const until = await request(app).get('/api/v1/schedules?to=2026-10-02').set(authHeader(token));
    expect(until.body.data.map((s) => s.sched_id)).toEqual([10, 11, 12]);

    const inactive = await request(app).get('/api/v1/schedules?is_active=0').set(authHeader(token));
    expect(inactive.body.data.map((s) => s.sched_id)).toEqual([14]);

    const ignored = await request(app)
      .get('/api/v1/schedules?route_id=abc&from=garbage&to=99/99/99&is_active=7')
      .set(authHeader(token));
    expect(ignored.body.data).toHaveLength(5);

    const paged = await request(app).get('/api/v1/schedules?page=2&limit=2').set(authHeader(token));
    expect(paged.body.data.map((s) => s.sched_id)).toEqual([12, 13]);
    expect(paged.body.meta).toEqual({ page: 2, limit: 2, total: 5, total_pages: 3 });
  });

  test('POST 201: INSERT schedule + schedule_stop ทุกจุดจอด ใน transaction เดียว — BR-02 offset 0/5/9', async () => {
    const res = await request(app)
      .post('/api/v1/schedules')
      .set(authHeader(token))
      .send({ route_id: 2, service_date: '2026-10-10', depart_at: '2026-10-10T11:00:00.000Z', is_active: 1 });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('สร้างรอบสำเร็จ');
    expect(res.body.data).toMatchObject({
      sched_id: 70,
      route_id: 2,
      service_date: '2026-10-10',
      depart_at: '2026-10-10T11:00:00.000Z',
      end_at: '2026-10-10T11:09:00.000Z',
      is_active: 1,
      stop_count: 3,
      driver: null,
      vehicle: null,
      seats_total: null,
      seats_reserved: 0,
      seats_available: null,
    });

    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(world.repos.schedule.insert).toHaveBeenCalledTimes(1);
    expect(world.repos.schedule.insertStop).toHaveBeenCalledTimes(3);

    const stopCalls = world.repos.schedule.insertStop.mock.calls.map((c) => c[1]);
    expect(stopCalls.map((c) => c.stopSeq)).toEqual([1, 2, 3]);
    expect(stopCalls.map((c) => c.offsetMin)).toEqual([0, 5, 9]); // BR-02 = SUM(travel_minutes) ถึงจุดนั้น
    expect(stopCalls[0].schedId).toBe(70);
    expect(stopCalls[0].departAt).toEqual(new Date('2026-10-10T11:00:00.000Z'));
    expect(stopCalls.every((c) => c.departAt.getTime() === stopCalls[0].departAt.getTime())).toBe(true);
  });

  test('POST 409: (route_id, depart_at) ซ้ำ (uq_route_depart) — ไม่เข้า transaction + ข้อความมี HH:MM', async () => {
    const res = await request(app)
      .post('/api/v1/schedules')
      .set(authHeader(token))
      .send({ route_id: 2, service_date: '2026-10-02', depart_at: '2026-10-02T09:30:00.000Z' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'DUPLICATED',
      message: 'เส้นทางนี้มีรอบเวลา 09:30 ของวันที่นี้อยู่แล้ว',
    });
    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  test('POST 422 ROUTE_STOPS_INCOMPLETE: ไม่มีจุดจอด · total_minutes ไม่ตรง SUM · ลำดับขาด — ไม่เข้า tx', async () => {
    const noStops = await request(app)
      .post('/api/v1/schedules')
      .set(authHeader(token))
      .send({ route_id: 3, service_date: '2026-10-10', depart_at: '2026-10-10T09:30:00.000Z' });
    expect(noStops.status).toBe(422);
    expect(noStops.body.error).toMatchObject({ code: 'ROUTE_STOPS_INCOMPLETE', message: INCOMPLETE });

    const staleTotal = await request(app)
      .post('/api/v1/schedules')
      .set(authHeader(token))
      .send({ route_id: 4, service_date: '2026-10-10', depart_at: '2026-10-10T09:30:00.000Z' });
    expect(staleTotal.status).toBe(422);

    const badSeq = await request(app)
      .post('/api/v1/schedules')
      .set(authHeader(token))
      .send({ route_id: 5, service_date: '2026-10-10', depart_at: '2026-10-10T09:30:00.000Z' });
    expect(badSeq.status).toBe(422);

    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  test('POST 404: เส้นทางไม่มีอยู่ — ไม่เข้า transaction', async () => {
    const res = await request(app)
      .post('/api/v1/schedules')
      .set(authHeader(token))
      .send({ route_id: 999, service_date: '2026-10-10', depart_at: '2026-10-10T09:30:00.000Z' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND' });
    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  test('POST 400: route_id required · วันที่/เวลาผิดรูป (รวมวันที่ไม่มีจริง) · is_active enum', async () => {
    const missing = await request(app).post('/api/v1/schedules').set(authHeader(token)).send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error.details.map((d) => d.field)).toEqual(['route_id', 'service_date', 'depart_at']);

    const slashDate = await request(app)
      .post('/api/v1/schedules')
      .set(authHeader(token))
      .send({ route_id: 2, service_date: '02/10/2026', depart_at: '2026-10-10T09:30:00.000Z' });
    expect(slashDate.status).toBe(400);

    const badDay = await request(app)
      .post('/api/v1/schedules')
      .set(authHeader(token))
      .send({ route_id: 2, service_date: '2026-02-30', depart_at: '2026-10-10T09:30:00.000Z' });
    expect(badDay.status).toBe(400);

    const noT = await request(app)
      .post('/api/v1/schedules')
      .set(authHeader(token))
      .send({ route_id: 2, service_date: '2026-10-10', depart_at: '2026-10-10 11:00' });
    expect(noT.status).toBe(400);

    const bogus = await request(app)
      .post('/api/v1/schedules')
      .set(authHeader(token))
      .send({ route_id: 2, service_date: '2026-10-10', depart_at: '2026-13-45T99:99:00Z' });
    expect(bogus.status).toBe(400);

    const badEnum = await request(app)
      .post('/api/v1/schedules')
      .set(authHeader(token))
      .send({ route_id: 2, service_date: '2026-10-10', depart_at: '2026-10-10T09:30:00.000Z', is_active: 7 });
    expect(badEnum.status).toBe(400);
    expect(db.withTransaction).not.toHaveBeenCalled();
  });
});

// ============================================ T-030 GET detail + DELETE /schedules/{id}
describe('T-030 GET/DELETE /api/v1/schedules/{id} (UC-14.2)', () => {
  let world;
  let app;
  let conn;
  let db;
  let token;

  beforeEach(async () => {
    world = createWorld();
    ({ app, conn, db } = setup(world));
    token = await tokenFor(app);
  });

  test('GET 200: stops[] เรียง stop_seq + arrive_at BR-02 + stop_name join', async () => {
    const res = await request(app).get('/api/v1/schedules/10').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.sched_id).toBe(10);
    expect(res.body.data.stops).toHaveLength(3);
    expect(res.body.data.stops[0]).toEqual({
      sched_stop_id: 100,
      sched_id: 10,
      stop_id: 1,
      stop_name: 'มหาวิทยาลัยเทคโนโลยีมหานคร',
      stop_seq: 1,
      arrive_at: '2026-10-02T09:30:00.000Z',
      dwell_minutes: 0,
    });
    expect(res.body.data.stops.map((s) => s.arrive_at)).toEqual([
      '2026-10-02T09:30:00.000Z',
      '2026-10-02T09:35:00.000Z',
      '2026-10-02T09:39:00.000Z',
    ]);
  });

  test('GET 404: รอบไม่มีอยู่', async () => {
    const res = await request(app).get('/api/v1/schedules/999').set(authHeader(token));
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'ไม่พบข้อมูลที่ต้องการ' });
  });

  test('DELETE 409 SCHEDULE_HAS_BOOKING: รอบมี booking → แจ้งจำนวน + details booking_count — ไม่ลบ', async () => {
    const res = await request(app).delete('/api/v1/schedules/10').set(authHeader(token));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'SCHEDULE_HAS_BOOKING',
      message: 'รอบนี้มีการจองแล้ว 3 รายการ กรุณาแจ้งผู้ใช้ก่อนยกเลิก',
      details: [{ field: 'booking_count', message: '3' }],
    });
    expect(db.withTransaction).not.toHaveBeenCalled();
    expect(world.state.schedules).toHaveLength(5);
  });

  test('DELETE 200: ไม่มี booking → ลบใน transaction + commit + แถวหายจริง · 404 เมื่อไม่พบ', async () => {
    const ok = await request(app).delete('/api/v1/schedules/11').set(authHeader(token));
    expect(ok.status).toBe(200);
    expect(ok.body.message).toBe('ยกเลิกรอบเวลาสำเร็จ');
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(world.state.schedules.map((s) => s.SCHED_ID)).toEqual([10, 12, 13, 14]);

    const missing = await request(app).delete('/api/v1/schedules/999').set(authHeader(token));
    expect(missing.status).toBe(404);
  });
});

// ==================================================== T-031 assign-driver (BR-04)
describe('T-031 POST/DELETE /api/v1/schedules/{id}/assign-driver (UC-15, BR-04)', () => {
  let world;
  let app;
  let conn;
  let db;
  let token;

  beforeEach(async () => {
    world = createWorld();
    ({ app, conn, db } = setup(world));
    token = await tokenFor(app);
  });

  test('POST 201: TX = lock schedule → lock employee → ตรวจ conflict → INSERT (เรียงลำดับถูก) + commit', async () => {
    const res = await request(app)
      .post('/api/v1/schedules/13/assign-driver')
      .set(authHeader(token))
      .send({ emp_id: 5 });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('มอบหมายคนขับสำเร็จ');
    expect(res.body.data).toEqual({
      assign_id: 300,
      sched_id: 13,
      emp_id: 5,
      driver_name: 'สมชาย ขับรถ',
    });
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);

    const s = world.repos.schedule;
    const order = [
      s.lockSchedule.mock.invocationCallOrder[0],
      s.lockEmployee.mock.invocationCallOrder[0],
      s.isDriver.mock.invocationCallOrder[0],
      s.countDriverAssignment.mock.invocationCallOrder[0],
      s.findDriverConflicts.mock.invocationCallOrder[0],
      s.insertDriverAssign.mock.invocationCallOrder[0],
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  test('POST 409 DRIVER_CONFLICT: overlap จริง → แจ้งรอบที่ชน + rollback ไม่ INSERT', async () => {
    const res = await request(app)
      .post('/api/v1/schedules/11/assign-driver')
      .set(authHeader(token))
      .send({ emp_id: 5 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'DRIVER_CONFLICT', message: DRIVER_CONFLICT_MSG });
    expect(res.body.error.details).toEqual([{ field: 'sched_id', message: CONFLICT_DETAIL }]);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(world.repos.schedule.insertDriverAssign).not.toHaveBeenCalled();
    expect(world.state.driverAssigns).toHaveLength(1);
  });

  test('POST 201: ขอบเขต overlap — รอบจบ 09:39 = รอบเริ่ม 09:39 → ไม่ถือว่าชน (allow)', async () => {
    const res = await request(app)
      .post('/api/v1/schedules/12/assign-driver')
      .set(authHeader(token))
      .send({ emp_id: 5 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ sched_id: 12, emp_id: 5 });
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  test('POST 422 NOT_A_DRIVER: พนักงานไม่มี Role = DRIVER — ไม่ INSERT', async () => {
    const res = await request(app)
      .post('/api/v1/schedules/13/assign-driver')
      .set(authHeader(token))
      .send({ emp_id: 6 });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: 'NOT_A_DRIVER', message: NOT_A_DRIVER });
    expect(world.repos.schedule.insertDriverAssign).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  test('POST 404: รอบไม่มีอยู่ · พนักงานไม่มีอยู่ (ล็อกก่อน → 404)', async () => {
    const noSched = await request(app)
      .post('/api/v1/schedules/999/assign-driver')
      .set(authHeader(token))
      .send({ emp_id: 5 });
    expect(noSched.status).toBe(404);

    const noEmp = await request(app)
      .post('/api/v1/schedules/13/assign-driver')
      .set(authHeader(token))
      .send({ emp_id: 999 });
    expect(noEmp.status).toBe(404);
    expect(world.repos.schedule.insertDriverAssign).not.toHaveBeenCalled();
  });

  test('POST 409 ALREADY_ASSIGNED: รอบนี้มีคนขับคนนี้แล้ว (uq_driver_sched) — ไม่ซ้ำกับ conflict', async () => {
    const res = await request(app)
      .post('/api/v1/schedules/10/assign-driver')
      .set(authHeader(token))
      .send({ emp_id: 5 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'ALREADY_ASSIGNED', message: DRIVER_ALREADY });
    expect(world.repos.schedule.insertDriverAssign).not.toHaveBeenCalled();
  });

  test('POST 400: emp_id required / ไม่ integer', async () => {
    const missing = await request(app)
      .post('/api/v1/schedules/13/assign-driver')
      .set(authHeader(token))
      .send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error.details.map((d) => d.field)).toEqual(['emp_id']);

    const bad = await request(app)
      .post('/api/v1/schedules/13/assign-driver')
      .set(authHeader(token))
      .send({ emp_id: 5.5 });
    expect(bad.status).toBe(400);
    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  test('DELETE 200: ลบ driver_assign ของรอบ + commit · 404 เมื่อไม่มีมอบหมาย/ไม่พบรอบ', async () => {
    const ok = await request(app).delete('/api/v1/schedules/10/assign-driver').set(authHeader(token));
    expect(ok.status).toBe(200);
    expect(ok.body.message).toBe('ยกเลิกการมอบหมายคนขับสำเร็จ');
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(world.state.driverAssigns).toHaveLength(0);

    const none = await request(app).delete('/api/v1/schedules/13/assign-driver').set(authHeader(token));
    expect(none.status).toBe(404);

    const missing = await request(app).delete('/api/v1/schedules/999/assign-driver').set(authHeader(token));
    expect(missing.status).toBe(404);
  });
});

// ==================================================== T-032 assign-vehicle (BR-04)
describe('T-032 POST/DELETE /api/v1/schedules/{id}/assign-vehicle (UC-16, BR-04/BR-07)', () => {
  let world;
  let app;
  let conn;
  let db;
  let token;

  beforeEach(async () => {
    world = createWorld();
    ({ app, conn, db } = setup(world));
    token = await tokenFor(app);
  });

  test('POST 201: lock schedule → lock vehicle → ตรวจ conflict → INSERT + commit · คืน capacity (BR-07)', async () => {
    const res = await request(app)
      .post('/api/v1/schedules/13/assign-vehicle')
      .set(authHeader(token))
      .send({ veh_id: 2 });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('มอบหมายรถสำเร็จ');
    expect(res.body.data).toEqual({
      assign_id: 400,
      sched_id: 13,
      veh_id: 2,
      plate_no: 'สย 2592',
      capacity: 9,
    });
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);

    const s = world.repos.schedule;
    const order = [
      s.lockSchedule.mock.invocationCallOrder[0],
      world.repos.vehicle.lockById.mock.invocationCallOrder[0],
      s.countVehicleAssignment.mock.invocationCallOrder[0],
      s.findVehicleConflicts.mock.invocationCallOrder[0],
      s.insertVehicleAssign.mock.invocationCallOrder[0],
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  test('POST 409 VEHICLE_CONFLICT: รถคันเดียวกันทับเวลาจริง → แจ้งรอบที่ชน + rollback', async () => {
    const res = await request(app)
      .post('/api/v1/schedules/11/assign-vehicle')
      .set(authHeader(token))
      .send({ veh_id: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'VEHICLE_CONFLICT', message: VEHICLE_CONFLICT_MSG });
    expect(res.body.error.details).toEqual([{ field: 'sched_id', message: CONFLICT_DETAIL }]);
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(world.repos.schedule.insertVehicleAssign).not.toHaveBeenCalled();
    expect(world.state.vehicleAssigns).toHaveLength(1);
  });

  test('POST 201: ขอบเขต overlap — ชนชิดขอบไม่นับเป็น conflict', async () => {
    const res = await request(app)
      .post('/api/v1/schedules/12/assign-vehicle')
      .set(authHeader(token))
      .send({ veh_id: 1 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ sched_id: 12, veh_id: 1 });
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  test('POST 422 VEHICLE_INACTIVE: รถปิดใช้งาน — ไม่ INSERT', async () => {
    const res = await request(app)
      .post('/api/v1/schedules/13/assign-vehicle')
      .set(authHeader(token))
      .send({ veh_id: 3 });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: 'VEHICLE_INACTIVE', message: VEHICLE_INACTIVE });
    expect(world.repos.schedule.insertVehicleAssign).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  test('POST 409 ALREADY_ASSIGNED: 1 รอบมี 1 รถ — รอบมีรถแล้ว (รถคันอื่น) → ปฏิเสธ', async () => {
    const res = await request(app)
      .post('/api/v1/schedules/10/assign-vehicle')
      .set(authHeader(token))
      .send({ veh_id: 2 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'ALREADY_ASSIGNED', message: VEHICLE_ALREADY });
    expect(world.repos.schedule.insertVehicleAssign).not.toHaveBeenCalled();
  });

  test('POST 404/400: รอบไม่มี · รถไม่มี · veh_id ผิดรูป', async () => {
    const noSched = await request(app)
      .post('/api/v1/schedules/999/assign-vehicle')
      .set(authHeader(token))
      .send({ veh_id: 1 });
    expect(noSched.status).toBe(404);

    const noVeh = await request(app)
      .post('/api/v1/schedules/13/assign-vehicle')
      .set(authHeader(token))
      .send({ veh_id: 999 });
    expect(noVeh.status).toBe(404);

    const bad = await request(app)
      .post('/api/v1/schedules/13/assign-vehicle')
      .set(authHeader(token))
      .send({});
    expect(bad.status).toBe(400);
    expect(bad.body.error.details.map((d) => d.field)).toEqual(['veh_id']);
    expect(world.repos.schedule.insertVehicleAssign).not.toHaveBeenCalled();
  });

  test('DELETE 200: ลบ vehicle_assign ของรอบ + commit · 404 เมื่อไม่มี/ไม่พบ', async () => {
    const ok = await request(app).delete('/api/v1/schedules/10/assign-vehicle').set(authHeader(token));
    expect(ok.status).toBe(200);
    expect(ok.body.message).toBe('ยกเลิกการมอบหมายรถสำเร็จ');
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(world.state.vehicleAssigns).toHaveLength(0);

    const none = await request(app).delete('/api/v1/schedules/13/assign-vehicle').set(authHeader(token));
    expect(none.status).toBe(404);

    const missing = await request(app).delete('/api/v1/schedules/999/assign-vehicle').set(authHeader(token));
    expect(missing.status).toBe(404);
  });
});

// ============================================ สิทธิ์ VEH.EDIT / ROUTE.VIEW / SCHED.EDIT
describe('T-029…T-032 สิทธิ์ทุก endpoint (โหลดจาก DB ทุก request)', () => {
  let world;
  let app;
  let token;
  let viewerToken;

  beforeEach(async () => {
    world = createWorld();
    ({ app } = setup(world));
    token = await tokenFor(app);
    viewerToken = await tokenFor(app, 'viewer', VIEWER_PASS);
  });

  const ALL_ENDPOINTS = [
    ['get', '/api/v1/vehicles'],
    ['post', '/api/v1/vehicles'],
    ['get', '/api/v1/schedules'],
    ['post', '/api/v1/schedules'],
    ['get', '/api/v1/schedules/10'],
    ['delete', '/api/v1/schedules/10'],
    ['post', '/api/v1/schedules/10/assign-driver'],
    ['delete', '/api/v1/schedules/10/assign-driver'],
    ['post', '/api/v1/schedules/10/assign-vehicle'],
    ['delete', '/api/v1/schedules/10/assign-vehicle'],
  ];

  test('ไม่มี token → 401 ทั้ง 10 endpoint', async () => {
    for (const [method, path] of ALL_ENDPOINTS) {
      const res = await request(app)[method](path).send({});
      expect({ path, status: res.status }).toEqual({ path, status: 401 });
    }
  });

  test('มี ROUTE.VIEW อย่างเดียว → อ่าน /schedules ได้ · เขียน/vehicles ทั้งหมด → 403', async () => {
    const listOk = await request(app).get('/api/v1/schedules').set(authHeader(viewerToken));
    expect(listOk.status).toBe(200);

    const detailOk = await request(app).get('/api/v1/schedules/10').set(authHeader(viewerToken));
    expect(detailOk.status).toBe(200);

    const vehiclesForbidden = await request(app).get('/api/v1/vehicles').set(authHeader(viewerToken));
    expect(vehiclesForbidden.status).toBe(403);
    expect(vehiclesForbidden.body.error).toMatchObject({ code: 'FORBIDDEN', message: 'ไม่มีสิทธิ์เข้าถึงส่วนนี้' });

    const writeVehicle = await request(app)
      .post('/api/v1/vehicles')
      .set(authHeader(viewerToken))
      .send({ plate_no: 'วิว 0001', vtype_id: 1 });
    expect(writeVehicle.status).toBe(403);

    const createSched = await request(app)
      .post('/api/v1/schedules')
      .set(authHeader(viewerToken))
      .send({ route_id: 2, service_date: '2026-10-10', depart_at: '2026-10-10T09:30:00.000Z' });
    expect(createSched.status).toBe(403);

    const assign = await request(app)
      .post('/api/v1/schedules/13/assign-driver')
      .set(authHeader(viewerToken))
      .send({ emp_id: 5 });
    expect(assign.status).toBe(403);

    const delSched = await request(app).delete('/api/v1/schedules/11').set(authHeader(viewerToken));
    expect(delSched.status).toBe(403);
  });

  test('ไม่มีสิทธิ์ front เลย (outsider) → 403 ทั้งอ่าน schedules/vehicles', async () => {
    const outsiderToken = await tokenFor(app, 'outsider', OUTSIDER_PASS);
    const schedules = await request(app).get('/api/v1/schedules').set(authHeader(outsiderToken));
    const vehicles = await request(app).get('/api/v1/vehicles').set(authHeader(outsiderToken));
    expect(schedules.status).toBe(403);
    expect(vehicles.status).toBe(403);
  });

  test('ถอด SCHED.EDIT ระหว่าง session → POST /schedules 403 ทันที (โหลดสิทธิ์จาก DB ทุก request)', async () => {
    const before = await request(app)
      .post('/api/v1/schedules')
      .set(authHeader(token))
      .send({ route_id: 2, service_date: '2026-10-11', depart_at: '2026-10-11T09:30:00.000Z' });
    expect(before.status).toBe(201);

    world.state.permissions.set(
      1,
      world.state.permissions.get(1).filter((p) => p !== 'SCHED.EDIT'),
    );

    const after = await request(app)
      .post('/api/v1/schedules')
      .set(authHeader(token))
      .send({ route_id: 2, service_date: '2026-10-12', depart_at: '2026-10-12T09:30:00.000Z' });
    expect(after.status).toBe(403);
  });

  test('wiring: scheduling.routes.js มี 10 operations (เท่า 17.5.2) · guard ครบ 3 รหัส · ไม่มี PUT /schedules/{id} (Q23)', async () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/routes/scheduling.routes.js'), 'utf8');
    const operations = source.match(/router\.(get|post|delete)\(/g) || [];
    expect(operations).toHaveLength(10);
    const guarded = source.match(/^\s+(viewGuard|editGuard|vehicleGuard),\s*$/gm) || [];
    expect(guarded).toHaveLength(10);
    expect(source).toContain("requirePermission('VEH.EDIT')");
    expect(source).toContain("requirePermission('ROUTE.VIEW')");
    expect(source).toContain("requirePermission('SCHED.EDIT')");

    // Q23 ยังค้าง — ห้ามเดา PUT /schedules/{id} (17.5.2/openapi ไม่ประกาศ)
    const putSched = await request(app).put('/api/v1/schedules/10').set(authHeader(token)).send({ depart_at: 'x' });
    const patchSched = await request(app).patch('/api/v1/schedules/10').set(authHeader(token)).send({});
    expect(putSched.status).toBe(404);
    expect(patchSched.status).toBe(404);
  });
});

// ============================================ repository SQL (bind ไม่ interpolation)
describe('repository SQL — bind variables, ไม่ใช้ SELECT *, FOR UPDATE, BR-02/BR-04/BR-07', () => {
  let connStub;

  beforeEach(() => {
    dbMock.query.mockReset();
    connStub = {
      execute: jest.fn(async () => ({ rows: [], rowsAffected: 1, outBinds: { newId: [1] } })),
    };
  });

  test('vehicle.list/count: JOIN vehicle_type + ORDER BY veh_id + OFFSET/FETCH · ไม่ SELECT *', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [] });
    await vehicleRepo.list({ isActive: 1, vtypeId: 2, limit: 20, offset: 40 });
    const [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).not.toContain('SELECT *');
    expect(sql).toContain('ORDER BY v.veh_id');
    expect(sql).toContain('OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY');
    expect(sql).toContain('JOIN vehicle_type vt');
    expect(binds).toEqual({ isActive: 1, vtypeId: 2, offset: 40, limit: 20 });

    dbMock.query.mockReset();
    dbMock.query.mockResolvedValueOnce({ rows: [{ TOTAL: 0 }] });
    await vehicleRepo.count({ isActive: 0 });
    expect(dbMock.query.mock.calls[0][0]).not.toContain('SELECT *');
    expect(dbMock.query.mock.calls[0][1]).toEqual({ isActive: 0 });
  });

  test('vehicle.findByPlate: ค่าอยู่ใน bind ไม่ใช่ interpolation · insert ไม่ใส่ veh_id + RETURNING', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [] });
    const payload = "สย 2591' OR 1=1--";
    await vehicleRepo.findByPlate(payload);
    const [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).not.toContain('OR 1=1');
    expect(binds).toEqual({ plateNo: payload });

    await vehicleRepo.insert(connStub, { plateNo: 'กข 1', vtypeId: 1, isActive: 1 });
    const [insSql, insBinds] = connStub.execute.mock.calls[0];
    expect(insSql).toContain('INSERT INTO vehicle (plate_no, vtype_id, is_active)');
    expect(insSql).toContain('RETURNING veh_id INTO :newId');
    expect(insSql).not.toContain(':veh_id');
    expect(Object.keys(insBinds)).toEqual(['plateNo', 'vtypeId', 'isActive', 'newId']);
  });

  test('vehicle.lockById: SELECT … FOR UPDATE บนแถวรถ (UC-16 locking)', async () => {
    await vehicleRepo.lockById(connStub, 1);
    const [sql, binds] = connStub.execute.mock.calls[0];
    expect(sql).toContain('FROM vehicle');
    expect(sql).toContain('FOR UPDATE');
    expect(binds).toEqual({ vehId: 1 });
  });

  test('schedule.list: ไม่ SELECT * · ORDER BY วันที่/เวลา · TO_DATE binds · คนขับ = MIN assign_id · BR-07 reserved', async () => {
    dbMock.query.mockResolvedValueOnce({ rows: [] });
    await scheduleRepo.list({ routeId: 2, from: '2026-10-01', to: '2026-10-31', isActive: 1, limit: 20, offset: 0 });
    const [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).not.toContain('SELECT *');
    expect(sql).toContain('ORDER BY s.service_date, s.depart_at, s.sched_id');
    expect(sql).toContain("TO_DATE(:fromDate, 'YYYY-MM-DD')");
    expect(sql).toContain("TO_DATE(:toDate, 'YYYY-MM-DD')");
    expect(sql).toContain('MIN(da2.assign_id)'); // ไม่ใช่ JOIN ตรง ๆ ที่คูณแถวเมื่อมีคนขับสำรอง
    expect(sql).toContain("b.status = 'reserved'"); // BR-07 นับเฉพาะ reserved
    expect(sql).toContain('OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY');
    expect(binds).toEqual({
      routeId: 2,
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
      isActive: 1,
      offset: 0,
      limit: 20,
    });

    dbMock.query.mockReset();
    dbMock.query.mockResolvedValueOnce({ rows: [{ TOTAL: 0 }] });
    await scheduleRepo.count({ routeId: 2 });
    expect(dbMock.query.mock.calls[0][0]).toContain('SELECT COUNT(*) AS total FROM schedule s');
    expect(dbMock.query.mock.calls[0][0]).not.toContain('SELECT *');
  });

  test('schedule.insert/insertStop: TO_DATE + RETURNING · BR-02 = NUMTODSINTERVAL(offset) bind', async () => {
    const departAt = new Date('2026-10-10T11:00:00.000Z');
    await scheduleRepo.insert(connStub, {
      routeId: 2,
      serviceDate: '2026-10-10',
      departAt,
      isActive: 1,
    });
    const [insSql, insBinds] = connStub.execute.mock.calls[0];
    expect(insSql).toContain('INSERT INTO schedule (route_id, service_date, depart_at, is_active)');
    expect(insSql).toContain("TO_DATE(:serviceDate, 'YYYY-MM-DD')");
    expect(insSql).toContain('RETURNING sched_id INTO :newId');
    expect(insSql).not.toContain(':service_date');
    expect(insBinds.departAt).toBe(departAt);

    await scheduleRepo.insertStop(connStub, {
      schedId: 70,
      stopId: 2,
      stopSeq: 2,
      departAt,
      offsetMin: 5,
    });
    const [stopSql, stopBinds] = connStub.execute.mock.calls[1];
    expect(stopSql).toContain("NUMTODSINTERVAL(:offsetMin, 'MINUTE')");
    expect(stopSql).not.toContain('5'); // offset ต้องอยู่ใน bind ไม่ใช่ใน SQL
    expect(stopBinds).toEqual({ schedId: 70, stopId: 2, stopSeq: 2, departAt, offsetMin: 5 });
  });

  test('lockSchedule/lockEmployee: FOR UPDATE เฉพาะแถว (ไม่ใช่ aggregate — ORA-02014)', async () => {
    await scheduleRepo.lockSchedule(connStub, 10);
    const [schedSql, schedBinds] = connStub.execute.mock.calls[0];
    expect(schedSql).toContain('FROM schedule');
    expect(schedSql).toContain('FOR UPDATE');
    expect(schedSql).not.toContain('COUNT');
    expect(schedSql).not.toContain('SUM');
    expect(schedBinds).toEqual({ schedId: 10 });

    await scheduleRepo.lockEmployee(connStub, 5);
    const [empSql, empBinds] = connStub.execute.mock.calls[1];
    expect(empSql).toContain('FROM employee');
    expect(empSql).toContain('FOR UPDATE');
    expect(empBinds).toEqual({ empId: 5 });
  });

  test('conflict query: bind ทั้งหมด (payload แปลก ๆ ไม่ต่อเข้า SQL) · isDriver bind roleName', async () => {
    await scheduleRepo.findDriverConflicts(connStub, "' OR 1=1--", 10);
    const [sql, binds] = connStub.execute.mock.calls[0];
    expect(sql).toContain('da.sched_id <> :excludeSchedId');
    expect(sql).not.toContain('OR 1=1');
    expect(binds).toEqual({ empId: "' OR 1=1--", excludeSchedId: 10 });

    await scheduleRepo.findVehicleConflicts(connStub, 1, 10);
    const [vehSql, vehBinds] = connStub.execute.mock.calls[1];
    expect(vehSql).toContain('va.sched_id <> :excludeSchedId');
    expect(vehBinds).toEqual({ vehId: 1, excludeSchedId: 10 });

    await scheduleRepo.isDriver(connStub, 5);
    const [driverSql, driverBinds] = connStub.execute.mock.calls[2];
    expect(driverSql).toContain(':roleName');
    expect(driverSql).not.toContain("'DRIVER'"); // role ไม่ hardcode ใน SQL (dynamic RBAC)
    expect(driverBinds).toEqual({ empId: 5, roleName: 'DRIVER' });
  });
});
