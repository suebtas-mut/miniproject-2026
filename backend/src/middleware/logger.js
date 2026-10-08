// src/middleware/logger.js — T-012: request logging middleware
// บันทึก method, path, status, duration ทุก request (ไม่ log ข้อมูลลับ — AR-03)
const env = require('../config/env');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const threshold = LEVELS[env.logLevel] !== undefined ? LEVELS[env.logLevel] : LEVELS.debug;

function log(level, message) {
  if (LEVELS[level] <= threshold) {
    const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }
}

function logger(req, res, next) {
  const started = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - started;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    log(level, `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
}

module.exports = { logger, log };
