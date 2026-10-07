// src/middleware/audit.js — T-012: audit middleware
// บันทึกการเปลี่ยนแปลงข้อมูล (POST/PUT/PATCH/DELETE) ลง audit_log ผ่าน callback
// ตอนนี้ยังไม่มี table audit_log (T-042) จึง inject sink เพื่อให้ test ได้
const { log } = require('./logger');

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Date.now() - started,
          empId: (req.user && req.user.empId) || null, // ยังไม่มี auth — Sprint 4 เติมจาก JWT
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

module.exports = { audit, WRITE_METHODS };
