// src/middleware/errorHandler.js — T-012/T-016: central error handler + 404
// ทุก route ต้องผ่าน middleware ตัวนี้ (Sprint 3 DoD)
// Response envelope ตาม OpenAPI ErrorEnvelope:
//   { success:false, error:{ code, message, details? }, status:'error', code, message, errors? }
// - ฝั่ง envelope เป็น canonical (docs/api/openapi.yaml)
// - คง field บน (status/code/message/errors) ไว้เพื่อ backward compatibility กับ test เดิม
// - 500 ห้าม leak stack/ข้อความจริง (P-04 ข้อ 18) — log ฝั่ง server แทน
const { log } = require('./logger');

const STATUS_CODES = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'DUPLICATED',
  422: 'UNPROCESSABLE',
  429: 'TOO_MANY_ATTEMPTS',
};

const STATUS_MESSAGES = {
  400: 'ข้อมูลที่ส่งมาไม่ถูกต้อง',
  401: 'กรุณาเข้าสู่ระบบใหม่',
  403: 'ไม่มีสิทธิ์เข้าถึงทรัพยากรนี้',
  404: 'ไม่พบข้อมูลที่ต้องการ',
  409: 'ข้อมูลซ้ำ',
  422: 'ข้อมูลอ้างอิงไม่ถูกต้อง',
  429: 'พยายามมากเกินไป กรุณารอสักครู่',
  500: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่อีกครั้ง',
};

// error ที่มี statusCode กำเอง (เช่น จาก service) — ใช้ new HttpError(404, 'msg', { code, details })
class HttpError extends Error {
  constructor(statusCode, message, { code, details } = {}) {
    super(message);
    this.statusCode = statusCode;
    this.expose = statusCode < 500;
    this.code = code;
    this.details = details;
  }
}

function errorBody(statusCode, code, message, details) {
  const body = {
    success: false,
    error: { code, message },
    status: 'error',
    code,
    message,
  };
  if (details !== undefined) body.error.details = details;
  return body;
}

function notFoundHandler(req, res) {
  const message = `Route not found: ${req.method} ${req.originalUrl}`;
  res.status(404).json(errorBody(404, 'NOT_FOUND', message));
}

// T-062 defect fix: body-parser error → envelope มาตรฐาน
// - entity.parse.failed (JSON พัง) → 400 VALIDATION_ERROR ข้อความไทยตาม openapi components/responses/BadRequest
// - entity.too.large (เกิน limit 1mb) → 413 PAYLOAD_TOO_LARGE ข้อความไทย — 413 ไม่มีใน openapi (จดเป็น deviation ในการ review)
function normalizeBodyParserError(err) {
  if (!err || typeof err !== 'object') return err;
  if (err.type === 'entity.parse.failed') {
    return Object.assign(err, {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: STATUS_MESSAGES[400],
      details: undefined,
    });
  }
  if (err.type === 'entity.too.large') {
    return Object.assign(err, {
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'ข้อมูลมีขนาดใหญ่เกินไป',
      details: undefined,
    });
  }
  return err;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  err = normalizeBodyParserError(err);
  const statusCode = err.statusCode || err.status || 500;
  const isServerError = statusCode >= 500;

  if (isServerError) {
    log('error', `Unhandled error: ${req.method} ${req.originalUrl} — ${err.message}\n${err.stack}`);
  }

  // 500 = ห้าม leak รหัส/ข้อความจริง (เช่น ORA-*) จึงใช้ code มาตรฐานเสมอ ส่วน 4xx ใช้ code ที่ service ตั้งไว้
  const code = (isServerError ? null : err.code) || STATUS_CODES[statusCode] || 'INTERNAL_ERROR';
  const message = isServerError ? STATUS_MESSAGES[500] : err.message || STATUS_MESSAGES[statusCode] || 'Error';
  const details = err.details;

  const body = errorBody(statusCode, code, message, details);
  if (Array.isArray(err.errors)) body.errors = err.errors;

  res.status(statusCode).json(body);
}

module.exports = { errorHandler, notFoundHandler, HttpError, errorBody, STATUS_CODES, STATUS_MESSAGES };
