// src/services/booking.service.js — T-034…T-039: UC-17 (รอบที่จองได้), UC-18 (จอง), UC-19 (My Booking),
//   UC-20 (QR), UC-21 (ยกเลิก + BR-08)
// - listAvailable: กรอง BR-05/BR-07/BR-11/BR-12 ที่ SQL แล้ว + ตรวจอีชั้นฝั่ง service (defense in depth)
//   · BR-11 ทุกคู่กลับด้านในวันนั้น → 400 STOP_ORDER_INVALID (openapi /booking/available)
// - createBooking: 404 รอบ / 422 จุดจอด (BR-12, BR-11) → TX: FOR UPDATE NOWAIT (ORA-00054 → 409)
//   → BR-05 → BR-06 (1-4) → BR-07 (SEAT_FULL พร้อมจำนวนที่เหลือ) → INSERT ('BK'||seq) + qr_token → COMMIT
//   · ORA-02290 (ck_booking_seats) → 400 BR-06 — CHECK CONSTRAINT ชั้นรอง (T-036)
// - listMyBookings (UC-19): กรอง status upcoming/completed/cancelled/all · cust_id จาก JWT เสมอ · meta
// - getBookingQr: ต้องเป็นเจ้าของ (403) · cancelled → 404 · qr_image = base64 PNG จาก qrcode (server-side)
// - cancelBooking (UC-21): TX SELECT booking FOR UPDATE → 404 → 403 เจ้าของ → 409/422 สถานะ
//   → 409 เกิน 20 นาที (ASM-07-2) → UPDATE cancelled + cancel_time → BR-08 ที่นั่งคืนทันที (SUM นับเฉพาะ reserved)
// - qr_token = crypto.randomBytes(16) → hex 32 ตัว — เดาไม่ได้ + เปลี่ยนได้ (uq_booking_qr · ASM-07-3)
const crypto = require('crypto');
const QRCode = require('qrcode');
const { HttpError } = require('../middleware/errorHandler');
const { intOrNull, parsePagination, buildMeta } = require('../utils/pagination');
const { dateOnly, toIso, numOrNull } = require('../utils/mappers');

const NOT_FOUND = () => new HttpError(404, 'ไม่พบข้อมูลที่ต้องการ', { code: 'NOT_FOUND' });
const LEAD_MINUTES = 20; // BR-05 (ต้องจองก่อนถึงจุดขึ้นอย่างน้อย 20 นาที) · ASM-07-2 (ยกเลิกก่อนถึง 20 นาที)
const MAX_SEATS = 4; // BR-06 — ต่อ 1 การจอง (ck_booking_seats · Q19 ตีความ per-booking)

const ORA_ROW_LOCKED = 54; // ORA-00054 resource busy — FOR UPDATE NOWAIT ล็อกไม่ได้
const ORA_CHECK_VIOLATED = 2290; // ORA-02290 — ck_booking_seats (BR-06 ชั้นฐานข้อมูล · T-036)

const LEAD_MESSAGE = 'กรุณาจองล่วงหน้าอย่างน้อย 20 นาทีก่อนรถถึงจุดขึ้น';
const STOP_NOT_IN_ROUTE_MESSAGE = 'จุดจอดที่เลือกไม่อยู่ในเส้นทางของรอบเวลานี้';
const STOP_ORDER_MESSAGE = 'จุดจอดลงต้องอยู่หลังจุดจอดขึ้น';
const SEAT_FULL_MESSAGE = 'ที่นั่งไม่เพียงพอ';
const LOCK_MESSAGE = 'รอบเวลานี้ถูกจองพร้อมกัน กรุณาลองอีกครั้ง';
const FOREIGN_QR_MESSAGE = 'ไม่มีสิทธิ์ดู QR ของการจองนี้';
const BR06_DETAILS = 'ต้องมีค่าระหว่าง 1 ถึง 4 (BR-06)';
const FOREIGN_CANCEL_MESSAGE = 'ยกเลิกได้เฉพาะรายการของตัวเองเท่านั้น'; // openapi 403 cancel
const ALREADY_CANCELLED_MESSAGE = 'การจองนี้ถูกยกเลิกไปแล้ว'; // 409 — ซ้ำ (repeated cancellation)
const CANCEL_TOO_LATE_MESSAGE = 'เลยกำหนดเวลายกเลิกแล้ว'; // openapi 409 CANCEL_TOO_LATE (ASM-07-2)
const CANCEL_SUCCESS_MESSAGE = 'ยกเลิกการจองสำเร็จ ที่นั่งถูกคืนเข้ารอบแล้ว'; // openapi 200 example

const MY_STATUS_VALUES = ['upcoming', 'completed', 'cancelled', 'all']; // openapi StatusParam (UC-19)

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 400 แบบ validate middleware — envelope เดียวกับ components/responses/BadRequest
function body400(field, message) {
  return new HttpError(400, 'ข้อมูลที่ส่งมาไม่ถูกต้อง', {
    code: 'VALIDATION_ERROR',
    details: [{ field, message }],
  });
}

// วันที่มีจริงในปฏิทิน (V8 Date.parse ยอม '2026-02-30' → rollover) — แบบเดียวกับ scheduling.service
function isRealDate(text) {
  const [y, m, d] = text.split('-').map(Number);
  const round = new Date(Date.UTC(y, m - 1, d));
  return round.getUTCFullYear() === y && round.getUTCMonth() === m - 1 && round.getUTCDate() === d;
}

function requireInt(value, field) {
  if (value === undefined || value === null || value === '') throw body400(field, 'is required');
  const n = intOrNull(value);
  if (n === null || n <= 0) throw body400(field, 'must be a positive integer');
  return n;
}

function requireDate(value) {
  if (value === undefined || value === null || value === '') throw body400('date', 'is required');
  const text = typeof value === 'string' ? value.trim() : null;
  if (text === null || !DATE_RE.test(text) || !isRealDate(text)) {
    throw body400('date', 'must be a date (YYYY-MM-DD)');
  }
  return text;
}

// BR-05: นาทีที่เหลือก่อนถึงจุดขึ้น (floor) — ใช้ filter ใน listAvailable + re-check ใน TX
function leadMinutes(arriveAt) {
  const arriveMs = arriveAt instanceof Date ? arriveAt.getTime() : new Date(arriveAt).getTime();
  if (Number.isNaN(arriveMs)) return -Infinity;
  return Math.floor((arriveMs - Date.now()) / 60000);
}

// qr_image = base64 ของ PNG — client เติม prefix `data:image/png;base64,` เอง (openapi BookingQr)
async function renderQrImage(token) {
  const buffer = await QRCode.toBuffer(token, { type: 'png', margin: 1, width: 256 });
  return buffer.toString('base64');
}

function seatFullError(remaining) {
  const left = Math.max(0, remaining);
  return new HttpError(409, SEAT_FULL_MESSAGE, {
    code: 'SEAT_FULL',
    details: [{ field: 'seats', message: `เหลือที่นั่งว่าง ${left} ที่นั่ง` }],
  });
}

// AvailableSchedule ตาม openapi — minutes_until_board คำนวณจากเวลาถึงจุดขึ้น (BR-05)
function toAvailable(row) {
  const seatsTotal = numOrNull(row.SEATS_TOTAL);
  const seatsReserved = Number(row.SEATS_RESERVED || 0);
  return {
    sched_id: Number(row.SCHED_ID),
    route_id: Number(row.ROUTE_ID),
    route_name: row.ROUTE_NAME ?? null,
    service_date: dateOnly(row.SERVICE_DATE),
    depart_at: toIso(row.DEPART_AT),
    board_stop: {
      stop_id: Number(row.BOARD_STOP_ID),
      stop_name: row.BOARD_STOP_NAME ?? null,
      stop_seq: numOrNull(row.BOARD_SEQ),
    },
    alight_stop: {
      stop_id: Number(row.ALIGHT_STOP_ID),
      stop_name: row.ALIGHT_STOP_NAME ?? null,
      stop_seq: numOrNull(row.ALIGHT_SEQ),
    },
    board_arrive_at: toIso(row.BOARD_ARRIVE_AT),
    minutes_until_board: leadMinutes(row.BOARD_ARRIVE_AT),
    seats_total: seatsTotal,
    seats_reserved: seatsReserved,
    seats_available: seatsTotal === null ? null : seatsTotal - seatsReserved,
    plate_no: row.PLATE_NO ?? null,
  };
}

// แถวจาก SQL ผ่านทุก rule แล้วหรือไม่ (ซ้ำอีกชั้นนอก SQL — BR-05/BR-07/BR-11)
function isBookable(row) {
  if (leadMinutes(row.BOARD_ARRIVE_AT) < LEAD_MINUTES) return false; // BR-05
  if (row.BOARD_SEQ === null || row.BOARD_SEQ === undefined) return false; // BR-12
  if (row.ALIGHT_SEQ === null || row.ALIGHT_SEQ === undefined) return false; // BR-12
  if (Number(row.BOARD_SEQ) >= Number(row.ALIGHT_SEQ)) return false; // BR-11
  const capacity = numOrNull(row.SEATS_TOTAL);
  const reserved = Number(row.SEATS_RESERVED || 0);
  if (capacity === null || capacity - reserved <= 0) return false; // BR-07
  return true;
}

// Booking ตาม openapi (ตัวอย่าง POST /booking) — ไม่รวม schedule object (ยังไม่ประกาศใน 201 example)
function toBooking(row) {
  return {
    booking_id: Number(row.BOOKING_ID),
    booking_code: row.BOOKING_CODE,
    cust_id: Number(row.CUST_ID),
    sched_id: Number(row.SCHED_ID),
    board_stop_id: Number(row.BOARD_STOP_ID),
    board_stop_name: row.BOARD_STOP_NAME ?? null,
    alight_stop_id: Number(row.ALIGHT_STOP_ID),
    alight_stop_name: row.ALIGHT_STOP_NAME ?? null,
    seats: Number(row.SEATS),
    status: row.STATUS,
    book_time: toIso(row.BOOK_TIME),
    cancel_time: toIso(row.CANCEL_TIME),
  };
}

// Booking ฉบับเต็มตาม openapi Booking schema — ใช้กับ GET /booking/me (UC-19) และ cancel 200 (UC-21)
//   (มี cust_name + schedule {service_date, depart_at, route_name, plate_no, driver_name})
function toMyBooking(row) {
  return {
    booking_id: Number(row.BOOKING_ID),
    booking_code: row.BOOKING_CODE,
    cust_id: Number(row.CUST_ID),
    cust_name: row.CUST_NAME ?? null,
    sched_id: Number(row.SCHED_ID),
    board_stop_id: Number(row.BOARD_STOP_ID),
    board_stop_name: row.BOARD_STOP_NAME ?? null,
    alight_stop_id: Number(row.ALIGHT_STOP_ID),
    alight_stop_name: row.ALIGHT_STOP_NAME ?? null,
    seats: Number(row.SEATS),
    status: row.STATUS,
    book_time: toIso(row.BOOK_TIME),
    cancel_time: toIso(row.CANCEL_TIME),
    schedule: {
      service_date: dateOnly(row.SERVICE_DATE),
      depart_at: toIso(row.DEPART_AT),
      route_name: row.ROUTE_NAME ?? null,
      plate_no: row.PLATE_NO ?? null,
      driver_name: row.DRIVER_NAME ?? null,
    },
  };
}

// UC-21 4c: checked_in/completed/no_show ยกเลิกไม่ได้ → 422 INVALID_STATUS (ข้อความ openapi สำหรับ checked_in)
function invalidStatusError(status) {
  const messages = {
    checked_in: 'การจองนี้เช็คอินไปแล้ว จึงยกเลิกไม่ได้',
    completed: 'การจองนี้เดินทางเสร็จแล้ว จึงยกเลิกไม่ได้',
    no_show: 'การจองนี้ถูกบันทึกว่าไม่ขึ้นรถ จึงยกเลิกไม่ได้',
  };
  return new HttpError(422, messages[status] || 'การจองนี้อยู่ในสถานะที่ยกเลิกไม่ได้', { code: 'INVALID_STATUS' });
}

function createBookingService({ db, repos }) {
  const { withTransaction } = db;

  // ============================ UC-17 GET /booking/available ============================
  async function listAvailable(queryParams = {}) {
    const boardStopId = requireInt(queryParams.board_stop, 'board_stop');
    const alightStopId = requireInt(queryParams.alight_stop, 'alight_stop');
    const serviceDate = requireDate(queryParams.date);

    // BR-11: ถ้าทุกคู่ในวันนั้นกลับด้าน → 400 (UC-17 3a) · บางคู่ถูกบางคู่ผิด → ตัว SQL กรองรอบผิดเอง
    const pairs = await repos.booking.findStopPairSeqs({ boardStopId, alightStopId, serviceDate });
    if (pairs.length > 0 && pairs.every((p) => Number(p.BOARD_SEQ) >= Number(p.ALIGHT_SEQ))) {
      throw new HttpError(400, STOP_ORDER_MESSAGE, {
        code: 'STOP_ORDER_INVALID',
        details: [{ field: 'alight_stop', message: STOP_ORDER_MESSAGE }],
      });
    }

    const rows = await repos.booking.findAvailable({ boardStopId, alightStopId, serviceDate });
    return rows.filter(isBookable).map(toAvailable);
  }

  // ============================ UC-18 POST /booking ============================
  async function createBooking(body, custId) {
    const schedId = requireInt(body.sched_id, 'sched_id');
    const boardStopId = requireInt(body.board_stop_id, 'board_stop_id');
    const alightStopId = requireInt(body.alight_stop_id, 'alight_stop_id');
    // BR-06: 400 ตามตัวอย่าง openapi BadRequest (field seats · 1-4 ที่นั่ง)
    const seats = intOrNull(body.seats);
    if (seats === null || seats < 1 || seats > MAX_SEATS) throw body400('seats', BR06_DETAILS);

    // pre-tx: 404 รอบไม่มี/ถูกปิด · 422 BR-12 จุดจอดไม่อยู่ในรอบ · 422 BR-11 ลำดับผิด
    const ctx = await repos.booking.findBookingContext({ schedId, boardStopId, alightStopId });
    if (!ctx || Number(ctx.IS_ACTIVE) !== 1) throw NOT_FOUND();
    if (ctx.BOARD_SEQ === null || ctx.BOARD_SEQ === undefined || ctx.ALIGHT_SEQ === null || ctx.ALIGHT_SEQ === undefined) {
      throw new HttpError(422, STOP_NOT_IN_ROUTE_MESSAGE, {
        code: 'STOP_NOT_IN_ROUTE',
        details: [{ field: 'board_stop_id', message: STOP_NOT_IN_ROUTE_MESSAGE }],
      });
    }
    if (Number(ctx.BOARD_SEQ) >= Number(ctx.ALIGHT_SEQ)) {
      throw new HttpError(422, STOP_ORDER_MESSAGE, {
        code: 'STOP_ORDER_INVALID',
        details: [{ field: 'alight_stop_id', message: STOP_ORDER_MESSAGE }],
      });
    }

    const qrToken = crypto.randomBytes(16).toString('hex'); // เดาไม่ได้ · เปลี่ยนได้ (uq_booking_qr)

    let bookingId;
    try {
      bookingId = await withTransaction(async (conn) => {
        // 1) ล็อกแถวรอบก่อนเสมอ (NOWAIT) — ไม่ใช่ aggregate (ORA-02014) · ไม่พบ → 404
        const locked = await repos.booking.lockSchedule(conn, schedId);
        if (!locked) throw NOT_FOUND();
        // 2) BR-05 re-check ด้วยนาฬิกาฝั่ง server (B1 ข้อ 4 — ไม่เชื่อค่าจาก client)
        if (leadMinutes(ctx.BOARD_ARRIVE_AT) < LEAD_MINUTES) {
          throw new HttpError(400, LEAD_MESSAGE, {
            code: 'LEAD_TIME_REQUIRED',
            details: [{ field: 'sched_id', message: LEAD_MESSAGE }],
          });
        }
        // 3) BR-06 re-check ใน tx (ck_booking_seats เป็นแค่ชั้นรอง)
        if (seats < 1 || seats > MAX_SEATS) throw body400('seats', BR06_DETAILS);
        // 4) BR-07: นับแบบ aggregate หลังล็อก — NVL กัน NULL
        const summary = await repos.booking.seatSummary(conn, schedId);
        const remaining = (summary ? summary.CAPACITY : 0) - (summary ? summary.RESERVED : 0);
        if (seats > remaining) throw seatFullError(remaining);
        // 5) INSERT: booking_code จาก seq_booking_code.NEXTVAL (ใน SQL) + qr_token
        return repos.booking.insertBooking(conn, { custId, schedId, boardStopId, alightStopId, seats, qrToken });
      });
    } catch (err) {
      if (err && err.errorNum === ORA_ROW_LOCKED) {
        throw new HttpError(409, LOCK_MESSAGE, {
          code: 'SCHEDULE_LOCKED',
          details: [{ field: 'sched_id', message: LOCK_MESSAGE }],
        });
      }
      // T-036: CHECK CONSTRAINT ck_booking_seats จับซ้ำอีกชั้น — ตอบ 400 BR-06 (ไม่ใช่ 500)
      if (err && err.errorNum === ORA_CHECK_VIOLATED) {
        throw body400('seats', BR06_DETAILS);
      }
      throw err;
    }

    const created = await repos.booking.findDetails(bookingId);
    if (!created) throw new Error('insert booking succeeded but row not found');
    const qrImage = await renderQrImage(created.QR_TOKEN || qrToken);
    return { ...toBooking(created), qr_token: created.QR_TOKEN || qrToken, qr_image: qrImage };
  }

  // ============================ UC-20 GET /booking/{id}/qr ============================
  async function getBookingQr(bookingId, empId) {
    const id = intOrNull(bookingId);
    if (id === null || id <= 0) throw NOT_FOUND();
    const row = await repos.booking.findDetails(id);
    if (!row) throw NOT_FOUND();
    // ownership: เป็นการจองของคนอื่น → 403 (openapi 403 example)
    if (Number(row.CUST_ID) !== Number(empId)) {
      throw new HttpError(403, FOREIGN_QR_MESSAGE, { code: 'FORBIDDEN' });
    }
    // UC-20 A2: cancelled → ไม่มี QR ที่ใช้ได้ → 404 · checked_in → คืน status ให้แอปแสดงแทน
    if (row.STATUS === 'cancelled') throw NOT_FOUND();
    const qrImage = await renderQrImage(row.QR_TOKEN);
    return {
      booking_id: Number(row.BOOKING_ID),
      booking_code: row.BOOKING_CODE,
      qr_token: row.QR_TOKEN,
      qr_image: qrImage,
      status: row.STATUS,
      seats: Number(row.SEATS),
      board_stop_name: row.BOARD_STOP_NAME ?? null,
      alight_stop_name: row.ALIGHT_STOP_NAME ?? null,
      depart_at: toIso(row.DEPART_AT),
    };
  }

  // ============================ UC-19 GET /booking/me ============================
  // status default = upcoming (openapi StatusParam) · cust_id มาจาก JWT เท่านั้น (empId ข้างนอก)
  // page/limit ใช้ clamp ตาม convention (ไม่ตอบ 400 — ดู utils/pagination)
  async function listMyBookings(queryParams = {}, empId) {
    const raw = queryParams.status;
    const status =
      raw === undefined || raw === null || raw === '' ? 'upcoming' : String(raw).trim();
    if (!MY_STATUS_VALUES.includes(status)) {
      throw body400('status', 'must be one of upcoming, completed, cancelled, all');
    }
    const { page, limit, offset } = parsePagination(queryParams);
    const total = await repos.booking.countMine({ custId: empId, status });
    const rows = total > offset ? await repos.booking.listMine({ custId: empId, status, limit, offset }) : [];
    return { data: rows.map(toMyBooking), meta: buildMeta({ page, limit, total }) };
  }

  // ============================ UC-21 POST /booking/{id}/cancel ============================
  // ลำดับตรวจ (decision): 404 → 403 เจ้าของ → สถานะ (409 ซ้ำ / 422 checked_in) → 409 เกิน 20 นาที
  // BR-08: คืนที่นั่งด้วยการตัด status เป็น 'cancelled' — SUM นับเฉพาะ 'reserved' อยู่แล้ว
  async function cancelBooking(bookingId, empId) {
    const id = intOrNull(bookingId);
    if (id === null || id <= 0) throw NOT_FOUND();

    await withTransaction(async (conn) => {
      // 1) ล็อกแถวก่อน (blocking FOR UPDATE ตาม openapi x-transaction — ไม่ใช่ NOWAIT)
      const locked = await repos.booking.lockBooking(conn, id);
      if (!locked) throw NOT_FOUND();
      // 2) เจ้าของ (UC-21 4a) — ต้องก่อนตรวจอย่างอื่น ห้าม leak ข้อมูลคนอื่น
      if (Number(locked.CUST_ID) !== Number(empId)) {
        throw new HttpError(403, FOREIGN_CANCEL_MESSAGE, { code: 'FORBIDDEN' });
      }
      // 3) สถานะ (UC-21 4c) — cancelled → 409 (ยกเลิกซ้ำ) · checked_in/completed/no_show → 422
      if (locked.STATUS === 'cancelled') {
        throw new HttpError(409, ALREADY_CANCELLED_MESSAGE, { code: 'INVALID_STATUS' });
      }
      if (locked.STATUS !== 'reserved') throw invalidStatusError(locked.STATUS);
      // 4) ASM-07-2: ต้องยกเลิกก่อนรถถึงจุดขึ้นอย่างน้อย 20 นาที → 409 CANCEL_TOO_LATE
      if (leadMinutes(locked.BOARD_ARRIVE_AT) < LEAD_MINUTES) {
        throw new HttpError(409, CANCEL_TOO_LATE_MESSAGE, { code: 'CANCEL_TOO_LATE' });
      }
      // 5) BR-08 — UPDATE status + cancel_time → commit (ที่นั่งคืนทันทีหลัง commit)
      await repos.booking.cancelBooking(conn, id);
    });

    const after = await repos.booking.findDetails(id);
    if (!after) throw NOT_FOUND();
    return toMyBooking(after);
  }

  return { listAvailable, createBooking, getBookingQr, listMyBookings, cancelBooking };
}

module.exports = { createBookingService };
