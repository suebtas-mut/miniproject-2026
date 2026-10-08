// src/repositories/index.js — export กลางของ repositories ทั้งหมด (T-015/T-016/T-019…T-021, T-024…T-027, T-029…T-042)
// แยก repository ออกจาก service เพื่อให้ test inject fake ได้ (ไม่ต้อง mock SQL)
const auth = require('./auth.repository');
const employee = require('./employee.repository');
const department = require('./department.repository');
const position = require('./position.repository');
const role = require('./role.repository');
const permission = require('./permission.repository');
const stop = require('./stop.repository');
const route = require('./route.repository');
const vehicle = require('./vehicle.repository');
const schedule = require('./schedule.repository');
const booking = require('./booking.repository');
const audit = require('./audit.repository');
const driver = require('./driver.repository');
const report = require('./report.repository');

module.exports = { auth, employee, department, position, role, permission, stop, route, vehicle, schedule, booking, audit, driver, report };
