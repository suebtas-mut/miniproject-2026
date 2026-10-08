// src/services/scheduling.service.js — T-029/T-030/T-031/T-032: business logic ของ UC-13…UC-16 (F2)
// - Vehicle: GET/POST เท่านั้น · ไม่มี /vehicle-types CRUD (17.5.2/openapi ไม่ประกาศ)
// - Schedule: POST สร้างรอบ + auto-generate schedule_stop (BR-02) ใน transaction เดียว
//   404 เส้นทาง → 422 จุดจอดไม่ครบ/total ไม่ตรง (ROUTE_STOPS_INCOMPLETE) → 409 (route_id, depart_at) ซ้ำ → tx
// - DELETE schedule: บล็อกเมื่อมี booking (FK ไม่มี ON DELETE — ลบจริงจะ ORA-02292)
// - Assign: TX = ล็อก schedule FOR UPDATE → ล็อก employee/vehicle FOR UPDATE → ตรวจ BR-04 overlap
//   แบบช่วงเวลาจริง (ASM-07-1) → INSERT → commit · ปฏิเสธพร้อม "แจ้งรอบที่ชน" ไม่ใช่บล็อกเงียบ
// - ไม่มี PUT /schedules/{id} (Q23 ยังค้าง) — ไม่สร้าง endpoint ที่สเปกไม่ประกาศ
// - ไม่มีการตัดสินสิทธิ์จากชื่อบทบาทใน service นี้ (dynamic RBAC ทำที่ middleware)
const { HttpError } = require('../middleware/errorHandler');
const { translateOracleError } = require('../utils/oracle');
const { parsePagination, buildMeta, intOrNull } = require('../utils/pagination');
const { toVehicle, toSchedule, toScheduleStop } = require('../utils/mappers');

const NOT_FOUND = () => new HttpError(404, 'ไม่พบข้อมูลที่ต้องการ', { code: 'NOT_FOUND' });
const DUP_PLATE_MESSAGE = 'ทะเบียนรถนี้มีอยู่แล้ว';
const VTYPE_REF_MESSAGE = 'ข้อมูลอ้างอิงไม่ถูกต้อง (ไม่พบประเภทรถที่ระบุ)';
const INCOMPLETE_MESSAGE = 'กรุณาเรียงจุดจอดของเส้นทางให้ครบก่อนสร้างรอบเวลา';
const NOT_A_DRIVER_MESSAGE = 'พนักงานคนนี้ไม่ได้มีบทบาท DRIVER';
const VEHICLE_INACTIVE_MESSAGE = 'รถคันนี้ถูกปิดใช้งานอยู่';
const DRIVER_ALREADY_MESSAGE = 'คนขับคนนี้ถูกรอบนี้มอบหมายอยู่แล้ว';
const VEHICLE_ALREADY_MESSAGE = 'รอบนี้มีรถมอบหมายอยู่แล้ว';
const DRIVER_CONFLICT_MESSAGE = 'คนขับคนนี้ชนกับรอบเวลาอื่นอยู่';
const VEHICLE_CONFLICT_MESSAGE = 'รถคันนี้ถูกมอบหมายในรอบเวลาที่ทับกันอยู่';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEPART_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?/;

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function body400(message, field) {
  return new HttpError(400, message, {
    code: 'VALIDATION_ERROR',
    details: [{ field, message }],
  });
}

// วันที่มีจริงในปฏิทิน — Date.parse ของ V8 ยอม '2026-02-30' (rollover → 2 มี.ค.)
//   เลยต้องเช็ค round-trip UTC เอง กันเดือน/วันเกินจริง
function isRealDate(text) {
  const [y, m, d] = text.split('-').map(Number);
  const round = new Date(Date.UTC(y, m - 1, d));
  return round.getUTCFullYear() === y && round.getUTCMonth() === m - 1 && round.getUTCDate() === d;
}

// 'YYYY-MM-DD' ที่เป็นวันจริง (กัน 2026-02-30) → คืนค่าเอง ไม่ valid → null (GET = เมิน, POST = 400)
function normalizeServiceDate(value) {
  const text = cleanString(value);
  if (typeof text !== 'string' || !DATE_RE.test(text)) return null;
  if (!isRealDate(text)) return null;
  return text;
}

// depart_at (ISO 8601) → { date, hm, dateObj } · เก็บ wall-clock ที่ผู้ใช้ส่งมา (ไม่แปลง timezone)
function normalizeDepartAt(value) {
  const text = cleanString(value);
  if (typeof text !== 'string') return null;
  const match = DEPART_RE.exec(text);
  if (!match) return null;
  if (!isRealDate(match[1])) return null;
  const dateObj = new Date(text);
  if (Number.isNaN(dateObj.getTime())) return null;
  return { date: match[1], hm: match[2], seconds: match[3] || '00', dateObj };
}

function dupScheduleMessage(hm) {
  return `เส้นทางนี้มีรอบเวลา ${hm} ของวันที่นี้อยู่แล้ว`;
}

function bookingMessage(count) {
  return `รอบนี้มีการจองแล้ว ${count} รายการ กรุณาแจ้งผู้ใช้ก่อนยกเลิก`;
}

// '2026-10-02' หรือ Date → { date: 'YYYY-MM-DD', hm: 'HH:MM' } (string ตัดตรง, Date ผ่าน ISO)
function stampParts(value) {
  const iso = value instanceof Date ? value.toISOString() : String(value);
  return { date: iso.slice(0, 10), hm: iso.slice(11, 16) };
}

// BR-04 / ASM-07-1: ช่วงเวลาของรอบ = [depart_at, depart_at + route.total_minutes]
function intervalOf(scheduleRow, totalMinutes) {
  const start = new Date(scheduleRow.DEPART_AT).getTime();
  const end = start + Number(totalMinutes || 0) * 60000;
  return { start, end };
}

// ทับกันจริง = ซ้อนทับกัน strict — ชนชิดขอบ (จุดสิ้นสุด = จุดเริ่มต้น) ไม่นับเป็น conflict
function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

function conflictDetail(row) {
  const depart = stampParts(row.DEPART_AT);
  const parts = stampParts(row.SERVICE_DATE);
  const endHm = stampParts(new Date(new Date(row.DEPART_AT).getTime() + Number(row.TOTAL_MINUTES || 0) * 60000)).hm;
  return `ชนกับรอบ ${Number(row.SCHED_ID)} วันที่ ${parts.date} เวลา ${depart.hm}-${endHm}`;
}

function conflict409(code, message, row) {
  return new HttpError(409, message, {
    code,
    details: [{ field: 'sched_id', message: conflictDetail(row) }],
  });
}

function createSchedulingService({ db, repos }) {
  const { withTransaction } = db;

  // ============================ UC-13 Vehicles ============================

  async function listVehicles(queryParams = {}) {
    const { page, limit, offset } = parsePagination(queryParams);
    const isActive = intOrNull(queryParams.is_active);
    const vtypeId = intOrNull(queryParams.vtype_id);
    const filters = {};
    if (isActive === 0 || isActive === 1) filters.isActive = isActive;
    if (vtypeId !== null && vtypeId > 0) filters.vtypeId = vtypeId;
    const [rows, total] = await Promise.all([
      repos.vehicle.list({ ...filters, limit, offset }),
      repos.vehicle.count(filters),
    ]);
    return { data: rows.map(toVehicle), meta: buildMeta({ page, limit, total }) };
  }

  async function createVehicle(body) {
    const plateNo = cleanString(body.plate_no);
    const vtypeId = intOrNull(body.vtype_id);
    if (!plateNo) throw body400('plate_no is required', 'plate_no');
    if (vtypeId === null || vtypeId <= 0) throw body400('vtype_id must be a positive integer', 'vtype_id');
    if (await repos.vehicle.findByPlate(plateNo)) {
      throw new HttpError(409, DUP_PLATE_MESSAGE, { code: 'DUPLICATED' });
    }
    if (!(await repos.vehicle.findVtype(vtypeId))) {
      throw new HttpError(422, VTYPE_REF_MESSAGE, { code: 'FK_VIOLATION' });
    }
    const isActive = body.is_active === undefined ? 1 : Number(body.is_active);
    let vehId;
    try {
      vehId = await withTransaction((conn) => repos.vehicle.insert(conn, { plateNo, vtypeId, isActive }));
    } catch (err) {
      throw (
        translateOracleError(err, {
          duplicate: { message: DUP_PLATE_MESSAGE },
          foreignKey: { message: VTYPE_REF_MESSAGE },
        }) || err
      );
    }
    const created = await repos.vehicle.findById(vehId);
    if (!created) throw new Error('insert vehicle succeeded but row not found');
    return toVehicle(created);
  }

  // ============================ UC-14 Schedules ============================

  async function listSchedules(queryParams = {}) {
    const { page, limit, offset } = parsePagination(queryParams);
    const routeId = intOrNull(queryParams.route_id);
    const isActive = intOrNull(queryParams.is_active);
    const filters = {};
    if (routeId !== null && routeId > 0) filters.routeId = routeId;
    if (isActive === 0 || isActive === 1) filters.isActive = isActive;
    // GET invalid filters ถูกละเลยไม่ใช่ 400 (แนวเดิม sprint04/05/06)
    const from = normalizeServiceDate(queryParams.from);
    const to = normalizeServiceDate(queryParams.to);
    if (from) filters.from = from;
    if (to) filters.to = to;
    const [rows, total] = await Promise.all([
      repos.schedule.list({ ...filters, limit, offset }),
      repos.schedule.count(filters),
    ]);
    return { data: rows.map(toSchedule), meta: buildMeta({ page, limit, total }) };
  }

  async function createSchedule(body) {
    const routeId = intOrNull(body.route_id);
    const serviceDate = normalizeServiceDate(body.service_date);
    const depart = normalizeDepartAt(body.depart_at);
    if (routeId === null || routeId <= 0) throw body400('route_id must be a positive integer', 'route_id');
    if (!serviceDate) throw body400('service_date must be a date (YYYY-MM-DD)', 'service_date');
    if (!depart) throw body400('depart_at must be a date-time (ISO 8601)', 'depart_at');
    const isActive = body.is_active === undefined ? 1 : Number(body.is_active);

    // 1) เส้นทางต้องมีอยู่ (404) → 2) จุดจอดครบ + ลำดับ 1..n + total_minutes ตรง SUM (422)
    //    → 3) (route_id, depart_at) ห้ามซ้ำ (409) → 4) transaction INSERT ทั้งชุด
    const route = await repos.route.findById(routeId);
    if (!route) throw NOT_FOUND();

    const stops = await repos.route.listStops(routeId); // เรียง stop_seq แล้ว (repo ORDER BY)
    const sumMinutes = stops.reduce((sum, s) => sum + Number(s.TRAVEL_MINUTES || 0), 0);
    const seqComplete = stops.length > 0 && stops.every((s, index) => Number(s.STOP_SEQ) === index + 1);
    const totalMatches = sumMinutes === Number(route.TOTAL_MINUTES || 0);
    if (!seqComplete || !totalMatches) {
      throw new HttpError(422, INCOMPLETE_MESSAGE, { code: 'ROUTE_STOPS_INCOMPLETE' });
    }

    if (await repos.schedule.findDuplicate(routeId, depart.dateObj)) {
      throw new HttpError(409, dupScheduleMessage(depart.hm), { code: 'DUPLICATED' });
    }

    let schedId;
    try {
      schedId = await withTransaction(async (conn) => {
        const id = await repos.schedule.insert(conn, {
          routeId,
          serviceDate,
          departAt: depart.dateObj,
          isActive,
        });
        // BR-02: arrive_at ของจุด i = depart_at + SUM(travel_minutes[1..i]) นาที (offset เรียงตาม stop_seq)
        let offset = 0;
        for (const stop of stops) {
          offset += Number(stop.TRAVEL_MINUTES || 0);
          await repos.schedule.insertStop(conn, {
            schedId: id,
            stopId: Number(stop.STOP_ID),
            stopSeq: Number(stop.STOP_SEQ),
            departAt: depart.dateObj,
            offsetMin: offset,
          });
        }
        return id;
      });
    } catch (err) {
      // race: TX อื่น insert (route_id, depart_at) ทันระหว่าง pre-check → ORA-00001 → 409 เดียวกัน
      throw translateOracleError(err, { duplicate: { message: dupScheduleMessage(depart.hm) } }) || err;
    }
    const created = await repos.schedule.findById(schedId);
    if (!created) throw new Error('insert schedule succeeded but row not found');
    return toSchedule(created);
  }

  async function getSchedule(schedId) {
    const row = await repos.schedule.findById(schedId);
    if (!row) throw NOT_FOUND();
    const stops = await repos.schedule.findStops(schedId);
    return { ...toSchedule(row), stops: stops.map(toScheduleStop) };
  }

  async function deleteSchedule(schedId) {
    const row = await repos.schedule.findById(schedId);
    if (!row) throw NOT_FOUND();
    const bookingCount = await repos.schedule.countBookings(schedId);
    if (bookingCount > 0) {
      throw new HttpError(409, bookingMessage(bookingCount), {
        code: 'SCHEDULE_HAS_BOOKING',
        details: [{ field: 'booking_count', message: String(bookingCount) }],
      });
    }
    try {
      await withTransaction((conn) => repos.schedule.deleteById(conn, schedId));
    } catch (err) {
      // booking.sched_id ไม่มี ON DELETE — ถ้ามี booking แทรกเข้ามาระหว่าง pre-check ให้ตอบ 409 เดียวกัน
      throw (
        translateOracleError(err, {
          referenced: { message: bookingMessage(bookingCount), code: 'SCHEDULE_HAS_BOOKING' },
        }) || err
      );
    }
  }

  // ==================== UC-15 / UC-16 Assignments (BR-04) ====================

  async function assignDriver(schedId, body) {
    const empId = intOrNull(body.emp_id);
    if (empId === null || empId <= 0) throw body400('emp_id must be a positive integer', 'emp_id');

    const result = await withTransaction(async (conn) => {
      // 1) ล็อกแถวรอบก่อนเสมอ (FOR UPDATE — ไม่ใช่ aggregate) · ไม่พบ = 404
      const sched = await repos.schedule.lockSchedule(conn, schedId);
      if (!sched) throw NOT_FOUND();
      // 2) ล็อกแถวคนขับ — serialize 2 TX ที่มอบหมายคนคนเดียวกันพร้อมกัน
      const employee = await repos.schedule.lockEmployee(conn, empId);
      if (!employee) throw NOT_FOUND();
      // 3) ต้องมี Role = DRIVER (UC-15) → 422
      if (!(await repos.schedule.isDriver(conn, empId))) {
        throw new HttpError(422, NOT_A_DRIVER_MESSAGE, { code: 'NOT_A_DRIVER' });
      }
      // 4) รอบนี้มีคนขับคนนี้แล้ว (uq_driver_sched) → 409
      if (await repos.schedule.countDriverAssignment(conn, schedId, empId)) {
        throw new HttpError(409, DRIVER_ALREADY_MESSAGE, { code: 'ALREADY_ASSIGNED' });
      }
      const route = await repos.route.findById(Number(sched.ROUTE_ID));
      if (!route) throw NOT_FOUND();
      // 5) BR-04: ตรวจช่วงเวลาทับกันกับรอบอื่นของคนขับคนเดียวกัน
      const target = intervalOf(sched, route.TOTAL_MINUTES);
      const conflicts = await repos.schedule.findDriverConflicts(conn, empId, schedId);
      const hit = conflicts.find((row) => overlaps(target, intervalOf(row, row.TOTAL_MINUTES)));
      if (hit) throw conflict409('DRIVER_CONFLICT', DRIVER_CONFLICT_MESSAGE, hit);
      // 6) INSERT driver_assign
      const assignId = await repos.schedule.insertDriverAssign(conn, { schedId, empId });
      return { assignId, employee };
    });

    const driverName = `${result.employee.FIRST_NAME || ''} ${result.employee.LAST_NAME || ''}`.trim();
    return {
      assign_id: Number(result.assignId),
      sched_id: Number(schedId),
      emp_id: Number(empId),
      driver_name: driverName,
    };
  }

  async function unassignDriver(schedId) {
    const existing = await repos.schedule.countDriverAssigns(schedId);
    if (existing === 0) throw NOT_FOUND();
    await withTransaction((conn) => repos.schedule.deleteDriverAssigns(conn, schedId));
  }

  async function assignVehicle(schedId, body) {
    const vehId = intOrNull(body.veh_id);
    if (vehId === null || vehId <= 0) throw body400('veh_id must be a positive integer', 'veh_id');

    const result = await withTransaction(async (conn) => {
      // 1) ล็อกแถวก่อน — schedule → vehicle (ลำดับคงที่ กัน deadlock)
      const sched = await repos.schedule.lockSchedule(conn, schedId);
      if (!sched) throw NOT_FOUND();
      const vehicle = await repos.vehicle.lockById(conn, vehId);
      if (!vehicle) throw NOT_FOUND();
      // 2) รถต้องเปิดใช้งาน (UC-16) → 422
      if (Number(vehicle.IS_ACTIVE) !== 1) {
        throw new HttpError(422, VEHICLE_INACTIVE_MESSAGE, { code: 'VEHICLE_INACTIVE' });
      }
      // 3) 1 รอบมี 1 รถ (uq_vehicle_sched ไม่กันคนละรถ) → 409
      if (await repos.schedule.countVehicleAssignment(conn, schedId)) {
        throw new HttpError(409, VEHICLE_ALREADY_MESSAGE, { code: 'ALREADY_ASSIGNED' });
      }
      const route = await repos.route.findById(Number(sched.ROUTE_ID));
      if (!route) throw NOT_FOUND();
      // 4) BR-04: ตรวจช่วงเวลาทับกันกับรอบอื่นของรถคันเดียวกัน
      const target = intervalOf(sched, route.TOTAL_MINUTES);
      const conflicts = await repos.schedule.findVehicleConflicts(conn, vehId, schedId);
      const hit = conflicts.find((row) => overlaps(target, intervalOf(row, row.TOTAL_MINUTES)));
      if (hit) throw conflict409('VEHICLE_CONFLICT', VEHICLE_CONFLICT_MESSAGE, hit);
      // 5) INSERT vehicle_assign + คืน capacity ของรอบ (BR-07)
      const vtype = await repos.vehicle.findVtype(Number(vehicle.VTYPE_ID));
      const assignId = await repos.schedule.insertVehicleAssign(conn, { schedId, vehId });
      return { assignId, vehicle, capacity: vtype ? Number(vtype.CAPACITY) : null };
    });

    return {
      assign_id: Number(result.assignId),
      sched_id: Number(schedId),
      veh_id: Number(vehId),
      plate_no: result.vehicle.PLATE_NO,
      capacity: result.capacity,
    };
  }

  async function unassignVehicle(schedId) {
    const existing = await repos.schedule.countVehicleAssigns(schedId);
    if (existing === 0) throw NOT_FOUND();
    await withTransaction((conn) => repos.schedule.deleteVehicleAssigns(conn, schedId));
  }

  return {
    listVehicles,
    createVehicle,
    listSchedules,
    createSchedule,
    getSchedule,
    deleteSchedule,
    assignDriver,
    unassignDriver,
    assignVehicle,
    unassignVehicle,
  };
}

module.exports = { createSchedulingService };
