// src/middleware/errorHandler.js — T-012: central error handler + 404
// ทุก route ต้องผ่าน middleware ตัวนี้ (Sprint 3 DoD)
const env = require('../config/env');
const { log } = require('./logger');

// error ที่มี statusCode กำเอง (เช่น จาก service) — ใช้ new HttpError(404, 'msg')
class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.expose = true;
  }
}

function notFoundHandler(req, res) {
  res.status(404).json({
    status: 'error',
    code: 'NOT_FOUND',
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const expose = err.expose || statusCode < 500;

  if (statusCode >= 500) {
    log('error', `Unhandled error: ${req.method} ${req.originalUrl} — ${err.message}\n${err.stack}`);
  }

  res.status(statusCode).json({
    status: 'error',
    code: err.code || (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR'),
    message: expose || env.nodeEnv !== 'production' ? err.message : 'Internal Server Error',
    ...(env.nodeEnv !== 'production' && statusCode >= 500 ? { stack: err.stack } : {}),
  });
}

module.exports = { errorHandler, notFoundHandler, HttpError };
