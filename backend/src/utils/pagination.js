// src/utils/pagination.js — แปลง query string → ค่า pagination ที่ปลอดภัย
// ไม่ตอบ 400 เมื่อ page/limit ผิดรูป (OpenAPI GET list ไม่ประกาศ 400) — แต่ค่าที่ได้ต้องอยู่ในขอบเขต
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function clampPage(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return 1;
  return n;
}

function clampLimit(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function parsePagination(query = {}) {
  const page = clampPage(query.page);
  const limit = clampLimit(query.limit);
  return { page, limit, offset: (page - 1) * limit };
}

function buildMeta({ page, limit, total }) {
  return { page, limit, total, total_pages: Math.ceil(total / limit) };
}

function intOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

module.exports = { DEFAULT_LIMIT, MAX_LIMIT, clampPage, clampLimit, parsePagination, buildMeta, intOrNull };
