// src/services/report.service.js — T-054/T-055/T-056: report APIs R1 (UC-27), R4 (UC-28), R6 (UC-29)
// - R1 boardingAlightingWeek: ?year= บังคับ (openapi YearParam 2500–2600, ตัวเลข พ.ศ.)
//     · พ.ศ. → ค.ศ. (year - 543) + ขอบสัปดาห์ ISO แบบ Monday-boundary:
//       fromWeek = จันทร์ของสัปดาห์ที่มี 1 ม.ค. · toWeek = จันทร์ของสัปดาห์ที่มี 31 ธ.ค.
//       (คำนวณใน JS — ไม่พึ่ง NLS/ORACLE format · ค.ศ. ที่ปิดปี = จันทร์ 29 ธ.ค. 2024 สำหรับ 2025)
//     · ⚠ week-boundary: สัปดาห์ที่คาบเกี่ยวปี (เช่น 29 ธ.ค.–4 ม.ค.) ติดทั้งสองปีของรายงาน
//       เพราะ view เก็บ grain ระดับสัปดาห์ (ตัดสินใจออกแบบ — บันทึกใน handoff)
//     · rows = openapi ReportBoardingAlightingWeek.rows (week_no int, board_count, alight_count)
//     · chart = bar_grouped + labels "สัปดาห์ N" + datasets จำนวนคนขึ้น/จำนวนคนลง (ตัวอย่าง openapi)
// - R4 dailyByRoute: ?from=&to= บังคับ (YYYY-MM-DD, from <= to) + route_id optional
//     · route_ids = route ที่ is_active = 1 (กรองตาม route_id ถ้าส่งมา)
//     · rows: ทุกวันในช่วง (calendar spine ทำใน SQL) · day_name = จ/อ/พ/พฤ/ศ/ส/อา คำนวณเอง
//       (ไม่ใช้ TO_CHAR(...,'Day') ของ view เพราะค่าขึ้น NLS) · total = ผลรวม route_counts
//     · chart = stacked_bar (ตัวอย่าง openapi)
// - R6 driverWorkload: ?from=&to= บังคับ (YYYY-MM-DD, from <= to)
//     · rows: ทุกคนขับ (SQL) + แถวรวม ROLLUP (driver_id/driver_name = null ตามตัวอย่าง openapi)
//     · chart = bar_grouped · labels = ชื่อคนขับ (ไม่รวมแถวรวม) · datasets ก่อน/หลัง 17:00
// - READ ONLY — ไม่มี transaction (UC-30: ไม่มีการเปลี่ยนแปลงข้อมูล)
const { HttpError } = require('../middleware/errorHandler');
const { dateOnly } = require('../utils/mappers');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_RE = /^\d{4}$/;
const YEAR_MIN = 2500; // openapi YearParam minimum
const YEAR_MAX = 2600; // openapi YearParam maximum
const BUDDHIST_ERA = 543;
// getUTCDay: 0=อาทิตย์ … 6=เสาร์ → ชื่อวันย่อไทยตาม openapi R4 (จ/อ/พ/พฤ/ศ/ส/อา)
const THAI_DAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

// 400 validate-middleware style envelope (field-level details)
function body400(field, message) {
  return new HttpError(400, 'ข้อมูลที่ส่งมาไม่ถูกต้อง', {
    code: 'VALIDATION_ERROR',
    details: [{ field, message }],
  });
}

// กัน rollover ของ Date.parse ('2026-02-30') — เทคนิคเดียวกับ booking/driver service
function isRealDate(text) {
  const [y, m, d] = text.split('-').map(Number);
  const round = new Date(Date.UTC(y, m - 1, d));
  return round.getUTCFullYear() === y && round.getUTCMonth() === m - 1 && round.getUTCDate() === d;
}

// ?from= / ?to= บังคับตาม openapi FromParam/ToParam (required, YYYY-MM-DD)
function parseDateParam(query, field) {
  const raw = query[field];
  if (raw === undefined || raw === null || raw === '') throw body400(field, 'is required');
  const text = typeof raw === 'string' ? raw.trim() : null;
  if (text === null || !DATE_RE.test(text) || !isRealDate(text)) {
    throw body400(field, 'must be a date (YYYY-MM-DD)');
  }
  return text;
}

// ?route_id= optional — ไม่ส่ง/ว่าง = ทุกเส้นทาง, ส่งมาต้องเป็นจำนวนเต็มบวก
function parseRouteId(query) {
  const raw = query.route_id;
  if (raw === undefined || raw === null || raw === '') return null;
  const text = typeof raw === 'string' ? raw.trim() : String(raw);
  if (!/^\d+$/.test(text) || Number(text) <= 0) {
    throw body400('route_id', 'must be a positive integer');
  }
  return Number(text);
}

// ?year= บังคับ — 4 หลัก, 2500–2600 (openapi YearParam), ค่าที่ส่งมาคือ พ.ศ.
function parseYear(query) {
  const raw = query.year;
  if (raw === undefined || raw === null || raw === '') throw body400('year', 'is required');
  const text = typeof raw === 'string' ? raw.trim() : String(raw);
  if (!YEAR_RE.test(text) || Number(text) < YEAR_MIN || Number(text) > YEAR_MAX) {
    throw body400('year', `must be an integer between ${YEAR_MIN} and ${YEAR_MAX}`);
  }
  return Number(text);
}

// ISO week boundary: ย้อนกลับจากวันใดวันหนึ่งไปจันทร์ของสัปดาห์นั้น ((getUTCDay()+6)%7 = offset ถึงจันทร์)
function mondayOf(date) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

// พ.ศ. → ค.ศ. + ขอบสัปดาห์ของรายงานปีนั้น (ดูข้อ week-boundary ในหัวไฟล์)
function weekBounds(yearBuddhist) {
  const ceYear = yearBuddhist - BUDDHIST_ERA;
  return {
    ceYear,
    fromWeek: isoDate(mondayOf(new Date(Date.UTC(ceYear, 0, 1)))),
    toWeek: isoDate(mondayOf(new Date(Date.UTC(ceYear, 11, 31)))),
  };
}

// ชื่อวันย่อไทยจาก service_date 'YYYY-MM-DD' (parse เป็น UTC — ไม่พึ่ง timezone ของเครื่อง)
function dayNameOf(serviceDate) {
  const [y, m, d] = serviceDate.split('-').map(Number);
  return THAI_DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function createReportService({ repos }) {
  // ============================ R1 (UC-27 / T-054) GET /report/boarding-alighting-week ============================
  async function boardingAlightingWeek(queryParams = {}) {
    const year = parseYear(queryParams);
    const routeId = parseRouteId(queryParams);
    const { fromWeek, toWeek } = weekBounds(year);
    const rows = await repos.report.weeklyBoarding({ fromWeek, toWeek, routeId });

    const shaped = rows.map((row) => ({
      week_no: Number(row.WEEK_NO ?? row.week_no ?? 0),
      week_start: dateOnly(row.WEEK_START ?? row.week_start),
      board_count: Number(row.BOARDED ?? row.boarded ?? 0),
      alight_count: Number(row.ALIGHTED ?? row.alighted ?? 0),
    }));

    return {
      year,
      total_weeks: shaped.length, // "จำนวนสัปดาห์ที่มีข้อมูล" (openapi)
      rows: shaped,
      chart: {
        type: 'bar_grouped',
        labels: shaped.map((row) => `สัปดาห์ ${row.week_no}`),
        datasets: [
          { label: 'จำนวนคนขึ้น', data: shaped.map((row) => row.board_count) },
          { label: 'จำนวนคนลง', data: shaped.map((row) => row.alight_count) },
        ],
      },
    };
  }

  // ============================ R4 (UC-28 / T-055) GET /report/daily-by-route ============================
  async function dailyByRoute(queryParams = {}) {
    const fromDate = parseDateParam(queryParams, 'from');
    const toDate = parseDateParam(queryParams, 'to');
    if (fromDate > toDate) throw body400('from', 'must be on or before to');
    const routeId = parseRouteId(queryParams);

    const routeIds = await repos.report.listActiveRouteIds(routeId);
    const rows = await repos.report.dailyByRoute({ fromDate, toDate, routeId });

    const shaped = rows.map((row) => {
      const serviceDate = dateOnly(row.SERVICE_DATE ?? row.service_date);
      const routeCounts = {};
      for (const id of routeIds) {
        routeCounts[String(id)] = Number(row[String(id)] || 0); // pivot column = รหัสเส้นทาง (NULL → 0)
      }
      const total = Object.values(routeCounts).reduce((sum, n) => sum + n, 0);
      return {
        service_date: serviceDate,
        day_name: serviceDate ? dayNameOf(serviceDate) : null,
        route_counts: routeCounts,
        total, // รวมทั้งวัน = ผลรวม route_counts (openapi: "ผลรวมของทุกเส้นทางในวันนั้น")
      };
    });

    return {
      from: fromDate,
      to: toDate,
      route_ids: routeIds,
      rows: shaped,
      chart: {
        type: 'stacked_bar',
        labels: shaped.map((row) => row.service_date),
        datasets: routeIds.map((id) => ({
          label: `เส้นทาง ${id}`,
          data: shaped.map((row) => row.route_counts[String(id)]),
        })),
      },
    };
  }

  // ============================ R6 (UC-29 / T-056) GET /report/driver-workload ============================
  async function driverWorkload(queryParams = {}) {
    const fromDate = parseDateParam(queryParams, 'from');
    const toDate = parseDateParam(queryParams, 'to');
    if (fromDate > toDate) throw body400('from', 'must be on or before to');

    const rows = await repos.report.driverWorkload({ fromDate, toDate });

    const shaped = rows.map((row) => {
      const id = row.DRIVER_ID ?? row.driver_id;
      return {
        driver_id: id === null || id === undefined ? null : Number(id), // null = แถวรวม ROLLUP
        driver_name: row.DRIVER_NAME ?? row.driver_name ?? null,
        total_trips: Number(row.TOTAL_TRIPS ?? row.total_trips ?? 0),
        before_17: Number(row.BEFORE_17 ?? row.before_17 ?? 0),
        after_17: Number(row.AFTER_17 ?? row.after_17 ?? 0),
      };
    });

    const drivers = shaped.filter((row) => row.driver_id !== null); // กราฟไม่รวมแถวรวม (ตัวอย่าง openapi)
    return {
      from: fromDate,
      to: toDate,
      rows: shaped,
      chart: {
        type: 'bar_grouped',
        labels: drivers.map((row) => row.driver_name),
        datasets: [
          { label: 'ก่อน 17:00', data: drivers.map((row) => row.before_17) },
          { label: 'หลัง 17:00', data: drivers.map((row) => row.after_17) },
        ],
      },
    };
  }

  return { boardingAlightingWeek, dailyByRoute, driverWorkload };
}

module.exports = { createReportService };
