// src/services/driver.service.js — T-043..T-047: UC-22 (ตารางงานรายวัน), UC-23 (Start Trip),
//   UC-24 (Manifest LISTAGG), UC-25 (สแกน QR / BR-09), UC-26 (ปิดรอบ + BR-10 no_show + สรุป)
// - getMySchedule: ?date= ผิดรูป → 400, ไม่ส่ง → วันนี้ (default ใน SQL TRUNC(SYSDATE)); can_start/blocked_reason
//   ตาม UC-23 3b/3c เพื่อให้แอปแสดง Conflict Alert แทนกดแล้วเงียบ (openapi /driver/schedule)
// - startTrip: TX = lock schedule FOR UPDATE → 422 NOT_ASSIGNED / 403 (ไม่ใช่คนขับรอบนี้)
//   → 409 TRIP_ALREADY_STARTED (3c) → 409 TRIP_PENDING (3b) → INSERT trip → COMMIT → 201
// - getManifest: trip ต้องมีจริง (404) และเป็นของคนขับที่ Login เท่านั้น (403); is_passed = จุดที่ถึงเวลาแล้ว
// - scanQr: pre-tx trip (404/403/409 ปิดงานแล้ว) → TX lock booking FOR UPDATE → BR-09 → สถานะ →
//   UPDATE checked_in + INSERT trip_passenger + COMMIT (atomic กันสแกนซ้ำ — ASM-07-3 QR ใช้ได้ 1 ครั้ง)
//   · not_found → 404 QR_NOT_FOUND (openapi responses: "404 - ไม่พบ qr_token นี้ (result = not_found)")
//   · 4 กรณี UC-25 4a-4d → 200 ทุกกรณี ให้แอปตัดสินใจแสดงผล (openapi scan description)
// - completeTrip: TX = lock trip FOR UPDATE → 404/403/409 TRIP_ALREADY_COMPLETED →
//   UPDATE trip (end_time+completed) → BR-10 UPDATE booking reserved → no_show → สรุป + รายชื่อ no_show → COMMIT
//   · ถ้าขั้นใดล้ม → ROLLBACK ทั้งหมด (openapi: ห้ามมีรอบปิดแล้วแต่ booking ยังค้าง reserved)
const { HttpError } = require('../middleware/errorHandler');
const { intOrNull } = require('../utils/pagination');
const { dateOnly, toIso, numOrNull } = require('../utils/mappers');

const NOT_FOUND = () => new HttpError(404, 'ไม่พบข้อมูลที่ต้องการ', { code: 'NOT_FOUND' });
const QR_NOT_FOUND = () => new HttpError(404, 'ไม่พบ QR นี้ในระบบ', { code: 'QR_NOT_FOUND' });
const NOT_ASSIGNED_MESSAGE = 'รอบนี้ยังไม่ได้มอบหมายคนขับและรถ'; // openapi 422 NOT_ASSIGNED
const FOREIGN_TRIP_MESSAGE = 'คุณไม่ใช่คนขับที่ได้รับมอบหมายรอบนี้'; // ownership → 403
const TRIP_ALREADY_STARTED_MESSAGE = 'รอบนี้เริ่มงานไปแล้ว'; // openapi 409 TRIP_ALREADY_STARTED
const TRIP_PENDING_MESSAGE = 'ยังมีรอบงานค้างอยู่ที่ยังไม่ปิดงาน ต้องปิดรอบเดิมก่อน'; // UC-23 3b (code ไม่ระบุใน openapi)
const TRIP_NOT_RUNNING_MESSAGE = 'รอบนี้ปิดงานไปแล้ว'; // UC-25 precondition (trip ต้อง running)
const TRIP_ALREADY_COMPLETED_MESSAGE = 'รอบนี้ปิดงานไปแล้ว'; // openapi 409 TRIP_ALREADY_COMPLETED (T-047)
const COMPLETE_OK_MESSAGE = 'ปิดงานสำเร็จ'; // openapi 200 example (POST /driver/trip/{tripId}/complete)
const BLOCKED_STARTED = 'รอบนี้เริ่มงานไปแล้ว';
const BLOCKED_PENDING = 'ยังมีรอบงานค้างอยู่ที่ยังไม่ปิดงาน';

const WRONG_TRIP_MESSAGE = 'QR นี้ไม่ใช่ของรอบที่กำลังเดิน'; // openapi 4b wrong_trip example
const CANCELLED_MESSAGE = 'การจองนี้ถูกยกเลิกแล้ว'; // openapi 4c
const ALREADY_CHECKED_MESSAGE = 'เช็คอินไปแล้ว'; // openapi 4d (ASM-07-3)
const CHECKED_IN_MESSAGE = 'เช็คอินสำเร็จ'; // openapi 4a

const ORA_ROW_LOCKED = 54; // ORA-00054 → 409 (openapi start: ล็อกไม่ได้เพราะคนกดพร้อมกัน)

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 400 validate-middleware style envelope (field-level details)
function body400(field, message) {
  return new HttpError(400, 'ข้อมูลที่ส่งมาไม่ถูกต้อง', {
    code: 'VALIDATION_ERROR',
    details: [{ field, message }],
  });
}

// กัน rollover ของ Date.parse ('2026-02-30') — เทคนิคเดียวกับ booking/scheduling service
function isRealDate(text) {
  const [y, m, d] = text.split('-').map(Number);
  const round = new Date(Date.UTC(y, m - 1, d));
  return round.getUTCFullYear() === y && round.getUTCMonth() === m - 1 && round.getUTCDate() === d;
}

// DriverSchedule → openapi (13 ฟิลด์): end_at = depart_at + route.total_minutes (ตรรกะเดียวกับ toSchedule)
function toDriverSchedule(row) {
  const departAt = row.DEPART_AT;
  const totalMinutes = Number(row.TOTAL_MINUTES || 0);
  const departMs = departAt instanceof Date ? departAt.getTime() : new Date(departAt).getTime();
  const endMs = Number.isNaN(departMs) ? NaN : departMs + totalMinutes * 60000;
  const tripId = numOrNull(row.TRIP_ID);
  const pendingTripId = numOrNull(row.PENDING_TRIP_ID);
  let canStart = true;
  let blockedReason = null;
  if (tripId !== null) {
    canStart = false;
    blockedReason = BLOCKED_STARTED; // UC-23 3c
  } else if (pendingTripId !== null) {
    canStart = false;
    blockedReason = BLOCKED_PENDING; // UC-23 3b
  }
  return {
    sched_id: Number(row.SCHED_ID),
    service_date: dateOnly(row.SERVICE_DATE),
    depart_at: toIso(departAt),
    end_at: Number.isNaN(endMs) ? null : new Date(endMs).toISOString(),
    route_id: numOrNull(row.ROUTE_ID),
    route_name: row.ROUTE_NAME ?? null,
    total_minutes: numOrNull(row.TOTAL_MINUTES),
    veh_id: numOrNull(row.VEH_ID),
    plate_no: row.PLATE_NO ?? null,
    passenger_count: Number(row.PASSENGER_COUNT || 0),
    trip_id: tripId,
    can_start: canStart,
    blocked_reason: blockedReason,
  };
}

// Trip → openapi Trip schema (POST /driver/trip/{schedId}/start 201)
function toTrip(row) {
  return {
    trip_id: Number(row.TRIP_ID),
    sched_id: Number(row.SCHED_ID),
    driver_id: Number(row.DRIVER_ID),
    veh_id: Number(row.VEH_ID),
    start_time: toIso(row.START_TIME),
    end_time: toIso(row.END_TIME),
    status: row.STATUS,
  };
}

// TripSummary → openapi (12 ฟิลด์ · required 6): สรุปหลังปิดรอบ (UC-26 / BR-10)
function toTripSummary(row, noShowNames) {
  return {
    trip_id: Number(row.TRIP_ID ?? row.trip_id),
    sched_id: Number(row.SCHED_ID ?? row.sched_id),
    status: row.STATUS ?? row.status,
    start_time: toIso(row.START_TIME ?? row.start_time),
    end_time: toIso(row.END_TIME ?? row.end_time),
    total_booked: Number((row.TOTAL_BOOKED ?? row.total_booked) || 0),
    boarded: Number((row.BOARDED ?? row.boarded) || 0),
    alighted: Number((row.ALIGHTED ?? row.alighted) || 0),
    no_show_count: Number((row.NO_SHOW_COUNT ?? row.no_show_count) || 0),
    no_show_names: noShowNames,
    seats_booked: Number((row.SEATS_BOOKED ?? row.seats_booked) || 0),
    capacity: numOrNull(row.CAPACITY ?? row.capacity),
  };
}

// ManifestStop → openapi (9 ฟิลด์): is_passed = จุดที่ถึงเวลาถึงแล้ว (นิยาม contract ไม่ระบุวิธี — ใช้ arrive_at <= ตอนนี้)
function toManifestStop(row) {
  const arriveMs = row.ARRIVE_AT instanceof Date ? row.ARRIVE_AT.getTime() : new Date(row.ARRIVE_AT).getTime();
  return {
    stop_id: Number(row.STOP_ID),
    stop_name: row.STOP_NAME ?? null,
    stop_seq: Number(row.STOP_SEQ),
    arrive_at: toIso(row.ARRIVE_AT),
    board_count: Number(row.BOARD_COUNT || 0),
    board_names: row.BOARD_NAMES ?? null,
    alight_count: Number(row.ALIGHT_COUNT || 0),
    alight_names: row.ALIGHT_NAMES ?? null,
    is_passed: !Number.isNaN(arriveMs) && arriveMs <= Date.now(),
  };
}

function createDriverService({ db, repos }) {
  const { withTransaction } = db;

  // ============================ UC-22 GET /driver/schedule ============================
  async function getMySchedule(queryParams = {}, empId) {
    const raw = queryParams.date;
    let serviceDate = null;
    if (raw !== undefined && raw !== null && raw !== '') {
      const text = typeof raw === 'string' ? raw.trim() : null;
      if (text === null || !DATE_RE.test(text) || !isRealDate(text)) {
        throw body400('date', 'must be a date (YYYY-MM-DD)');
      }
      serviceDate = text;
    }
    const rows = await repos.driver.listMyRounds({ empId, serviceDate });
    return rows.map(toDriverSchedule);
  }

  // ============================ UC-23 POST /driver/trip/{schedId}/start ============================
  // ลำดับตรวจตาม openapi x-transaction: 1 lock schedule → 2 เป็นของคนขับ + ยังไม่มี trip
  //   → 3 ไม่มี trip running อื่นของคนขับ → 4 INSERT + COMMIT (3c ก่อน 3b — งานค้างไม่กลบกรณีรอบเดิมเริ่มแล้ว)
  async function startTrip(schedId, empId) {
    const id = intOrNull(schedId);
    if (id === null || id <= 0) throw NOT_FOUND();

    let tripId;
    try {
      tripId = await withTransaction(async (conn) => {
        const locked = await repos.driver.lockSchedule(conn, id);
        if (!locked) throw NOT_FOUND();
        const drivers = await repos.driver.findDriverAssignments(conn, id);
        const vehId = await repos.driver.findVehicleAssignment(conn, id);
        if (drivers.length === 0 || vehId === null) {
          throw new HttpError(422, NOT_ASSIGNED_MESSAGE, { code: 'NOT_ASSIGNED' });
        }
        if (!drivers.includes(Number(empId))) {
          throw new HttpError(403, FOREIGN_TRIP_MESSAGE, { code: 'FORBIDDEN' });
        }
        const existing = await repos.driver.findTripBySched(conn, id);
        if (existing) {
          throw new HttpError(409, TRIP_ALREADY_STARTED_MESSAGE, {
            code: 'TRIP_ALREADY_STARTED',
            details: [{ field: 'trip_id', message: `trip_id = ${Number(existing.TRIP_ID ?? existing.trip_id)}` }],
          });
        }
        const pending = await repos.driver.findDriverRunningTrip(conn, empId, id);
        if (pending) {
          throw new HttpError(409, TRIP_PENDING_MESSAGE, {
            code: 'TRIP_PENDING',
            details: [
              { field: 'trip_id', message: `trip_id = ${Number(pending.TRIP_ID ?? pending.trip_id)}` },
              { field: 'sched_id', message: `sched_id = ${Number(pending.SCHED_ID ?? pending.sched_id)}` },
            ],
          });
        }
        return repos.driver.insertTrip(conn, { schedId: id, driverId: Number(empId), vehId });
      });
    } catch (err) {
      // openapi: ล็อกตารางไม่ได้เพราะคนกดพร้อมกัน → ORA-00054 → 409 ไม่ค้าง
      if (err && err.errorNum === ORA_ROW_LOCKED) {
        throw new HttpError(409, 'มีผู้ใช้งานเริ่มรอบนี้พร้อมกัน โปรดลองอีกครั้ง', {
          code: 'SCHEDULE_LOCKED',
          details: [{ field: 'sched_id', message: 'sched_id ถูกล็อกโดยคำขออื่น' }],
        });
      }
      throw err;
    }

    const trip = await repos.driver.findTripById(tripId);
    if (!trip) throw new Error('insert trip succeeded but row not found');
    return toTrip(trip);
  }

  // ============================ UC-24 GET /driver/trip/{tripId}/manifest ============================
  async function getManifest(tripId, empId) {
    const id = intOrNull(tripId);
    if (id === null || id <= 0) throw NOT_FOUND();
    const trip = await repos.driver.findTripById(id);
    if (!trip) throw NOT_FOUND();
    if (Number(trip.DRIVER_ID) !== Number(empId)) {
      throw new HttpError(403, FOREIGN_TRIP_MESSAGE, { code: 'FORBIDDEN' });
    }
    const stops = await repos.driver.findManifestStops(id);
    return {
      trip_id: Number(trip.TRIP_ID),
      sched_id: Number(trip.SCHED_ID),
      route_name: trip.ROUTE_NAME ?? null,
      plate_no: trip.PLATE_NO ?? null,
      driver_name: trip.DRIVER_NAME ?? null,
      status: trip.STATUS,
      stops: stops.map(toManifestStop),
    };
  }

  // ============================ UC-25 POST /driver/trip/scan (BR-09) ============================
  // pre-tx: identity ของ trip (404 ไม่พบ / 403 ไม่ใช่คนขับรอบนี้ / 409 ปิดงานแล้ว = UC-25 precondition)
  // TX: lock booking FOR UPDATE → BR-09 (เทียบ booking.sched_id กับ trip.sched_id ของ trip_id ที่ส่งมา)
  //   → สถานะ → UPDATE checked_in + INSERT trip_passenger → COMMIT (แถว booking ถูกล็อกจน commit = กันสแกนซ้ำ)
  async function scanQr(body, empId) {
    const tripId = intOrNull(body.trip_id);
    const qrToken = typeof body.qr_token === 'string' ? body.qr_token.trim() : '';
    if (tripId === null || tripId <= 0) throw body400('trip_id', 'must be a positive integer');
    if (qrToken === '') throw body400('qr_token', 'is required');

    const trip = await repos.driver.findTripById(tripId);
    if (!trip) throw NOT_FOUND();
    if (Number(trip.DRIVER_ID) !== Number(empId)) {
      throw new HttpError(403, FOREIGN_TRIP_MESSAGE, { code: 'FORBIDDEN' });
    }
    if (trip.STATUS !== 'running') {
      throw new HttpError(409, TRIP_NOT_RUNNING_MESSAGE, { code: 'TRIP_NOT_RUNNING' });
    }

    const outcome = await withTransaction(async (conn) => {
      const booking = await repos.driver.lockBookingByQr(conn, qrToken, tripId);
      if (!booking) throw QR_NOT_FOUND();

      const base = {
        booking_id: Number(booking.BOOKING_ID),
        booking_code: booking.BOOKING_CODE,
        passenger_name: booking.PASSENGER_NAME ?? null,
      };

      // 4b BR-09: ผิดรอบ — ต้องเทียบกับ trip.sched_id ของ trip_id ที่ส่งมา (ห้าม join sched_id = ตัวเอง)
      if (Number(booking.SCHED_ID) !== Number(trip.SCHED_ID)) {
        return {
          result: 'wrong_trip',
          message: WRONG_TRIP_MESSAGE,
          booking_code: base.booking_code,
          passenger_name: base.passenger_name,
        };
      }
      // 4c: ยกเลิกแล้ว / no_show (ไม่ถึงรอบ — defensive: enum ไม่มี no_show → ห้ามขึ้นรถเหมือน cancelled)
      if (booking.STATUS === 'cancelled' || booking.STATUS === 'no_show') {
        return { result: 'cancelled', message: CANCELLED_MESSAGE, booking_code: base.booking_code, passenger_name: base.passenger_name };
      }
      // 4d: ASM-07-3 — QR ใช้ได้ 1 ครั้งต่อ 1 การจอง (checked_in/completed = เคยเช็คอินแล้ว)
      if (booking.STATUS === 'checked_in' || booking.STATUS === 'completed') {
        return {
          result: 'already_checked_in',
          message: ALREADY_CHECKED_MESSAGE,
          booking_id: base.booking_id,
          booking_code: base.booking_code,
          passenger_name: base.passenger_name,
          checkin_time: toIso(booking.CHECKIN_TIME),
        };
      }
      // 4a: reserved → เช็คอิน (จุดขึ้น = ที่ส่งมา หรือจุดขึ้นที่จองไว้ ตาม ScanRequest.checkin_stop_id)
      const stopId = intOrNull(body.checkin_stop_id) || Number(booking.BOARD_STOP_ID);
      const seqRow = await repos.driver.findStopSeq(conn, Number(trip.SCHED_ID), stopId);
      const boardSeq = seqRow ? Number(seqRow.STOP_SEQ ?? seqRow.stop_seq) : null;
      await repos.driver.updateCheckin(conn, Number(booking.BOOKING_ID));
      await repos.driver.insertTripPassenger(conn, {
        tripId,
        bookingId: Number(booking.BOOKING_ID),
        checkinStopId: stopId,
        boardSeq,
      });
      const checkin = await repos.driver.findCheckin(conn, tripId, Number(booking.BOOKING_ID));
      return {
        result: 'checked_in',
        message: CHECKED_IN_MESSAGE,
        booking_id: base.booking_id,
        booking_code: base.booking_code,
        passenger_name: base.passenger_name,
        seats: Number(booking.SEATS),
        checkin_time: toIso(checkin && checkin.CHECKIN_TIME),
        board_seq: boardSeq,
      };
    });

    return outcome;
  }

  // ============================ UC-26 POST /driver/trip/{tripId}/complete (T-047 / BR-10) ============================
  // TX ตาม openapi x-transaction: 1) SELECT trip FOR UPDATE → 2) UPDATE trip end_time+completed
  //   → 3) UPDATE booking reserved → no_show → 4) สรุป + รายชื่อ no_show (อ่านใน TX เดียวกัน) → COMMIT
  // ลำดับตรวจ: 404 ไม่พบ trip → 403 ไม่ใช่คนขับรอบนี้ → 409 ปิดแล้ว → ถ้าขั้นใดล้ม rollback ทั้งหมด
  async function completeTrip(tripId, empId) {
    const id = intOrNull(tripId);
    if (id === null || id <= 0) throw NOT_FOUND();

    const result = await withTransaction(async (conn) => {
      const locked = await repos.driver.lockTripById(conn, id);
      if (!locked) throw NOT_FOUND();
      const driverId = Number(locked.DRIVER_ID ?? locked.driver_id);
      const schedId = Number(locked.SCHED_ID ?? locked.sched_id);
      const status = locked.STATUS ?? locked.status;
      if (driverId !== Number(empId)) {
        throw new HttpError(403, FOREIGN_TRIP_MESSAGE, { code: 'FORBIDDEN' });
      }
      if (status !== 'running') {
        throw new HttpError(409, TRIP_ALREADY_COMPLETED_MESSAGE, { code: 'TRIP_ALREADY_COMPLETED' });
      }
      await repos.driver.updateTripComplete(conn, id);
      await repos.driver.markNoShow(conn, schedId); // BR-10
      const summary = await repos.driver.summarizeTrip(conn, id);
      if (!summary) throw new Error('trip disappeared during complete transaction');
      const noShowNames = await repos.driver.listNoShowNames(conn, schedId);
      return { summary, noShowNames };
    });

    return toTripSummary(result.summary, result.noShowNames);
  }

  return { getMySchedule, startTrip, getManifest, scanQr, completeTrip };
}

module.exports = { createDriverService };
