// src/routes/master.routes.js — T-016: /departments, /positions, /employees
// สิทธิ์ตาม permission code จาก seed (ดู database/02_seed_master.sql):
//   GET /departments → DEPT.EDIT, GET /positions → POS.EDIT, GET /employees → EMP.VIEW
//   writes → DEPT.EDIT / POS.EDIT / EMP.EDIT
// (OpenAPI ตัวอย่างเขียน EMPLOYEE.VIEW/DEPARTMENT.EDIT แต่ค่าจริงใน DB คือ EMP.*/DEPT.*/POS.*)
const express = require('express');
const { validate } = require('../middleware/validate');

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const NAME_RULE = { required: true, type: 'string', minLength: 1, maxLength: 120 };
const EMAIL_RULE = {
  type: 'string',
  maxLength: 120,
  pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  patternMessage: 'must be a valid email address',
};

function idParam(req) {
  return Number(req.params.id);
}

// ---------------------------------------------------------------- departments
function createDepartmentRouter({ service, requirePermission }) {
  const router = express.Router();

  router.get(
    '/',
    requirePermission('DEPT.EDIT'),
    wrap(async (req, res) => {
      const { data, meta } = await service.listDepartments(req.query);
      res.json({ success: true, data, meta });
    }),
  );

  router.post('/', requirePermission('DEPT.EDIT'), validate({ dept_name: NAME_RULE }), wrap(async (req, res) => {
    const data = await service.createDepartment(req.body);
    res.status(201).json({ success: true, message: 'เพิ่มแผนกสำเร็จ', data });
  }));

  router.put(
    '/:id',
    requirePermission('DEPT.EDIT'),
    validate({ dept_name: NAME_RULE }),
    wrap(async (req, res) => {
      const data = await service.updateDepartment(idParam(req), req.body);
      res.json({ success: true, message: 'แก้ไขแผนกสำเร็จ', data });
    }),
  );

  router.delete(
    '/:id',
    requirePermission('DEPT.EDIT'),
    wrap(async (req, res) => {
      await service.deleteDepartment(idParam(req));
      res.json({ success: true, message: 'ลบแผนกสำเร็จ' });
    }),
  );

  return router;
}

// ---------------------------------------------------------------- positions
function createPositionRouter({ service, requirePermission }) {
  const router = express.Router();

  router.get(
    '/',
    requirePermission('POS.EDIT'),
    wrap(async (req, res) => {
      const { data, meta } = await service.listPositions(req.query);
      res.json({ success: true, data, meta });
    }),
  );

  router.post('/', requirePermission('POS.EDIT'), validate({ position_name: NAME_RULE }), wrap(async (req, res) => {
    const data = await service.createPosition(req.body);
    res.status(201).json({ success: true, message: 'เพิ่มตำแหน่งสำเร็จ', data });
  }));

  router.put(
    '/:id',
    requirePermission('POS.EDIT'),
    validate({ position_name: NAME_RULE }),
    wrap(async (req, res) => {
      const data = await service.updatePosition(idParam(req), req.body);
      res.json({ success: true, message: 'แก้ไขตำแหน่งสำเร็จ', data });
    }),
  );

  router.delete(
    '/:id',
    requirePermission('POS.EDIT'),
    wrap(async (req, res) => {
      await service.deletePosition(idParam(req));
      res.json({ success: true, message: 'ลบตำแหน่งสำเร็จ' });
    }),
  );

  return router;
}

// ---------------------------------------------------------------- employees
function createEmployeeRouter({ service, requirePermission }) {
  const router = express.Router();

  router.get(
    '/',
    requirePermission('EMP.VIEW'),
    wrap(async (req, res) => {
      const { data, meta } = await service.listEmployees(req.query);
      res.json({ success: true, data, meta });
    }),
  );

  router.post(
    '/',
    requirePermission('EMP.EDIT'),
    validate({
      emp_code: { required: true, type: 'string', maxLength: 20 },
      first_name: { required: true, type: 'string', maxLength: 80 },
      last_name: { required: true, type: 'string', maxLength: 80 },
      phone: { type: 'string', maxLength: 20 },
      email: EMAIL_RULE,
      // dept_id/position_id ไม่ทำ required ที่นี่ — ให้ service ตอบ 400 ตามตัวอย่าง OpenAPI
      // ("กรุณาระบุแผนกและตำแหน่งของพนักงาน" + details) ส่วนชนิดข้อมูลยังตรวจที่นี่
      dept_id: { type: 'integer' },
      position_id: { type: 'integer' },
      username: { required: true, type: 'string', maxLength: 50 },
      password: { required: true, type: 'string', minLength: 8, maxLength: 200 },
      is_active: { type: 'integer', enum: [0, 1] },
    }),
    wrap(async (req, res) => {
      const data = await service.createEmployee(req.body);
      res.status(201).json({ success: true, message: 'เพิ่มพนักงานสำเร็จ', data });
    }),
  );

  router.put(
    '/:id',
    requirePermission('EMP.EDIT'),
    validate({
      emp_code: { type: 'string', maxLength: 20 },
      first_name: { required: true, type: 'string', maxLength: 80 },
      last_name: { required: true, type: 'string', maxLength: 80 },
      phone: { type: 'string', maxLength: 20 },
      email: EMAIL_RULE,
      dept_id: { type: 'integer' },
      position_id: { type: 'integer' },
      is_active: { type: 'integer', enum: [0, 1] },
    }),
    wrap(async (req, res) => {
      const data = await service.updateEmployee(idParam(req), req.body);
      res.json({ success: true, message: 'แก้ไขข้อมูลพนักงานสำเร็จ', data });
    }),
  );

  router.delete(
    '/:id',
    requirePermission('EMP.EDIT'),
    wrap(async (req, res) => {
      await service.deleteEmployee(idParam(req));
      res.json({ success: true, message: 'ลบพนักงานสำเร็จ' });
    }),
  );

  return router;
}

module.exports = { createDepartmentRouter, createPositionRouter, createEmployeeRouter };
