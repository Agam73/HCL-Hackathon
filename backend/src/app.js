import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import env from './config/env.js';
import { healthCheck } from './db/pool.js';
import requestContext from './middleware/requestContext.js';
import errorHandler, { notFoundHandler } from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';
import { ok } from './utils/response.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // No origin = curl/Postman/server-to-server; allow those.
        if (!origin || env.corsOrigins.includes(origin) || env.corsOrigins.includes('*')) {
          return callback(null, true);
        }
        // Not on the allow-list: answer without CORS headers and let the browser block it.
        return callback(null, false);
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestContext);
  app.use(
    morgan(env.isProd ? 'combined' : ':method :url :status :response-time[0]ms - :res[x-request-id]')
  );

  /** Liveness + DB reachability. Used by docker-compose and the demo checklist. */
  app.get('/health', async (req, res) => {
    let db;
    try {
      db = await healthCheck();
    } catch {
      db = false;
    }
    return res.status(db ? 200 : 503).json({
      success: db,
      data: {
        status: db ? 'UP' : 'DEGRADED',
        database: db ? 'UP' : 'DOWN',
        uptimeSeconds: Math.round(process.uptime()),
        env: env.nodeEnv,
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.get('/', (req, res) =>
    ok(res, { name: 'RetailPulse AI API', docs: env.apiPrefix, health: '/health' })
  );

  app.use(env.apiPrefix, apiRoutes);

  // Order matters: 404 for unknown routes, then the global error handler.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
