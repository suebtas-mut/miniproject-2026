// src/config/db.js — node-oracledb Connection Pool (T-011)
// อ้างอิง: docs/chapter-17-fullstack.md 17.5.3 (Thin Mode ไม่ต้อง Instant Client)
const oracledb = require('oracledb');
const env = require('./env');

oracledb.autoCommit = false; // จัดการ Transaction เอง (commit/rollback)

let pool = null;

async function initPool(overrides = {}) {
  if (pool) return pool;
  pool = await oracledb.createPool({
    user: env.db.user,
    password: env.db.pass,
    connectString: env.db.connectString,
    poolMin: env.db.poolMin,
    poolMax: env.db.poolMax,
    poolIncrement: 1,
    poolTimeout: env.db.poolTimeout,
    stmtCacheSize: 25,
    ...overrides,
  });
  return pool;
}

async function closePool() {
  if (pool) {
    await pool.close(10);
    pool = null;
  }
}

function getPool() {
  return pool;
}

// helper สำหรับ SELECT — pool ไม่มี execute() ต้อง getConnection() เสมอ
// Semantics (ทบทวนจาก code review):
// - คงพฤติกรรม non-autocommit ของโปรเจกต์ (oracledb.autoCommit = false ตาม 17.5.3)
//   ห้าม force autoCommit:true สำหรับ SQL ทั่วไป — ไม่งั้นข้อมูลถูก commit เงียบ ๆ
// - งานที่ต้อง commit/rollback ให้ใช้ withTransaction (17.5.3) ไม่ใช่ helper นี้
// - ค่าเริ่มต้น = autoCommit:false; caller ระบุ { autoCommit: true } เอง
//   เฉพาะ statement ที่อ่านอย่างเดียวและต้องการปิด transaction ทันที
// - connection ถูก close เสมอแม้ execute ล้มเหลว (finally)
async function query(sql, binds = [], options = {}) {
  if (!pool) throw new Error('Oracle pool not initialized — call initPool() first');
  const conn = await pool.getConnection();
  try {
    return await conn.execute(sql, binds, { autoCommit: false, ...options });
  } finally {
    await conn.close();
  }
}

// ตรวจสุขภาพฐานข้อมูลสำหรับ GET /health — คืน { connected, latencyMs } หรือ throw
async function checkDbHealth() {
  if (!pool) throw new Error('Oracle pool not initialized');
  const started = Date.now();
  const conn = await pool.getConnection();
  try {
    await conn.execute('SELECT 1 FROM DUAL');
    return { connected: true, latencyMs: Date.now() - started };
  } finally {
    await conn.close();
  }
}

module.exports = { initPool, closePool, getPool, query, checkDbHealth };
