// src/config/env.js — อ่านค่า config จาก environment (.env ผ่าน dotenv)
// T-011: Backend setup + config
require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  appName: process.env.APP_NAME || 'shuttle-bus-backend',
  logLevel: process.env.LOG_LEVEL || 'debug',

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

module.exports = env;
