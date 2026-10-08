process.env.JWT_SECRET = 'integration-test-secret-0123456789abcdef0123456789';
const { signToken, verifyToken, revokedByMarker } = require('../src/utils/token');

describe('password-change revocation boundary', () => {
  afterEach(() => jest.restoreAllMocks());
  test('signed tokens issued earlier in the same second are revoked; later login remains valid', () => {
    const base = Math.floor(Date.now() / 1000) * 1000;
    const clock = jest.spyOn(Date, 'now').mockReturnValue(base + 100);
    const oldSession = verifyToken(signToken({ empId: 1, jti: 'before' }));
    clock.mockReturnValue(base + 900);
    const newSession = verifyToken(signToken({ empId: 1, jti: 'after' }));
    expect(oldSession.iat).toBe(newSession.iat);
    expect(revokedByMarker(oldSession, new Date(base + 500))).toBe(true);
    expect(revokedByMarker(newSession, new Date(base + 500))).toBe(false);
  });
  test('equal timestamps, old tokens and invalid markers fail closed', () => {
    expect(revokedByMarker({ iat: 10, issuedAtMs: 10500 }, new Date(10500))).toBe(true);
    expect(revokedByMarker({ iat: 10 }, new Date(10500))).toBe(true);
    expect(revokedByMarker({ iat: 11 }, new Date(10500))).toBe(false);
    expect(revokedByMarker({ iat: 10 }, 'invalid')).toBe(true);
  });
});
