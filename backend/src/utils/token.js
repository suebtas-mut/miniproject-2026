// src/utils/token.js — T-015: JWT sign/verify helpers + jti utilities
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

// ห้าม hardcode secret (P-12) — ถ้าไม่ตั้งค่าให้ fail ชัดเจนตอนใช้
function getJwtSecret() {
  if (!env.jwt.secret) {
    throw new Error('JWT_SECRET is not configured — set JWT_SECRET in backend/.env');
  }
  return env.jwt.secret;
}

function newJti() {
  return crypto.randomUUID();
}

// jti พิเศษสำหรับ "เพิกถอนทุก token ของพนักงานคนนี้" โดยไม่ต้องแก้ schema
// (เรกคอร์ดจะถูกเปรียบเทียบกับ iat ของ token ที่กำลังใช้งาน)
function markerJti(empId) {
  return `REVOKE_ALL:${empId}`;
}

function signToken({ empId, jti }) {
  return jwt.sign({ empId, jti }, getJwtSecret(), {
    expiresIn: env.jwt.expiresInSeconds,
    issuer: env.jwt.issuer,
  });
}

function verifyToken(token) {
  // จำกัด algorithm ชัดเจน = HS256 (ตัวที่ signToken ใช้) — กันการยัด algorithm อื่น เช่น none/RS256 (SEC14-F003)
  return jwt.verify(token, getJwtSecret(), { issuer: env.jwt.issuer, algorithms: ['HS256'] });
}

module.exports = { getJwtSecret, newJti, markerJti, signToken, verifyToken };
