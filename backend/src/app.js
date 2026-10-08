// src/app.js — Express app factory (T-011 / T-012 / T-015 / T-016 / T-019…T-022 / T-024…T-027 / T-029…T-046)
// แยกออกจาก server.js เพื่อให้ test ด้วย supertest ได้โดยไม่เปิด port จริง
// รองรับ injection: { healthCheck, auditSink, db, repos } เพื่อให้ test ไม่ต้องแตะ Oracle จริง
const express = require('express');
const { logger, validate, errorHandler, notFoundHandler, audit, log, createAuthMiddleware } = require('./middleware');
const { checkDbHealth } = require('./config/db');
const { createServices } = require('./services');
const { createAuditRepository } = require('./repositories/audit.repository');
const { createAuthRouter } = require('./routes/auth.routes');
const {
  createDepartmentRouter,
  createPositionRouter,
  createEmployeeRouter,
} = require('./routes/master.routes');
const { createRbacRouter } = require('./routes/rbac.routes');
const { createStopsRouter, createRoutesRouter } = require('./routes/front.routes');
const { createVehiclesRouter, createSchedulesRouter } = require('./routes/scheduling.routes');
const { createBookingRouter } = require('./routes/booking.routes');
const { createDriverRouter } = require('./routes/driver.routes');
const { createReportRouter } = require('./routes/report.routes');

function createApp({ healthCheck = checkDbHealth, auditSink, db, repos } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(logger);
  // T-042: sink เริ่มต้น = insert audit_log (autoCommit) — ถ้า pool ยังไม่ขึ้น insert จะ reject → middleware log เอง
  const auditRepo = createAuditRepository(db);
  app.use(audit({ sink: auditSink || ((entry) => auditRepo.insert(entry)) }));

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

  // T-015/T-016: /api/v1 — login/logout/me/change-password + master data
  const repoModule = repos || require('./repositories');
  const services = createServices({ db, repos: repoModule });
  const { authenticate, requirePermission } = createAuthMiddleware({ repos: repoModule });

  const api = express.Router();
  api.use('/auth', createAuthRouter({ service: services.auth, authenticate }));
  api.use(authenticate); // จากบรรทัดนี้ไป = ทุก endpoint ต้องมี token ที่ใช้ได้
  api.use('/departments', createDepartmentRouter({ service: services.master, requirePermission }));
  api.use('/positions', createPositionRouter({ service: services.master, requirePermission }));
  api.use('/employees', createEmployeeRouter({ service: services.master, requirePermission }));
  // T-019…T-021: /roles, /permissions, /permission-matrix — ทุกตัวคุมด้วย ROLE.EDIT (dynamic RBAC)
  api.use(createRbacRouter({ service: services.rbac, requirePermission }));
  // T-024…T-027: /stops, /routes — ROUTE.VIEW (reads) / ROUTE.EDIT (writes)
  api.use('/stops', createStopsRouter({ service: services.front, requirePermission }));
  api.use('/routes', createRoutesRouter({ service: services.front, requirePermission }));
  // T-029…T-037: /vehicles (VEH.EDIT), /schedules (ROUTE.VIEW reads / SCHED.EDIT writes)
  api.use('/vehicles', createVehiclesRouter({ service: services.scheduling, requirePermission }));
  api.use('/schedules', createSchedulesRouter({ service: services.scheduling, requirePermission }));
  // T-034/T-035/T-037/T-038/T-039: /booking (BK.VIEW reads / BK.CREATE จอง / BK.CANCEL ยกเลิก) — UC-17…UC-21
  api.use('/booking', createBookingRouter({ service: services.booking, requirePermission }));
  // T-043…T-046: /driver (TRIP.START: schedule/start/manifest, QR.SCAN: scan) — UC-22…UC-25 (D1-D3)
  api.use('/driver', createDriverRouter({ service: services.driver, requirePermission }));
  // T-054…T-056: /report — RPT.R1/R4/R6 รายงานจริง + R2/R3/R5/R7 คืน 501 (UC-27…UC-29 · R)
  api.use('/report', createReportRouter({ service: services.report, requirePermission }));
  app.use('/api/v1', api);

  // ทุก route ผ่าน errorHandler (Sprint 3 DoD)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
