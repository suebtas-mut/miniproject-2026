// src/middleware/validate.js — T-012: request validation middleware
// ตรวจ req.body ตาม schema แบบเรียบง่าย (ไม่พึ่ง library ภายนอก)
// schema รูปแบบ: { field: { required?: boolean, type?: 'string'|'number'|'integer'|'boolean', maxLength?: n } }

function typeOfValue(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function validate(schema) {
  return function validateMiddleware(req, res, next) {
    const errors = [];
    const body = req.body || {};

    for (const [field, rule] of Object.entries(schema)) {
      const value = body[field];

      if (value === undefined || value === null || value === '') {
        if (rule.required) errors.push(`'${field}' is required`);
        continue;
      }
      if (rule.type) {
        const actual = typeOfValue(value);
        const expected = rule.type;
        const matches =
          expected === 'integer'
            ? actual === 'number' && Number.isInteger(value)
            : actual === expected;
        if (!matches) errors.push(`'${field}' must be ${expected}, got ${actual}`);
      }
      if (rule.maxLength !== undefined && String(value).length > rule.maxLength) {
        errors.push(`'${field}' must be at most ${rule.maxLength} characters`);
      }
      if (rule.minLength !== undefined && String(value).length < rule.minLength) {
        errors.push(`'${field}' must be at least ${rule.minLength} characters`);
      }
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`'${field}' must be one of: ${rule.enum.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', errors });
    }
    return next();
  };
}

module.exports = { validate };
