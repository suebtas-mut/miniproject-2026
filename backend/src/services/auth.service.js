// src/services/auth.service.js — T-015: business logic ของ UC-01/UC-02/UC-03
// - login: bcrypt.compare + โหลดสิทธิ์จาก DB (R-03, R-04) + สร้าง JWT (jti สำหรับ revoke)
// - logout: MERGE jti ลง token_blacklist (UC-02)
// - change-password: bcrypt.hash + revoke ทุก token เดิมใน transaction เดียว (UC-03)
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { HttpError } = require('../middleware/errorHandler');
const { newJti, markerJti, signToken } = require('../utils/token');
const { toEmployeeProfile, toMenuItem } = require('../utils/mappers');

const BCRYPT_ROUNDS = 10;

// hash ของรหัสผ่านสุ่มที่ไม่มีอยู่จริง — ใช้เสมอเมื่อไม่เจอ username เพื่อให้เวลา bcrypt
// เท่ากันทั้ง "user ไม่มีจริง" และ "user มีแต่รหัสผ่านผิด" (ปิดช่องวัดเวลา username enumeration · SEC14-F002)
const DUMMY_HASH = '$2b$10$FCqmc4Ld2frC5ztYVmYGreaOPIPnwgxBucIbthPBs35doW8dG1tj6';

function invalidCredentials(message = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง') {
  return new HttpError(401, message, { code: 'INVALID_CREDENTIALS' });
}

async function safeCompare(plain, hash) {
  try {
    return await bcrypt.compare(plain, hash || '');
  } catch (err) {
    // hash รูปแบบผิด (เช่น placeholder ใน seed) → ถือว่าไม่ผ่าน ห้าม throw เป็น 500
    return false;
  }
}

function createAuthService({ db, repos }) {
  const { withTransaction } = db;

  async function login({ username, password }) {
    const user = await repos.auth.findLoginUser(username);
    // 1) ไม่เจอ user → ยังคงรัน bcrypt เทียบกับ DUMMY_HASH ก่อนค่อยตอบ (timing เท่ากัน — SEC14-F002)
    if (!user) {
      await safeCompare(password, DUMMY_HASH);
      throw invalidCredentials();
    }
    // 2) เทียบรหัสผ่านก่อนเสมอ — บัญชีถูกปิดจะตอบ ACCOUNT_DISABLED ก็ต่อเมื่อรหัสผ่านถูกต้องแล้ว
    //    (ไม่เปิดช่องให้เดาสถานะบัญชีโดยไม่ต้องรู้รหัสผ่าน — SEC14-F001)
    const passwordOk = await safeCompare(password, user.PASSWORD_HASH);
    if (!passwordOk) throw invalidCredentials();
    if (Number(user.IS_ACTIVE) !== 1) {
      throw new HttpError(401, 'บัญชีถูกปิดใช้งาน', { code: 'ACCOUNT_DISABLED' });
    }

    const jti = newJti();
    const accessToken = signToken({ empId: user.EMP_ID, jti });
    const [roles, permissions, menus] = await Promise.all([
      repos.auth.loadRoles(user.EMP_ID),
      repos.auth.loadPermissions(user.EMP_ID),
      repos.auth.loadMenus(user.EMP_ID),
    ]);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: env.jwt.expiresInSeconds,
      employee: toEmployeeProfile(user, roles),
      permissions,
      menus: menus.map(toMenuItem),
    };
  }

  async function logout({ empId, jti, exp }) {
    const expiresAt = exp ? new Date(exp * 1000) : new Date(Date.now() + env.jwt.expiresInSeconds * 1000);
    // MERGE 1 statement = commit ทันที (OpenAPI x-transaction)
    await repos.auth.blacklistToken({ jti, empId, expiresAt });
  }

  async function me(empId) {
    const emp = await repos.employee.findEmployeeById(empId);
    if (!emp) throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่', { code: 'UNAUTHORIZED' });
    if (Number(emp.IS_ACTIVE) !== 1) {
      throw new HttpError(403, 'บัญชีถูกปิดใช้งาน', { code: 'FORBIDDEN' });
    }
    const [roles, permissions, menus] = await Promise.all([
      repos.auth.loadRoles(empId),
      repos.auth.loadPermissions(empId),
      repos.auth.loadMenus(empId),
    ]);
    return {
      employee: toEmployeeProfile(emp, roles),
      permissions,
      menus: menus.map(toMenuItem),
    };
  }

  async function changePassword({ empId, jti, exp, oldPassword, newPassword, confirmPassword }) {
    if (newPassword !== confirmPassword) {
      throw new HttpError(400, 'รหัสผ่านใหม่ไม่ตรงกัน', {
        code: 'VALIDATION_ERROR',
        details: [{ field: 'confirm_password', message: 'ต้องตรงกับ new_password' }],
      });
    }

    const cred = await repos.auth.findCredentialById(empId);
    if (!cred) throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่', { code: 'UNAUTHORIZED' });
    if (Number(cred.IS_ACTIVE) !== 1) {
      throw new HttpError(403, 'บัญชีถูกปิดใช้งาน', { code: 'FORBIDDEN' });
    }
    if (!(await safeCompare(oldPassword, cred.PASSWORD_HASH))) {
      throw invalidCredentials('รหัสผ่านเดิมไม่ถูกต้อง');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const tokenExpiresAt = exp ? new Date(exp * 1000) : new Date(Date.now() + env.jwt.expiresInSeconds * 1000);
    const markerExpiresAt = new Date(Date.now() + env.jwt.expiresInSeconds * 1000);

    // x-transaction: UPDATE password_hash + revoke token เดิมทั้งหมด + ลบแถวหมดอายุ ใน connection เดียว
    await withTransaction(async (conn) => {
      await repos.employee.updatePassword(conn, { empId, passwordHash });
      await repos.auth.blacklistToken({ jti, empId, expiresAt: tokenExpiresAt }, conn);
      await repos.auth.blacklistToken({ jti: markerJti(empId), empId, expiresAt: markerExpiresAt }, conn);
      await repos.auth.deleteExpiredBlacklist(empId, conn);
    });
  }

  return { login, logout, me, changePassword };
}

module.exports = { createAuthService, BCRYPT_ROUNDS };
