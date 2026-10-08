// src/middleware/audit.js — T-012 + T-042: audit middleware
// บันทึกทุก write request (POST/PUT/PATCH/DELETE) ลง audit_log ผ่าน sink (ค่าเริ่มต้น = insert DB)
// - GET ไม่ถูก audit (ล็อกโดย middleware.test.js "ไม่เรียก sink สำหรับ GET")
// - path ถูก mask ค่า query ของ password/token/secret ก่อนถึง sink — กัน secret รั่วลงตาราง (T-042)
// - ไม่เก็บ request body / header ใด ๆ เลย
const { log } = require('./logger');

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// ค่าของพารามิเตอร์ที่ sensitive ถูกแทนด้วย *** เฉพาะใน audit entry เท่านั้น (response ไม่กระทบ)
const SENSITIVE_QUERY = /([?&](?:password|token|access_token|refresh_token|qr_token|secret)=)[^&]*/gi;
const redactPath = (url) => String(url || '').replace(SENSITIVE_QUERY, '$1***');

function defaultSink(entry) {
  log('info', `AUDIT ${JSON.stringify(entry)}`);
}

function audit({ sink = defaultSink } = {}) {
  return function auditMiddleware(req, res, next) {
    if (!WRITE_METHODS.has(req.method)) return next();

    const started = Date.now();
    res.on('finish', () => {
      try {
        const result = sink({
          ts: new Date().toISOString(),
          method: req.method,
          path: redactPath(req.originalUrl),
          statusCode: res.statusCode,
          durationMs: Date.now() - started,
          empId: (req.user && req.user.empId) || null, // authenticate วิ่งก่อนจบ request — finish จึงเห็น JWT แล้ว
          ip: req.ip,
        });
        // sink อาจคืน Promise — จับ rejection ตรงนี้กัน unhandledRejection
        if (result && typeof result.then === 'function') {
          result.catch((e) => log('error', `Audit sink failed: ${e.message}`));
        }
      } catch (e) {
        log('error', `Audit sink failed: ${e.message}`);
      }
    });
    return next();
  };
}

module.exports = { audit, WRITE_METHODS, redactPath };
