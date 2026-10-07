// src/app.js — Express app factory (T-011 / T-012)
// แยกออกจาก server.js เพื่อให้ test ด้วย supertest ได้โดยไม่เปิด port จริง
const express = require('express');
const { logger, validate, errorHandler, notFoundHandler, audit, log } = require('./middleware');
const { checkDbHealth } = require('./config/db');

function createApp({ healthCheck = checkDbHealth, auditSink } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(logger);
  app.use(audit({ sink: auditSink }));

  // T-011: GET /health — ตอบ OK และบอกสถานะ Oracle จริง (ไม่ hardcode)
  // ทั้ง "pool ยังไม่พร้อม" และ "connected:false" ต้องเป็น 503 (ห้ามคืน 200)
  // response ห้าม leak ข้อความ exception จริงของ Oracle (sanitized) — log ฝั่ง server แทน
  app.get('/health', async (req, res) => {
    try {
      const { connected, latencyMs } = await healthCheck();
      if (!connected) {
        return res.status(503).json({
          status: 'error',
          database: 'unavailable',
          message: 'Database unavailable',
          timestamp: new Date().toISOString(),
        });
      }
      return res.json({
        status: 'ok',
        database: 'connected',
        latencyMs,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      // สำคัญ: แยก "Oracle ไม่ available" ออกจาก "test ผ่าน" — ตอบ 503 ไม่ใช่ 200
      log('error', `Health check failed: ${err.message}`);
      return res.status(503).json({
        status: 'error',
        database: 'unavailable',
        message: 'Database unavailable',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ตัวอย่างการใช้ validate กับ route (ตรวจ req.body)
  app.post('/echo', validate({ name: { required: true, type: 'string', maxLength: 100 } }), (req, res) => {
    res.json({ name: req.body.name });
  });

  // ทุก route ผ่าน errorHandler (Sprint 3 DoD)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
