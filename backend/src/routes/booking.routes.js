// src/routes/booking.routes.js — T-034…T-039: /booking/available, POST /booking, GET /booking/{id}/qr,
//   GET /booking/me, POST /booking/{id}/cancel
// สิทธิ์ตาม permission code จาก seed (database/02_seed_master.sql):
//   GET /booking/available, GET /booking/{id}/qr, GET /booking/me → BK.VIEW ('ดูรายการจองของฉัน')
//   POST /booking → BK.CREATE ('จองรถ') · POST /booking/{id}/cancel → BK.CANCEL ('ยกเลิกการจอง')
// ⚠ openapi /booking/available ไม่ประกาศ 403 — ยังคงบังคับ BK.VIEW (dynamic RBAC ทุก endpoint)
const express = require('express');
const { validate } = require('../middleware/validate');

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

// type/required ตรวจที่ validate · ช่วงค่า BR-06 (1-4) ตรวจที่ service (validate ไม่รองรับ min/max)
const BOOKING_RULES = {
  sched_id: { required: true, type: 'integer' },
  board_stop_id: { required: true, type: 'integer' },
  alight_stop_id: { required: true, type: 'integer' },
  seats: { required: true, type: 'integer' },
};

function idParam(req) {
  return Number(req.params.id);
}

function createBookingRouter({ service, requirePermission }) {
  const router = express.Router();
  const viewGuard = requirePermission('BK.VIEW');
  const createGuard = requirePermission('BK.CREATE');
  const cancelGuard = requirePermission('BK.CANCEL');

  // UC-17 — 400 เมื่อขาดพารามิเตอร์ หรือจุดลงอยู่ก่อนจุดขึ้น (BR-11) · ไม่มีรอบ → data: []
  router.get(
    '/available',
    viewGuard,
    wrap(async (req, res) => {
      const data = await service.listAvailable(req.query);
      res.json({ success: true, data });
    }),
  );

  // UC-19 (T-039) — cust_id จาก JWT เท่านั้น · status upcoming|completed|cancelled|all (default upcoming)
  router.get(
    '/me',
    viewGuard,
    wrap(async (req, res) => {
      const { data, meta } = await service.listMyBookings(req.query, req.user.empId);
      res.json({ success: true, data, meta });
    }),
  );

  // UC-18 — server ตรวจ BR-05/BR-06/BR-07 ซ้ำ + FOR UPDATE NOWAIT ใน transaction → 201 พร้อม QR
  router.post(
    '/',
    createGuard,
    validate(BOOKING_RULES),
    wrap(async (req, res) => {
      const data = await service.createBooking(req.body, req.user.empId);
      res.status(201).json({ success: true, message: 'จองสำเร็จ', data });
    }),
  );

  // UC-21 (T-038) — TX: lock → 404 → 403 เจ้าของ → 409/422 สถานะ → 409 BR-08/ASM-07-2 → UPDATE cancelled
  router.post(
    '/:id/cancel',
    cancelGuard,
    wrap(async (req, res) => {
      const data = await service.cancelBooking(idParam(req), req.user.empId);
      res.json({ success: true, message: 'ยกเลิกการจองสำเร็จ ที่นั่งถูกคืนเข้ารอบแล้ว', data });
    }),
  );

  // UC-20 — ต้องเป็นการจองของตัวเอง (403) · cancelled → 404 · checked_in → คืน status
  router.get(
    '/:id/qr',
    viewGuard,
    wrap(async (req, res) => {
      const data = await service.getBookingQr(idParam(req), req.user.empId);
      res.json({ success: true, data });
    }),
  );

  return router;
}

module.exports = { createBookingRouter };
