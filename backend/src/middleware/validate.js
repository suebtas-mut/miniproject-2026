// src/middleware/validate.js — T-012/T-016: request validation middleware
// ตรวจ req.body ตาม schema แบบเรียบง่าย (ไม่พึ่ง library ภายนอก)
// schema รูปแบบ:
//   { field: { required?, type?: 'string'|'number'|'integer'|'boolean',
//              minLength?, maxLength?, enum?, pattern?, patternMessage? } }
// Response: OpenAPI envelope พร้อม details (field-level) + legacy `errors` array (兼容 test เดิม)

const { errorBody } = require('./errorHandler');

function typeOfValue(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function validate(schema) {
  return function validateMiddleware(req, res, next) {
    const errors = []; // { field, message, text }
    const body = req.body || {};

    const push = (field, message) => errors.push({ field, message, text: `'${field}' ${message}` });

    for (const [field, rule] of Object.entries(schema)) {
      const value = body[field];

      if (value === undefined || value === null || value === '') {
        if (rule.required) push(field, 'is required');
        continue;
      }
      if (rule.type) {
        const actual = typeOfValue(value);
        const expected = rule.type;
        const matches =
          expected === 'integer'
            ? actual === 'number' && Number.isInteger(value)
            : actual === expected;
        if (!matches) push(field, `must be ${expected}, got ${actual}`);
      }
      if (rule.minLength !== undefined && String(value).length < rule.minLength) {
        push(field, `must be at least ${rule.minLength} characters`);
      }
      if (rule.maxLength !== undefined && String(value).length > rule.maxLength) {
        push(field, `must be at most ${rule.maxLength} characters`);
      }
      if (rule.enum && !rule.enum.includes(value)) {
        push(field, `must be one of: ${rule.enum.join(', ')}`);
      }
      if (rule.pattern && !rule.pattern.test(String(value))) {
        push(field, rule.patternMessage || 'has an invalid format');
      }
    }

    if (errors.length > 0) {
      const body2 = errorBody(400, 'VALIDATION_ERROR', 'ข้อมูลที่ส่งมาไม่ถูกต้อง');
      body2.error.details = errors.map((e) => ({ field: e.field, message: e.message }));
      body2.errors = errors.map((e) => e.text);
      return res.status(400).json(body2);
    }
    return next();
  };
}

module.exports = { validate };
