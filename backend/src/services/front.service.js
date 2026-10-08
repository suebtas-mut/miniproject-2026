// src/services/front.service.js — T-024/T-025/T-026/T-027: business logic ของ UC-11/UC-12 (F1)
// - Stop CRUD: 404 ไม่พบ · 409 stop_name ซ้ำ (uq_stop_name) · 422 ยังมี route_stop ใช้อยู่ (fk_rs_stop)
// - Route: GET/POST เท่านั้น (ไม่มี PUT/DELETE /routes/{id} ใน 17.5.2 / openapi → ไม่สร้าง)
// - PUT /routes/:id/stops: validate รูป → ลำดับ 1..n (400) → จุดจอดซ้ำใน payload (409)
//   → route 404 → stop ที่อ้างไม่มีจริง (422) → DELETE เดิม + INSERT ใหม่ + UPDATE total
//   ทั้งหมดใน withTransaction เดียว (OpenAPI x-transaction) — ล้ม → rollback ไม่ครึ่งเส้นทาง
// - BR-01: total_minutes คำนวณจาก SUM(travel_minutes) เท่านั้น ผู้ใช้พิมพ์เองไม่ได้
// - ไม่มีการตัดสินสิทธิ์จากชื่อบทบาทใน service นี้ (dynamic RBAC ทำที่ middleware)
const { HttpError } = require('../middleware/errorHandler');
const { translateOracleError } = require('../utils/oracle');
const { parsePagination, buildMeta, intOrNull } = require('../utils/pagination');
const { toStop, toRoute, toRouteStop } = require('../utils/mappers');

const NOT_FOUND = () => new HttpError(404, 'ไม่พบข้อมูลที่ต้องการ', { code: 'NOT_FOUND' });
const SEQ_MESSAGE = 'ลำดับจุดจอดต้องเรียง 1 ถึง n โดยไม่ซ้ำและไม่ข้าม';
const DUP_STOP_MESSAGE = 'จุดจอดนี้อยู่ในเส้นทางนี้แล้ว ห้ามเพิ่มซ้ำ';
const REF_MESSAGE = 'ข้อมูลอ้างอิงไม่ถูกต้อง (ไม่พบจุดจอดที่ระบุ)';

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function body400(message, field) {
  return new HttpError(400, message, {
    code: 'VALIDATION_ERROR',
    details: [{ field, message }],
  });
}

// ตรวจ + normalize รายการจุดจอดของ PUT /routes/:id/stops
// ลำดับ: รูปค่า (400) → stop_seq 1..n ต่อเนื่อง (400) → stop_id ซ้ำใน payload (409)
function normalizeStops(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw body400('must be a non-empty array', 'stops');
  }
  const stops = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw body400('each item must be an object with stop_id, stop_seq, travel_minutes', 'stops');
    }
    const stopId = intOrNull(item.stop_id);
    const stopSeq = intOrNull(item.stop_seq);
    const travelMinutes = intOrNull(item.travel_minutes);
    if (stopId === null || stopId <= 0) throw body400('stop_id must be a positive integer', 'stops');
    if (stopSeq === null || stopSeq < 1) throw body400('stop_seq must be an integer >= 1', 'stops');
    if (travelMinutes === null || travelMinutes < 0) {
      // ck_rs_min: travel_minutes >= 0 (จุดแรก = 0 นาที ตามตัวอย่าง OpenAPI)
      throw body400('travel_minutes must be an integer >= 0', 'stops');
    }
    stops.push({ stopId, stopSeq, travelMinutes });
  }

  const seqs = stops.map((s) => s.stopSeq).sort((a, b) => a - b);
  seqs.forEach((seq, index) => {
    if (seq !== index + 1) throw body400(SEQ_MESSAGE, 'stops');
  });

  const seen = new Set();
  for (const s of stops) {
    if (seen.has(s.stopId)) throw new HttpError(409, DUP_STOP_MESSAGE, { code: 'DUPLICATED_STOP' });
    seen.add(s.stopId);
  }

  return stops.slice().sort((a, b) => a.stopSeq - b.stopSeq);
}

function createFrontService({ db, repos }) {
  const { withTransaction } = db;

  // ============================ UC-11 Stops ============================

  async function listStops(queryParams = {}) {
    const { page, limit, offset } = parsePagination(queryParams);
    const q = cleanString(queryParams.q);
    const isActive = intOrNull(queryParams.is_active);
    const filters = {};
    if (q) filters.q = q;
    if (isActive === 0 || isActive === 1) filters.isActive = isActive;
    const [rows, total] = await Promise.all([
      repos.stop.list({ ...filters, limit, offset }),
      repos.stop.count(filters),
    ]);
    return { data: rows.map(toStop), meta: buildMeta({ page, limit, total }) };
  }

  async function createStop(body) {
    const stopName = cleanString(body.stop_name);
    if (await repos.stop.findByName(stopName)) {
      throw new HttpError(409, 'ชื่อจุดจอดนี้มีอยู่แล้ว', { code: 'DUPLICATED' });
    }
    const payload = {
      stopName,
      address: cleanString(body.address) || null,
      latitude: body.latitude === undefined ? null : Number(body.latitude),
      longitude: body.longitude === undefined ? null : Number(body.longitude),
      isActive: body.is_active === undefined ? 1 : Number(body.is_active),
    };
    let stopId;
    try {
      stopId = await withTransaction((conn) => repos.stop.insert(conn, payload));
    } catch (err) {
      throw translateOracleError(err, { duplicate: { message: 'ชื่อจุดจอดนี้มีอยู่แล้ว' } }) || err;
    }
    const created = await repos.stop.findById(stopId);
    if (!created) throw new Error('insert stop succeeded but row not found');
    return toStop(created);
  }

  async function updateStop(stopId, body) {
    const existing = await repos.stop.findById(stopId);
    if (!existing) throw NOT_FOUND();
    const stopName = cleanString(body.stop_name);
    const duplicate = await repos.stop.findByName(stopName, stopId);
    if (duplicate) throw new HttpError(409, 'ชื่อจุดจอดนี้มีอยู่แล้ว', { code: 'DUPLICATED' });
    const payload = {
      stopId,
      stopName,
      address: cleanString(body.address) || null,
      latitude: body.latitude === undefined ? null : Number(body.latitude),
      longitude: body.longitude === undefined ? null : Number(body.longitude),
      // PUT ไม่ส่ง is_active → คงค่าเดิม (ไม่ใช้ default 1 — กันปิดใช้/เปิดใช้เงียบ ๆ)
      isActive: body.is_active === undefined ? Number(existing.IS_ACTIVE) : Number(body.is_active),
    };
    try {
      await withTransaction((conn) => repos.stop.update(conn, payload));
    } catch (err) {
      throw translateOracleError(err, { duplicate: { message: 'ชื่อจุดจอดนี้มีอยู่แล้ว' } }) || err;
    }
    return toStop(await repos.stop.findById(stopId));
  }

  async function deleteStop(stopId) {
    const existing = await repos.stop.findById(stopId);
    if (!existing) throw NOT_FOUND();
    const busyMessage = 'ยังมีเส้นทางที่ใช้จุดจอดนี้อยู่ กรุณาปิดใช้งานแทน';
    if ((await repos.stop.countRoutesUsingStop(stopId)) > 0) {
      throw new HttpError(422, busyMessage, { code: 'HAS_DEPENDENT_DATA' });
    }
    try {
      await withTransaction((conn) => repos.stop.remove(conn, { stopId }));
    } catch (err) {
      throw translateOracleError(err, { referenced: { message: busyMessage } }) || err;
    }
  }

  // ============================ UC-12 Routes ============================

  async function listRoutes(queryParams = {}) {
    const { page, limit, offset } = parsePagination(queryParams);
    const isActive = intOrNull(queryParams.is_active);
    const filters = isActive === 0 || isActive === 1 ? { isActive } : {};
    const [rows, total] = await Promise.all([
      repos.route.list({ ...filters, limit, offset }),
      repos.route.count(filters),
    ]);
    return { data: rows.map(toRoute), meta: buildMeta({ page, limit, total }) };
  }

  async function createRoute(body) {
    const routeName = cleanString(body.route_name);
    const description = cleanString(body.description) || null;
    const isActive = body.is_active === undefined ? 1 : Number(body.is_active);
    // route ไม่มี constraint ซ้ำ (schema ไม่มี uq_route_name) → ไม่ต้อง map error
    const routeId = await withTransaction((conn) =>
      repos.route.insert(conn, { routeName, description, isActive }),
    );
    const created = await repos.route.findById(routeId);
    if (!created) throw new Error('insert route succeeded but row not found');
    return toRoute(created);
  }

  async function getRouteStops(routeId) {
    const route = await repos.route.findById(routeId);
    if (!route) throw NOT_FOUND();
    const rows = await repos.route.listStops(routeId);
    return {
      route_id: Number(route.ROUTE_ID),
      route_name: route.ROUTE_NAME,
      total_minutes: Number(route.TOTAL_MINUTES || 0),
      stops: rows.map(toRouteStop),
    };
  }

  async function saveRouteStops(routeId, body) {
    const stops = normalizeStops(body.stops); // 400 / 409 ก่อนแตะ DB

    const route = await repos.route.findById(routeId);
    if (!route) throw NOT_FOUND();

    const existing = await repos.stop.findExistingIds(stops.map((s) => s.stopId));
    const foundIds = new Set(existing.map((row) => Number(row.STOP_ID)));
    if (stops.some((s) => !foundIds.has(s.stopId))) {
      throw new HttpError(422, REF_MESSAGE, { code: 'FK_VIOLATION' });
    }

    const totalMinutes = stops.reduce((sum, s) => sum + s.travelMinutes, 0);

    // Transaction เดียว (OpenAPI x-transaction): DELETE เดิม → INSERT ใหม่ → UPDATE total
    // ล้ม statement ใด = rollback ทั้งชุด ไม่ให้เส้นทางเป็นจุดจอดครึ่งทาง
    await withTransaction(async (conn) => {
      await repos.route.deleteAllStops(conn, routeId);
      for (const stop of stops) {
        await repos.route.insertStop(conn, {
          routeId,
          stopId: stop.stopId,
          stopSeq: stop.stopSeq,
          travelMinutes: stop.travelMinutes,
        });
      }
      await repos.route.updateTotalMinutes(conn, { routeId, totalMinutes });
    });

    const fresh = await repos.route.findById(routeId);
    const rows = await repos.route.listStops(routeId);
    return {
      route_id: routeId,
      total_minutes: Number(fresh ? fresh.TOTAL_MINUTES || 0 : totalMinutes),
      stops: rows.map(toRouteStop),
    };
  }

  async function recalculateRoute(routeId) {
    const route = await repos.route.findById(routeId);
    if (!route) throw NOT_FOUND();
    // 1 statement (autoCommit ใน repository) — ไม่เปิด transaction ตาม OpenAPI
    const totalMinutes = await repos.route.recalculateTotal(routeId);
    const stopCount = await repos.route.countStops(routeId);
    return { route_id: routeId, total_minutes: Number(totalMinutes), stop_count: stopCount };
  }

  return {
    listStops,
    createStop,
    updateStop,
    deleteStop,
    listRoutes,
    createRoute,
    getRouteStops,
    saveRouteStops,
    recalculateRoute,
  };
}

module.exports = { createFrontService };
