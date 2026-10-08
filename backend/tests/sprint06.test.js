// backend/tests/sprint06.test.js — Sprint 6 (T-024 / T-025 / T-026 / T-027) regression tests
// ครอบคลุม: Stop CRUD (UC-11, BR-03), Route GET/POST (UC-12), Route_Stop list/replace แบบมีลำดับ
//           (stop_seq 1..n, จุดซ้ำ, travel_minutes >= 0, FK มีจริง), BR-01 auto-calc total_minutes
//           ทุก endpoint คุม ROUTE.VIEW/ROUTE.EDIT (โหลดจาก DB ทุก request)
// ไม่มี: PUT/DELETE /routes/{id} — 17.5.2/openapi ไม่ประกาศ (มี test ยืนยันว่าไม่ถูกสร้าง)
// สถาปัตยกรรม: inject fake repos + fake connection เข้า createApp (ไม่แตะ Oracle จริง)
//               transaction runner / SQL ของ repository เป็นโค้ดจริงที่ assert ผ่าน spy

process.env.JWT_SECRET = 'sprint06-test-secret-0123456789abcdef0123456789abcdef';
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
const stopRepo = require('../src/repositories/stop.repository');
const routeRepo = require('../src/repositories/route.repository');

const ADMIN_PASS = 'AdminPass123';
const VIEWER_PASS = 'ViewerPass123';
const OUTSIDER_PASS = 'OutsiderPass123';

const SEQ_MESSAGE = 'ลำดับจุดจอดต้องเรียง 1 ถึง n โดยไม่ซ้ำและไม่ข้าม';
const DUP_STOP_MESSAGE = 'จุดจอดนี้อยู่ในเส้นทางนี้แล้ว ห้ามเพิ่มซ้ำ';
const REF_MESSAGE = 'ข้อมูลอ้างอิงไม่ถูกต้อง (ไม่พบจุดจอดที่ระบุ)';

// ---------------------------------------------------------------- fake world
function createWorld() {
  const profiles = new Map();
  const credentials = new Map();
  const permissions = new Map();
  const menus = new Map();
  const roles = new Map();
  const revoked = [];

  // ตาราง stop — STOP_ID 3 ปิดใช้งานและไม่ถูกอ้างที่ไหน (ใช้ทดสอบ DELETE ได้)
  const stops = [
    {
      STOP_ID: 1,
      STOP_NAME: 'มหาวิทยาลัยเทคโนโลยีมหานคร',
      ADDRESS: 'ถนนชลบุรี แขวงหนองจอก เขตหนองจอก กรุงเทพมหานคร',
      LATITUDE: 13.7795,
      LONGITUDE: 100.5457,
      IS_ACTIVE: 1,
    },
    { STOP_ID: 2, STOP_NAME: 'โลตัสหนองจอก', ADDRESS: null, LATITUDE: null, LONGITUDE: null, IS_ACTIVE: 1 },
    { STOP_ID: 3, STOP_NAME: 'โรงพยาบาลหนองจอก', ADDRESS: null, LATITUDE: null, LONGITUDE: null, IS_ACTIVE: 0 },
    { STOP_ID: 4, STOP_NAME: 'ร้านส้มตำปูนาง', ADDRESS: null, LATITUDE: null, LONGITUDE: null, IS_ACTIVE: 1 },
  ];

  // เส้นทาง 2: total_minutes จงใจ "เก่า/ผิด" = 99 ทั้งที่ sum จริง = 9 (ใช้พิสูจน์ BR-01)
  const routes = [
    {
      ROUTE_ID: 2,
      ROUTE_NAME: 'เส้นทางที่ 2',
      TOTAL_MINUTES: 99,
      DESCRIPTION: 'มหาวิทยาลัยฯ - โลตัส - ร้านส้มตำปูนาง',
      IS_ACTIVE: 1,
    },
    { ROUTE_ID: 3, ROUTE_NAME: 'เส้นทางที่ 3', TOTAL_MINUTES: 15, DESCRIPTION: null, IS_ACTIVE: 0 },
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
  ]);

  let nextStopId = 50;
  let nextRouteId = 60;

  function withStopName(rows) {
    return rows.map((row) => {
      const stop = stops.find((s) => s.STOP_ID === row.STOP_ID);
      return { ...row, STOP_NAME: stop ? stop.STOP_NAME : null };
    });
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
    // authenticate ใช้ findEmployeeById ทุก request (middleware/auth.js)
    employee: {
      findEmployeeById: jest.fn(async (empId) => profiles.get(Number(empId)) || null),
      findByUsername: jest.fn(async () => null),
      findByEmpCode: jest.fn(async () => null),
      listEmployees: jest.fn(async () => []),
      countEmployees: jest.fn(async () => 0),
    },
    stop: {
      list: jest.fn(async ({ q, isActive, limit, offset } = {}) =>
        stops
          .filter((s) => (q ? s.STOP_NAME.includes(q) : true))
          .filter((s) => (isActive === undefined || isActive === null ? true : s.IS_ACTIVE === Number(isActive)))
          .slice(offset, offset + limit),
      ),
      count: jest.fn(
        async ({ q, isActive } = {}) =>
          stops
            .filter((s) => (q ? s.STOP_NAME.includes(q) : true))
            .filter((s) => (isActive === undefined || isActive === null ? true : s.IS_ACTIVE === Number(isActive)))
            .length,
      ),
      findById: jest.fn(async (stopId) => stops.find((s) => s.STOP_ID === Number(stopId)) || null),
      findByName: jest.fn(
        async (stopName, excludeStopId) =>
          stops.find((s) => s.STOP_NAME === stopName && s.STOP_ID !== Number(excludeStopId)) || null,
      ),
      insert: jest.fn(async (conn, payload) => {
        const stopId = nextStopId;
        nextStopId += 1;
        stops.push({
          STOP_ID: stopId,
          STOP_NAME: payload.stopName,
          ADDRESS: payload.address ?? null,
          LATITUDE: payload.latitude ?? null,
          LONGITUDE: payload.longitude ?? null,
          IS_ACTIVE: payload.isActive,
        });
        return stopId;
      }),
      update: jest.fn(async (conn, payload) => {
        const row = stops.find((s) => s.STOP_ID === Number(payload.stopId));
        row.STOP_NAME = payload.stopName;
        row.ADDRESS = payload.address ?? null;
        row.LATITUDE = payload.latitude ?? null;
        row.LONGITUDE = payload.longitude ?? null;
        row.IS_ACTIVE = payload.isActive;
        return 1;
      }),
      remove: jest.fn(async (conn, { stopId }) => {
        const idx = stops.findIndex((s) => s.STOP_ID === Number(stopId));
        if (idx >= 0) stops.splice(idx, 1);
        return 1;
      }),
      countRoutesUsingStop: jest.fn(async (stopId) => {
        let total = 0;
        for (const rows of routeStops.values()) {
          total += rows.filter((r) => r.STOP_ID === Number(stopId)).length;
        }
        return total;
      }),
      findExistingIds: jest.fn(async (stopIds) =>
        stops.filter((s) => stopIds.includes(s.STOP_ID)).map((s) => ({ STOP_ID: s.STOP_ID })),
      ),
    },
    route: {
      list: jest.fn(async ({ isActive, limit, offset } = {}) =>
        routes
          .filter((r) => (isActive === undefined || isActive === null ? true : r.IS_ACTIVE === Number(isActive)))
          .slice(offset, offset + limit)
          .map((r) => ({ ...r, STOP_COUNT: (routeStops.get(r.ROUTE_ID) || []).length })),
      ),
      count: jest.fn(
        async ({ isActive } = {}) =>
          routes.filter((r) =>
            isActive === undefined || isActive === null ? true : r.IS_ACTIVE === Number(isActive),
          ).length,
      ),
      findById: jest.fn(async (routeId) => routes.find((r) => r.ROUTE_ID === Number(routeId)) || null),
      insert: jest.fn(async (conn, payload) => {
        const routeId = nextRouteId;
        nextRouteId += 1;
        routes.push({
          ROUTE_ID: routeId,
          ROUTE_NAME: payload.routeName,
          TOTAL_MINUTES: 0,
          DESCRIPTION: payload.description ?? null,
          IS_ACTIVE: payload.isActive,
        });
        routeStops.set(routeId, []);
        return routeId;
      }),
      listStops: jest.fn(async (routeId) => {
        const rows = (routeStops.get(Number(routeId)) || []).slice().sort((a, b) => a.STOP_SEQ - b.STOP_SEQ);
        return withStopName(rows);
      }),
      countStops: jest.fn(async (routeId) => (routeStops.get(Number(routeId)) || []).length),
      deleteAllStops: jest.fn(async (conn, routeId) => {
        const rows = routeStops.get(Number(routeId)) || [];
        const removed = rows.length;
        routeStops.set(Number(routeId), []);
        return removed;
      }),
      insertStop: jest.fn(async (conn, { routeId, stopId, stopSeq, travelMinutes }) => {
        const rows = routeStops.get(Number(routeId)) || [];
        rows.push({ ROUTE_ID: Number(routeId), STOP_ID: stopId, STOP_SEQ: stopSeq, TRAVEL_MINUTES: travelMinutes });
        routeStops.set(Number(routeId), rows);
        return 1;
      }),
      updateTotalMinutes: jest.fn(async (conn, { routeId, totalMinutes }) => {
        const row = routes.find((r) => r.ROUTE_ID === Number(routeId));
        row.TOTAL_MINUTES = totalMinutes;
        return 1;
      }),
      recalculateTotal: jest.fn(async (routeId) => {
        const rows = routeStops.get(Number(routeId)) || [];
        const total = rows.reduce((sum, r) => sum + Number(r.TRAVEL_MINUTES), 0);
        const row = routes.find((r) => r.ROUTE_ID === Number(routeId));
        if (row) row.TOTAL_MINUTES = total;
        return total;
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
    permissions: ['ROUTE.VIEW', 'ROUTE.EDIT', 'EMP.VIEW'],
    menus: [{ SCREEN_KEY: 'ROUTE_LIST', MENU_LABEL: 'เส้นทาง', SORT_NO: 20 }],
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

  return {
    repos,
    state: { stops, routes, routeStops, profiles, credentials, permissions, menus, roles, revoked, addEmployee },
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

// ================================================================ T-024 stops
describe('T-024 GET/POST /api/v1/stops (UC-11, BR-03)', () => {
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

  test('GET 200: รูป Stop ครบ (lat/lng/address nullable) + meta + จุดจอดที่ปิดใช้ยังอยู่ในรายการ', async () => {
    const res = await request(app).get('/api/v1/stops').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(4);
    expect(res.body.data[0]).toEqual({
      stop_id: 1,
      stop_name: 'มหาวิทยาลัยเทคโนโลยีมหานคร',
      address: 'ถนนชลบุรี แขวงหนองจอก เขตหนองจอก กรุงเทพมหานคร',
      latitude: 13.7795,
      longitude: 100.5457,
      is_active: 1,
    });
    // is_active = 0 ยัง list ได้ (คิวรีไม่กรองเมื่อไม่ส่ง query param)
    const inactive = res.body.data.find((s) => s.stop_id === 3);
    expect(inactive.is_active).toBe(0);
    expect(inactive.address).toBeNull();
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 4, total_pages: 1 });
  });

  test('GET 200: กรอง q / is_active ได้ · ค่าผิดถูกละแทนที่จะ 400 · clamp page/limit', async () => {
    const q = await request(app).get('/api/v1/stops?q=โลตัส').set(authHeader(token));
    expect(q.status).toBe(200);
    expect(q.body.data.map((s) => s.stop_id)).toEqual([2]);

    const activeOnly = await request(app).get('/api/v1/stops?is_active=1').set(authHeader(token));
    expect(activeOnly.body.data.map((s) => s.stop_id)).toEqual([1, 2, 4]);

    const bogus = await request(app).get('/api/v1/stops?is_active=9').set(authHeader(token));
    expect(bogus.status).toBe(200);
    expect(bogus.body.data).toHaveLength(4);

    const clamped = await request(app).get('/api/v1/stops?page=0&limit=9999').set(authHeader(token));
    expect(clamped.body.meta).toEqual({ page: 1, limit: 100, total: 4, total_pages: 1 });
  });

  test('POST 201: insert ใน transaction จริง + commit + ข้อความตามสเปก', async () => {
    const res = await request(app)
      .post('/api/v1/stops')
      .set(authHeader(token))
      .send({ stop_name: 'ป้ายหน้าวิศวะ', address: 'ซอย 5', latitude: 13.7801, longitude: 100.5462 });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('เพิ่มจุดจอดสำเร็จ ใช้งานได้ทุกเส้นทาง');
    expect(res.body.data).toEqual({
      stop_id: 50,
      stop_name: 'ป้ายหน้าวิศวะ',
      address: 'ซอย 5',
      latitude: 13.7801,
      longitude: 100.5462,
      is_active: 1,
    });
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(world.repos.stop.insert).toHaveBeenCalledTimes(1);
    expect(world.repos.stop.insert.mock.calls[0][0]).toBe(conn); // insert รันบน connection ของ transaction
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(world.state.stops).toHaveLength(5);
    expect(world.state.stops.find((s) => s.STOP_ID === 50)).toBeTruthy();
  });

  test('POST 409: stop_name ซ้ำ (uq_stop_name) — ไม่ insert', async () => {
    const res = await request(app)
      .post('/api/v1/stops')
      .set(authHeader(token))
      .send({ stop_name: 'โลตัสหนองจอก' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('ชื่อจุดจอดนี้มีอยู่แล้ว');
    expect(world.state.stops).toHaveLength(4);
    expect(conn.commit).not.toHaveBeenCalled();
  });

  test('POST 400: details ระดับ field — stop_name required · latitude ชนิดผิด · is_active นอก enum', async () => {
    const missing = await request(app).post('/api/v1/stops').set(authHeader(token)).send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error.details).toEqual([{ field: 'stop_name', message: 'is required' }]);

    const badLat = await request(app)
      .post('/api/v1/stops')
      .set(authHeader(token))
      .send({ stop_name: 'ป้าย ก', latitude: 'north' });
    expect(badLat.status).toBe(400);
    expect(badLat.body.error.details[0]).toMatchObject({ field: 'latitude' });

    const badActive = await request(app)
      .post('/api/v1/stops')
      .set(authHeader(token))
      .send({ stop_name: 'ป้าย ข', is_active: 7 });
    expect(badActive.status).toBe(400);
    expect(badActive.body.error.details[0]).toMatchObject({ field: 'is_active', message: 'must be one of: 0, 1' });
  });
});

describe('T-024 PUT/DELETE /api/v1/stops/{id}', () => {
  let world;
  let app;
  let conn;
  let token;

  beforeEach(async () => {
    world = createWorld();
    ({ app, conn } = setup(world));
    token = await tokenFor(app);
  });

  test('PUT 200: แก้ได้จริง + commit · ข้อความตามสเปก', async () => {
    const res = await request(app)
      .put('/api/v1/stops/2')
      .set(authHeader(token))
      .send({
        stop_name: 'โลตัสหนองจอก (อาคาร 2)',
        address: 'แขวงหนองจอก',
        latitude: 13.78,
        longitude: 100.55,
        is_active: 0,
      });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('แก้ไขจุดจอดสำเร็จ');
    expect(res.body.data).toMatchObject({
      stop_id: 2,
      stop_name: 'โลตัสหนองจอก (อาคาร 2)',
      latitude: 13.78,
      is_active: 0,
    });
    const row = world.state.stops.find((s) => s.STOP_ID === 2);
    expect(row.STOP_NAME).toBe('โลตัสหนองจอก (อาคาร 2)');
    expect(row.IS_ACTIVE).toBe(0);
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  test('PUT ไม่ส่ง is_active → คงค่าเดิม (ไม่ถูกเปิดใช้/ปิดใช้เงียบ ๆ)', async () => {
    const before = world.state.stops.find((s) => s.STOP_ID === 3).IS_ACTIVE; // = 0
    const res = await request(app)
      .put('/api/v1/stops/3')
      .set(authHeader(token))
      .send({ stop_name: 'โรงพยาบาลหนองจอก (เดิม)' });
    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(before);
    expect(world.state.stops.find((s) => s.STOP_ID === 3).IS_ACTIVE).toBe(before);
  });

  test('PUT 404 ไม่พบ · 409 ชื่อชนกับอีกจุด (exclude ตัวเอง)', async () => {
    const missing = await request(app)
      .put('/api/v1/stops/999')
      .set(authHeader(token))
      .send({ stop_name: 'ไม่มีอยู่' });
    expect(missing.status).toBe(404);
    expect(missing.body.error.message).toBe('ไม่พบข้อมูลที่ต้องการ');

    const dup = await request(app)
      .put('/api/v1/stops/2')
      .set(authHeader(token))
      .send({ stop_name: 'มหาวิทยาลัยเทคโนโลยีมหานคร' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toBe('ชื่อจุดจอดนี้มีอยู่แล้ว');

    const renameSelf = await request(app)
      .put('/api/v1/stops/1')
      .set(authHeader(token))
      .send({ stop_name: 'มหาวิทยาลัยเทคโนโลยีมหานคร' });
    expect(renameSelf.status).toBe(200); // ชื่อเดิมของตัวเองไม่ถือว่าซ้ำ
  });

  test('DELETE 200: จุดที่ไม่มี route_stop อ้าง → ลบจริง + commit', async () => {
    const res = await request(app).delete('/api/v1/stops/3').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('ลบจุดจอดสำเร็จ');
    expect(world.state.stops.find((s) => s.STOP_ID === 3)).toBeUndefined();
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  test('DELETE 422: ยังถูกใช้ใน route_stop (fk_rs_stop) → ไม่ลบ · 404 ไม่พบ', async () => {
    const busy = await request(app).delete('/api/v1/stops/1').set(authHeader(token));
    expect(busy.status).toBe(422);
    expect(busy.body.error.code).toBe('HAS_DEPENDENT_DATA');
    expect(busy.body.error.message).toBe('ยังมีเส้นทางที่ใช้จุดจอดนี้อยู่ กรุณาปิดใช้งานแทน');
    expect(world.state.stops.find((s) => s.STOP_ID === 1)).toBeTruthy();
    expect(conn.commit).not.toHaveBeenCalled();

    const missing = await request(app).delete('/api/v1/stops/999').set(authHeader(token));
    expect(missing.status).toBe(404);
    expect(missing.body.error.message).toBe('ไม่พบข้อมูลที่ต้องการ');
  });
});

// ================================================================ T-025 routes
describe('T-025 GET/POST /api/v1/routes (UC-12)', () => {
  let world;
  let app;
  let conn;
  let token;

  beforeEach(async () => {
    world = createWorld();
    ({ app, conn } = setup(world));
    token = await tokenFor(app);
  });

  test('GET 200: รูป Route — total_minutes (ค่าที่เก็บ) + stop_count จาก route_stop + meta', async () => {
    const res = await request(app).get('/api/v1/routes').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toEqual({
      route_id: 2,
      route_name: 'เส้นทางที่ 2',
      total_minutes: 99, // ค่าเก่าในตาราง — BR-01 จะถูกแก้โดย PUT / PUT recalculate
      stop_count: 3, // นับจาก route_stop จริง
      description: 'มหาวิทยาลัยฯ - โลตัส - ร้านส้มตำปูนาง',
      is_active: 1,
    });
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 2, total_pages: 1 });
  });

  test('GET 200: กรอง is_active · ค่าผิดเมิน · clamp', async () => {
    const inactive = await request(app).get('/api/v1/routes?is_active=0').set(authHeader(token));
    expect(inactive.body.data.map((r) => r.route_id)).toEqual([3]);

    const bogus = await request(app).get('/api/v1/routes?is_active=5').set(authHeader(token));
    expect(bogus.body.data).toHaveLength(2);

    const clamped = await request(app).get('/api/v1/routes?page=0&limit=9999').set(authHeader(token));
    expect(clamped.body.meta).toEqual({ page: 1, limit: 100, total: 2, total_pages: 1 });
  });

  test('POST 201: total_minutes ที่ผู้ใช้ส่งมาถูกเมิน — BR-01 service ตั้ง 0 เอง + stop_count 0', async () => {
    const res = await request(app)
      .post('/api/v1/routes')
      .set(authHeader(token))
      .send({ route_name: 'เส้นทางที่ 4', description: 'ใหม่', total_minutes: 999, is_active: 1 });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('เพิ่มเส้นทางสำเร็จ กรุณาเรียงจุดจอดต่อไป');
    expect(res.body.data).toMatchObject({
      route_id: 60,
      route_name: 'เส้นทางที่ 4',
      total_minutes: 0,
      stop_count: 0,
      is_active: 1,
    });
    expect(world.state.routes.find((r) => r.ROUTE_ID === 60).TOTAL_MINUTES).toBe(0);
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  test('POST 400 route_name required/ยาวเกิน · schema ไม่มี uq_route_name → ชื่อซ้ำสร้างได้ (สเปกไม่ประกาศ 409)', async () => {
    const missing = await request(app).post('/api/v1/routes').set(authHeader(token)).send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error.details).toEqual([{ field: 'route_name', message: 'is required' }]);

    const tooLong = await request(app)
      .post('/api/v1/routes')
      .set(authHeader(token))
      .send({ route_name: 'ก'.repeat(121) });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.details[0]).toMatchObject({ field: 'route_name' });

    const dupName = await request(app)
      .post('/api/v1/routes')
      .set(authHeader(token))
      .send({ route_name: 'เส้นทางที่ 2' });
    expect(dupName.status).toBe(201); // ตาม schema/17.5.2 — ไม่มี 409 ของ /routes
    expect(world.state.routes).toHaveLength(3);
  });
});

// ====================================================== T-026 GET route stops
describe('T-026 GET /api/v1/routes/{id}/stops', () => {
  let world;
  let app;
  let token;

  beforeEach(async () => {
    world = createWorld();
    ({ app } = setup(world));
    token = await tokenFor(app);
  });

  test('200: เรียงตาม stop_seq + stop_name join + total_minutes จาก route', async () => {
    const res = await request(app).get('/api/v1/routes/2/stops').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.route_id).toBe(2);
    expect(res.body.data.route_name).toBe('เส้นทางที่ 2');
    expect(res.body.data.total_minutes).toBe(99);
    expect(res.body.data.stops).toEqual([
      { route_id: 2, stop_id: 1, stop_seq: 1, travel_minutes: 0, stop_name: 'มหาวิทยาลัยเทคโนโลยีมหานคร' },
      { route_id: 2, stop_id: 2, stop_seq: 2, travel_minutes: 5, stop_name: 'โลตัสหนองจอก' },
      { route_id: 2, stop_id: 4, stop_seq: 3, travel_minutes: 4, stop_name: 'ร้านส้มตำปูนาง' },
    ]);
  });

  test('404: เส้นทางไม่มีอยู่', async () => {
    const res = await request(app).get('/api/v1/routes/999/stops').set(authHeader(token));
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('ไม่พบข้อมูลที่ต้องการ');
  });
});

// ====================================================== T-026 PUT route stops
describe('T-026 PUT /api/v1/routes/{id}/stops — เรียงใหม่ + BR-01 ใน transaction เดียว', () => {
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

  test('200: DELETE เดิม → INSERT ใหม่ → UPDATE total บน conn เดียว + commit + ข้อความ "เวลารวมทั้งเส้นทาง"', async () => {
    const res = await request(app)
      .put('/api/v1/routes/2/stops')
      .set(authHeader(token))
      .send({
        stops: [
          { stop_id: 1, stop_seq: 1, travel_minutes: 0 },
          { stop_id: 2, stop_seq: 2, travel_minutes: 6 },
          { stop_id: 4, stop_seq: 3, travel_minutes: 4 },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('เวลารวมทั้งเส้นทาง: 10 นาที');
    expect(res.body.data).toEqual({
      route_id: 2,
      total_minutes: 10,
      stops: [
        { route_id: 2, stop_id: 1, stop_seq: 1, travel_minutes: 0, stop_name: 'มหาวิทยาลัยเทคโนโลยีมหานคร' },
        { route_id: 2, stop_id: 2, stop_seq: 2, travel_minutes: 6, stop_name: 'โลตัสหนองจอก' },
        { route_id: 2, stop_id: 4, stop_seq: 3, travel_minutes: 4, stop_name: 'ร้านส้มตำปูนาง' },
      ],
    });

    const { repos } = world;
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(repos.route.deleteAllStops).toHaveBeenCalledTimes(1);
    expect(repos.route.insertStop).toHaveBeenCalledTimes(3);
    expect(repos.route.updateTotalMinutes).toHaveBeenCalledWith(conn, { routeId: 2, totalMinutes: 10 });
    // ลำดับคำสั่ง: DELETE → INSERT → UPDATE (bracket กัน insert กลางคัน)
    const calls = [
      repos.route.deleteAllStops.mock.invocationCallOrder[0],
      repos.route.insertStop.mock.invocationCallOrder[0],
      repos.route.updateTotalMinutes.mock.invocationCallOrder[0],
    ];
    expect([...calls].sort((a, b) => a - b)).toEqual(calls);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();

    // BR-01: ค่าในตารางถูกแทนด้วยผลรวมใหม่ (99 → 10)
    expect(world.state.routes.find((r) => r.ROUTE_ID === 2).TOTAL_MINUTES).toBe(10);
    expect(world.state.routeStops.get(2)).toHaveLength(3);
  });

  test('200: เปลี่ยนลำดับ+สลับจุด+เปลี่ยนนาที → รายการใหม่ทั้งหมด + total คำนวณใหม่ (BR-01)', async () => {
    const res = await request(app)
      .put('/api/v1/routes/2/stops')
      .set(authHeader(token))
      .send({
        stops: [
          { stop_id: 1, stop_seq: 1, travel_minutes: 0 },
          { stop_id: 4, stop_seq: 2, travel_minutes: 3 },
          { stop_id: 2, stop_seq: 3, travel_minutes: 9 },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('เวลารวมทั้งเส้นทาง: 12 นาที');
    expect(res.body.data.total_minutes).toBe(12);
    expect(res.body.data.stops.map((s) => [s.stop_id, s.stop_seq, s.travel_minutes])).toEqual([
      [1, 1, 0],
      [4, 2, 3],
      [2, 3, 9],
    ]);
    const stateRows = world.state.routeStops.get(2);
    expect(stateRows.map((r) => [r.STOP_ID, r.STOP_SEQ])).toEqual([
      [1, 1],
      [4, 2],
      [2, 3],
    ]);
    expect(world.state.routes.find((r) => r.ROUTE_ID === 2).TOTAL_MINUTES).toBe(12);
  });

  test('400: stop_seq ไม่ต่อเนื่อง 1..n → ข้อความตามสเปก · ไม่เข้า transaction', async () => {
    const res = await request(app)
      .put('/api/v1/routes/2/stops')
      .set(authHeader(token))
      .send({
        stops: [
          { stop_id: 1, stop_seq: 1, travel_minutes: 0 },
          { stop_id: 2, stop_seq: 3, travel_minutes: 5 },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe(SEQ_MESSAGE);
    expect(res.body.error.details[0]).toMatchObject({ field: 'stops' });
    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  test('400: stop_seq ซ้ำในรายการเดียว · travel_minutes ติดลบ · stop_id ไม่เป็นบวก · รายการว่าง/ผิดชนิด', async () => {
    const dupSeq = await request(app)
      .put('/api/v1/routes/2/stops')
      .set(authHeader(token))
      .send({
        stops: [
          { stop_id: 1, stop_seq: 2, travel_minutes: 0 },
          { stop_id: 2, stop_seq: 2, travel_minutes: 5 },
        ],
      });
    expect(dupSeq.status).toBe(400);
    expect(dupSeq.body.error.message).toBe(SEQ_MESSAGE);

    const negative = await request(app)
      .put('/api/v1/routes/2/stops')
      .set(authHeader(token))
      .send({ stops: [{ stop_id: 1, stop_seq: 1, travel_minutes: -5 }] });
    expect(negative.status).toBe(400);
    expect(negative.body.error.details[0]).toEqual({
      field: 'stops',
      message: 'travel_minutes must be an integer >= 0',
    });

    const zeroStop = await request(app)
      .put('/api/v1/routes/2/stops')
      .set(authHeader(token))
      .send({ stops: [{ stop_id: 0, stop_seq: 1, travel_minutes: 0 }] });
    expect(zeroStop.status).toBe(400);
    expect(zeroStop.body.error.details[0].message).toBe('stop_id must be a positive integer');

    const empty = await request(app)
      .put('/api/v1/routes/2/stops')
      .set(authHeader(token))
      .send({ stops: [] });
    expect(empty.status).toBe(400);
    expect(empty.body.error.details[0]).toEqual({ field: 'stops', message: 'must be a non-empty array' });

    const notArray = await request(app)
      .put('/api/v1/routes/2/stops')
      .set(authHeader(token))
      .send({ stops: 'nope' });
    expect(notArray.status).toBe(400);
    expect(notArray.body.error.details[0].field).toBe('stops');

    expect(db.withTransaction).not.toHaveBeenCalled();
    expect(world.state.routes.find((r) => r.ROUTE_ID === 2).TOTAL_MINUTES).toBe(99); // ของเดิมไม่แตะ
  });

  test('409: stop_id ซ้ำในเส้นทางเดียว (BR-03 / uq_route_stop_uk) — ไม่เข้า transaction', async () => {
    const res = await request(app)
      .put('/api/v1/routes/2/stops')
      .set(authHeader(token))
      .send({
        stops: [
          { stop_id: 1, stop_seq: 1, travel_minutes: 0 },
          { stop_id: 1, stop_seq: 2, travel_minutes: 5 },
        ],
      });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATED_STOP');
    expect(res.body.error.message).toBe(DUP_STOP_MESSAGE);
    expect(db.withTransaction).not.toHaveBeenCalled();
    expect(world.state.routeStops.get(2)).toHaveLength(3); // ของเดิมอยู่ครบ
  });

  test('404 เส้นทางไม่มีอยู่ · 422 stop_id ที่อ้างไม่มีจริง — ไม่เข้า transaction ทั้งคู่', async () => {
    const missingRoute = await request(app)
      .put('/api/v1/routes/999/stops')
      .set(authHeader(token))
      .send({ stops: [{ stop_id: 1, stop_seq: 1, travel_minutes: 0 }] });
    expect(missingRoute.status).toBe(404);
    expect(missingRoute.body.error.message).toBe('ไม่พบข้อมูลที่ต้องการ');

    const missingStop = await request(app)
      .put('/api/v1/routes/2/stops')
      .set(authHeader(token))
      .send({
        stops: [
          { stop_id: 1, stop_seq: 1, travel_minutes: 0 },
          { stop_id: 999, stop_seq: 2, travel_minutes: 5 },
        ],
      });
    expect(missingStop.status).toBe(422);
    expect(missingStop.body.error.code).toBe('FK_VIOLATION');
    expect(missingStop.body.error.message).toBe(REF_MESSAGE);

    expect(db.withTransaction).not.toHaveBeenCalled();
    expect(world.state.routeStops.get(2)).toHaveLength(3);
  });

  test('INSERT ล้มกลางทาง → rollback ทั้งชุด + 500 sanitized ไม่ leak · total เก่าไม่ถูกอัปเดตครึ่งกลาง', async () => {
    world.repos.route.insertStop.mockRejectedValueOnce(new Error('OraBoom-SENSITIVE-DETAIL'));
    const res = await request(app)
      .put('/api/v1/routes/2/stops')
      .set(authHeader(token))
      .send({
        stops: [
          { stop_id: 1, stop_seq: 1, travel_minutes: 0 },
          { stop_id: 2, stop_seq: 2, travel_minutes: 6 },
        ],
      });
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).toBe('เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง');
    expect(JSON.stringify(res.body)).not.toContain('OraBoom');
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(world.repos.route.updateTotalMinutes).not.toHaveBeenCalled();
    expect(world.state.routes.find((r) => r.ROUTE_ID === 2).TOTAL_MINUTES).toBe(99);
  });
});

// ================================================================ T-027 recalc
describe('T-027 POST /api/v1/routes/{id}/recalculate (BR-01)', () => {
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

  test('200: SUM(travel_minutes) ใหม่ = 9 (แก้ค่าเก่า 99) + stop_count + ไม่เปิด transaction (1 statement)', async () => {
    const res = await request(app).post('/api/v1/routes/2/recalculate').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('คำนวณเวลารวมใหม่แล้ว');
    expect(res.body.data).toEqual({ route_id: 2, total_minutes: 9, stop_count: 3 });
    expect(world.state.routes.find((r) => r.ROUTE_ID === 2).TOTAL_MINUTES).toBe(9);
    // OpenAPI: "1 statement จึงไม่ต้องเปิด Transaction แยก"
    expect(db.withTransaction).not.toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
  });

  test('200: เส้นทางยังไม่มีจุดจอด → total 0 / stop_count 0 (NVL)', async () => {
    const res = await request(app).post('/api/v1/routes/3/recalculate').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ route_id: 3, total_minutes: 0, stop_count: 0 });
  });

  test('404: เส้นทางไม่มีอยู่', async () => {
    const res = await request(app).post('/api/v1/routes/999/recalculate').set(authHeader(token));
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('ไม่พบข้อมูลที่ต้องการ');
  });
});

// ================================================================ guards
describe('T-024…T-027 สิทธิ์ ROUTE.VIEW/ROUTE.EDIT ทุก endpoint (โหลดจาก DB ทุก request)', () => {
  let world;
  let app;

  const READS = [
    ['get', '/api/v1/stops'],
    ['get', '/api/v1/routes'],
    ['get', '/api/v1/routes/2/stops'],
  ];
  const WRITES = [
    ['post', '/api/v1/stops'],
    ['put', '/api/v1/stops/1'],
    ['delete', '/api/v1/stops/1'],
    ['post', '/api/v1/routes'],
    ['put', '/api/v1/routes/2/stops'],
    ['post', '/api/v1/routes/2/recalculate'],
  ];

  beforeEach(() => {
    world = createWorld();
    ({ app } = setup(world));
  });

  test('ไม่มี token → 401 ทั้ง 9 endpoint', async () => {
    for (const [method, path] of [...READS, ...WRITES]) {
      const res = await request(app)[method](path).send({});
      expect([method, path, res.status]).toEqual([method, path, 401]);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  test('มี ROUTE.VIEW อย่างเดียว → อ่านได้ 3 · เขียน 6 ตัว → 403', async () => {
    const token = await tokenFor(app, 'viewer', VIEWER_PASS);
    for (const [method, path] of READS) {
      const res = await request(app)[method](path).set(authHeader(token));
      expect([method, path, res.status]).toEqual([method, path, 200]);
    }
    for (const [method, path] of WRITES) {
      const res = await request(app)[method](path).set(authHeader(token)).send({});
      expect([method, path, res.status]).toEqual([method, path, 403]);
      expect(res.body.error.message).toBe('ไม่มีสิทธิ์เข้าถึงส่วนนี้');
    }
  });

  test('ไม่มีสิทธิ์ ROUTE เลย → GET /stops 403 (ไม่ใช่ 200/401)', async () => {
    const token = await tokenFor(app, 'outsider', OUTSIDER_PASS);
    const res = await request(app).get('/api/v1/stops').set(authHeader(token));
    expect(res.status).toBe(403);
  });

  test('ถอดสิทธิ์ระหว่าง session → 403 ทันที ไม่ต้อง login ใหม่ (DB ทุก request)', async () => {
    const token = await tokenFor(app);
    const before = await request(app).get('/api/v1/stops').set(authHeader(token));
    expect(before.status).toBe(200);

    world.state.permissions.set(1, []); // ถอด ROUTE.VIEW/ROUTE.EDIT ออกจาก admin

    const after = await request(app).get('/api/v1/stops').set(authHeader(token));
    expect(after.status).toBe(403);
    expect(after.body.error.message).toBe('ไม่มีสิทธิ์เข้าถึงส่วนนี้');
  });

  test('wiring: front.routes.js มี 9 operations (เท่า 17.5.2) — ทุกอันมี guard, ไม่มี endpoint ที่สเปกไม่ประกาศ', async () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/routes/front.routes.js'), 'utf8');
    const operations = source.match(/router\.(get|post|put|delete)\(/g) || [];
    expect(operations).toHaveLength(9);
    const guarded = source.match(/^\s+(viewGuard|editGuard),\s*$/gm) || [];
    expect(guarded).toHaveLength(9);
    expect(source).toContain("requirePermission('ROUTE.VIEW')");
    expect(source).toContain("requirePermission('ROUTE.EDIT')");

    // ไม่มี PUT/DELETE /routes/{id} (นอกเหนือ /:id/stops, /:id/recalculate) — 17.5.2 ไม่ประกาศ
    const token = await tokenFor(app);
    const putRes = await request(app).put('/api/v1/routes/2').set(authHeader(token)).send({ route_name: 'x' });
    const delRes = await request(app).delete('/api/v1/routes/2').set(authHeader(token));
    expect(putRes.status).toBe(404);
    expect(delRes.status).toBe(404);
  });
});

// ================================================================ SQL static
describe('repository SQL — bind variables, ไม่ใช้ SELECT *, BR-01 ไม่รับค่าจากผู้ใช้', () => {
  beforeEach(() => {
    dbMock.query.mockReset();
    dbMock.query.mockResolvedValue({ rows: [] });
  });

  test('stop.list/count: LIKE มี ESCAPE + isActive bind + ORDER BY + OFFSET (ไม่ SELECT *)', async () => {
    await stopRepo.list({ q: 'a%b_c', isActive: 0, limit: 20, offset: 40 });
    let [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).toContain("LIKE :q ESCAPE '\\'");
    expect(sql).toContain('is_active = :isActive');
    expect(sql).toContain('ORDER BY stop_id');
    expect(sql).toContain('OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY');
    expect(sql).not.toContain('SELECT *');
    expect(binds).toEqual({ q: '%a\\%b\\_c%', isActive: 0, offset: 40, limit: 20 });

    dbMock.query.mockClear();
    await stopRepo.count({ isActive: 1 });
    [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).toContain('SELECT COUNT(*) AS total FROM stop WHERE is_active = :isActive');
    expect(binds).toEqual({ isActive: 1 });
  });

  test('stop.findByName: ค่าเป็น bind · exclude เป็น bind ไม่ interpolation', async () => {
    await stopRepo.findByName("x' OR 1=1 --", 5);
    const [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).toContain('AND stop_id <> :excludeStopId');
    expect(sql).not.toContain("x' OR 1=1");
    expect(binds).toEqual({ stopName: "x' OR 1=1 --", excludeStopId: 5 });
  });

  test('stop.insert: RETURNING id + bind ทั้งแถว · ค่าแปลก ๆ ไม่ต่อเข้า SQL', async () => {
    const conn = makeConn();
    conn.execute.mockResolvedValueOnce({ outBinds: { newId: 77 } });
    const evil = "x'); DROP TABLE stop; --";
    const id = await stopRepo.insert(conn, {
      stopName: evil,
      address: null,
      latitude: null,
      longitude: null,
      isActive: 1,
    });
    expect(id).toBe(77);
    const [sql, binds] = conn.execute.mock.calls[0];
    expect(sql).toContain('RETURNING stop_id INTO :newId');
    expect(sql).not.toContain('DROP TABLE');
    expect(binds.stopName).toBe(evil);
    expect(binds.newId).toMatchObject({ dir: expect.anything() });
  });

  test('stop ที่ถูกอ้างใน route_stop: count + findExistingIds ใช้ bind p0,p1 (ไม่ interpolation)', async () => {
    await stopRepo.countRoutesUsingStop(1);
    let [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).toContain('SELECT COUNT(*) AS total FROM route_stop WHERE stop_id = :stopId');
    expect(binds).toEqual({ stopId: 1 });

    dbMock.query.mockClear();
    dbMock.query.mockResolvedValueOnce({ rows: [{ STOP_ID: 1 }] });
    await stopRepo.findExistingIds([1, 999]);
    [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).toContain('WHERE stop_id IN (:p0, :p1)');
    expect(sql).not.toContain('999');
    expect(binds).toEqual({ p0: 1, p1: 999 });
  });

  test('route.list: stop_count มานับจาก route_stop (subquery) + isActive bind · route.insert ไม่แตะ total_minutes (BR-01)', async () => {
    await routeRepo.list({ isActive: 1, limit: 20, offset: 0 });
    let [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).toContain('SELECT COUNT(*) FROM route_stop rs WHERE rs.route_id = r.route_id');
    expect(sql).toContain('AS stop_count');
    expect(sql).toContain('ORDER BY r.route_id');
    expect(sql).toContain('OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY');
    expect(sql).not.toContain('SELECT *');
    expect(binds).toEqual({ offset: 0, limit: 20, isActive: 1 });

    const conn = makeConn();
    conn.execute.mockResolvedValueOnce({ outBinds: { newId: 60 } });
    await routeRepo.insert(conn, { routeName: 'ใหม่', description: null, isActive: 1 });
    const [insertSql, insertBinds] = conn.execute.mock.calls[0];
    expect(insertSql).toContain('INSERT INTO route (route_name, description, is_active)');
    expect(insertSql).toContain('RETURNING route_id INTO :newId');
    expect(insertSql).not.toContain('total_minutes'); // ผู้ใช้พิมพ์ค่านี้เองไม่ได้
    expect(insertBinds).toMatchObject({ routeName: 'ใหม่', description: null, isActive: 1 });
  });

  test('route.listStops เรียง stop_seq + JOIN stop_name · DELETE/INSERT/UPDATE route_stop เป็น bind ทั้งหมด', async () => {
    await routeRepo.listStops(2);
    let [sql, binds] = dbMock.query.mock.calls[0];
    expect(sql).toContain('JOIN stop s ON s.stop_id = rs.stop_id');
    expect(sql).toContain('ORDER BY rs.stop_seq');
    expect(sql).not.toContain('SELECT *');
    expect(binds).toEqual({ routeId: 2 });

    const conn = makeConn();
    await routeRepo.deleteAllStops(conn, 2);
    [sql, binds] = conn.execute.mock.calls[0];
    expect(sql).toContain('DELETE FROM route_stop WHERE route_id = :routeId');
    expect(binds).toEqual({ routeId: 2 });

    await routeRepo.insertStop(conn, { routeId: 2, stopId: 4, stopSeq: 3, travelMinutes: 9 });
    [sql, binds] = conn.execute.mock.calls[1];
    expect(sql).toContain('INSERT INTO route_stop (route_id, stop_id, stop_seq, travel_minutes)');
    expect(binds).toEqual({ routeId: 2, stopId: 4, stopSeq: 3, travelMinutes: 9 });

    await routeRepo.updateTotalMinutes(conn, { routeId: 2, totalMinutes: 9 });
    [sql, binds] = conn.execute.mock.calls[2];
    expect(sql).toContain('UPDATE route SET total_minutes = :totalMinutes WHERE route_id = :routeId');
    expect(binds).toEqual({ routeId: 2, totalMinutes: 9 });
  });

  test('route.recalculateTotal: correlated SUM + RETURNING + autoCommit:true (1 statement, ไม่พึ่ง transaction)', async () => {
    dbMock.query.mockResolvedValueOnce({ outBinds: { newTotal: 13 } });
    const total = await routeRepo.recalculateTotal(2);
    expect(total).toBe(13);
    const [sql, binds, opts] = dbMock.query.mock.calls[0];
    expect(sql).toContain('SUM(travel_minutes)');
    expect(sql).toContain('NVL');
    expect(sql).toContain('RETURNING total_minutes INTO :newTotal');
    expect(sql).not.toContain('route_id = 2'); // ค่า route_id ต้องอยู่ใน bind ไม่ใช่ใน SQL
    expect(binds).toMatchObject({ routeId: 2 });
    expect(opts).toEqual({ autoCommit: true });
  });
});
