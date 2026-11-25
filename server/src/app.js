import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getEnv } from './config/env.js';
import { dbConnection } from './config/db.js';
import { csrfOriginCheck } from './middleware/csrf.js';
import { forbidden } from './utils/errors.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createAuthRouter } from './routes/authRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import operationsRoutes from './routes/operationsRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(options = {}) {
  const env = getEnv();
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );

  app.use((req, res, next) =>
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        const hostOrigin = req.headers.host ? `${req.protocol}://${req.headers.host}` : null;
        if (env.clientOrigins.includes(origin) || (hostOrigin && origin === hostOrigin)) {
          return callback(null, true);
        }
        return callback(
          forbidden(`Origin ${origin} blocked by CORS policy.`, 'CSRF_ORIGIN_DENIED')
        );
      },
      credentials: true,
    })(req, res, next)
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(csrfOriginCheck);

  app.get('/api/v1/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'hostel-booking-management-api',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/v1/ready', (_req, res) => {
    const connected = dbConnection.isConnected();
    if (!connected) {
      return res.status(503).json({
        status: 'unavailable',
        database: 'disconnected',
      });
    }
    return res.json({
      status: 'ready',
      database: 'connected',
      transactionsSupported: dbConnection.supportsTransactions(),
    });
  });

  const loginRateLimitMax =
    options.loginRateLimitMax ?? (env.nodeEnv === 'test' ? 1000 : 30);

  app.use('/api/v1/auth', createAuthRouter({ loginRateLimitMax }));
  app.use('/api/v1', inventoryRoutes);
  app.use('/api/v1', bookingRoutes);
  app.use('/api/v1', operationsRoutes);

  // Serve production Vite bundle when built and not in API-only/test mode
  const clientDistDir = path.resolve(__dirname, '../../client/dist');
  if (env.nodeEnv === 'production' && fs.existsSync(clientDistDir)) {
    app.use(express.static(clientDistDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      return res.sendFile(path.join(clientDistDir, 'index.html'));
    });
  }

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
