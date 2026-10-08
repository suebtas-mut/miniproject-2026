// src/repositories/audit.repository.js — T-042 (Sprint 9): insert แถว audit_log
// - middleware/audit.js ตัดเฉพาะ write method (POST/PUT/PATCH/DELETE) — GET ไม่เข้าตารางนี้
// - ไม่รับ/ไม่เก็บ body, header, token — path ถูก mask ค่า query ของ password/token ที่ middleware แล้ว
// - autoCommit:true ต่อ insert เดียว (global oracledb.autoCommit = false) — audit ห้าม roll back รวม TX หลัก
// - emp_id ไม่ทำ FK (ตารางต้นทางไม่มี FK) — log ต้องอยู่แม้ลบพนักงานออกจากระบบ
const { query } = require('../config/db');

function createAuditRepository(db) {
  const run = db && typeof db.query === 'function' ? db.query.bind(db) : query;

  async function insert(entry) {
    await run(
      `INSERT INTO audit_log (method, path, status_code, duration_ms, emp_id, ip)
       VALUES (:method, :path, :statusCode, :durationMs, :empId, :ip)`,
      {
        method: String(entry.method || '').slice(0, 10),
        path: String(entry.path || '').slice(0, 500),
        statusCode: entry.statusCode == null ? null : Number(entry.statusCode),
        durationMs: entry.durationMs == null ? null : Number(entry.durationMs),
        empId: entry.empId == null ? null : Number(entry.empId),
        ip: entry.ip == null ? null : String(entry.ip).slice(0, 45),
      },
      { autoCommit: true },
    );
  }

  return { insert };
}

module.exports = { createAuditRepository };
