// backend/tests/sprint15.test.js — Sprint 15 RED TEAM pentest PoC (self-target: ระบบของเก่งกาญ)
// บทบาท: ผู้โจมตีที่มี foothold = account 'mai' (สิทธิ์ BK.* เท่านั้น) + ไม่มี token (unauthenticated)
//        และสมมติว่าได้มาซึ่ง session token ของ admin หนึ่งใบ (token-disclosure) สำหรับ chain RT-B
//
// ⚠️ ความหมายของ test ไฟล์นี้ — ต่างจากไฟล์อื่น:
//   - block RT-A/RT-B = PoC ที่ assert ว่า "ช่องโหว่/การโจมตี สำเร็จ" (exploit SUCCEEDS)
//   - block RT-C/RT-D = defense battery: การโจมตีที่ต้อง "ล้มเหลว" (system รับมือได้)
//   - block RT-E     = detection: หลักฐานว่าการยึดระบบถูกบันทึก/ไม่ถูกบันทึกตรงไหน
//   → เมื่อมีการแก้ช่องโหว่ในอนาคต test block A/B/E(some) จะ fail = เป็นสัญญาณว่า remediation สำเร็จ
//     (เขียนไว้ใน header นี้เพื่อไม่ให้สับสนว่า test พัง = ระบบพัง)
// โครง harness: แบบ sprint13/14 (fake repos + stateful blacklist + TX conn) · ไม่มี Oracle จริง · ไม่มี external scan
// findings อ้างอิง: docs/security/sprint15-redteam-report.md (RT-F001..RT-F003)

process.env.JWT_SECRET = 'sprint15-test-secret-0123456789abcdef0123456789abcdef';
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
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const { createApp } = require('../src/app');
const dbMock = require('../src/config/db');
const env = require('../src/config/env');
const { resetLoginAttempts, LOGIN_MAX_ATTEMPTS } = require('../src/middleware/auth');
const realRepos = require('../src/repositories');

const ADMIN_PASS = 'AdminPass123';
const CUSTOMER_PASS = 'CustomerPass123';
const PWNED_PASS = 'PwnedByRedTeam15';

const UNAUTHORIZED_MSG = 'กรุณาเข้าสู่ระบบใหม่';
const GUARD_MSG = 'ไม่มีสิทธิ์เข้าถึงส่วนนี้';
const FOREIGN_CANCEL_MSG = 'ยกเลิกได้เฉพาะรายการของตัวเองเท่านั้น';
const FOREIGN_QR_MSG = 'ไม่มีสิทธิ์ดู QR ของการจองนี้';

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

// ---------------------------------------------------------------- helpers: TX (commit/rollback/close จริงแบบ sprint14)
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

// ---------------------------------------------------------------- fake world
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
      IS_ACTIVE: 1,
      CREATED_AT: new Date(t0 - 86400000),
      ROLES: (o.roles || []).join(','),
    };
    profiles.set(row.EMP_ID, row);
    credentials.set(row.EMP_ID, { EMP_ID: row.EMP_ID, USERNAME: row.USERNAME, PASSWORD_HASH: o.passwordHash, IS_ACTIVE: 1 });
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
  addEmployee({ empId: 7, username: 'mai', fullName: 'มานี รักดี', passwordHash: bcrypt.hashSync(CUSTOMER_PASS, 4), roles: ['CUSTOMER'], permissions: ['BK.VIEW', 'BK.CREATE', 'BK.CANCEL'] });

  // booking ของคนอื่น (cust 99) — เป็นเป้าหมาย IDOR ที่ต้องถูกบล็อก
  const booking2 = {
    BOOKING_ID: 2, BOOKING_CODE: 'BK0002', CUST_ID: 99, CUST_NAME: 'คนอื่น ทดสอบ',
    SCHED_ID: 20, BOARD_STOP_ID: 1, BOARD_STOP_NAME: 'หน้ามหาวิทยาลัย',
    ALIGHT_STOP_ID: 2, ALIGHT_STOP_NAME: 'โลตัส', SEATS: 1, STATUS: 'reserved',
    BOOK_TIME: new Date(t0 - 3600000), CANCEL_TIME: null,
    SERVICE_DATE: new Date(t0 + 5 * 86400000), DEPART_AT: new Date(t0 + 5 * 86400000 + 3600000),
    ROUTE_NAME: 'เส้นทาง 1', PLATE_NO: 'กข 1234', DRIVER_NAME: 'สมชาย ขับรถ',
    BOARD_ARRIVE_AT: new Date(t0 + 3600000),
    QR_TOKEN: 'f'.repeat(32),
  };

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
      blacklistToken: jest.fn(async (payload) => {
        revoked.push({ JTI: payload.jti, REVOKED_AT: new Date(), EXPIRES_AT: payload.expiresAt });
      }),
      deleteExpiredBlacklist: jest.fn(async () => {}),
    },
    employee: {
      ...realRepos.employee,
      findEmployeeById: jest.fn(async (empId) => profiles.get(Number(empId)) || null),
      updatePassword: jest.fn(async (conn, { empId, passwordHash }) => {
        const cred = credentials.get(Number(empId));
        if (cred) cred.PASSWORD_HASH = passwordHash;
      }),
    },
    booking: {
      ...realRepos.booking,
      lockBooking: jest.fn(async (conn, bookingId) =>
        Number(bookingId) === booking2.BOOKING_ID ? { ...booking2 } : null,
      ),
      cancelBooking: jest.fn(async () => {}),
      findDetails: jest.fn(async (bookingId) =>
        Number(bookingId) === booking2.BOOKING_ID ? { ...booking2 } : null,
      ),
      countMine: jest.fn(async () => 0),
      listMine: jest.fn(async () => []),
    },
  };

  return { repos, state: { profiles, credentials, permissions, roles, revoked, booking2, ADMIN_PERMS } };
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

// ================================================== RT-A — rate-limit bypass (RT-F001)
describe('RT-A ช่องโหว่: login rate limit bypass ด้วยการ mutate username (RT-F001)', () => {
  let world;
  let app;

  beforeEach(() => {
    world = createWorld();
    ({ app } = setup(world));
  });

  test('baseline: key เดิมถูกคุมจริง — ล้มเหลว 5 ครั้ง → ครั้งที่ 6 = 429 (control ปกติทำงาน)', async () => {
    for (let i = 1; i <= LOGIN_MAX_ATTEMPTS; i += 1) {
      const res = await request(app).post('/api/v1/auth/login').send({ username: 'ghost-rt', password: 'WrongPass123' });
      expect(res.status).toBe(401);
    }
    const blocked = await request(app).post('/api/v1/auth/login').send({ username: 'ghost-rt', password: 'WrongPass123' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_ATTEMPTS');
  });

  test('exploit: ล็อก key `ip|admin` แล้วแต่ยังคงยิงต่อได้ไม่จำกัดด้วย username variant — ไม่มีทางใดโดน 429 (RT-F001)', async () => {
    // 1) โจมตี key ปกติจน control ทำงาน
    for (let i = 1; i <= LOGIN_MAX_ATTEMPTS; i += 1) {
      const res = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'WrongPass123' });
      expect(res.status).toBe(401);
    }
    const locked = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'WrongPass123' });
    expect(locked.status).toBe(429); // control บอกว่า "หยุดแล้ว"

    // 2) แต่ limiter key = `${ip}|${req.body.username}` ดิบ (วิ่งก่อน validate) → ทุก variant = ก้อนนับใหม่
    const variants = ['admin ', 'admin  ', ' admin', 'Admin', 'ADMIN', 'admin\t'];
    const afterLock = [];
    for (const username of variants) {
      for (let i = 1; i <= 2; i += 1) {
        const res = await request(app).post('/api/v1/auth/login').send({ username, password: 'WrongPass123' });
        afterLock.push(res.status);
      }
    }

    // 3) ผลลัพธ์: ความพยายามหลังถูกล็อกทั้งหมด = 12 ครั้ง ไม่มีครั้งไหนโดน 429 → brute force ต่อได้ไม่จำกัด
    expect(afterLock.length).toBe(12);
    expect(afterLock.length).toBeGreaterThan(LOGIN_MAX_ATTEMPTS);
    expect(afterLock.every((s) => s === 401)).toBe(true);
    expect(afterLock).not.toContain(429);
    // นัยยะ production (static — ดู report): Oracle `WHERE username = :username` เมิน trailing space
    // → variant อย่าง 'admin ' / 'admin  ' จะชี้กลับไปบัญชี admin จริง ในขณะที่ limiter มองเป็นคนละ key
  });
});

// ================================================== RT-B — full takeover chain (RT-F002)
describe('RT-B สายโจมตี: ยึดระบบ admin สำเร็จ — token → brute change-password ไม่มี limiter → revoke ทุก session → re-login (RT-F002)', () => {
  let world;
  let app;

  beforeEach(() => {
    world = createWorld();
    ({ app } = setup(world));
  });

  test('PoC ครบสาย: เปลี่ยนรหัสผ่าน admin ได้แม้ control 5/15min ใช้กับ endpoint นี้ไม่ได้ — เจ้าของถูกเตะออก ผู้โจมตีเข้ายึดได้', async () => {
    // ---- step 0: ผู้โจมตีมี session token ของ admin อยู่ 2 ใบ (สมมติ token-disclosure)
    const victimToken1 = await tokenFor(app, 'admin', ADMIN_PASS);
    const victimToken2 = await tokenFor(app, 'admin', ADMIN_PASS);
    expect((await request(app).get('/api/v1/auth/me').set(authHeader(victimToken1))).status).toBe(200);
    expect((await request(app).get('/api/v1/auth/me').set(authHeader(victimToken2))).status).toBe(200);

    // ---- step 1: control เปรียบเทียบ — /login มี limiter 5 ครั้ง → 429
    for (let i = 1; i <= LOGIN_MAX_ATTEMPTS; i += 1) {
      const r = await request(app).post('/api/v1/auth/login').send({ username: 'ghost-rt', password: 'WrongPass123' });
      expect(r.status).toBe(401);
    }
    const loginThrottled = await request(app).post('/api/v1/auth/login').send({ username: 'ghost-rt', password: 'WrongPass123' });
    expect(loginThrottled.status).toBe(429); // มี control ที่ /login

    // ---- step 2: แต่ /auth/change-password ไม่มี rate limiter เลย → ยิงเดา old_password ต่อเนื่อง 10 ครั้ง (>5) ไม่มี 429
    const guesses = [];
    for (let i = 1; i <= 10; i += 1) {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set(authHeader(victimToken1))
        .send({ old_password: `WordlistGuess${String(i).padStart(2, '0')}`, new_password: 'TempGuess1234', confirm_password: 'TempGuess1234' });
      guesses.push(res.status);
      expect(res.status).toBe(401); // เดาผิด → 401 ตลอด ไม่ใช่ 429
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    }
    expect(guesses.length).toBe(10);
    expect(guesses.length).toBeGreaterThan(LOGIN_MAX_ATTEMPTS); // เกินเพดานที่ /login มี — แต่ endpoint นี้ไม่มี
    expect(guesses).not.toContain(429);

    // ---- step 3: เดาถูก (wordlist ตรงรหัสผ่านจริง) → สำเร็จ → รหัสผ่านเปลี่ยน + revoke ทุก session
    const pwn = await request(app)
      .post('/api/v1/auth/change-password')
      .set(authHeader(victimToken1))
      .send({ old_password: ADMIN_PASS, new_password: PWNED_PASS, confirm_password: PWNED_PASS });
    expect(pwn.status).toBe(200);
    expect(pwn.body.success).toBe(true);

    // ---- step 4: เจ้าของ + session อื่น ๆ ตายหมด (marker REVOKE_ALL)
    const victim1 = await request(app).get('/api/v1/auth/me').set(authHeader(victimToken1));
    expect(victim1.status).toBe(401);
    expect(victim1.body.error.code).toBe('TOKEN_REVOKED');
    const victim2 = await request(app).get('/api/v1/auth/me').set(authHeader(victimToken2));
    expect(victim2.status).toBe(401);
    expect(victim2.body.error.code).toBe('TOKEN_REVOKED');

    // ---- step 5: ผู้โจมตีเข้าสู่ระบบถาวรด้วยรหัสผ่านใหม่ + ใช้สิทธิ์ admin เต็มรูปแบบ
    const attackerLogin = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: PWNED_PASS });
    expect(attackerLogin.status).toBe(200);
    const attackerToken = attackerLogin.body.data.access_token;
    expect(attackerLogin.body.data.permissions).toEqual(expect.arrayContaining(['EMP.VIEW', 'EMP.EDIT', 'ROLE.EDIT']));

    const employees = await request(app).get('/api/v1/employees').set(authHeader(attackerToken));
    expect(employees.status).toBe(200); // ข้อมูลบุคลากรทั้งองค์กรอยู่ในมือผู้โจมตีแล้ว

    const oldPassLogin = await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: ADMIN_PASS });
    expect(oldPassLogin.status).toBe(401); // เจ้าของกลับเข้าไม่ได้แล้ว

    // ==== TAKEOVER สำเร็จ: ผู้โจมตีถือ credential ที่ใช้ได้ถาวร · เจ้าของถูกล็อกนอกบัญชี ====
  });
});

// ================================================== RT-C — defense battery (ต้องล้มเหลว)
describe('RT-C defense battery: ผู้โจมตีสิทธิ์ต่ำ (mai) ไม่มีทางขึ้นสิทธิ์ admin — endpoint ปกครองทั้งหมดต้อง 403', () => {
  let world;
  let app;
  let maiToken;

  beforeEach(async () => {
    world = createWorld();
    ({ app } = setup(world));
    maiToken = await tokenFor(app, 'mai', CUSTOMER_PASS);
  });

  test('ยิง 16 privileged endpoints ด้วย token ลูกค้า → 403 FORBIDDEN ทุกตัว ไม่มีตัวไหนหลุด', async () => {
    const attempts = [
      ['get', '/api/v1/employees', undefined],
      ['post', '/api/v1/employees', {}],
      ['delete', '/api/v1/departments/1', undefined],
      ['post', '/api/v1/positions', {}],
      ['post', '/api/v1/roles', { role_name: 'HACK_ROLE' }],
      ['put', '/api/v1/permission-matrix', { role_id: 1, perm_ids: [1] }],
      ['post', '/api/v1/permissions', { perm_code: 'HACK.PERM', perm_name: 'hack', module: 'master' }],
      ['post', '/api/v1/stops', { stop_name: 'hijack' }],
      ['post', '/api/v1/routes', { route_name: 'hijack' }],
      ['put', '/api/v1/routes/1/stops', { stops: [] }],
      ['post', '/api/v1/vehicles', { plate_no: 'XX 0000', vtype_id: 1 }],
      ['post', '/api/v1/schedules', {}],
      ['post', '/api/v1/schedules/1/assign-driver', { emp_id: 1 }],
      ['get', '/api/v1/report/daily-by-route', undefined],
      ['post', '/api/v1/driver/trip/scan', { trip_id: 1, qr_token: 'q'.repeat(32) }],
      ['post', '/api/v1/driver/trip/1/start', undefined],
    ];

    const escaped = [];
    for (const [method, path, body] of attempts) {
      let req = request(app)[method](path).set(authHeader(maiToken));
      if (body !== undefined) req = req.send(body);
      const res = await req;
      if (res.status !== 403 || res.body.error?.code !== 'FORBIDDEN' || res.body.error?.message !== GUARD_MSG) {
        escaped.push(`${method.toUpperCase()} ${path} → ${res.status} ${JSON.stringify(res.body).slice(0, 160)}`);
      }
    }
    expect(escaped).toEqual([]); // มีตัวไหนไม่ใช่ 403 = privilege escalation หลุด
  });
});

// ================================================== RT-D — IDOR + forged token (ต้องล้มเหลว)
describe('RT-D defense battery: บุกรุกทรัพย์สินคนอื่น +  forged token — ต้องถูกบล็อก', () => {
  let world;
  let app;
  let maiToken;

  beforeEach(async () => {
    world = createWorld();
    ({ app } = setup(world));
    maiToken = await tokenFor(app, 'mai', CUSTOMER_PASS);
  });

  test('IDOR: ยกเลิก/อ่าน QR จองของคนอื่น → 403 พร้อมข้อความ openapi (ไม่มี data leak)', async () => {
    const cancel = await request(app).post('/api/v1/booking/2/cancel').set(authHeader(maiToken));
    expect(cancel.status).toBe(403);
    expect(cancel.body.error.code).toBe('FORBIDDEN');
    expect(cancel.body.error.message).toBe(FOREIGN_CANCEL_MSG);
    expect(world.state.booking2.STATUS).toBe('reserved'); // สถานะไม่ถูกแตะ

    const qr = await request(app).get('/api/v1/booking/2/qr').set(authHeader(maiToken));
    expect(qr.status).toBe(403);
    expect(qr.body.error.code).toBe('FORBIDDEN');
    expect(qr.body.error.message).toBe(FOREIGN_QR_MSG);
    expect(JSON.stringify(qr.body)).not.toContain('f'.repeat(32)); // qr_token ไม่หลุด
  });

  test('forged token (alg=none / ลายเซ็นปลอม) ยังถูกบล็อก — ช่องโหว่ sprint14 ไม่กลับมา', async () => {
    const now = Math.floor(Date.now() / 1000);
    const claims = { empId: 1, jti: 'forged', iat: now, exp: now + 3600, iss: env.jwt.issuer };
    const algNone = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(claims)}.`;
    const forged = jwt.sign({ empId: 1, jti: 'forged' }, 'not-the-real-secret', { expiresIn: '1h', issuer: env.jwt.issuer });

    for (const token of [algNone, forged]) {
      const me = await request(app).get('/api/v1/auth/me').set(authHeader(token));
      expect(me.status).toBe(401);
      expect(me.body.error.code).toBe('UNAUTHORIZED');
    }
  });
});

// ================================================== RT-E — detection (audit trail)
describe('RT-E detection: การยึดระบบถูกบันทึกตรงไหน (RT-F003)', () => {
  let world;
  let app;
  let auditSink;

  beforeEach(() => {
    world = createWorld();
    ({ app, auditSink } = setup(world));
  });

  test('งานเขียน (login/change-password) ถูก audit ครบ empId+ip แต่การอ่านข้อมูล (GET) ไม่ถูก audit — ช่อง exfiltration เงียบ', async () => {
    const token = await tokenFor(app, 'admin', ADMIN_PASS);

    // งานเขียนที่เกี่ยวกับการยึดระบบ → ถูกบันทึก
    await request(app).post('/api/v1/auth/login').send({ username: 'admin', password: 'WrongPass123' }); // 401 fail attempt
    await request(app)
      .post('/api/v1/auth/change-password')
      .set(authHeader(token))
      .send({ old_password: 'WrongOld999', new_password: 'TempGuess1234', confirm_password: 'TempGuess1234' }); // 401

    const entries = auditSink.mock.calls.map((c) => c[0]);
    const loginEntry = entries.find((e) => e.path === '/api/v1/auth/login' && e.statusCode === 401);
    expect(loginEntry).toBeTruthy();
    expect(loginEntry.empId).toBeNull(); // fail ก่อน authenticate → empId null แต่มี ip
    expect(loginEntry.ip).toBeTruthy();

    const changeEntry = entries.find((e) => e.path === '/api/v1/auth/change-password' && e.statusCode === 401);
    expect(changeEntry).toBeTruthy();
    expect(changeEntry.empId).toBe(1); // ใคร (empId) พยายามเปลี่ยนรหัสผ่าน → audit มีหลักฐาน
    expect(changeEntry.ip).toBeTruthy();

    // แต่การ "อ่าน" ข้อมูลองค์กรไม่เข้า audit เลย (audit.js: GET ไม่ถูก audit)
    const writesBefore = auditSink.mock.calls.length;
    const exfil = await request(app).get('/api/v1/employees').set(authHeader(token));
    expect(exfil.status).toBe(200);
    expect(auditSink.mock.calls.length).toBe(writesBefore); // GET /employees ไม่สร้าง entry → RT-F003
  });
});
