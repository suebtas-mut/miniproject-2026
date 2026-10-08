// src/services/index.js — export กลางของ services ทั้งหมด (T-015/T-016/T-019…T-021, T-024…T-027, T-029…T-042)
// รับ { db, repos } เพื่อให้ test inject ของปลอมได้โดยไม่แตะ config/db จริง
const { createAuthService } = require('./auth.service');
const { createMasterService } = require('./master.service');
const { createRbacService } = require('./rbac.service');
const { createFrontService } = require('./front.service');
const { createSchedulingService } = require('./scheduling.service');
const { createBookingService } = require('./booking.service');
const { createDriverService } = require('./driver.service');
const { createReportService } = require('./report.service');

function createServices({ db, repos } = {}) {
  const dbModule = db || require('../config/db');
  const repoModule = repos || require('../repositories');
  return {
    auth: createAuthService({ db: dbModule, repos: repoModule }),
    master: createMasterService({ db: dbModule, repos: repoModule }),
    rbac: createRbacService({ db: dbModule, repos: repoModule }),
    front: createFrontService({ db: dbModule, repos: repoModule }),
    scheduling: createSchedulingService({ db: dbModule, repos: repoModule }),
    booking: createBookingService({ db: dbModule, repos: repoModule }),
    driver: createDriverService({ db: dbModule, repos: repoModule }),
    report: createReportService({ repos: repoModule }),
  };
}

module.exports = { createServices };
