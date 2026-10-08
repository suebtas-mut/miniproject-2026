// T-011: GET /health — พฤติกรรมจริงของ endpoint ด้วย mocked DB health check
jest.mock('../src/config/db', () => ({
  checkDbHealth: jest.fn(),
  initPool: jest.fn(),
  closePool: jest.fn(),
  getPool: jest.fn(),
  query: jest.fn(),
}));

const request = require('supertest');
const { checkDbHealth } = require('../src/config/db');
const { createApp } = require('../src/app');

describe('GET /health (T-011)', () => {
  test('ตอบ 200 เมื่อ Oracle เชื่อมต่อได้', async () => {
    checkDbHealth.mockResolvedValue({ connected: true, latencyMs: 5 });
    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'connected', latencyMs: 5 });
    expect(res.body.timestamp).toBeDefined();
  });

  test('ตอบ 503 เมื่อ healthCheck throw (Oracle ไม่ available) และไม่ leak ข้อความภายใน', async () => {
    checkDbHealth.mockRejectedValue(new Error('ORA-01017: invalid username/password; logon denied'));
    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'error', database: 'unavailable' });
    // sanitized: ห้ามมีข้อความ exception จริง / error code ของ Oracle ใน response
    expect(res.body.message).toBe('Database unavailable');
    expect(JSON.stringify(res.body)).not.toMatch(/ORA-|NJS-|logon denied|username/);
  });

  test('ตอบ 503 (ไม่ใช่ 200) เมื่อ healthCheck คืน connected:false', async () => {
    checkDbHealth.mockResolvedValue({ connected: false });
    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'error', database: 'unavailable', message: 'Database unavailable' });
    expect(JSON.stringify(res.body)).not.toMatch(/ORA-|NJS-/);
  });

  test('route ที่ไม่มีในระบบตอบ 404 ผ่าน notFoundHandler', async () => {
    checkDbHealth.mockResolvedValue({ connected: true, latencyMs: 1 });
    const app = createApp();
    const res = await request(app).get('/no-such-route');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});
