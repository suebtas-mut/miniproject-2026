// src/routes/driver.routes.js — T-043..T-047: /driver (UC-22..UC-26 · D1-D4)
// permission code อ้างอิง seed (database/02_seed_master.sql บรรทัด 76-78 — module driver):
//   GET /driver/schedule, POST /driver/trip/{schedId}/start, GET /driver/trip/{tripId}/manifest → TRIP.START
//     ('เริ่มการเดินทาง' DRIVER_HOME — เป็น permission ดูงานของคนขับที่ seed มอบให้ DRIVER/STAFF)
//   POST /driver/trip/scan → QR.SCAN ('สแกน QR เช็คอินขึ้นรถ' DRIVER_SCAN)
//   POST /driver/trip/{tripId}/complete → TRIP.END ('กดปิดรอบเดินรถ' DRIVER_HOME · T-047 · UC-26)
// ทุก endpoint อยู่ใต้ authenticate (app.js api.use) → 401 ก่อน guard เสมอ
const express = require('express');
const { validate } = require('../middleware/validate');

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const SCAN_RULES = {
  trip_id: { required: true, type: 'integer' },
  qr_token: { required: true, type: 'string', minLength: 1, maxLength: 64 },
  checkin_stop_id: { type: 'integer' },
};

function idParam(value) {
  return Number(value);
}

function createDriverRouter({ service, requirePermission }) {
  const router = express.Router();
  const homeGuard = requirePermission('TRIP.START');
  const scanGuard = requirePermission('QR.SCAN');
  const completeGuard = requirePermission('TRIP.END');

  // UC-22 (T-043): ตารางงานรายวันของคนขับที่ Login — ?date= (ไม่ส่ง = วันนี้), ไม่มี meta
  router.get(
    '/schedule',
    homeGuard,
    wrap(async (req, res) => {
      const data = await service.getMySchedule(req.query, req.user.empId);
      res.json({ success: true, data });
    }),
  );

  // UC-23 (T-044): เริ่มงาน — 201 + message + Trip; 404/403/409/422 ดู service
  router.post(
    '/trip/:schedId/start',
    homeGuard,
    wrap(async (req, res) => {
      const data = await service.startTrip(idParam(req.params.schedId), req.user.empId);
      res.status(201).json({ success: true, message: 'เริ่มงานสำเร็จ', data });
    }),
  );

  // UC-24 (T-045): Manifest รายจุดจอด (LISTAGG) — ต้องเป็นคนขับของ trip นี้เท่านั้น
  router.get(
    '/trip/:tripId/manifest',
    homeGuard,
    wrap(async (req, res) => {
      const data = await service.getManifest(idParam(req.params.tripId), req.user.empId);
      res.json({ success: true, data });
    }),
  );

  // UC-25 (T-046): สแกน QR — BR-09 ผิดรอบ / สถานะ / สแกนซ้ำ (4 กรณี 4a-4d → 200, not_found → 404)
  router.post(
    '/trip/scan',
    scanGuard,
    validate(SCAN_RULES),
    wrap(async (req, res) => {
      const data = await service.scanQr(req.body, req.user.empId);
      res.json({ success: true, data });
    }),
  );

  // UC-26 (T-047): ปิดรอบ + BR-10 mark no_show + สรุป — 200 + message + TripSummary; 404/403/409 ดู service
  router.post(
    '/trip/:tripId/complete',
    completeGuard,
    wrap(async (req, res) => {
      const data = await service.completeTrip(idParam(req.params.tripId), req.user.empId);
      res.json({ success: true, message: 'ปิดงานสำเร็จ', data });
    }),
  );

  return router;
}

module.exports = { createDriverRouter };
