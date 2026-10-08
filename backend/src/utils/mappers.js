// src/utils/mappers.js — แปลง row ของ Oracle (UPPERCASE keys) เป็น response ตาม OpenAPI

function toIso(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseRoles(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  return String(value)
    .split(',')
    .map((role) => role.trim())
    .filter((role) => role.length > 0);
}

function numOrNull(value) {
  return value === null || value === undefined || value === '' ? null : Number(value);
}

// EmployeeProfile ตาม OpenAPI — ห้ามมี password_hash ในนี้เด็ดขาด
function toEmployeeProfile(row, roles) {
  return {
    emp_id: Number(row.EMP_ID),
    emp_code: row.EMP_CODE,
    first_name: row.FIRST_NAME,
    last_name: row.LAST_NAME,
    phone: row.PHONE ?? null,
    email: row.EMAIL ?? null,
    dept_id: numOrNull(row.DEPT_ID),
    dept_name: row.DEPT_NAME ?? null,
    position_id: numOrNull(row.POSITION_ID),
    position_name: row.POSITION_NAME ?? null,
    username: row.USERNAME,
    is_active: Number(row.IS_ACTIVE),
    roles: roles !== undefined ? roles : parseRoles(row.ROLES),
    created_at: toIso(row.CREATED_AT),
  };
}

function toDepartment(row) {
  return {
    dept_id: Number(row.DEPT_ID),
    dept_name: row.DEPT_NAME,
    created_at: toIso(row.CREATED_AT),
  };
}

function toPosition(row) {
  return {
    position_id: Number(row.POSITION_ID),
    position_name: row.POSITION_NAME,
  };
}

// MenuItem — icon คงเป็น null จนกว่าจะมี mapping ในโค้ด client (17.6.3)
function toMenuItem(row) {
  return {
    screen_key: row.screen_key ?? row.SCREEN_KEY,
    label: row.menu_label ?? row.MENU_LABEL,
    icon: null,
    sort_no: Number(row.sort_no ?? row.SORT_NO),
  };
}

// AppRole ตาม OpenAPI (T-019) — ไม่รวม granted_perm_ids (อยู่ที่ listRoles ซึ่ง query LISTAGG มาให้)
function toAppRole(row) {
  return {
    role_id: Number(row.ROLE_ID),
    role_name: row.ROLE_NAME,
    description: row.DESCRIPTION ?? null,
    is_active: Number(row.IS_ACTIVE),
  };
}

// Permission ตาม OpenAPI (T-020)
function toPermission(row) {
  return {
    perm_id: Number(row.PERM_ID),
    perm_code: row.PERM_CODE,
    perm_name: row.PERM_NAME,
    module: row.MODULE,
    screen_key: row.SCREEN_KEY ?? null,
    sort_no: Number(row.SORT_NO ?? 0),
  };
}

// '1,2,5' (LISTAGG) → [1, 2, 5] · ไม่มีสิทธิ์เลย → []
function parseGrantedIds(value) {
  if (Array.isArray(value)) return value.map(Number);
  if (value === null || value === undefined || value === '') return [];
  return String(value)
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

// Stop ตาม OpenAPI (T-024) — BR-03: จุดจอด 1 จุดอยู่ได้หลายเส้นทาง
function toStop(row) {
  return {
    stop_id: Number(row.STOP_ID),
    stop_name: row.STOP_NAME,
    address: row.ADDRESS ?? null,
    latitude: numOrNull(row.LATITUDE),
    longitude: numOrNull(row.LONGITUDE),
    is_active: Number(row.IS_ACTIVE),
  };
}

// Route ตาม OpenAPI (T-025) — total_minutes/stop_count เป็น readOnly (BR-01)
function toRoute(row) {
  return {
    route_id: Number(row.ROUTE_ID),
    route_name: row.ROUTE_NAME,
    total_minutes: Number(row.TOTAL_MINUTES || 0),
    stop_count: Number(row.STOP_COUNT || 0),
    description: row.DESCRIPTION ?? null,
    is_active: Number(row.IS_ACTIVE),
  };
}

// RouteStop ตาม OpenAPI (T-026) — stop_name join มาจาก stop เพื่อแสดงผล
function toRouteStop(row) {
  return {
    route_id: Number(row.ROUTE_ID),
    stop_id: Number(row.STOP_ID),
    stop_seq: Number(row.STOP_SEQ),
    travel_minutes: Number(row.TRAVEL_MINUTES),
    stop_name: row.STOP_NAME ?? null,
  };
}

// 'YYYY-MM-DD' (string หรือ DATE ของ Oracle) → 'YYYY-MM-DD'
function dateOnly(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

// Vehicle ตาม OpenAPI (T-029) — allOf VehicleType + vehicle · seats_available
// readOnly/nullable: ไม่มีบริบท "รอบที่กำลังดู" ในรายการรถจึงเป็น null (คำนวณที่ GET /schedules)
function toVehicle(row) {
  return {
    veh_id: Number(row.VEH_ID),
    plate_no: row.PLATE_NO,
    vtype_id: Number(row.VTYPE_ID),
    vtype_name: row.VTYPE_NAME ?? null,
    capacity: numOrNull(row.CAPACITY),
    is_active: Number(row.IS_ACTIVE),
    seats_available: null,
  };
}

// Schedule ตาม OpenAPI (T-030) — end_at = depart_at + route.total_minutes (BR-04 ใช้ช่วงนี้)
// driver เอาคนแรกที่มอบหมาย (MIN assign_id) · seats_total/available = null เมื่อยังไม่มีรถ
function toSchedule(row) {
  const departAt = row.DEPART_AT;
  const totalMinutes = Number(row.TOTAL_MINUTES || 0);
  const departMs = departAt instanceof Date ? departAt.getTime() : new Date(departAt).getTime();
  const endMs = Number.isNaN(departMs) ? NaN : departMs + totalMinutes * 60000;
  const capacity = numOrNull(row.CAPACITY);
  const seatsReserved = Number(row.SEATS_RESERVED || 0);
  const hasVehicle = row.VEH_ID !== null && row.VEH_ID !== undefined;
  return {
    sched_id: Number(row.SCHED_ID),
    route_id: Number(row.ROUTE_ID),
    route_name: row.ROUTE_NAME ?? null,
    service_date: dateOnly(row.SERVICE_DATE),
    depart_at: toIso(departAt),
    end_at: Number.isNaN(endMs) ? null : new Date(endMs).toISOString(),
    is_active: Number(row.IS_ACTIVE),
    stop_count: Number(row.STOP_COUNT || 0),
    driver:
      row.DRIVER_EMP_ID === null || row.DRIVER_EMP_ID === undefined
        ? null
        : {
            emp_id: Number(row.DRIVER_EMP_ID),
            first_name: row.DRIVER_FIRST_NAME ?? null,
            last_name: row.DRIVER_LAST_NAME ?? null,
          },
    vehicle: hasVehicle
      ? {
          veh_id: Number(row.VEH_ID),
          plate_no: row.PLATE_NO ?? null,
          vtype_name: row.VTYPE_NAME ?? null,
          capacity,
        }
      : null,
    seats_total: capacity,
    seats_reserved: seatsReserved,
    seats_available: capacity === null ? null : capacity - seatsReserved,
  };
}

// ScheduleStop ตาม OpenAPI (T-030) — arrive_at readOnly (BR-02 คำนวณตอนสร้างรอบ)
function toScheduleStop(row) {
  return {
    sched_stop_id: Number(row.SCHED_STOP_ID),
    sched_id: Number(row.SCHED_ID),
    stop_id: Number(row.STOP_ID),
    stop_name: row.STOP_NAME ?? null,
    stop_seq: Number(row.STOP_SEQ),
    arrive_at: toIso(row.ARRIVE_AT),
    dwell_minutes: Number(row.DWELL_MINUTES || 0),
  };
}

module.exports = {
  toIso,
  dateOnly,
  parseRoles,
  numOrNull,
  toEmployeeProfile,
  toDepartment,
  toPosition,
  toMenuItem,
  toAppRole,
  toPermission,
  parseGrantedIds,
  toStop,
  toRoute,
  toRouteStop,
  toVehicle,
  toSchedule,
  toScheduleStop,
};
