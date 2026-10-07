// src/server.js — entry point (T-011): init pool แล้วค่อยเปิด server
const env = require('./config/env');
const { initPool, closePool } = require('./config/db');
const { createApp } = require('./app');
const { log } = require('./middleware/logger');

async function main() {
  try {
    await initPool();
    log('info', `Oracle pool ready (${env.db.user}@${env.db.connectString}, min=${env.db.poolMin} max=${env.db.poolMax})`);
  } catch (err) {
    // บันทึกชัดเจนว่า pool init ล้มเหลว แต่ยังเปิด server เพื่อให้ /health ตอบ 503 ได้
    log('error', `Oracle pool init failed: ${err.message}`);
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    log('info', `${env.appName} listening on port ${env.port} (${env.nodeEnv})`);
  });

  const shutdown = async (signal) => {
    log('info', `${signal} received — shutting down`);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
  main();
}

module.exports = { main };
