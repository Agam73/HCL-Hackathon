import { createApp } from './app.js';
import env from './config/env.js';
import { closePool, healthCheck } from './db/pool.js';

const app = createApp();

const server = app.listen(env.port, async () => {
  console.log(`[api] RetailPulse AI listening on http://localhost:${env.port}`);
  console.log(`[api] routes:  http://localhost:${env.port}${env.apiPrefix}`);
  console.log(`[api] health:  http://localhost:${env.port}/health`);
  try {
    await healthCheck();
    console.log('[db ] connected');
  } catch (err) {
    console.warn(`[db ] NOT connected: ${err.message}`);
    console.warn('[db ] start it with: docker compose up -d db && npm run db:migrate && npm run db:seed');
  }
});

// A crash should be loud and should not leave the process half-alive.
process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[fatal] uncaught exception:', err);
  shutdown('uncaughtException', 1);
});

function shutdown(signal, code = 0) {
  console.log(`[api] ${signal} received, shutting down`);
  server.close(async () => {
    await closePool().catch(() => {});
    process.exit(code);
  });
  setTimeout(() => process.exit(code), 8000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default server;
