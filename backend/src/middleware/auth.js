// src/middleware/auth.js — T-015: JWT authentication + RBAC + login rate limit
// - authenticate: ตรวจ Bearer token, blacklist (logout/change-password), account is_active
// - requirePermission: โหลดสิทธิ์จาก DB ทุก request (ไม่ cache, ไม่ hardcode role — UC-09)
// - loginRateLimiter: 5 ครั้งผิดติดต่อกัน / 15 นาที → 429 TOO_MANY_ATTEMPTS (OpenAPI Login 429)
const { HttpError, errorBody } = require('./errorHandler');
const { verifyToken, markerJti } = require('../utils/token');

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map();

function attemptKey(req) {
  return `${req.ip || 'unknown'}|${(req.body && req.body.username) || ''}`;
}

function loginRateLimiter(req, res, next) {
  const record = loginAttempts.get(attemptKey(req));
  if (record) {
    if (Date.now() - record.startedAt >= LOGIN_WINDOW_MS) {
      loginAttempts.delete(attemptKey(req));
    } else if (record.count >= LOGIN_MAX_ATTEMPTS) {
      return res
        .status(429)
        .json(errorBody(429, 'TOO_MANY_ATTEMPTS', 'พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่'));
    }
  }
  return next();
}

function recordLoginFailure(req) {
  const key = attemptKey(req);
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || now - record.startedAt >= LOGIN_WINDOW_MS) {
    if (loginAttempts.size > 5000) loginAttempts.clear();
    loginAttempts.set(key, { count: 1, startedAt: now });
    return;
  }
  record.count += 1;
}

function clearLoginAttempts(req) {
  loginAttempts.delete(attemptKey(req));
}

// ใช้ใน test ให้ rate limit state หายระหว่างเคส
function resetLoginAttempts() {
  loginAttempts.clear();
}

function createAuthMiddleware({ repos }) {
  async function authenticate(req, res, next) {
    try {
      const header = req.headers.authorization || '';
      const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
      if (!match) throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่', { code: 'UNAUTHORIZED' });

      let payload;
      try {
        payload = verifyToken(match[1].trim());
      } catch (err) {
        // รวมหมดอายุ/ถูกดัดแปลง/secret ผิด → 401 เดียวกัน ไม่บอกว่าอะไรผิด
        throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่', { code: 'UNAUTHORIZED' });
      }
      if (!payload || !payload.jti || !payload.empId || !payload.iat) {
        throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่', { code: 'UNAUTHORIZED' });
      }

      // ตรวจ blacklist: logout (jti ตรงตัว) และ change-password (marker < iat)
      const revokedRows = await repos.auth.findRevokedTokens(payload.jti, markerJti(payload.empId));
      const exact = revokedRows.find((row) => row.JTI === payload.jti);
      if (exact) throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่', { code: 'TOKEN_REVOKED' });

      const marker = revokedRows.find((row) => row.JTI === markerJti(payload.empId));
      if (marker && marker.REVOKED_AT && payload.iat < Math.floor(new Date(marker.REVOKED_AT).getTime() / 1000)) {
        throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่', { code: 'TOKEN_REVOKED' });
      }

      const emp = await repos.employee.findEmployeeById(payload.empId);
      if (!emp) throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่', { code: 'UNAUTHORIZED' });
      if (Number(emp.IS_ACTIVE) !== 1) {
        throw new HttpError(403, 'บัญชีถูกปิดใช้งาน', { code: 'FORBIDDEN' });
      }

      req.user = { empId: Number(payload.empId), username: emp.USERNAME };
      req.token = { jti: payload.jti, iat: payload.iat, exp: payload.exp };
      next();
    } catch (err) {
      next(err);
    }
  }

  function requirePermission(permCode) {
    return async function permissionMiddleware(req, res, next) {
      try {
        const permissions = await repos.auth.loadPermissions(req.user.empId);
        if (!permissions.includes(permCode)) {
          throw new HttpError(403, 'ไม่มีสิทธิ์เข้าถึงส่วนนี้', { code: 'FORBIDDEN' });
        }
        next();
      } catch (err) {
        next(err);
      }
    };
  }

  return { authenticate, requirePermission };
}

module.exports = {
  createAuthMiddleware,
  loginRateLimiter,
  recordLoginFailure,
  clearLoginAttempts,
  resetLoginAttempts,
  LOGIN_WINDOW_MS,
  LOGIN_MAX_ATTEMPTS,
};
