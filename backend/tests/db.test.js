// T-011: node-oracledb pool — mock 'oracledb' แล้วตรวจค่า config ที่ส่งเข้า createPool
jest.mock('oracledb', () => ({
  autoCommit: true,
  createPool: jest.fn(),
}));

const oracledb = require('oracledb');
const { initPool, closePool, getPool, query, checkDbHealth } = require('../src/config/db');

describe('config/db pool (T-011)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await closePool();
  });

  test('initPool เรียก createPool ด้วยค่า config ตาม 17.5.3 (poolMin 2, poolMax 10, connectString host:port/service)', async () => {
    const fakePool = { close: jest.fn() };
    oracledb.createPool.mockResolvedValue(fakePool);

    const pool = await initPool();

    expect(pool).toBe(fakePool);
    const cfg = oracledb.createPool.mock.calls[0][0];
    expect(cfg).toMatchObject({
      poolMin: expect.any(Number),
      poolMax: expect.any(Number),
      poolIncrement: 1,
      stmtCacheSize: 25,
    });
    expect(cfg.connectString).toMatch(/^.*:\d+\/.+$/); // host:port/SERVICE ไม่ใช่ SID
    expect(cfg.user).toBeDefined();
    expect(getPool()).toBe(fakePool);
  });

  test('initPool ครั้งที่ 2 ไม่สร้าง pool ซ้ำ', async () => {
    oracledb.createPool.mockResolvedValue({ close: jest.fn() });
    await initPool();
    await initPool();
    expect(oracledb.createPool).toHaveBeenCalledTimes(1);
  });

  test('query คง non-autocommit (autoCommit:false) — ไม่ force true เหมือนเดิม', async () => {
    const execute = jest.fn().mockResolvedValue({ rows: [[1]] });
    const close = jest.fn().mockResolvedValue(undefined);
    oracledb.createPool.mockResolvedValue({ getConnection: jest.fn().mockResolvedValue({ execute, close }), close: jest.fn() });
    await initPool();

    const result = await query('SELECT 1 FROM DUAL');

    expect(execute).toHaveBeenCalledWith('SELECT 1 FROM DUAL', [], { autoCommit: false });
    expect(close).toHaveBeenCalled();
    expect(result.rows).toEqual([[1]]);
  });

  test('query ให้ caller override autoCommit ได้เอง (read-only ที่ปิด tx) และรับ binds', async () => {
    const execute = jest.fn().mockResolvedValue({ rows: [] });
    const close = jest.fn().mockResolvedValue(undefined);
    oracledb.createPool.mockResolvedValue({ getConnection: jest.fn().mockResolvedValue({ execute, close }), close: jest.fn() });
    await initPool();

    await query('SELECT * FROM employee WHERE emp_id = :id', [1], { autoCommit: true });

    expect(execute).toHaveBeenCalledWith('SELECT * FROM employee WHERE emp_id = :id', [1], { autoCommit: true });
  });

  test('query: execute ล้มเหลว → connection ถูก close ยังคงค้าง (regression) และ error ถูกส่งต่อ', async () => {
    const execute = jest.fn().mockRejectedValue(new Error('ORA-00942: table or view does not exist'));
    const close = jest.fn().mockResolvedValue(undefined);
    oracledb.createPool.mockResolvedValue({ getConnection: jest.fn().mockResolvedValue({ execute, close }), close: jest.fn() });
    await initPool();

    await expect(query('SELECT * FROM nope')).rejects.toThrow('ORA-00942');
    expect(close).toHaveBeenCalledTimes(1);
  });

  test('checkDbHealth คืน connected + latencyMs เมื่อ query สำเร็จ', async () => {
    const execute = jest.fn().mockResolvedValue({});
    const close = jest.fn().mockResolvedValue(undefined);
    oracledb.createPool.mockResolvedValue({ getConnection: jest.fn().mockResolvedValue({ execute, close }), close: jest.fn() });
    await initPool();

    const health = await checkDbHealth();

    expect(health.connected).toBe(true);
    expect(typeof health.latencyMs).toBe('number');
    expect(execute).toHaveBeenCalledWith('SELECT 1 FROM DUAL');
    expect(close).toHaveBeenCalled();
  });

  test('checkDbHealth throw เมื่อยังไม่ init pool — ต่างจาก test ผ่าน', async () => {
    await closePool();
    await expect(checkDbHealth()).rejects.toThrow('pool not initialized');
  });
});
