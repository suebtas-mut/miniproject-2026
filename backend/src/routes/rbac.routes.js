// src/routes/rbac.routes.js — T-019/T-020/T-021: /roles, /permissions, /permission-matrix
// ทุก endpoint คุมด้วย requirePermission('ROLE.EDIT') — สิทธิ์จาก DB ทุก request ไม่ hardcode บทบาท
// ⚠ UC-08 เขียน precondition = PERMISSION.EDIT แต่ database/02_seed_master.sql ไม่มี perm_code นี้
//   (บังคับ PERMISSION.EDIT = ไม่มีใครเข้าถึงได้แม้แต่ ADMIN) → ใช้ ROLE.EDIT
//   ('จัดการบทบาทและสิทธิ์' ตาม seed) — บันทึกเป็น unresolved check ใน handoff
// ไม่สร้าง: PUT/DELETE /permissions/{id} (Q24) และ employee_role write (Q22) — ไม่มีใน openapi
const express = require('express');
const { validate } = require('../middleware/validate');

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const PERMISSION_MODULES = ['master', 'front', 'booking', 'driver', 'report'];

const ROLE_RULES = {
  role_name: { required: true, type: 'string', maxLength: 50 },
  description: { type: 'string', maxLength: 255 },
  is_active: { type: 'integer', enum: [0, 1] },
};

function idParam(req) {
  return Number(req.params.id);
}

function createRbacRouter({ service, requirePermission }) {
  const router = express.Router();
  const guard = requirePermission('ROLE.EDIT');

  // ------------------------------------------------------------ UC-07 roles
  router.get(
    '/roles',
    guard,
    wrap(async (req, res) => {
      const { data, meta } = await service.listRoles(req.query);
      res.json({ success: true, data, meta });
    }),
  );

  router.post(
    '/roles',
    guard,
    validate(ROLE_RULES),
    wrap(async (req, res) => {
      const data = await service.createRole(req.body);
      res.status(201).json({ success: true, message: 'เพิ่มบทบาทสำเร็จ', data });
    }),
  );

  router.put(
    '/roles/:id',
    guard,
    validate(ROLE_RULES),
    wrap(async (req, res) => {
      const data = await service.updateRole(idParam(req), req.body);
      res.json({
        success: true,
        message: 'แก้ไขบทบาทสำเร็จ มีผลกับการเข้าสู่ระบบครั้งถัดไป',
        data,
      });
    }),
  );

  router.delete(
    '/roles/:id',
    guard,
    wrap(async (req, res) => {
      await service.deleteRole(idParam(req));
      res.json({ success: true, message: 'ลบบทบาทสำเร็จ' });
    }),
  );

  // -------------------------------------------------------- UC-08 permissions
  router.get(
    '/permissions',
    guard,
    wrap(async (req, res) => {
      const { data, meta } = await service.listPermissions(req.query);
      res.json({ success: true, data, meta });
    }),
  );

  router.post(
    '/permissions',
    guard,
    validate({
      perm_code: { required: true, type: 'string', maxLength: 80 },
      perm_name: { required: true, type: 'string', maxLength: 120 },
      module: { required: true, type: 'string', enum: PERMISSION_MODULES },
      screen_key: { type: 'string', maxLength: 80 },
      sort_no: { type: 'integer' },
    }),
    wrap(async (req, res) => {
      const data = await service.createPermission(req.body);
      res.status(201).json({ success: true, message: 'เพิ่มสิทธิ์สำเร็จ', data });
    }),
  );

  // -------------------------------------------------- UC-09 permission matrix
  router.put(
    '/permission-matrix',
    guard,
    validate({
      role_id: { required: true, type: 'integer' },
      perm_ids: { required: true, type: 'array' },
    }),
    wrap(async (req, res) => {
      const data = await service.savePermissionMatrix(req.body);
      res.json({ success: true, message: 'บันทึกแล้ว มีผลกับการ Login ครั้งถัดไป', data });
    }),
  );

  return router;
}

module.exports = { createRbacRouter };
