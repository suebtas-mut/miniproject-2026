// src/routes/auth.routes.js — T-015: /auth/login, /auth/logout, /auth/me, /auth/change-password
const express = require('express');
const { validate } = require('../middleware/validate');
const {
  loginRateLimiter,
  recordLoginFailure,
  clearLoginAttempts,
} = require('../middleware/auth');

const PASSWORD_RULE = {
  required: true,
  type: 'string',
  minLength: 8,
  maxLength: 200,
};

const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function createAuthRouter({ service, authenticate }) {
  const router = express.Router();

  router.post(
    '/login',
    loginRateLimiter,
    validate({
      username: { required: true, type: 'string', maxLength: 50 },
      password: PASSWORD_RULE,
    }),
    wrap(async (req, res) => {
      try {
        const data = await service.login(req.body);
        clearLoginAttempts(req);
        return res.status(200).json({ success: true, message: 'เข้าสู่ระบบสำเร็จ', data });
      } catch (err) {
        if (err && err.statusCode === 401 && err.code === 'INVALID_CREDENTIALS') {
          recordLoginFailure(req);
        }
        throw err;
      }
    }),
  );

  router.post(
    '/logout',
    authenticate,
    wrap(async (req, res) => {
      await service.logout({ empId: req.user.empId, jti: req.token.jti, exp: req.token.exp });
      res.json({ success: true, message: 'ออกจากระบบสำเร็จ' });
    }),
  );

  router.get(
    '/me',
    authenticate,
    wrap(async (req, res) => {
      const data = await service.me(req.user.empId);
      res.json({ success: true, data });
    }),
  );

  router.post(
    '/change-password',
    authenticate,
    validate({
      old_password: { required: true, type: 'string', maxLength: 200 },
      new_password: PASSWORD_RULE,
      confirm_password: PASSWORD_RULE,
    }),
    wrap(async (req, res) => {
      await service.changePassword({
        empId: req.user.empId,
        jti: req.token.jti,
        exp: req.token.exp,
        oldPassword: req.body.old_password,
        newPassword: req.body.new_password,
        confirmPassword: req.body.confirm_password,
      });
      res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่' });
    }),
  );

  return router;
}

module.exports = { createAuthRouter };
