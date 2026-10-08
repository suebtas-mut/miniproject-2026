// src/routes/report.routes.js — T-054/T-055/T-056 + 501 stubs: /report (UC-27/28/29 · R1/R4/R6)
// permission code อ้างอิง seed (database/02_seed_master.sql บรรทัด 80-86 — module report):
//   GET /report/boarding-alighting-week → RPT.R1 (รายงาน 1 จำนวนคนขึ้น-ลง)
//   GET /report/annual-booking-stats    → RPT.R2 → 501 (ไม่ได้เลือกทำ)
//   GET /report/user-behavior           → RPT.R3 → 501
//   GET /report/daily-by-route          → RPT.R4 (รายงาน 4 จำนวนผู้ใช้รายวันรายเส้นทาง)
//   GET /report/stop-usage              → RPT.R5 → 501
//   GET /report/driver-workload         → RPT.R6 (รายงาน 6 สถิติคนขับ)
//   GET /report/vehicle-usage           → RPT.R7 → 501
// ทุก endpoint อยู่ใต้ authenticate (app.js api.use) → 401 ก่อน guard เสมอ
// 501 = res.status(501).json(errorBody(...)) ตรง ๆ — ห้าม throw HttpError(501)
//   เพราะ errorHandler จัด statusCode >= 500 เป็น INTERNAL_ERROR/ข้อความ 500 (code จะไม่ตรง openapi)
// validate() middleware ตรวจเฉพาะ req.body — query validation (year/from/to/route_id)
//   ทำใน service (throw 400 VALIDATION_ERROR + details.field)
const express = require('express');
const { errorBody } = require('../middleware/errorHandler');

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

// ข้อความ 501 ตรงตัวอย่าง openapi components/responses/NotImplemented ทุกตัวอักษร
const NOT_IMPLEMENTED_MESSAGE = 'รายงานนี้ไม่ได้อยู่ในชุดที่ทีมเลือกทำจริง (R1 + R4 + R6)';

function createReportRouter({ service, requirePermission }) {
  const router = express.Router();
  const r1Guard = requirePermission('RPT.R1');
  const r4Guard = requirePermission('RPT.R4');
  const r6Guard = requirePermission('RPT.R6');
  const r2Guard = requirePermission('RPT.R2');
  const r3Guard = requirePermission('RPT.R3');
  const r5Guard = requirePermission('RPT.R5');
  const r7Guard = requirePermission('RPT.R7');

  // รายงานที่ไม่ได้เลือกทำ (R2/R3/R5/R7) — guard สิทธิ์ของรายงานนั้น ๆ ก่อน แล้วคืน 501
  // (openapi responses = 501/401/403 เท่านั้น — ไม่มี 400 จึงไม่ validate query เลย)
  const notImplemented = (guard) => [
    guard,
    (req, res) => {
      res.status(501).json(errorBody(501, 'REPORT_NOT_SELECTED', NOT_IMPLEMENTED_MESSAGE));
    },
  ];

  // R1 (UC-27 / T-054): ?year=2568 (บังคับ, พ.ศ. 2500–2600) & ?route_id= (optional)
  router.get(
    '/boarding-alighting-week',
    r1Guard,
    wrap(async (req, res) => {
      const data = await service.boardingAlightingWeek(req.query);
      res.json({ success: true, data });
    }),
  );

  // R4 (UC-28 / T-055): ?from=&to= (บังคับ YYYY-MM-DD) & ?route_id= (optional)
  router.get(
    '/daily-by-route',
    r4Guard,
    wrap(async (req, res) => {
      const data = await service.dailyByRoute(req.query);
      res.json({ success: true, data });
    }),
  );

  // R6 (UC-29 / T-056): ?from=&to= (บังคับ YYYY-MM-DD)
  router.get(
    '/driver-workload',
    r6Guard,
    wrap(async (req, res) => {
      const data = await service.driverWorkload(req.query);
      res.json({ success: true, data });
    }),
  );

  // รายงานที่ทีมไม่ได้เลือกทำจริง (17.5.2 · openapi NotImplemented)
  router.get('/annual-booking-stats', ...notImplemented(r2Guard)); // R2
  router.get('/user-behavior', ...notImplemented(r3Guard)); // R3
  router.get('/stop-usage', ...notImplemented(r5Guard)); // R5
  router.get('/vehicle-usage', ...notImplemented(r7Guard)); // R7

  return router;
}

module.exports = { createReportRouter, NOT_IMPLEMENTED_MESSAGE };
