// T-012: middleware — validate, errorHandler, audit, logger
const request = require('supertest');
const { createApp } = require('../src/app');
const { validate } = require('../src/middleware/validate');
const { errorHandler, notFoundHandler, HttpError } = require('../src/middleware/errorHandler');
const { audit } = require('../src/middleware/audit');

jest.mock('../src/config/db', () => ({
  checkDbHealth: jest.fn().mockResolvedValue({ connected: true, latencyMs: 1 }),
}));

describe('validate middleware (T-012)', () => {
  const mw = validate({
    name: { required: true, type: 'string', maxLength: 10 },
    age: { type: 'integer' },
    status: { enum: ['active', 'inactive'] },
  });

  function fakeRes() {
    const res = { statusCode: 200, body: null };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    return res;
  }

  test('ผ่านเมื่อข้อมูลถูกต้อง', () => {
    const next = jest.fn();
    mw({ body: { name: 'OK', age: 5, status: 'active' } }, fakeRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('ตอบ 400 เมื่อ required field หายไป', () => {
    const res = fakeRes();
    mw({ body: {} }, res, jest.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.errors[0]).toContain('name');
  });

  test('ตอบ 400 เมื่อ type / maxLength / enum ไม่ถูก', () => {
    const res = fakeRes();
    mw({ body: { name: 'too-long-value', age: 1.5, status: 'unknown' } }, res, jest.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toHaveLength(3);
  });
});

describe('errorHandler + notFound (T-012)', () => {
  test('HttpError ที่ expose คืน statusCode และ message', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    errorHandler(new HttpError(409, 'duplicate'), {}, res, null);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toBe('duplicate');
  });

  test('error ที่ไม่ระบุ statusCode คืน 500', () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    errorHandler(new Error('boom'), {}, res, null);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('notFoundHandler คืน 404 JSON', () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    notFoundHandler({ method: 'GET', originalUrl: '/x' }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].code).toBe('NOT_FOUND');
  });
});

describe('audit middleware (T-012)', () => {
  test('เรียก sink เฉพาะ write method หลัง response finish', () => {
    const { EventEmitter } = require('events');
    const sink = jest.fn();
    const res = new EventEmitter();
    res.statusCode = 201;
    const next = jest.fn();

    audit({ sink })({ method: 'POST', originalUrl: '/booking', ip: '127.0.0.1' }, res, next);
    expect(next).toHaveBeenCalled();
    res.emit('finish');

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0][0]).toMatchObject({ method: 'POST', path: '/booking', statusCode: 201 });
    expect(sink.mock.calls[0][0].ts).toBeDefined();
  });

  test('ไม่เรียก sink สำหรับ GET', () => {
    const { EventEmitter } = require('events');
    const sink = jest.fn();
    const res = new EventEmitter();
    res.statusCode = 200;

    audit({ sink })({ method: 'GET', originalUrl: '/health' }, res, jest.fn());
    res.emit('finish');

    expect(sink).not.toHaveBeenCalled();
  });

  test('async sink ที่ reject ไม่ทำ unhandledRejection (ถูกจับโดย middleware)', async () => {
    const { EventEmitter } = require('events');
    const rejections = [];
    const onRejection = (err) => rejections.push(err);
    process.on('unhandledRejection', onRejection);

    const sink = jest.fn(() => Promise.reject(new Error('sink db down')));
    const res = new EventEmitter();
    res.statusCode = 200;

    audit({ sink })({ method: 'POST', originalUrl: '/booking', ip: '127.0.0.1' }, res, jest.fn());
    res.emit('finish');

    // รอ 2 tick ให้ unhandledRejection (ถ้ามี) ถูก node รายงานก่อน
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    process.removeListener('unhandledRejection', onRejection);

    expect(sink).toHaveBeenCalledTimes(1);
    expect(rejections).toHaveLength(0);
  });
});

describe('ทุก route ผ่าน errorHandler (T-012 DoD)', () => {
  test('POST /no-such-route → 404 JSON จาก notFoundHandler ไม่ใช่ HTML', async () => {
    const app = createApp();
    const res = await request(app).post('/no-such-route').send({});
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  test('POST /echo ผ่าน validate → 400 เมื่อ name หาย, 200 เมื่อถูกต้อง', async () => {
    const app = createApp();
    const bad = await request(app).post('/echo').send({});
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('VALIDATION_ERROR');

    const ok = await request(app).post('/echo').send({ name: 'test' });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ name: 'test' });
  });
});
