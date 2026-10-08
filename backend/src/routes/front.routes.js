// src/routes/front.routes.js — T-024/T-025/T-026/T-027: /stops, /routes (UC-11, UC-12 · F1)
// สิทธิ์ตาม permission code จาก seed (database/02_seed_master.sql):
//   GET /stops, GET /routes, GET /routes/:id/stops → ROUTE.VIEW ('ดูเส้นทางและรอบเวลา')
//   writes ทั้งหมด → ROUTE.EDIT ('จัดการเส้นทาง/จุดจอด' — ชื่อ perm ครอบคลุมจุดจอดอยู่แล้ว)
// ⚠ UC-11 เขียน precondition = STOP.EDIT แต่ seed ไม่มี perm_code นี้ → ใช้ ROUTE.EDIT
//   (บังคับ STOP.EDIT = ไม่มีใครเพิ่ม/แก้/ลบจุดจอดได้) — บันทึกเป็น unresolved check ใน handoff
// ไม่สร้าง PUT/DELETE /routes/{id} — 17.5.2 / openapi ไม่ประกาศ (บทเรียน P-04 ข้อ 9)
const express = require('express');
const { validate } = require('../middleware/validate');

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const STOP_RULES = {
  stop_name: { required: true, type: 'string', maxLength: 150 },
  address: { type: 'string', maxLength: 255 },
  latitude: { type: 'number' },
  longitude: { type: 'number' },
  is_active: { type: 'integer', enum: [0, 1] },
};

const ROUTE_RULES = {
  route_name: { required: true, type: 'string', maxLength: 120 },
  description: { type: 'string', maxLength: 255 },
  is_active: { type: 'integer', enum: [0, 1] },
};

function idParam(req) {
  return Number(req.params.id);
}

// ------------------------------------------------------------ UC-11 /stops
function createStopsRouter({ service, requirePermission }) {
  const router = express.Router();
  const viewGuard = requirePermission('ROUTE.VIEW');
  const editGuard = requirePermission('ROUTE.EDIT');

  router.get(
    '/',
    viewGuard,
    wrap(async (req, res) => {
      const { data, meta } = await service.listStops(req.query);
      res.json({ success: true, data, meta });
    }),
  );

  router.post(
    '/',
    editGuard,
    validate(STOP_RULES),
    wrap(async (req, res) => {
      const data = await service.createStop(req.body);
      res.status(201).json({ success: true, message: 'เพิ่มจุดจอดสำเร็จ ใช้งานได้ทุกเส้นทาง', data });
    }),
  );

  router.put(
    '/:id',
    editGuard,
    validate(STOP_RULES),
    wrap(async (req, res) => {
      const data = await service.updateStop(idParam(req), req.body);
      res.json({ success: true, message: 'แก้ไขจุดจอดสำเร็จ', data });
    }),
  );

  router.delete(
    '/:id',
    editGuard,
    wrap(async (req, res) => {
      await service.deleteStop(idParam(req));
      res.json({ success: true, message: 'ลบจุดจอดสำเร็จ' });
    }),
  );

  return router;
}

// ----------------------------------------------------------- UC-12 /routes
function createRoutesRouter({ service, requirePermission }) {
  const router = express.Router();
  const viewGuard = requirePermission('ROUTE.VIEW');
  const editGuard = requirePermission('ROUTE.EDIT');

  router.get(
    '/',
    viewGuard,
    wrap(async (req, res) => {
      const { data, meta } = await service.listRoutes(req.query);
      res.json({ success: true, data, meta });
    }),
  );

  router.post(
    '/',
    editGuard,
    validate(ROUTE_RULES),
    wrap(async (req, res) => {
      const data = await service.createRoute(req.body);
      res.status(201).json({ success: true, message: 'เพิ่มเส้นทางสำเร็จ กรุณาเรียงจุดจอดต่อไป', data });
    }),
  );

  router.get(
    '/:id/stops',
    viewGuard,
    wrap(async (req, res) => {
      const data = await service.getRouteStops(idParam(req));
      res.json({ success: true, data });
    }),
  );

  router.put(
    '/:id/stops',
    editGuard,
    validate({ stops: { required: true, type: 'array' } }),
    wrap(async (req, res) => {
      const data = await service.saveRouteStops(idParam(req), req.body);
      res.json({ success: true, message: `เวลารวมทั้งเส้นทาง: ${data.total_minutes} นาที`, data });
    }),
  );

  router.post(
    '/:id/recalculate',
    editGuard,
    wrap(async (req, res) => {
      const data = await service.recalculateRoute(idParam(req));
      res.json({ success: true, message: 'คำนวณเวลารวมใหม่แล้ว', data });
    }),
  );

  return router;
}

module.exports = { createStopsRouter, createRoutesRouter };
