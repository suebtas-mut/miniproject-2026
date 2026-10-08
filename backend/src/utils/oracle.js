// src/utils/oracle.js — แปลง error ของ Oracle (errorNum) เป็น HttpError ตาม OpenAPI
// ห้ามส่งข้อความของ Oracle ออกไปหา client (P-04 ข้อ 18) — ใช้เฉพาะเลข errorNum เท่านั้น
const { HttpError } = require('../middleware/errorHandler');

const ORA_UNIQUE = 1; // ORA-00001 unique constraint violated
const ORA_CHILD_NOT_FOUND = 2291; // ORA-02291 integrity constraint (FK) violated - parent not found
const ORA_CHILD_EXISTS = 2292; // ORA-02292 integrity constraint - child record found

function translateOracleError(err, messages = {}) {
  const errorNum = err && err.errorNum;
  if (errorNum === ORA_UNIQUE && messages.duplicate) {
    return new HttpError(409, messages.duplicate.message, {
      code: messages.duplicate.code || 'DUPLICATED',
    });
  }
  if (errorNum === ORA_CHILD_NOT_FOUND && messages.foreignKey) {
    return new HttpError(422, messages.foreignKey.message, {
      code: messages.foreignKey.code || 'FK_VIOLATION',
    });
  }
  if (errorNum === ORA_CHILD_EXISTS && messages.referenced) {
    return new HttpError(422, messages.referenced.message, {
      code: messages.referenced.code || 'HAS_DEPENDENT_DATA',
    });
  }
  return null;
}

module.exports = { translateOracleError, ORA_UNIQUE, ORA_CHILD_NOT_FOUND, ORA_CHILD_EXISTS };
