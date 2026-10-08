// src/routes/scheduling.routes.js — T-029/T-030/T-031/T-032: /vehicles, /schedules (UC-13…UC-16 · F2)
// สิทธิ์ตาม permission code จาก seed (database/02_seed_master.sql):
//   GET /vehicles → VEH.EDIT · GET /schedules, GET /schedules/:id → ROUTE.VIEW ('ดูเส้นทางและรอบเวลา')
//   writes (POST/DELETE /schedules + assign ทั้ง4) → SCHED.EDIT ('จัดการตารางเวลาเดินรถ')
// ⚠ UC-13 เขียน precondition = VEHICLE.EDIT แต่ seed มีแค่ VEH.EDIT → ใช้ VEH.EDIT
//   (บังคับ VEHICLE.EDIT = ไม่มีใครดู/เพิ่มรถได้) — บันทึกเป็น unresolved check ใน handoff
// ไม่มี PUT /schedules/{id} (Q23 ยังค้าง) · ไม่มี PUT/DELETE /vehicles/{id} · ไม่มี /vehicle-types
//   — 17.5.2 / openapi ไม่ประกาศ (บทเรียน P-04 ข้อ 9)
const express = require('express');
const { validate } = require('../middleware/validate');

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const VEHICLE_RULES = {
  plate_no: { required: true, type: 'string', maxLength: 20 },
  vtype_id: { required: true, type: 'integer' },
  is_active: { type: 'integer', enum: [0, 1] },
};

const SCHEDULE_RULES = {
  route_id: { required: true, type: 'integer' },
  service_date: {
    required: true,
    type: 'string',
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    patternMessage: 'must be a date (YYYY-MM-DD)',
  },
  depart_at: {
    required: true,
    type: 'string',
    pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/,
    patternMessage: 'must be a date-time (ISO 8601)',
  },
  is_active: { type: 'integer', enum: [0, 1] },
};

const ASSIGN_DRIVER_RULES = { emp_id: { required: true, type: 'integer' } };
const ASSIGN_VEHICLE_RULES = { veh_id: { required: true, type: 'integer' } };

function idParam(req) {
  return Number(req.params.id);
}

// -------------------------------------------------------- UC-13 /vehicles
function createVehiclesRouter({ service, requirePermission }) {
  const router = express.Router();
  const vehicleGuard = requirePermission('VEH.EDIT'); // UC-13: ดู+เพิ่มรถ = VEH.EDIT (seed code)

  router.get(
    '/',
    vehicleGuard,
    wrap(async (req, res) => {
      const { data, meta } = await service.listVehicles(req.query);
      res.json({ success: true, data, meta });
    }),
  );

  router.post(
    '/',
    vehicleGuard,
    validate(VEHICLE_RULES),
    wrap(async (req, res) => {
      const data = await service.createVehicle(req.body);
      res.status(201).json({ success: true, message: 'เพิ่มรถสำเร็จ', data });
    }),
  );

  return router;
}

// ------------------------------------------ UC-14…UC-16 /schedules
function createSchedulesRouter({ service, requirePermission }) {
  const router = express.Router();
  const viewGuard = requirePermission('ROUTE.VIEW');
  const editGuard = requirePermission('SCHED.EDIT');

  router.get(
    '/',
    viewGuard,
    wrap(async (req, res) => {
      const { data, meta } = await service.listSchedules(req.query);
      res.json({ success: true, data, meta });
    }),
  );

  router.post(
    '/',
    editGuard,
    validate(SCHEDULE_RULES),
    wrap(async (req, res) => {
      const data = await service.createSchedule(req.body);
      res.status(201).json({ success: true, message: 'สร้างรอบสำเร็จ', data });
    }),
  );

  router.get(
    '/:id',
    viewGuard,
    wrap(async (req, res) => {
      const data = await service.getSchedule(idParam(req));
      res.json({ success: true, data });
    }),
  );

  router.delete(
    '/:id',
    editGuard,
    wrap(async (req, res) => {
      await service.deleteSchedule(idParam(req));
      res.json({ success: true, message: 'ยกเลิกรอบเวลาสำเร็จ' });
    }),
  );

  router.post(
    '/:id/assign-driver',
    editGuard,
    validate(ASSIGN_DRIVER_RULES),
    wrap(async (req, res) => {
      const data = await service.assignDriver(idParam(req), req.body);
      res.status(201).json({ success: true, message: 'มอบหมายคนขับสำเร็จ', data });
    }),
  );

  router.delete(
    '/:id/assign-driver',
    editGuard,
    wrap(async (req, res) => {
      await service.unassignDriver(idParam(req));
      res.json({ success: true, message: 'ยกเลิกการมอบหมายคนขับสำเร็จ' });
    }),
  );

  router.post(
    '/:id/assign-vehicle',
    editGuard,
    validate(ASSIGN_VEHICLE_RULES),
    wrap(async (req, res) => {
      const data = await service.assignVehicle(idParam(req), req.body);
      res.status(201).json({ success: true, message: 'มอบหมายรถสำเร็จ', data });
    }),
  );

  router.delete(
    '/:id/assign-vehicle',
    editGuard,
    wrap(async (req, res) => {
      await service.unassignVehicle(idParam(req));
      res.json({ success: true, message: 'ยกเลิกการมอบหมายรถสำเร็จ' });
    }),
  );

  return router;
}

module.exports = { createVehiclesRouter, createSchedulesRouter };
