// src/config/env.js — อ่านค่า config จาก environment (.env ผ่าน dotenv)
// T-011: Backend setup + config
require('dotenv').config();

function parseDurationSeconds(value, fallback) {
  const match = /^(\d+)\s*([smhd]?)$/.exec(String(value).trim());
  if (!match) return fallback;
  const units = { '': 1, s: 1, m: 60, h: 3600, d: 86400 };
  return Number(match[1]) * units[match[2]];
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  appName: process.env.APP_NAME || 'shuttle-bus-backend',
  logLevel: process.env.LOG_LEVEL || 'debug',

  // T-015: JWT config — ห้าม hardcode secret (P-12); ถ้าไม่มี JWT_SECRET ให้ fail ตอนใช้
  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '2h',
    issuer: process.env.JWT_ISSUER || 'shuttle-bus-backend',
  },

  db: {
    user: process.env.DB_USER || 'SHUTTLE_APP',
    pass: process.env.DB_PASS || '',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 1521,
    serviceName: process.env.DB_SERVICE_NAME || 'XEPDB1',
    poolMin: Number(process.env.DB_POOL_MIN) || 2,
    poolMax: Number(process.env.DB_POOL_MAX) || 10,
    poolTimeout: Number(process.env.DB_POOL_TIMEOUT) || 60,
  },
};

env.db.connectString = `${env.db.host}:${env.db.port}/${env.db.serviceName}`;

// OpenAPI: expires_in เป็นวินาที (ตัวอย่าง 7200 = 2 ชั่วโมง ตาม UC-01)
env.jwt.expiresInSeconds = parseDurationSeconds(env.jwt.expiresIn, 7200);

module.exports = env;
